/**
 * @fileOverview One governed entry point for internal callers (Phase 11 M0 · T3, finding F3/B6).
 *
 * WHY
 * Workflow steps, sagas, the Genkit tool adapter and the agent loop called `capability.handler()`
 * directly, skipping flags, tenant binding, resource scope, live standing, approvals, idempotency,
 * audit and the outbox. Every internal caller now goes through `executeCapability` via this helper.
 *
 * CONTRACT
 * - The caller supplies the surface and a principal it has already authenticated; the gateway
 *   re-checks everything (Rule 51: defence in depth).
 * - Refusals are classified so callers retry only transient failures (Rule 23):
 *   `retryable` (timeouts, provider errors, in-flight duplicates), `authority` (never retried),
 *   `invalid` (input/output contract violations, never retried).
 *
 * CAUTION: never add a bypass flag here. Tests needing a fake gateway inject `deps`.
 *
 * Tests: src/platform/__tests__/gates/invoke-governed.test.ts
 */

import type { AgentPrincipal, AnyCapabilityDefinition } from '../contracts/capability-definition';
import { getCapability } from '../registry/capability-registry';
import { executeCapability, type ExecuteCapabilityDeps } from './execute-capability';
import type { GatewayExecutionOutcome, InvocationSurface } from './invocation';

export interface GovernedInvocation {
  capabilityId: string;
  surface: InvocationSurface;
  input: unknown;
  principal: AgentPrincipal;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  approvalId?: string;
  expectedVersion?: string | number;
  dryRun?: boolean;
  /**
   * The exact definition the caller already resolved (from the registry in production). The gateway
   * runs every step against it; it is used only when its id matches the requested capability.
   */
  capability?: AnyCapabilityDefinition;
}

export type RefusalClass = 'retryable' | 'authority' | 'invalid';

const AUTHORITY_CODES = new Set([
  'UNAUTHENTICATED', 'FORBIDDEN', 'AUTHORIZATION_DENIED', 'ACTOR_REVOKED', 'TENANT_SCOPE', 'TENANT_SCOPE_VIOLATION',
  'NOT_FOUND', 'DISABLED', 'APPROVAL_REQUIRED', 'APPROVAL_MISMATCH', 'CAPABILITY_NOT_REGISTERED', 'CAPABILITY_VERSION_MISMATCH',
  'VERSION_CONFLICT',
]);
const INVALID_CODES = new Set(['VALIDATION', 'INVALID_INPUT', 'INVALID_OUTPUT']);

export function classifyRefusal(code: string, retryable: boolean | undefined): RefusalClass {
  if (AUTHORITY_CODES.has(code)) return 'authority';
  if (INVALID_CODES.has(code)) return 'invalid';
  if (retryable === false && code !== 'INTERNAL' && code !== 'HANDLER_EXCEPTION') return 'invalid';
  return 'retryable';
}

export async function invokeGoverned<TOutput = unknown>(
  invocation: GovernedInvocation,
  deps?: ExecuteCapabilityDeps
): Promise<GatewayExecutionOutcome<TOutput>> {
  return executeCapability<TOutput>(
    {
      capabilityId: invocation.capabilityId,
      surface: invocation.surface,
      input: invocation.input,
      principal: invocation.principal,
      correlationId: invocation.correlationId,
      ...(invocation.causationId ? { causationId: invocation.causationId } : {}),
      ...(invocation.idempotencyKey ? { idempotencyKey: invocation.idempotencyKey } : {}),
      ...(invocation.approvalId ? { approvalId: invocation.approvalId } : {}),
      ...(invocation.expectedVersion !== undefined ? { expectedVersion: invocation.expectedVersion } : {}),
      ...(invocation.dryRun ? { dryRun: true } : {}),
    },
    invocation.capability
      ? {
          ...deps,
          registryLookup: (id: string) =>
            id === invocation.capability?.id ? invocation.capability : (deps?.registryLookup ?? getCapability)(id),
        }
      : deps
  );
}
