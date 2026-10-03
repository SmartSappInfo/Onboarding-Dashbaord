/**
 * @fileOverview Post-Condition Verification Engine (Rules 18, 47 & Step 9 Lifecycle)
 *
 * Implements:
 * - Rule 47: "Never Trust the Model" — formal post-execution verification gate.
 * - Rule 18: Time-of-Check / Time-of-Use (TOCTOU) detection and optimistic concurrency verification.
 * - Step 9 in the 14-Step Agentic Lifecycle: asserts that observed state matches expected post-conditions.
 * - Generates structured failure diagnostics and actionable suggested remediations for `AgentReplanner`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  type AgentStep,
  type PlanStep,
} from '../agent-run-types';
import {
  type StepVerificationResult,
} from './execution-types';

export interface VerifyStepParams {
  step: AgentStep;
  planStep: PlanStep;
  executionOutput: unknown;
  context?: Record<string, unknown>;
}

export class StepVerifier {
  /**
   * Asserts whether a step's execution output satisfies the planned post-conditions (Rule 47).
   */
  public static async verifyStep(params: VerifyStepParams): Promise<StepVerificationResult> {
    const { step, planStep, executionOutput } = params;
    const expected = planStep.expectedStateChange?.trim();

    const outputObj = executionOutput && typeof executionOutput === 'object' && !Array.isArray(executionOutput)
      ? (executionOutput as Record<string, unknown>)
      : { value: executionOutput };

    // 1. If no expected state change was declared, step verification succeeds by default
    if (!expected) {
      return {
        verified: true,
        assertionDetails: `Step '${step.stepId}' verified: No explicit post-conditions declared.`,
        observedState: outputObj,
      };
    }

    // 2. Rule 18: TOCTOU & Concurrency Conflict Check
    if (
      outputObj.concurrencyConflict === true ||
      outputObj.error === 'CONCURRENCY_CONFLICT' ||
      (expected.includes('expectedVersion') &&
        outputObj.actualVersion !== undefined &&
        step.input.expectedVersion !== undefined &&
        outputObj.actualVersion !== step.input.expectedVersion)
    ) {
      return {
        verified: false,
        rejectionReason: `TOCTOU concurrency conflict detected on step '${step.stepId}': Expected version '${String(step.input.expectedVersion)}' does not match observed version '${String(outputObj.actualVersion)}'.`,
        observedState: outputObj,
        expectedState: { expectedVersion: step.input.expectedVersion, expectedStateChange: expected },
        suggestedRemediation: `Re-read state to fetch latest ETag/version and replan mutating step '${step.stepId}'.`,
      };
    }

    // 3. Technical Error disguised as success
    if (outputObj.error && typeof outputObj.error === 'string') {
      return {
        verified: false,
        rejectionReason: `Post-condition assertion failed on step '${step.stepId}': Output contains error '${outputObj.error}'.`,
        observedState: outputObj,
        expectedState: { expectedStateChange: expected },
        suggestedRemediation: `Address underlying error '${outputObj.error}' or select alternative capability.`,
      };
    }

    // 4. Status and Keyword Assertions
    const lowerExpected = expected.toLowerCase();
    
    // Pattern: "status is <status>" or "status becomes <status>"
    const statusMatch = lowerExpected.match(/status\s+(?:is|becomes|to)\s+([a-z_]+)/i);
    if (statusMatch) {
      const targetStatus = statusMatch[1].toLowerCase();
      const observedStatus = typeof outputObj.status === 'string' ? outputObj.status.toLowerCase() : undefined;

      if (observedStatus && observedStatus !== targetStatus) {
        return {
          verified: false,
          rejectionReason: `Post-condition assertion failed: Expected status "${targetStatus}", observed "${observedStatus}".`,
          observedState: outputObj,
          expectedState: { status: targetStatus, expectedStateChange: expected },
          suggestedRemediation: `Execute transition step to bring entity status from '${observedStatus}' to '${targetStatus}'.`,
        };
      }
    }

    // Pattern: "expected <field>: <val>"
    const fieldMatch = expected.match(/expected\s+([a-zA-Z0-9_]+)\s*:\s*([^\s,]+)/i);
    if (fieldMatch) {
      const fieldKey = fieldMatch[1];
      const fieldVal = fieldMatch[2];
      const observedVal = String(outputObj[fieldKey] ?? '');

      if (observedVal.toLowerCase() !== fieldVal.toLowerCase()) {
        return {
          verified: false,
          rejectionReason: `Post-condition assertion failed: Expected field "${fieldKey}" to be "${fieldVal}", observed "${observedVal}".`,
          observedState: outputObj,
          expectedState: { [fieldKey]: fieldVal },
          suggestedRemediation: `Update field '${fieldKey}' to '${fieldVal}'.`,
        };
      }
    }

    // All assertions satisfied
    return {
      verified: true,
      assertionDetails: `Step '${step.stepId}' post-condition verified: ${expected}`,
      observedState: outputObj,
      expectedState: { expectedStateChange: expected },
    };
  }
}
