/**
 * @fileOverview Pipeline Step 4: Validate Payload Size (Phase 1 / PR-4)
 *
 * Implements Rule 9 (Resource Exhaustion Defense), Rule 23 (Resource Governance), and Tools §4.
 *
 * Enforces raw payload byte limit BEFORE JSON parsing or schema execution.
 * Fails safely with `VALIDATION` (`stateChanged: 'no'`).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type { AnyCapabilityDefinition } from '../../contracts/capability-definition';
import { enforcePayloadSizeLimit } from '../../validation/payload-size';

export function step04ValidatePayloadSize(
  rawInput: unknown,
  capability: AnyCapabilityDefinition,
  explicitByteSize?: number
): void {
  const maxBytes = capability.execution.maxPayloadSizeBytes;
  enforcePayloadSizeLimit(rawInput, maxBytes, explicitByteSize);
}
