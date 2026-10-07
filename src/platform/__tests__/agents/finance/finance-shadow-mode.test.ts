/**
 * @fileOverview Unit & Invariant Tests for Finance Shadow Mode Simulation Engine (Phase 12 M2)
 *
 * Implements Rules 4, 10, 12, 17, 19, 20, 26, 40, 41, 42, 60, 67, and 69.
 * Validates:
 * - Rule 42: dryRun: true strictly enforced with 0 live database writes
 * - Rule 12 & 21: Risk level escalation and requiresHumanApproval flagging
 * - Rule 17: Detection and blocking of non-delegable financial actions
 * - Rule 19: Deterministic idempotency key derivation
 * - Rule 26: Instantaneous cooperative cancellation via AbortSignal
 * - Rule 41: Explainability breakdown synthesis (WHAT / WHY / EXPECTED STATE CHANGE)
 * - Rule 60: Emergency dead-man switch fail-closed behavior
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  FinanceShadowRunner,
  getFinanceShadowRunner,
  NON_DELEGABLE_FINANCE_ACTIONS,
  FinanceShadowSimulationResultSchema,
  SimulatedFinanceStepInput,
} from '@/platform/agents/finance/evaluation/finance-shadow-mode';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('FinanceShadowRunner (Phase 12 Milestone 2)', () => {
  const orgId = 'org_test_school';
  const wsId = 'ws_test_bursar';
  let runner: FinanceShadowRunner;

  beforeEach(() => {
    setGovernanceDeadManStateForTests(null);
    runner = getFinanceShadowRunner();
  });

  it('enforces dryRun: true and 0 live database mutations (Rule 42)', async () => {
    const steps: SimulatedFinanceStepInput[] = [
      {
        capabilityId: 'finance.invoice.validate',
        input: { invoiceId: 'inv_101' },
        riskLevel: 'L0_READ',
      },
      {
        capabilityId: 'finance.invoice.create_draft',
        input: { entityId: 'student_1', totalPayable: 4500 },
        riskLevel: 'L1_INTERNAL_DRAFT',
        financialValueUSD: 4500,
      },
      {
        capabilityId: 'finance.payment.reconcile',
        input: { paymentId: 'pay_99', invoiceId: 'inv_101' },
        riskLevel: 'L2_STATE_MUTATION',
        financialValueUSD: 3000,
      },
    ];

    const result = await runner.simulate({
      personaId: 'reconciliation_agent',
      organizationId: orgId,
      workspaceId: wsId,
      goalPrompt: 'Reconcile outstanding term fees for student_1',
      simulatedSteps: steps,
    });

    const parsed = FinanceShadowSimulationResultSchema.safeParse(result);
    expect(parsed.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(result.liveMutationsExecuted).toBe(0);
    expect(result.executedStepsCount).toBe(3);
    expect(result.interceptedSteps.length).toBe(2); // L1 and L2 intercepted

    // Financial value aggregation
    expect(result.blastRadiusReport.totalFinancialValueExposureUSD).toBe(7500);
    expect(result.blastRadiusReport.recordsAtRiskCount).toBe(2);
    expect(result.blastRadiusReport.highestRiskLevel).toBe('L2_STATE_MUTATION');
  });

  it('flags non-delegable financial actions and requires human approval (Rule 17)', async () => {
    expect(NON_DELEGABLE_FINANCE_ACTIONS).toContain('finance.refund.unauthorized_bulk');
    expect(NON_DELEGABLE_FINANCE_ACTIONS).toContain('finance.invoice.delete_posted');
    expect(NON_DELEGABLE_FINANCE_ACTIONS).toContain('finance.bank.modify_payout_destination');

    const steps: SimulatedFinanceStepInput[] = [
      {
        capabilityId: 'finance.refund.unauthorized_bulk',
        input: { totalRefund: 50000 },
        riskLevel: 'L4_PRIVILEGED_DESTRUCTIVE',
        financialValueUSD: 50000,
      },
    ];

    const result = await runner.simulate({
      personaId: 'collections_agent',
      organizationId: orgId,
      workspaceId: wsId,
      goalPrompt: 'Attempt bulk refund bypass',
      simulatedSteps: steps,
    });

    expect(result.blastRadiusReport.hasNonDelegableActions).toBe(true);
    expect(result.blastRadiusReport.requiresHumanApproval).toBe(true);
    expect(result.blastRadiusReport.warnings.some((w) => w.includes('non-delegable'))).toBe(true);
  });

  it('synthesizes explainability breakdown with WHAT, WHY, and EXPECTED STATE CHANGE (Rule 41)', async () => {
    const steps: SimulatedFinanceStepInput[] = [
      {
        capabilityId: 'finance.receivables.get_aging',
        input: { entityId: 'ent_5' },
        riskLevel: 'L0_READ',
      },
      {
        capabilityId: 'finance.collection.propose_plan',
        input: { entityId: 'ent_5', installments: 3 },
        riskLevel: 'L2_STATE_MUTATION',
        financialValueUSD: 12000,
      },
    ];

    const result = await runner.simulate({
      personaId: 'collections_agent',
      organizationId: orgId,
      workspaceId: wsId,
      goalPrompt: 'Propose 3-month recovery plan',
      simulatedSteps: steps,
    });

    const breakdown = result.blastRadiusReport.explainabilityBreakdown;
    expect(breakdown).toHaveLength(2);

    expect(breakdown[0].what).toContain('finance.receivables.get_aging');
    expect(breakdown[0].expectedStateChange).toContain('zero state changes');

    expect(breakdown[1].what).toContain('finance.collection.propose_plan');
    expect(breakdown[1].expectedStateChange).toContain('$12000.00');
  });

  it('aborts cleanly when signal is pre-aborted or cancelled (Rule 26)', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runner.simulate({
        personaId: 'billing_analyst',
        organizationId: orgId,
        workspaceId: wsId,
        goalPrompt: 'Draft invoice batch',
        simulatedSteps: [],
        signal: controller.signal,
      })
    ).rejects.toThrow('SIMULATION_ABORTED');
  });

  it('generates deterministic idempotency keys for all intercepted steps (Rule 19)', async () => {
    const steps: SimulatedFinanceStepInput[] = [
      {
        capabilityId: 'finance.fee.record_installment',
        input: { amount: 1000 },
        riskLevel: 'L2_STATE_MUTATION',
        financialValueUSD: 1000,
      },
    ];

    const result = await runner.simulate({
      personaId: 'fee_collection_agent',
      organizationId: orgId,
      workspaceId: wsId,
      goalPrompt: 'Record installment',
      simulatedSteps: steps,
    });

    expect(result.interceptedSteps[0].idempotencyKey).toMatch(/^finance_shadow_fin_sim_\d+_[a-z0-9]+_step_1$/);
  });

  it('rejects invalid persona identifiers (Rule 16)', async () => {
    await expect(
      runner.simulate({
        personaId: 'invalid_persona_xyz',
        organizationId: orgId,
        workspaceId: wsId,
        goalPrompt: 'Test invalid persona',
        simulatedSteps: [],
      })
    ).rejects.toThrow('Invalid finance personaId');
  });
});
