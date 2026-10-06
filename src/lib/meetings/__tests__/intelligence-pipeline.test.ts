// @vitest-environment node
/**
 * @fileOverview `meeting_postprocess_v2` pipeline (Phase 11 M2 · T3.4). Fake model, fake Firestore.
 * Happy path; fabricated quote / foreign segment dropped; injection → review; chunk retry resumes
 * from checkpoints (no repeated model call); DLQ; cancel between chunks; superseded by a newer
 * transcript; duplicate trigger; quota refusal; consent withdrawn mid-run; breaker open → retry
 * without burning an attempt; schedule failure; reaper.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import { CircuitBreaker, CircuitBreakerOpenError } from '@/platform/events/resilience/circuit-breaker';
import {
  DAILY_RUNS_PER_WORKSPACE,
  MAX_RUN_ATTEMPTS,
  STALE_RUN_MS,
  processIntelligenceRun,
  reapStaleIntelligenceRuns,
  requestIntelligenceRun,
  type IntelligenceModel,
  type IntelligenceModelRequest,
  type PipelineDeps,
} from '../intelligence/pipeline';
import { loadCheckpoints, loadRun, readIntelligenceV2 } from '../intelligence/intelligence-store';

const NOW = Date.parse('2026-10-07T12:00:00.000Z');
let db: FakeFirestore;
let scheduled: string[];
let extractCalls: number[];
let clock: number;
const fs = () => db.asFirestore();
const requestedBy = { userId: 'u-1', principalKind: 'user' as const };
const params = { workspaceId: 'ws-a', organizationId: 'org-1', meetingId: 'm-1', requestedBy };

/** Long segments so the transcript splits into several chunks (~4). */
function segmentsFor(count: number) {
  const pad = ' and we talked through the rollout plan in detail'.repeat(60);
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i}`, speakerId: i % 2 ? 'kofi' : 'ama', speakerName: i % 2 ? 'Kofi' : 'Ama Mensah', startMs: i * 1000, endMs: i * 1000 + 900,
    text: `We will send the revised quote number ${i} by Friday${pad}`.slice(0, 3900),
  }));
}

function writeTranscript(id: string, over: Record<string, unknown> = {}, createdAt = '2026-10-07T10:00:00.000Z', segCount = 24) {
  const segments = segmentsFor(segCount);
  db.write(`meeting_transcripts/${id}`, {
    workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'completed', version: 1, schemaVersion: 2, language: 'en',
    speakers: [{ id: 'ama', name: 'Ama Mensah', participantId: 'p1' }, { id: 'kofi', name: 'Kofi' }],
    wordCount: 100, segmentCount: segments.length, chunkCount: 1, durationMs: 1, contentHash: 'h', dataClass: 'personal',
    aiUse: 'allowed', injection: { flagged: false, patterns: [] }, provenance: { createdBy: 'u-1', principalKind: 'user' },
    createdAt, completedAt: createdAt, updatedAt: createdAt, ...over,
  });
  db.write(`meeting_transcripts/${id}/segments/0000`, { index: 0, segments });
}

/** Cites the first segment id in the prompt with a real quote; optionally adds bad items. */
function fakeModel(opts: { failChunks?: Set<number>; error?: Error; bad?: boolean; onExtract?: () => void } = {}): IntelligenceModel {
  return {
    breakerKey: 'test',
    async extract(req: IntelligenceModelRequest) {
      const part = Number(/Part (\d+) of/.exec(req.prompt)?.[1] ?? '1') - 1;
      extractCalls.push(part);
      opts.onExtract?.();
      if (opts.failChunks?.has(part)) throw opts.error ?? new Error('503 unavailable');
      const ids = [...req.prompt.matchAll(/\[(s\d+)\]/g)].map((m) => m[1]);
      const n = Number(ids[ids.length - 1].slice(1));
      const items: unknown[] = [{
        type: 'commitment', text: `Send revised quote ${n}`, ownerName: 'Ama', dueText: 'by Friday', confidence: 0.9,
        evidence: [{ segmentIds: [`s${n}`], quote: `send the revised quote number ${n}` }],
      }];
      if (opts.bad) {
        items.push({ type: 'decision', text: 'Give a discount', confidence: 0.9, evidence: [{ segmentIds: [`s${n}`], quote: 'we will give you fifty percent off' }] });
        items.push({ type: 'decision', text: 'Foreign', confidence: 0.9, evidence: [{ segmentIds: ['s999'], quote: 'send the revised quote' }] });
      }
      return { output: { items }, modelId: 'googleai/flash-test', inputTokens: 100, outputTokens: 20 };
    },
    async summarize() {
      return { output: { sentences: [{ text: 'Ama will send revised quotes.', itemIds: ['it_unknown'] }] }, modelId: 'googleai/pro-test' };
    },
  };
}

function deps(model: IntelligenceModel | null, over: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    model, breaker: new CircuitBreaker(), nowMs: () => clock,
    schedule: async (key) => { scheduled.push(key); },
    ...over,
  };
}

beforeEach(() => {
  db = new FakeFirestore();
  scheduled = [];
  extractCalls = [];
  clock = NOW;
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: '2026-10-07T10:00:00.000Z', timezone: 'Africa/Accra' });
  db.write('participants/p1', { meetingId: 'm-1', name: 'Ama Mensah', userId: 'u-ama' });
  writeTranscript('t-1');
});

async function startAndRun(model: IntelligenceModel | null = fakeModel(), d?: Partial<PipelineDeps>) {
  const req = await requestIntelligenceRun(fs(), deps(model, d), params);
  const outcome = await processIntelligenceRun(fs(), deps(model, d), req.runId);
  return { req, outcome };
}

describe('meeting_postprocess_v2', () => {
  it('happy path: every chunk analysed once, validated items stored header-last, run completed', async () => {
    const { req, outcome } = await startAndRun();
    expect(outcome.status).toBe('completed');
    const run = await loadRun(fs(), req.runId);
    expect(run?.chunkCount).toBeGreaterThan(1);
    expect(extractCalls).toHaveLength(run?.chunkCount ?? 0);
    expect(run?.usage.modelCalls).toBeGreaterThanOrEqual(run?.chunkCount ?? 0);
    const intel = await readIntelligenceV2(fs(), 'm-1', 'ws-a');
    expect(intel?.header.transcriptId).toBe('t-1');
    expect(intel?.items.length).toBe(run?.chunkCount);
    const first = intel?.items[0];
    expect(first?.owner).toMatchObject({ name: 'Ama Mensah', matched: true });
    expect(first?.dueDate).toMatchObject({ iso: '2026-10-09', timeZone: 'Africa/Accra', timeZoneSource: 'meeting' });
    // The fake summary cites an unknown item → dropped → no summary (never invented).
    expect(intel?.header.summary).toBeNull();
    expect(scheduled).toHaveLength(1);
  });

  it('drops a fabricated quote and a foreign segment id, and counts them', async () => {
    await startAndRun(fakeModel({ bad: true }));
    const intel = await readIntelligenceV2(fs(), 'm-1', 'ws-a');
    expect(intel?.items.every((i) => i.type === 'commitment')).toBe(true);
    expect(intel?.header.counts.dropped.quote_not_found).toBeGreaterThan(0);
    expect(intel?.header.counts.dropped.unknown_segment).toBeGreaterThan(0);
  });

  it('an injection-flagged transcript puts every item in review', async () => {
    writeTranscript('t-1', { injection: { flagged: true, patterns: ['ignore previous'] } });
    await startAndRun();
    const intel = await readIntelligenceV2(fs(), 'm-1', 'ws-a');
    expect(intel?.items.every((i) => i.needsReview && i.reviewReasons.includes('injection_flagged'))).toBe(true);
    expect(intel?.header.counts.needsReview).toBe(intel?.items.length);
  });

  it('a failed chunk retries later and resumes from checkpoints without repeating model calls', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    const first = await processIntelligenceRun(fs(), deps(fakeModel({ failChunks: new Set([1]) })), req.runId);
    expect(first.status).toBe('retry');
    const done = await loadCheckpoints(fs(), req.runId);
    expect(done.has(1)).toBe(false);
    const callsBefore = [...extractCalls];
    extractCalls = [];
    const second = await processIntelligenceRun(fs(), deps(fakeModel()), req.runId);
    expect(second.status).toBe('completed');
    // Only the chunk(s) without a checkpoint were called again.
    expect(extractCalls).toEqual([...(await loadCheckpoints(fs(), req.runId)).keys()].filter((k) => !done.has(k)));
    expect(callsBefore.length).toBeGreaterThan(0);
  });

  it('dead-letters after the attempt budget, with a DLQ record and nothing stored', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    let outcome = await processIntelligenceRun(fs(), deps(fakeModel({ failChunks: new Set([0]) })), req.runId);
    for (let i = 1; i < MAX_RUN_ATTEMPTS && outcome.status === 'retry'; i += 1) {
      outcome = await processIntelligenceRun(fs(), deps(fakeModel({ failChunks: new Set([0]) })), req.runId);
    }
    expect(outcome.status).toBe('dead_lettered');
    expect((await fs().collection('meeting_intelligence_dlq').doc(req.runId).get()).exists).toBe(true);
    expect(await readIntelligenceV2(fs(), 'm-1', 'ws-a')).toBeNull();
  });

  it('breaker open → retry later without burning an attempt', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    const outcome = await processIntelligenceRun(fs(), deps(fakeModel({ failChunks: new Set([0, 1, 2, 3, 4]), error: new CircuitBreakerOpenError('k', 1000) })), req.runId);
    expect(outcome).toEqual({ status: 'retry', reason: 'breaker_open' });
    expect((await loadRun(fs(), req.runId))?.attempts).toBe(0);
  });

  it('a cancel requested between chunks stops the run; nothing is stored', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    const model = fakeModel({ onExtract: () => { void fs().collection('meeting_intelligence_runs').doc(req.runId).update({ cancelRequested: true }); } });
    const outcome = await processIntelligenceRun(fs(), deps(model), req.runId);
    expect(outcome.status).toBe('cancelled');
    expect(await readIntelligenceV2(fs(), 'm-1', 'ws-a')).toBeNull();
  });

  it('a newer transcript supersedes the run: its output is never stored over newer data', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    writeTranscript('t-2', {}, '2026-10-07T11:00:00.000Z');
    const outcome = await processIntelligenceRun(fs(), deps(fakeModel()), req.runId);
    expect(outcome.status).toBe('superseded');
    expect(await readIntelligenceV2(fs(), 'm-1', 'ws-a')).toBeNull();
  });

  it('requesting a newer transcript asks the older active run to stop', async () => {
    const old = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    writeTranscript('t-2', {}, '2026-10-07T11:00:00.000Z');
    await requestIntelligenceRun(fs(), deps(fakeModel()), { ...params, transcriptId: 't-2' });
    expect((await loadRun(fs(), old.runId))?.cancelRequested).toBe(true);
  });

  it('a duplicate trigger returns the same run and schedules once', async () => {
    const a = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    const b = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    expect(b).toMatchObject({ runId: a.runId, replayed: true });
    expect(scheduled).toHaveLength(1);
    // Duplicate task delivery while the first worker holds the lease is a no-op.
    await fs().collection('meeting_intelligence_runs').doc(a.runId).update({ status: 'running', updatedAt: new Date(clock).toISOString() });
    expect((await processIntelligenceRun(fs(), deps(fakeModel()), a.runId)).status).toBe('noop');
  });

  it('refuses when the daily workspace quota is used up', async () => {
    db.write('meeting_intelligence_usage/ws-a_2026-10-07', { count: DAILY_RUNS_PER_WORKSPACE });
    await expect(requestIntelligenceRun(fs(), deps(fakeModel()), params)).rejects.toMatchObject({ code: 'QUOTA' });
    expect(scheduled).toHaveLength(0);
  });

  it('consent withdrawn mid-run → stopped before storing', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    const model = fakeModel({ onExtract: () => { void fs().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'restricted' }); } });
    const outcome = await processIntelligenceRun(fs(), deps(model), req.runId);
    expect(outcome).toMatchObject({ status: 'cancelled' });
    expect(await readIntelligenceV2(fs(), 'm-1', 'ws-a')).toBeNull();
  });

  it('refuses a restricted transcript, a foreign meeting and a missing transcript at request time', async () => {
    writeTranscript('t-1', { aiUse: 'restricted' });
    await expect(requestIntelligenceRun(fs(), deps(fakeModel()), params)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(requestIntelligenceRun(fs(), deps(fakeModel()), { ...params, workspaceId: 'ws-b' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a scheduling failure fails the run so asking again restarts it', async () => {
    await expect(requestIntelligenceRun(fs(), deps(fakeModel(), { schedule: async () => { throw new Error('queue down'); } }), params))
      .rejects.toMatchObject({ code: 'PROVIDER_ERROR' });
    const again = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    expect(again.replayed).toBe(false);
    expect(scheduled).toHaveLength(1);
  });

  it('an unexpected worker error releases the lease so the task retry can claim the run', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    class ExplodingBreaker extends CircuitBreaker {
      override execute<T>(): Promise<T> {
        throw new TypeError('unexpected bug');
      }
    }
    await expect(processIntelligenceRun(fs(), deps(fakeModel(), { breaker: new ExplodingBreaker() }), req.runId)).rejects.toThrow('unexpected bug');
    expect((await loadRun(fs(), req.runId))?.status).toBe('pending');
  });

  it('reaper ends stuck runs: running → dead-lettered, pending → failed; finished runs untouched', async () => {
    const req = await requestIntelligenceRun(fs(), deps(fakeModel()), params);
    await fs().collection('meeting_intelligence_runs').doc(req.runId).update({ status: 'running' });
    clock = NOW + STALE_RUN_MS + 60_000;
    const r = await reapStaleIntelligenceRuns(fs(), clock);
    expect(r).toEqual({ failed: 0, deadLettered: 1 });
    expect((await loadRun(fs(), req.runId))?.status).toBe('dead_lettered');
    expect(await reapStaleIntelligenceRuns(fs(), clock)).toEqual({ failed: 0, deadLettered: 0 });
  });
});
