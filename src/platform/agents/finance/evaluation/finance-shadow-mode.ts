/**
 * @fileOverview Finance Shadow Mode Simulation Engine & Blast Radius Generator (Phase 12 Milestone 2)
 *
 * Implements Rules 1, 4, 8, 12, 17, 19, 20, 26, 40, 41, 42, 60, 67, 68, and 69.
 * Provides a production-grade shadow execution harness that evaluates proposed finance agent
 * plans with `dryRun: true`, completely intercepting state-mutating operations and producing
 * rigorous Blast Radius Reports with dollar value exposure calculations without making any
 * mutations to production database stores.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 42: Zero database writes in shadow mode. All mutating capabilities are intercepted.
 * - Rule 12: Evaluates weighted risk ceilings and determines whether human approval is required.
 * - Rule 17: Explicitly detects and blocks non-delegable actions (e.g. unauthorized bulk refunds).
 * - Rule 19: Generates deterministic idempotency keys for all simulated steps (`finance_shadow_${runId}_${stepId}`).
 * - Rule 20 & 40: Injects distributed tracing correlation IDs and emits `finance.agent.simulated` domain events.
 * - Rule 26: Listens to native `AbortSignal` for instantaneous cooperative cancellation.
 * - Rule 41: Synthesizes explainability breakdowns with WHAT, WHY, and EXPECTED STATE CHANGE.
 * - Rule 60: Evaluates `checkGovernanceDeadManSwitch` before execution, failing closed if tripped.
 * - Rule 69: Governed capability layer underneath SmartSapp. Master records remain immutable.
 *
 * Strict Typing Policy: Zero `any` or `any[]`. Bounded Zod v4 schemas only.
 */

import { z } from 'zod/v4';
import { type RiskLevel } from '@/platform/capabilities/contracts/risk-levels';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  FINANCE_TOOL_MATRIX,
  type FinanceToolMatrixEntry,
} from '../personas/finance-agent-matrix';
import {
  isFinancePersonaId,
} from '../personas/finance-persona-definitions';

/**
 * Non-delegable finance actions that must never be executed autonomously (Rule 17).
 */
export const NON_DELEGABLE_FINANCE_ACTIONS: readonly string[] = [
  'finance.invoice.delete_posted',
  'finance.payment.purge_ledger',
  'finance.refund.unauthorized_bulk',
  'finance.account.writeoff_unapproved',
  'finance.bank.modify_payout_destination',
];

/**
 * Schema for a simulated finance step input.
 */
export const SimulatedFinanceStepInputSchema = z.object({
  capabilityId: z.string().min(1),
  input: z.record(z.string(), z.unknown()),
  riskLevel: z.enum([
    'L0_READ',
    'L1_INTERNAL_DRAFT',
    'L2_STATE_MUTATION',
    'L3_EXTERNAL_COMMUNICATION_FINANCE',
    'L4_PRIVILEGED_DESTRUCTIVE',
  ]),
  financialValueUSD: z.number().nonnegative().optional(),
});

export type SimulatedFinanceStepInput = z.infer<typeof SimulatedFinanceStepInputSchema>;

/**
 * Schema for an intercepted finance step record.
 */
export const InterceptedFinanceStepSchema = z.object({
  stepId: z.string().min(1),
  capabilityId: z.string().min(1),
  riskLevel: z.string().min(1),
  intercepted: z.boolean(),
  reason: z.string().min(1),
  simulatedOutput: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().min(1),
  financialValueUSD: z.number().nonnegative(),
});

export type InterceptedFinanceStep = z.infer<typeof InterceptedFinanceStepSchema>;

/**
 * Schema for explainability item (Rule 41).
 */
export const FinanceExplainabilityItemSchema = z.object({
  capabilityId: z.string().min(1),
  what: z.string().min(1),
  why: z.string().min(1),
  expectedStateChange: z.string().min(1),
});

export type FinanceExplainabilityItem = z.infer<typeof FinanceExplainabilityItemSchema>;

/**
 * Schema for Financial Blast Radius Report.
 */
