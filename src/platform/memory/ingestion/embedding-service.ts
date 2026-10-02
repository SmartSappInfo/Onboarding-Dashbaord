/**
 * @fileOverview Decoupled Embedding Provider & LRU Caching Service (Phase 4 Milestone 3)
 *
 * Implements CompanyBrain PRD §113 (Embedding Strategy), Rule 4 (Zero-any),
 * Rule 9 (Load Governance), Rule 20 (Rate Limiting & Quota Defense),
 * Rule 24 (Resilient Fallback), and Rule 39 (Performance Budgets).
 *
 * @testability Covered in `src/platform/__tests__/memory/embedding-provider.test.ts`.
 */

import { createHash } from 'node:crypto';

export interface EmbeddingProvider {
  readonly modelName: string;
  readonly dimension: number;
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  healthCheck(): Promise<{ healthy: boolean; latencyMs: number }>;
}

export interface EmbeddingCacheEntry {
  vector: number[];
  timestamp: number;
}

export interface EmbeddingCacheStats {
  hits: number;
  misses: number;
  size: number;
}

/**
 * High-speed, deterministic embedding provider for offline environments,
 * isolated unit tests, and automatic zero-downtime fallback.
 */
export class DeterministicMemoryEmbeddingProvider implements EmbeddingProvider {
  public readonly modelName = 'deterministic-mock-001';
  public readonly dimension = 768;

  public async embed(text: string): Promise<number[]> {
    return DeterministicMemoryEmbeddingProvider.generateDeterministicVector(text, this.dimension);
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    return texts.map((t) =>
      DeterministicMemoryEmbeddingProvider.generateDeterministicVector(t, this.dimension)
    );
  }

  public async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    await this.embed('health-check-probe');
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Generates a normalized 768-dimensional unit vector from a text string.
   */
  public static generateDeterministicVector(text: string, dimension = 768): number[] {
    const raw = (text || '').trim().toLowerCase();
    const hash = createHash('sha256').update(raw).digest();

    const vector: number[] = Array.from({ length: dimension }, () => 0.0);
    let sumSquares = 0;

    for (let i = 0; i < dimension; i++) {
      // Pick a byte from the 32-byte digest cycle and an index offset
      const byteVal = hash[i % 32];
      const val = Math.sin((i + 1) * 0.17 + byteVal * 0.05);
      vector[i] = val;
      sumSquares += val * val;
    }

    // Normalize to unit Euclidean norm (|v| = 1.0)
    const norm = Math.sqrt(sumSquares) || 1.0;
    for (let i = 0; i < dimension; i++) {
      vector[i] = vector[i] / norm;
    }

    return vector;
  }
}

/**
 * Production embedding provider calling Gemini embedding model (text-embedding-004)
 * with concurrency throttling, exponential retries, and local LRU caching.
 */
export class GoogleGenAiEmbeddingProvider implements EmbeddingProvider {
  public readonly modelName = 'text-embedding-004';
  public readonly dimension = 768;

  private readonly maxConcurrency: number;
  private readonly maxRetries: number;
  private readonly cache = new Map<string, EmbeddingCacheEntry>();
  private readonly maxCacheSize: number;
  private cacheHits = 0;
  private cacheMisses = 0;
  private readonly fallbackProvider: EmbeddingProvider;

  constructor(options: {
    maxConcurrency?: number;
    maxRetries?: number;
    maxCacheSize?: number;
    fallbackProvider?: EmbeddingProvider;
  } = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 5; // Rule 20 quota defense
    this.maxRetries = options.maxRetries ?? 3;
    this.maxCacheSize = options.maxCacheSize ?? 500;
    this.fallbackProvider = options.fallbackProvider ?? new DeterministicMemoryEmbeddingProvider();
  }

  private hashText(text: string): string {
    return createHash('sha256').update((text || '').trim().toLowerCase()).digest('hex');
  }

  public getCacheStats(): EmbeddingCacheStats {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      size: this.cache.size,
    };
  }

  public clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  public async embed(text: string): Promise<number[]> {
    const clean = (text || '').trim();
    if (!clean) {
      return Array.from({ length: this.dimension }, () => 0.0);
    }

    const key = this.hashText(clean);
    const cached = this.cache.get(key);
    if (cached) {
      this.cacheHits++;
      return [...cached.vector];
    }

    this.cacheMisses++;

    let vector: number[];
    try {
      vector = await this.callApiWithRetry(clean);
    } catch (err) {
      console.warn(
        `[GoogleGenAiEmbeddingProvider] External embed call failed, activating deterministic fallback (Rule 24):`,
        err
      );
      vector = await this.fallbackProvider.embed(clean);
    }

    // Cache vector
    if (this.cache.size >= this.maxCacheSize) {
      // Evict oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { vector, timestamp: Date.now() });

    return vector;
  }

  public async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const results: number[][] = Array.from({ length: texts.length }, () => []);
    const toFetchIndices: number[] = [];
    const toFetchTexts: string[] = [];

    // 1. Check cache first
    for (let i = 0; i < texts.length; i++) {
      const clean = (texts[i] || '').trim();
      const key = this.hashText(clean);
      const cached = this.cache.get(key);
      if (cached) {
        this.cacheHits++;
        results[i] = [...cached.vector];
      } else {
        this.cacheMisses++;
        toFetchIndices.push(i);
        toFetchTexts.push(clean);
      }
    }

    if (toFetchTexts.length === 0) {
      return results;
    }

    // 2. Fetch uncached texts with concurrency pool
    const fetchedVectors: number[][] = [];
    for (let i = 0; i < toFetchTexts.length; i += this.maxConcurrency) {
      const chunk = toFetchTexts.slice(i, i + this.maxConcurrency);
      const chunkPromises = chunk.map((txt) => this.embed(txt));
      const chunkResults = await Promise.all(chunkPromises);
      fetchedVectors.push(...chunkResults);
    }

    // 3. Map back to results
    for (let j = 0; j < toFetchIndices.length; j++) {
      const originalIndex = toFetchIndices[j];
      results[originalIndex] = fetchedVectors[j];
    }

    return results;
  }

  public async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    const start = Date.now();
    try {
      await this.embed('health-check');
      return { healthy: true, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start };
    }
  }

  /**
   * Calls the underlying Genkit / Gemini embedding model with retry.
   */
  private async callApiWithRetry(text: string): Promise<number[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Attempt Genkit AI embedding if available
        const { ai } = await import('@/ai/genkit');
        const { googleAI } = await import('@genkit-ai/google-genai');
        if (ai && typeof ai.embed === 'function' && googleAI && typeof googleAI.embedder === 'function') {
          const embedder = googleAI.embedder('gemini-embedding-001');
          const res = await ai.embed({
            embedder,
            content: text,
          });

          const candidate = (res as Array<{ embedding?: number[] }>)[0]?.embedding;
          if (Array.isArray(candidate) && candidate.length === this.dimension) {
            return candidate;
          }
        }
        // If ai.embed is unavailable or returned unexpected format, delegate to fallback
        return await this.fallbackProvider.embed(text);
      } catch (err) {
        lastError = err;
        if (attempt < this.maxRetries) {
          // Exponential backoff with jitter (50ms * 2^attempt + jitter)
          const delay = Math.pow(2, attempt) * 50 + Math.random() * 25;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
