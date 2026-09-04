import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemoryObject } from '../types';

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      })),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    })),
  },
}));

import { ConflictEngine } from '../services/conflict-engine';
import { ConflictRepository } from '../conflict-repository';

beforeEach(() => {
  vi.clearAllMocks();
  ConflictEngine.clearPairCache();
});

describe('ConflictEngine', () => {
  const memoryA: MemoryObject = {
    id: 'mem_a',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    type: 'decision',
    title: 'Approved annual contract at $50,000',
    content: 'The committee unanimously approved the enterprise tier at $50,000 per year with annual payment upfront.',
    summary: 'Approved at $50,000',
    source: { type: 'user_note', sourceId: 'note_1' },
    importance: 0.9,
    confidence: 0.95,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'agent', userId: 'usr_1' },
    evidence: 'Committee unanimously approved the enterprise tier at $50,000 per year.',
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
  };

  const memoryB: MemoryObject = {
    id: 'mem_b',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    type: 'decision',
    title: 'Budget capped strictly at $30,000',
    content: 'The finance board rejected the $50,000 proposal and capped all spending strictly at $30,000.',
    summary: 'Budget capped at $30,000',
    source: { type: 'meeting', sourceId: 'meet_2' },
    importance: 0.9,
    confidence: 0.9,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'agent', userId: 'usr_2' },
    evidence: 'Finance board rejected the $50,000 proposal and capped spending strictly at $30,000.',
    createdAt: '2026-08-10T15:00:00Z',
    updatedAt: '2026-08-10T15:00:00Z',
  };

  const memoryHarmonious: MemoryObject = {
    id: 'mem_c',
    organizationId: 'org_test',
    workspaceId: 'ws_test',
    type: 'preference',
    title: 'Prefers communication via WhatsApp',
    content: 'Client requested all notifications and reports sent directly to their WhatsApp number.',
    summary: 'Prefers WhatsApp',
    source: { type: 'user_note', sourceId: 'note_3' },
    importance: 0.7,
    confidence: 0.9,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'agent', userId: 'usr_1' },
    evidence: 'Client requested notifications sent to WhatsApp.',
    createdAt: '2026-08-05T09:00:00Z',
    updatedAt: '2026-08-05T09:00:00Z',
  };

  it('evaluates memory pair and detects contradiction between pricing claims', async () => {
    const evaluation = await ConflictEngine.evaluateMemoryPair(memoryA, memoryB);

    expect(evaluation).toBeDefined();
    expect(evaluation.isContradiction).toBe(true);
    expect(evaluation.confidenceScore).toBeGreaterThanOrEqual(0.7);
    expect(evaluation.summary).toBeDefined();
  });

  it('returns isContradiction = false for harmonious memories without conflicts', async () => {
    const evaluation = await ConflictEngine.evaluateMemoryPair(memoryA, memoryHarmonious);

    expect(evaluation).toBeDefined();
    expect(evaluation.isContradiction).toBe(false);
  });

  it('skips evaluation and uses in-memory SHA-256 cache on duplicate pairs', async () => {
    const firstEval = await ConflictEngine.evaluateMemoryPair(memoryA, memoryB);
    const secondEval = await ConflictEngine.evaluateMemoryPair(memoryA, memoryB);

    expect(secondEval).toEqual(firstEval);
    expect(ConflictEngine.getCacheSize()).toBe(1);
  });

  it('scans candidate pairs and persists detected conflict to repository', async () => {
    const createSpy = vi.spyOn(ConflictRepository, 'createConflict').mockResolvedValueOnce({
      id: 'cnf_test_1',
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      memoryIdA: 'mem_a',
      memoryIdB: 'mem_b',
      summary: 'Pricing dispute',
      status: 'unresolved',
      conflictType: 'contradiction',
      confidenceScore: 0.9,
      detectedBy: 'ai',
      evidenceA: {
        memoryId: 'mem_a',
        title: memoryA.title,
        quote: memoryA.content,
        sourceType: memoryA.source.type,
        sourceId: memoryA.source.sourceId,
        createdAt: memoryA.createdAt,
      },
      evidenceB: {
        memoryId: 'mem_b',
        title: memoryB.title,
        quote: memoryB.content,
        sourceType: memoryB.source.type,
        sourceId: memoryB.source.sourceId,
        createdAt: memoryB.createdAt,
      },
      opposingAspects: ['budget'],
      createdAt: '2026-08-10T16:00:00Z',
      updatedAt: '2026-08-10T16:00:00Z',
    });

    vi.spyOn(ConflictRepository, 'findConflictByPair').mockResolvedValueOnce(null);

    const conflicts = await ConflictEngine.detectAndRecordConflicts({
      workspaceId: 'ws_test',
      organizationId: 'org_test',
      memories: [memoryA, memoryB],
    });

    expect(conflicts).toHaveLength(1);
    expect(createSpy).toHaveBeenCalledTimes(1);
  });
});
