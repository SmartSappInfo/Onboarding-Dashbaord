/**
 * Unit tests for bulk multi-workspace management:
 * - bulkLinkEntitiesToWorkspacesCore / bulkLinkEntitiesToWorkspacesAction
 * - bulkUnlinkEntitiesFromWorkspacesCore / bulkUnlinkEntitiesFromWorkspacesAction
 *
 * Verifies idempotency, scope compatibility, multi-tenancy boundaries,
 * batch operations, and permission checks.
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
  FieldValue: {
    arrayUnion: (...values: unknown[]) => ({ __arrayUnion: values }),
    arrayRemove: (...values: unknown[]) => ({ __arrayRemove: values }),
  },
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
    set: async (data: Doc) => {
      col(name).set(id, { ...(col(name).get(id) ?? {}), ...data });
    },
    update: async (patch: Doc) => {
      const cur = col(name).get(id);
      if (!cur) throw new Error(`No document to update: ${name}/${id}`);
      const updated = { ...cur };
      for (const [k, v] of Object.entries(patch)) {
        if (v && typeof v === 'object' && '__arrayUnion' in v) {
          const arr = Array.isArray(updated[k]) ? [...(updated[k] as unknown[])] : [];
          for (const item of (v as { __arrayUnion: unknown[] }).__arrayUnion) {
            if (!arr.includes(item)) arr.push(item);
          }
          updated[k] = arr;
        } else if (v && typeof v === 'object' && '__arrayRemove' in v) {
          const arr = Array.isArray(updated[k]) ? [...(updated[k] as unknown[])] : [];
          const toRemove = (v as { __arrayRemove: unknown[] }).__arrayRemove;
          updated[k] = arr.filter(item => !toRemove.includes(item));
        } else {
          updated[k] = v;
        }
      }
      col(name).set(id, updated);
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
  bulkLinkEntitiesToWorkspacesAction,
  bulkUnlinkEntitiesFromWorkspacesAction,
} from '@/lib/workspace-entity-actions';

const seed = (name: string, id: string, data: Doc) => {
  if (!h.store.has(name)) h.store.set(name, new Map());
  h.store.get(name)!.set(id, data);
};
const read = (name: string, id: string) => h.store.get(name)?.get(id);
const grant = (uid: string, ws: string, actions: string[]) => {
  if (!h.grants.has(uid)) h.grants.set(uid, new Map());
  h.grants.get(uid)!.set(ws, actions);
};

const USER: Session = { uid: 'user_1', workspaceIds: ['ws_1', 'ws_2', 'ws_3'] };

describe('bulk workspace management', () => {
  beforeEach(() => {
    h.session = USER;
    h.grants.clear();
    h.store.clear();

    grant('user_1', 'ws_1', ['view', 'create', 'edit', 'delete']);
    grant('user_1', 'ws_2', ['view', 'create', 'edit', 'delete']);
    grant('user_1', 'ws_3', ['view', 'create', 'edit', 'delete']);

    // Workspaces
    seed('workspaces', 'ws_1', { organizationId: 'org_1', contactScope: 'institution', name: 'HQ Campus' });
    seed('workspaces', 'ws_2', { organizationId: 'org_1', contactScope: 'institution', name: 'Branch Campus' });
    seed('workspaces', 'ws_3', { organizationId: 'org_1', contactScope: 'person', name: 'Alumni Network' });

    // Entities
    seed('entities', 'ent_1', {
      id: 'ent_1',
      name: 'Acme Academy',
      entityType: 'institution',
      organizationId: 'org_1',
      workspaceIds: ['ws_1'],
    });
    seed('entities', 'ent_2', {
      id: 'ent_2',
      name: 'Beacon High',
      entityType: 'institution',
      organizationId: 'org_1',
      workspaceIds: [],
    });
    seed('entities', 'ent_3', {
      id: 'ent_3',
      name: 'John Doe',
      entityType: 'person',
      organizationId: 'org_1',
      workspaceIds: [],
    });

    // Existing workspace entity
    seed('workspace_entities', 'ws_1_ent_1', {
      id: 'ws_1_ent_1',
      workspaceId: 'ws_1',
      entityId: 'ent_1',
      organizationId: 'org_1',
      displayName: 'Acme Academy',
      status: 'active',
    });
  });

  it('links entities to new workspaces and skips already assigned entities (idempotent)', async () => {
    const result = await bulkLinkEntitiesToWorkspacesAction({
      entityIds: ['ent_1', 'ent_2'],
      workspaceIds: ['ws_1', 'ws_2'],
    });

    expect(result.success).toBe(true);
    // ent_1 is already in ws_1 (skipped)
    // ent_1 is linked to ws_2 (assigned)
    // ent_2 is linked to ws_1 (assigned)
    // ent_2 is linked to ws_2 (assigned)
    expect(result.assignedCount).toBe(3);
    expect(result.skippedExistingCount).toBe(1);

    // Verify workspace_entities documents created
    expect(read('workspace_entities', 'ws_2_ent_1')).toBeDefined();
    expect(read('workspace_entities', 'ws_1_ent_2')).toBeDefined();
    expect(read('workspace_entities', 'ws_2_ent_2')).toBeDefined();

    // Verify entities.workspaceIds updated
    const ent1 = read('entities', 'ent_1') as { workspaceIds: string[] };
    expect(ent1.workspaceIds).toContain('ws_1');
    expect(ent1.workspaceIds).toContain('ws_2');

    const ent2 = read('entities', 'ent_2') as { workspaceIds: string[] };
    expect(ent2.workspaceIds).toContain('ws_1');
    expect(ent2.workspaceIds).toContain('ws_2');
  });

  it('skips entities with incompatible scope', async () => {
    // ws_1 has contactScope: 'institution'
    // ent_3 has entityType: 'person'
    const result = await bulkLinkEntitiesToWorkspacesAction({
      entityIds: ['ent_3'],
      workspaceIds: ['ws_1'],
    });

    expect(result.success).toBe(true);
    expect(result.assignedCount).toBe(0);
    expect(result.skippedIncompatibleCount).toBe(1);
    expect(read('workspace_entities', 'ws_1_ent_3')).toBeUndefined();
  });

  it('unlinks entities from target workspaces', async () => {
    // Initially ent_1 is in ws_1
    expect(read('workspace_entities', 'ws_1_ent_1')).toBeDefined();

    const result = await bulkUnlinkEntitiesFromWorkspacesAction({
      entityIds: ['ent_1', 'ent_2'],
      workspaceIds: ['ws_1'],
    });

    expect(result.success).toBe(true);
    expect(read('workspace_entities', 'ws_1_ent_1')).toBeUndefined();

    const ent1 = read('entities', 'ent_1') as { workspaceIds: string[] };
    expect(ent1.workspaceIds).not.toContain('ws_1');
  });

  it('refuses unauthenticated callers', async () => {
    h.session = null;
    await expect(
      bulkLinkEntitiesToWorkspacesAction({
        entityIds: ['ent_2'],
        workspaceIds: ['ws_1'],
      })
    ).rejects.toThrow();
  });
});
