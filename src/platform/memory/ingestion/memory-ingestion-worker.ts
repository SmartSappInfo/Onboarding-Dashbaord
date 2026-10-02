/**
 * @fileOverview Background Memory Ingestion Worker (Phase 4 Milestone 3)
 *
 * Implements Cloud Run blueprint §5.2, CompanyBrain PRD §77 & §109,
 * Rule 4 (Zero-any), Rules 8 & 47 (Fail-Closed Multi-Tenant ACL),
 * Rule 9 (Load Bounds: <=20 docs/lease), Rules 13 & 30 (Model Distrust & Anti-Poisoning),
 * Rule 18 (Concurrency & Idempotency), Rule 22 (SHA-256 Deduplication),
 * Rule 24 (Resilient Fallback), Rule 26 (Distributed Tracing),
 * Rule 34 (SSRF URL Guard), Rule 40 (Domain Event Bus), and Rule 60 (Dead-Man Switch).
 *
 * @testability Covered in `src/platform/__tests__/memory/memory-ingestion-worker.test.ts`.
 */

import {
  INGESTION_ERROR_CODES,
  IngestionResult,
  IngestionResultSchema,
  MemoryIngestionJobPayload,
  MemoryIngestionJobPayloadSchema,
} from './ingestion-types';
import { DocumentChunker } from './document-chunker';
import {
  EmbeddingProvider,
  DeterministicMemoryEmbeddingProvider,
} from './embedding-service';
import { CanonicalMemoryService } from '../services/canonical-memory-service';
import { checkGovernanceDeadManSwitch } from '../../policy/governance-dead-man';
import { validateSafeEgressUrl } from '../../security/safe-url-fetch';
import { evaluateMemoryContentRisk } from '../governance/anti-poisoning';
import { defaultEventBus, EventBus } from '../../events/event-bus';
import { createDomainEvent } from '../../capabilities/events/domain-event';

export interface MemoryIngestionWorkerDependencies {
  memoryService?: CanonicalMemoryService;
  embeddingProvider?: EmbeddingProvider;
  eventBus?: EventBus;
  checkDeadMan?: (orgId: string) => Promise<void>;
  validateUrl?: typeof validateSafeEgressUrl;
  nowMs?: () => number;
}

