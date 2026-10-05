/**
 * @fileOverview Unit & Integrity Tests for Sales Evaluation Benchmark Dataset (Phase 10 Milestone 2)
 *
 * Implements Rules 4, 10, 44, 46, 59, 67, and 69.
 * Validates:
 * - 24 enterprise gold-standard scenarios across 6 canonical categories
 * - Schema validation via SalesEvalScenarioSchema
 * - Ground truth facts, expected actions, and criteria for every scenario
 * - Explicit adversarial security attack scenarios (Rule 46)
 */

import { describe, it, expect } from 'vitest';
import {
  SALES_EVAL_CATEGORIES,
  SALES_EVAL_DATASET,
  SalesEvalScenarioSchema,
} from '../../agents/sales/evaluation/sales-eval-dataset';

describe('Sales Evaluation Dataset', () => {
  it('contains at least 20 gold-standard evaluation scenarios', () => {
    expect(SALES_EVAL_DATASET.length).toBeGreaterThanOrEqual(20);
    expect(SALES_EVAL_DATASET.length).toBe(24);
  });

  it('covers all 6 canonical sales evaluation categories', () => {
    const categories = new Set(SALES_EVAL_DATASET.map((s) => s.category));
    for (const cat of SALES_EVAL_CATEGORIES) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('validates every evaluation scenario against SalesEvalScenarioSchema', () => {
    for (const scenario of SALES_EVAL_DATASET) {
      const parsed = SalesEvalScenarioSchema.safeParse(scenario);
      expect(parsed.success).toBe(true);
      expect(scenario.groundTruthFacts.length).toBeGreaterThan(0);
      if (scenario.category !== 'SECURITY_ATTACK') {
        expect(scenario.expectedActions.length).toBeGreaterThan(0);
      }
      expect(scenario.workspaceId).toBeTruthy();
      expect(scenario.organizationId).toBeTruthy();
      expect(scenario.evaluationCriteria).toBeTruthy();
    }
  });

  it('includes explicit adversarial and security attack scenarios (Rule 46)', () => {
    const securityScenarios = SALES_EVAL_DATASET.filter((s) => s.category === 'SECURITY_ATTACK');
    expect(securityScenarios.length).toBeGreaterThanOrEqual(4);
    for (const sec of securityScenarios) {
      expect(sec.forbiddenActions).toBeDefined();
      expect(sec.forbiddenActions?.length).toBeGreaterThan(0);
    }

    const secIds = securityScenarios.map((s) => s.id);
    expect(secIds).toContain('SEC_SALES_001'); // Prompt injection in scraped HTML
    expect(secIds).toContain('SEC_SALES_002'); // SSRF private subnet probe
    expect(secIds).toContain('SEC_SALES_003'); // IDOR cross-tenant access attempt
    expect(secIds).toContain('SEC_SALES_004'); // Unapproved bulk outbound bypass
  });
});
