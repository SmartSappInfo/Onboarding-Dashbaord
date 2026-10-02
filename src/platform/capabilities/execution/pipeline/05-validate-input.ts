/**
 * @fileOverview Pipeline Step 5: Validate Input (Phase 1 / PR-4)
 *
 * Implements Rule 4 (Strict Typing & Unvalidated Unknown Ban), Rule 31 (Boundary Schema Validation),
 * Rule 47 (Never Trust the Model), and PRD §73.
 *
 * Validates and narrows untrusted boundary input through the capability's Zod v4 `inputSchema`.
 * Throws `VALIDATION` (`stateChanged: 'no'`) on invalid payloads.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

const MAX_REPORTED_ISSUES = 5;

export function step05ValidateInput(
  rawInput: unknown,
  capability: AnyCapabilityDefinition
): unknown {
  const result = capability.inputSchema.safeParse(rawInput);

  if (!result.success) {
    const issues = result.error.issues
      .slice(0, MAX_REPORTED_ISSUES)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');

    throw new CapabilityError({
      code: 'INVALID_INPUT',
      message: `Invalid input: ${issues}`,
      stateChanged: 'no',
      httpStatus: 400,
      retryable: false,
      details: {
        issues: result.error.issues.map((i) => ({ path: i.path, message: i.message })),
      },
    });
  }

  return result.data;
}
