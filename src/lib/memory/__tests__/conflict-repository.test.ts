import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryConflict } from '../orchestrator-types';

// Mock Firestore Admin SDK
const mockDocRef = {
  id: 'conflict_123',
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

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => mockCollectionRef),
  },
}));

import { ConflictRepository } from '../conflict-repository';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ConflictRepository', () => {
  const sampleConflictDraft: Omit<MemoryConflict, 'id' | 'createdAt' | 'updatedAt'> = {
    workspaceId: 'ws_test',
    organizationId: 'org_test',
    memoryIdA: 'mem_a',
    memoryIdB: 'mem_b',
    summary: 'Setup fee contradiction: $3,000 vs $1,500.',
    status: 'unresolved',
    conflictType: 'contradiction',
    confidenceScore: 0.94,
    detectedBy: 'ai',
    evidenceA: {
      memoryId: 'mem_a',
      title: 'Bursar reported $3,000 setup fee',
      quote: 'Setup fee is $3,000 upfront.',
      sourceType: 'user_note',
      sourceId: 'note_1',
      createdAt: '2026-08-01T10:00:00Z',
    },
    evidenceB: {
      memoryId: 'mem_b',
      title: 'Principal reported $1,500 setup fee agreement',
      quote: 'Agreed on discounted $1,500 fee.',
      sourceType: 'meeting',
      sourceId: 'meet_2',
      createdAt: '2026-08-15T14:00:00Z',
    },
    opposingAspects: ['pricing_amount', 'discount_approval'],
  };

  it('creates a new conflict record with generated ID and timestamps', async () => {
    mockDocRef.set.mockResolvedValueOnce(undefined);

    const result = await ConflictRepository.createConflict(sampleConflictDraft);

    expect(result).toBeDefined();
    expect(result.id).toMatch(/^cnf_/);
    expect(result.status).toBe('unresolved');
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
    expect(mockDocRef.set).toHaveBeenCalledTimes(1);
  });

  it('retrieves conflict by ID', async () => {
    mockDocRef.get.mockResolvedValueOnce({
      exists: true,
      id: 'conflict_123',
      data: () => ({ ...sampleConflictDraft, id: 'conflict_123' }),
    });

    const conflict = await ConflictRepository.getConflictById('conflict_123');
    expect(conflict).not.toBeNull();
    expect(conflict?.id).toBe('conflict_123');
    expect(conflict?.summary).toContain('Setup fee contradiction');
  });

  it('lists unresolved conflicts by workspace', async () => {
    mockCollectionRef.get.mockResolvedValueOnce({
      docs: [
        {
          id: 'conflict_123',
          data: () => ({ ...sampleConflictDraft, id: 'conflict_123' }),
        },
      ],
    });

    const conflicts = await ConflictRepository.listConflictsByWorkspace({
      workspaceId: 'ws_test',
      status: 'unresolved',
      limit: 10,
    });

    expect(conflicts).toHaveLength(1);
    expect(mockCollectionRef.where).toHaveBeenCalledWith('workspaceId', '==', 'ws_test');
    expect(mockCollectionRef.where).toHaveBeenCalledWith('status', '==', 'unresolved');
  });

  it('resolves a conflict with resolution choice, audit trail, and timestamp', async () => {
    mockDocRef.update.mockResolvedValueOnce(undefined);

    const success = await ConflictRepository.resolveConflict({
      conflictId: 'conflict_123',
      resolution: 'confirm_a',
      resolvedByUserId: 'usr_admin',
      resolutionNotes: 'Principal confirmed the bursar holds final pricing authority.',
    });

    expect(success).toBe(true);
    expect(mockDocRef.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'resolved',
        resolution: 'confirm_a',
        resolvedByUserId: 'usr_admin',
        resolutionNotes: 'Principal confirmed the bursar holds final pricing authority.',
      })
    );
  });
});
