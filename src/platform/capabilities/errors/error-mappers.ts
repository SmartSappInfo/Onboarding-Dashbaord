/**
 * @fileOverview User-Safe Error Mappers (Phase 1 / PR-4)
 *
 * Implements Rule 7, Rule 11, Rule 23, Rule 52, and UI §53.
 *
 * Transforms internal errors into surface-specific representations:
 * - Server Actions: user-safe message, stateChanged ('no' | 'yes' | 'unknown'), code, zero stack/secret leaks.
 * - MCP Tools: MCP SDK v2 text result with isError: true.
 * - HTTP Responses: mapped status code, JSON error envelope.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  CapabilityError,
  defaultHttpStatus,
  isCapabilityError,
  type CapabilityErrorCode,
  type StateChanged,
} from './capability-error';

export interface ServerActionErrorResult {
  success: false;
  error: string;
  code: CapabilityErrorCode | 'UNKNOWN_ERROR';
  stateChanged: StateChanged;
  retryable: boolean;
}

export interface McpToolErrorResult {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

export interface HttpErrorEnvelope {
  status: number;
  body: {
    success: false;
    error: string;
    code: CapabilityErrorCode | 'INTERNAL';
    stateChanged: StateChanged;
    details?: Record<string, unknown>;
  };
}

/**
 * Coerces any caught error into a standardized `CapabilityError`.
 * If already a `CapabilityError`, returns it untouched.
 */
export function toCapabilityError(
  err: unknown,
  fallbackStateChanged: StateChanged = 'unknown'
): CapabilityError {
  if (isCapabilityError(err)) {
    return err;
  }

  if (err instanceof z.ZodError) {
    const issues = err.issues
      .slice(0, 5)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    return CapabilityError.validation(`Invalid data: ${issues}`);
  }

  if (err instanceof Error) {
    // Sanitize common Node/Firestore internal errors
    const isNetworkOrTimeout =
      err.name === 'TimeoutError' ||
      err.name === 'AbortError' ||
      err.message.toLowerCase().includes('timeout') ||
      err.message.toLowerCase().includes('etimedout');

    if (isNetworkOrTimeout) {
      return CapabilityError.timeout(30_000);
    }

    return new CapabilityError({
      code: 'HANDLER_EXCEPTION',
      message: sanitizeErrorMessage(err.message),
      stateChanged: fallbackStateChanged,
      httpStatus: 500,
      retryable: false,
      cause: err,
    });
  }

  return new CapabilityError({
    code: 'INTERNAL',
    message: 'An unexpected internal error occurred.',
    stateChanged: fallbackStateChanged,
    httpStatus: 500,
    retryable: false,
    cause: err,
  });
}

/**
 * Sanitizes raw error messages by stripping internal filesystem paths, stack traces,
 * database connection details, and tokens (Rule 52).
 */
export function sanitizeErrorMessage(rawMessage: string): string {
  if (!rawMessage || typeof rawMessage !== 'string') {
    return 'An unexpected error occurred.';
  }

  let sanitized = rawMessage;

  // Strip absolute Unix / macOS paths
  sanitized = sanitized.replace(/\/(?:Users|home|var|tmp|etc|app|workspace)[^\s:"')]+/gi, '[internal path]');

  // Strip stack trace lines if caught inside message string
  sanitized = sanitized.split('\n')[0]?.trim() || sanitized;

  // Strip potential Bearer tokens, secrets or hashes
  sanitized = sanitized.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED]');
  sanitized = sanitized.replace(/(key|token|secret|password)=([a-zA-Z0-9_\-]+)/gi, '$1=[REDACTED]');

  return sanitized;
}

/**
 * Generates an everyday, plain-English user-facing error message suitable for UI components (Rule 7).
 */
export function toUserFacingMessage(error: CapabilityError): string {
  switch (error.code) {
    case 'UNAUTHENTICATED':
      return 'Please sign in to continue.';
    case 'FORBIDDEN':
      return 'You do not have permission to perform this action.';
    case 'APPROVAL_REQUIRED':
      return 'This action requires administrative approval before it can proceed.';
    case 'NOT_FOUND':
      return error.message || 'The requested item could not be found.';
    case 'DISABLED':
      return 'This feature is currently temporarily disabled.';
    case 'TENANT_SCOPE':
      return 'Access denied: the request targets an item outside your current workspace.';
    case 'VALIDATION':
      return error.message || 'Please check your input and try again.';
    case 'DUPLICATE_IN_PROGRESS':
      return 'This action is already being processed. Please wait a moment.';
    case 'VERSION_CONFLICT':
      return 'This record was modified by another user. Please refresh and try again.';
    case 'TIMEOUT':
      return 'The operation timed out. Please try again in a few moments.';
    case 'PROVIDER_ERROR':
      return 'An external service is temporarily unavailable. Please try again shortly.';
    case 'HANDLER_EXCEPTION':
    case 'INTERNAL':
    default:
      return 'Something went wrong while processing your request. Please try again.';
  }
}

/**
 * Maps any error into a safe Server Action return value (UI §53, Rule 7, Rule 52).
 */
export function toServerActionResult(error: unknown, fallbackStateChanged: StateChanged = 'no'): ServerActionErrorResult {
  const capError = toCapabilityError(error, fallbackStateChanged);
  return {
    success: false,
    error: toUserFacingMessage(capError),
    code: capError.code,
    stateChanged: capError.stateChanged,
    retryable: capError.retryable,
  };
}

/**
 * Maps any error into an MCP SDK v2 tool response (Rule 11, Rule 52).
 */
export function toMcpToolError(error: unknown, fallbackStateChanged: StateChanged = 'no'): McpToolErrorResult {
  const capError = toCapabilityError(error, fallbackStateChanged);
  const text = capError.code === 'UNAUTHENTICATED' || capError.code === 'FORBIDDEN' || capError.code === 'TENANT_SCOPE'
    ? `Access denied: ${capError.message}`
    : `Error [${capError.code}]: ${capError.message}`;

  return {
    content: [{ type: 'text', text }],
    isError: true,
  };
}

/**
 * Maps any error into a standard HTTP status and response body (Rule 51, Rule 69).
 */
export function toHttpError(error: unknown, fallbackStateChanged: StateChanged = 'no'): HttpErrorEnvelope {
  const capError = toCapabilityError(error, fallbackStateChanged);
  return {
    status: capError.httpStatus || defaultHttpStatus(capError.code),
    body: {
      success: false,
      error: capError.message,
      code: capError.code,
      stateChanged: capError.stateChanged,
      details: capError.details,
    },
  };
}
