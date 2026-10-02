/**
 * @fileOverview Hybrid Retrieval Pipeline: Dense Cosine + Sparse BM25 + RRF (Phase 4 Milestone 2)
 *
 * ARCHITECTURAL INVARIANTS (Rules 4, 8, 24, 29, 32):
 * 1. Fuses Dense vector search and Sparse BM25 ranking via Reciprocal Rank Fusion (k=60).
 * 2. Applies Rule 29 half-life exponential temporal decay: S_final = S_rrf * 2^(-Δt / t_halfLife).
 * 3. Fail-closed tenant ACL enforcement on all parameters (Rule 8).
 * 4. Zero-`any` typing with strict contracts and interfaces.
 *
 * @testability Covered in `src/platform/__tests__/memory/hybrid-retriever.test.ts`.
 */

import { VectorStore } from '../adapters/vector-store.interface';
import { SparseBM25Retriever } from './sparse-bm25-retriever';
import { MEMORY_ERROR_CODES } from '../contracts/memory-types';

export interface HybridSearchRequest {
  query: string;
  vector?: number[];
  organizationId: string;
  workspaceId: string;
  limit?: number;
  applyDecay?: boolean;
  halfLifeDays?: number;
}

export interface HybridSearchHit {
  id: string;
  denseRank: number | null;
  sparseRank: number | null;
  rrfScore: number;
  temporalDecayMultiplier: number;
  finalScore: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export class HybridRetriever {
  private readonly vectorStore: VectorStore;
  private readonly sparseRetriever: SparseBM25Retriever;
  private readonly rrfK: number;

  constructor(options: {
    vectorStore: VectorStore;
    sparseRetriever: SparseBM25Retriever;
    rrfK?: number;
  }) {
    this.vectorStore = options.vectorStore;
    this.sparseRetriever = options.sparseRetriever;
    this.rrfK = options.rrfK ?? 60;
  }

  public async search(request: HybridSearchRequest): Promise<HybridSearchHit[]> {
    const {
      query,
      vector,
      organizationId,
      workspaceId,
      limit = 10,
      applyDecay = true,
      halfLifeDays = 30,
    } = request;

    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    // 1. Execute sparse BM25
    const sparseHits = await this.sparseRetriever.search({
      query,
      organizationId,
      workspaceId,
      limit: limit * 2,
    });

    // 2. Execute dense vector if vector supplied
    let denseHits: Array<{ id: string; score: number; payload: Record<string, unknown> }> = [];
    if (vector && vector.length > 0) {
      try {
        denseHits = await this.vectorStore.search({
          vector,
          organizationId,
          workspaceId,
          limit: limit * 2,
        });
      } catch (err) {
        // Fall back gracefully to sparse-only search if dense provider encounters unexpected failure
        console.warn('[HybridRetriever] Dense vector search failed, falling back to sparse results', err);
        denseHits = [];
      }
    }

    // Map ranks
    const denseRankMap = new Map<string, number>();
    denseHits.forEach((hit, idx) => denseRankMap.set(hit.id, idx + 1));

    const sparseRankMap = new Map<string, number>();
    sparseHits.forEach((hit, idx) => sparseRankMap.set(hit.id, idx + 1));

    // Union of all candidate IDs
    const allIds = new Set<string>([...denseRankMap.keys(), ...sparseRankMap.keys()]);
    const hits: HybridSearchHit[] = [];

    const now = Date.now();
    const halfLifeMs = halfLifeDays * 24 * 60 * 60 * 1000;

    for (const id of allIds) {
      const dRank = denseRankMap.get(id) ?? null;
      const sRank = sparseRankMap.get(id) ?? null;

      // RRF: sum( 1 / (k + rank) )
      let rrf = 0;
      if (dRank !== null) rrf += 1 / (this.rrfK + dRank);
      if (sRank !== null) rrf += 1 / (this.rrfK + sRank);

      // Resolve content and createdAt
      let content = '';
      let createdAtStr = '';
      let metadata: Record<string, unknown> | undefined;

      const denseItem = denseHits.find((h) => h.id === id);
      if (denseItem) {
        content = (denseItem.payload.content as string) || '';
        createdAtStr = (denseItem.payload.createdAt as string) || '';
        metadata = denseItem.payload;
      } else {
        const sparseItem = sparseHits.find((h) => h.id === id);
        if (sparseItem) {
          content = sparseItem.content;
          metadata = sparseItem.metadata;
        }
      }

      // Compute Rule 29 half-life temporal decay
      let decay = 1.0;
      if (applyDecay && createdAtStr) {
        const ageMs = Math.max(0, now - new Date(createdAtStr).getTime());
        decay = Math.pow(0.5, ageMs / halfLifeMs);
      }

      const finalScore = rrf * decay;

      hits.push({
        id,
        denseRank: dRank,
        sparseRank: sRank,
        rrfScore: rrf,
        temporalDecayMultiplier: decay,
        finalScore,
        content,
        metadata,
      });
    }

    hits.sort((a, b) => b.finalScore - a.finalScore);
    return hits.slice(0, limit);
  }
}
