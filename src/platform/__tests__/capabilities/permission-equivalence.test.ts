// @vitest-environment node
/**
 * @fileOverview Permission equivalence in the gateway (Phase 11 M0 · T4, finding F7 follow-through).
 *
 * Capabilities declare legacy alias permissions (`sales:pipeline:edit`, `app:deals_edit`,
 * `deal:stage_update`) that the vocabulary (`permission-refs.ts`) defines as synonyms of one
 * canonical coordinate (`rbac:operations.pipeline.edit`). Matching was exact-string only, so no
 * agent persona (which holds canonical `rbac:` scopes) could ever run `deal.advance_stage`.
 * A required permission is now satisfied by an exact grant OR a grant with the same canonical
 * coordinate, from DECLARED synonyms only: the loose `tools:` heuristic never counts.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import { canonicalPermissionKey } from '../../capabilities/contracts/permission-refs';
import { evaluatePrincipalAuthority } from '../../capabilities/policy/principal-evaluator';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

const advanceStage: AnyCapabilityDefinition = {
  id: 'test.advance_stage', version: '1.0.0', name: 'Advance', description: 'Advance a deal', domain: 'deals_revenue', operation: 'update',
  inputSchema: z.object({ workspaceId: z.string() }), outputSchema: z.object({ ok: z.boolean() }),
  permissions: ['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update'], workspaceScoped: true, tenantScoped: true,
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: { synchronous: true, maxDurationMs: 1000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1000 },
  policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
  handler: async () => ({ success: true, data: { ok: true }, executionId: 'e', emittedEvents: [], durationMs: 1 }),
};
const person = (grantedScopes: string[]): AgentPrincipal => ({ actorType: 'user', userId: 'u', organizationId: 'o', workspaceId: 'ws', grantedScopes, effectiveRole: 'member' });
const target = { organizationId: 'o', workspaceId: 'ws' };

describe('permission equivalence', () => {
  it('declared aliases share one canonical key; the loose tools: heuristic has none', () => {
    const key = canonicalPermissionKey('rbac:operations.pipeline.edit');
    expect(key).toBe('rbac:operations.pipeline.edit');
    expect(canonicalPermissionKey('sales:pipeline:edit')).toBe(key);
    expect(canonicalPermissionKey('app:deals_edit')).toBe(key);
    expect(canonicalPermissionKey('deal:stage_update')).toBe(key);
    expect(canonicalPermissionKey('tools:deal.update_stage')).toBeNull();
    expect(canonicalPermissionKey('custom:not_in_vocabulary')).toBeNull();
  });

  it('a canonical grant satisfies every alias of the same coordinate', () => {
    expect(evaluatePrincipalAuthority(person(['rbac:operations.pipeline.edit']), advanceStage, target, {}).allowed).toBe(true);
  });

  it('a different coordinate (view instead of edit) does not', () => {
    const res = evaluatePrincipalAuthority(person(['rbac:operations.pipeline.view']), advanceStage, target, {});
    expect(res.allowed).toBe(false);
  });

  it('a tools: grant is never treated as a synonym', () => {
    expect(evaluatePrincipalAuthority(person(['tools:deal.update_stage']), advanceStage, target, {}).allowed).toBe(false);
  });

  it('exact alias grants still work as before', () => {
    expect(evaluatePrincipalAuthority(person(['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update']), advanceStage, target, {}).allowed).toBe(true);
  });
});
