/**
 * @fileOverview Shadow Simulation Engine (Rule 42)
 *
 * Implements shadow mode dry-run execution for Agentic ExecutionPlans:
 * - Plans, retrieves, and simulates workflows without executing mutations on production data.
 * - Intercepts mutating capabilities (L1, L2, L3, L4) and computes mock state changes.
 * - Computes complete Blast Radius Reports (mutations intercepted, high-risk flags, non-delegable operations).
 * - Enforces topological DAG acyclicity verification (Rule 47) before simulation.
 * - Evaluates Emergency Dead-Man Switch controls (Rule 60).
 *
 * Governing Rules:
 * - Rule 4: Zero `any` / Zero `any[]` typing policy.
 * - Rule 8 & 47: Anti-IDOR tenant validation and input schema constraints.
 * - Rule 12 & 21: Autonomous risk level taxonomy and human approval requirement evaluation.
 * - Rule 17: Non-delegable action detection.
 * - Rule 42: Mandatory Shadow Mode prior to live execution of mutating plans.
 * - Rule 60: Emergency dead-man switch fail-closed enforcement.
 */

import { randomUUID } from 'node:crypto';
import { z } from 'zod/v4';
import {
  ExecutionPlanSchema,
  AGENT_STEP_TYPES,
  AgentRuntimeError,
} from '../agent-run-types';
import { validateExecutionPlanDag } from './dag-validator';
import {
  type CapabilityRegistryStore,
  canonicalCapabilityRegistryStore,
} from '@/platform/capabilities/registry/capability-registry';
import {
  RISK_LEVELS,
  isHighRiskLevel,
  requiresAgentApproval,
} from '@/platform/capabilities/contracts/risk-levels';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '@/platform/policy/governance-dead-man';

// ============================================================================
// 1. SHADOW SIMULATION CONTRACTS & SCHEMAS (Rule 42 & 47)
// ============================================================================

export const ShadowSimulationInputSchema = z.object({
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  plan: ExecutionPlanSchema,
  personaId: z.string().min(1),
  dryRun: z.boolean().default(true),
  authorizingUserId: z.string().optional(),
  correlationId: z.string().optional(),
});

export type ShadowSimulationInput = z.input<typeof ShadowSimulationInputSchema>;

export const ShadowSimulatedActionSchema = z.enum([
  'executed_read',
  'intercepted_mutation',
  'skipped',
]);

export type ShadowSimulatedAction = z.infer<typeof ShadowSimulatedActionSchema>;

export const ShadowSimulationStepResultSchema = z.object({
  stepId: z.string().min(1),
  stepIndex: z.number().int().min(0),
  title: z.string().min(1),
  type: z.enum(AGENT_STEP_TYPES),
  capabilityId: z.string().optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
  simulated: z.boolean(),
  simulatedAction: ShadowSimulatedActionSchema,
  expectedStateChange: z.string().optional(),
  simulatedOutput: z.record(z.string(), z.unknown()).default({}),
  simulatedTokens: z.number().int().min(0).default(0),
  simulatedDurationMs: z.number().int().min(0).default(0),
  requiresHumanApproval: z.boolean().default(false),
  isNonDelegable: z.boolean().default(false),
});

export type ShadowSimulationStepResult = z.infer<typeof ShadowSimulationStepResultSchema>;

export const BlastRadiusRiskCategorySchema = z.enum(['low', 'medium', 'high', 'critical']);
export type BlastRadiusRiskCategory = z.infer<typeof BlastRadiusRiskCategorySchema>;

export const ShadowBlastRadiusSchema = z.object({
  totalMutationsIntercepted: z.number().int().min(0),
  highRiskOperationsCount: z.number().int().min(0),
  nonDelegableOperationsCount: z.number().int().min(0),
  estimatedRecordsMutated: z.number().int().min(0),
  targetedDomains: z.array(z.string()),
  riskLevelsEncountered: z.array(z.enum(RISK_LEVELS)),
  overallRiskCategory: BlastRadiusRiskCategorySchema,
});

export type ShadowBlastRadius = z.infer<typeof ShadowBlastRadiusSchema>;

export const ShadowSimulationReportSchema = z.object({
  simulationId: z.string().min(1),
  planId: z.string().min(1),
  version: z.number().int().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  personaId: z.string().min(1),
  totalSteps: z.number().int().min(0),
  stepResults: z.array(ShadowSimulationStepResultSchema),
  blastRadius: ShadowBlastRadiusSchema,
  totalSimulatedTokens: z.number().int().min(0),
  totalSimulatedDurationMs: z.number().int().min(0),
  simulatedAt: z.string().datetime(),
  isSafeForExecution: z.boolean(),
});

export type ShadowSimulationReport = z.infer<typeof ShadowSimulationReportSchema>;

// ============================================================================
// 2. SHADOW SIMULATION ENGINE IMPLEMENTATION (Rule 42)
// ============================================================================

export interface ShadowSimulationEngineOptions {
  capabilityRegistry?: CapabilityRegistryStore;
}

export class ShadowSimulationEngine {
  private readonly capabilityRegistry: CapabilityRegistryStore;

  constructor(options?: ShadowSimulationEngineOptions) {
    this.capabilityRegistry = options?.capabilityRegistry ?? canonicalCapabilityRegistryStore;
  }

