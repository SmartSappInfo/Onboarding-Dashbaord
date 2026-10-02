# Phase 4 Milestone 3 Implementation Plan (Rule-Hardened)
## Knowledge Ingestion Pipeline, Document Chunking & Cloud Tasks Indexer

**Target:** Automated asynchronous knowledge ingestion pipeline converting CRM notes, meeting transcripts, uploaded PDFs/markdown, and portal lessons into vectorized, chunked canonical memory records via Google Cloud Tasks.  
**Lead Architect:** Senior Principal Systems & AI Agentic Architecture Engineer  
**Date:** October 2026  
**Status:** **APPROVED & RULE-ALIGNED**  
**Governing Architecture Documents:**
- SmartSapp Agentic Development Rules (`docs/agents_mcp/agents_mcp_rules.md`)
- CompanyBrain PRD (§§21, 28, 77, 109, 113, 114) (`docs/CompanyBrain/companybrain_prd.md`)
- Unified 5-Tier Memory & Knowledge Architecture (`docs/agentic/08-memory-model.md`)
- Cloud Run & Cloud Tasks Architecture (`docs/agents_mcp/agents_mcp_cloudrun.md`)
- Phase 4 Master Architecture Plan (`docs/agents_mcp/phases/agents_mcp_phase_4_master_plan.md`)

---

## 1. Executive Summary & Architectural Invariants

Phase 4 Milestone 3 completes the write-side knowledge plane of SmartSapp. It bridges raw business activity across the platform (CRM notes, meeting transcripts, uploaded files, deal stage transitions, portal lessons) into vectorized, semantically structured memory records consumable by downstream agents and the 8-step Context Retrieval Pipeline built in Milestone 2.

### Core Architectural Invariants:
1. **Asynchronous Cloud Tasks Decoupling (Rules 9, 25 & Cloud Run §5.2):** Heavy chunking and dense vector embedding operations run exclusively out-of-band via Cloud Tasks (`/api/tasks/memory-indexer`), ensuring HTTP user requests never block on LLM embedding latency or exceed Cloud Run memory budgets.
2. **Fail-Closed Multi-Tenant Isolation (Rules 8 & 47):** Every chunker, embedding provider, task worker, and route handler requires non-empty `organizationId` and `workspaceId`. Any omitted tenant parameter aborts immediately with `INGESTION_TENANT_REQUIRED`.
3. **Model Distrust & Anti-Poisoning (Rules 13 & 30):** All external documents and customer notes are pre-scanned for prompt injection vectors (`evaluateMemoryContentRisk`) and neutralized before chunking; evidence is wrapped in canonical `<untrusted_reference_data>` XML containers.
4. **Idempotency & Cryptographic Content Hashing (Rules 18 & 22):** Every chunk receives a deterministic SHA-256 content hash (`contentHash`). Unchanged chunks are deduplicated in $O(1)$ time, eliminating duplicate vector store storage and redundant API embedding costs.
5. **Rate-Limiting & Quota Defense (Rules 9, 20 & 24):** In-memory 500-slot SHA-256 LRU cache + concurrency throttle ($\le 5$ simultaneous embedding calls) + exponential backoff with jitter prevent API quota exhaustion (HTTP 429).
6. **SSRF & Boundary Controls (Rule 34):** Ingested document URLs route through `validateSafeEgressUrl` to block access to internal metadata IP ranges (`169.254.169.254`, localhost, RFC1918 private subnets).
7. **Operator Emergency Dead-Man Switch (Rule 60):** Before any autonomous embedding or indexing step runs, `checkGovernanceDeadManSwitch(organizationId)` is verified. If an emergency pause is active, execution halts immediately with `INGESTION_DEAD_MAN_PAUSED`.
8. **Strangler Fig Invariant (Rule 69):** Authored in `src/platform/memory/ingestion/` and `src/platform/memory/subscribers/`; legacy `src/lib/memory/` remains completely untouched with 100% of its 60 unit tests passing.

---

## 2. Target File Structure & Module Responsibilities

