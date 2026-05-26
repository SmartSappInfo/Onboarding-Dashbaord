/**
 * Typed automation errors — map to safe client messages (operational vs unexpected).
 */

export type AutomationErrorCode =
  | 'AUTOMATION_VALIDATION'
  | 'AUTOMATION_PERMISSION'
  | 'AUTOMATION_NOT_FOUND'
  | 'AUTOMATION_UNAUTHORIZED'
  | 'AUTOMATION_INTERNAL';

export class AutomationError extends Error {
  readonly code: AutomationErrorCode;
  readonly isOperational: boolean;

  constructor(code: AutomationErrorCode, message: string, isOperational = true) {
    super(message);
    this.name = 'AutomationError';
    this.code = code;
    this.isOperational = isOperational;
  }
}

export class AutomationValidationError extends AutomationError {
  constructor(message: string) {
    super('AUTOMATION_VALIDATION', message);
    this.name = 'AutomationValidationError';
  }
}

export class AutomationPermissionError extends AutomationError {
  constructor(message: string) {
    super('AUTOMATION_PERMISSION', message);
  }
}

export class AutomationNotFoundError extends AutomationError {
  constructor(message = 'Automation not found.') {
    super('AUTOMATION_NOT_FOUND', message);
    this.name = 'AutomationNotFoundError';
  }
}

const GENERIC_MESSAGE = 'Something went wrong while saving the automation. Please try again.';

/**
 * Maps errors to messages safe to return to the admin UI.
 */
export function toAutomationClientError(error: unknown): string {
  if (error instanceof AutomationError && error.isOperational) {
    return error.message;
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('permission') || msg.includes('not have permission')) {
      return error.message;
    }
    if (msg.includes('not found')) {
      return error.message;
    }
    if (msg.includes('must include') || msg.includes('requires')) {
      return error.message;
    }
  }
  return GENERIC_MESSAGE;
}

export function assertAutomationUserId(userId: string | undefined | null): asserts userId is string {
  if (!userId?.trim()) {
    throw new AutomationError('AUTOMATION_UNAUTHORIZED', 'Authentication required.', true);
  }
}
