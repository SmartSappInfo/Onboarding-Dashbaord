/**
 * @fileOverview High-Precision In-Memory Cosine Vector Store Engine
 *
 * ARCHITECTURAL GUIDELINES (Rules 8, 10, 24, 47):
 * 1. Self-contained cosine similarity computation with zero external dependencies.
 * 2. Mandatory tenant pre-filtering: queries across tenants immediately rejected.
 * 3. Primary fallback engine when remote Qdrant clusters trip the circuit breaker.
 */

import {
  VectorStore,
  VectorPoint,
  VectorSearchParams,
  VectorSearchHit,
  VectorStoreHealth,
} from './vector-store.interface';
import { MEMORY_ERROR_CODES } from '../contracts/memory-types';

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

export class MemoryVectorStore implements VectorStore {
  private readonly points = new Map<string, VectorPoint>();

  public async upsert(points: VectorPoint[]): Promise<boolean> {
    for (const point of points) {
      this.points.set(point.id, point);
    }
    return true;
  }

  public async search(params: VectorSearchParams): Promise<VectorSearchHit[]> {
    const {
      vector,
      organizationId,
      workspaceId,
      limit = 10,
      scoreThreshold = -1.0,
      filterPayload = {},
    } = params;

    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    const hits: VectorSearchHit[] = [];

    for (const point of this.points.values()) {
      const p = point.payload;

      // Fail-closed tenant ACL filter (Rule 8)
      if (p.organizationId !== organizationId || p.workspaceId !== workspaceId) {
        continue;
      }

      // Optional payload criteria matching
      let matches = true;
      for (const [key, val] of Object.entries(filterPayload)) {
        if (p[key] !== val) {
          matches = false;
          break;
        }
      }
      if (!matches) continue;

      const score = computeCosineSimilarity(vector, point.vector);
      if (score >= scoreThreshold) {
        hits.push({
          id: point.id,
          score,
          payload: p,
        });
      }
    }

    // Sort descending by score and slice to limit
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  public async deleteByIds(ids: string[]): Promise<boolean> {
    for (const id of ids) {
      this.points.delete(id);
    }
    return true;
  }

  public async deleteByFilter(filter: {
    organizationId: string;
    workspaceId: string;
    key: string;
    value: string;
  }): Promise<boolean> {
    const { organizationId, workspaceId, key, value } = filter;
    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    for (const [id, point] of this.points.entries()) {
      const p = point.payload;
      if (
        p.organizationId === organizationId &&
        p.workspaceId === workspaceId &&
        p[key] === value
      ) {
        this.points.delete(id);
      }
    }
    return true;
  }

  public async getHealth(): Promise<VectorStoreHealth> {
    return {
      status: 'healthy',
      isFallback: true,
      endpointUrl: 'in-memory://isolated-cosine-store',
      pointsCount: this.points.size,
      latencyMs: 0,
    };
  }

  public async size(): Promise<number> {
    return this.points.size;
  }

  public clear(): void {
    this.points.clear();
  }
}