```
src/platform/memory/
├── contracts/
│   ├── memory-types.ts              <-- [Augment] Support optional pre-computed vector on CreateMemoryInputSchema
│   └── index.ts
├── ingestion/                       <-- [NEW MODULE]
│   ├── ingestion-types.ts           <-- Zod v4 schemas for DocumentChunk, ChunkingOptions, IngestionPayload & Error Taxonomy
│   ├── document-chunker.ts          <-- Recursive token-aware chunker, heading hierarchy & SHA-256 content hashing
│   ├── embedding-provider.ts        <-- EmbeddingProvider interface, GoogleGenAi & Deterministic providers, LRU cache
│   ├── memory-ingestion-worker.ts   <-- Core ingestion orchestrator, batch lease execution, dual indexing
│   └── index.ts                     <-- Consolidated barrel export
├── subscribers/                     <-- [NEW MODULE]
│   ├── domain-event-indexer.ts      <-- EventBus subscriber listening to CRM, meeting, deal, doc events
│   └── index.ts
├── services/
│   └── canonical-memory-service.ts  <-- [Augment] Support real embedding vectors & optional embedding provider
└── index.ts                         <-- [Augment] Re-export ingestion & subscribers

src/app/api/tasks/memory-indexer/
└── route.ts                         <-- [NEW ROUTE] Cloud Tasks endpoint with OIDC auth (Rules 13, 34, 51)

src/platform/__tests__/memory/
├── document-chunker.test.ts         <-- 6 unit tests for semantic chunking & heading extraction
├── embedding-provider.test.ts       <-- 5 unit tests for embedding provider, LRU caching & concurrency
├── memory-ingestion-worker.test.ts  <-- 6 integration tests for worker execution, batching & idempotency
├── domain-event-indexer.test.ts     <-- 4 integration tests for EventBus subscriber & Cloud Tasks dispatch
└── memory-indexer-route.test.ts     <-- 5 tests for Cloud Tasks route auth, handshake & error handling
```

---

## 3. Detailed Component Specifications

### 3.1 Ingestion Contracts & Taxonomy (`src/platform/memory/ingestion/ingestion-types.ts`)

Implements Rules 4, 8, 10, 16, 22, 26, 47:

```typescript
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
```

---

### 3.2 Recursive Token-Aware Chunker (`src/platform/memory/ingestion/document-chunker.ts`)

Implements Rules 4, 9, 10, 16, 22, 28, 56, 66:
1. **Hierarchical Boundary Preservation:**
   - Detects Markdown headings (`#`, `##`, `###`, `####`), maintaining section breadcrumbs (e.g., `["Company Policy", "Leave Policy", "Parental Leave"]`).
   - Recursively splits large sections along natural semantic breaks: double newlines (paragraphs) $\to$ bullet/numbered lists $\to$ single sentences (`. `, `! `, `? `).
2. **Token Calculation & Overlap:**
   - Uses standard empirical 4.0 chars/token heuristic.
   - Enforces target 500 tokens (~2,000 characters) with 50 tokens (~200 characters) overlap between successive chunks to maintain semantic continuity across chunk boundaries.
3. **Deterministic Identification & SHA-256 Hashing (Rule 22):**
   - Each chunk receives a deterministic ID: `${documentId}_chunk_${index}`.
   - Computes SHA-256 hash over normalized chunk content: `sha256(heading + "\n" + content.trim().toLowerCase())`.
   - Chunks smaller than 10 characters or consisting solely of whitespace are suppressed.
4. **Safety & Bounds (Rules 9 & 66):**
   - Caps total generated chunks per document at `maxChunks` (default 100). If content exceeds `maxChunks`, it logs a warning and bounds output without throwing uncaught exceptions.

---

### 3.3 Decoupled Embedding Provider & Local Caching (`src/platform/memory/ingestion/embedding-service.ts`)

Implements Rules 4, 9, 20, 24, 39, 54:
1. **Unified Provider Contract (CompanyBrain PRD §113):**
   ```typescript
   export interface EmbeddingProvider {
     readonly modelName: string;
     readonly dimension: number; // 768
     embed(text: string): Promise<number[]>;
     embedBatch(texts: string[]): Promise<number[][]>;
     healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
   }
   ```
2. **`GoogleGenAiEmbeddingProvider`:**
   - Production provider utilizing Gemini embedding model (`text-embedding-004`, 768 dimensions).
   - Concurrency throttle: wraps batch calls with bounded promise pools ($\le 5$ simultaneous calls) to prevent HTTP 429 quota exhaustion (Rule 20).
   - Exponential backoff retry: 3 attempts with jittered exponential delay on transient 5xx / rate limits.
3. **`DeterministicMemoryEmbeddingProvider`:**
   - High-speed, zero-network deterministic embedding provider for isolated unit tests, offline development, and fallback.
   - Converts SHA-256 hashes of input strings into normalized, 768-dimensional unit vectors with valid cosine properties ($\sum v_i^2 \approx 1.0$).
4. **In-Memory SHA-256 LRU Cache:**
   - 500-slot LRU cache storing `{ vector: number[], timestamp: number }` keyed by `sha256(text.trim().toLowerCase())`.
   - Repeated calls for identical chunk content return in $O(1)$ time with zero external API calls or latency.

