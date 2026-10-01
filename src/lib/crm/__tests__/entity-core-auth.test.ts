/**
 * Entity core + entity Server Actions: authorization (agents_mcp PR-1 / N1).
 *
 * `createEntityAction` / `updateEntityAction` used to take the user id from the caller, skip every
 * permission check for ids starting with `system-`, default the organization to 'smartsapp-hq',
 * accept `data: any`, and update any entity id regardless of workspace. These tests pin the fix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;
interface Session { uid: string; workspaceIds: string[] }

const h = vi.hoisted(() => ({
  session: null as Session | null,
  grants: new Map<string, Map<string, string[]>>(),
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  nextId: 0,
}));

vi.mock('@/lib/auth/require-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-auth')>('@/lib/auth/require-auth');
  const ctx = () => {
    if (!h.session) throw new actual.UnauthorizedError('Not signed in.');
    return { uid: h.session.uid, profile: { name: 'Session User' }, isSystemAdmin: false };
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
    const granted = section === 'operations' && feature === 'campuses' && held.includes(action);
    return granted ? { granted: true } : { granted: false, reason: 'Permission denied' };
  }),
}));

// Side effects and heavy collaborators that these authorization tests don't exercise.
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn(async () => undefined) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/server', () => ({ after: vi.fn() }));
vi.mock('@/lib/industry-cache', () => ({
  getWorkspaceIndustry: vi.fn(async () => ({ industry: 'education', industryScopeLocked: true })),
  invalidateWorkspaceCache: vi.fn(),
}));
vi.mock('@/lib/organization-country', () => ({ resolveOrganizationCountryCode: vi.fn(async () => 'GH') }));
vi.mock('@/lib/entity-duplicate-detection', () => ({ findDuplicateEntities: vi.fn(async () => []) }));
vi.mock('@/lib/contacts/contact-projection-writer', () => ({ syncContactProjectionForWE: vi.fn(async () => undefined) }));
vi.mock('@/lib/automation-processor', () => ({ triggerAutomationProtocols: vi.fn(async () => undefined) }));

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
    set: async (data: Doc, opts?: { merge?: boolean }) => { col(name).set(id, opts?.merge ? { ...(col(name).get(id) ?? {}), ...data } : { ...data }); },
    update: async (patch: Doc) => {
      const cur = col(name).get(id);
      if (!cur) throw new Error(`No document to update: ${name}/${id}`);
      col(name).set(id, { ...cur, ...patch });
    },
    delete: async () => { col(name).delete(id); },
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (field: string, _op: string, value: unknown) => query(name, [...filters, [field, value]]),
    orderBy: () => query(name, filters),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()]
        .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
        .map(([id]) => ({ ...snap(name, id), ref: docRef(name, id) }));
      return { empty: docs.length === 0, size: docs.length, docs, forEach: (cb: (d: unknown) => void) => docs.forEach(cb) };
    },
  });
  type Ref = ReturnType<typeof docRef>;
  const batch = () => {
    const ops: Array<() => Promise<void>> = [];
    return {
      update: (r: Ref, patch: Doc) => { ops.push(() => r.update(patch)); },
      set: (r: Ref, data: Doc, opts?: { merge?: boolean }) => { ops.push(() => r.set(data, opts)); },
      delete: (r: Ref) => { ops.push(() => r.delete()); },
      commit: async () => { for (const op of ops) await op(); },
    };
  };
  return {
    adminDb: {
      collection: (name: string) => ({
        ...query(name, []),
        doc: (id?: string) => docRef(name, id ?? `auto_${++h.nextId}`),
        add: async (data: Doc) => { const id = `auto_${++h.nextId}`; col(name).set(id, { ...data }); return { id }; },
      }),
      batch,
      getAll: async (...refs: Ref[]) => refs.map((r) => snap(r.__col, r.id)),
      runTransaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
        get: (r: Ref) => r.get(),
        set: (r: Ref, d: Doc, o?: { merge?: boolean }) => r.set(d, o),
        update: (r: Ref, d: Doc) => r.update(d),
      }),
    },
  };
});

import { createEntityAction, updateEntityAction } from '@/lib/entity-actions';
import { createEntityCore, updateEntityCore } from '../entity-core';

const seed = (name: string, id: string, data: Doc) => {
  if (!h.store.has(name)) h.store.set(name, new Map());
  h.store.get(name)!.set(id, data);
};
const read = (name: string, id: string) => h.store.get(name)?.get(id);
const grant = (uid: string, ws: string, actions: string[]) => {
  if (!h.grants.has(uid)) h.grants.set(uid, new Map());
  h.grants.get(uid)!.set(ws, actions);
};
const writesTo = (name: string) => h.store.get(name)?.size ?? 0;

const EDITOR: Session = { uid: 'editor_a', workspaceIds: ['ws_a'] };
const VIEWER: Session = { uid: 'viewer_a', workspaceIds: ['ws_a'] };

describe('entity authorization (N1)', () => {
  beforeEach(() => {
    h.session = null;
    h.grants.clear();
    h.store.clear();
    h.nextId = 0;
    grant('editor_a', 'ws_a', ['view', 'create', 'edit']);
    grant('viewer_a', 'ws_a', ['view']);
    seed('workspaces', 'ws_a', { organizationId: 'org_a', industry: 'education' });
    seed('workspaces', 'ws_b', { organizationId: 'org_b', industry: 'education' });
    seed('entities', 'ent_a', { name: 'A', entityType: 'institution', organizationId: 'org_a' });
    seed('workspace_entities', 'ws_a_ent_a', { workspaceId: 'ws_a', entityId: 'ent_a', displayName: 'A' });
    seed('entities', 'ent_b', { name: 'B', entityType: 'institution', organizationId: 'org_b' });
    seed('workspace_entities', 'ws_b_ent_b', { workspaceId: 'ws_b', entityId: 'ent_b', displayName: 'B' });
  });

  describe('Server Actions', () => {
    it('refuse anonymous callers and foreign workspaces before any write', async () => {
      await expect(createEntityAction({ data: { name: 'X' }, workspaceId: 'ws_a', entityType: 'institution' })).rejects.toThrow();
      h.session = EDITOR;
      await expect(createEntityAction({ data: { name: 'X' }, workspaceId: 'ws_b', entityType: 'institution' })).rejects.toThrow();
      await expect(updateEntityAction({ entityId: 'ent_b', data: { name: 'pwned' }, workspaceId: 'ws_b' })).rejects.toThrow();
      expect(read('entities', 'ent_b')?.name).toBe('B');
    });

    it('need campuses:create / campuses:edit (the old system- bypass is gone)', async () => {
      h.session = VIEWER;
      expect(await createEntityAction({ data: { name: 'X' }, workspaceId: 'ws_a', entityType: 'institution' })).toMatchObject({ success: false, error: 'Permission denied' });
      expect(await updateEntityAction({ entityId: 'ent_a', data: { name: 'Y' }, workspaceId: 'ws_a' })).toMatchObject({ success: false, error: 'Permission denied' });

      // A user whose uid merely starts with 'system-' gets no special treatment.
      expect(await createEntityCore({ kind: 'user', uid: 'system-import' }, { data: { name: 'X' }, workspaceId: 'ws_a', entityType: 'institution' }))
        .toMatchObject({ success: false, error: 'Permission denied' });
      expect(read('entities', 'ent_a')?.name).toBe('A');
    });

    it('validate the payload at the boundary', async () => {
      h.session = EDITOR;
      expect(await updateEntityAction({ entityId: 'ent_a', data: { name: 42 }, workspaceId: 'ws_a' })).toMatchObject({ success: false, error: 'Invalid entity details.' });
      expect(await createEntityAction({ data: 'not an object', workspaceId: 'ws_a', entityType: 'institution' })).toMatchObject({ success: false });
    });

    it('never update an entity that is not linked to the workspace', async () => {
      h.session = EDITOR;
      const res = await updateEntityAction({ entityId: 'ent_b', data: { name: 'pwned' }, workspaceId: 'ws_a' });
      expect(res).toMatchObject({ success: false, error: 'Entity not found.' });
      expect(read('entities', 'ent_b')?.name).toBe('B');
    });

    it('update a linked entity for a permitted user', async () => {
      h.session = EDITOR;
      expect(await updateEntityAction({ entityId: 'ent_a', data: { name: 'Renamed' }, workspaceId: 'ws_a' })).toMatchObject({ success: true });
      expect(read('entities', 'ent_a')?.name).toBe('Renamed');
    });

    it('create in the workspace\'s own organization', async () => {
      h.session = EDITOR;
      const res = await createEntityAction({ data: { name: 'New School' }, workspaceId: 'ws_a', entityType: 'institution', forceCreate: true });
      expect(res).toMatchObject({ success: true });
      const created = res.success && 'id' in res && typeof res.id === 'string' ? read('entities', res.id) : undefined;
      expect(created).toMatchObject({ organizationId: 'org_a' });
    });
  });

  describe('core with a service actor', () => {
    const service = { kind: 'service', service: 'forms', workspaceId: 'ws_a' } as const;

    it('is refused outside its workspace', async () => {
      const before = writesTo('entities');
      expect(await createEntityCore(service, { data: { name: 'X' }, workspaceId: 'ws_b', entityType: 'person' })).toMatchObject({ success: false });
      expect(await updateEntityCore(service, { entityId: 'ent_b', data: { name: 'pwned' }, workspaceId: 'ws_b' })).toMatchObject({ success: false });
      expect(writesTo('entities')).toBe(before);
      expect(read('entities', 'ent_b')?.name).toBe('B');
    });

    it('works inside its workspace without a session (anonymous form submissions)', async () => {
      expect(await updateEntityCore(service, { entityId: 'ent_a', data: { name: 'From form' }, workspaceId: 'ws_a' })).toMatchObject({ success: true });
      expect(read('entities', 'ent_a')?.name).toBe('From form');
    });
  });
});
