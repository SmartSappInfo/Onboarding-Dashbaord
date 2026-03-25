/**
 * Custom error classes and error message dictionary for the contact tagging system.
 * Requirements: NFR4.2, NFR3.1
 */

// ─── Custom Error Classes ────────────────────────────────────────────────────

export class TagValidationError extends Error {
  readonly code = 'TAG_VALIDATION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'TagValidationError';
  }
}

export class TagPermissionError extends Error {
  readonly code = 'TAG_PERMISSION_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'TagPermissionError';
  }
}

export class TagConflictError extends Error {
  readonly code = 'TAG_CONFLICT_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'TagConflictError';
  }
}

export class TagNotFoundError extends Error {
  readonly code = 'TAG_NOT_FOUND_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'TagNotFoundError';
  }
}

export class TagNetworkError extends Error {
  readonly code = 'TAG_NETWORK_ERROR';
  constructor(message: string) {
    super(message);
    this.name = 'TagNetworkError';
  }
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export type TagErrorCode =
  | 'TAG_VALIDATION_ERROR'
  | 'TAG_PERMISSION_ERROR'
  | 'TAG_CONFLICT_ERROR'
  | 'TAG_NOT_FOUND_ERROR'
  | 'TAG_NETWORK_ERROR'
  | 'TAG_SYSTEM_TAG'
  | 'TAG_DUPLICATE_NAME'
  | 'TAG_INVALID_NAME'
  | 'TAG_CONTACT_NOT_FOUND'
  | 'TAG_UNKNOWN_ERROR';

// ─── User-Friendly Error Messages ────────────────────────────────────────────

export const TAG_ERROR_MESSAGES: Record<TagErrorCode, string> = {
  TAG_VALIDATION_ERROR: 'The tag information provided is invalid. Please check your input and try again.',
  TAG_PERMISSION_ERROR: 'You don\'t have permission to perform this action. Contact your administrator.',
  TAG_CONFLICT_ERROR: 'A tag with this name already exists. Please choose a different name.',
  TAG_NOT_FOUND_ERROR: 'The tag could not be found. It may have been deleted.',
  TAG_NETWORK_ERROR: 'A network error occurred. Please check your connection and try again.',
  TAG_SYSTEM_TAG: 'System tags cannot be modified or deleted.',
  TAG_DUPLICATE_NAME: 'A tag with this name already exists in your workspace.',
  TAG_INVALID_NAME: 'Tag name contains invalid characters. Use letters, numbers, spaces, hyphens, or underscores.',
  TAG_CONTACT_NOT_FOUND: 'The contact could not be found. It may have been deleted.',
  TAG_UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

/**
 * Maps a raw error message or error instance to a user-friendly message.
 */
export function getUserFriendlyErrorMessage(error: unknown): string {
  if (error instanceof TagValidationError) return error.message;
  if (error instanceof TagPermissionError) return error.message;
  if (error instanceof TagConflictError) return error.message;
  if (error instanceof TagNotFoundError) return error.message;
  if (error instanceof TagNetworkError) return error.message;

  if (typeof error === 'string') {
    if (error.includes('permission') || error.includes('Permission')) return TAG_ERROR_MESSAGES.TAG_PERMISSION_ERROR;
    if (error.includes('already exists') || error.includes('duplicate')) return TAG_ERROR_MESSAGES.TAG_DUPLICATE_NAME;
    if (error.includes('not found') || error.includes('Not Found')) return TAG_ERROR_MESSAGES.TAG_NOT_FOUND_ERROR;
    if (error.includes('system tag') || error.includes('System tag')) return TAG_ERROR_MESSAGES.TAG_SYSTEM_TAG;
    if (error.includes('invalid') || error.includes('Invalid')) return TAG_ERROR_MESSAGES.TAG_VALIDATION_ERROR;
    if (error.includes('network') || error.includes('fetch') || error.includes('UNAVAILABLE')) return TAG_ERROR_MESSAGES.TAG_NETWORK_ERROR;
    return error;
  }

  if (error instanceof Error) {
    return getUserFriendlyErrorMessage(error.message);
  }

  return TAG_ERROR_MESSAGES.TAG_UNKNOWN_ERROR;
}

/**
 * Returns true if the error is a transient/network error that can be retried.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof TagValidationError) return false;
  if (error instanceof TagPermissionError) return false;
  if (error instanceof TagConflictError) return false;
  if (error instanceof TagNetworkError) return true;

  const msg = error instanceof Error ? error.message : String(error);
  const retryablePatterns = [
    'UNAVAILABLE',
    'DEADLINE_EXCEEDED',
    'RESOURCE_EXHAUSTED',
    'INTERNAL',
    'network',
    'fetch',
    'timeout',
    'connection',
    'ECONNRESET',
    'ETIMEDOUT',
  ];
  return retryablePatterns.some(p => msg.toLowerCase().includes(p.toLowerCase()));
}
