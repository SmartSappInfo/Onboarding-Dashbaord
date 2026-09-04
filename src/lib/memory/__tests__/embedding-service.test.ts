import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingService } from '../services/embedding-service';
import { VECTOR_DIMENSION } from '../semantic-types';

describe('EmbeddingService', () => {
  beforeEach(() => {
    EmbeddingService.clearCache();
  });

  describe('chunkText', () => {
    it('returns empty array when text is empty or whitespace', () => {
      expect(EmbeddingService.chunkText('')).toEqual([]);
      expect(EmbeddingService.chunkText('   \n  ')).toEqual([]);
    });

    it('creates a single chunk for short text', () => {
      const text = 'Quick note on client onboarding process.';
      const chunks = EmbeddingService.chunkText(text);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].chunkId).toBe('chunk_0');
      expect(chunks[0].content).toBe(text);
      expect(chunks[0].tokenCountEstimate).toBeGreaterThan(0);
    });

    it('chunks longer text and respects targetChunkSize and maxChunks', () => {
      const paragraph = 'SmartSapp institutional knowledge indexing enables fast semantic search across all team notes. ';
      const longText = paragraph.repeat(25); // ~2,400 chars

      const chunks = EmbeddingService.chunkText(longText, {
        targetChunkSize: 500,
        overlap: 50,
        maxChunks: 10,
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.length).toBeLessThanOrEqual(10);
      chunks.forEach((chunk, index) => {
        expect(chunk.chunkId).toBe(`chunk_${index}`);
        expect(chunk.content.length).toBeGreaterThan(0);
      });
    });

    it('extracts markdown headings for chunks', () => {
      const markdown = `
### Onboarding Milestone
The school requires parent portal setup by August 15.

### Pricing Agreement
We agreed on a $2,500 annual subscription.
`;
      const chunks = EmbeddingService.chunkText(markdown, { targetChunkSize: 150 });
      expect(chunks.length).toBeGreaterThanOrEqual(2);
      expect(chunks.some((c) => c.heading && c.heading.includes('Onboarding Milestone'))).toBe(true);
      expect(chunks.some((c) => c.heading && c.heading.includes('Pricing Agreement'))).toBe(true);
    });
  });

  describe('generateFallbackVector', () => {
    it('generates a 768-dimensional normalized vector', () => {
      const vector = EmbeddingService.generateFallbackVector('test phrase for vector generation');
      expect(vector).toHaveLength(VECTOR_DIMENSION);
      expect(vector).toHaveLength(768);

      // Verify normalization: magnitude sqrt(sum(v_i^2)) should be ~1.0
      const sumSq = vector.reduce((acc, v) => acc + v * v, 0);
      const magnitude = Math.sqrt(sumSq);
      expect(magnitude).toBeCloseTo(1.0, 3);
    });

    it('generates identical vectors for identical text (deterministic)', () => {
      const v1 = EmbeddingService.generateFallbackVector('consistent hash input');
      const v2 = EmbeddingService.generateFallbackVector('consistent hash input');
      expect(v1).toEqual(v2);
    });

    it('generates different vectors for different text', () => {
      const v1 = EmbeddingService.generateFallbackVector('Topic Alpha');
      const v2 = EmbeddingService.generateFallbackVector('Topic Beta');
      expect(v1).not.toEqual(v2);
    });
  });

  describe('LRU Embedding Cache', () => {
    it('tracks cache statistics and increases hit rate on repeated queries', async () => {
      const text = 'Cash flow and billing cycle terms';

      const initialStats = EmbeddingService.getCacheStats();
      expect(initialStats.size).toBe(0);

      // First query: cache miss
      const vec1 = await EmbeddingService.embedText(text);
      expect(vec1).toHaveLength(VECTOR_DIMENSION);

      const afterMissStats = EmbeddingService.getCacheStats();
      expect(afterMissStats.size).toBe(1);
      expect(afterMissStats.misses).toBe(1);
      expect(afterMissStats.hits).toBe(0);

      // Second query: cache hit
      const vec2 = await EmbeddingService.embedText(text);
      expect(vec2).toEqual(vec1);

      const afterHitStats = EmbeddingService.getCacheStats();
      expect(afterHitStats.hits).toBe(1);
      expect(afterHitStats.hitRate).toBe(50); // 1 hit out of 2 queries = 50%
    });

    it('clears cache when clearCache is invoked', async () => {
      await EmbeddingService.embedText('Sample item');
      expect(EmbeddingService.getCacheStats().size).toBe(1);

      EmbeddingService.clearCache();
      const stats = EmbeddingService.getCacheStats();
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });
});
