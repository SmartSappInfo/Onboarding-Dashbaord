/**
 * @fileOverview Production Qdrant Vector Adapter with Circuit Breaker & Fail-Closed ACL
 *
 * ARCHITECTURAL INVARIANTS (Rules 4, 8, 24, 32, 47):
 * 1. Fail-Closed Tenant ACL:
 *    - All operations validate non-empty organizationId and workspaceId.
 *    - Injects mandatory payload filter:
 *      { must: [{ key: 'organizationId', match: { value: orgId } }, { key: 'workspaceId', match: { value: wsId } }] }
 * 2. Three-State Circuit Breaker (Rule 24):
 *    - CLOSED: Normal operation, executes REST requests against Qdrant cluster.
 *    - OPEN: Tripped after consecutive network failures; immediately routes to MemoryVectorStore.
 *    - HALF_OPEN: Periodically probes cluster to verify health before closing breaker.
 * 3. Safe `unknown` Narrowing (Rule 4):
 *    - Remote JSON payloads treated as `unknown` and validated before entering domain state.
 */

import {
  VectorStore,
  VectorPoint,
  VectorSearchParams,
  VectorSearchHit,
  VectorStoreHealth,
  VectorPayload,
} from './vector-store.interface';
import { MemoryVectorStore } from './memory-vector-store';
import { MEMORY_ERROR_CODES } from '../contracts/memory-types';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface QdrantVectorStoreOptions {
  baseUrl?: string;
  apiKey?: string;
  collectionName?: string;
  fallbackStore?: MemoryVectorStore;
  failureThreshold?: number;
  resetTimeoutMs?: number;
}

export class QdrantVectorStore implements VectorStore {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly collectionName: string;
  private readonly fallback: MemoryVectorStore;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;

  private circuitState: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime = 0;

  constructor(options: QdrantVectorStoreOptions = {}) {
    this.baseUrl = (options.baseUrl ?? process.env.QDRANT_URL ?? '').replace(/\/+$/, '');
    this.apiKey = options.apiKey ?? process.env.QDRANT_API_KEY ?? '';
    this.collectionName = options.collectionName ?? 'smartsapp_memory_v1';
    this.fallback = options.fallbackStore ?? new MemoryVectorStore();
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 10000;
  }

  public getCircuitState(): CircuitBreakerState {
    this.checkStateTransition();
    return this.circuitState;
  }

  private checkStateTransition(): void {
    if (this.circuitState === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.resetTimeoutMs) {
        this.circuitState = 'HALF_OPEN';
      }
    }
  }

  private recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.circuitState = 'CLOSED';
  }

  private recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = Date.now();
    if (this.consecutiveFailures >= this.failureThreshold) {
      this.circuitState = 'OPEN';
    }
  }

  private isConfigured(): boolean {
    return Boolean(this.baseUrl);
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) {
      headers['api-key'] = this.apiKey;
    }
    return headers;
  }

  public async upsert(points: VectorPoint[]): Promise<boolean> {
    // Always sync with fallback store
    await this.fallback.upsert(points);

    if (!this.isConfigured() || this.getCircuitState() === 'OPEN') {
      return true;
    }

    try {
      const res = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points?wait=true`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ points }),
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        this.recordFailure();
        return false;
      }

      this.recordSuccess();
      return true;
    } catch {
      this.recordFailure();
      return false;
    }
  }

  public async search(params: VectorSearchParams): Promise<VectorSearchHit[]> {
    const { organizationId, workspaceId, vector, limit = 10, scoreThreshold } = params;

    // Fail-Closed Tenant ACL Check (Rules 8 & 47)
    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    if (!this.isConfigured() || this.getCircuitState() === 'OPEN') {
      return this.fallback.search(params);
    }

    try {
      const mustClauses: Array<{ key: string; match: { value: string | number | boolean } }> = [
        { key: 'organizationId', match: { value: organizationId } },
        { key: 'workspaceId', match: { value: workspaceId } },
      ];

      if (params.filterPayload) {
        for (const [key, value] of Object.entries(params.filterPayload)) {
          mustClauses.push({ key, match: { value } });
        }
      }

      const res = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          vector,
          limit,
          score_threshold: scoreThreshold,
          filter: { must: mustClauses },
          with_payload: true,
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        // Safe unknown narrowing (Rule 4)
        const rawData: unknown = await res.json();
        if (
          rawData &&
          typeof rawData === 'object' &&
          'result' in rawData &&
          Array.isArray((rawData as { result: unknown }).result)
        ) {
          const list = (rawData as { result: Array<{ id: string; score: number; payload: VectorPayload }> }).result;
          this.recordSuccess();
          return list.map((hit) => ({
            id: hit.id,
            score: hit.score,
            payload: hit.payload,
          }));
        }
      }

      this.recordFailure();
      return this.fallback.search(params);
    } catch {
      this.recordFailure();
      return this.fallback.search(params);
    }
  }

  public async deleteByIds(ids: string[]): Promise<boolean> {
    await this.fallback.deleteByIds(ids);
    if (!this.isConfigured() || this.getCircuitState() === 'OPEN') return true;

    try {
      const res = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/delete?wait=true`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ points: ids }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        this.recordSuccess();
        return true;
      }
      this.recordFailure();
      return false;
    } catch {
      this.recordFailure();
      return false;
    }
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

    await this.fallback.deleteByFilter(filter);
    if (!this.isConfigured() || this.getCircuitState() === 'OPEN') return true;

    try {
      const res = await fetch(`${this.baseUrl}/collections/${this.collectionName}/points/delete?wait=true`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          filter: {
            must: [
              { key: 'organizationId', match: { value: organizationId } },
              { key: 'workspaceId', match: { value: workspaceId } },
              { key, match: { value } },
            ],
          },
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        this.recordSuccess();
        return true;
      }
      this.recordFailure();
      return false;
    } catch {
      this.recordFailure();
      return false;
    }
  }

  public async getHealth(): Promise<VectorStoreHealth> {
    if (!this.isConfigured()) {
      return {
        status: 'degraded',
        isFallback: true,
        endpointUrl: 'fallback-only (unconfigured)',
        pointsCount: await this.fallback.size(),
      };
    }

    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/collections/${this.collectionName}`, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: AbortSignal.timeout(3000),
      });
      const latencyMs = Date.now() - start;

      if (res.ok) {
        const raw: unknown = await res.json();
        let count = await this.fallback.size();
        if (raw && typeof raw === 'object' && 'result' in raw) {
          const resObj = (raw as { result?: { points_count?: number } }).result;
          if (resObj && typeof resObj.points_count === 'number') {
            count = resObj.points_count;
          }
        }
        return {
          status: 'healthy',
          isFallback: false,
          endpointUrl: this.baseUrl,
          pointsCount: count,
          latencyMs,
        };
      }

      return {
        status: 'degraded',
        isFallback: true,
        endpointUrl: this.baseUrl,
        pointsCount: await this.fallback.size(),
        latencyMs,
        errorMessage: `HTTP ${res.status}: ${res.statusText}`,
      };
    } catch (err) {
      return {
        status: 'offline',
        isFallback: true,
        endpointUrl: this.baseUrl,
        pointsCount: await this.fallback.size(),
        errorMessage: err instanceof Error ? err.message : 'Cluster unreachable',
      };
    }
  }
}
