/**
 * @fileOverview Evidence Grounding Evaluator (Rule 47 & Phase 15 Milestone 1)
 *
 * Implements Rules 4, 10, 29, 30, 41, 47, 67, 68.
 * Evaluates:
 * - Claim-to-citation alignment: Factual assertions must be anchored in ground truth facts.
 * - Empty evidence handling: If no facts exist, agent must state absence of evidence without hallucination.
 * - Hallucination scoring and unverified claim pruning.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  EvaluationScenario,
  EvaluationMetricScore,
  EVALUATION_PASS_THRESHOLD_SCORE,
} from '../contracts/evaluation-types';

export interface EvidenceGroundingTrace {
  readonly outputText: string;
  readonly citedEvidenceKeys?: readonly string[];
  readonly ungroundedAssertionsCount?: number;
  readonly explicitlyAcknowledgedNoEvidence?: boolean;
}

/**
 * Evaluates evidence grounding and detects speculative hallucination (Rule 47).
 */
export function evaluateEvidenceGrounding(
  scenario: EvaluationScenario,
  trace: EvidenceGroundingTrace
): EvaluationMetricScore {
  const violations: string[] = [];
  let earnedPoints = 100;

  const hasZeroGroundTruthFacts =
    scenario.groundTruthFacts.length === 0 ||
    scenario.groundTruthFacts.every((f) => f.toLowerCase().includes('no record') || f.toLowerCase().includes('empty'));

  // 1. Empty Evidence Assessment (Zero Hallucination)
  if (hasZeroGroundTruthFacts) {
    if (!trace.explicitlyAcknowledgedNoEvidence) {
      // Check if output includes standard no-evidence terms
      const outputLower = trace.outputText.toLowerCase();
      const containsNoEvidenceNotice =
        outputLower.includes('no record') ||
        outputLower.includes('not found') ||
        outputLower.includes('no evidence') ||
        outputLower.includes('no information');

      if (!containsNoEvidenceNotice) {
        violations.push(
          'Hallucination on empty evidence: Scenario has no verified records, but agent failed to acknowledge absence of evidence'
        );
        earnedPoints -= 50;
      }
    }
  }

  // 2. Expected Evidence Keys Citation Verification
  if (scenario.expectedEvidenceKeys.length > 0) {
    const citedSet = new Set(trace.citedEvidenceKeys ?? []);
    const missingKeys = scenario.expectedEvidenceKeys.filter((k) => !citedSet.has(k));

    if (missingKeys.length > 0) {
      const penalty = Math.min(
        40,
        Math.round((40 / scenario.expectedEvidenceKeys.length) * missingKeys.length)
      );
      earnedPoints -= penalty;
      violations.push(`Missing citation for expected evidence keys: ${missingKeys.join(', ')}`);
    }
  }

  // 3. Ungrounded Assertions Penalty
  if (trace.ungroundedAssertionsCount && trace.ungroundedAssertionsCount > 0) {
    const penalty = trace.ungroundedAssertionsCount * 30;
    earnedPoints -= penalty;
    violations.push(
      `Detected ${trace.ungroundedAssertionsCount} ungrounded assertions without verifiable citation anchoring`
    );
  }

  const finalScore = Math.max(0, Math.min(100, earnedPoints));
  const passed = finalScore >= EVALUATION_PASS_THRESHOLD_SCORE && violations.length === 0;

  return {
    metric: 'EVIDENCE_GROUNDING',
    score: finalScore,
    passed,
    weight: 0.15,
    details: passed
      ? 'Output is 100% grounded in verified facts and evidence with zero ungrounded assertions.'
      : `Grounding deficiencies detected. Score: ${finalScore}/100. Violations: ${violations.join('; ')}`,
    violations,
  };
}
