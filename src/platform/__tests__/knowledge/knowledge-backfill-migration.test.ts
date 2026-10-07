/**
 * @fileOverview Test Suite: Offline Embeddings Backfill Migration (Phase 11 M3 · T6)
 *
 * Enforces Rule 43 (Replayable migration script with --dry-run & progress checkpoints),
 * Rule 24 (Rate-limit handling with exponential backoff & retry),
 * Rule 8 & 47 (Multi-Tenant Scoping).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  BackfillKnowledgeEmbeddingsRunner,
  type BackfillDependencies,
} from '../../../../scripts/migrations/backfill-knowledge-embeddings';

describe('Offline Embeddings Backfill Migration (Phase 11 M3 · T6)', () => {
  it('runs dry-run reporting counts and items without writing embeddings', async () => {
    const mockStorage = {
      records: [
        { id: 'mem_1', content: 'School fee structure.' },
        { id: 'mem_2', content: 'Campus opening hours.' },
      ],
      savedEmbeddings: new Map<string, number[]>(),
      checkpoint: null as { lastProcessedId: string; count: number } | null,
    };

    const deps: BackfillDependencies = {
      embeddingProvider: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
      storageAdapter: {
        getUnembeddedRecords: vi.fn().mockResolvedValue(mockStorage.records),
        saveEmbedding: vi.fn().mockImplementation((id, emb) => {
          mockStorage.savedEmbeddings.set(id, emb);
          return Promise.resolve();
        }),
        getCheckpoint: vi.fn().mockResolvedValue(mockStorage.checkpoint),
        saveCheckpoint: vi.fn().mockImplementation((_ws, cp) => {
          mockStorage.checkpoint = cp;
          return Promise.resolve();
        }),
      },
    };

    const runner = new BackfillKnowledgeEmbeddingsRunner(deps);
    const result = await runner.run({
      workspaceId: 'ws_test_dry',
      dryRun: true,
    });

    expect(result.dryRun).toBe(true);
    expect(result.scannedCount).toBe(2);
    expect(result.processedCount).toBe(2);
    expect(result.errorsCount).toBe(0);

    // In dry-run, no embeddings are saved to storage
    expect(deps.storageAdapter?.saveEmbedding).not.toHaveBeenCalled();
    expect(deps.storageAdapter?.saveCheckpoint).not.toHaveBeenCalled();
  });

  it('runs live backfill, saves 768-D embeddings and updates checkpoint', async () => {
    const mockSaved = new Map<string, number[]>();
    let checkpoint: { lastProcessedId: string; count: number } | null = null;

    const deps: BackfillDependencies = {
      embeddingProvider: vi.fn().mockResolvedValue(new Array(768).fill(0.05)),
      storageAdapter: {
        getUnembeddedRecords: vi.fn().mockResolvedValue([
          { id: 'mem_live_1', content: 'Hostel rules.' },
          { id: 'mem_live_2', content: 'Cafeteria menu.' },
        ]),
        saveEmbedding: vi.fn().mockImplementation((id, emb) => {
          mockSaved.set(id, emb);
          return Promise.resolve();
        }),
        getCheckpoint: vi.fn().mockResolvedValue(checkpoint),
        saveCheckpoint: vi.fn().mockImplementation((_ws, cp) => {
          checkpoint = cp;
          return Promise.resolve();
        }),
      },
    };

    const runner = new BackfillKnowledgeEmbeddingsRunner(deps);
    const result = await runner.run({
      workspaceId: 'ws_test_live',
      dryRun: false,
    });

    expect(result.dryRun).toBe(false);
    expect(result.processedCount).toBe(2);
    expect(mockSaved.size).toBe(2);
    expect(mockSaved.get('mem_live_1')?.length).toBe(768);
    expect(checkpoint).toEqual({ lastProcessedId: 'mem_live_2', count: 2 });
  });

  it('handles rate-limit HTTP 429 with exponential retry and recovery (Rule 24)', async () => {
    let callCount = 0;
    const flakyEmbeddingProvider = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        const err = new Error('Too Many Requests');
        (err as unknown as { status: number }).status = 429;
        throw err;
      }
      return new Array(768).fill(0.01);
    });

    const saved = new Map<string, number[]>();
    const deps: BackfillDependencies = {
      embeddingProvider: flakyEmbeddingProvider,
      storageAdapter: {
        getUnembeddedRecords: vi.fn().mockResolvedValue([
          { id: 'mem_flaky', content: 'Rate limited fact.' },
        ]),
        saveEmbedding: vi.fn().mockImplementation((id, emb) => {
          saved.set(id, emb);
          return Promise.resolve();
        }),
        getCheckpoint: vi.fn().mockResolvedValue(null),
        saveCheckpoint: vi.fn().mockResolvedValue(undefined),
      },
    };

    const runner = new BackfillKnowledgeEmbeddingsRunner(deps, {
      initialBackoffMs: 10,
      maxRetries: 2,
    });
    const result = await runner.run({
      workspaceId: 'ws_test_retry',
      dryRun: false,
    });

    expect(result.processedCount).toBe(1);
    expect(callCount).toBe(2); // 1st failed with 429, 2nd succeeded
    expect(saved.size).toBe(1);
  });
});
