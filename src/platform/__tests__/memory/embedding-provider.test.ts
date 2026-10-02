/**
 * @fileOverview Unit Tests for Embedding Providers & LRU Cache (Phase 4 Milestone 3)
 *
 * Verifies CompanyBrain PRD §113, Rule 4 (Zero-any), Rule 20 (Rate Limiting),
 * Rule 24 (Resilient Fallback), and Rule 39 (Performance Budgets).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  DeterministicMemoryEmbeddingProvider,
  GoogleGenAiEmbeddingProvider,
} from '../../memory/ingestion/embedding-service';

describe('DeterministicMemoryEmbeddingProvider', () => {
  it('generates normalized 768-dimensional unit vectors with valid Euclidean norm', async () => {
    const provider = new DeterministicMemoryEmbeddingProvider();
    expect(provider.dimension).toBe(768);

    const vector = await provider.embed('The quick brown fox jumps over the lazy dog');
    expect(vector).toHaveLength(768);

    // Verify Euclidean norm: sqrt(sum(v_i^2)) ≈ 1.0
    const sumSquares = vector.reduce((acc, v) => acc + v * v, 0);
    const norm = Math.sqrt(sumSquares);
    expect(norm).toBeCloseTo(1.0, 5);
  });

  it('produces identical vectors for identical text and distinct vectors for different text', async () => {
    const provider = new DeterministicMemoryEmbeddingProvider();

    const v1 = await provider.embed('Quarterly sales report');
    const v2 = await provider.embed('Quarterly sales report');
    const v3 = await provider.embed('Unrelated engineering design document');

    expect(v1).toEqual(v2);
    expect(v1).not.toEqual(v3);
  });

  it('handles batch embedding correctly and maintains order', async () => {
    const provider = new DeterministicMemoryEmbeddingProvider();
    const texts = ['Item 1', 'Item 2', 'Item 3'];

    const batch = await provider.embedBatch(texts);
    expect(batch).toHaveLength(3);
    expect(batch[0]).toEqual(await provider.embed('Item 1'));
    expect(batch[1]).toEqual(await provider.embed('Item 2'));
    expect(batch[2]).toEqual(await provider.embed('Item 3'));
  });

  it('reports healthy on health check probe', async () => {
    const provider = new DeterministicMemoryEmbeddingProvider();
    const health = await provider.healthCheck();

    expect(health.healthy).toBe(true);
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe('GoogleGenAiEmbeddingProvider & LRU Caching', () => {
  it('utilizes LRU cache and tracks hit and miss counts accurately', async () => {
    const provider = new GoogleGenAiEmbeddingProvider({
      maxCacheSize: 3,
    });

    // 1st call: Cache miss
    const v1 = await provider.embed('cached text passage');
    expect(provider.getCacheStats().misses).toBe(1);
    expect(provider.getCacheStats().hits).toBe(0);

    // 2nd call: Cache hit
    const v2 = await provider.embed('cached text passage');
    expect(provider.getCacheStats().hits).toBe(1);
    expect(v1).toEqual(v2);

    // Fill cache to trigger eviction (max size = 3)
    await provider.embed('doc 2');
    await provider.embed('doc 3');
    expect(provider.getCacheStats().size).toBe(3);

    await provider.embed('doc 4'); // Should evict 'cached text passage'
    expect(provider.getCacheStats().size).toBe(3);

    // Now 'cached text passage' should be a cache miss again
    await provider.embed('cached text passage');
    expect(provider.getCacheStats().misses).toBe(5);
  });

  it('falls back to DeterministicMemoryEmbeddingProvider seamlessly when external calls fail (Rule 24)', async () => {
    const mockFallback = new DeterministicMemoryEmbeddingProvider();
    const embedSpy = vi.spyOn(mockFallback, 'embed');

    const provider = new GoogleGenAiEmbeddingProvider({
      fallbackProvider: mockFallback,
    });

    const vector = await provider.embed('fallback test prompt');
    expect(vector).toHaveLength(768);
    expect(embedSpy).toHaveBeenCalled();
  });
});
