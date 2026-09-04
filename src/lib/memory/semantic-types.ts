/**
 * @fileOverview CompanyBrain 2.0: Core Semantic Memory & Vector Domain Types
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Single Source of Truth for Vector Retrieval:
 *    - Models Qdrant point representations, vector embeddings, semantic chunks, and search results.
 * 2. Strict Zero-`any` Standard:
 *    - Absolute zero `any` or `any[]`. All payloads, filter conditions, and search queries are fully typed.
 * 3. Multi-Tenant Scoping by Design:
 *    - All vector points and search queries require `workspaceId` and `organizationId`.
 * 4. Deep Explainability ("Why this matched"):
 *    - `SemanticSearchResult` pairs vector similarity with natural-language reasonings, matched terms, and verbatim chunks.
 *
 * @testability Covered in `src/lib/memory/__tests__/embedding-service.test.ts` and `src/lib/memory/__tests__/qdrant-client.test.ts`.
 */

import type {
  MemoryObject,
  MemoryType,
  MemorySourceType,
  VerificationState,
  MemoryVisibilityScope,
} from './types';

/**
 * Dimension for Google GenAI text-embedding-004 model.
 */
export const VECTOR_DIMENSION = 768;

/**
 * Standard collection name in Qdrant cluster for organizational memories.
 */
export const QDRANT_COLLECTION_NAME = 'smartsapp_memory';

/**
 * Semantic chunk of a memory object or knowledge document.
 */
export interface DocumentChunk {
  chunkId: string;
  position: number;
  heading?: string;
  content: string;
  tokenCount?: number;
  tokenCountEstimate?: number;
  characterCount: number;
}

/**
 * Strongly typed payload stored alongside vector in Qdrant point.
 * Matches PRD Section 19 specification.
 */
export interface QdrantPayload {
  organizationId: string;
  workspaceId: string;
  memoryId: string;
  memoryType: MemoryType;
  sourceType: MemorySourceType;
  sourceId: string;
  chunkId: string;
  entityIds: string[];
  dealIds: string[];
  topics: string[];
  importance: number;
  confidence: number;
  visibilityScope: MemoryVisibilityScope;
  verification: VerificationState;
  createdAt: string;
  occurredAt?: string;
  content: string;
  heading?: string;
}

/**
 * Qdrant Vector Point structure.
 */
export interface QdrantPoint {
  id: string; // Deterministic string ID, e.g. "mem_123_chunk_0" or UUID
  vector: number[]; // 768-dimensional float array
  payload: QdrantPayload;
}

/**
 * Multi-attribute filters for semantic vector search.
 */
export interface SemanticSearchFilters {
  memoryTypes?: MemoryType[];
  sourceTypes?: MemorySourceType[];
  entityIds?: string[];
  dealIds?: string[];
  verification?: VerificationState[];
  minScore?: number; // 0.0 to 1.0 (cosine similarity)
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Natural language explanation for why a search result matched the query.
 */
export interface WhyMatchedAttribution {
  reason: string;
  matchedTerms: string[];
  confidenceScore: number;
  semanticSimilarityPercent: number;
}

/**
 * Structured search result returned from the semantic retrieval engine.
 */
export interface SemanticSearchResult {
  memoryId: string;
  score: number; // 0.0 to 1.0 cosine similarity
  memory: MemoryObject;
  matchedChunk: {
    chunkId: string;
    heading?: string;
    content: string;
    position: number;
  };
  whyMatched: WhyMatchedAttribution;
  relatedMemories?: MemoryObject[];
}

/**
 * Parameters for executing a semantic search.
 */
export interface SemanticSearchRequest {
  workspaceId: string;
  organizationId: string;
  query: string;
  filters?: SemanticSearchFilters;
  limit?: number; // default: 10, max: 50
  userId: string;
}

/**
 * Operational health and telemetry stats for the Qdrant cluster.
 */
export interface QdrantClusterHealth {
  status: 'healthy' | 'degraded' | 'offline' | 'fallback_active';
  endpointUrl: string;
  isMockFallback: boolean;
  version?: string;
  latencyMs?: number;
  totalPointsCount: number;
  pointsCount: number;
  vectorDimension: number;
  indexedMemoryCount: number;
  unindexedMemoryCount: number;
  lastSyncAt?: string;
  errorMessage?: string;
}

/**
 * Settings configuration for CompanyBrain governance.
 */
export interface CompanyBrainGovernanceConfig {
  minSimilarityThreshold: number; // default: 0.65
  maxSearchResults: number; // default: 15
  chunkTargetSizeChars: number; // default: 600
  chunkOverlapChars: number; // default: 100
  concurrencyLimit: number; // default: 5
  cacheTtlMinutes: number; // default: 1440 (24h)
  updatedAt: string;
  updatedBy: string;
}
