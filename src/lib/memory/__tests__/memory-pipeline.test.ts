import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractMemoriesOutput } from '@/ai/flows/extract-memories-flow';

const extractMemoriesMock = vi.fn();
const getMemoriesBySourceIdMock = vi.fn();
const deleteMemoriesBySourceIdMock = vi.fn();
const createMemoriesBatchMock = vi.fn();

const mockNoteDoc = {
  exists: true,
  data: () => ({ id: 'note_123', title: 'Test Note' }),
  update: vi.fn().mockResolvedValue(undefined),
};

const mockNoteRef = {
  get: vi.fn().mockResolvedValue(mockNoteDoc),
  update: vi.fn().mockResolvedValue(undefined),
};

const mockEntitiesSnap = {
  docs: [
    {
      id: 'ent_acme',
      data: () => ({ entityId: 'ent_acme', displayName: 'Acme Corp', status: 'active' }),
    },
  ],
};

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn((colName: string) => {
      if (colName === 'workspace_entities') {
        return {
          where: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          get: vi.fn().mockResolvedValue(mockEntitiesSnap),
        };
      }
      if (colName === 'quick_notes') {
        return {
          doc: vi.fn(() => mockNoteRef),
        };
      }
      return {
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({ docs: [] }),
      };
    }),
    batch: vi.fn(() => ({
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue([]),
    })),
  },
}));

vi.mock('@/ai/flows/extract-memories-flow', () => ({
  extractMemories: (...args: unknown[]) => extractMemoriesMock(...args),
}));

vi.mock('../memory-repository', () => ({
  MemoryRepository: {
    getMemoriesBySourceId: (...args: unknown[]) => getMemoriesBySourceIdMock(...args),
    deleteMemoriesBySourceId: (...args: unknown[]) => deleteMemoriesBySourceIdMock(...args),
    createMemoriesBatch: (...args: unknown[]) => createMemoriesBatchMock(...args),
  },
  MEMORY_OBJECTS_COLLECTION: 'memory_objects',
}));

vi.mock('../qdrant/qdrant-indexer', () => ({
  QdrantIndexer: {
    indexMemory: vi.fn().mockResolvedValue(true),
    indexMemoriesBatch: vi.fn().mockResolvedValue({ indexed: 1, failed: 0 }),
    deleteMemoryIndex: vi.fn().mockResolvedValue(true),
    deleteSourceIndex: vi.fn().mockResolvedValue(true),
  },
}));

import { NoteMemoryPipeline } from '../pipeline/note-memory-pipeline';

beforeEach(() => {
  vi.clearAllMocks();
  getMemoriesBySourceIdMock.mockResolvedValue([]);
  deleteMemoriesBySourceIdMock.mockResolvedValue(0);
  createMemoriesBatchMock.mockImplementation(async (items) => {
    return items.map((item: Record<string, unknown>, idx: number) => ({
      ...item,
      id: `mem_${idx}`,
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    }));
  });
});

describe('NoteMemoryPipeline', () => {
  const plainText = 'We agreed to sign the renewal agreement with Acme Corp by next Friday.';

  const mockAiOutput: ExtractMemoriesOutput = {
    memoryCandidates: [
      {
        type: 'decision',
        title: 'Sign Acme Corp renewal agreement',
        content: 'We agreed to sign the renewal agreement with Acme Corp by next Friday.',
        importance: 0.9,
        confidence: 0.95,
        evidence: 'agreed to sign the renewal agreement with Acme Corp',
      },
    ],
    extractedEntities: [
      {
        entityName: 'Acme Corp',
        entityType: 'deal',
        confidenceScore: 0.98,
      },
    ],
    topics: ['Renewal', 'Contract'],
    executiveSummary: 'Agreement reached with Acme Corp.',
    overallSentiment: 'positive',
  };

  it('computes consistent sha256 hashes for normalized text', () => {
    const hash1 = NoteMemoryPipeline.computeTextHash('Hello World');
    const hash2 = NoteMemoryPipeline.computeTextHash('  hello world  \n');
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(64);
  });

  it('skips AI extraction if note text hash matches existing memories (idempotent)', async () => {
    const hash = NoteMemoryPipeline.computeTextHash(plainText);
    getMemoriesBySourceIdMock.mockResolvedValue([
      {
        id: 'existing_mem_1',
        source: { sourceHash: hash, sourceId: 'note_123' },
      },
    ]);

    const result = await NoteMemoryPipeline.processNote({
      noteId: 'note_123',
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      userId: 'user_1',
      title: 'Meeting with Acme',
      plainText,
      forceReExtract: false,
    });

    expect(result.success).toBe(true);
    expect(result.isCached).toBe(true);
    expect(extractMemoriesMock).not.toHaveBeenCalled();
  });

  it('runs AI extraction, matches active entities, and stores memories', async () => {
    extractMemoriesMock.mockResolvedValue(mockAiOutput);

    const result = await NoteMemoryPipeline.processNote({
      noteId: 'note_123',
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      userId: 'user_1',
      title: 'Meeting with Acme',
      plainText,
      forceReExtract: true,
    });

    expect(result.success).toBe(true);
    expect(extractMemoriesMock).toHaveBeenCalledTimes(1);
    expect(deleteMemoriesBySourceIdMock).toHaveBeenCalledWith('note_123');
    expect(createMemoriesBatchMock).toHaveBeenCalledTimes(1);
    expect(result.memories).toHaveLength(1);
    expect(result.memories[0].entities[0].entityId).toBe('ent_acme');
    expect(mockNoteRef.update).toHaveBeenCalled();
  });

  it('returns failure when note plain text is empty', async () => {
    const result = await NoteMemoryPipeline.processNote({
      noteId: 'note_123',
      workspaceId: 'ws_1',
      organizationId: 'org_1',
      userId: 'user_1',
      title: 'Empty',
      plainText: '   ',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('no text');
    expect(extractMemoriesMock).not.toHaveBeenCalled();
  });
});
