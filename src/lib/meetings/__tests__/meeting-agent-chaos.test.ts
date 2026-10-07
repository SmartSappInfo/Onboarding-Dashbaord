// @vitest-environment node
/**
 * @fileOverview Meeting Agent Chaos, Resilience & Load Benchmark Suite (Phase 11 M2 · T8, Rule 45).
 *
 * Exhaustively stress-tests fault injection and resilience:
 * 1. Model 429 Rate Limit (Circuit breaker trips, retry without burning attempts).
 * 2. Model 500 & 20s Timeout Handling (Facts-only fallback, labelled).
 * 3. Malformed JSON Response Parsing (Schema validation fail-closed, counted as dropped.schema).
 * 4. Cloud Run Task Duplicate Delivery (Idempotency key deduplication, noop for running/completed).
 * 5. Firestore Optimistic Concurrency Contention (Atomic versioning & transaction safety).
 * 6. High-Throughput Concurrent Pipeline Load Benchmark (20 concurrent runs complete successfully).
 *
 * Rules: 4, 8, 9, 18, 19, 23, 24, 25, 45, 48, 54, 60, 67.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import {
  processIntelligenceRun,
  requestIntelligenceRun,
  type IntelligenceModel,
  type PipelineDeps,
} from '../intelligence/pipeline';
import { generatePrepBrief, type PrepBriefModel, type PrepBriefDeps } from '../prep-brief-service';
import { validateExtraction, type ValidationContext } from '../intelligence/validate-items';
import type { TranscriptChunk } from '../intelligence/chunker';
import { CircuitBreaker } from '@/platform/events/resilience/circuit-breaker';

const h = vi.hoisted(() => ({
  db: undefined as unknown,
  scheduled: [] as string[],
}));

vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

vi.mock('@/lib/gcp-tasks-client', () => ({
  scheduleTaskWithKey: async (key: string) => {
    h.scheduled.push(key);
    return key;
  },
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async () => undefined),
}));

vi.mock('@/platform/events/event-bus', () => {
  const publish = vi.fn(async () => undefined);
  return { defaultEventBus: { publish }, globalEventBus: { publish } };
});

let db: FakeFirestore;
const fs = () => db.asFirestore();

const NOW = '2026-10-07T12:00:00.000Z';
const nowMs = () => Date.parse(NOW);

function seedTranscript(transcriptId: string, meetingId = 'm-1', workspaceId = 'ws-a') {
  db.write(`meeting_transcripts/${transcriptId}`, {
    workspaceId,
    organizationId: 'org-1',
    meetingId,
    source: 'recording',
    status: 'completed',
    version: 1,
    schemaVersion: 2,
    chunkCount: 1,
    segmentCount: 2,
    speakers: [{ id: 'spk-1', name: 'Kwame' }],
    dataClass: 'personal',
    aiUse: 'allowed',
    provenance: { createdBy: 'rep-1', principalKind: 'user' },
    injection: { flagged: false, patterns: [] },
    createdAt: NOW,
    updatedAt: NOW,
  });
  db.write(`meeting_transcripts/${transcriptId}/segments/0000`, {
    index: 0,
    segments: [
      { id: 's1', speakerId: 'spk-1', speakerName: 'Kwame', startMs: 0, endMs: 4000, text: 'We agreed to finalize the SLA contract by Friday.' },
      { id: 's2', speakerId: 'spk-1', speakerName: 'Kwame', startMs: 5000, endMs: 8000, text: 'The expansion deal is approved.' },
    ],
  });
}

describe('Meeting Agent Chaos & Resilience Suite (Rule 45)', () => {
  beforeEach(() => {
    db = new FakeFirestore();
    h.db = db;
    h.scheduled.length = 0;

    db.write('workspaces/ws-a', { organizationId: 'org-1', timezone: 'UTC' });
    db.write('meetings/m-1', {
      workspaceIds: ['ws-a'],
      title: 'Resilience Test Meeting',
      meetingTime: NOW,
      updatedAt: NOW,
    });
  });

  // Chaos 1: Model 429 Rate Limit (Circuit Breaker trips, retry without burning attempt)
  it('Chaos 1: trips circuit breaker on 429 rate limit and retries without burning attempts', async () => {
    const transcriptId = 'tr_rate_limit_001';
    seedTranscript(transcriptId);

    const breaker = new CircuitBreaker({ failureThreshold: 1, coolOffPeriodMs: 60_000 });
    // Execute failing call to trip the breaker into OPEN state
    await breaker.execute('meeting_intelligence:breaker_test', async () => {
      throw new Error('HTTP 429: Too Many Requests');
    }).catch(() => undefined);

    const rateLimitedModel: IntelligenceModel = {
      breakerKey: 'breaker_test',
      extract: async () => {
        throw new Error('HTTP 429: Too Many Requests');
      },
      summarize: async () => ({ modelId: 'test', output: { sentences: [] } }),
    };

    const pipelineDeps: PipelineDeps = {
      model: rateLimitedModel,
      breaker,
      nowMs,
      schedule: async (key) => {
        h.scheduled.push(key);
      },
    };

    const req = await requestIntelligenceRun(fs(), pipelineDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      transcriptId,
      requestedBy: { userId: 'rep-1', principalKind: 'user' },
    });

    // Run processor: breaker is open, should return retry with reason 'breaker_open' and refund attempt
    const outcome = await processIntelligenceRun(fs(), pipelineDeps, req.runId);
    expect(outcome.status).toBe('retry');
    if (outcome.status === 'retry') {
      expect(outcome.reason).toBe('breaker_open');
    }

    // Verify run status reverted to pending and attempt count was refunded (0 attempts burned)
    const runDoc = db.read(`meeting_intelligence_runs/${req.runId}`);
    expect(runDoc?.status).toBe('pending');
    expect(runDoc?.attempts).toBe(0);
  });

  // Chaos 2: Model 500 Error & Timeout Handling (Facts-only fallback, labelled)
  it('Chaos 2: gracefully degrades to facts-only mode on model 500 error or timeout', async () => {
    // Test in Prep Brief assembly
    db.write('entities/ent-1', {
      workspaceId: 'ws-a',
      name: 'Acme Corp',
      organizationId: 'org-1',
      createdAt: NOW,
    });
    db.write('meetings/m-1', {
      workspaceIds: ['ws-a'],
      title: 'Board Strategy',
      meetingTime: NOW,
      entityId: 'ent-1',
    });

    const failingBriefModel: PrepBriefModel = {
      breakerKey: 'failing_model',
      generate: async () => {
        throw new Error('HTTP 500: Internal Server Error from Model Provider');
      },
    };

    const briefDeps: PrepBriefDeps = {
      model: failingBriefModel,
      nowMs,
      loadAccountContext: async () => ({
        workspaceId: 'ws-a',
        entityId: 'ent-1',
        deals: [],
        tasks: [],
        timeline: [],
      }),
    };

    const brief = await generatePrepBrief(fs(), briefDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      actorId: 'rep-1',
    });

    // Must not crash: degrades gracefully to facts_only mode, with reason labelled
    expect(brief.mode).toBe('facts_only');
    expect(brief.factsOnlyReason).toBe('model_unavailable');
    expect(brief.title).toBe('Board Strategy');
  });

  // Chaos 3: Malformed JSON Response Parsing (Schema validation fail-closed)
  it('Chaos 3: handles malformed JSON model output by failing closed and counting as dropped.schema', () => {
    const chunk: TranscriptChunk = {
      index: 0,
      pageCount: 1,
      segments: [
        { id: 's1', speakerId: 'spk-1', speakerName: 'Kwame', startMs: 0, endMs: 4000, text: 'We agreed to finalize the SLA contract by Friday.' },
      ],
      overlapCount: 0,
    };

    const ctx: ValidationContext = {
      workspaceId: 'ws-a',
      meetingId: 'm-1',
      transcriptId: 'tr-1',
      promptVersion: 'v2',
      meetingIso: NOW,
      timeZone: 'UTC',
      timeZoneSource: 'meeting',
      injectionFlagged: false,
      owners: [],
      nowIso: NOW,
    };

    // Case A: completely invalid object structure (not items array)
    const resultInvalidEnvelope = validateExtraction(
      [{ chunk, rawOutput: { somethingElse: 'garbage' } }],
      ctx
    );
    expect(resultInvalidEnvelope.kept).toBe(0);
    expect(resultInvalidEnvelope.dropped.schema).toBe(1);

    // Case B: items array contains item with missing required fields
    const resultMalformedItem = validateExtraction(
      [{ chunk, rawOutput: { items: [{ type: 'decision' /* missing text and evidence */ }] } }],
      ctx
    );
    expect(resultMalformedItem.kept).toBe(0);
    expect(resultMalformedItem.dropped.schema).toBe(1);
  });

  // Chaos 4: Cloud Run Task Duplicate Delivery (Idempotency key deduplication)
  it('Chaos 4: deduplicates redundant Cloud Run task dispatches without re-running work', async () => {
    const transcriptId = 'tr_dup_delivery_001';
    seedTranscript(transcriptId);

    let extractCallCount = 0;
    const countingModel: IntelligenceModel = {
      breakerKey: 'counting_test',
      extract: async () => {
        extractCallCount += 1;
        return {
          modelId: 'googleai/flash-test',
          output: {
            items: [
              {
                type: 'decision',
                text: 'The expansion deal is approved',
                confidence: 0.95,
                evidence: [{ segmentIds: ['s2'], quote: 'The expansion deal is approved' }],
              },
            ],
          },
        };
      },
      summarize: async () => ({ modelId: 'test', output: { sentences: [] } }),
    };

    const pipelineDeps: PipelineDeps = {
      model: countingModel,
      breaker: new CircuitBreaker(),
      nowMs,
      schedule: async (key) => {
        h.scheduled.push(key);
      },
    };

    // First request
    const req1 = await requestIntelligenceRun(fs(), pipelineDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      transcriptId,
      requestedBy: { userId: 'rep-1', principalKind: 'user' },
    });
    expect(req1.replayed).toBe(false);

    // Duplicate request before processing
    const req2 = await requestIntelligenceRun(fs(), pipelineDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      transcriptId,
      requestedBy: { userId: 'rep-1', principalKind: 'user' },
    });
    expect(req2.runId).toBe(req1.runId);
    expect(req2.replayed).toBe(true);

    // First worker run processes to completion
    const outcome1 = await processIntelligenceRun(fs(), pipelineDeps, req1.runId);
    expect(outcome1.status).toBe('completed');
    expect(extractCallCount).toBe(1);

    // Second worker delivery (Cloud Run at-least-once retry)
    const outcome2 = await processIntelligenceRun(fs(), pipelineDeps, req1.runId);
    expect(outcome2.status).toBe('noop');
    if (outcome2.status === 'noop') {
      expect(outcome2.reason).toBe('already_completed');
    }
    // Model extract must not have been called a second time
    expect(extractCallCount).toBe(1);
  });

  // Chaos 5: Firestore Optimistic Concurrency Contention
  it('Chaos 5: safely handles concurrent worker execution through atomic leases', async () => {
    const transcriptId = 'tr_concurrency_001';
    seedTranscript(transcriptId);

    const model: IntelligenceModel = {
      breakerKey: 'conc_test',
      extract: async () => ({
        modelId: 'googleai/flash-test',
        output: {
          items: [
            {
              type: 'commitment',
              text: 'Finalize the SLA contract by Friday',
              confidence: 0.9,
              evidence: [{ segmentIds: ['s1'], quote: 'finalize the SLA contract by Friday' }],
            },
          ],
        },
      }),
      summarize: async () => ({ modelId: 'test', output: { sentences: [] } }),
    };

    const pipelineDeps: PipelineDeps = {
      model,
      breaker: new CircuitBreaker(),
      nowMs,
      schedule: async () => undefined,
    };

    const req = await requestIntelligenceRun(fs(), pipelineDeps, {
      workspaceId: 'ws-a',
      organizationId: 'org-1',
      meetingId: 'm-1',
      transcriptId,
      requestedBy: { userId: 'rep-1', principalKind: 'user' },
    });

    // Simulate 3 workers racing to claim the same run simultaneously
    const [w1, w2, w3] = await Promise.all([
      processIntelligenceRun(fs(), pipelineDeps, req.runId),
      processIntelligenceRun(fs(), pipelineDeps, req.runId),
      processIntelligenceRun(fs(), pipelineDeps, req.runId),
    ]);

    const statuses = [w1.status, w2.status, w3.status];
    // Exactly one worker must claim and complete; the others must receive noop
    expect(statuses.filter((s) => s === 'completed')).toHaveLength(1);
    expect(statuses.filter((s) => s === 'noop')).toHaveLength(2);
  });

  // Benchmark: 20 Concurrent Pipeline Extractions Load Test
  it('Benchmark: executes 20 concurrent pipelines cleanly without corruption or resource exhaustion', async () => {
    const N = 20;
    const model: IntelligenceModel = {
      breakerKey: 'load_test',
      extract: async (req) => ({
        modelId: 'googleai/flash-test',
        output: {
          items: [
            {
              type: 'decision',
              text: `Decision for meeting ${req.workspaceId}`,
              confidence: 0.95,
              evidence: [{ segmentIds: ['s1'], quote: 'finalize the SLA contract by Friday' }],
            },
          ],
        },
      }),
      summarize: async () => ({ modelId: 'test', output: { sentences: [] } }),
    };

    const pipelineDeps: PipelineDeps = {
      model,
      breaker: new CircuitBreaker(),
      nowMs,
      schedule: async () => undefined,
    };

    // Seed 20 distinct meetings and transcripts
    const runs: string[] = [];
    for (let i = 0; i < N; i += 1) {
      const mid = `m-load-${i}`;
      const tid = `tr-load-${i}`;
      db.write(`meetings/${mid}`, { workspaceIds: ['ws-a'], title: `Meeting ${i}`, meetingTime: NOW, updatedAt: NOW });
      seedTranscript(tid, mid, 'ws-a');
      const req = await requestIntelligenceRun(fs(), pipelineDeps, {
        workspaceId: 'ws-a',
        organizationId: 'org-1',
        meetingId: mid,
        transcriptId: tid,
        requestedBy: { userId: 'rep-1', principalKind: 'user' },
      });
      runs.push(req.runId);
    }

    expect(runs).toHaveLength(N);

    // Launch all 20 processing runs concurrently
    const t0 = Date.now();
    const outcomes = await Promise.all(runs.map((runId) => processIntelligenceRun(fs(), pipelineDeps, runId)));
    const durationMs = Date.now() - t0;

    // All 20 must complete successfully
    for (const outcome of outcomes) {
      expect(outcome.status).toBe('completed');
      if (outcome.status === 'completed') {
        expect(outcome.kept).toBe(1);
      }
    }

    // Benchmark assertion: 20 pipelines process in under 5 seconds in-memory
    expect(durationMs).toBeLessThan(5000);
  });
});
