/**
 * @fileOverview Pipeline Step 13: Execute Handler (Phase 1 / PR-4)
 *
 * Implements Rule 23 (Resource Governance), Rule 24 (Circuit Breakers),
 * Rule 26 (Cancellation Semantics), PRD §73, and Tools §4.
 *
 * Invokes the canonical capability handler bounded by a strict duration timeout.
 *
 * NON-NEGOTIABLE INVARIANT (UI §53, Rule 23):
 * If execution times out after dispatch, `stateChanged` MUST be `'unknown'` (never 'failed' or 'no'),
 * because the asynchronous database write or remote API call may still be committing in the background.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import type {
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
  CapabilityExecutionSuccess,
} from '../../contracts/capability-definition';
import {
  CapabilityError,
  isCapabilityError,
  type CapabilityErrorCode,
} from '../../errors/capability-error';

export interface ExecuteHandlerOptions {
  surfaceBudgetMs?: number;
}

class StepExecutionTimeoutError extends Error {
  readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`Capability handler exceeded execution timeout of ${timeoutMs} ms.`);
    this.name = 'StepExecutionTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

async function runWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new StepExecutionTimeoutError(timeoutMs));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export async function step13ExecuteHandler(
  capability: AnyCapabilityDefinition,
  validatedInput: unknown,
  context: CapabilityExecutionContext,
  options?: ExecuteHandlerOptions
): Promise<CapabilityExecutionSuccess<unknown>> {
  const declaredTimeout = capability.execution.timeoutMs ?? capability.execution.maxDurationMs ?? 30_000;
  const timeoutMs = options?.surfaceBudgetMs
    ? Math.min(declaredTimeout, options.surfaceBudgetMs)
    : declaredTimeout;

  let result;
  try {
    result = await runWithTimeout(
      capability.handler(validatedInput, context),
      timeoutMs
    );
  } catch (err: unknown) {
    if (err instanceof StepExecutionTimeoutError) {
      throw CapabilityError.timeout(err.timeoutMs);
    }

    if (isCapabilityError(err)) {
      throw err;
    }

    const message = err instanceof Error ? err.message : 'Capability handler threw an exception.';
    throw CapabilityError.handlerException(message, 'unknown', err);
  }

  if (!result.success) {
    const errorDetails = typeof result.error.details === 'object' && result.error.details !== null
      ? (result.error.details as Record<string, unknown>)
      : undefined;

    throw new CapabilityError({
      code: (result.error.code as CapabilityErrorCode) || 'HANDLER_EXCEPTION',
      message: result.error.message,
      stateChanged: result.error.stateChanged ?? 'unknown',
      retryable: result.error.retryable ?? false,
      details: errorDetails,
    });
  }

  return result;
}
