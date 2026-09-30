/**
 * mcp-governance-actions: authorization (agents_mcp PR-1 / N2).
 *
 * These actions used to take `userId` / `organizationId` from the caller, and their access check
 * could never deny (swapped arguments, result object tested as a boolean). Anyone could mint API
 * keys, change approval policies, adjudicate approvals and run tools as another user. These tests
 * pin the fix: identity from the session, organization from the workspace, systemSettings
 * view/edit, record-level workspace checks, no self-approval, and refusals reach no service.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listMcpToolsAction,
  executeMcpToolAction,
  listPendingApprovalsAction,
  adjudicateApprovalAction,
  listMcpApiKeysAction,
  createMcpApiKeyAction,
  revokeMcpApiKeyAction,
  listMcpAuditLogsAction,
  upsertMcpApprovalPolicyAction,
} from '../actions/mcp-governance-actions';

interface Session { uid: string; workspaceIds: string[]; isSystemAdmin: boolean; systemSettings: 'none' | 'view' | 'edit' }

const h = vi.hoisted(() => ({
  session: null as Session | null,
  workspaces: new Map<string, Record<string, unknown>>(),
  approvals: new Map<string, Record<string, unknown>>(),
  keys: new Map<string, Record<string, unknown>>(),
  calls: [] as Array<{ fn: string; args: unknown }>,
}));

// Service stub that records its call (hoisted so the vi.mock factories below can use it).
const record = vi.hoisted(() => (fn: string) => async (args: unknown) => { h.calls.push({ fn, args }); return {}; });

vi.mock('@/lib/auth/require-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-auth')>('@/lib/auth/require-auth');
  return {
    ...actual,
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      if (!h.session) throw new actual.UnauthorizedError('Not signed in.');
      if (!h.session.isSystemAdmin && !h.session.workspaceIds.includes(workspaceId)) {
        throw new actual.ForbiddenError('No access to this workspace.');
      }
      return { uid: h.session.uid, profile: {}, isSystemAdmin: h.session.isSystemAdmin };
    }),
  };
});
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async (_uid: string, section: string, feature: string, action: string) => {
    const s = h.session;
    const level = s?.isSystemAdmin ? 'edit' : s?.systemSettings ?? 'none';
    const ok = section === 'management' && feature === 'systemSettings' &&
      (action === 'view' ? level !== 'none' : level === 'edit');
    return { granted: ok };
  }),
}));
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: () => ({
      doc: (id: string) => ({
        get: async () => {
          const data = h.workspaces.get(id);
          return { exists: Boolean(data), get: (field: string) => data?.[field] };
        },
      }),
    }),
  },
}));
vi.mock('@/lib/errors/report-error', () => ({
  toClientErrorMessage: (_scope: string, _err: unknown, _ctx: unknown, fallback: string) => fallback,
}));

vi.mock('../registry', () => ({ globalMcpRegistry: { getToolDescriptors: () => [] } }));
vi.mock('../tools', () => ({ registerAllCoreTools: () => undefined }));
vi.mock('../gateway', () => ({
  McpGateway: { handleRequest: async (req: unknown, ctx: unknown) => { h.calls.push({ fn: 'gateway', args: ctx }); return { jsonrpc: '2.0', id: 1, result: req }; } },
}));
vi.mock('../api-key-service', () => ({
  McpApiKeyService: {
    listApiKeys: async () => { h.calls.push({ fn: 'listApiKeys', args: null }); return []; },
    createApiKey: record('createApiKey'),
    getApiKeyById: async (id: string) => h.keys.get(id) ?? null,
    revokeApiKey: async (keyId: string, by: string) => { h.calls.push({ fn: 'revokeApiKey', args: { keyId, by } }); },
  },
}));
vi.mock('../approval-engine', () => ({
  McpApprovalEngine: {
    listApprovalPolicies: async () => [],
    listApprovals: async () => { h.calls.push({ fn: 'listApprovals', args: null }); return []; },
    getApprovalById: async (id: string) => h.approvals.get(id) ?? null,
    adjudicate: record('adjudicate'),
    upsertApprovalPolicy: record('upsertApprovalPolicy'),
  },
}));
vi.mock('../audit-logger', () => ({
  McpAuditLogger: { listAuditLogs: async (_ws: string, limit: number) => { h.calls.push({ fn: 'listAuditLogs', args: limit }); return []; } },
}));

const WS = 'ws_a';
const ADMIN: Session = { uid: 'admin_a', workspaceIds: [WS], isSystemAdmin: false, systemSettings: 'edit' };
const VIEWER: Session = { uid: 'viewer_a', workspaceIds: [WS], isSystemAdmin: false, systemSettings: 'view' };
const MEMBER: Session = { uid: 'member_a', workspaceIds: [WS], isSystemAdmin: false, systemSettings: 'none' };
const ROOT: Session = { uid: 'root', workspaceIds: [], isSystemAdmin: true, systemSettings: 'edit' };

const reads = (workspaceId = WS) => [
  () => listMcpToolsAction({ workspaceId }),
  () => listPendingApprovalsAction({ workspaceId }),
  () => listMcpApiKeysAction({ workspaceId }),
  () => listMcpAuditLogsAction({ workspaceId }),
];
const writes = (workspaceId = WS) => [
  () => executeMcpToolAction({ workspaceId, toolName: 'task.create', inputArguments: {} }),
  () => adjudicateApprovalAction({ workspaceId, approvalId: 'appr_other', decision: 'approved' }),
  () => createMcpApiKeyAction({ workspaceId, name: 'Key', role: 'admin' }),
  () => revokeMcpApiKeyAction({ workspaceId, keyId: 'key_a' }),
  () => upsertMcpApprovalPolicyAction({ workspaceId, toolName: 'task.create', requiresApproval: true, enabled: true }),
];

describe('mcp-governance-actions authorization', () => {
  beforeEach(() => {
    h.session = null;
    h.calls.length = 0;
    h.workspaces.clear();
    h.approvals.clear();
    h.keys.clear();
    h.workspaces.set(WS, { organizationId: 'org_a' });
    h.workspaces.set('ws_b', { organizationId: 'org_b' });
    h.approvals.set('appr_other', { workspaceId: WS, status: 'pending', callerId: 'someone_else' });
    h.keys.set('key_a', { workspaceId: WS });
  });

  it('refuses every action without a session, before any service call', async () => {
    for (const call of [...reads(), ...writes()]) {
      expect(await call()).toMatchObject({ success: false, code: 'unauthenticated' });
    }
    expect(h.calls).toEqual([]);
  });

  it('refuses a workspace the caller does not belong to', async () => {
    h.session = ADMIN;
    for (const call of [...reads('ws_b'), ...writes('ws_b')]) {
      expect(await call()).toMatchObject({ success: false, code: 'unauthorized' });
    }
    expect(h.calls).toEqual([]);
  });

  it('refuses members without systemSettings access', async () => {
    h.session = MEMBER;
    for (const call of [...reads(), ...writes()]) {
      expect(await call()).toMatchObject({ success: false, code: 'unauthorized' });
    }
    expect(h.calls).toEqual([]);
  });

  it('lets systemSettings viewers read but not change anything', async () => {
    h.session = VIEWER;
    for (const call of reads()) expect((await call()).success).toBe(true);
    for (const call of writes()) expect(await call()).toMatchObject({ success: false, code: 'unauthorized' });
    expect(h.calls.map((c) => c.fn).sort()).toEqual(['listApiKeys', 'listApprovals', 'listAuditLogs']);
  });

  it('mints keys and policies for the workspace\'s own organization, as the session user', async () => {
    h.session = ADMIN;
    await createMcpApiKeyAction({ workspaceId: WS, name: 'Key', role: 'agent' });
    await upsertMcpApprovalPolicyAction({ workspaceId: WS, toolName: 't', requiresApproval: false, enabled: true });

    expect(h.calls).toEqual([
      { fn: 'createApiKey', args: expect.objectContaining({ workspaceId: WS, organizationId: 'org_a', createdBy: 'admin_a' }) },
      { fn: 'upsertApprovalPolicy', args: expect.objectContaining({ workspaceId: WS, organizationId: 'org_a', updatedBy: 'admin_a' }) },
    ]);
  });

  it('runs tools as the session user in the workspace\'s organization', async () => {
    h.session = ADMIN;
    await executeMcpToolAction({ workspaceId: WS, toolName: 'task.create', inputArguments: {} });
    expect(h.calls).toEqual([
      { fn: 'gateway', args: expect.objectContaining({ workspaceId: WS, organizationId: 'org_a', callerId: 'admin_a', callerType: 'user' }) },
    ]);
  });

  it('only revokes keys of this workspace', async () => {
    h.session = ADMIN;
    h.keys.set('key_b', { workspaceId: 'ws_b' });
    expect(await revokeMcpApiKeyAction({ workspaceId: WS, keyId: 'key_b' })).toMatchObject({ success: false, code: 'not_found' });
    expect(await revokeMcpApiKeyAction({ workspaceId: WS, keyId: 'key_a' })).toMatchObject({ success: true });
    expect(h.calls).toEqual([{ fn: 'revokeApiKey', args: { keyId: 'key_a', by: 'admin_a' } }]);
  });

  it('adjudicates only pending approvals of this workspace, never the caller\'s own', async () => {
    h.session = ADMIN;
    h.approvals.set('appr_foreign', { workspaceId: 'ws_b', status: 'pending', callerId: 'x' });
    h.approvals.set('appr_own', { workspaceId: WS, status: 'pending', callerId: 'admin_a' });
    h.approvals.set('appr_done', { workspaceId: WS, status: 'approved', callerId: 'x' });
    const decide = (approvalId: string) => adjudicateApprovalAction({ workspaceId: WS, approvalId, decision: 'approved' });

    expect(await decide('appr_foreign')).toMatchObject({ success: false, code: 'not_found' });
    expect(await decide('appr_own')).toMatchObject({ success: false, error: 'You cannot approve your own request.' });
    expect(await decide('appr_done')).toMatchObject({ success: false, code: 'validation_error' });
    expect(await decide('appr_other')).toMatchObject({ success: true });
    expect(h.calls).toEqual([{ fn: 'adjudicate', args: expect.objectContaining({ approvalId: 'appr_other', adjudicatedBy: 'admin_a' }) }]);
  });

  it('keeps the backoffice platform console for system admins only', async () => {
    h.session = { ...ADMIN, workspaceIds: [WS, 'platform_backoffice'] };
    expect(await listMcpToolsAction({ workspaceId: 'platform_backoffice' })).toMatchObject({ success: false, code: 'unauthorized' });

    h.session = ROOT;
    await executeMcpToolAction({ workspaceId: 'platform_backoffice', toolName: 't', inputArguments: {} });
    expect(h.calls).toEqual([{ fn: 'gateway', args: expect.objectContaining({ organizationId: 'platform_org', callerId: 'root' }) }]);
  });

  it('bounds audit log reads', async () => {
    h.session = VIEWER;
    await listMcpAuditLogsAction({ workspaceId: WS, limit: 10_000 });
    expect(h.calls).toEqual([{ fn: 'listAuditLogs', args: 200 }]);
  });
});
