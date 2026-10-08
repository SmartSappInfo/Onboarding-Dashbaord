/**
 * @fileOverview 35 Multi-Domain Gold-Standard Benchmark Catalog Test Suite (Phase 15 Milestone 1)
 */

import { describe, it, expect } from 'vitest';
import {
  GOLD_STANDARD_SCENARIOS,
  getGoldStandardScenarioById,
  getGoldStandardScenariosByDomain,
  getGoldStandardCatalogCount,
} from '../../evaluation/datasets/gold-standard-catalog';
import {
  EvaluationScenarioSchema,
  EVALUATION_DOMAINS,
} from '../../evaluation/contracts/evaluation-types';

describe('Phase 15 Milestone 1: 35 Multi-Domain Gold-Standard Benchmark Catalog', () => {
  it('contains exactly 35 enterprise scenarios across the catalog', () => {
    expect(getGoldStandardCatalogCount()).toBe(35);
    expect(GOLD_STANDARD_SCENARIOS).toHaveLength(35);
  });

  it('contains exactly 5 scenarios for each of the 7 canonical domains', () => {
    for (const domain of EVALUATION_DOMAINS) {
      const domainScenarios = getGoldStandardScenariosByDomain(domain);
      expect(domainScenarios).toHaveLength(5);
    }
  });

  it('verifies that every single scenario conforms 100% to EvaluationScenarioSchema', () => {
    for (const scenario of GOLD_STANDARD_SCENARIOS) {
      const parseResult = EvaluationScenarioSchema.safeParse(scenario);
      if (!parseResult.success) {
        // eslint-disable-next-line no-console
        console.error(`Scenario schema failure for ${scenario.id}:`, parseResult.error.format());
      }
      expect(parseResult.success).toBe(true);
    }
  });

  it('verifies that all scenario IDs are unique', () => {
    const idSet = new Set<string>();
    for (const scenario of GOLD_STANDARD_SCENARIOS) {
      expect(idSet.has(scenario.id)).toBe(false);
      idSet.add(scenario.id);
    }
    expect(idSet.size).toBe(35);
  });

  it('verifies mathematical sanity of human baselines across all scenarios', () => {
    for (const scenario of GOLD_STANDARD_SCENARIOS) {
      const hb = scenario.humanBaseline;
      expect(hb.humanTimeSeconds).toBeGreaterThanOrEqual(60);
      expect(hb.humanErrorRate).toBeGreaterThan(0);
      expect(hb.humanErrorRate).toBeLessThanOrEqual(50);
      expect(hb.humanSourcesConsulted).toBeGreaterThan(0);
      expect(hb.humanSourcesConsulted).toBeLessThanOrEqual(hb.totalSourcesAvailable);
    }
  });

  it('retrieves scenarios correctly by ID', () => {
    const scenario = getGoldStandardScenarioById('eval_crm_01');
    expect(scenario).toBeDefined();
    expect(scenario?.domain).toBe('crm');
    expect(scenario?.title).toContain('Flagship Account 360');

    const nonExistent = getGoldStandardScenarioById('eval_non_existent');
    expect(nonExistent).toBeUndefined();
  });
});
