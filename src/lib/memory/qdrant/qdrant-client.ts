/**
 * @fileOverview CompanyBrain 2.0: Resilient Qdrant REST Client & Fallback Engine
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. High-Performance REST Client for Qdrant (v1.x compatible):
 *    - Connects to Qdrant Cloud or local Docker cluster via standard fetch.
 *    - Zero external runtime npm dependencies: immune to bundling or Node version conflicts.
 * 2. Mandatory Pre-Filtering Invariant (PRD Section 20):
 *    - All search requests enforce workspaceId and organizationId payload filters AT QUERY TIME.
 * 3. Graceful Circuit-Breaker & Fallback:
 *    - If QDRANT_URL is unconfigured or the cluster is unreachable, falls back to an in-memory
 *      vector store with cosine similarity ranking. Dev/test/staging environments NEVER crash.
 * 4. Strict Zero-`any` Standard:
 *    - 100% typed request payloads, response schemas, and error structures.
 *
 * @testability Covered in `src/lib/memory/__tests__/qdrant-client.test.ts`.
 */

import {
  VECTOR_DIMENSION,
  QDRANT_COLLECTION_NAME,
  type QdrantPoint,
  type QdrantPayload,
  type QdrantClusterHealth,
  type SemanticSearchFilters,
} from '../semantic-types';

export interface QdrantSearchHit {
  id: string;
  version: number;
  score: number;
  payload: QdrantPayload;
}

export interface QdrantFilterClause {
  key: string;
  match?: { value?: string | number | boolean; any?: (string | number)[] };
  range?: { gte?: number | string; lte?: number | string };
}

export interface QdrantFilter {
  must?: QdrantFilterClause[];
  should?: QdrantFilterClause[];
  must_not?: QdrantFilterClause[];
}

/**
 * In-memory fallback point store for development/testing when Qdrant is unreachable.
 */
const mockPointsStore = new Map<string, QdrantPoint>();

/**
 * Calculates cosine similarity between two vectors of equal dimension.
 */
