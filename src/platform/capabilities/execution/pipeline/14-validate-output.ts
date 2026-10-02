/**
 * @fileOverview Pipeline Step 14: Validate Output (Phase 1 / PR-4)
 *
 * Implements Rule 48 ("Never Trust the Tool Either"), Rule 4 (Strict Typing),
 * PRD §73, and Tools §4.
 *
 * Validates handler execution result against the capability's Zod v4 `outputSchema`.
 *
 * NON-NEGOTIABLE INVARIANT (PRD §73, Rule 48):
 * If the output fails schema validation, this step MUST throw `INTERNAL` (`stateChanged: 'unknown'`)
 * and NEVER return unvalidated data to the caller or model context.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export function step14ValidateOutput(
  rawOutput: unknown,
  capability: AnyCapabilityDefinition
): unknown {
  if (!capability.outputSchema) {
    return rawOutput;
  }

  const result = capability.outputSchema.safeParse(rawOutput);

  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');

    throw new CapabilityError({
      code: 'INVALID_OUTPUT',
      message: `Capability output failed its output schema (invalid result): ${issues}`,
      stateChanged: 'unknown',
      httpStatus: 500,
      retryable: false,
      cause: result.error,
    });
  }

  return result.data;
}
