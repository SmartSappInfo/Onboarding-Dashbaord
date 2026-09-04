/**
 * @fileOverview Unit tests for OrganizationMemoryService and MemoryRouter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from '../services/memory-router';
import { OrganizationMemoryService } from '../services/organization-memory-service';
import { MemoryRepository } from '../memory-repository';
import { ConflictRepository } from '../conflict-repository';
import { QdrantIndexer } from '../qdrant/qdrant-indexer';
import { GraphProjectionService } from '../pipeline/graph-projection-service';
import type { MemoryObject } from '../types';

// Mock dependencies
vi.mock('../memory-repository', () => ({
  MemoryRepository: {
    createMemory: vi.fn(),
    getMemoryById: vi.fn(),
    listMemories: vi.fn(),
    invalidateMemory: vi.fn(),
  },
}));

vi.mock('../conflict-repository', () => ({
  ConflictRepository: {
    createConflict: vi.fn(),
    listConflictsByWorkspace: vi.fn(),
    resolveConflict: vi.fn(),
  },
}));

vi.mock('../qdrant/qdrant-indexer', () => ({
  QdrantIndexer: {
    indexMemory: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../pipeline/graph-projection-service', () => ({
  GraphProjectionService: {
    projectMemory: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../qdrant/qdrant-client', () => ({
  QdrantClient: {
    deletePointsByFilter: vi.fn().mockResolvedValue(true),
  },
}));

function createMockMemory(id: string, title: string, content: string): MemoryObject {
  return {
    id,
    workspaceId: 'ws-123',
    organizationId: 'org-123',
    type: 'fact',
    title,
    content,
    topics: ['policy'],
    entities: [],
    subjectRefs: {},
    source: { type: 'user_note', sourceId: 'note-1' },
    importance: 0.8,
    confidence: 0.9,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'user' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('MemoryRouter', () => {
  it('classifies relationship questions as relational intent', () => {
    const decision = MemoryRouter.routeQuery('Who is connected to John Doe at Acme Corp?');
    expect(decision.intent).toBe('relational');
    expect(decision.requiresGraphExpansion).toBe(true);
  });

  it('classifies exact quotes as exact intent', () => {
    const decision = MemoryRouter.routeQuery('"Contract clause 4.2" signed on 2026-01-15');
    expect(decision.intent).toBe('exact');
  });

  it('classifies broad questions as semantic intent', () => {
    const decision = MemoryRouter.routeQuery('What is our policy on remote work and travel reimbursement?');
    expect(decision.intent).toBe('semantic');
  });

  it('classifies combined entity + conceptual questions as hybrid intent', () => {
    const decision = MemoryRouter.routeQuery('How does Acme Corp feel about our product roadmap?');
    expect(decision.intent).toBe('hybrid');
  });
});

describe('OrganizationMemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('orchestrates remember across Firestore, Qdrant, and Knowledge Graph', async () => {
    const mockCreated = createMockMemory('mem-new-1', 'Pricing update', 'Pricing is $20/seat.');
    vi.mocked(MemoryRepository.createMemory).mockResolvedValue(mockCreated);
    vi.mocked(MemoryRepository.listMemories).mockResolvedValue([]);

    const result = await OrganizationMemoryService.remember({
      workspaceId: 'ws-123',
      organizationId: 'org-123',
      type: 'fact',
      title: 'Pricing update',
      content: 'Pricing is $20/seat.',
      source: { type: 'user_note', sourceId: 'note-1' },
      skipConflictCheck: true,
    });

    expect(result.memory.id).toBe('mem-new-1');
    expect(MemoryRepository.createMemory).toHaveBeenCalled();
    expect(QdrantIndexer.indexMemory).toHaveBeenCalledWith(mockCreated);
    expect(GraphProjectionService.projectMemory).toHaveBeenCalledWith(mockCreated);
  });

  it('orchestrates forget across Firestore, Qdrant vector store, and open conflicts', async () => {
    const mockOld = createMockMemory('mem-old-1', 'Obsolete Rule', 'Obsolete rule text');
    vi.mocked(MemoryRepository.invalidateMemory).mockResolvedValue({
      ...mockOld,
      lifecycle: { status: 'archived', invalidationReason: 'Deprecated' },
    });
    vi.mocked(ConflictRepository.listConflictsByWorkspace).mockResolvedValue([]);

    const success = await OrganizationMemoryService.forget(
      'mem-old-1',
      'ws-123',
      'org-123',
      'Deprecated',
      'user-1'
    );

    expect(success).toBe(true);
    expect(MemoryRepository.invalidateMemory).toHaveBeenCalledWith('mem-old-1', 'Deprecated', 'user-1');
  });
});