export function computeCosineSimilarity(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export class QdrantClient {
  private static get baseUrl(): string {
    const url = process.env.QDRANT_URL || '';
    return url.replace(/\/+$/, '');
  }

  private static get apiKey(): string {
    return process.env.QDRANT_API_KEY || '';
  }

  public static isConfigured(): boolean {
    return !!this.baseUrl;
  }

  private static getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Initializes the primary collection and payload indexes if not already present.
   */
  public static async ensureCollection(): Promise<boolean> {
    if (!this.isConfigured()) {
      return true; // Mock mode is ready
    }

    try {
      const checkRes = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(4000),
      });

      if (checkRes.ok) return true;

      // Create collection if 404
      if (checkRes.status === 404) {
        const createRes = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({
            vectors: {
              size: VECTOR_DIMENSION,
              distance: 'Cosine',
            },
          }),
        });

        if (!createRes.ok) {
          console.warn('[QdrantClient] Failed to create collection:', await createRes.text());
          return false;
        }

        // Create payload field indexes for pre-filtering (PRD Section 20)
        const indexFields = [
          'workspaceId',
          'organizationId',
          'memoryId',
          'memoryType',
          'sourceType',
          'sourceId',
          'entityIds',
          'dealIds',
          'verification',
          'createdAt',
        ];

        for (const field of indexFields) {
          await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}/index`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({
              field_name: field,
              field_schema: 'keyword',
            }),
          }).catch(() => {});
        }

        return true;
      }
      return false;
    } catch (err) {
      console.warn('[QdrantClient] Cluster unreachable, using fallback store:', err);
      return false;
    }
  }

  /**
   * Upserts points into the collection. Uses chunked batch limits (<= 100).
   */
  public static async upsertPoints(points: QdrantPoint[]): Promise<boolean> {
    if (points.length === 0) return true;

    // Always update in-memory fallback store as well
    for (const p of points) {
      mockPointsStore.set(p.id, p);
    }

    if (!this.isConfigured()) {
      return true;
    }

    try {
      await this.ensureCollection();

      // Chunk points into blocks of 100
      for (let i = 0; i < points.length; i += 100) {
        const chunk = points.slice(i, i + 100);
        const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}/points?wait=true`, {
          method: 'PUT',
          headers: this.getHeaders(),
          body: JSON.stringify({ points: chunk }),
          signal: AbortSignal.timeout(10000),
        });

        if (!res.ok) {
          console.warn('[QdrantClient] Upsert failed:', await res.text());
          return false;
        }
      }
      return true;
    } catch (err) {
      console.warn('[QdrantClient] Upsert error, persisted in fallback store:', err);
      return false;
    }
  }

  /**
   * Deletes points by ID.
   */
  public static async deletePointsByIds(ids: string[]): Promise<boolean> {
    if (ids.length === 0) return true;

    for (const id of ids) {
      mockPointsStore.delete(id);
    }

    if (!this.isConfigured()) return true;

    try {
      const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}/points/delete?wait=true`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ points: ids }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      console.warn('[QdrantClient] Delete error:', err);
      return false;
    }
  }

  /**
   * Deletes points by memoryId or sourceId filter.
   */
  public static async deletePointsByFilter(key: 'memoryId' | 'sourceId', value: string): Promise<boolean> {
    if (!value) return true;

    // Prune from mock store
    for (const [id, pt] of mockPointsStore.entries()) {
      if (pt.payload[key] === value) {
        mockPointsStore.delete(id);
      }
    }

    if (!this.isConfigured()) return true;

    try {
      const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}/points/delete?wait=true`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          filter: {
            must: [{ key, match: { value } }],
          },
        }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch (err) {
      console.warn('[QdrantClient] Delete by filter error:', err);
      return false;
    }
  }

  /**
   * Searches for nearest vectors enforcing tenant isolation filter at query time.
   */
  public static async searchPoints(params: {
    vector: number[];
    workspaceId: string;
    organizationId: string;
    filters?: SemanticSearchFilters;
    limit?: number;
    scoreThreshold?: number;
  }): Promise<QdrantSearchHit[]> {
    const {
      vector,
      workspaceId,
      organizationId,
      filters = {},
      limit = 10,
      scoreThreshold = params.scoreThreshold ?? filters.minScore ?? -1.0,
    } = params;

    // 1. Construct strict multi-tenant payload filter
    const mustClauses: QdrantFilterClause[] = [
      { key: 'workspaceId', match: { value: workspaceId } },
      { key: 'organizationId', match: { value: organizationId } },
    ];

    if (filters.memoryTypes && filters.memoryTypes.length > 0) {
      mustClauses.push({ key: 'memoryType', match: { any: filters.memoryTypes } });
    }
    if (filters.sourceTypes && filters.sourceTypes.length > 0) {
      mustClauses.push({ key: 'sourceType', match: { any: filters.sourceTypes } });
    }
    if (filters.verification && filters.verification.length > 0) {
      mustClauses.push({ key: 'verification', match: { any: filters.verification } });
    }
    if (filters.entityIds && filters.entityIds.length > 0) {
      mustClauses.push({ key: 'entityIds', match: { any: filters.entityIds } });
    }

    // 2. Attempt remote search if configured
    if (this.isConfigured()) {
      try {
        const searchBody: Record<string, unknown> = {
          vector,
          limit,
          score_threshold: scoreThreshold,
          filter: { must: mustClauses },
          with_payload: true,
        };

        const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}/points/search`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify(searchBody),
          signal: AbortSignal.timeout(5000),
        });

        if (res.ok) {
          const data = (await res.json()) as { result: QdrantSearchHit[] };
          if (Array.isArray(data.result)) {
            return data.result;
          }
        }
      } catch (err) {
        console.warn('[QdrantClient] Remote search failed, falling back to local cosine store:', err);
      }
    }

    // 3. Graceful Fallback: Local Cosine Similarity over in-memory points
    const candidates: QdrantSearchHit[] = [];

    for (const pt of mockPointsStore.values()) {
      const payload = pt.payload;

      // Tenant check
      if (payload.workspaceId !== workspaceId || payload.organizationId !== organizationId) {
        continue;
      }
      // Memory type filter
      if (filters.memoryTypes && !filters.memoryTypes.includes(payload.memoryType)) {
        continue;
      }
      // Verification filter
      if (filters.verification && !filters.verification.includes(payload.verification)) {
        continue;
      }
      // Entity filter
      if (
        filters.entityIds &&
        !payload.entityIds.some((id) => filters.entityIds!.includes(id))
      ) {
        continue;
      }

      const score = computeCosineSimilarity(vector, pt.vector);
      if (score >= scoreThreshold) {
        candidates.push({
          id: pt.id,
          version: 1,
          score,
          payload,
        });
      }
    }

    // Sort by descending similarity score and apply limit
    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, limit);
  }

  /**
   * Health and telemetry inspection for Backoffice Governance.
   */
  public static async getClusterHealth(): Promise<QdrantClusterHealth> {
    const isMock = !this.isConfigured();
    const defaultUrl = this.baseUrl || 'In-Memory Fallback Engine';

    if (isMock) {
      return {
        status: 'fallback_active',
        endpointUrl: defaultUrl,
        isMockFallback: true,
        totalPointsCount: mockPointsStore.size,
        pointsCount: mockPointsStore.size,
        vectorDimension: VECTOR_DIMENSION,
        indexedMemoryCount: mockPointsStore.size,
        unindexedMemoryCount: 0,
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/collections/${QDRANT_COLLECTION_NAME}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });

      const latencyMs = Date.now() - start;

      if (res.ok) {
        const data = (await res.json()) as {
          result?: { points_count?: number; status?: string };
        };
        const count = data.result?.points_count ?? mockPointsStore.size;
        return {
          status: 'healthy',
          endpointUrl: this.baseUrl,
          isMockFallback: false,
          latencyMs,
          totalPointsCount: count,
          pointsCount: count,
          vectorDimension: VECTOR_DIMENSION,
          indexedMemoryCount: count,
          unindexedMemoryCount: 0,
        };
      }

      return {
        status: 'degraded',
        endpointUrl: this.baseUrl,
        isMockFallback: true,
        latencyMs,
        totalPointsCount: mockPointsStore.size,
        pointsCount: mockPointsStore.size,
        vectorDimension: VECTOR_DIMENSION,
        indexedMemoryCount: mockPointsStore.size,
        unindexedMemoryCount: 0,
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err) {
      return {
        status: 'offline',
        endpointUrl: this.baseUrl,
        isMockFallback: true,
        totalPointsCount: mockPointsStore.size,
        pointsCount: mockPointsStore.size,
        vectorDimension: VECTOR_DIMENSION,
        indexedMemoryCount: mockPointsStore.size,
        unindexedMemoryCount: 0,
        errorMessage: err instanceof Error ? err.message : 'Cluster unreachable',
      };
    }
  }

  /**
   * Returns current mock store count for unit tests and telemetry.
   */
  public static getMockStoreSize(): number {
    return mockPointsStore.size;
  }

  /**
   * Clears mock store for testing.
   */
  public static clearMockStore(): void {
    mockPointsStore.clear();
  }
}
