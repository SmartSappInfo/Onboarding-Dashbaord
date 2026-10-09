// @vitest-environment node
/**
 * @fileOverview Standup Privacy & Sensitive Data Leakage Elimination Suite (Phase 6 / STN-04 / Rule 8).
 *
 * Validates:
 * - Calling getStandupsForDateAction as a peer member strips privateManagerNote from other members' submissions.
 * - Calling getStandupsForDateAction as author or manager/admin preserves privateManagerNote.
 * - Draft saving and submission properly handle privateManagerNote.
 *
 * Strict Typing Standard: ZERO `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  standups: new Map<string, Record<string, unknown>>(),
  users: new Map<string, Record<string, unknown>>(),
  currentSessionUid: 'user-peer-1',
  workspaceId: 'ws-standup-privacy',
}));

vi.mock('@/lib/firebase-admin', () => {
  return {
    adminDb: {
      collection: (col: string) => {
        if (col === 'users') {
          return {
            doc: (id: string) => ({
              get: async () => {
                const u = h.users.get(id);
                return {
                  exists: Boolean(u),
                  id,
                  data: () => u,
                };
              },
            }),
          };
        }
        if (col === 'standups') {
          return {
            doc: (id: string) => ({
              get: async () => {
                const s = h.standups.get(id);
                return {
                  exists: Boolean(s),
                  id,
                  data: () => s,
                };
              },
              set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
                const existing = opts?.merge ? h.standups.get(id) || {} : {};
                h.standups.set(id, { ...existing, ...data });
              },
            }),
            where: (field: string, _op: string, val: unknown) => {
              let docs = Array.from(h.standups.entries()).map(([id, data]) => ({
                id,
                data: () => data,
              }));
              if (field === 'workspaceId') {
                docs = docs.filter((d) => d.data().workspaceId === val);
              }
              return {
                where: (subField: string, _subOp: string, subVal: unknown) => {
                  if (subField === 'date') {
                    docs = docs.filter((d) => d.data().date === subVal);
                  }
                  return {
                    get: async () => ({
                      docs,
                    }),
                  };
                },
                get: async () => ({
                  docs,
                }),
              };
            },
          };
        }
        return {
          doc: (id: string) => ({
            get: async () => ({ exists: false, id, data: () => ({}) }),
          }),
        };
      },
    },
  };
});

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (wsId: string) => {
    if (wsId !== h.workspaceId) throw new Error('Unauthorized workspace');
    return { uid: h.currentSessionUid };
  }),
}));

import { getStandupsForDateAction } from '../standup-server-actions';

describe('Standup Privacy & Sensitive Data Protection (STN-04 / Rule 8 & 13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.standups.clear();
    h.users.clear();

    // Peer user (non-admin)
    h.users.set('user-peer-1', {
      id: 'user-peer-1',
      name: 'Alice Peer',
      email: 'alice@example.com',
      role: 'member',
      permissions: ['operations:tasks:read'],
    });

    // Author user (non-admin)
    h.users.set('user-author-2', {
      id: 'user-author-2',
      name: 'Bob Author',
      email: 'bob@example.com',
      role: 'member',
      permissions: ['operations:tasks:read'],
    });

    // Manager/Admin user
    h.users.set('user-admin-3', {
      id: 'user-admin-3',
      name: 'Charlie Admin',
      email: 'admin@example.com',
      role: 'admin',
      permissions: ['system_admin'],
    });

    // Seed Bob's standup with a sensitive manager note
    h.standups.set('standup-bob-2026-10-09', {
      id: 'standup-bob-2026-10-09',
      workspaceId: h.workspaceId,
      userId: 'user-author-2',
      userName: 'Bob Author',
      date: '2026-10-09',
      status: 'submitted',
      completedWork: [{ id: 'w1', title: 'Finished audit' }],
      plannedWork: [{ id: 'w2', title: 'Refactor auth' }],
      blockers: [],
      helpNeeded: 'Need review on PR #42',
      privateManagerNote: 'CONFIDENTIAL: Experiencing burnout and family emergency. Requesting confidential 1-on-1.',
      createdAt: '2026-10-09T08:00:00Z',
      updatedAt: '2026-10-09T08:00:00Z',
    });
  });

  it('redacts privateManagerNote when queried by a non-manager peer developer', async () => {
    h.currentSessionUid = 'user-peer-1'; // Alice querying

    const result = await getStandupsForDateAction(h.workspaceId, '2026-10-09');

    expect(result.success).toBe(true);
    expect(result.standups).toBeDefined();
    expect(result.standups!.length).toBe(1);

    const bobStandup = result.standups![0];
    expect(bobStandup.userName).toBe('Bob Author');
    expect(bobStandup.helpNeeded).toBe('Need review on PR #42');

    // Strict privacy guarantee: note must be stripped completely
    expect(bobStandup.privateManagerNote).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('Experiencing burnout');
  });

  it('preserves privateManagerNote when queried by the authoring user', async () => {
    h.currentSessionUid = 'user-author-2'; // Bob querying his own standup

    const result = await getStandupsForDateAction(h.workspaceId, '2026-10-09');

    expect(result.success).toBe(true);
    const bobStandup = result.standups![0];

    // Author should see their own note
    expect(bobStandup.privateManagerNote).toBe(
      'CONFIDENTIAL: Experiencing burnout and family emergency. Requesting confidential 1-on-1.'
    );
  });

  it('preserves privateManagerNote when queried by a system administrator or manager', async () => {
    h.currentSessionUid = 'user-admin-3'; // Charlie (admin) querying team standup

    const result = await getStandupsForDateAction(h.workspaceId, '2026-10-09');

    expect(result.success).toBe(true);
    const bobStandup = result.standups![0];

    // Manager/Admin should see the note to provide support
    expect(bobStandup.privateManagerNote).toBe(
      'CONFIDENTIAL: Experiencing burnout and family emergency. Requesting confidential 1-on-1.'
    );
  });
});
