/**
 * Retry logic for transient failures in tag operations.
 * Requirements: NFR1.1
 */

import { isRetryableError } from './tag-errors';

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  onRetry?: (attempt: number, error: unknown) => void;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 500;

/**
 * Wraps an async function with retry logic.
 * - Retries up to maxAttempts times on transient/network errors.
 * - Does NOT retry on validation or permission errors.
 * - Uses exponential backoff between attempts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry non-transient errors
      if (!isRetryableError(error)) {
        throw error;
      }

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        break;
      }

      options.onRetry?.(attempt, error);

      // Exponential backoff: 500ms, 1000ms, 2000ms, ...
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Wraps a server action result (success/error pattern) with retry logic.
 * Retries when the result has success=false and the error looks transient.
 */
export async function withRetryAction<T extends { success: boolean; error?: string }>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const baseDelayMs = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;

  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      lastResult = result;

      // If successful, return immediately
      if (result.success) return result;

      // Check if the error is retryable
      if (!result.error || !isRetryableError(result.error)) {
        return result;
      }

      // Don't retry on the last attempt
      if (attempt === maxAttempts) {
        break;
      }

      options.onRetry?.(attempt, result.error);

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (error) {
      // If the function itself throws (not just returns error), use withRetry behavior
      if (!isRetryableError(error) || attempt === maxAttempts) {
        throw error;
      }

      options.onRetry?.(attempt, error);
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return lastResult!;
}
