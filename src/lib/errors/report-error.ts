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

/**
 * Narrow an `unknown` caught value to a message (audit F11).
 *
 * `catch (e: unknown)` disables type checking for everything reached through `e`, so a typo
 * like `e.mesage` compiles and silently yields `undefined`. Catch clauses should bind
 * `unknown` and narrow here instead.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return 'Unexpected error';
}

/** Provider SDKs commonly carry a string `code`; read it without widening to `any`. */
export function getErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === 'string') return c;
    if (typeof c === 'number') return String(c);
  }
  return undefined;
}

/** DOMException / AbortError style discrimination without widening to `any`. */
export function getErrorName(error: unknown): string | undefined {
  if (error instanceof Error) return error.name;
  if (error && typeof error === 'object' && 'name' in error) {
    const n = (error as { name?: unknown }).name;
    if (typeof n === 'string') return n;
  }
  return undefined;
}

/** HTTP-ish status carried by fetch/SDK errors, for retry decisions. */
export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const s = (error as { status?: unknown }).status;
    if (typeof s === 'number') return s;
    if (typeof s === 'string' && s.trim() !== '' && !Number.isNaN(Number(s))) return Number(s);
  }
  return undefined;
}

/** gRPC-style numeric code (Firestore, Cloud Tasks), distinct from the string `code`. */
export function getErrorNumericCode(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const c = (error as { code?: unknown }).code;
    if (typeof c === 'number') return c;
  }
  return undefined;
}

export function getErrorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
