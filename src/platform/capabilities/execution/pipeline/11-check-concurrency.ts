/**
 * @fileOverview Pipeline Step 11: Check Concurrency / TOCTOU Protection (Phase 1 / PR-4)
 *
 * Implements Rule 18 (TOCTOU & Optimistic Concurrency), PRD §73, and Tools §4.
 *
 * - Enforces `policies.requiresExpectedVersion` when required.
 * - Compares caller's `expectedVersion` with the actual stored resource version from Step 7.
 * - Fails safely with `VERSION_CONFLICT` (`stateChanged: 'no'`) if the resource was modified
 *   concurrently by another human or agent.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export function step11CheckConcurrency(
  capability: AnyCapabilityDefinition,
  expectedVersion: string | number | undefined,
  actualResourceVersion: string | number | undefined
): void {
  if (capability.policies.requiresExpectedVersion && expectedVersion === undefined) {
    throw CapabilityError.validation(
      `Capability '${capability.id}' requires an 'expectedVersion' for optimistic concurrency control.`
    );
  }

  if (expectedVersion !== undefined && actualResourceVersion !== undefined) {
    if (String(expectedVersion) !== String(actualResourceVersion)) {
      throw CapabilityError.versionConflict(actualResourceVersion);
    }
  }
}