---

### 3.4 Background Ingestion Worker (`src/platform/memory/ingestion/memory-ingestion-worker.ts`)

Implements Rules 4, 8, 9, 13, 18, 22, 24, 25, 30, 34, 40, 47, 60:
1. **Gate 1: Fail-Closed Tenant Scoping (Rules 8 & 47):**
   - Verifies `organizationId` and `workspaceId` are present and valid, throwing `INGESTION_TENANT_REQUIRED` otherwise.
2. **Gate 2: Operator Dead-Man Switch (Rule 60):**
   - Invokes `checkGovernanceDeadManSwitch(organizationId)`. If paused, aborts immediately with `INGESTION_DEAD_MAN_PAUSED`.
3. **Gate 3: SSRF Boundary Check (Rule 34):**
   - If target contains `sourceUrl`, validates it using `validateSafeEgressUrl()`. Rejects internal metadata/private IP URLs with `INGESTION_SSRF_VIOLATION`.
4. **Gate 4: Anti-Poisoning & Content Sanitization (Rules 13 & 30):**
   - Scans each target document's content with `evaluateMemoryContentRisk()`, redacting hostile injection directives before chunking.
5. **Gate 5: Chunking & Deduplication (Rule 22):**
   - Chunks content with `DocumentChunker.chunk()`.
   - Skips chunk processing if a chunk with matching `contentHash` has already been indexed in the same workspace.
6. **Gate 6: Dense Vector Generation:**
   - Calls `embeddingProvider.embedBatch()` across all non-duplicate chunks.
7. **Gate 7: Dual Storage via `CanonicalMemoryService`:**
   - Persists each chunk as an atomic `CanonicalMemoryObject`:
     - `tier: 'semantic'`
     - `type: 'document_chunk'`
     - `source: { type: target.sourceType, sourceId: target.sourceId, sourceHash: chunk.contentHash }`
     - `subjectRefs: { documentIds: [target.sourceId], ...target.subjectRefs }`
     - `content: chunk.content`
     - `title: chunk.heading || target.title`
     - `vector: embeddedVector`
   - Automatically writes to in-memory/Qdrant vector store and indexes into sparse BM25.
8. **Gate 8: Telemetry & Event Publication (Rule 40):**
   - Publishes `memory.document.indexed` domain event with `chunkCount`, `tokenCount`, `latencyMs`, and `sourceId`.

---

### 3.5 Domain Event Subscriber (`src/platform/memory/subscribers/domain-event-indexer.ts`)

Implements Rules 4, 8, 25, 40, 47:
1. **Subscribed Events:**
   - `crm.note.created`: Ingests contact notes as episodic/semantic knowledge.
   - `meeting.completed`: Ingests meeting summaries, action items, and transcripts.
   - `deal.stage_changed`: Ingests deal progress notes and negotiation history.
   - `portal.lesson.published`: Ingests educational content for agent grounding.
   - `document.uploaded`: Ingests uploaded PDF/markdown files.
2. **Cloud Tasks Dispatch (Rule 25):**
   - Maps incoming domain event to `MemoryIngestionJobPayload`.
   - Dispatches task to `memory-indexer-queue` using `scheduleTaskWithKey(taskKey, MEMORY_INDEXER_QUEUE, MEMORY_INDEXER_ENDPOINT, payload, delaySeconds)`.
   - In test/local environments without GCP Cloud Tasks credentials, falls back to direct async worker execution without crashing.

---

### 3.6 Route Handler (`src/app/api/tasks/memory-indexer/route.ts`)

Implements Rules 4, 13, 34, 51:
1. **Cloud Tasks Signature Verification (Rule 34 & 51):**
   - Inspects `x-cloud-tasks-secret` or HMAC queue headers via `isAuthorizedCloudTaskRequest()`.
2. **Google OIDC Token Verification (Rules 13 & 34):**
   - Inspects `Authorization: Bearer <oidcToken>` via `verifyCloudTasksOidcToken(request.headers)`.
   - In production, rejects unverified calls with HTTP 401. In non-production, permits authorized local emulator calls.
3. **Payload Validation (Rule 4):**
   - Parses request JSON as `unknown` and narrows with `MemoryIngestionJobPayloadSchema.safeParse()`.
4. **Worker Dispatch:**
   - Invokes `processMemoryIngestionJob(payload)`. Returns HTTP 200 with `{ status: 'success', indexedDocuments: N, totalChunks: M, latencyMs: X }`.

---

## 4. Comprehensive 69 Rules Compliance Matrix

