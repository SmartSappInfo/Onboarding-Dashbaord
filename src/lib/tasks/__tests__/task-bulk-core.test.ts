// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Task } from '@/lib/types';

type Doc = Record<string, unknown>;

const h = vi.hoisted(() => ({
  store: new Map<string, Map<string, Record<string, unknown>>>(),
  seq: 0,
  batchSets: [] as Array<{ refId: string; data: Record<string, unknown> }>,
  batchCommitCount: 0,
}));

function getCollection(name: string): Map<string, Doc> {
  let c = h.store.get(name);
  if (!c) {
    c = new Map();
    h.store.set(name, c);
  }
  return c;
}

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: (name: string) => ({
      doc: (id?: string) => {
        const docId = id || `task_auto_${++h.seq}`;
        return {
          id: docId,
          get: async () => ({
            exists: getCollection(name).has(docId),
            id: docId,
            data: () => getCollection(name).get(docId),
          }),
        };
      },
    }),
    getAll: async (...refs: Array<{ id: string }>) => {
      return refs.map(ref => {
        const data = getCollection('workspace_entities').get(ref.id);
        return {
          exists: !!data,
          id: ref.id,
          data: () => data,
        };
      });
    },
    batch: () => ({
      set: (ref: { id: string }, data: Record<string, unknown>) => {
        h.batchSets.push({ refId: ref.id, data });
        getCollection('tasks').set(ref.id, data);
      },
      commit: async () => {
        h.batchCommitCount++;
      },
    }),
  },
}));

vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async (uid: string, _res: string, _mod: string, _action: string, _workspaceId: string) => {
    if (uid === 'unauthorized-user') {
      return { granted: false, reason: 'User lacks operations:tasks:create permission.' };
    }
    return { granted: true };
  }),
}));

import { bulkCreateTasksCore, BulkTaskCreationDataSchema, type BulkTaskCreationData } from '../task-bulk-core';

describe('Bulk Task Creation Domain Core (task-bulk-core.ts)', () => {
  beforeEach(() => {
    h.store.clear();
    h.batchSets = [];
    h.batchCommitCount = 0;
    h.seq = 0;

    // Seed mock workspace entities
    getCollection('workspace_entities').set('ws-1_ent-1', {
      entityId: 'ent-1',
      displayName: 'Acme School',
      entityType: 'institution',
      assignedTo: { userId: 'usr-agent-1' },
    });
    getCollection('workspace_entities').set('ws-1_ent-2', {
      entityId: 'ent-2',
      displayName: 'Beta Academy',
      entityType: 'institution',
      assignedTo: { userId: 'usr-agent-2' },
    });
  });

  it('validates schema input strictly using Zod', () => {
    const validData: BulkTaskCreationData = {
      entityIds: ['ent-1'],
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      title: 'Conduct Protocol Review',
      description: 'Audit requirements',
      priority: 'high',
      category: 'visit',
      dueDaysOffset: 3,
    };
    expect(() => BulkTaskCreationDataSchema.parse(validData)).not.toThrow();

    // Invalid priority
    expect(() =>
      BulkTaskCreationDataSchema.parse({
        ...validData,
        priority: 'critical_emergency',
      })
    ).toThrow();

    // Empty title
    expect(() =>
      BulkTaskCreationDataSchema.parse({
        ...validData,
        title: '',
      })
    ).toThrow();

    // Empty entityIds
    expect(() =>
      BulkTaskCreationDataSchema.parse({
        ...validData,
        entityIds: [],
      })
    ).toThrow();
  });

  it('creates tasks with system actor authority and assigns entity metadata', async () => {
    const data: BulkTaskCreationData = {
      entityIds: ['ent-1', 'ent-2'],
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      title: 'Follow-up Call',
      description: 'Quarterly review',
      priority: 'medium',
      category: 'call',
      dueDaysOffset: 5,
    };

    const res = await bulkCreateTasksCore(data, { kind: 'system', source: 'automation' });

    expect(res.success).toBe(true);
    expect(res.count).toBe(2);
    expect(h.batchCommitCount).toBe(1);
    expect(h.batchSets).toHaveLength(2);

    const firstTask = h.batchSets[0].data as unknown as Task;
    expect(firstTask.workspaceId).toBe('ws-1');
    expect(firstTask.organizationId).toBe('org-1');
    expect(firstTask.entityId).toBe('ent-1');
    expect(firstTask.entityName).toBe('Acme School');
    expect(firstTask.status).toBe('todo');
    expect(firstTask.priority).toBe('medium');
    expect(firstTask.category).toBe('call');
    expect(firstTask.assignedTo).toBe('usr-agent-1');
    expect(firstTask.source).toBe('automation');
    expect(firstTask.reminders).toEqual([]);
    expect(firstTask.reminderSent).toBe(false);
  });

  it('rejects unauthorized user actors via canUser checks', async () => {
    const data: BulkTaskCreationData = {
      entityIds: ['ent-1'],
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      title: 'Restricted Action',
      description: '',
      priority: 'low',
      category: 'general',
      dueDaysOffset: 1,
    };

    const res = await bulkCreateTasksCore(data, { kind: 'user', uid: 'unauthorized-user' });

    expect(res.success).toBe(false);
    expect(res.error).toContain('User lacks operations:tasks:create permission');
    expect(h.batchCommitCount).toBe(0);
  });

  it('chunks batch commits when entity count exceeds 450', async () => {
    const manyEntityIds: string[] = [];
    for (let i = 0; i < 500; i++) {
      const id = `bulk-ent-${i}`;
      manyEntityIds.push(id);
      getCollection('workspace_entities').set(`ws-1_${id}`, {
        entityId: id,
        displayName: `Entity ${i}`,
        entityType: 'institution',
      });
    }

    const data: BulkTaskCreationData = {
      entityIds: manyEntityIds,
      workspaceId: 'ws-1',
      organizationId: 'org-1',
      title: 'Mass Compliance Verification',
      description: 'System-wide batch check',
      priority: 'low',
      category: 'document',
      dueDaysOffset: 7,
    };

    const res = await bulkCreateTasksCore(data, { kind: 'system', source: 'automation' });

    expect(res.success).toBe(true);
    expect(res.count).toBe(500);
    // 500 items divided by chunk limit 450 yields 2 batches
    expect(h.batchCommitCount).toBe(2);
  });
});
