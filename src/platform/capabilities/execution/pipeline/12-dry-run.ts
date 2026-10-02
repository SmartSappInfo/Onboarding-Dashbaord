/**
 * @fileOverview Pipeline Step 12: Dry Run / Shadow Execution (Phase 1 / PR-4)
 *
 * Implements Rule 21 (Two-Phase Actions), Rule 42 (Shadow Mode), PRD §73, and Tools §4.
 *
 * When `dryRun: true` is requested:
 * - Checks `execution.supportsDryRun`.
 * - Returns a validated simulation plan without executing mutating side effects.
 * - Guarantees `stateChanged: 'no'`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export interface DryRunOutcome<TOutput = unknown> {
  isDryRun: boolean;
  simulatedResult?: TOutput;
}

export function step12DryRun(
  capability: AnyCapabilityDefinition,
  validatedInput: unknown,
  dryRunRequested: boolean | undefined
): DryRunOutcome {
  if (!dryRunRequested) {
    return { isDryRun: false };
  }

  if (!capability.execution.supportsDryRun) {
    throw CapabilityError.validation(
      `Capability '${capability.id}' does not support dry-run simulation.`
    );
  }

  return {
    isDryRun: true,
    simulatedResult: {
      dryRun: true,
      capabilityId: capability.id,
      input: validatedInput,
      simulatedAt: new Date().toISOString(),
    },
  };
}