export async function processMemoryIngestionJob(
  rawPayload: MemoryIngestionJobPayload,
  deps: MemoryIngestionWorkerDependencies = {}
): Promise<IngestionResult> {
  const startTime = (deps.nowMs ?? Date.now)();

  // 1. Schema Validation (Rule 4)
  const payload = MemoryIngestionJobPayloadSchema.parse(rawPayload);
  const { jobId, organizationId, workspaceId, targets, chunkingOptions, correlationId } = payload;

  // 2. Gate 1: Fail-Closed Tenant ACL (Rules 8 & 47)
  if (!organizationId.trim() || !workspaceId.trim()) {
    throw new Error(INGESTION_ERROR_CODES.TENANT_REQUIRED);
  }

  // 3. Gate 2: Operator Emergency Dead-Man Switch (Rule 60)
  const deadManChecker = deps.checkDeadMan ?? checkGovernanceDeadManSwitch;
  try {
    await deadManChecker(organizationId);
  } catch {
    throw new Error(INGESTION_ERROR_CODES.DEAD_MAN_PAUSED);
  }

  // 4. Resolve Services
  const embeddingProvider = deps.embeddingProvider ?? new DeterministicMemoryEmbeddingProvider();
  const memoryService =
    deps.memoryService ??
    new CanonicalMemoryService({
      embeddingProvider,
    });
  const eventBus = deps.eventBus ?? defaultEventBus;
  const urlValidator = deps.validateUrl ?? validateSafeEgressUrl;

  let indexedDocuments = 0;
  let totalChunks = 0;
  let duplicateChunksSkipped = 0;
  const errors: string[] = [];
  const seenWorkspaceHashes = new Set<string>();

  // 5. Process Targets (Bounded to <= 20 docs, Rule 9)
  for (const target of targets) {
    try {
      // Gate 3: SSRF Boundary Check for Source URLs (Rule 34)
      if (target.sourceUrl) {
        try {
          await urlValidator(target.sourceUrl);
        } catch (urlErr) {
          const reason = urlErr instanceof Error ? urlErr.message : 'Blocked URL target';
          throw new Error(`${INGESTION_ERROR_CODES.SSRF_VIOLATION}: ${reason}`);
        }
      }

      // Gate 4: Anti-Poisoning & Content Sanitization (Rules 13 & 30)
      const risk = evaluateMemoryContentRisk(target.content);
      const cleanContent = risk.sanitized;

      // Gate 5: Hierarchical Semantic Chunking
      const chunks = DocumentChunker.chunk(target.sourceId, cleanContent, chunkingOptions);
      if (chunks.length === 0) {
        continue;
      }

      // Gate 6: Deduplication Check (Rule 22)
      const nonDuplicateChunks = [];
      for (const ch of chunks) {
        if (seenWorkspaceHashes.has(ch.contentHash)) {
          duplicateChunksSkipped++;
        } else {
          seenWorkspaceHashes.add(ch.contentHash);
          nonDuplicateChunks.push(ch);
        }
      }

      if (nonDuplicateChunks.length === 0) {
        indexedDocuments++;
        continue;
      }

      // Gate 7: Batch Embedding Generation (Rule 20)
      const chunkTexts = nonDuplicateChunks.map((c) => c.content);
      const embeddings = await embeddingProvider.embedBatch(chunkTexts);

      // Gate 8: Dual Ingestion via CanonicalMemoryService
      for (let i = 0; i < nonDuplicateChunks.length; i++) {
        const chunk = nonDuplicateChunks[i];
        const vector = embeddings[i];

        const title = chunk.heading
          ? `${target.title ?? target.sourceId} - ${chunk.heading}`
          : target.title ?? `${target.sourceId} (Chunk ${chunk.position + 1})`;

        await memoryService.createMemoryItem({
          organizationId,
          workspaceId,
          tier: 'semantic',
          type: 'document_chunk',
          title,
          content: chunk.content,
          summary: target.summary,
          source: {
            type: target.sourceType,
            sourceId: target.sourceId,
            sourceUrl: target.sourceUrl,
            sourceHash: chunk.contentHash,
          },
          subjectRefs: {
            ...target.subjectRefs,
            documentIds: Array.from(
              new Set([...(target.subjectRefs.documentIds ?? []), target.sourceId])
            ),
          },
          topics: target.topics,
          importance: target.importance,
          confidence: target.confidence,
          sensitivity: target.sensitivity,
          validUntil: target.validUntil,
          provenance: {
            createdBy: target.authorId ? 'user' : 'system',
            userId: target.authorId,
            sourceHash: chunk.contentHash,
          },
          vector,
        });

        totalChunks++;
      }

      indexedDocuments++;
    } catch (targetErr) {
      const errMsg =
        targetErr instanceof Error ? targetErr.message : 'Unknown target ingestion error';
      errors.push(`Target ${target.sourceId}: ${errMsg}`);
    }
  }

  const durationMs = (deps.nowMs ?? Date.now)() - startTime;
  const status =
    errors.length === 0
      ? 'success'
      : indexedDocuments > 0
      ? 'partial_failure'
      : 'failed';

  // 6. Gate 9: Domain Event Bus Emission (Rule 40)
  try {
    await eventBus.publish(
      createDomainEvent({
        type: 'memory.ingestion.completed',
        organizationId,
        workspaceId,
        source: 'memory_ingestion_worker',
        correlationId: correlationId || crypto.randomUUID(),
        actor: {
          id: 'system_memory_indexer',
          type: 'system',
        },
        entity: {
          id: jobId,
          type: 'memory_ingestion_job',
        },
        payload: {
          jobId,
          status,
          indexedDocuments,
          totalChunks,
          duplicateChunksSkipped,
          latencyMs: durationMs,
          correlationId: correlationId || '',
        },
      })
    );
  } catch (eventErr) {
    console.warn('[MemoryIngestionWorker] Failed to publish ingestion completion event:', eventErr);
  }

  return IngestionResultSchema.parse({
    jobId,
    organizationId,
    workspaceId,
    status,
    indexedDocuments,
    totalChunks,
    duplicateChunksSkipped,
    latencyMs: durationMs,
    errors,
  });
}
