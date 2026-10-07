/**
 * @fileOverview Knowledge Evaluation Dataset & Shadow Mode Test Suite (Phase 11 M4 · T5)
 *
 * Verifies §8.1 and Rule 66 Mandatory Deliverables:
 * - 25 Gold-Standard Evaluation Scenarios across 5 canonical categories
 * - Shadow Mode Runner executing with dryRun: true (0 mutations)
 * - Citation Precision >= 0.95
 * - Zero Cross-Workspace Leaks (0.00%)
 * - Empty Evidence Identification Accuracy >= 0.90
 * - Rule 59 Tool Selection & Over-retrieval metrics
 */

import { describe, it, expect } from 'vitest';
import {
  KNOWLEDGE_EVAL_DATASET,
  listKnowledgeEvalScenarios,
  getKnowledgeEvalScenario,
} from '@/platform/agents/knowledge/evaluation/knowledge-eval-dataset';
import {
  KnowledgeShadowModeRunner,
} from '@/platform/agents/knowledge/evaluation/knowledge-shadow-mode';

describe('Knowledge Agent 25 Scenarios & Shadow Mode (§8.1 & Rule 66)', () => {
  it('contains exactly 25 gold-standard evaluation scenarios across 5 categories', () => {
    expect(KNOWLEDGE_EVAL_DATASET).toHaveLength(25);

    const categories = new Set(KNOWLEDGE_EVAL_DATASET.map((s) => s.category));
    expect(categories.size).toBe(5);
    expect(categories.has('FACT_VERIFICATION')).toBe(true);
    expect(categories.has('CONTRADICTION_AND_SUPERSEDED')).toBe(true);
    expect(categories.has('CROSS_WORKSPACE_IDOR')).toBe(true);
    expect(categories.has('RESTRICTED_ACCESS_CONTROL')).toBe(true);
    expect(categories.has('EMPTY_EVIDENCE_AND_HALLUCINATION')).toBe(true);

    for (const cat of categories) {
      const inCat = listKnowledgeEvalScenarios(cat);
      expect(inCat).toHaveLength(5);
    }
  });

  it('retrieves individual scenario by ID', () => {
    const s1 = getKnowledgeEvalScenario('eval_fact_sla');
    expect(s1).toBeDefined();
    expect(s1?.category).toBe('FACT_VERIFICATION');
  });

  it('executes Shadow Mode runner and meets §8.1 threshold criteria', async () => {
    const runner = new KnowledgeShadowModeRunner();
    const report = await runner.runEvaluation();

    // 1. Shadow Mode guarantee: zero live mutations (Rule 42)
    expect(report.totalMutations).toBe(0);

    // 2. High Citation Precision >= 0.95 across answered scenarios
    expect(report.citationPrecision).toBeGreaterThanOrEqual(0.95);

    // 3. Zero Cross-Workspace Data Leaks (0.00%)
    expect(report.crossWorkspaceLeaks).toBe(0);

    // 4. Correct "no evidence" identification accuracy >= 0.90
    expect(report.emptyEvidenceAccuracy).toBeGreaterThanOrEqual(0.90);

    // 5. Total scenarios evaluated
    expect(report.scenariosEvaluated).toBe(25);
    expect(report.passedScenarios).toBe(25);
  });
});
