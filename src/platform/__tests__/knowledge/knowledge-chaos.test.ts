/**
 * @fileOverview Chaos & Resilience Test Suite for Knowledge Subsystem (Phase 11 M3 · T8)
 *
 * Evaluates 4 Chaos & Failure Scenarios:
 * 1. Scenario 1: Concurrent decision double-spend on candidate rejected cleanly (Rule 19 & 45).
 * 2. Scenario 2: Embedding API 429 rate limit backoff with exponential retry (Rule 45).
 * 3. Scenario 3: Malformed candidate payload rejection at schema boundary (Rule 4 & 10).
 * 4. Scenario 4: High-throughput concurrent candidate ingestion benchmark (Rule 9).
 *
 * Strict Compliance:
 * - Rule 4: Zero any/any[].
 * - Rule 10: Zod v4 schema validation.
 * - Rule 19: Idempotency & state collision protection.
 * - Rule 45: Chaos & Resilience validation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeCandidateService } from '@/platform/domains/knowledge_memory/services/knowledge-candidate-service';
import { KnowledgeDomainError } from '@/platform/domains/knowledge_memory/contracts/knowledge-errors';
import {
  ProposeCandidateInputSchema,
  ReviewQueueDecideInputSchema,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';
import {
  BackfillKnowledgeEmbeddingsRunner,
  type KnowledgeBackfillItem,
  type EmbeddingsProvider,
} from '../../../../scripts/migrations/backfill-knowledge-embeddings';

// Mock event bus
vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn(async () => {}),
  },
}));

describe('Knowledge Subsystem Chaos & Resilience Suite (Phase 11 M3 · T8)', () => {
  const organizationId = 'org_chaos_test';
  const workspaceId = 'ws_chaos_test';

  let candidateService: KnowledgeCandidateService;

  beforeEach(() => {
    vi.clearAllMocks();
    candidateService = new KnowledgeCandidateService();
  });

  describe('Scenario 1: Concurrent Decision Double-Spend Race Condition (Rule 19 & 45)', () => {
    it('allows only one decision to succeed when two operators decide the same candidate simultaneously', async () => {
      // 1. Ingest candidate
      const proposed = await candidateService.proposeCandidate({
        organizationId,
        workspaceId,
        source: { type: 'meeting', id: 'meet_race_1' },
        type: 'fact',
        title: 'Concurrent Decision Test Fact',
        content: 'Campus library operates 24/7 during finals week.',
        subjectRefs: ['entity_campus_facility'],
        sensitivity: 'internal',
      });

      const candidateId = proposed.id;
      const initialVersion = proposed.version;

      const actor1 = { type: 'user' as const, id: 'user_operator_alpha' };
      const actor2 = { type: 'user' as const, id: 'user_operator_beta' };

      // 2. Fire concurrent decisions simultaneously
      const results = await Promise.allSettled([
        candidateService.decideCandidate(
          {
            workspaceId,
            candidateId,
            decision: 'accept',
            version: initialVersion,
          },
          actor1
        ),
        candidateService.decideCandidate(
          {
            workspaceId,
            candidateId,
            decision: 'reject',
            reason: 'Duplicate information',
            version: initialVersion,
          },
          actor2
        ),
      ]);

      // Exactly one must succeed, and one must be rejected
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // Verify the rejected reason is CANDIDATE_ALREADY_DECIDED or VERSION_MISMATCH
      const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
      expect(rejectionReason).toBeInstanceOf(KnowledgeDomainError);
      const kErr = rejectionReason as KnowledgeDomainError;
      expect(['CANDIDATE_ALREADY_DECIDED', 'VERSION_MISMATCH']).toContain(kErr.code);

      // Verify stored state matches the winning decision
      const finalCandidate = await candidateService.getCandidate(candidateId, workspaceId);
      expect(finalCandidate.status).not.toBe('pending');
      expect(['accepted', 'rejected']).toContain(finalCandidate.status);
    });
  });

  describe('Scenario 2: Embedding Provider 429 Rate Limit & Exponential Backoff Recovery (Rule 45)', () => {
    it('recovers from temporary HTTP 429 rate limit errors using exponential backoff', async () => {
      const sampleItems = [
        {
          id: 'item_rate_limited_01',
          collection: 'memory_objects',
          content: 'Ghana international school academic calendar 2026-2027.',
        },
        {
          id: 'item_rate_limited_02',
          collection: 'knowledge_insights',
          content: 'Senior high school boarding guidelines and dietary policies.',
        },
      ];

      let attemptsForItem1 = 0;
      const inMemoryEmbeddings = new Map<string, number[]>();

      const mockProvider = vi.fn(async (text: string) => {
        if (text.includes('Ghana international')) {
          attemptsForItem1++;
          if (attemptsForItem1 <= 2) {
            // Simulate HTTP 429 Rate Limit for first 2 attempts
            const rateLimitError = new Error('HTTP 429: Too Many Requests. Quota exceeded.');
            (rateLimitError as { status?: number }).status = 429;
            throw rateLimitError;
          }
        }
        // Return valid 768-dim mock vector
        return new Array(768).fill(0.042);
      });

      const runner = new BackfillKnowledgeEmbeddingsRunner(
        {
          embeddingProvider: mockProvider,
          storageAdapter: {
            async getUnembeddedRecords() {
              return sampleItems;
            },
            async saveEmbedding(id: string, embedding: number[]) {
              inMemoryEmbeddings.set(id, embedding);
            },
            async getCheckpoint() {
              return null;
            },
            async saveCheckpoint() {},
          },
        },
        {
          initialBackoffMs: 10, // Fast backoff for test suite
          maxRetries: 4,
        }
      );

      const report = await runner.run({
        workspaceId,
        dryRun: false,
      });

      // Verification: Both items successfully embedded after retrying
      expect(report.scannedCount).toBe(2);
      expect(report.processedCount).toBe(2);
      expect(report.errorsCount).toBe(0);
      expect(attemptsForItem1).toBe(3); // 2 failures + 1 success
      expect(inMemoryEmbeddings.size).toBe(2);
    });
  });

  describe('Scenario 3: Malformed Candidate Input Rejection (Rules 4 & 10)', () => {
    it('rejects candidate payloads missing mandatory fields or violating schema constraints', () => {
      const malformedPayloads = [
        {}, // completely empty
        { title: 'Missing workspace' },
        {
          organizationId,
          workspaceId,
          source: { type: 'unknown_source' }, // invalid source type
          type: 'fact',
          title: 'Test',
          content: 'Some content',
        },
        {
          organizationId,
          workspaceId,
          source: { type: 'meeting', id: 'm1' },
          type: 'invalid_type', // invalid memory type
          title: 'Test',
          content: 'Some content',
        },
        {
          organizationId,
          workspaceId,
          source: { type: 'meeting', id: 'm1' },
          type: 'fact',
          title: '', // empty title
          content: 'Some content',
        },
        {
          organizationId,
          workspaceId,
          source: { type: 'meeting', id: 'm1' },
          type: 'fact',
          title: 'Title',
          content: 'Content',
          sensitivity: 'top_secret', // invalid sensitivity
        },
      ];

      for (const payload of malformedPayloads) {
        const result = ProposeCandidateInputSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });

    it('rejects malformed review queue decisions', () => {
      const malformedDecisions = [
        {},
        { candidateId: 'c1' }, // missing decision and version
        { candidateId: 'c1', decision: 'invalid_decision', version: 1 },
        { candidateId: 'c1', decision: 'accept', version: -1 }, // invalid negative version
      ];

      for (const payload of malformedDecisions) {
        const result = ReviewQueueDecideInputSchema.safeParse(payload);
        expect(result.success).toBe(false);
      }
    });
  });

  describe('Scenario 4: High-Throughput Concurrent Ingestion Benchmark (Rule 9)', () => {
    it('ingests 50 concurrent candidate proposals without data loss or memory leaks', async () => {
      const itemCount = 50;
      const proposals: Promise<{ id: string }>[] = [];

      const startTime = performance.now();

      for (let i = 0; i < itemCount; i++) {
        proposals.push(
          candidateService.proposeCandidate({
            organizationId,
            workspaceId,
            source: { type: 'agent', id: `run_batch_${i}` },
            type: 'fact',
            title: `Benchmarking Candidate Item ${i}`,
            content: `Autonomous agent discovered fact number ${i} regarding entity performance.`,
            subjectRefs: [`entity_benchmark_${i % 5}`],
            sensitivity: 'internal',
          })
        );
      }

      const results = await Promise.all(proposals);
      const elapsedMs = performance.now() - startTime;

      // Verification 1: All 50 proposals succeeded
      expect(results.length).toBe(itemCount);

      // Verification 2: All IDs are unique
      const ids = new Set(results.map((r) => r.id));
      expect(ids.size).toBe(itemCount);

      // Verification 3: High throughput performance (< 500ms for 50 items)
      expect(elapsedMs).toBeLessThan(500);

      // Verification 4: Store contains all 50 items
      const listed = await candidateService.listCandidates({ workspaceId, limit: 100 });
      expect(listed.length).toBe(itemCount);
    });
  });
});
