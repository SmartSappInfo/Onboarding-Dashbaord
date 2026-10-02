/**
 * @fileOverview Decoupled Vector Store Interface (Phase 4 Milestone 1)
 *
 * Defines the contract for all vector store backends (In-Memory Fallback, Qdrant REST, Firestore).
 * Enforces strict tenant payload typing, bounded queries, and fail-closed security.
 */

export interface VectorPayload {
  organizationId: string;
  workspaceId: string;
  memoryId?: string;
  sourceId?: string;
  memoryType?: string;
  sourceType?: string;
  content?: string;
  [key: string]: unknown;
}

export interface VectorPoint<T extends VectorPayload = VectorPayload> {
  id: string;
  vector: number[];
  payload: T;
}

export interface VectorSearchParams {
  vector: number[];
  organizationId: string;
  workspaceId: string;
  limit?: number;
  scoreThreshold?: number;
  filterPayload?: Record<string, string | number | boolean>;
}

export interface VectorSearchHit<T extends VectorPayload = VectorPayload> {
  id: string;
  score: number;
  payload: T;
}

export interface VectorStoreHealth {
  status: 'healthy' | 'degraded' | 'offline';
  isFallback: boolean;
  endpointUrl: string;
  pointsCount: number;
  latencyMs?: number;
  errorMessage?: string;
}

export interface VectorStore {
  upsert(points: VectorPoint[]): Promise<boolean>;
  search(params: VectorSearchParams): Promise<VectorSearchHit[]>;
  deleteByIds(ids: string[]): Promise<boolean>;
  deleteByFilter(filter: {
    organizationId: string;
    workspaceId: string;
    key: string;
    value: string;
  }): Promise<boolean>;
  getHealth(): Promise<VectorStoreHealth>;
}
