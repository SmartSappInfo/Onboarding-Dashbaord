import { describe, it, expect } from 'vitest';
import {
  SUPERVISOR_EVAL_DATASET,
  getSupervisorEvalScenario,
  listSupervisorEvalScenarios,
  getSupervisorEvalDatasetMetrics,
} from '../../../agents/supervisor/evaluation/supervisor-eval-dataset';
import { SupervisorEvalScenarioSchema } from '../../../agents/supervisor/supervisor-types';

describe('Supervisor Evaluation Dataset (Rule 44 & 67)', () => {
  it('contains exactly 24 gold-standard scenarios conforming to schema', () => {
    expect(SUPERVISOR_EVAL_DATASET.length).toBe(24);
    for (const scenario of SUPERVISOR_EVAL_DATASET) {
      expect(() => SupervisorEvalScenarioSchema.parse(scenario)).not.toThrow();
    }
  });

  it('covers all 6 canonical categories with exactly 4 scenarios each', () => {
    const metrics = getSupervisorEvalDatasetMetrics();
    expect(metrics.totalScenarios).toBe(24);
    expect(metrics.categoryCounts['RECOVERY_CAMPAIGN']).toBe(4);
    expect(metrics.categoryCounts['CAMPUS_AUDIT']).toBe(4);
    expect(metrics.categoryCounts['ONBOARDING_ACCELERATOR']).toBe(4);
    expect(metrics.categoryCounts['CHURN_CRISIS_INTERVENTION']).toBe(4);
    expect(metrics.categoryCounts['DATA_HYGIENE_CLEANUP']).toBe(4);
    expect(metrics.categoryCounts['ADVERSARIAL_ATTACK']).toBe(4);
  });

  it('retrieves scenarios by ID via getSupervisorEvalScenario', () => {
    const s1 = getSupervisorEvalScenario('EVAL_SUP_REC_001');
    expect(s1).not.toBeNull();
    expect(s1?.category).toBe('RECOVERY_CAMPAIGN');
    expect(s1?.title).toContain('Ghana International School');

    const notFound = getSupervisorEvalScenario('NON_EXISTENT');
    expect(notFound).toBeNull();
  });

  it('filters scenarios by category via listSupervisorEvalScenarios', () => {
    const audits = listSupervisorEvalScenarios('CAMPUS_AUDIT');
    expect(audits.length).toBe(4);
    expect(audits.every((s) => s.category === 'CAMPUS_AUDIT')).toBe(true);

    const all = listSupervisorEvalScenarios();
    expect(all.length).toBe(24);
  });

  it('ensures all scenarios define non-empty ground-truth and forbidden capabilities', () => {
    for (const scenario of SUPERVISOR_EVAL_DATASET) {
      expect(scenario.expectedCapabilities.length).toBeGreaterThan(0);
      expect(scenario.expectedPersonas.length).toBeGreaterThan(0);
      expect(scenario.forbiddenCapabilities.length).toBeGreaterThan(0);
    }
  });
});
