/**
 * @fileOverview Pipeline Step 2: Lookup Capability (Phase 1 / PR-4)
 *
 * Implements Rule 14 (Rug-Pull Defense), Rule 36 (SemVer Pinned Resolution), and PRD §73.
 *
 * Resolves capability from registry. Enforces version pinning when requested.
 * Rejects unknown capabilities or version mismatches with `NOT_FOUND` (`stateChanged: 'no'`).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { CapabilityError } from '../../errors/capability-error';

export function step02LookupCapability(
  capabilityId: string,
  requestedVersion: string | undefined,
  registryLookup: (id: string) => AnyCapabilityDefinition | undefined
): AnyCapabilityDefinition {
  const capability = registryLookup(capabilityId);

  if (!capability) {
    throw new CapabilityError({
      code: 'CAPABILITY_NOT_REGISTERED',
      message: `Capability '${capabilityId}' is not registered.`,
      stateChanged: 'no',
      httpStatus: 404,
      retryable: false,
    });
  }

  // Version pin (Rule 14 & Rule 36):
  // If caller requested a specific SemVer, enforce that registered version matches.
  if (requestedVersion && capability.version !== requestedVersion) {
    throw new CapabilityError({
      code: 'CAPABILITY_VERSION_MISMATCH',
      message: `Step was queued for ${capability.id}@${requestedVersion} but ${capability.version} is registered.`,
      stateChanged: 'no',
      httpStatus: 404,
      retryable: false,
    });
  }

  return capability;
}