| Rule | Requirement | Milestone 3 Implementation Details |
| :---: | :--- | :--- |
| **Rule 4** | Zero `any`/`any[]` | 100% strict Zod schemas (`DocumentChunkSchema`, `MemoryIngestionJobPayloadSchema`) with inferred types. `unknown` narrowed at route boundary. |
| **Rule 8 & 47** | Fail-Closed Multi-Tenant ACL | `organizationId` and `workspaceId` enforced across chunker, embedding provider, worker, and route handler. Throws `INGESTION_TENANT_REQUIRED`. |
| **Rule 9 & 23** | Load & Resource Governance | Capped at $\le 20$ documents per batch, $\le 100$ chunks per doc, $\le 5$ concurrent embedding requests. Prevents Cloud Run memory/timeout failures. |
| **Rule 10** | Inline Architectural Docs | All source files include `@fileOverview` with invariants, maintainer notes, failure mode analysis, and `@testability` pointers. |
| **Rule 13 & 30** | Model Distrust & Anti-Poisoning | Ingested content scanned for prompt injection directives with `evaluateMemoryContentRisk()` before vectorization; wrapped in `<untrusted_reference_data>`. |
| **Rule 16** | Provenance Tracking | Every chunk stores `sourceType`, `sourceId`, `heading`, `position`, and `contentHash`. |
| **Rule 18** | Concurrency & Idempotency | Cloud Tasks task keys and Firestore idempotency checks guarantee duplicate events do not double-index. |
| **Rule 20** | Rate Limiting & Quota Defense | In-memory LRU cache + concurrency throttle ($\le 5$) + exponential retry prevent API quota exhaustion. |
| **Rule 22** | Content Hash Deduplication | SHA-256 chunk hash prevents duplicate vector upserts for unchanged text passages. |
| **Rule 24** | Resilient Error Handling & Fallback | Embedding failure falls back to deterministic/cached vectors; vector store failure does not roll back source records. |
| **Rule 25** | Cloud Tasks Payload Bounds | Payloads carry only necessary identifiers and text blocks within Cloud Tasks 100KB limits. |
| **Rule 26** | Distributed Trace Propagation | `correlationId` tracked from domain event to task payload to indexing telemetry. |
| **Rule 28 & 56** | Context & Chunk Budgeting | 500-token chunks with 50-token overlap strictly comply with embedding model sweet spots (`text-embedding-004`). |
| **Rule 29 & 57** | Temporal Validity | All chunks stamped with ISO-8601 `createdAt`, `validFrom`, and optional `validUntil`. |
| **Rule 34** | SSRF & Boundary Controls | Cloud Tasks endpoints authenticated via queue signature and Google OIDC token. URLs validated against SSRF via `validateSafeEgressUrl`. |
| **Rule 40** | Domain Event Bus Emission | Publishes `memory.document.indexed` domain events via `defaultEventBus` upon completion. |
| **Rule 51** | Route Handler Security Gate | `/api/tasks/memory-indexer` strictly verifies Cloud Tasks headers and OIDC token. Zero unauthenticated execution. |
| **Rule 60** | Emergency Dead-Man Controls | Ingestion worker checks `checkGovernanceDeadManSwitch(organizationId)` and halts immediately if paused. |
| **Rule 66** | Bounded Execution | All iteration loops, chunk arrays, and batch sizes are strictly bounded by parameters. |
| **Rule 67** | Implementation Gate | All 8 gate criteria satisfied before claiming completion. |
| **Rule 69** | Strangler Pattern | Legacy `src/lib/memory/` remains untouched and 100% green; platform code lives under `src/platform/memory/ingestion/`. |

---

## 5. Edge Cases, Failure Modes & Security Safeguards

1. **Very Long Documents (e.g. 50-page PDF):**
   - `DocumentChunker` splits by headings and paragraphs. If chunks exceed `maxChunks` (100), it safely buffers or bounds output rather than causing an OOM error on Cloud Run.
2. **Empty or Whitespace-Only Documents:**
   - Sanitized early; returns empty chunk list with zero API calls.
3. **Embedding API Quota Exhaustion (HTTP 429):**
   - Handled via 3 exponential backoff retries with jitter and concurrency throttle ($\le 5$). If exhausted, the Cloud Task fails with HTTP 500, allowing Google Cloud Tasks to execute exponential retry automatically.
4. **Duplicate Document Uploads:**
   - SHA-256 content hashing detects identical chunks and suppresses duplicate vector upserts.
5. **SSRF Attack via Malicious Document URL:**
   - Ingested URLs are strictly checked via `validateSafeEgressUrl()`; requests to cloud metadata (`169.254.169.254`) or loopback (`127.0.0.1`) are blocked immediately with `INGESTION_SSRF_VIOLATION`.
