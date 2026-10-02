/**
 * @fileOverview Knowledge Ingestion Contracts & Taxonomy (Phase 4 Milestone 3)
 *
 * ARCHITECTURAL INVARIANTS & MAINTAINER NOTES (Rules 4, 8, 10, 16, 22, 26, 47):
 * 1. Strict Zero-`any` Standard (Rule 4):
 *    - All schemas are fully specified with Zod v4 and explicit inferred TypeScript types.
 *    - Unknown boundary data must be narrowed immediately.
 * 2. Multi-Tenant Fail-Closed Isolation (Rules 8 & 47):
 *    - All ingestion payloads require non-empty organizationId and workspaceId.
 * 3. Provenance & Cryptographic Hashing (Rules 16 & 22):
 *    - Every chunk retains source metadata, heading hierarchy breadcrumbs, and SHA-256 content hash.
 * 4. Distributed Tracing (Rule 26):
 *    - Carries correlationId across Cloud Tasks and domain telemetry.
 * 5. Bounded Batch Limits (Rule 9):
 *    - Maximum 20 document targets per batch lease; maximum 500 chunks per document.
 *
 * @testability Covered in `src/platform/__tests__/memory/document-chunker.test.ts`.
 */

import { z } from 'zod';
import {
  MemorySourceTypeSchema,
  SensitivityLevelSchema,
  SubjectReferencesSchema,
} from '../contracts/memory-types';

export const DocumentChunkSchema = z.object({
  chunkId: z.string().min(1),
  position: z.number().int().min(0),
  content: z.string().min(1),
  characterCount: z.number().int().min(1),
  tokenCountEstimate: z.number().int().min(1),
  heading: z.string().optional(),
  sectionBreadcrumbs: z.array(z.string()).default([]),
  contentHash: z.string().length(64), // SHA-256 (Rule 22)
  pageNumber: z.number().int().positive().optional(),
});
export type DocumentChunk = z.infer<typeof DocumentChunkSchema>;

export const ChunkingOptionsSchema = z.object({
  targetTokens: z.number().int().min(50).max(2000).default(500),
  tokenOverlap: z.number().int().min(0).max(500).default(50),
  maxChunks: z.number().int().min(1).max(500).default(100), // Rule 9 load ceiling
  preserveHeadings: z.boolean().default(true),
});
export type ChunkingOptions = z.infer<typeof ChunkingOptionsSchema>;

export const MemoryIngestionTargetSchema = z.object({
  sourceType: MemorySourceTypeSchema,
  sourceId: z.string().min(1),
  sourceUrl: z.string().url().optional(), // Verified by SSRF guard (Rule 34)
  title: z.string().optional(),
  content: z.string().min(1),
  summary: z.string().optional(),
  authorName: z.string().optional(),
  authorId: z.string().optional(),
  sensitivity: SensitivityLevelSchema.default('internal'),
  importance: z.number().min(0.0).max(1.0).default(0.5),
  confidence: z.number().min(0.0).max(1.0).default(1.0),
  topics: z.array(z.string()).default([]),
  subjectRefs: SubjectReferencesSchema.default({}),
  validUntil: z.string().datetime().optional(), // Rule 29 temporal invalidation
  customMetadata: z.record(z.string(), z.unknown()).default({}),
});
export type MemoryIngestionTarget = z.infer<typeof MemoryIngestionTargetSchema>;

export const MemoryIngestionJobPayloadSchema = z.object({
  jobId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  idempotencyKey: z.string().min(1),
  correlationId: z.string().optional(), // Rule 26 distributed trace
  targets: z.array(MemoryIngestionTargetSchema).min(1).max(20), // Max 20 docs per batch (Rule 9)
  chunkingOptions: ChunkingOptionsSchema.optional(),
  createdAt: z.string().datetime(),
});
export type MemoryIngestionJobPayload = z.infer<typeof MemoryIngestionJobPayloadSchema>;

export const IngestionResultSchema = z.object({
  jobId: z.string(),
  organizationId: z.string(),
  workspaceId: z.string(),
  status: z.enum(['success', 'partial_failure', 'failed']),
  indexedDocuments: z.number().int().min(0),
  totalChunks: z.number().int().min(0),
  duplicateChunksSkipped: z.number().int().min(0),
  latencyMs: z.number().min(0),
  errors: z.array(z.string()).default([]),
});
export type IngestionResult = z.infer<typeof IngestionResultSchema>;

export const INGESTION_ERROR_CODES = {
  TENANT_REQUIRED: 'INGESTION_TENANT_REQUIRED',
  PAYLOAD_TOO_LARGE: 'INGESTION_PAYLOAD_TOO_LARGE',
  CHUNK_EMPTY: 'INGESTION_CHUNK_EMPTY',
  EMBEDDING_FAILED: 'INGESTION_EMBEDDING_FAILED',
  INDEXING_FAILED: 'INGESTION_INDEXING_FAILED',
  DEAD_MAN_PAUSED: 'INGESTION_DEAD_MAN_PAUSED',
  UNAUTHORIZED: 'INGESTION_UNAUTHORIZED',
  SSRF_VIOLATION: 'INGESTION_SSRF_VIOLATION',
} as const;
