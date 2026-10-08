/**
 * @fileOverview Task Completion Evaluator (Phase 15 Milestone 1)
 *
 * Implements Rules 4, 10, 41, 47, 67, 68.
 * Evaluates whether an agent execution achieved the primary objective, satisfied required
 * final state invariants, and outputted necessary verified assertions without crashes.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  EvaluationScenario,
  EvaluationMetricScore,
  EVALUATION_PASS_THRESHOLD_SCORE,
} from '../contracts/evaluation-types';

export interface TaskExecutionTrace {
  readonly outputText: string;
  readonly finalStateSnapshot?: Readonly<Record<string, unknown>>;
  readonly error?: string | null;
  readonly isSuccess: boolean;
}

/**
 * Evaluates task completion and invariant satisfaction.
 */
export function evaluateTaskCompletion(
  scenario: EvaluationScenario,
  trace: TaskExecutionTrace
): EvaluationMetricScore {
  const violations: string[] = [];

  // 1. Crash or unhandled error check
  if (trace.error || !trace.isSuccess) {
    violations.push(`Task execution failed with error: ${trace.error ?? 'Unknown execution failure'}`);
    return {
      metric: 'TASK_COMPLETION',
      score: 0,
      passed: false,
      weight: 0.3,
      details: 'Task failed during execution with an unhandled exception or failed state.',
      violations,
    };
  }

  let earnedPoints = 100;

  // 2. Expected output substring verification
  if (scenario.expectedOutputContains.length > 0) {
    const missingSubstrings: string[] = [];
    const normalizedOutput = trace.outputText.toLowerCase();

    for (const expectedStr of scenario.expectedOutputContains) {
      if (!normalizedOutput.includes(expectedStr.toLowerCase())) {
        missingSubstrings.push(expectedStr);
      }
    }

    if (missingSubstrings.length > 0) {
      const deductionPerItem = Math.min(
        50,
        Math.round((50 / scenario.expectedOutputContains.length) * missingSubstrings.length)
      );
      earnedPoints -= deductionPerItem;
      violations.push(`Missing expected output substrings: ${missingSubstrings.join(', ')}`);
    }
  }

  // 3. Expected final state verification
  const expectedFinalEntries = Object.entries(scenario.expectedFinalState);
  if (expectedFinalEntries.length > 0) {
    const missingStateKeys: string[] = [];
    const mismatchedStateValues: string[] = [];
    const actualState = trace.finalStateSnapshot ?? {};

    for (const [key, expectedValue] of expectedFinalEntries) {
      if (!(key in actualState)) {
        missingStateKeys.push(key);
      } else if (JSON.stringify(actualState[key]) !== JSON.stringify(expectedValue)) {
        mismatchedStateValues.push(
          `${key} (expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualState[key])})`
        );
      }
    }

    if (missingStateKeys.length > 0) {
      earnedPoints -= 25;
      violations.push(`Missing final state keys: ${missingStateKeys.join(', ')}`);
    }
    if (mismatchedStateValues.length > 0) {
      earnedPoints -= 25;
      violations.push(`Mismatched final state values: ${mismatchedStateValues.join(', ')}`);
    }
  }

  const finalScore = Math.max(0, Math.min(100, earnedPoints));
  const passed = finalScore >= EVALUATION_PASS_THRESHOLD_SCORE && violations.length === 0;

  return {
    metric: 'TASK_COMPLETION',
    score: finalScore,
    passed,
    weight: 0.3,
    details: passed
      ? 'Task completed successfully with all required outputs and state invariants satisfied.'
      : `Task completion degraded. Violations: ${violations.join('; ')}`,
    violations,
  };
}
