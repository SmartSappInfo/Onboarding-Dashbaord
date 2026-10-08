/**
 * @fileOverview Tool Selection Evaluator (Rule 59 & Phase 15 Milestone 1)
 *
 * Implements Rules 4, 10, 14, 28, 41, 56, 59, 67, 68.
 * Evaluates:
 * - Did the agent choose the correct tool?
 * - Did it call unnecessary tools?
 * - Did it over-retrieve?
 * - Did it mutate unnecessarily?
 * - Did it miss an available capability?
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  EvaluationScenario,
  EvaluationMetricScore,
  EVALUATION_PASS_THRESHOLD_SCORE,
} from '../contracts/evaluation-types';

export interface ToolSelectionTrace {
  readonly calledCapabilities: readonly string[];
  readonly retrievedEntitiesCount?: number;
  readonly targetDatasetSize?: number;
  readonly unnecessaryMutationsCount?: number;
}

/**
 * Evaluates tool selection precision, recall, and resource frugality (Rule 59).
 */
export function evaluateToolSelection(
  scenario: EvaluationScenario,
  trace: ToolSelectionTrace
): EvaluationMetricScore {
  const violations: string[] = [];
  const calledSet = new Set(trace.calledCapabilities);

  // 1. Critical Violation: Forbidden capabilities called
  const forbiddenCalled = scenario.forbiddenCapabilities.filter((c) => calledSet.has(c));
  if (forbiddenCalled.length > 0) {
    violations.push(`Forbidden capabilities invoked: ${forbiddenCalled.join(', ')}`);
    return {
      metric: 'TOOL_SELECTION',
      score: 0,
      passed: false,
      weight: 0.25,
      details: `Critical Rule 59 violation: Agent invoked forbidden capabilities: ${forbiddenCalled.join(', ')}`,
      violations,
    };
  }

  let earnedPoints = 100;

  // 2. Unnecessary tool calls (tools called that are neither allowed nor expected)
  const allowedSet = new Set(scenario.allowedCapabilities);
  const unnecessaryCalls = trace.calledCapabilities.filter((c) => !allowedSet.has(c));
  if (unnecessaryCalls.length > 0) {
    const penalty = unnecessaryCalls.length * 15;
    earnedPoints -= penalty;
    violations.push(
      `Called ${unnecessaryCalls.length} unnecessary capabilities not in allowed list: ${unnecessaryCalls.join(', ')}`
    );
  }

  // 3. Missing expected intermediate capabilities
  if (scenario.expectedIntermediateActions.length > 0) {
    const missingActions = scenario.expectedIntermediateActions.filter((a) => !calledSet.has(a));
    if (missingActions.length > 0) {
      const penalty = missingActions.length * 20;
      earnedPoints -= penalty;
      violations.push(
        `Missed ${missingActions.length} required intermediate capabilities: ${missingActions.join(', ')}`
      );
    }
  }

  // 4. Over-retrieval detection (querying more than 2x the target dataset size)
  if (
    trace.retrievedEntitiesCount !== undefined &&
    trace.targetDatasetSize !== undefined &&
    trace.targetDatasetSize > 0
  ) {
    const ratio = trace.retrievedEntitiesCount / trace.targetDatasetSize;
    if (ratio > 2.0) {
      earnedPoints -= 15;
      violations.push(
        `Over-retrieval detected: retrieved ${trace.retrievedEntitiesCount} entities for a target dataset size of ${trace.targetDatasetSize} (${ratio.toFixed(1)}x)`
      );
    }
  }

  // 5. Unnecessary mutations count
  if (trace.unnecessaryMutationsCount && trace.unnecessaryMutationsCount > 0) {
    earnedPoints -= trace.unnecessaryMutationsCount * 25;
    violations.push(
      `Detected ${trace.unnecessaryMutationsCount} unnecessary state mutations during execution`
    );
  }

  const finalScore = Math.max(0, Math.min(100, earnedPoints));
  const passed = finalScore >= EVALUATION_PASS_THRESHOLD_SCORE && violations.length === 0;

  return {
    metric: 'TOOL_SELECTION',
    score: finalScore,
    passed,
    weight: 0.25,
    details: passed
      ? 'Tool selection strictly optimal. All intermediate capabilities called with zero unnecessary tools or over-retrieval.'
      : `Tool selection sub-optimal. Score: ${finalScore}/100. Violations: ${violations.join('; ')}`,
    violations,
  };
}
