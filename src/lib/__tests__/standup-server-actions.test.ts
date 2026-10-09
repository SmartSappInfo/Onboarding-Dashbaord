// @vitest-environment node
/**
 * @fileOverview Unit & Integration Tests for Standup & Blocker Server Actions (Phase 4B).
 * Validates:
 * - Draft saving and submission lifecycle.
 * - Blocker extraction and synchronization to 'blockers' collection.
 * - Idempotency guards (Rule 19).
 * - TOCTOU concurrency conflict protection via expectedUpdatedAt (Rule 18).
 * - Private manager notes redaction for non-manager peers.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StandupSubmission, BlockerRecord, StandupBlockerItem, StandupWorkItem } from '@/lib/types';

const h = vi.hoisted(() => ({
  standups: new Map<string, Record<string, unknown>>(),
  blockers: new Map<string, Record<string, unknown>>(),
  users: new Map<string, Record<string, unknown>>(),
  members: new Map<string, string[]>(), // workspaceId -> allowed uids
  sessionUid: 'user-alice',
  isAdmin: false,
}));

vi.mock('@/lib/firebase-admin', () => {
  const doc = (coll: string, id: string) => ({
    get: async () => {
      const map = coll === 'standups' ? h.standups : coll === 'blockers' ? h.blockers : h.users;
      const data = map.get(id);
      return {
        exists: !!data,
        id,
        data: () => data,
      };
    },
    set: async (data: Record<string, unknown>, opts?: { merge?: boolean }) => {
      const map = coll === 'standups' ? h.standups : coll === 'blockers' ? h.blockers : h.users;
      if (opts?.merge && map.has(id)) {
        map.set(id, { ...map.get(id)!, ...data });
      } else {
        map.set(id, { ...data, id });
      }
    },
    update: async (data: Record<string, unknown>) => {
      const map = coll === 'standups' ? h.standups : coll === 'blockers' ? h.blockers : h.users;
      if (!map.has(id)) throw new Error('Document not found');
      map.set(id, { ...map.get(id)!, ...data });
    },
    delete: async () => {
      const map = coll === 'standups' ? h.standups : coll === 'blockers' ? h.blockers : h.users;
      map.delete(id);
    },
  });

  return {
    adminDb: {
      collection: (name: string) => ({
        doc: (id: string) => doc(name, id),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        get: async () => {
          const map = name === 'standups' ? h.standups : name === 'blockers' ? h.blockers : h.users;
          const docs = Array.from(map.entries()).map(([id, data]) => ({
            id,
            data: () => data,
            exists: true,
          }));
          return { docs, empty: docs.length === 0 };
        },
      }),
      batch: () => ({
        set: (docRef: { id: string }, data: Record<string, unknown>) => {
          h.blockers.set(docRef.id, { ...data, id: docRef.id });
        },
        update: (docRef: { id: string }, data: Record<string, unknown>) => {
          if (h.blockers.has(docRef.id)) {
            h.blockers.set(docRef.id, { ...h.blockers.get(docRef.id)!, ...data });
          }
        },
        commit: async () => undefined,
      }),
    },
  };
});

vi.mock('@/lib/auth/require-auth', () => ({
  requireWorkspace: vi.fn(async (workspaceId: string) => {
    const allowed = h.members.get(workspaceId) || [];
    if (!allowed.includes(h.sessionUid)) {
      throw new Error('No access to this workspace.');
    }
    return { uid: h.sessionUid };
  }),
}));

import {
  saveStandupDraftAction,
  submitStandupAction,
  mutateBlockerAction,
  getStandupsForDateAction,
} from '../standup-server-actions';

describe('Standup Server Actions & Blocker Lifecycle (Phase 4B)', () => {
  beforeEach(() => {
    h.standups.clear();
    h.blockers.clear();
    h.users.clear();
    h.members.clear();
    h.sessionUid = 'user-alice';
    h.isAdmin = false;

    // Default workspace setup
    h.members.set('ws-1', ['user-alice', 'user-bob', 'manager-carol']);
    h.users.set('user-alice', { id: 'user-alice', name: 'Alice Smith', email: 'alice@corp.internal', permissions: [] });
    h.users.set('user-bob', { id: 'user-bob', name: 'Bob Jones', email: 'bob@corp.internal', permissions: [] });
    h.users.set('manager-carol', { id: 'manager-carol', name: 'Carol Danvers', email: 'carol@corp.internal', permissions: ['system_admin'] });
  });

  describe('saveStandupDraftAction', () => {
    it('saves a standup draft for authorized user and workspace', async () => {
      const res = await saveStandupDraftAction('ws-1', {
        date: '2026-10-09',
        completedWork: [{ id: 'w-1', title: 'Refactored auth middleware', type: 'commitment' }],
        plannedWork: [{ id: 'w-2', title: 'Implement blocker actions', type: 'commitment' }],
        blockers: [],
        helpNeeded: 'None',
        privateManagerNote: 'Feeling slightly burned out from deadlines',
      });

      expect(res.success).toBe(true);
      expect(res.id).toBeDefined();

      // Check stored record
      const stored = h.standups.get(res.id!) as StandupSubmission;
      expect(stored).toBeDefined();
      expect(stored.status).toBe('draft');
      expect(stored.userId).toBe('user-alice');
      expect(stored.date).toBe('2026-10-09');
      expect(stored.privateManagerNote).toBe('Feeling slightly burned out from deadlines');
    });

    it('rejects draft saving when user does not belong to workspace', async () => {
      const res = await saveStandupDraftAction('ws-foreign', {
        date: '2026-10-09',
        completedWork: [],
        plannedWork: [],
        blockers: [],
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/No access to this workspace/);
    });

    it('prevents TOCTOU conflict when expectedUpdatedAt differs from stored updatedAt', async () => {
      // First save
      const res1 = await saveStandupDraftAction('ws-1', {
        date: '2026-10-09',
        completedWork: [],
        plannedWork: [],
        blockers: [],
      });
      expect(res1.success).toBe(true);

      // Artificially modify updatedAt
      const doc = h.standups.get(res1.id!)!;
      doc.updatedAt = '2026-10-09T10:00:00.000Z';

      // Attempt update with stale timestamp
      const res2 = await saveStandupDraftAction('ws-1', {
        date: '2026-10-09',
        completedWork: [],
        plannedWork: [],
        blockers: [],
        expectedUpdatedAt: '2026-10-09T09:00:00.000Z',
      });

      expect(res2.success).toBe(false);
      expect(res2.error).toMatch(/CONCURRENCY_CONFLICT/);
    });
  });

  describe('submitStandupAction & Blocker Extraction', () => {
    it('submits standup and extracts blockers to collection', async () => {
      const blockers: StandupBlockerItem[] = [
        {
          id: 'blk-local-1',
          summary: 'Waiting on staging API key approval',
          category: 'access',
          severity: 'high',
          affectedTaskId: 'task-100',
          affectedTaskTitle: 'Configure API Integration',
          neededAction: 'Grant dev ops role',
        },
      ];

      const res = await submitStandupAction('ws-1', {
        date: '2026-10-09',
        completedWork: [{ id: 'w-1', title: 'Built components', type: 'commitment' }],
        plannedWork: [{ id: 'w-2', title: 'Write unit tests', type: 'commitment' }],
        blockers,
        helpNeeded: 'Review PR #42',
        privateManagerNote: 'Will take Friday afternoon off',
      });

      expect(res.success).toBe(true);
      expect(res.id).toBeDefined();

      const stored = h.standups.get(res.id!) as StandupSubmission;
      expect(stored.status).toBe('submitted');
      expect(stored.submittedAt).toBeDefined();

      // Blocker should be extracted to blockers collection
      expect(h.blockers.size).toBe(1);
      const blockerEntries = Array.from(h.blockers.values()) as BlockerRecord[];
      const extracted = blockerEntries[0];
      expect(extracted.workspaceId).toBe('ws-1');
      expect(extracted.summary).toBe('Waiting on staging API key approval');
      expect(extracted.severity).toBe('high');
      expect(extracted.status).toBe('open');
      expect(extracted.raisedBy).toBe('user-alice');
      expect(extracted.affectedTaskIds).toEqual(['task-100']);
    });

    it('enforces idempotency when idempotencyKey is reused', async () => {
      const subData = {
        date: '2026-10-09',
        completedWork: [],
        plannedWork: [],
        blockers: [],
        idempotencyKey: 'idem-key-12345',
      };

      const res1 = await submitStandupAction('ws-1', subData);
      expect(res1.success).toBe(true);

      // Re-submit with same idempotency key
      const res2 = await submitStandupAction('ws-1', subData);
      expect(res2.success).toBe(true);
      expect(res2.id).toBe(res1.id);
    });
  });

  describe('mutateBlockerAction', () => {
    beforeEach(() => {
      h.blockers.set('blk-1', {
        id: 'blk-1',
        workspaceId: 'ws-1',
        summary: 'Database migration script failing',
        category: 'technical',
        severity: 'critical',
        status: 'open',
        raisedBy: 'user-bob',
        createdAt: '2026-10-09T08:00:00.000Z',
        updatedAt: '2026-10-09T08:00:00.000Z',
      });
    });

    it('acknowledges blocker and assigns owner', async () => {
      const res = await mutateBlockerAction('ws-1', 'blk-1', {
        status: 'acknowledged',
        ownerId: 'user-alice',
        ownerName: 'Alice Smith',
      });

      expect(res.success).toBe(true);
      const updated = h.blockers.get('blk-1') as BlockerRecord;
      expect(updated.status).toBe('acknowledged');
      expect(updated.ownerId).toBe('user-alice');
      expect(updated.ownerName).toBe('Alice Smith');
    });

    it('resolves blocker with resolution note and records actor and timestamp', async () => {
      const res = await mutateBlockerAction('ws-1', 'blk-1', {
        status: 'resolved',
        resolutionNote: 'Applied schema patch v4 and ran vacuum.',
      });

      expect(res.success).toBe(true);
      const updated = h.blockers.get('blk-1') as BlockerRecord;
      expect(updated.status).toBe('resolved');
      expect(updated.resolutionNote).toBe('Applied schema patch v4 and ran vacuum.');
      expect(updated.resolvedBy).toBe('user-alice');
      expect(updated.resolvedAt).toBeDefined();
    });

    it('rejects mutation if blocker belongs to another workspace', async () => {
      h.members.set('ws-2', ['user-alice']);
      const res = await mutateBlockerAction('ws-2', 'blk-1', {
        status: 'acknowledged',
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/Blocker not found or access denied/);
    });

    it('guards against TOCTOU race conditions when expectedUpdatedAt differs', async () => {
      const res = await mutateBlockerAction('ws-1', 'blk-1', {
        status: 'resolved',
        expectedUpdatedAt: '2026-10-09T07:00:00.000Z', // stale
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/CONCURRENCY_CONFLICT/);
    });
  });

  describe('getStandupsForDateAction Privacy & Notes Protection', () => {
    beforeEach(() => {
      h.standups.set('ws-1_user-alice_2026-10-09', {
        id: 'ws-1_user-alice_2026-10-09',
        workspaceId: 'ws-1',
        userId: 'user-alice',
        userName: 'Alice Smith',
        date: '2026-10-09',
        status: 'submitted',
        completedWork: [],
        plannedWork: [],
        blockers: [],
        privateManagerNote: 'Alice confidential note to manager',
      });

      h.standups.set('ws-1_user-bob_2026-10-09', {
        id: 'ws-1_user-bob_2026-10-09',
        workspaceId: 'ws-1',
        userId: 'user-bob',
        userName: 'Bob Jones',
        date: '2026-10-09',
        status: 'submitted',
        completedWork: [],
        plannedWork: [],
        blockers: [],
        privateManagerNote: 'Bob confidential note to manager',
      });
    });

    it('author sees their own privateManagerNote', async () => {
      h.sessionUid = 'user-alice';
      const res = await getStandupsForDateAction('ws-1', '2026-10-09');
      expect(res.success).toBe(true);

      const aliceStandup = res.standups?.find(s => s.userId === 'user-alice');
      expect(aliceStandup?.privateManagerNote).toBe('Alice confidential note to manager');
    });

    it('redacts privateManagerNote for peer non-manager members', async () => {
      h.sessionUid = 'user-alice'; // Alice is viewing Bob's standup
      const res = await getStandupsForDateAction('ws-1', '2026-10-09');
      expect(res.success).toBe(true);

      const bobStandup = res.standups?.find(s => s.userId === 'user-bob');
      expect(bobStandup).toBeDefined();
      expect(bobStandup?.privateManagerNote).toBeUndefined();
    });

    it('manager/system_admin can view privateManagerNote across team members', async () => {
      h.sessionUid = 'manager-carol'; // Carol has system_admin
      const res = await getStandupsForDateAction('ws-1', '2026-10-09');
      expect(res.success).toBe(true);

      const aliceStandup = res.standups?.find(s => s.userId === 'user-alice');
      const bobStandup = res.standups?.find(s => s.userId === 'user-bob');
      expect(aliceStandup?.privateManagerNote).toBe('Alice confidential note to manager');
      expect(bobStandup?.privateManagerNote).toBe('Bob confidential note to manager');
    });
  });
});
