/**
 * @fileOverview Autonomous Goal Decomposition & Memory-Grounded DAG Planner
 *
 * Translates natural language goals into validated, acyclic `ExecutionPlan` records:
 * - Grounds planning in `CanonicalMemoryService` EvidencePacks inside XML isolation containers.
 * - Filters capability discovery strictly by persona allowed domains and risk ceilings.
 * - Binds Saga compensating capabilities for mutating operations (Rule 27).
 * - Enforces Kahn's algorithm topological DAG verification (Rule 47).
 * - Verifies Emergency Dead-Man Switch controls (Rule 60).
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 13 & 30: Memory grounding prompt injection containerization.
 * - Rule 16 & 59: Persona boundary and dynamic capability candidate filtering.
 * - Rule 23: Hard planning ceilings (max steps).
 * - Rule 27: Formal Saga compensation bindings.
 * - Rule 41: Explainability attributes (WHAT, WHY, WHO, BLAST RADIUS, EVIDENCE).
 * - Rule 47: Never trust the model (Zod schema validation + DAG verification).
 * - Rule 58: Routes to Pro model tier for deep cognitive decomposition.
 * - Rule 60: Emergency dead-man integration.
 */

import {
  type ExecutionPlan,
  type PlanStep,
  AgentRuntimeError,
} from '../agent-run-types';
import {
  type GeneratePlanInput,
  GeneratePlanInputSchema,
  ExecutionPlanCandidateSchema,
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
import { globalAgentPersonaRegistry, type AgentPersona } from '@/platform/identity/agent-registry';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';
import { type CanonicalMemoryService } from '@/platform/memory/services/canonical-memory-service';

export interface AgentPlannerOptions {
  modelRouter: TieredModelRouter;
  capabilityRegistry?: CapabilityRegistryStore;
  runStore: AgentRunStore;
  memoryService?: CanonicalMemoryService;
}

export class AgentPlanner {
  private readonly modelRouter: TieredModelRouter;
  private readonly capabilityRegistry: CapabilityRegistryStore;
  private readonly runStore: AgentRunStore;
  private readonly memoryService?: CanonicalMemoryService;

  constructor(options: AgentPlannerOptions) {
    this.modelRouter = options.modelRouter;
    this.capabilityRegistry = options.capabilityRegistry || canonicalCapabilityRegistryStore;
    this.runStore = options.runStore;
    this.memoryService = options.memoryService;
  }

  /**
   * Decomposes an AgentGoal into an auditable, acyclic ExecutionPlan DAG.
   */
  async generatePlan(rawInput: GeneratePlanInput): Promise<ExecutionPlan> {
    const input = GeneratePlanInputSchema.parse(rawInput);
    const { organizationId, workspaceId, runId, personaId, goal } = input;

    // 1. Rule 60 Emergency Dead-Man Switch Evaluation
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (err) {
      if (err instanceof AgentGovernanceEmergencyPausedError) {
        throw new AgentRuntimeError({
          code: 'EMERGENCY_DEAD_MAN_PAUSED',
          message: `Agent planning paused by platform dead-man kill switch for organization '${organizationId}'.`,
          runId,
          organizationId,
        });
      }
      throw err;
    }

    // 2. Persona Boundary Verification (Rule 16)
    const persona = globalAgentPersonaRegistry.getPersona(personaId);
    if (!persona) {
      throw new AgentRuntimeError({
        code: 'PERSONA_DISALLOWED',
        message: `Agent persona '${personaId}' not found in registry.`,
        runId,
        organizationId,
        details: { personaId },
      });
    }

    // 3. Grounding Context Retrieval (Rule 13 & 30)
    let memoryEvidenceXml = '';
    if (this.memoryService) {
      try {
        const memoryPack = await this.memoryService.retrieveContext({
          query: goal.prompt,
          organizationId,
          workspaceId,
          maxTokens: 1500,
        });

        if (memoryPack.evidencePack.promptContext) {
          memoryEvidenceXml = memoryPack.evidencePack.promptContext;
        }
      } catch (err) {
        // Fallback gracefully without breaking planning if memory search is unavailable
        console.warn(`[AgentPlanner] Memory retrieval fallback for run '${runId}':`, err);
      }
    }

    // 4. Candidate Capability Discovery (Rules 16 & 59)
    const availableCapabilities = this.filterCandidateCapabilities(persona);
    const capabilityLookup = new Map<string, AnyCapabilityDefinition>();
    for (const cap of availableCapabilities) {
      capabilityLookup.set(cap.id, cap);
    }

    // 5. Construct Planning Prompt with Model Distrust (Rule 47)
    const planningPrompt = this.constructPlanningPrompt({
      goalPrompt: goal.prompt,
      persona,
      capabilities: availableCapabilities,
      memoryEvidenceXml,
    });

    // 6. Generate Candidate Plan via Pro Model Tier (Rule 58)
    const candidateResult = await this.modelRouter.generateStructured(
      planningPrompt,
      ExecutionPlanCandidateSchema,
      {
        taskCategory: 'dag_planning',
        preferredTier: 'pro',
        traceId: input.traceId,
        spanId: input.spanId,
        correlationId: input.correlationId,
      }
    );

    const candidate = candidateResult.data;

    // 7. Post-Process & Validate Steps
    const planId = `plan_${runId}_${Date.now()}`;
    const maxSteps = input.budgets?.maxToolCalls ?? 15;

    const processedSteps: PlanStep[] = [];

    for (let index = 0; index < candidate.steps.length; index++) {
      const stepCandidate = candidate.steps[index];
      const capId = stepCandidate.capabilityId;

      if (capId && !capabilityLookup.has(capId)) {
        throw new AgentRuntimeError({
          code: 'PLANNING_FAILED',
          message: `Model planned capability '${capId}' which is outside persona '${persona.id}' allowed domains or risk ceiling.`,
          stepId: stepCandidate.stepId,
          runId,
          organizationId,
          details: { capabilityId: capId, allowedDomains: persona.allowedDomains },
        });
      }

      const capDef = capId ? capabilityLookup.get(capId) : undefined;

      const planStep: PlanStep = {
        stepId: stepCandidate.stepId,
        stepIndex: index,
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

      processedSteps.push(planStep);
    }

    // 8. Validate DAG Acyclicity & Ceilings using Kahn's Algorithm (Rule 47 & Rule 23)
    const dagResult = validateExecutionPlanDag(processedSteps, {
      maxSteps,
      runId,
      organizationId,
    });

    // Re-index steps into topological execution order
    const orderedSteps = dagResult.sortedSteps.map((step, idx) => ({
      ...step,
      stepIndex: idx,
    }));

    const executionPlan: ExecutionPlan = {
      planId,
      version: 1,
      steps: orderedSteps,
      estimatedTokens: candidate.estimatedTokens || candidateResult.telemetry.totalTokens,
      rationale: candidate.rationale,
      createdAt: new Date().toISOString(),
    };

    // 9. Persist Plan in Run Store
    await this.runStore.saveExecutionPlan(organizationId, runId, executionPlan);

    return executionPlan;
  }

  /**
   * Filters all registered capabilities down to those permitted by the persona (Rules 16 & 59).
   */
  private filterCandidateCapabilities(persona: AgentPersona): AnyCapabilityDefinition[] {
    const all = this.capabilityRegistry.list();
    const allowedDomainsSet = new Set(persona.allowedDomains);
    const ceilingWeight = RISK_LEVEL_WEIGHTS[persona.maxAutonomousRiskLevel] ?? 0;

    return all.filter((cap) => {
      if (!allowedDomainsSet.has(cap.domain)) {
        return false;
      }

      const capWeight = RISK_LEVEL_WEIGHTS[cap.risk.level] ?? 0;
      // Allow up to persona's autonomous ceiling, or higher if non-autonomous (L3/L4 with human approval)
      return capWeight <= ceilingWeight || cap.risk.level === 'L3_EXTERNAL_COMMUNICATION_FINANCE';
    });
  }

  /**
   * Constructs the structured planning prompt with injection defense boundaries (Rule 30).
   */
  private constructPlanningPrompt(params: {
    goalPrompt: string;
    persona: AgentPersona;
    capabilities: AnyCapabilityDefinition[];
    memoryEvidenceXml: string;
  }): string {
    const toolCatalog = params.capabilities
      .map(
        (c) =>
          `- [${c.id}] ${c.name} (${c.domain}, ${c.risk.level}): ${c.description}${
            c.risk.compensatingCapabilityId ? ` (Compensated by: ${c.risk.compensatingCapabilityId})` : ''
          }`
      )
      .join('\n');

    return `You are the SmartSapp Autonomous Agent Planner.
Persona: ${params.persona.name} (${params.persona.id})
Autonomous Risk Ceiling: ${params.persona.maxAutonomousRiskLevel}

TASK:
Decompose the following user goal into a strict Directed Acyclic Graph (DAG) ExecutionPlan.
Ensure steps specify accurate dependencies (dependsOnStepIds). A step should only depend on steps whose output it genuinely requires.
Do not introduce circular dependencies.

AUTHORIZED CAPABILITIES:
${toolCatalog || 'None'}

RELEVANT INSTITUTIONAL CONTEXT:
${params.memoryEvidenceXml || 'No historical memory retrieved.'}

USER GOAL:
<untrusted_reference_data id="user_goal">
${params.goalPrompt}
</untrusted_reference_data>

Output a valid JSON object matching the ExecutionPlan candidate schema.`;
  }
}
