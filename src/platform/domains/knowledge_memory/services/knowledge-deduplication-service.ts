/**
 * @fileOverview Knowledge Multi-Domain Deduplication Engine (Phase 11 M3 · T3)
 *
 * Implements Rule 19 (Deduplication & Idempotency),
 * Rule 42 (Shadow Mode / Dry-Run Compatibility),
 * Rule 4 (Zero any/any[]).
 *
 * Computes exact content hash match and Jaccard word-token overlap (threshold >= 0.80).
 */

import { adminDb } from '@/lib/firebase-admin';

export interface DeduplicateResult {
  isDuplicate: boolean;
  similarity: number;
  duplicateOfMemoryId?: string;
  reason?: string;
}

export class KnowledgeDeduplicationService {
  /**
   * Normalizes text by removing XML tags, punctuation, lowercasing, and collapsing whitespace.
   */
  public normalizeText(rawText: string): string {
    return rawText
      .replace(/<[^>]+>/g, ' ') // Strip XML/HTML tags
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with space
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Converts normalized text into a set of unique word tokens.
   */
  public tokenize(normalizedText: string): Set<string> {
    const words = normalizedText.split(' ').filter((w) => w.length > 2);
    return new Set(words);
  }

  /**
   * Computes Jaccard similarity coefficient between two token sets.
   */
  public computeJaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
    if (setA.size === 0 && setB.size === 0) return 1.0;
    if (setA.size === 0 || setB.size === 0) return 0.0;

    let intersectionCount = 0;
    for (const token of setA) {
      if (setB.has(token)) {
        intersectionCount++;
      }
    }

    const unionCount = setA.size + setB.size - intersectionCount;
    return unionCount === 0 ? 0.0 : intersectionCount / unionCount;
  }

  /**
   * Evaluates a candidate against existing memories to detect exact or near duplicates.
   */
  async deduplicateCandidate(
    candidate: { title: string; content: string; workspaceId: string },
    providedMemories?: Array<{ id: string; title: string; content: string }>
  ): Promise<DeduplicateResult> {
    let memoriesToSearch = providedMemories;

    if (!memoriesToSearch && adminDb) {
      try {
        const snap = await adminDb
          .collection('memory_objects')
          .where('workspaceId', '==', candidate.workspaceId)
          .where('lifecycle.status', '==', 'active')
          .limit(100)
          .get();

        memoriesToSearch = snap.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            title: (data.title as string) || '',
            content: (data.content as string) || '',
          };
        });
      } catch {
        memoriesToSearch = [];
      }
    }

    if (!memoriesToSearch || memoriesToSearch.length === 0) {
      return { isDuplicate: false, similarity: 0.0 };
    }

    const candNormalized = this.normalizeText(`${candidate.title} ${candidate.content}`);
    const candTokens = this.tokenize(candNormalized);

    let highestSimilarity = 0.0;
    let mostSimilarMemoryId: string | undefined;
    let matchReason: string | undefined;

    for (const mem of memoriesToSearch) {
      const memNormalized = this.normalizeText(`${mem.title} ${mem.content}`);

      // 1. Exact match
      if (candNormalized === memNormalized) {
        return {
          isDuplicate: true,
          similarity: 1.0,
          duplicateOfMemoryId: mem.id,
          reason: 'Exact content match',
        };
      }

      // 2. Jaccard token overlap
      const memTokens = this.tokenize(memNormalized);
      const similarity = this.computeJaccardSimilarity(candTokens, memTokens);

      if (similarity > highestSimilarity) {
        highestSimilarity = similarity;
        mostSimilarMemoryId = mem.id;
      }
    }

    const roundedSimilarity = Math.round(highestSimilarity * 100) / 100;
    const isDuplicate = roundedSimilarity >= 0.8;

    if (isDuplicate) {
      matchReason = `High lexical overlap (${Math.round(roundedSimilarity * 100)}%)`;
    }

    return {
      isDuplicate,
      similarity: roundedSimilarity,
      duplicateOfMemoryId: isDuplicate ? mostSimilarMemoryId : undefined,
      reason: matchReason,
    };
  }
}

// Global HMR singleton preservation
const GLOBAL_KNOWLEDGE_DEDUP_SERVICE_KEY = Symbol.for('smartsapp.knowledge_dedup_service');
type GlobalWithDedupService = typeof globalThis & {
  [GLOBAL_KNOWLEDGE_DEDUP_SERVICE_KEY]?: KnowledgeDeduplicationService;
};

export function getKnowledgeDeduplicationService(): KnowledgeDeduplicationService {
  const g = globalThis as GlobalWithDedupService;
  if (!g[GLOBAL_KNOWLEDGE_DEDUP_SERVICE_KEY]) {
    g[GLOBAL_KNOWLEDGE_DEDUP_SERVICE_KEY] = new KnowledgeDeduplicationService();
  }
  return g[GLOBAL_KNOWLEDGE_DEDUP_SERVICE_KEY];
}
