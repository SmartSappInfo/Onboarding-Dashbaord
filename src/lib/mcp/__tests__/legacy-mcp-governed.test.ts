// @vitest-environment node
/**
 * @fileOverview Legacy MCP registry runs platform capabilities through the gateway
 * (Phase 11 M2 review R1; Rules 16, 17, 51, 64).
 *
 * Before: the synthesized wrapper called `capability.handler()` with a `tools:<id>` scope, so any
 * v1 MCP caller (including API keys) skipped flags, permissions and audit — e.g. the paid
 * `meeting.transcribe_recording` (`defaultEnabled: false`).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

import { McpRegistry } from '../registry';
import { LEGACY_MCP_API_KEY_REFUSAL } from '../legacy-mcp-principal';
import type { McpExecutionContext } from '../types';
import { createCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';

let db: FakeFirestore;
let seen: AgentPrincipal[];

function capability(id: string, permission: string, policies: Partial<AnyCapabilityDefinition['policies']> = {}): AnyCapabilityDefinition {
  return {
    id, version: '1.0.0', name: id, description: `Test ${id}`, domain: 'meetings_conversations', operation: 'read',
    permissions: [permission], workspaceScoped: true, tenantScoped: true,
    risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
    execution: { synchronous: true, maxDurationMs: 2000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 2000 },
    policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: true, defaultEnabled: true, ...policies },
    inputSchema: z.object({ workspaceId: z.string() }),
    outputSchema: z.object({ ok: z.boolean() }),
    handler: async (_input, context) => {
      seen.push(context.principal);
      return { success: true, data: { ok: true }, executionId: 'e', emittedEvents: [], durationMs: 1 };
    },
  };
}

const read = capability('meeting.test_read', 'rbac:operations.meetings.view');
const sensitive = capability('meeting.test_paid', 'rbac:operations.meetings.view', { automatedRequiresExplicitFlag: true });

const store = createCapabilityRegistryStore();
store.register(read);
store.register(sensitive);
const registry = new McpRegistry({ customStore: store });

const base: McpExecutionContext = {
  workspaceId: 'ws-a', organizationId: 'org-1', callerId: 'u-1', callerType: 'user',
  requestId: 'req-1', callDepth: 0, timestamp: '2026-10-05T00:00:00.000Z',
};
const call = (id: string, ctx: Partial<McpExecutionContext> = {}) => {
  const tool = registry.getTool(id);
  if (!tool) throw new Error('not registered');
  return tool.handler({ workspaceId: 'ws-a' }, { ...base, ...ctx });
};

beforeEach(() => {
  db = new FakeFirestore();
  h.db = db;
  seen = [];
  db.write('users/u-1', { organizationId: 'org-1', workspaceIds: ['ws-a'], isAuthorized: true, permissions: ['meetings_manage'] });
  db.write('users/u-noperm', { organizationId: 'org-1', workspaceIds: ['ws-a'], isAuthorized: true, permissions: [] });
  db.write('users/u-pending', { organizationId: 'org-1', workspaceIds: ['ws-a'], isAuthorized: false, permissions: ['meetings_manage'] });
  db.write('users/u-other-ws', { organizationId: 'org-1', workspaceIds: ['ws-b'], isAuthorized: true, permissions: ['meetings_manage'] });
  db.write('users/u-admin', { organizationId: 'org-1', workspaceIds: [], isAuthorized: true, permissions: ['system_admin', 'meetings_manage'] });
});

describe('legacy MCP registry → governed gateway', () => {
  it('refuses API-key callers and points them to the governed v2 endpoint', async () => {
    await expect(call(read.id, { callerType: 'api_key', callerId: 'key-1', apiKeyId: 'key-1' })).rejects.toThrow(LEGACY_MCP_API_KEY_REFUSAL);
    // An "agent" role key is still an API key.
    await expect(call(read.id, { callerType: 'agent', callerId: 'key-2', apiKeyId: 'key-2' })).rejects.toThrow('/api/mcp/v2/');
    expect(seen).toHaveLength(0);
  });

  it('runs as the verified user with their real scopes (no invented tools:<id> scope)', async () => {
    await expect(call(read.id)).resolves.toEqual({ ok: true });
    expect(seen[0].userId).toBe('u-1');
    expect(seen[0].grantedScopes).toContain('rbac:operations.meetings.view');
    expect(seen[0].grantedScopes).not.toContain(`tools:${read.id}`);
    expect(seen[0].effectiveRole).not.toBe('mcp_caller');
  });

  it('refuses a user without the permission, an unapproved user, a non-member and an unknown user', async () => {
    await expect(call(read.id, { callerId: 'u-noperm' })).rejects.toThrow();
    await expect(call(read.id, { callerId: 'u-pending' })).rejects.toThrow('could not be verified');
    await expect(call(read.id, { callerId: 'u-other-ws' })).rejects.toThrow('could not be verified');
    await expect(call(read.id, { callerId: 'ghost' })).rejects.toThrow('could not be verified');
    expect(seen).toHaveLength(0);
  });

  it('refuses a caller from another organization', async () => {
    await expect(call(read.id, { organizationId: 'org-2' })).rejects.toThrow('could not be verified');
  });

  it('internal agent callers act for their user without wildcard scopes', async () => {
    await expect(call(read.id, { callerType: 'agent', callerId: 'u-admin' })).resolves.toEqual({ ok: true });
    expect(seen[0].actorType).toBe('agent');
    expect(seen[0].grantedScopes.some((s) => s.includes('*'))).toBe(false);
  });

  it('enforces flags: a capability that needs explicit MCP enablement is refused', async () => {
    await expect(call(sensitive.id)).rejects.toThrow(/explicit enablement/);
    expect(seen).toHaveLength(0);
  });
});
