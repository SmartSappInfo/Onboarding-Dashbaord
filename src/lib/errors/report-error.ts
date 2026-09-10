/**
 * @fileOverview Error reporting and client-safe error shaping (audit F9).
 *
 * Two problems this addresses, which are really one problem seen from both ends:
 *
 *   1. **Nothing was reported.** Sentry is configured and wired into the build, but
 *      `Sentry.captureException` appeared exactly zero times in the codebase. Failures in
 *      messaging dispatch, the automation processor and webhook handlers were swallowed
 *      into `console.error` and never surfaced — which is why the critical findings in
 *      this audit went unnoticed for so long.
 *   2. **Too much was returned.** 22 API routes and ~378 action sites returned the raw
 *      `error.message` to the caller. Firestore and provider SDK errors routinely embed
 *      collection paths, document ids, project ids and quota details — a free map of the
 *      backend for anyone who can trigger a failure.
 *
 * `reportError` sends the detail to Sentry and the server log; `toClientError` returns an
 * opaque message plus the same correlation id, so a user can quote the id in a support
 * request and an engineer can find the full trace.
 */
import * as Sentry from '@sentry/nextjs';
import crypto from 'crypto';

export interface ClientError {
  /** Safe to show a user. Never contains provider or database detail. */
  message: string;
  /** Ties the user-visible failure to the full server-side trace. */
  correlationId: string;
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/** Short, unambiguous, easy to read over the phone. */
function newCorrelationId(): string {
  return crypto.randomBytes(6).toString('hex');
}

/**
 * Record an error server-side. Returns the correlation id so the caller can hand it back.
 *
 * Never throws: reporting must not be able to turn a handled failure into an unhandled one.
 */
export function reportError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>
): string {
  const correlationId = newCorrelationId();
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error(`[${scope}] (${correlationId})`, err.message, context ?? '');
    Sentry.captureException(err, {
      tags: { scope, correlationId },
      extra: { ...context, correlationId },
    });
  } catch {
    // Reporting is best-effort by definition.
  }
  return correlationId;
}

/**
 * Report an error and shape it for a client response.
 *
 * @example
 *   catch (err) {
 *     return { success: false, ...toClientError('billing.void', err, { invoiceId }) };
 *   }
 */
export function toClientError(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
  publicMessage: string = GENERIC_MESSAGE
): ClientError {
  const correlationId = reportError(scope, error, context);
  return { message: `${publicMessage} (ref: ${correlationId})`, correlationId };
}

/**
 * Convenience for the `{ success: false, error: string }` shape used across this codebase.
 */
export function toClientErrorMessage(
  scope: string,
  error: unknown,
  context?: Record<string, unknown>,
  publicMessage?: string
): string {
  return toClientError(scope, error, context, publicMessage).message;
}
