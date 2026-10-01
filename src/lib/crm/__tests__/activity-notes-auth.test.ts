/**
 * Activity + note actions: authorization (agents_mcp PR-1 / N1).
 *
 * `getActivitiesForContactCore` was a public endpoint (any contact's timeline), `logNoteActivity`
 * and `getEntityAiSummary` were unguarded (the latter an unmetered AI call), and `updateNote` /
 * `deleteNote` let any signed-in user change any activity (the Admin SDK bypasses rules).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Doc = Record<string, unknown>;
interface Session { uid: string; workspaceIds: string[] }

const h = vi.hoisted(() => ({
  session: null as Session | null,
  viewers: new Map<string, string[]>(),
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  logged: [] as Array<Record<string, unknown>>,
  aiCalls: 0,
}));

vi.mock('@/lib/auth/require-auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth/require-auth')>('@/lib/auth/require-auth');
  const ctx = () => {
    if (!h.session) throw new actual.UnauthorizedError('Not signed in.');
    return { uid: h.session.uid, profile: { name: 'Session Name' }, isSystemAdmin: false };
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
  canUser: vi.fn(async (uid: string, _s: string, _f: string, action: string, workspaceId?: string) =>
    action === 'view' && workspaceId && (h.viewers.get(uid) ?? []).includes(workspaceId)
      ? { granted: true }
      : { granted: false, reason: 'Permission denied' }),
}));
vi.mock('@/lib/activity-logger', () => ({ logActivity: vi.fn(async (entry: Record<string, unknown>) => { h.logged.push(entry); }) }));
vi.mock('@/ai/flows/entity-summarizer', () => ({ summarizeEntityNotesFlow: vi.fn(async () => { h.aiCalls++; return { summary: 'ok' }; }) }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

vi.mock('@/lib/firebase-admin', () => {
  const col = (name: string) => {
    if (!h.store.has(name)) h.store.set(name, new Map());
    return h.store.get(name)!;
  };
  const snap = (name: string, id: string) => {
    const data = col(name).get(id);
    return { id, exists: Boolean(data), data: () => data, get: (f: string) => data?.[f] };
  };
  const docRef = (name: string, id: string) => ({
    id,
    get: async () => snap(name, id),
    update: async (patch: Doc) => { col(name).set(id, { ...(col(name).get(id) ?? {}), ...patch }); },
    delete: async () => { col(name).delete(id); },
  });
  const query = (name: string, filters: Array<[string, unknown]>) => ({
    where: (f: string, _op: string, v: unknown) => query(name, [...filters, [f, v]]),
    orderBy: () => query(name, filters),
    limit: () => query(name, filters),
    get: async () => {
      const docs = [...col(name).entries()].filter(([, d]) => filters.every(([f, v]) => d[f] === v)).map(([id]) => snap(name, id));
      return { empty: docs.length === 0, docs };
    },
  });
  return { adminDb: { collection: (name: string) => ({ ...query(name, []), doc: (id: string) => docRef(name, id) }) } };
});

import { getActivitiesForContact, updateNote, deleteNote } from '@/lib/activity-actions';
import { logNoteActivity, getEntityAiSummary } from '@/lib/note-actions';
import type { EntityNote } from '@/lib/types';

const seed = (name: string, id: string, data: Doc) => {
  if (!h.store.has(name)) h.store.set(name, new Map());
  h.store.get(name)!.set(id, data);
};
const read = (name: string, id: string) => h.store.get(name)?.get(id);
const note: Omit<EntityNote, 'id'> = {
  entityId: 'ent_a', workspaceId: 'ws_a', content: 'hello', noteType: 'general',
  createdBy: 'someone_else', createdByName: 'Spoofed', createdAt: '', updatedAt: '',
};

describe('activity and note authorization (N1)', () => {
  beforeEach(() => {
    h.session = null;
    h.viewers.clear();
    h.store.clear();
    h.logged.length = 0;
    h.aiCalls = 0;
    h.viewers.set('alice', ['ws_a']);
    seed('workspaces', 'ws_a', { organizationId: 'org_a' });
    seed('workspace_entities', 'ws_a_ent_a', { workspaceId: 'ws_a', entityId: 'ent_a' });
    seed('activities', 'act_alice', { workspaceId: 'ws_a', entityId: 'ent_a', userId: 'alice', metadata: { content: 'mine' }, timestamp: '1' });
    seed('activities', 'act_bob', { workspaceId: 'ws_a', entityId: 'ent_a', userId: 'bob', metadata: { content: 'his' }, timestamp: '2' });
  });

  it('reads a timeline only with workspace access and view permission', async () => {
    await expect(getActivitiesForContact('ent_a', 'ws_a')).rejects.toThrow();
    h.session = { uid: 'mallory', workspaceIds: ['ws_a'] }; // member without view permission
    expect(await getActivitiesForContact('ent_a', 'ws_a')).toEqual([]);
    h.session = { uid: 'alice', workspaceIds: ['ws_a'] };
    expect(await getActivitiesForContact('ent_a', 'ws_a')).toHaveLength(2);
  });

  it('lets only the author edit or delete a note activity', async () => {
    h.session = { uid: 'alice', workspaceIds: ['ws_a'] };
    expect(await updateNote('act_bob', 'pwned')).toHaveProperty('error');
    expect(await deleteNote('act_bob')).toHaveProperty('error');
    expect(read('activities', 'act_bob')).toMatchObject({ metadata: { content: 'his' } });

    expect(await updateNote('act_alice', 'edited')).toMatchObject({ success: true });
    expect(read('activities', 'act_alice')?.['metadata.content']).toBe('edited');
    expect(await deleteNote('act_alice')).toMatchObject({ success: true });
    expect(read('activities', 'act_alice')).toBeUndefined();
  });

  it('logs notes as the session user in the workspace\'s organization', async () => {
    await expect(logNoteActivity(note)).rejects.toThrow();
    h.session = { uid: 'alice', workspaceIds: ['ws_a'] };
    await logNoteActivity(note);
    expect(h.logged).toEqual([expect.objectContaining({ userId: 'alice', displayName: 'Session Name', organizationId: 'org_a' })]);

    // An entity not linked to the workspace is not logged.
    await logNoteActivity({ ...note, entityId: 'ent_other' });
    expect(h.logged).toHaveLength(1);
  });

  it('runs the AI summary only for permitted users', async () => {
    h.session = { uid: 'mallory', workspaceIds: ['ws_a'] };
    expect(await getEntityAiSummary([], undefined, 'ws_a')).toMatchObject({ success: false });
    expect(h.aiCalls).toBe(0);
    h.session = { uid: 'alice', workspaceIds: ['ws_a'] };
    expect(await getEntityAiSummary([], undefined, 'ws_a')).toMatchObject({ success: true });
    expect(h.aiCalls).toBe(1);
  });
});
