// @vitest-environment node
/**
 * @fileOverview Meeting intelligence v2 storage (Phase 11 M2 · T3.2): deterministic run ids,
 * checkpoints, header-last writes that replace stale items, workspace-scoped reads, and deletion of
 * runs/checkpoints with the transcript (they hold quotes).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import type { MeetingItem } from '../intelligence/intelligence-schemas';
import {
  PIPELINE_ID,
  loadCheckpoints,
  readIntelligenceV2,
  runIdFor,
  saveCheckpoint,
  writeIntelligenceV2,
  type IntelligenceHeaderV2,
} from '../intelligence/intelligence-store';
import { deleteDerivedMeetingData } from '../retention-service';

let db: FakeFirestore;
const fs = () => db.asFirestore();
const NOW = '2026-10-07T12:00:00.000Z';

const item = (hash: string, over: Partial<MeetingItem> = {}): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type: 'commitment', text: `Item ${hash}`,
  confidence: 0.9, evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview: false,
  reviewReasons: [], status: 'valid', promptVersion: 'mi_extract_v1', createdAt: NOW, ...over,
});
const header = (over: Partial<IntelligenceHeaderV2> = {}): IntelligenceHeaderV2 => ({
  schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
  promptVersion: 'mi_extract_v1', promptHash: 'abc', summary: null,
  counts: { kept: 2, needsReview: 0, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
  coverage: 1, truncated: false, version: 1, generatedAt: NOW, updatedAt: NOW, ...over,
});

beforeEach(() => {
  db = new FakeFirestore();
});

describe('intelligence store', () => {
  it('run ids are deterministic per workspace, transcript and prompt version', () => {
    expect(runIdFor('ws-a', 't-1', 'v1')).toBe(runIdFor('ws-a', 't-1', 'v1'));
    expect(runIdFor('ws-a', 't-1', 'v2')).not.toBe(runIdFor('ws-a', 't-1', 'v1'));
    expect(runIdFor('ws-b', 't-1', 'v1')).not.toBe(runIdFor('ws-a', 't-1', 'v1'));
  });

  it('saves and reloads chunk checkpoints (the replay record)', async () => {
    await saveCheckpoint(fs(), 'mir_1', { index: 2, rawOutput: { items: [] }, modelId: 'm', promptHash: 'h', inputTokens: 10, outputTokens: 5, at: NOW });
    await saveCheckpoint(fs(), 'mir_1', { index: 0, rawOutput: undefined, modelId: 'm', promptHash: 'h', at: NOW });
    const cps = await loadCheckpoints(fs(), 'mir_1');
    expect([...cps.keys()].sort()).toEqual([0, 2]);
    expect(cps.get(2)?.rawOutput).toEqual({ items: [] });
  });

  it('writes items then the header, replacing items from the previous analysis', async () => {
    await writeIntelligenceV2(fs(), header(), [item('it_a'), item('it_b')]);
    await writeIntelligenceV2(fs(), header({ version: 2 }), [item('it_b'), item('it_c')]);
    const read = await readIntelligenceV2(fs(), 'm-1', 'ws-a');
    expect(read?.header.version).toBe(2);
    expect(read?.items.map((i) => i.itemHash).sort()).toEqual(['it_b', 'it_c']);
  });

  it('reads only its own workspace and ignores a v1 document', async () => {
    await writeIntelligenceV2(fs(), header(), [item('it_a')]);
    expect(await readIntelligenceV2(fs(), 'm-1', 'ws-b')).toBeNull();
    db.write('meeting_intelligence/m-legacy', { workspaceId: 'ws-a', actionItems: [], summary: 'old' });
    expect(await readIntelligenceV2(fs(), 'm-legacy', 'ws-a')).toBeNull();
  });

  it('never returns items from another transcript than the header', async () => {
    await writeIntelligenceV2(fs(), header(), [item('it_a')]);
    db.write('meeting_intelligence/m-1/items/it_stale', item('it_stale', { transcriptId: 't-old' }));
    const read = await readIntelligenceV2(fs(), 'm-1', 'ws-a');
    expect(read?.items.map((i) => i.itemHash)).toEqual(['it_a']);
  });

  it('deleting derived data removes intelligence, items, runs and their checkpoints', async () => {
    await writeIntelligenceV2(fs(), header(), [item('it_a')]);
    db.write('meeting_intelligence_runs/mir_1', { workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1' });
    await saveCheckpoint(fs(), 'mir_1', { index: 0, rawOutput: { items: [] }, modelId: 'm', promptHash: 'h', at: NOW });
    db.write('meeting_intelligence_runs/mir_other_ws', { workspaceId: 'ws-b', meetingId: 'm-1', transcriptId: 't-1' });
    await deleteDerivedMeetingData(fs(), { workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1' });
    expect(await readIntelligenceV2(fs(), 'm-1', 'ws-a')).toBeNull();
    expect((await fs().collection('meeting_intelligence_runs').doc('mir_1').get()).exists).toBe(false);
    expect((await loadCheckpoints(fs(), 'mir_1')).size).toBe(0);
    expect((await fs().collection('meeting_intelligence_runs').doc('mir_other_ws').get()).exists).toBe(true);
  });
});