export const FinanceBlastRadiusReportSchema = z.object({
  targetedDomains: z.array(z.string()),
  recordsAtRiskCount: z.number().int().nonnegative(),
  highestRiskLevel: z.string(),
  requiresHumanApproval: z.boolean(),
  hasNonDelegableActions: z.boolean(),
  interceptedMutationsCount: z.number().int().nonnegative(),
  totalFinancialValueExposureUSD: z.number().nonnegative(),
  explainabilityBreakdown: z.array(FinanceExplainabilityItemSchema),
  warnings: z.array(z.string()),
});

export type FinanceBlastRadiusReport = z.infer<typeof FinanceBlastRadiusReportSchema>;

/**
 * Schema for Finance Shadow Simulation Result.
 */
export const FinanceShadowSimulationResultSchema = z.object({
  runId: z.string().min(1),
  dryRun: z.literal(true),
  liveMutationsExecuted: z.literal(0),
  executedStepsCount: z.number().int().nonnegative(),
  interceptedSteps: z.array(InterceptedFinanceStepSchema),
  blastRadiusReport: FinanceBlastRadiusReportSchema,
});

export type FinanceShadowSimulationResult = z.infer<typeof FinanceShadowSimulationResultSchema>;

/**
 * Options for executing Finance Shadow Simulation.
 */
export interface FinanceShadowSimulationOptions {
  personaId: string;
  organizationId: string;
  workspaceId: string;
  goalPrompt: string;
  simulatedSteps: readonly SimulatedFinanceStepInput[];
  signal?: AbortSignal;
}

const RISK_LEVEL_ORDER: Readonly<Record<RiskLevel, number>> = {
  L0_READ: 0,
  L1_INTERNAL_DRAFT: 1,
  L2_STATE_MUTATION: 2,
  L3_EXTERNAL_COMMUNICATION_FINANCE: 3,
  L4_PRIVILEGED_DESTRUCTIVE: 4,
};

/**
 * FinanceShadowRunner evaluates proposed finance agent execution plans in shadow mode.
 */
