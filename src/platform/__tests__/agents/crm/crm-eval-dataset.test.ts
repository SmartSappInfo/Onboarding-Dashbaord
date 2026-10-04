/**
 * @fileOverview Unit & Architectural Tests for CRM Evaluation Dataset (Phase 9 Milestone 2)
 *
 * Implements verification for Rules 1, 4, 8, 13, 30, 44, 46, 67, 68, and 69.
 */

import { describe, it, expect } from 'vitest';
import {
  CRM_EVAL_DATASET,
  CrmEvalScenarioSchema,
  getCrmEvalScenario,
  listCrmEvalScenarios,
  getEvalDatasetMetrics,
  type CrmEvalCategory,
} from '@/platform/agents/crm/evaluation/crm-eval-dataset';
import { CRM_PERSONA_IDS } from '@/platform/agents/crm/personas/crm-persona-definitions';

describe('Phase 9 Milestone 2: CRM Evaluation Dataset (Rules 44, 67)', () => {
  it('should contain at least 20 enterprise evaluation scenarios', () => {
    expect(CRM_EVAL_DATASET.length).toBeGreaterThanOrEqual(20);
  });

  it('should validate every scenario against CrmEvalScenarioSchema', () => {
    for (const scenario of CRM_EVAL_DATASET) {
      const parsed = CrmEvalScenarioSchema.safeParse(scenario);
      expect(parsed.success, `Scenario ${scenario.id} failed validation: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('should cover all 6 mandatory enterprise scenario categories', () => {
    const requiredCategories: CrmEvalCategory[] = [
      'FLAGSHIP_ACCOUNT',
      'STALLED_DEAL',
      'DUPLICATE_LEAD',
      'AT_RISK_CHURN',
      'RE_ENGAGEMENT',
      'SECURITY_ATTACK',
    ];

    const metrics = getEvalDatasetMetrics();
    expect(metrics.totalScenarios).toBe(CRM_EVAL_DATASET.length);

    for (const category of requiredCategories) {
      const count = metrics.categoryBreakdown[category];
      expect(count, `Category ${category} has fewer than 3 scenarios`).toBeGreaterThanOrEqual(3);
    }
  });

  it('should assign a valid CRM persona ID to every scenario', () => {
    for (const scenario of CRM_EVAL_DATASET) {
      expect(
        CRM_PERSONA_IDS,
        `Scenario ${scenario.id} assigned invalid persona: ${scenario.expectedPersona}`
      ).toContain(scenario.expectedPersona);
    }
  });

  it('should contain adversarial injection directives in SECURITY_ATTACK scenarios (Rules 13, 30, 46)', () => {
    const securityScenarios = listCrmEvalScenarios({ category: 'SECURITY_ATTACK' });
    expect(securityScenarios.length).toBeGreaterThanOrEqual(3);

    for (const scenario of securityScenarios) {
      expect(scenario.adversarialDirectives).toBeDefined();
      expect(scenario.adversarialDirectives?.length).toBeGreaterThan(0);
      expect(scenario.forbiddenActions).toBeDefined();
      expect(scenario.forbiddenActions?.length).toBeGreaterThan(0);
    }
  });

  it('should retrieve individual scenarios by ID via getCrmEvalScenario', () => {
    const first = CRM_EVAL_DATASET[0];
    const retrieved = getCrmEvalScenario(first.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(first.id);

    const nonExistent = getCrmEvalScenario('non_existent_scenario_xyz');
    expect(nonExistent).toBeNull();
  });

  it('should filter scenarios by category via listCrmEvalScenarios', () => {
    const flagshipScenarios = listCrmEvalScenarios({ category: 'FLAGSHIP_ACCOUNT' });
    expect(flagshipScenarios.length).toBeGreaterThanOrEqual(3);
    for (const s of flagshipScenarios) {
      expect(s.category).toBe('FLAGSHIP_ACCOUNT');
    }
  });
});
