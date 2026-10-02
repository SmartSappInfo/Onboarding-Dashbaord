/**
 * @fileOverview Canonical Capability Execution Gateway (Phase 1 / PR-4)
 *
 * Implements Rule 16, Rule 18, Rule 19, Rule 20, Rule 21, Rule 22, Rule 23,
 * Rule 31, Rule 48, Rule 52, Rule 68, Rule 69, and Master Roadmap Phase 1 Section 4.2.
 *
 * The single, authoritative entry point through which ALL surfaces
 * (Server Actions, MCP Tools, Cloud Tasks workers, Automations, Agents) invoke capabilities.
 *
 * Enforces the 16-Step Canonical Pipeline:
 *   1. Resolve Principal
 *   2. Lookup Capability (SemVer check)
 *   3. Check Flags & Kill Switches
 *   4. Validate Payload Size (pre-parse byte check)
 *   5. Validate Input (Zod v4 safeParse)
 *   6. Bind Tenant Scope
 *   7. Resolve Resource Scope (existence masking)
 *   8. Authorize Principal (live RBAC & non-delegable check)
 *   9. Verify Human Approval (burn prevention)
 *   10. Check Idempotency & Replay
 *   11. Check Concurrency / TOCTOU
 *   12. Dry Run Simulation
 *   13. Execute Handler (duration timeout + cancellation)
 *   14. Validate Output ("Never trust the tool either")
 *   15. Audit & Event Outbox
 *   16. Return Typed Result
 *
 * NON-NEGOTIABLE INVARIANT (Rule 23, UI §53):
 * Every failure returned or thrown MUST declare `stateChanged: 'no' | 'yes' | 'unknown'`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { randomUUID } from 'node:crypto';
import { sha256Hex } from '../contracts/canonical-json';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
} from '../contracts/capability-definition';
import type { DomainEvent } from '../events/domain-event';
import { getCapability } from '../registry/capability-registry';
import {
  CapabilityError,
} from '../errors/capability-error';
import { toCapabilityError } from '../errors/error-mappers';
import { defaultAuditSink } from '../storage/audit-store';
import { defaultFlagChecker } from '../flags/flag-service';
import { defaultOutboxSink } from '../storage/outbox-store';
import type { ExtendedIdempotencyStore } from '../storage/execution-store';
import type {
  CapabilityInvocation,
  GatewayExecutionFailure,
  GatewayExecutionOutcome,
  GatewayExecutionSuccess,
} from './invocation';
import {
  step01ResolvePrincipal,
  step02LookupCapability,
  step03CheckFlags,
  step04ValidatePayloadSize,
  step05ValidateInput,
  step06BindTenant,
  step07ResolveResourceScope,
  step08AuthorizePrincipal,
  step09VerifyApproval,
  step10CheckIdempotency,
  step11CheckConcurrency,
  step12DryRun,
  step13ExecuteHandler,
  step14ValidateOutput,
  step15AuditAndEvents,
  type ExecutionAuditEntry,
  type FlagChecker,
  type IdempotencyStore,
} from './pipeline';
import type { ApprovalVerifier } from '../policy/approval-verifier';

export interface ExecuteCapabilityDeps {
  registryLookup?: (id: string) => AnyCapabilityDefinition | undefined;
  getPrincipal?: () => Promise<AgentPrincipal | null> | AgentPrincipal | null;
  approvals?: ApprovalVerifier;
  flagChecker?: FlagChecker;
  idempotencyStore?: IdempotencyStore;
  auditSink?: (entry: ExecutionAuditEntry) => Promise<void> | void;
  outboxSink?: (events: DomainEvent[]) => Promise<void> | void;
  verifyActorStanding?: (principal: AgentPrincipal) => Promise<{ active: boolean; reason?: string }>;
  nowMs?: () => number;
  surfaceBudgetMs?: number;
}

/**
 * Public execution entry point. Traverses all 16 pipeline steps.
 * Returns a standardized, typed outcome without throwing unexpected exceptions.
 */
