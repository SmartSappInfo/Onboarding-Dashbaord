// @vitest-environment node
/**
 * @fileOverview Follow-up tasks from meeting items and their undo (Phase 11 M2 · T4.1; plan §4.6, §4.11).
 *
 * Bulk creation goes through the same per-item claim as "Convert to task" (one task per item hash,
 * across clicks and re-analysis); it is bound to the intelligence version the person reviewed.
 * Undo removes a task only while nobody has changed it, and frees the item for a new conversion.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import type { MeetingItem } from '../intelligence/intelligence-schemas';
import { PIPELINE_ID, writeIntelligenceV2, type IntelligenceHeaderV2 } from '../intelligence/intelligence-store';
import { listConversions } from '../intelligence/item-conversion';
import { FollowupTaskError, createFollowupTasks, undoFollowupTask } from '../intelligence/followup-tasks';

let db: FakeFirestore;
let created: string[];
let allowDelete: boolean;
const fs = () => db.asFirestore();
const NOW = '2026-10-07T12:00:00.000Z';

const header: IntelligenceHeaderV2 = {
  schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
  promptVersion: 'v', promptHash: 'h', summary: null,
  counts: { kept: 4, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
  coverage: 1, truncated: false, version: 3, generatedAt: NOW, updatedAt: NOW,
};
const item = (hash: string, type: MeetingItem['type'], needsReview = false): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text: `Do ${hash}`, confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview,
  reviewReasons: needsReview ? ['low_confidence'] : [], status: 'valid', promptVersion: 'v', createdAt: NOW,
});

const deps = () => ({
  nowMs: () => Date.parse(NOW),
  createTask: async (i: MeetingItem) => {
    created.push(i.itemHash);
    const id = `task-${i.itemHash}`;
    db.write(`tasks/${id}`, { workspaceId: 'ws-a', title: i.text, createdAt: NOW, updatedAt: NOW });
    return { success: true, id };
  },
  canDeleteTasks: async () => allowDelete,
});
const base = { workspaceId: 'ws-a', meetingId: 'm-1', actorUid: 'u-1' };

beforeEach(async () => {
  db = new FakeFirestore();
  created = [];
  allowDelete = true;
  await writeIntelligenceV2(fs(), header, [
    item('it_a', 'action_item'), item('it_b', 'commitment'), item('it_r', 'action_item', true), item('it_d', 'decision'),
  ]);
});

describe('createFollowupTasks', () => {
  it('creates one task per checked commitment / action item and reports what it skipped', async () => {
    const result = await createFollowupTasks(fs(), deps(), { ...base, expectedVersion: 3 });

    expect(result.intelligenceVersion).toBe(3);
    expect(result.created).toEqual([{ itemHash: 'it_a', taskId: 'task-it_a' }, { itemHash: 'it_b', taskId: 'task-it_b' }]);
    expect(result.existing).toEqual([]);
    expect(result.skipped).toEqual([]);
    expect(created).toEqual(['it_a', 'it_b']);
  });

  it('a double click (or a retry after a lost response) creates nothing new and returns the same tasks', async () => {
    await createFollowupTasks(fs(), deps(), { ...base, expectedVersion: 3 });
    const again = await createFollowupTasks(fs(), deps(), { ...base, expectedVersion: 3 });

    expect(again.created).toEqual([]);
    expect(again.existing).toEqual([{ itemHash: 'it_a', taskId: 'task-it_a' }, { itemHash: 'it_b', taskId: 'task-it_b' }]);
    expect(created).toEqual(['it_a', 'it_b']);
  });

  it('shares the claim with "Convert to task": an item already converted is reported, not duplicated', async () => {
    await createFollowupTasks(fs(), deps(), { ...base, itemHashes: ['it_a'] });
    const all = await createFollowupTasks(fs(), deps(), base);
    expect(all.existing).toEqual([{ itemHash: 'it_a', taskId: 'task-it_a' }]);
    expect(all.created).toEqual([{ itemHash: 'it_b', taskId: 'task-it_b' }]);
  });

  it('named items that need review, are not actionable or do not exist are skipped with a reason', async () => {
    const result = await createFollowupTasks(fs(), deps(), { ...base, itemHashes: ['it_r', 'it_d', 'it_zz', 'it_a'] });
    expect(result.created).toEqual([{ itemHash: 'it_a', taskId: 'task-it_a' }]);
    expect(result.skipped).toEqual([
      { itemHash: 'it_r', reason: 'needs_review' },
      { itemHash: 'it_d', reason: 'not_actionable' },
      { itemHash: 'it_zz', reason: 'not_found' },
    ]);
  });

  it('refuses when the analysis changed since the person reviewed it (re-analysis invalidates)', async () => {
    await expect(createFollowupTasks(fs(), deps(), { ...base, expectedVersion: 2 })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(created).toEqual([]);
  });

  it('another workspace sees no analysis', async () => {
    await expect(createFollowupTasks(fs(), deps(), { ...base, workspaceId: 'ws-b' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses more than 50 items in one call', async () => {
    const many = Array.from({ length: 51 }, (_, i) => `it_${i}`);
    await expect(createFollowupTasks(fs(), deps(), { ...base, itemHashes: many })).rejects.toBeInstanceOf(FollowupTaskError);
  });
});

describe('undoFollowupTask', () => {
  beforeEach(async () => {
    await createFollowupTasks(fs(), deps(), { ...base, itemHashes: ['it_a'] });
  });

  it('removes an unchanged task and frees the item so it can be converted again', async () => {
    const result = await undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' });

    expect(result).toEqual({ status: 'removed', taskId: 'task-it_a' });
    expect(db.read('tasks/task-it_a')).toBeUndefined();
    expect(await listConversions(fs(), 'ws-a', 'm-1')).toEqual(new Map());
    const again = await createFollowupTasks(fs(), deps(), { ...base, itemHashes: ['it_a'] });
    expect(again.created).toEqual([{ itemHash: 'it_a', taskId: 'task-it_a' }]);
  });

  it('refuses after the task was edited, and keeps it', async () => {
    db.write('tasks/task-it_a', { ...db.read('tasks/task-it_a'), status: 'done', updatedAt: '2026-10-07T13:00:00.000Z' });

    await expect(undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' })).rejects.toMatchObject({
      code: 'EDITED',
      message: "This task was edited, so it wasn't removed. Remove it from Tasks if needed.",
    });
    expect(db.read('tasks/task-it_a')).toBeDefined();
  });

  it('is a no-op the second time (lost response → key replay)', async () => {
    await undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' });
    await expect(undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' })).resolves.toEqual({ status: 'nothing_to_undo' });
  });

  it('a task someone already deleted just frees the item', async () => {
    db.docs.delete('tasks/task-it_a');
    await expect(undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' })).resolves.toEqual({ status: 'already_removed', taskId: 'task-it_a' });
    expect(await listConversions(fs(), 'ws-a', 'm-1')).toEqual(new Map());
  });

  it('needs permission to delete tasks', async () => {
    allowDelete = false;
    await expect(undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(db.read('tasks/task-it_a')).toBeDefined();
  });

  it('never touches a task stored in another workspace', async () => {
    db.write('tasks/task-it_a', { ...db.read('tasks/task-it_a'), workspaceId: 'ws-b' });
    await expect(undoFollowupTask(fs(), deps(), { ...base, itemHash: 'it_a' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(db.read('tasks/task-it_a')).toBeDefined();
  });
});
