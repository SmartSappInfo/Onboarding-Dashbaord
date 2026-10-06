// @vitest-environment node
/**
 * @fileOverview v2 item → task conversion (Phase 11 M2 · T3.5): exactly once, survives re-analysis,
 * review items refused, non-actionable refused, failures release the claim.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import type { MeetingItem } from '../intelligence/intelligence-schemas';
import { PIPELINE_ID, writeIntelligenceV2, type IntelligenceHeaderV2 } from '../intelligence/intelligence-store';
import { CONVERSION_CLAIM_MS, ItemConversionError, convertItemToTask, listConversions } from '../intelligence/item-conversion';

let db: FakeFirestore;
let created: string[];
let clock: number;
const fs = () => db.asFirestore();
const NOW = '2026-10-07T12:00:00.000Z';

const header: IntelligenceHeaderV2 = {
  schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
  promptVersion: 'v', promptHash: 'h', summary: null,
  counts: { kept: 3, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
  coverage: 1, truncated: false, version: 0, generatedAt: NOW, updatedAt: NOW,
};
const item = (hash: string, type: MeetingItem['type'], needsReview = false): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text: `Do ${hash}`, confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview,
  reviewReasons: needsReview ? ['low_confidence'] : [], status: 'valid', promptVersion: 'v', createdAt: NOW,
});

const deps = (ok = true) => ({
  createTask: async (i: MeetingItem) => {
    created.push(i.itemHash);
    return ok ? { success: true, id: `task-${created.length}` } : { success: false, error: 'task store down' };
  },
  nowMs: () => clock,
});
const params = { workspaceId: 'ws-a', meetingId: 'm-1', actorUid: 'u-1' };

beforeEach(async () => {
  db = new FakeFirestore();
  created = [];
  clock = Date.parse(NOW);
  await writeIntelligenceV2(fs(), header, [item('it_a', 'action_item'), item('it_r', 'action_item', true), item('it_d', 'decision')]);
});

describe('convertItemToTask', () => {
  it('creates one task; clicking again (or after a re-analysis) returns the same task', async () => {
    const first = await convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_a' });
    const again = await convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_a' });
    await writeIntelligenceV2(fs(), { ...header, version: 1 }, [item('it_a', 'action_item')]);
    const afterRerun = await convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_a' });
    expect(first).toEqual({ taskId: 'task-1', replayed: false });
    expect(again).toEqual({ taskId: 'task-1', replayed: true });
    expect(afterRerun.taskId).toBe('task-1');
    expect(created).toEqual(['it_a']);
    expect(await listConversions(fs(), 'ws-a', 'm-1')).toEqual(new Map([['it_a', 'task-1']]));
  });

  it('refuses items that need review, non-actionable items and unknown items', async () => {
    await expect(convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_r' })).rejects.toThrow('Review this item');
    await expect(convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_d' })).rejects.toBeInstanceOf(ItemConversionError);
    await expect(convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_zz' })).rejects.toThrow('not found');
    await expect(convertItemToTask(fs(), deps(), { ...params, workspaceId: 'ws-b', itemHash: 'it_a' })).rejects.toThrow('not found');
    expect(created).toEqual([]);
  });

  it('refuses a second click while converting; a stale claim can be re-claimed', async () => {
    await fs().collection('meeting_item_conversions').doc('ws-a__it_a').set({ workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_a', claimedAt: NOW });
    await expect(convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_a' })).rejects.toThrow('already being converted');
    clock += CONVERSION_CLAIM_MS + 1;
    await expect(convertItemToTask(fs(), deps(), { ...params, itemHash: 'it_a' })).resolves.toMatchObject({ replayed: false });
  });

  it('a failed task write releases the claim so the person can retry', async () => {
    await expect(convertItemToTask(fs(), deps(false), { ...params, itemHash: 'it_a' })).rejects.toThrow('task store down');
    await expect(convertItemToTask(fs(), deps(true), { ...params, itemHash: 'it_a' })).resolves.toMatchObject({ replayed: false });
  });
});
