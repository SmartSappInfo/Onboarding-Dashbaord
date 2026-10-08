/**
 * @fileOverview Canonical Contracts & Types for State-Version Validation & Optimistic Concurrency Engine (Phase 14 Milestone 2)
 *
 * Rules enforced:
 * - Rule 4 (Strict Typing): Zero any or any[], strict Zod v4 schemas
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock): organizationId & workspaceId mandatory on all snapshots
 * - Rule 11 (Mathematical Determinism): Version sequence progression & state hash evaluation
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard): Version contracts & drift detection
 * - Rule 22 (Cryptographic Hash Binding): 64-char canonical SHA-256 state hash
 * - Rule 48 (Sanitized Error Taxonomy): Structured error codes & HTTP status mapping
 */

import { z } from 'zod';

// ============================================================================
// 1. VIOLATION TYPE TAXONOMY (Rules 2, 18, 48)
// ============================================================================

export const ConcurrencyViolationTypeSchema = z.enum([
  'NONE',
  'STALE_READ',
  'CONCURRENT_MUTATION',
  'DELETED_RESOURCE',
  'HASH_DRIFT',
]);

export type ConcurrencyViolationType = z.infer<typeof ConcurrencyViolationTypeSchema>;

// ============================================================================
// 2. RESOURCE SNAPSHOT CONTRACT (Rules 8, 18, 22)
// ============================================================================

export const ResourceSnapshotSchema = z.object({
  resourceId: z.string().min(1, 'Resource ID is required'),
  resourceType: z.string().min(1, 'Resource type is required'),
  organizationId: z.string().min(1, 'Organization ID is required (Anti-IDOR lock)'),
  workspaceId: z.string().min(1, 'Workspace ID is required (Anti-IDOR lock)'),
  version: z.union([z.number(), z.string()], {
    errorMap: () => ({ message: 'Version must be a number or string' }),
  }),
  stateHash: z.string().length(64, 'State hash must be a 64-character SHA-256 hex string'),
  capturedAt: z.string().datetime({ message: 'capturedAt must be an ISO 8601 datetime' }),
  attributes: z.record(z.string(), z.unknown()),
});

export type ResourceSnapshot = z.infer<typeof ResourceSnapshotSchema>;

// ============================================================================
// 3. VERSION VALIDATION RESULT CONTRACT (Rules 18, 41)
// ============================================================================

export const VersionValidationResultSchema = z.object({
  isCurrent: z.boolean(),
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  expectedVersion: z.union([z.number(), z.string()]),
  actualVersion: z.union([z.number(), z.string()]).nullable(),
  driftDetected: z.boolean(),
  violationType: ConcurrencyViolationTypeSchema,
  message: z.string(),
  capturedAt: z.string().datetime(),
});

export type VersionValidationResult = z.infer<typeof VersionValidationResultSchema>;

// ============================================================================
// 4. STATE VERSION MATRIX ENTRY CONTRACT (Rules 10, 18, 23)
// ============================================================================

export const StateVersionMatrixEntrySchema = z.object({
  resourceType: z.string().min(1, 'Resource type identifier is required'),
  collectionPath: z.string().min(1, 'Collection path is required'),
  versionField: z.string().min(1, 'Version field name is required'),
  leaseDurationMs: z.number().int().positive('Lease duration must be a positive integer'),
  requiresHashValidation: z.boolean(),
});

export type StateVersionMatrixEntry = z.infer<typeof StateVersionMatrixEntrySchema>;

// ============================================================================
// 5. ERROR TAXONOMY & STATUS MAPPINGS (Rule 48)
// ============================================================================

export const CONCURRENCY_ERROR_CODES = {
  STALE_VERSION_DETECTED: 'STALE_VERSION_DETECTED',
  CONCURRENT_MUTATION_CONFLICT: 'CONCURRENT_MUTATION_CONFLICT',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  STATE_HASH_MISMATCH: 'STATE_HASH_MISMATCH',
  CONCURRENCY_DEAD_MAN_PAUSED: 'CONCURRENCY_DEAD_MAN_PAUSED',
  CONCURRENCY_TIMEOUT: 'CONCURRENCY_TIMEOUT',
  INVALID_SNAPSHOT_CONTEXT: 'INVALID_SNAPSHOT_CONTEXT',
  IDOR_VIOLATION: 'IDOR_VIOLATION',
} as const;

export type ConcurrencyErrorCode =
  (typeof CONCURRENCY_ERROR_CODES)[keyof typeof CONCURRENCY_ERROR_CODES];

export const CONCURRENCY_HTTP_STATUS_MAP: Readonly<Record<ConcurrencyErrorCode, number>> = {
  INVALID_SNAPSHOT_CONTEXT: 400,
  IDOR_VIOLATION: 403,
  RESOURCE_NOT_FOUND: 404,
  STALE_VERSION_DETECTED: 409,
  CONCURRENT_MUTATION_CONFLICT: 409,
  STATE_HASH_MISMATCH: 409,
  CONCURRENCY_DEAD_MAN_PAUSED: 503,
  CONCURRENCY_TIMEOUT: 504,
};

/**
 * Typed domain error for State-Version Validation & Optimistic Concurrency Engine (Rule 48).
 */
export class StateConcurrencyError extends Error {
  public readonly code: ConcurrencyErrorCode;
  public readonly statusCode: number;
  public readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: ConcurrencyErrorCode,
    message: string,
    statusCode?: number,
    details?: Readonly<Record<string, unknown>>
  ) {
    super(message);
    this.name = 'StateConcurrencyError';
    this.code = code;
    this.statusCode = statusCode ?? CONCURRENCY_HTTP_STATUS_MAP[code] ?? 500;
    this.details = details;
    Object.setPrototypeOf(this, StateConcurrencyError.prototype);
  }
}