export async function executeCapability<TOutput = unknown>(
  invocation: CapabilityInvocation,
  deps?: ExecuteCapabilityDeps
): Promise<GatewayExecutionOutcome<TOutput>> {
  const nowMs = deps?.nowMs ?? (() => Date.now());
  const startMs = nowMs();
  const executionId = randomUUID();

  let resolvedPrincipal: AgentPrincipal | undefined;
  let resolvedCapability: AnyCapabilityDefinition | undefined;
  let executionContext: CapabilityExecutionContext | undefined;
  let inputHash: string | undefined;

  const idempotencyStore = deps?.idempotencyStore;
  const approvals = deps?.approvals;
  const effectiveAuditSink = deps?.auditSink ?? defaultAuditSink;
  const effectiveOutboxSink = deps?.outboxSink ?? defaultOutboxSink;

  try {
    // 1. Resolve Principal
    resolvedPrincipal = await step01ResolvePrincipal(invocation, {
      getPrincipal: deps?.getPrincipal,
    });

    // 2. Lookup Capability (SemVer check)
    resolvedCapability = step02LookupCapability(
      invocation.capabilityId,
      invocation.version,
      deps?.registryLookup ?? getCapability
    );

    // 3. Check Flags & Kill Switches
    await step03CheckFlags(
      resolvedCapability,
      resolvedPrincipal,
      deps?.flagChecker ?? defaultFlagChecker,
      invocation.surface
    );

    // 4. Validate Payload Size (Pre-parse check)
    step04ValidatePayloadSize(invocation.input, resolvedCapability, invocation.rawPayloadSize);

    // 5. Validate Input (Zod v4)
    const validatedInput = step05ValidateInput(invocation.input, resolvedCapability);
    inputHash = sha256Hex(validatedInput);

    // 6. Bind Tenant Scope
    step06BindTenant(validatedInput, resolvedPrincipal);

    // Build Execution Context
    executionContext = {
      principal: resolvedPrincipal,
      correlationId: invocation.correlationId,
      causationId: invocation.causationId ?? resolvedPrincipal.toolInvocationId,
      idempotencyKey: invocation.idempotencyKey,
      expectedVersion: invocation.expectedVersion,
      dryRun: invocation.dryRun,
      timestamp: new Date(startMs).toISOString(),
    };

    // 7. Resolve Resource Scope (Loads record & prevents existence leakage)
    const resourceScope = await step07ResolveResourceScope(
      validatedInput,
      executionContext,
      resolvedCapability,
      resolvedPrincipal
    );

    // 8. Authorize Principal (RBAC & non-delegable check)
    await step08AuthorizePrincipal(resolvedPrincipal, resolvedCapability, {
      nowMs: nowMs(),
      verifyActorStanding: deps?.verifyActorStanding,
    });

    // 9. Verify Approval (Single-use binding; authority evaluated before this step)
    await step09VerifyApproval(
      resolvedPrincipal,
      resolvedCapability,
      validatedInput,
      {
        approvalId: invocation.approvalId,
        approvals,
        nowMs: nowMs(),
      }
    );

    // 10. Check Idempotency & Replay
    const idempotencyOutcome = await step10CheckIdempotency(
      resolvedCapability,
      invocation.idempotencyKey,
      idempotencyStore,
      nowMs()
    );

    if (idempotencyOutcome.isReplay) {
      const durationMs = Math.max(0, nowMs() - startMs);
      return {
        success: true,
        data: idempotencyOutcome.cachedResult as TOutput,
        executionId,
        correlationId: invocation.correlationId,
        durationMs,
        stateChanged: 'no',
        emittedEvents: [],
      };
    }

    // 11. Check Concurrency / TOCTOU
    step11CheckConcurrency(
      resolvedCapability,
      invocation.expectedVersion,
      resourceScope?.resourceVersion
    );

    // 12. Dry Run Simulation
    const dryRunOutcome = step12DryRun(
      resolvedCapability,
      validatedInput,
      invocation.dryRun
    );

    if (dryRunOutcome.isDryRun) {
      const durationMs = Math.max(0, nowMs() - startMs);
      return {
        success: true,
        data: dryRunOutcome.simulatedResult as TOutput,
        executionId,
        correlationId: invocation.correlationId,
        durationMs,
        stateChanged: 'no',
        emittedEvents: [],
      };
    }

    // 13. Execute Handler (Duration timeout + AbortController)
    const handlerResult = await step13ExecuteHandler(
      resolvedCapability,
      validatedInput,
      executionContext,
      { surfaceBudgetMs: deps?.surfaceBudgetMs }
    );

    // 14. Validate Output ("Never trust the tool either")
    const validatedOutput = step14ValidateOutput(handlerResult.data, resolvedCapability);

    const durationMs = Math.max(0, nowMs() - startMs);
    const stateChanged: 'no' | 'yes' = resolvedCapability.operation === 'read' || resolvedCapability.operation === 'search'
      ? 'no'
      : 'yes';

    // 15. Audit & Event Outbox
    await step15AuditAndEvents(
      resolvedCapability,
      executionContext,
      {
        executionId,
        success: true,
        durationMs,
        stateChanged,
        inputHash,
        emittedEvents: handlerResult.emittedEvents,
      },
      {
        auditSink: effectiveAuditSink,
        outboxSink: effectiveOutboxSink,
      }
    );

    // Complete idempotency lease with cached result
    if (invocation.idempotencyKey && idempotencyStore && 'complete' in idempotencyStore) {
      await (idempotencyStore as ExtendedIdempotencyStore).complete(invocation.idempotencyKey, validatedOutput);
    }

    // 16. Return Typed Result
    return {
      success: true,
      data: validatedOutput as TOutput,
      executionId,
      correlationId: invocation.correlationId,
      durationMs,
      stateChanged,
      emittedEvents: handlerResult.emittedEvents,
      resourceVersion: handlerResult.resourceVersion ?? resourceScope?.resourceVersion,
    };
  } catch (rawError: unknown) {
    const durationMs = Math.max(0, nowMs() - startMs);
    const capError = toCapabilityError(rawError, 'no');

    // If we have capability and principal context, log the audit failure
    if (resolvedCapability && executionContext) {
      await step15AuditAndEvents(
        resolvedCapability,
        executionContext,
        {
          executionId,
          success: false,
          code: capError.code,
          durationMs,
          stateChanged: capError.stateChanged,
          inputHash,
        },
        {
          auditSink: effectiveAuditSink,
        }
      );
    }

    // Fail idempotency lease if claimed
    if (invocation.idempotencyKey && idempotencyStore && 'fail' in idempotencyStore) {
      await (idempotencyStore as ExtendedIdempotencyStore).fail(invocation.idempotencyKey, capError);
    }

    const failure: GatewayExecutionFailure = {
      success: false,
      error: {
        code: capError.code,
        message: capError.message,
        stateChanged: capError.stateChanged,
        retryable: capError.retryable,
        httpStatus: capError.httpStatus,
        details: capError.details,
      },
      executionId,
      correlationId: invocation.correlationId,
      durationMs,
    };

    return failure;
  }
}

/**
 * Convenience helper that executes the capability and throws `CapabilityError` directly on refusal.
 */
export async function executeCapabilityOrThrow<TOutput = unknown>(
  invocation: CapabilityInvocation,
  deps?: ExecuteCapabilityDeps
): Promise<GatewayExecutionSuccess<TOutput>> {
  const result = await executeCapability<TOutput>(invocation, deps);
  if (!result.success) {
    throw new CapabilityError({
      code: result.error.code,
      message: result.error.message,
      stateChanged: result.error.stateChanged,
      retryable: result.error.retryable,
      httpStatus: result.error.httpStatus,
      details: result.error.details,
    });
  }
  return result;
}