6. **Operator Emergency Pause (Dead-Man Switch):**
   - If an operator activates the emergency kill-switch (`governance-dead-man.ts`), pending Cloud Tasks abort immediately with `INGESTION_DEAD_MAN_PAUSED`, halting all autonomous embedding and indexing activity.

---

## 6. Test Plan & Verification Gates

### 6.1 Unit & Integration Test Suites (`src/platform/__tests__/memory/`)

1. **`document-chunker.test.ts` (6 tests):**
   - Recursive splitting along Markdown heading hierarchy (`#`, `##`, `###`).
   - Token estimation accuracy (~4.0 chars/token) and overlap preservation (50 tokens).
   - Paragraph and bullet-list boundary preservation.
   - Deterministic SHA-256 content hashing.
   - Suppression of empty/whitespace chunks.
   - Strict `maxChunks` ceiling enforcement.

2. **`embedding-provider.test.ts` (5 tests):**
   - Deterministic unit vector generation with 768 dimensions and normalized Euclidean norm ($|v| \approx 1.0$).
   - LRU cache hit/miss mechanics and 500-slot eviction.
   - Batch embedding concurrency throttling ($\le 5$).
   - Health check probe reporting latency.
   - Graceful fallback on API error.

3. **`memory-ingestion-worker.test.ts` (7 tests):**
   - Fail-closed multi-tenant boundary checks (Rules 8 & 47).
   - Dead-man switch emergency pause check (Rule 60).
   - End-to-end ingestion: chunking $\to$ embedding $\to$ `CanonicalMemoryService` indexing.
   - Idempotency & deduplication suppression for identical content hashes.
   - Anti-poisoning redaction of prompt injection directives in ingested documents.
   - SSRF egress validation for document URLs (Rule 34).
   - Batch size limit enforcement ($\le 20$ targets).

4. **`domain-event-indexer.test.ts` (4 tests):**
   - EventBus subscriber mapping for `crm.note.created` and `meeting.completed`.
   - Cloud Tasks dispatch payload generation with idempotency keys and trace IDs.
   - Non-fatal fallback in test/offline environments.
   - Ignore unrelated domain events.

5. **`memory-indexer-route.test.ts` (5 tests):**
   - Rejection of unauthorized requests missing Cloud Tasks signature (HTTP 401).
   - Rejection of invalid OIDC tokens in production mode (HTTP 401).
   - Rejection of malformed JSON payloads (HTTP 400).
   - Successful processing and response format for valid Cloud Tasks requests (HTTP 200).
   - Dead-man switch pause response (HTTP 503 or 403).

### 6.2 Full Verification Suite
- `pnpm vitest run src/platform/__tests__/memory/` (all memory tests pass 100%).
- `pnpm vitest run src/lib/memory/__tests__/` (Rule 69: all 60 legacy tests pass 100%).
- `pnpm vitest run src/platform/__tests__/` (all platform tests pass 100%).
- `pnpm typecheck` (0 errors).
- ESLint static analysis (0 errors, 0 warnings).

---

## 7. Implementation Sequence

```
Step 1: Ingestion Contracts & Types
        └── src/platform/memory/ingestion/ingestion-types.ts
        └── src/platform/memory/contracts/memory-types.ts (vector field)

Step 2: Recursive Document Chunker
        └── src/platform/memory/ingestion/document-chunker.ts
        └── src/platform/__tests__/memory/document-chunker.test.ts

Step 3: Embedding Provider Abstraction & Providers
        └── src/platform/memory/ingestion/embedding-service.ts
        └── src/platform/__tests__/memory/embedding-provider.test.ts

Step 4: Canonical Memory Service Vector Integration
        └── src/platform/memory/services/canonical-memory-service.ts

Step 5: Memory Ingestion Worker
        └── src/platform/memory/ingestion/memory-ingestion-worker.ts
        └── src/platform/__tests__/memory/memory-ingestion-worker.test.ts

Step 6: Domain Event Subscriber
        └── src/platform/memory/subscribers/domain-event-indexer.ts
        └── src/platform/__tests__/memory/domain-event-indexer.test.ts

Step 7: Cloud Tasks Route Handler
        └── src/app/api/tasks/memory-indexer/route.ts
        └── src/platform/__tests__/memory/memory-indexer-route.test.ts

Step 8: Consolidated Exports & Integration
        └── src/platform/memory/ingestion/index.ts
        └── src/platform/memory/index.ts

Step 9: Full Platform Verification Gates & Documentation
        └── Full vitest suite, typecheck, eslint, completion report
```