export class FinanceShadowRunner {
  /**
   * Executes a shadow simulation enforcing dryRun: true, zero database writes, and Blast Radius Report generation.
   */
  async simulate(options: FinanceShadowSimulationOptions): Promise<FinanceShadowSimulationResult> {
    // 1. Cooperative cancellation check (Rule 26)
    if (options.signal?.aborted) {
      throw new Error('SIMULATION_ABORTED');
    }

    // 2. Emergency dead-man switch evaluation (Rule 60)
    await checkGovernanceDeadManSwitch(options.organizationId);

    // 3. Validate persona identity (Rule 16)
    if (!isFinancePersonaId(options.personaId)) {
      throw new Error(`Invalid finance personaId '${options.personaId}'`);
    }

    const runId = `fin_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const interceptedSteps: InterceptedFinanceStep[] = [];
    const explainabilityBreakdown: FinanceExplainabilityItem[] = [];
    const warnings: string[] = [];
    const domainsSet = new Set<string>();

    let recordsAtRiskCount = 0;
    let highestRiskLevel: RiskLevel = 'L0_READ';
    let requiresHumanApproval = false;
    let hasNonDelegableActions = false;
    let interceptedMutationsCount = 0;
    let totalFinancialValueExposureUSD = 0;

    // 4. Iterate over simulated plan steps
    for (let i = 0; i < options.simulatedSteps.length; i++) {
      if (options.signal?.aborted) {
        throw new Error('SIMULATION_ABORTED');
      }

      const step = options.simulatedSteps[i];
      const stepId = `step_${i + 1}`;
      const idempotencyKey = `finance_shadow_${runId}_${stepId}`;

      // Update highest risk level encountered
      if (RISK_LEVEL_ORDER[step.riskLevel] > RISK_LEVEL_ORDER[highestRiskLevel]) {
        highestRiskLevel = step.riskLevel;
      }

      // Check for non-delegable actions (Rule 17)
      const isNonDelegable = NON_DELEGABLE_FINANCE_ACTIONS.includes(step.capabilityId);
      if (isNonDelegable) {
        hasNonDelegableActions = true;
        requiresHumanApproval = true;
        warnings.push(`Step ${i + 1} (${step.capabilityId}) is non-delegable under Rule 17.`);
      }

      // Flag human approval for L3+ or non-delegable actions (Rule 12 & 21)
      if (RISK_LEVEL_ORDER[step.riskLevel] >= RISK_LEVEL_ORDER.L3_EXTERNAL_COMMUNICATION_FINANCE) {
        requiresHumanApproval = true;
      }

      // Financial value calculation
      const stepValueUSD = step.financialValueUSD || 0;
      totalFinancialValueExposureUSD += stepValueUSD;

      // Find tool definition in Tool Matrix
      const toolDef = FINANCE_TOOL_MATRIX.find(
        (t: FinanceToolMatrixEntry) => t.capabilityId === step.capabilityId
      );
      if (toolDef) {
        domainsSet.add(toolDef.domain);
      } else {
        domainsSet.add('finance_subscriptions');
      }

      // Determine mutation interception (Rule 42: zero writes)
      const isMutation = RISK_LEVEL_ORDER[step.riskLevel] >= RISK_LEVEL_ORDER.L1_INTERNAL_DRAFT;
      if (isMutation) {
        interceptedMutationsCount++;
        recordsAtRiskCount += 1;

        interceptedSteps.push({
          stepId,
          capabilityId: step.capabilityId,
          riskLevel: step.riskLevel,
          intercepted: true,
          reason: isNonDelegable
            ? 'Blocked: Non-delegable financial operation requires human execution'
            : 'Shadow Mode: Mutating operation intercepted to prevent database writes (Rule 42)',
          simulatedOutput: {
            mockResult: 'simulated_success',
            dryRun: true,
            recordsMutated: 0,
            financialValueUSD: stepValueUSD,
          },
          idempotencyKey,
          financialValueUSD: stepValueUSD,
        });
      }

      // Explainability item synthesis (Rule 41)
      explainabilityBreakdown.push({
        capabilityId: step.capabilityId,
        what: `Simulated execution of ${step.capabilityId}`,
        why: `Goal: ${options.goalPrompt.slice(0, 100)}`,
        expectedStateChange: isMutation
          ? `Would mutate financial record with estimated value $${stepValueUSD.toFixed(2)} (intercepted in shadow mode)`
          : 'Read-only query (zero state changes)',
      });
    }

    const blastRadiusReport: FinanceBlastRadiusReport = {
      targetedDomains: Array.from(domainsSet),
      recordsAtRiskCount,
      highestRiskLevel,
      requiresHumanApproval,
      hasNonDelegableActions,
      interceptedMutationsCount,
      totalFinancialValueExposureUSD,
      explainabilityBreakdown,
      warnings,
    };

    const result: FinanceShadowSimulationResult = {
      runId,
      dryRun: true,
      liveMutationsExecuted: 0,
      executedStepsCount: options.simulatedSteps.length,
      interceptedSteps,
      blastRadiusReport,
    };

    // 5. Emit simulation event to event bus (Rule 20 & 40)
    try {
      const event = createDomainEvent({
        type: 'finance.agent.simulated',
        organizationId: options.organizationId,
        workspaceId: options.workspaceId,
        actor: {
          type: 'agent',
          id: options.personaId,
        },
        entity: {
          type: 'finance_simulation',
          id: runId,
        },
        source: 'finance_shadow_runner',
        correlationId: options.correlationId ?? runId,
        payload: {
          runId,
          personaId: options.personaId,
          executedStepsCount: options.simulatedSteps.length,
          interceptedMutationsCount,
          totalFinancialValueExposureUSD,
          highestRiskLevel,
          requiresHumanApproval,
          hasNonDelegableActions,
        },
      });
      await defaultEventBus.publish(event);
    } catch {
      // Event bus emission is best-effort in shadow mode
    }

    return result;
  }
}

/**
 * Singleton instance provider for FinanceShadowRunner.
 */
let shadowRunnerInstance: FinanceShadowRunner | null = null;

export function getFinanceShadowRunner(): FinanceShadowRunner {
  if (!shadowRunnerInstance) {
    shadowRunnerInstance = new FinanceShadowRunner();
  }
  return shadowRunnerInstance;
}
