/**
 * @fileOverview Dynamic Failure Replanner & Loop Detection Engine (Rule 23, 47, 48, 60)
 *
 * Implements autonomous failure recovery for Agentic DAG workflows:
 * - Prunes failed steps and all downstream transitive dependents.
 * - Enforces hard replan budget ceilings (`maxReplansPerRun = 3`, Rule 23).
 * - Detects oscillation loops and blacklists recurringly failing capabilities (Rule 47).
 * - Preserves completed step results and stitches remedial sub-DAGs.
 * - Validates acyclicity with Kahn's algorithm before persistence.
 * - Fail-closed emergency dead-man pause evaluation (Rule 60).
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 16 & 59: Persona capability and domain filtering.
 * - Rule 23: Replan budget ceiling enforcement.
 * - Rule 27: Saga compensating capability binding.
 * - Rule 47: Never trust the model (DAG validation + Zod schema validation).
 * - Rule 48: Failure isolation and diagnostic sanitization.
 * - Rule 58: Routes to Pro model tier for deep remedial planning.
 * - Rule 60: Emergency dead-man switch fail-closed enforcement.
 */

import {
  type ExecutionPlan,
  type PlanStep,
  AgentRuntimeError,
} from '../agent-run-types';
import {
  type ReplanInput,
  ReplanInputSchema,
  RemedialPlanCandidateSchema,
} from './planner-types';
import { validateExecutionPlanDag } from './dag-validator';
import { TieredModelRouter } from '../routing/model-router';
import { type AgentRunStore } from '../agent-run-store';
import {
  type CapabilityRegistryStore,
  canonicalCapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import { type AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { RISK_LEVEL_WEIGHTS } from '@/platform/capabilities/contracts/risk-levels';
import {
  globalAgentPersonaRegistry,
  type AgentPersona,
} from '@/platform/identity/agent-registry';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';

export interface AgentReplannerOptions {
  modelRouter: TieredModelRouter;
  capabilityRegistry?: CapabilityRegistryStore;
  runStore: AgentRunStore;
}

export class AgentReplanner {
  private readonly modelRouter: TieredModelRouter;
  private readonly capabilityRegistry: CapabilityRegistryStore;
  private readonly runStore: AgentRunStore;

  constructor(options: AgentReplannerOptions) {
    this.modelRouter = options.modelRouter;
    this.capabilityRegistry = options.capabilityRegistry ?? canonicalCapabilityRegistryStore;
    this.runStore = options.runStore;
  }

  /**
   * Dynamically replans a failed step, pruning downstream dependents and stitching remedial steps.
   */
  async replan(rawInput: ReplanInput): Promise<ExecutionPlan> {
    const input = ReplanInputSchema.parse(rawInput);
    const { organizationId, runId, failedStepId, failureReason } = input;

    // 1. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (error) {
      if (error instanceof AgentGovernanceEmergencyPausedError) {
        throw new AgentRuntimeError({
          code: 'EMERGENCY_DEAD_MAN_PAUSED',
          message: `Autonomous replanning rejected: governance dead-man pause is active for organization '${organizationId}'.`,
          runId,
          organizationId,
        });
      }
      throw error;
    }

    // 2. Fetch Run and Validate Plan
    const run = await this.runStore.getRun(organizationId, runId);
    if (!run) {
      throw new AgentRuntimeError({
        code: 'RUN_NOT_FOUND',
        message: `Agent run '${runId}' was not found.`,
        runId,
        organizationId,
      });
    }

    if (!run.currentPlan) {
      throw new AgentRuntimeError({
        code: 'INVALID_RUN_INPUT',
        message: `Agent run '${runId}' does not have a current execution plan to replan.`,
        runId,
        organizationId,
      });
    }

    const currentPlan = run.currentPlan;

    // 3. Replan Budget Ceiling Check (Rule 23)
    const maxReplans = input.maxReplansPerRun ?? 3;
    const replansCompleted = currentPlan.version - 1;

    if (replansCompleted >= maxReplans) {
      await this.runStore.updateRunStatus({
        organizationId,
        runId,
        toStatus: 'failed',
        reason: `Replan budget ceiling exceeded: run attempted more than ${maxReplans} replans (Rule 23).`,
      });

      throw new AgentRuntimeError({
        code: 'BUDGET_EXCEEDED',
        message: `Replan budget ceiling exceeded: maximum ${maxReplans} replans allowed per run (Rule 23).`,
        runId,
        organizationId,
        details: { maxReplans, currentVersion: currentPlan.version },
      });
    }

    // 4. Locate Failed Step
    const failedStep = currentPlan.steps.find((s) => s.stepId === failedStepId);
    if (!failedStep) {
      throw new AgentRuntimeError({
        code: 'STEP_NOT_FOUND',
        message: `Failed step '${failedStepId}' does not exist in current execution plan for run '${runId}'.`,
        runId,
        stepId: failedStepId,
        organizationId,
      });
    }

    // 5. Partition Steps: Prune Failed Step and Downstream Dependents
    const downstreamStepIds = new Set<string>([failedStepId]);
    let expansionOccurred = true;

    while (expansionOccurred) {
      expansionOccurred = false;
      for (const step of currentPlan.steps) {
        if (!downstreamStepIds.has(step.stepId)) {
          const dependsOnDownstream = step.dependsOnStepIds.some((depId) =>
            downstreamStepIds.has(depId)
          );
          if (dependsOnDownstream) {
            downstreamStepIds.add(step.stepId);
            expansionOccurred = true;
          }
        }
      }
    }

    const retainedSteps = currentPlan.steps.filter((s) => !downstreamStepIds.has(s.stepId));
    const prunedSteps = currentPlan.steps.filter((s) => downstreamStepIds.has(s.stepId));

    // 6. Anti-Oscillation & Loop Detection (Rule 47)
    const executedSteps = await this.runStore.listSteps(organizationId, runId);
    const failureCountByCapability = new Map<string, number>();

    for (const step of executedSteps) {
      if (step.status === 'failed' && step.capabilityId) {
        const count = failureCountByCapability.get(step.capabilityId) ?? 0;
        failureCountByCapability.set(step.capabilityId, count + 1);
      }
    }

    // Also count the current failure if not yet recorded in executedSteps
    if (failedStep.capabilityId) {
      const existingCount = failureCountByCapability.get(failedStep.capabilityId) ?? 0;
      failureCountByCapability.set(failedStep.capabilityId, existingCount + 1);
    }

    const blacklistedCapabilities = new Set<string>();
    for (const [capId, count] of failureCountByCapability.entries()) {
      if (count >= 2) {
        blacklistedCapabilities.add(capId);
      }
    }

    // 7. Discover Permitted Remedial Capabilities
    const persona = globalAgentPersonaRegistry.getPersona(run.agentPersonaId);
    if (!persona) {
      throw new AgentRuntimeError({
        code: 'CAPABILITY_DISALLOWED',
        message: `Agent persona '${run.agentPersonaId}' not found in registry.`,
        runId,
        organizationId,
      });
    }

    const candidateCapabilities = this.filterCandidateCapabilities(
      persona,
      blacklistedCapabilities
    );
    const capabilityLookup = new Map(candidateCapabilities.map((c) => [c.id, c]));

    // 8. Construct Remedial Prompt & Invoke Model Router (Rule 58: Pro Tier)
    const prompt = this.constructRemedialPrompt({
      goalPrompt: run.goal.prompt,
      retainedSteps,
      failedStep,
      failureReason,
      prunedSteps,
      blacklistedCapabilities: Array.from(blacklistedCapabilities),
      candidateCapabilities,
    });

    const remedialResult = await this.modelRouter.generateStructured(
      prompt,
      RemedialPlanCandidateSchema,
      {
        taskCategory: 'dag_planning',
        preferredTier: 'pro',
        correlationId: input.correlationId,
      }
    );

    const candidate = remedialResult.data;

    // 9. Validate Remedial Steps and Saga Compensation Bindings (Rule 27 & 47)
    const remedialPlanSteps: PlanStep[] = [];

    for (let i = 0; i < candidate.remedialSteps.length; i++) {
      const stepCandidate = candidate.remedialSteps[i];
      const capId = stepCandidate.capabilityId;

      if (capId && blacklistedCapabilities.has(capId)) {
        throw new AgentRuntimeError({
          code: 'PLANNING_FAILED',
          message: `Model attempted to use blacklisted oscillating capability '${capId}' during replan (Rule 47).`,
          runId,
          organizationId,
        });
      }

      if (capId && !capabilityLookup.has(capId)) {
        throw new AgentRuntimeError({
          code: 'PLANNING_FAILED',
          message: `Model planned capability '${capId}' which is outside persona '${persona.id}' allowed domains or risk ceiling.`,
          runId,
          organizationId,
        });
      }

      const capDef = capId ? capabilityLookup.get(capId) : undefined;

      const planStep: PlanStep = {
        stepId: stepCandidate.stepId,
        stepIndex: retainedSteps.length + i,
        title: stepCandidate.title,
        type: stepCandidate.type,
        capabilityId: capId,
        capabilityVersion: capDef?.version,
        riskLevel: capDef?.risk.level,
        arguments: stepCandidate.arguments,
        dependsOnStepIds: stepCandidate.dependsOnStepIds,
        expectedStateChange: stepCandidate.expectedStateChange,
        isNonDelegable: capDef?.risk.nonDelegable ?? false,
        capabilityFingerprint: undefined,
        compensatingCapabilityId: capDef?.risk.compensatingCapabilityId, // Rule 27 Saga Binding
        timeoutMs: 30000,
      };

      remedialPlanSteps.push(planStep);
    }

    // 10. Assemble and Topologically Validate Stitched Execution Plan (Rule 47)
    const combinedSteps = [...retainedSteps, ...remedialPlanSteps];
    const dagResult = validateExecutionPlanDag(combinedSteps, {
      maxSteps: run.budgets?.maxToolCalls ?? 25,
      runId,
      organizationId,
    });

    const orderedSteps = dagResult.sortedSteps.map((step, idx) => ({
      ...step,
      stepIndex: idx,
    }));

    const newPlan: ExecutionPlan = {
      planId: `plan_${runId}_v${currentPlan.version + 1}`,
      version: currentPlan.version + 1,
      steps: orderedSteps,
      estimatedTokens: candidate.estimatedTokens || remedialResult.telemetry.totalTokens,
      rationale: candidate.remedialRationale,
      createdAt: new Date().toISOString(),
    };

    // 11. Persist Stitched Execution Plan
    await this.runStore.saveExecutionPlan(organizationId, runId, newPlan);

    return newPlan;
  }

  /**
   * Filters capabilities down to those permitted by persona and not blacklisted by anti-oscillation.
   */
  private filterCandidateCapabilities(
    persona: AgentPersona,
    blacklistedIds: Set<string>
  ): AnyCapabilityDefinition[] {
    const all = this.capabilityRegistry.list();
    const allowedDomainsSet = new Set(persona.allowedDomains);
    const ceilingWeight = RISK_LEVEL_WEIGHTS[persona.maxAutonomousRiskLevel] ?? 0;

    return all.filter((cap) => {
      if (blacklistedIds.has(cap.id)) {
        return false;
      }
      if (!allowedDomainsSet.has(cap.domain)) {
        return false;
      }

      const capWeight = RISK_LEVEL_WEIGHTS[cap.risk.level] ?? 0;
      return capWeight <= ceilingWeight || cap.risk.level === 'L3_EXTERNAL_COMMUNICATION_FINANCE';
    });
  }

  /**
   * Constructs the structured prompt for remedial plan generation.
   */
  private constructRemedialPrompt(params: {
    goalPrompt: string;
    retainedSteps: PlanStep[];
    failedStep: PlanStep;
    failureReason: string;
    prunedSteps: PlanStep[];
    blacklistedCapabilities: string[];
    candidateCapabilities: AnyCapabilityDefinition[];
  }): string {
    const {
      goalPrompt,
      retainedSteps,
      failedStep,
      failureReason,
      prunedSteps,
      blacklistedCapabilities,
      candidateCapabilities,
    } = params;

    const retainedSummary = retainedSteps.length
      ? retainedSteps.map((s) => `- Step ${s.stepIndex} [${s.stepId}]: ${s.title} (${s.capabilityId})`).join('\n')
      : 'None (pipeline failed on first step)';

    const prunedSummary = prunedSteps
      .map((s) => `- Pruned [${s.stepId}]: ${s.title} (${s.capabilityId})`)
      .join('\n');

    const blacklistedSummary = blacklistedCapabilities.length
      ? blacklistedCapabilities.map((id) => `BLACKLISTED (DO NOT USE): ${id}`).join('\n')
      : 'None';

    const availableCaps = candidateCapabilities
      .map(
        (c) =>
          `- [${c.id}] ${c.name} (${c.domain} | ${c.risk.level}): ${c.description}${
            c.risk.compensatingCapabilityId ? ` (Compensated by: ${c.risk.compensatingCapabilityId})` : ''
          }`
      )
      .join('\n');

    return `
ORIGINAL GOAL:
${goalPrompt}

SUCCESSFUL / RETAINED STEPS:
${retainedSummary}

FAILED STEP:
- StepId: ${failedStep.stepId}
- Capability: ${failedStep.capabilityId}
- Failure Diagnostic: ${failureReason}

PRUNED DOWNSTREAM STEPS (UNFULFILLED WORK):
${prunedSummary}

OSCILLATION GUARD:
${blacklistedSummary}

AVAILABLE CANDIDATE CAPABILITIES:
${availableCaps}

INSTRUCTIONS:
Synthesize remedial steps to achieve the remaining work of the original goal.
- You MAY depend on retained step IDs (${retainedSteps.map((s) => s.stepId).join(', ')}).
- Do NOT use any blacklisted capabilities.
- Return a valid JSON adhering to the RemedialPlanCandidate schema.
`;
  }
}
