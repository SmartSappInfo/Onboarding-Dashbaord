/**
 * @fileOverview Canonical Capability Error Contract (Phase 1 / PR-4)
 *
 * Implements Rule 2, Rule 4, Rule 23, Rule 52, Rule 68, and Roadmap Phase 1 Section 4.2.
 *
 * NON-NEGOTIABLE INVARIANT (UI §53, Rule 23):
 * Every error emitted from the capability execution pipeline MUST carry:
 *   `stateChanged: 'no' | 'yes' | 'unknown'`
 *
 * Pre-execution refusals (Steps 1–12) are ALWAYS `stateChanged: 'no'`.
 * Timeouts during execution (Step 13) are ALWAYS `stateChanged: 'unknown'`.
 * Output validation failures (Step 14) inherit handler mutation status or default to `'unknown'`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

export type StateChanged = 'no' | 'yes' | 'unknown';

export type CapabilityErrorCode =
  // Primary Refusal Classes
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'DISABLED'
  | 'VALIDATION'
  | 'TENANT_SCOPE'
  | 'FORBIDDEN'
  | 'APPROVAL_REQUIRED'
  | 'DUPLICATE_IN_PROGRESS'
  | 'VERSION_CONFLICT'
  | 'TIMEOUT'
  | 'PROVIDER_ERROR'
  | 'HANDLER_EXCEPTION'
  | 'INTERNAL'
  // Canonical Refusal Subcodes (PRD §73 / Tools §4)
  | 'CAPABILITY_NOT_REGISTERED'
  | 'CAPABILITY_VERSION_MISMATCH'
  | 'TENANT_SCOPE_VIOLATION'
  | 'INVALID_INPUT'
  | 'AUTHORIZATION_DENIED'
  | 'ACTOR_REVOKED'
  | 'APPROVAL_VERIFIER_UNAVAILABLE'
  | 'APPROVAL_MISMATCH'
  | 'INVALID_OUTPUT';

export interface CapabilityErrorOptions {
  code: CapabilityErrorCode;
  message: string;
  stateChanged: StateChanged;
  retryable?: boolean;
  httpStatus?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class CapabilityError extends Error {
  readonly code: CapabilityErrorCode;
  readonly stateChanged: StateChanged;
  readonly retryable: boolean;
  readonly httpStatus: number;
  readonly details?: Record<string, unknown>;

  constructor(options: CapabilityErrorOptions) {
    super(options.message);
    this.name = 'CapabilityError';
    this.code = options.code;
    this.stateChanged = options.stateChanged;
    this.retryable = options.retryable ?? false;
    this.httpStatus = options.httpStatus ?? defaultHttpStatus(options.code);
    this.details = options.details;
    if (options.cause) {
      this.cause = options.cause;
    }

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, CapabilityError.prototype);
  }

  // ── Factory helpers enforcing correct stateChanged invariants ──

  static unauthenticated(message = 'Authentication required.'): CapabilityError {
    return new CapabilityError({
      code: 'UNAUTHENTICATED',
      message,
      stateChanged: 'no',
      httpStatus: 401,
      retryable: false,
    });
  }

  static notFound(message = 'Requested capability or resource was not found.'): CapabilityError {
    return new CapabilityError({
      code: 'NOT_FOUND',
      message,
      stateChanged: 'no',
      httpStatus: 404,
      retryable: false,
    });
  }

  static disabled(message = 'Capability is disabled by operational flag or kill switch.'): CapabilityError {
    return new CapabilityError({
      code: 'DISABLED',
      message,
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
    });
  }

  static validation(message: string, details?: Record<string, unknown>): CapabilityError {
    return new CapabilityError({
      code: 'VALIDATION',
      message,
      stateChanged: 'no',
      httpStatus: 400,
      retryable: false,
      details,
    });
  }

  static tenantScope(message = 'The request targets an organization or workspace outside caller scope.'): CapabilityError {
    return new CapabilityError({
      code: 'TENANT_SCOPE',
      message,
      stateChanged: 'no',
      httpStatus: 400,
      retryable: false,
    });
  }

  static forbidden(message = 'Access denied: caller does not possess required authority.'): CapabilityError {
    return new CapabilityError({
      code: 'FORBIDDEN',
      message,
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
    });
  }

  static approvalRequired(approvalRequestId?: string, message = 'Operation requires verified human approval.'): CapabilityError {
    return new CapabilityError({
      code: 'APPROVAL_REQUIRED',
      message,
      stateChanged: 'no',
      httpStatus: 403,
      retryable: false,
      details: approvalRequestId ? { approvalRequestId } : undefined,
    });
  }

  static duplicateInProgress(leaseExpiresAt?: string): CapabilityError {
    return new CapabilityError({
      code: 'DUPLICATE_IN_PROGRESS',
      message: `An identical execution is already in progress${leaseExpiresAt ? ` (leased until ${leaseExpiresAt})` : ''}.`,
      stateChanged: 'no',
      httpStatus: 409,
      retryable: true,
      details: leaseExpiresAt ? { leaseExpiresAt } : undefined,
    });
  }

  static versionConflict(currentVersion?: string | number): CapabilityError {
    return new CapabilityError({
      code: 'VERSION_CONFLICT',
      message: 'Resource version conflict: target record has been modified by another operation.',
      stateChanged: 'no',
      httpStatus: 409,
      retryable: false,
      details: currentVersion !== undefined ? { currentVersion } : undefined,
    });
  }

  static timeout(ms: number): CapabilityError {
    return new CapabilityError({
      code: 'TIMEOUT',
      message: `Capability handler exceeded execution duration limit (${ms} ms).`,
      stateChanged: 'unknown',
      httpStatus: 503,
      retryable: true,
      details: { timeoutMs: ms },
    });
  }

  static handlerException(message: string, stateChanged: StateChanged = 'unknown', cause?: unknown): CapabilityError {
    return new CapabilityError({
      code: 'HANDLER_EXCEPTION',
      message,
      stateChanged,
      httpStatus: 500,
      retryable: false,
      cause,
    });
  }

  static internal(message: string, stateChanged: StateChanged = 'unknown', cause?: unknown): CapabilityError {
    return new CapabilityError({
      code: 'INTERNAL',
      message,
      stateChanged,
      httpStatus: 500,
      retryable: false,
      cause,
    });
  }
}

export function isCapabilityError(value: unknown): value is CapabilityError {
  return value instanceof CapabilityError;
}

export function defaultHttpStatus(code: CapabilityErrorCode): number {
  switch (code) {
    case 'UNAUTHENTICATED':
      return 401;
    case 'FORBIDDEN':
    case 'APPROVAL_REQUIRED':
    case 'DISABLED':
    case 'AUTHORIZATION_DENIED':
    case 'ACTOR_REVOKED':
    case 'APPROVAL_VERIFIER_UNAVAILABLE':
    case 'APPROVAL_MISMATCH':
      return 403;
    case 'NOT_FOUND':
    case 'CAPABILITY_NOT_REGISTERED':
    case 'CAPABILITY_VERSION_MISMATCH':
      return 404;
    case 'VALIDATION':
    case 'TENANT_SCOPE':
    case 'TENANT_SCOPE_VIOLATION':
    case 'INVALID_INPUT':
      return 400;
    case 'DUPLICATE_IN_PROGRESS':
    case 'VERSION_CONFLICT':
      return 409;
    case 'TIMEOUT':
    case 'PROVIDER_ERROR':
      return 503;
    case 'HANDLER_EXCEPTION':
    case 'INTERNAL':
    case 'INVALID_OUTPUT':
    default:
      return 500;
  }
}
