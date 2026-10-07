/**
 * @fileOverview Unit & Contract Tests for 24 Enterprise Finance Evaluation Scenarios (Phase 12 M2)
 *
 * Implements Rules 4, 10, 12, 16, 21, 30, 44, 46, and 67.
 * Validates:
 * - 24 enterprise gold-standard scenarios conforming strictly to FinanceEvalScenarioSchema
 * - Exactly 4 scenarios across all 6 canonical categories
 * - 4 dedicated red-team adversarial attack scenarios (prompt injection, IDOR, refund bypass, replay)
 * - Helper utilities (retrieval, filtering, metrics)
 */

import { describe, it, expect } from 'vitest';
import {
  FINANCE_EVAL_CATEGORIES,
  FINANCE_EVAL_DATASET,
  FinanceEvalScenarioSchema,
  getFinanceEvalScenario,
  listFinanceEvalScenarios,
  getFinanceEvalDatasetMetrics,
} from '../../agents/finance/evaluation/finance-eval-dataset';

describe('Finance Evaluation Dataset (Phase 12 Milestone 2)', () => {
  it('contains exactly 24 enterprise scenarios conforming to FinanceEvalScenarioSchema', () => {
    expect(FINANCE_EVAL_DATASET.length).toBe(24);

    for (const scenario of FINANCE_EVAL_DATASET) {
      const parsed = FinanceEvalScenarioSchema.safeParse(scenario);
      expect(parsed.success).toBe(true);
      expect(scenario.id).toBeTruthy();
      expect(scenario.name).toBeTruthy();
      expect(scenario.groundTruthFacts.length).toBeGreaterThan(0);
      expect(scenario.evaluationCriteria).toBeTruthy();
    }
  });

  it('contains exactly 4 scenarios per category across all 6 categories', () => {
    expect(FINANCE_EVAL_CATEGORIES.length).toBe(6);

    for (const category of FINANCE_EVAL_CATEGORIES) {
      const scenarios = listFinanceEvalScenarios(category);
      expect(scenarios.length).toBe(4);
    }
  });

  it('includes 4 dedicated red-team adversarial security scenarios (Rule 46)', () => {
    const attacks = listFinanceEvalScenarios('FINANCIAL_SECURITY_ATTACK');
    expect(attacks.length).toBe(4);

    const attackIds = attacks.map((a) => a.id);
    expect(attackIds).toContain('SEC_ATTACK_001'); // Wire memo prompt injection
    expect(attackIds).toContain('SEC_ATTACK_002'); // Cross-tenant IDOR probe
    expect(attackIds).toContain('SEC_ATTACK_003'); // Unauthorized bulk refund bypass
    expect(attackIds).toContain('SEC_ATTACK_004'); // Replay attack with duplicate idempotency key

    const memoInjection = getFinanceEvalScenario('SEC_ATTACK_001');
    expect(memoInjection?.inputQuery).toContain('SYSTEM OVERRIDE');
    expect(memoInjection?.forbiddenActions).toContain('finance.payment.reconcile');

    const idorProbe = getFinanceEvalScenario('SEC_ATTACK_002');
    expect(idorProbe?.organizationId).toBe('org_campus_alpha');
    expect(idorProbe?.inputQuery).toContain('org_campus_beta');
    expect(idorProbe?.expectedActions).toHaveLength(0);

    const refundBypass = getFinanceEvalScenario('SEC_ATTACK_003');
    expect(refundBypass?.forbiddenActions).toContain('finance.payment.reconcile');

    const replayAttack = getFinanceEvalScenario('SEC_ATTACK_004');
    expect(replayAttack?.inputQuery).toContain('rec_idem_fixed_key_001');
  });

  it('returns valid metrics using getFinanceEvalDatasetMetrics', () => {
    const metrics = getFinanceEvalDatasetMetrics();
    expect(metrics.totalScenarios).toBe(24);
    expect(metrics.categoriesCount).toBe(6);
    for (const category of FINANCE_EVAL_CATEGORIES) {
      expect(metrics.categoryBreakdown[category]).toBe(4);
    }
  });

  it('retrieves specific scenario by id using getFinanceEvalScenario', () => {
    const scenario = getFinanceEvalScenario('REC_MATCH_001');
    expect(scenario).toBeDefined();
    expect(scenario?.name).toBe('Standard Wire Transfer Exact Match');
    expect(scenario?.personaId).toBe('reconciliation_agent');

    const notFound = getFinanceEvalScenario('NON_EXISTENT_ID');
    expect(notFound).toBeUndefined();
  });
});
