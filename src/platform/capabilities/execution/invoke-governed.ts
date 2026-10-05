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
 * PINNED DEFINITIONS (review R8, Rules 12/14): a caller may pass the definition it already resolved,
 * but when the registry holds that id the pin must be the same object or govern identically (same
 * version, fingerprint, policies, execution limits and scoping). Otherwise the call is refused with
 * CAPABILITY_VERSION_MISMATCH and nothing runs, so a stale or edited copy can never weaken the
 * reviewed definition. An id the registry doesn't hold may be pinned: it impersonates nothing, and
 * every gateway check still runs against it (callers with in-process handlers gain no authority).
 *
 * CAUTION: never add a bypass flag here. Tests needing a fake gateway inject `deps`.
 *
 * Tests: src/platform/__tests__/gates/invoke-governed.test.ts
 */

import type { AgentPrincipal, AnyCapabilityDefinition } from '../contracts/capability-definition';
import { getCapability } from '../registry/capability-registry';
import { sha256Hex } from '../contracts/canonical-json';
import { computeToolFingerprint } from '../../mcp/security/tool-fingerprint-types';
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

/** Everything the gateway decides with: identity, fingerprint (schemas, description, permissions, risk) and policy. */
export function governanceDigest(def: AnyCapabilityDefinition): string {
  const fingerprint = computeToolFingerprint(def, { organizationId: 'digest', workspaceId: 'digest' }, 'digest', '1970-01-01T00:00:00.000Z').compositeHash;
  return sha256Hex({
    fingerprint,
    version: def.version,
    domain: def.domain,
    operation: def.operation,
    workspaceScoped: def.workspaceScoped,
    tenantScoped: def.tenantScoped,
    policies: def.policies,
    execution: def.execution,
  });
}

export async function invokeGoverned<TOutput = unknown>(
  invocation: GovernedInvocation,
  deps?: ExecuteCapabilityDeps
): Promise<GatewayExecutionOutcome<TOutput>> {
  const pinned = invocation.capability;
  if (pinned && pinned.id === invocation.capabilityId) {
    const registered = (deps?.registryLookup ?? getCapability)(pinned.id);
    if (registered && registered !== pinned && governanceDigest(registered) !== governanceDigest(pinned)) {
      return {
        success: false,
        error: {
          code: 'CAPABILITY_VERSION_MISMATCH',
          message: `The definition supplied for '${pinned.id}' differs from the registered one. Reload it from the registry.`,
          stateChanged: 'no',
          retryable: false,
          httpStatus: 409,
          details: { registeredVersion: registered.version, pinnedVersion: pinned.version },
        },
        executionId: `refused_${invocation.correlationId}`,
        correlationId: invocation.correlationId,
        durationMs: 0,
      };
    }
  }
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
