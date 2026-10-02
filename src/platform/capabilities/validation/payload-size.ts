/**
 * @fileOverview Payload Size Validator (Phase 1 / PR-4)
 *
 * Implements Rule 9 (Resource Exhaustion Defense) and Rule 23 (Resource Governance).
 *
 * Enforces payload byte limits BEFORE expensive JSON parsing or schema validation:
 * - Checks raw byte length of incoming payloads (buffers, strings, or pre-calculated lengths).
 * - Guarantees payloads do not exceed capability limits (default 1 MB, hard ceiling 32 MB for Cloud Run).
 * - Fails safely with `CapabilityError.validation` and `stateChanged: 'no'`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { CapabilityError } from '../errors/capability-error';

export const CLOUD_RUN_MAX_PAYLOAD_BYTES = 32 * 1024 * 1024; // 32 MB
export const DEFAULT_MAX_PAYLOAD_BYTES = 1 * 1024 * 1024; // 1 MB

export interface PayloadSizeCheckResult {
  valid: boolean;
  actualBytes: number;
  maxBytes: number;
}

/**
 * Calculates raw byte size of a payload without converting everything to string if already sized.
 */
export function calculatePayloadByteSize(input: unknown, explicitByteSize?: number): number {
  if (typeof explicitByteSize === 'number' && explicitByteSize >= 0) {
    return explicitByteSize;
  }

  if (Buffer.isBuffer(input)) {
    return input.byteLength;
  }

  if (input instanceof Uint8Array) {
    return input.byteLength;
  }

  if (typeof input === 'string') {
    return Buffer.byteLength(input, 'utf8');
  }

  if (input === undefined || input === null) {
    return 0;
  }

  // Fallback: estimate JSON serialized size
  try {
    const serialized = JSON.stringify(input);
    return Buffer.byteLength(serialized, 'utf8');
  } catch {
    // If circular or unstringifiable, return conservative estimate
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Validates that an input payload does not exceed the allowed byte limit.
 * Throws a `CapabilityError.validation` if the payload exceeds limits.
 */
export function enforcePayloadSizeLimit(
  input: unknown,
  maxBytes: number = DEFAULT_MAX_PAYLOAD_BYTES,
  explicitByteSize?: number
): PayloadSizeCheckResult {
  const effectiveMaxBytes = Math.min(maxBytes, CLOUD_RUN_MAX_PAYLOAD_BYTES);
  const actualBytes = calculatePayloadByteSize(input, explicitByteSize);

  if (actualBytes > effectiveMaxBytes) {
    throw CapabilityError.validation(
      `Payload size (${actualBytes} bytes) exceeds the allowed limit of ${effectiveMaxBytes} bytes.`,
      { actualBytes, maxBytes: effectiveMaxBytes }
    );
  }

  return {
    valid: true,
    actualBytes,
    maxBytes: effectiveMaxBytes,
  };
}
