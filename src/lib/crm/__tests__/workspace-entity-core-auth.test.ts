/**
 * Workspace-entity core + Server Actions: authorization (agents_mcp PR-1 / N1).
 *
 * Link / update / bulk archive / bulk delete / ensure-shared had no check at all, and unlink /
 * archive / delete trusted a caller-supplied user id and entity id. These tests pin the fix:
 * session identity, checks against each record's STORED workspace, delete needs campuses:delete,
 * organization-wide variants only reach permitted workspaces, and services are pinned.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;
interface Session { uid: string; workspaceIds: string[] }

const h = vi.hoisted(() => ({
  session: null as Session | null,
  grants: new Map<string, Map<string, string[]>>(),
  store: new Map<string, Map<string, Record<string, unknown>>>(),
}));

vi.mock('@/lib/auth/require-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-auth')>('@/lib/auth/require-auth');
  const ctx = () => {
    if (!h.session) throw new actual.UnauthorizedError('Not signed in.');
    return { uid: h.session.uid, profile: { name: 'Session User', email: 's@example.com' }, isSystemAdmin: false };
  };
  return {
    ...actual,
    requireAuth: vi.fn(async () => ctx()),
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      const c = ctx();
      if (!h.session?.workspaceIds.includes(workspaceId)) throw new actual.ForbiddenError('No access to this workspace.');
      return c;
    }),
  };
});
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async (uid: string, section: string, feature: string, action: string, workspaceId?: string) => {
    const held = workspaceId ? h.grants.get(uid)?.get(workspaceId) ?? [] : [];
    return section === 'operations' && feature === 'campuses' && held.includes(action)
      ? { granted: true }
      : { granted: false, reason: 'Permission denied' };
  }),
}));
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock('@/lib/entity-audit', () => ({
  logWorkspaceEntityCreated: vi.fn(async () => undefined),
  logWorkspaceEntityUpdated: vi.fn(async () => undefined),
  logWorkspaceEntityDeleted: vi.fn(async () => undefined),
}));
vi.mock('@/lib/contacts/contact-projection-writer', () => ({
  syncContactProjectionForWE: vi.fn(async () => undefined),
  deleteContactProjectionForEntity: vi.fn(async () => undefined),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('firebase-admin/firestore', () => ({
  FieldValue: { arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }) },
}));

vi.mock('@/lib/firebase-admin', () => {
  const col = (name: string) => {
    if (!h.store.has(name)) h.store.set(name, new Map());
    return h.store.get(name)!;
  };
  const snap = (name: string, id: string) => {
    const data = col(name).get(id);
    return { id, exists: Boolean(data), data: () => data, get: (field: string) => data?.[field] };
  };
  const docRef = (name: string, id: string) => ({
    id,
    __col: name,
    get: async () => snap(name, id),
    set: async (data: Doc) => { col(name).set(id, { ...(col(name).get(id) ?? {}), ...data }); },
    update: async (patch: Doc) => {
      const cur = col(name).get(id);
      if (!cur) throw new Error(`No document to update: ${name}/${id}`);
      col(name).set(id, { ...cur, ...patch });
    },
    delete: async () => { col(name).delete(id); },
  });
  type Ref = ReturnType<typeof docRef>;
  const query = (name: string, filters: Array<[string, string, unknown]>) => ({
    where: (field: string, op: string, value: unknown) => query(name, [...filters, [field, op, value]]),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, op, v]) => (op === 'in' && Array.isArray(v) ? v.includes(d[f]) : d[f] === v)))
        .map(([id]) => ({ ...snap(name, id), ref: docRef(name, id) }));
      return { empty: docs.length === 0, size: docs.length, docs, forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
    },
  });
  return {
    adminDb: {
      collection: (name: string) => ({ ...query(name, []), doc: (id: string) => docRef(name, id) }),
      getAll: async (...refs: Ref[]) => refs.map((r) => snap(r.__col, r.id)),
      batch: () => {
        const ops: Array<() => Promise<void>> = [];
        return {
          update: (r: Ref, patch: Doc) => { ops.push(() => r.update(patch)); },
          set: (r: Ref, data: Doc) => { ops.push(() => r.set(data)); },
          delete: (r: Ref) => { ops.push(() => r.delete()); },
          commit: async () => { for (const op of ops) await op(); },
        };
      },
    },
  };
});

import {
  archiveEntityAction,
  bulkDeleteEntitiesAction,
  deleteEntityPermanentlyAction,
  linkEntityToWorkspaceAction,
  updateWorkspaceEntityAction,
} from '@/lib/workspace-entity-actions';
import { ensureEntitySharedToWorkspace, linkEntityToWorkspaceCore } from '../workspace-entity-core';

const seed = (name: string, id: string, data: Doc) => {
  if (!h.store.has(name)) h.store.set(name, new Map());
  h.store.get(name)!.set(id, data);
};
const read = (name: string, id: string) => h.store.get(name)?.get(id);
const grant = (uid: string, ws: string, actions: string[]) => {
  if (!h.grants.has(uid)) h.grants.set(uid, new Map());
  h.grants.get(uid)!.set(ws, actions);
};

const EDITOR: Session = { uid: 'editor', workspaceIds: ['ws_a', 'ws_c'] };
const ADMIN: Session = { uid: 'admin', workspaceIds: ['ws_a'] };

describe('workspace-entity authorization (N1)', () => {
  beforeEach(() => {
    h.session = null;
    h.grants.clear();
    h.store.clear();
    grant('editor', 'ws_a', ['view', 'create', 'edit']);
    grant('editor', 'ws_c', ['view']);
    grant('admin', 'ws_a', ['view', 'create', 'edit', 'delete']);
    for (const ws of ['ws_a', 'ws_b', 'ws_c']) seed('workspaces', ws, { organizationId: ws === 'ws_b' ? 'org_b' : 'org_a', contactScope: 'institution' });
    seed('entities', 'ent_a', { name: 'A', entityType: 'institution', organizationId: 'org_a' });
    seed('entities', 'ent_b', { name: 'B', entityType: 'institution', organizationId: 'org_b' });
    seed('workspace_entities', 'ws_a_ent_a', { workspaceId: 'ws_a', entityId: 'ent_a', organizationId: 'org_a', status: 'active', displayName: 'A' });
    seed('workspace_entities', 'ws_c_ent_a', { workspaceId: 'ws_c', entityId: 'ent_a', organizationId: 'org_a', status: 'active', displayName: 'A' });
    seed('workspace_entities', 'ws_b_ent_b', { workspaceId: 'ws_b', entityId: 'ent_b', organizationId: 'org_b', status: 'archived', displayName: 'B' });
  });

  it('refuses anonymous callers', async () => {
    await expect(updateWorkspaceEntityAction({ workspaceEntityId: 'ws_a_ent_a', status: 'archived' })).rejects.toThrow();
    await expect(linkEntityToWorkspaceAction({ entityId: 'ent_a', workspaceId: 'ws_a' })).rejects.toThrow();
    expect(read('workspace_entities', 'ws_a_ent_a')?.status).toBe('active');
  });

  it('checks the record\'s stored workspace, not the request', async () => {
    h.session = EDITOR;
    expect(await updateWorkspaceEntityAction({ workspaceEntityId: 'ws_b_ent_b', workspaceTags: ['x'] })).toMatchObject({ success: false });
    expect(read('workspace_entities', 'ws_b_ent_b')?.workspaceTags).toBeUndefined();
    expect(await updateWorkspaceEntityAction({ workspaceEntityId: 'ws_a_ent_a', workspaceTags: ['x'] })).toMatchObject({ success: true });
    expect(read('workspace_entities', 'ws_a_ent_a')?.workspaceTags).toEqual(['x']);
  });

  it('archives using the record\'s entity, and only in permitted workspaces', async () => {
    h.session = EDITOR;
    // The request names another tenant's entity; the record's own entity is used instead.
    const res = await archiveEntityAction({ workspaceEntityId: 'ws_a_ent_a', entityId: 'ent_b', archiveAllWorkspaces: true });
    expect(res).toMatchObject({ success: true });
    expect(read('workspace_entities', 'ws_a_ent_a')?.status).toBe('archived');
    expect(read('workspace_entities', 'ws_c_ent_a')?.status).toBe('active'); // editor can only view ws_c
    expect(read('workspace_entities', 'ws_b_ent_b')?.status).toBe('archived'); // untouched (already archived)
  });

  it('needs campuses:delete for permanent deletes, and keeps the root while memberships remain', async () => {
    seed('workspace_entities', 'ws_a_ent_a', { workspaceId: 'ws_a', entityId: 'ent_a', organizationId: 'org_a', status: 'archived', displayName: 'A' });
    h.session = EDITOR;
    expect(await deleteEntityPermanentlyAction({ workspaceEntityId: 'ws_a_ent_a', entityId: 'ent_a', deleteAllWorkspaces: true })).toMatchObject({ success: false });
    expect(read('workspace_entities', 'ws_a_ent_a')).toBeDefined();

    h.session = ADMIN;
    expect(await deleteEntityPermanentlyAction({ workspaceEntityId: 'ws_a_ent_a', entityId: 'ent_b', deleteAllWorkspaces: true })).toMatchObject({ success: true, rootEntityDeleted: false });
    expect(read('workspace_entities', 'ws_a_ent_a')).toBeUndefined();
    expect(read('workspace_entities', 'ws_c_ent_a')).toBeDefined(); // admin has no rights in ws_c
    expect(read('entities', 'ent_a')).toBeDefined(); // still a member of ws_c
    expect(read('entities', 'ent_b')).toBeDefined(); // the request's entity id is ignored
  });

  it('bulk delete skips ids stored in other workspaces', async () => {
    seed('workspace_entities', 'ws_a_ent_a', { workspaceId: 'ws_a', entityId: 'ent_a', organizationId: 'org_a', status: 'archived', displayName: 'A' });
    h.session = ADMIN;
    const res = await bulkDeleteEntitiesAction({ workspaceId: 'ws_a', workspaceEntityIds: ['ws_a_ent_a', 'ws_b_ent_b'] });
    expect(res).toMatchObject({ success: true, count: 1 });
    expect(read('workspace_entities', 'ws_b_ent_b')).toBeDefined();
    expect(read('entities', 'ent_b')).toBeDefined();
  });

  it('pins services to their workspace when linking or sharing', async () => {
    const service = { kind: 'service', service: 'surveys', workspaceId: 'ws_a' } as const;
    seed('entities', 'ent_new', { name: 'N', entityType: 'institution', organizationId: 'org_a' });
    expect(await linkEntityToWorkspaceCore(service, { entityId: 'ent_new', workspaceId: 'ws_c', userId: '' })).toMatchObject({ success: false });
    expect(await ensureEntitySharedToWorkspace(service, { entityId: 'ent_new', targetWorkspaceId: 'ws_c' })).toMatchObject({ success: false });
    expect(read('workspace_entities', 'ws_c_ent_new')).toBeUndefined();

    // A caller-supplied organization can't widen the tenant boundary.
    const crossOrg = await ensureEntitySharedToWorkspace({ kind: 'service', service: 'surveys', workspaceId: 'ws_b' }, { entityId: 'ent_a', targetWorkspaceId: 'ws_b', organizationId: 'org_a' });
    expect(crossOrg).toMatchObject({ success: false });
    expect(read('workspace_entities', 'ws_b_ent_a')).toBeUndefined();

    expect(await ensureEntitySharedToWorkspace(service, { entityId: 'ent_new', targetWorkspaceId: 'ws_a' })).toMatchObject({ success: true });
    expect(read('workspace_entities', 'ws_a_ent_new')).toMatchObject({ workspaceId: 'ws_a', entityId: 'ent_new' });
  });
});
