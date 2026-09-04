import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryObject } from '../types';

// Mock Firestore Admin SDK
const mockDocRef = {
  id: 'mem_123',
  get: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockCollectionRef = {
  doc: vi.fn(() => mockDocRef),
  where: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  get: vi.fn(),
};

const mockBatch = {
  set: vi.fn(),
  delete: vi.fn(),
  commit: vi.fn().mockResolvedValue([]),
};

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => mockCollectionRef),
    batch: vi.fn(() => mockBatch),
  },
}));

import { MemoryRepository } from '../memory-repository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MemoryRepository', () => {
  const sampleMemoryDraft: Omit<MemoryObject, 'id' | 'createdAt' | 'updatedAt'> = {
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    type: 'decision',
    title: 'Adopt Vitest for CompanyBrain testing',
    content: 'Team agreed to use Vitest for all unit tests.',
    summary: 'Adopt Vitest',
    source: {
      type: 'user_note',
      sourceId: 'note_123',
      sourceHash: 'abc123hash',
    },
    subjectRefs: { entityIds: ['ent_1'] },
    topics: ['testing', 'architecture'],
    entities: [{ entityName: 'Vitest', entityType: 'deal', confidenceScore: 0.95 }],
    importance: 0.85,
    confidence: 0.92,
    verification: 'ai_generated',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'agent', userId: 'user_1' },
    evidence: 'Team agreed to use Vitest',
  };

  it('createMemory persists a document and stamps id, createdAt, updatedAt', async () => {
    mockDocRef.set.mockResolvedValue(undefined);

    const memory = await MemoryRepository.createMemory(sampleMemoryDraft);

    expect(memory.id).toBe('mem_123');
    expect(memory.createdAt).toBeDefined();
    expect(memory.updatedAt).toBeDefined();
    expect(memory.type).toBe('decision');
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('createMemoriesBatch chunks batch operations when exceeding 250 items', async () => {
    const drafts = Array.from({ length: 260 }, (_, i) => ({
      ...sampleMemoryDraft,
      title: `Draft ${i}`,
    }));

    const results = await MemoryRepository.createMemoriesBatch(drafts);

    expect(results).toHaveLength(260);
    // Should have split into 2 batches (250 + 10)
    expect(mockBatch.commit).toHaveBeenCalledTimes(2);
  });

  it('confirmMemory transitions status to user_confirmed and records reviewer', async () => {
    const existingDoc: MemoryObject = {
      ...sampleMemoryDraft,
      id: 'mem_123',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => existingDoc,
    });
    mockDocRef.update.mockResolvedValue(undefined);

    const confirmed = await MemoryRepository.confirmMemory('mem_123', 'reviewer_999');

    expect(confirmed.verification).toBe('user_confirmed');
    expect(confirmed.lifecycle.reviewedBy).toBe('reviewer_999');
    expect(confirmed.lifecycle.lastReviewedAt).toBeDefined();
    expect(mockDocRef.update).toHaveBeenCalled();
  });

  it('invalidateMemory transitions status to invalidated and records reason', async () => {
    const existingDoc: MemoryObject = {
      ...sampleMemoryDraft,
      id: 'mem_123',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-01T00:00:00Z',
    };

    mockDocRef.get.mockResolvedValue({
      exists: true,
      data: () => existingDoc,
    });
    mockDocRef.update.mockResolvedValue(undefined);

    const invalidated = await MemoryRepository.invalidateMemory(
      'mem_123',
      'Superseded by contract renewal',
      'reviewer_999'
    );

    expect(invalidated.verification).toBe('invalidated');
    expect(invalidated.lifecycle.status).toBe('archived');
    expect(invalidated.lifecycle.invalidationReason).toBe('Superseded by contract renewal');
    expect(invalidated.lifecycle.reviewedBy).toBe('reviewer_999');
    expect(mockDocRef.update).toHaveBeenCalled();
  });

  it('getMemoryStats calculates correct total, pending, and verified metrics', async () => {
    const fakeDocs = [
      {
        data: () => ({
          verification: 'user_confirmed',
          lifecycle: { status: 'active' },
        }),
      },
      {
        data: () => ({
          verification: 'ai_generated',
          lifecycle: { status: 'active' },
        }),
      },
      {
        data: () => ({
          verification: 'invalidated',
          lifecycle: { status: 'archived' },
        }),
      },
    ];

    mockCollectionRef.get.mockResolvedValue({ docs: fakeDocs });

    const stats = await MemoryRepository.getMemoryStats('ws_test');

    expect(stats.totalMemories).toBe(2);
    expect(stats.verifiedCount).toBe(1);
    expect(stats.pendingReviewCount).toBe(1);
    expect(stats.conflictsOrInvalidatedCount).toBe(1);
  });
});