  /**
   * Simulates an ExecutionPlan DAG in shadow mode without mutating production data.
   */
  async simulate(rawInput: ShadowSimulationInput): Promise<ShadowSimulationReport> {
    const input = ShadowSimulationInputSchema.parse(rawInput);
    const { organizationId, workspaceId, plan, personaId } = input;

    // 1. Emergency Dead-Man Switch Evaluation (Rule 60)
    try {
      await checkGovernanceDeadManSwitch(organizationId);
    } catch (error) {
      if (error instanceof AgentGovernanceEmergencyPausedError) {
        throw new AgentRuntimeError({
          code: 'EMERGENCY_DEAD_MAN_PAUSED',
          message: `Shadow simulation rejected: governance dead-man pause is active for organization '${organizationId}'.`,
          organizationId,
        });
      }
      throw error;
    }

    // 2. Validate DAG Acyclicity and Ordering using Kahn's Algorithm (Rule 47)
    const dagResult = validateExecutionPlanDag(plan.steps, {
      maxSteps: 50,
      organizationId,
    });

    // 3. Resolve Persona Constraints
    const persona = globalAgentPersonaRegistry.getPersona(personaId);
    if (!persona) {
      throw new AgentRuntimeError({
        code: 'CAPABILITY_DISALLOWED',
        message: `Agent persona '${personaId}' not found in registry.`,
        organizationId,
      });
    }

    // 4. Simulate Steps in Topological Order
    const stepResults: ShadowSimulationStepResult[] = [];
    let totalMutationsIntercepted = 0;
    let highRiskOperationsCount = 0;
    let nonDelegableOperationsCount = 0;
    let estimatedRecordsMutated = 0;
    const targetedDomains = new Set<string>();
    const riskLevelsEncountered = new Set<(typeof RISK_LEVELS)[number]>();
    let totalSimulatedTokens = 0;
    let totalSimulatedDurationMs = 0;

    for (const step of dagResult.sortedSteps) {
      const capDef = step.capabilityId ? this.capabilityRegistry.get(step.capabilityId) : undefined;
      const riskLevel = capDef?.risk.level ?? step.riskLevel ?? 'L0_READ';
      riskLevelsEncountered.add(riskLevel);

      if (capDef?.domain) {
        targetedDomains.add(capDef.domain);
      }

      const isHighRisk = isHighRiskLevel(riskLevel);
      const requiresApproval = capDef?.risk ? requiresAgentApproval(capDef.risk) : isHighRisk;
      const isNonDelegable = capDef?.risk.nonDelegable ?? step.isNonDelegable ?? false;

      if (isHighRisk) {
        highRiskOperationsCount += 1;
      }
      if (isNonDelegable) {
        nonDelegableOperationsCount += 1;
      }

      // Partition: Read-only vs Mutating
      let simulatedAction: ShadowSimulatedAction;
      let simulatedOutput: Record<string, unknown>;
      const stepTokens = 50; // nominal simulated tokens per step
      const stepDurationMs = 15; // nominal simulated duration ms

      if (riskLevel === 'L0_READ') {
        simulatedAction = 'executed_read';
        simulatedOutput = {
          simulated: true,
          status: 'simulated_read_success',
          entityMatchCount: 1,
        };
      } else {
        // Intercept all mutating operations (L1, L2, L3, L4) - ZERO live mutations (Rule 42)
        simulatedAction = 'intercepted_mutation';
        totalMutationsIntercepted += 1;
        estimatedRecordsMutated += 1;

        simulatedOutput = {
          simulated: true,
          intercepted: true,
          expectedStateChange:
            step.expectedStateChange ?? `Simulated mutation for capability '${step.capabilityId}'`,
          mockEntityId: `mock_${step.stepId}_${Date.now()}`,
          recordsAffected: 1,
        };
      }

      totalSimulatedTokens += stepTokens;
      totalSimulatedDurationMs += stepDurationMs;

      stepResults.push({
        stepId: step.stepId,
        stepIndex: step.stepIndex,
        title: step.title,
        type: step.type,
        capabilityId: step.capabilityId,
        riskLevel,
        simulated: true,
        simulatedAction,
        expectedStateChange: step.expectedStateChange,
        simulatedOutput,
        simulatedTokens: stepTokens,
        simulatedDurationMs: stepDurationMs,
        requiresHumanApproval: requiresApproval,
        isNonDelegable,
      });
    }

    // 5. Compute Overall Blast Radius Category
    let overallRiskCategory: BlastRadiusRiskCategory = 'low';
    if (nonDelegableOperationsCount > 0 || riskLevelsEncountered.has('L4_PRIVILEGED_DESTRUCTIVE')) {
      overallRiskCategory = 'critical';
    } else if (highRiskOperationsCount > 0 || riskLevelsEncountered.has('L3_EXTERNAL_COMMUNICATION_FINANCE')) {
      overallRiskCategory = 'high';
    } else if (totalMutationsIntercepted > 0 || riskLevelsEncountered.has('L2_STATE_MUTATION')) {
      overallRiskCategory = 'medium';
    }

    const isSafeForExecution = overallRiskCategory !== 'critical';

    const blastRadius: ShadowBlastRadius = {
      totalMutationsIntercepted,
      highRiskOperationsCount,
      nonDelegableOperationsCount,
      estimatedRecordsMutated,
      targetedDomains: Array.from(targetedDomains),
      riskLevelsEncountered: Array.from(riskLevelsEncountered),
      overallRiskCategory,
    };

    return {
      simulationId: `sim_${randomUUID()}`,
      planId: plan.planId,
      version: plan.version,
      organizationId,
      workspaceId,
      personaId,
      totalSteps: stepResults.length,
      stepResults,
      blastRadius,
      totalSimulatedTokens,
      totalSimulatedDurationMs,
      simulatedAt: new Date().toISOString(),
      isSafeForExecution,
    };
  }
}
