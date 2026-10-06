// @vitest-environment node
/**
 * @fileOverview `meeting.summarize` service (Phase 11 M2 · T3.2): summary from validated items only,
 * invented citations dropped, version-checked save, same consent/AI-use checks as the pipeline.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import { CircuitBreaker } from '@/platform/events/resilience/circuit-breaker';
import type { MeetingItem } from '../intelligence/intelligence-schemas';
import { PIPELINE_ID, readIntelligenceV2, writeIntelligenceV2 } from '../intelligence/intelligence-store';
import type { IntelligenceModel } from '../intelligence/pipeline';
import { SummaryVersionConflictError, resummarizeIntelligence } from '../intelligence/summary-service';

let db: FakeFirestore;
let prompts: string[];
const fs = () => db.asFirestore();
const NOW = '2026-10-07T12:00:00.000Z';

const item = (hash: string): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type: 'commitment', text: `Send quote ${hash}`,
  confidence: 0.9, evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview: false,
  reviewReasons: [], status: 'valid', promptVersion: 'mi_extract_v1', createdAt: NOW,
});

function model(sentences: unknown): IntelligenceModel {
  return {
    breakerKey: 'test',
    extract: async () => ({ output: null, modelId: 'x' }),
    summarize: async (req) => {
      prompts.push(req.prompt);
      return { output: { sentences }, modelId: 'pro' };
    },
  };
}
const deps = (m: IntelligenceModel) => ({ model: m, nowMs: () => Date.parse(NOW), breaker: new CircuitBreaker() });
const params = { workspaceId: 'ws-a', meetingId: 'm-1' };

beforeEach(async () => {
  db = new FakeFirestore();
  prompts = [];
  db.write('meeting_transcripts/t-1', {
    workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'completed', version: 1, schemaVersion: 2, dataClass: 'personal',
    aiUse: 'allowed', provenance: { createdBy: 'u', principalKind: 'user' }, createdAt: NOW, updatedAt: NOW,
  });
  await writeIntelligenceV2(fs(), {
    schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
    promptVersion: 'mi_extract_v1', promptHash: 'h', summary: null,
    counts: { kept: 2, needsReview: 0, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
    coverage: 1, truncated: false, version: 3, generatedAt: NOW, updatedAt: NOW,
  }, [item('it_a'), item('it_b')]);
});

describe('resummarizeIntelligence', () => {
  it('summarizes validated items only and saves with a version bump', async () => {
    const r = await resummarizeIntelligence(fs(), deps(model([{ text: 'Two quotes will be sent.', itemIds: ['it_a', 'it_b'] }])), { ...params, expectedVersion: 3 });
    expect(r.version).toBe(4);
    expect(r.summary?.sentences).toEqual([{ text: 'Two quotes will be sent.', itemHashes: ['it_a', 'it_b'] }]);
    expect(prompts[0]).toContain('[it_a]');
    expect(prompts[0]).not.toContain('<transcript>');
    expect((await readIntelligenceV2(fs(), 'm-1', 'ws-a'))?.header.summary?.sentences).toHaveLength(1);
  });

  it('drops sentences citing unknown items (summary becomes empty, never invented)', async () => {
    const r = await resummarizeIntelligence(fs(), deps(model([{ text: 'They agreed a discount.', itemIds: ['it_zzz'] }])), params);
    expect(r.summary).toBeNull();
  });

  it('refuses a stale expected version', async () => {
    await expect(resummarizeIntelligence(fs(), deps(model([])), { ...params, expectedVersion: 2 })).rejects.toBeInstanceOf(SummaryVersionConflictError);
  });

  it('refuses when AI use is restricted, and when there is no analysis', async () => {
    await fs().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'restricted' });
    await expect(resummarizeIntelligence(fs(), deps(model([])), params)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(resummarizeIntelligence(fs(), deps(model([])), { ...params, meetingId: 'm-none' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(prompts).toHaveLength(0);
  });
});
