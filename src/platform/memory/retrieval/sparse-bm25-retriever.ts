/**
 * @fileOverview In-Memory Sparse BM25 Keyword Search Engine (Phase 4 Milestone 2)
 *
 * ARCHITECTURAL INVARIANTS (Rules 4, 8, 9, 32):
 * 1. Implements standard Okapi BM25 ranking (k1=1.2, b=0.75) with tenant payload isolation.
 * 2. Guaranteed non-negative smoothed Lucene IDF prevents division by zero.
 * 3. Self-contained with zero external dependencies.
 *
 * @testability Covered in `src/platform/__tests__/memory/sparse-bm25.test.ts`.
 */

import { MEMORY_ERROR_CODES } from '../contracts/memory-types';

export interface BM25Document {
  id: string;
  organizationId: string;
  workspaceId: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BM25SearchHit {
  id: string;
  score: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface BM25SearchParams {
  query: string;
  organizationId: string;
  workspaceId: string;
  limit?: number;
}

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
  'to', 'was', 'were', 'will', 'with', 'the', 'this', 'our', 'we',
]);

function tokenize(text: string): string[] {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export class SparseBM25Retriever {
  private readonly k1: number = 1.2;
  private readonly b: number = 0.75;
  private readonly docs = new Map<string, BM25Document>();
  private readonly docTokens = new Map<string, string[]>();

  public async indexDocuments(documents: BM25Document[]): Promise<void> {
    for (const doc of documents) {
      this.docs.set(doc.id, doc);
      this.docTokens.set(doc.id, tokenize(doc.content));
    }
  }

  public async search(params: BM25SearchParams): Promise<BM25SearchHit[]> {
    const { query, organizationId, workspaceId, limit = 10 } = params;

    if (!organizationId || !workspaceId) {
      throw new Error(MEMORY_ERROR_CODES.TENANT_REQUIRED);
    }

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    // Filter tenant documents
    const tenantDocIds: string[] = [];
    let totalLength = 0;

    for (const [id, doc] of this.docs.entries()) {
      if (doc.organizationId === organizationId && doc.workspaceId === workspaceId) {
        tenantDocIds.push(id);
        const tokens = this.docTokens.get(id) || [];
        totalLength += tokens.length;
      }
    }

    const N = tenantDocIds.length;
    if (N === 0) return [];

    const avgdl = totalLength / N || 1;

    // Calculate document frequencies (df) for query terms within tenant corpus
    const df = new Map<string, number>();
    for (const term of queryTokens) {
      let count = 0;
      for (const id of tenantDocIds) {
        const tokens = this.docTokens.get(id) || [];
        if (tokens.includes(term)) {
          count++;
        }
      }
      df.set(term, count);
    }

    const hits: BM25SearchHit[] = [];

    for (const id of tenantDocIds) {
      const doc = this.docs.get(id)!;
      const tokens = this.docTokens.get(id) || [];
      const docLen = tokens.length;

      // Term frequency map for doc
      const tf = new Map<string, number>();
      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      let score = 0;
      for (const term of queryTokens) {
        const termFreq = tf.get(term) || 0;
        if (termFreq === 0) continue;

        const docFreq = df.get(term) || 0;
        // Smoothed Lucene-style IDF
        const idf = Math.log(1 + (N - docFreq + 0.5) / (docFreq + 0.5));
        const num = termFreq * (this.k1 + 1);
        const den = termFreq + this.k1 * (1 - this.b + this.b * (docLen / avgdl));
        score += idf * (num / den);
      }

      if (score > 0) {
        hits.push({
          id,
          score,
          content: doc.content,
          metadata: doc.metadata,
        });
      }
    }

    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, limit);
  }

  public clear(): void {
    this.docs.clear();
    this.docTokens.clear();
  }
}
