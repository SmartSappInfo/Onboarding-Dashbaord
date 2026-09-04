/**
 * @fileOverview Unit tests for MemoryConsolidationEngine
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryConsolidationEngine } from '../services/memory-consolidation-engine';
import { MemoryRepository } from '../memory-repository';
import { OrganizationMemoryService } from '../services/organization-memory-service';
import type { MemoryObject } from '../types';

vi.mock('../memory-repository', () => ({
  MemoryRepository: {
    getMemoryById: vi.fn(),
    listMemories: vi.fn(),
    invalidateMemory: vi.fn(),
  },
}));

vi.mock('../services/organization-memory-service', () => ({
  OrganizationMemoryService: {
    remember: vi.fn(),
  },
}));

function createMockMemory(
  id: string,
  title: string,
  content: string,
  topics: string[] = [],
  entityIds: string[] = ['ent-acme']
): MemoryObject {
  return {
    id,
    workspaceId: 'ws-test',
    organizationId: 'org-test',
    type: 'fact',
    title,
    content,
    topics,
    entities: entityIds.map(e => ({ entityName: e, entityType: 'institution', confidenceScore: 0.9 })),
    subjectRefs: { entityIds },
    source: { type: 'user_note', sourceId: 'note-1' },
    importance: 0.8,
    confidence: 0.85,
    verification: 'user_confirmed',
    visibility: { scope: 'workspace' },
    lifecycle: { status: 'active' },
    provenance: { createdBy: 'user' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('MemoryConsolidationEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findConsolidationCandidates', () => {
    it('groups memories sharing entities and topics into consolidation clusters', async () => {
      const mem1 = createMockMemory('m1', 'Acme payment terms', 'Acme pays net-30 days.', ['billing', 'acme'], ['ent-acme']);
      const mem2 = createMockMemory('m2', 'Acme invoice cycle', 'Invoices for Acme are sent on the 1st of each month.', ['billing', 'acme'], ['ent-acme']);
      const mem3 = createMockMemory('m3', 'Random note', 'Unrelated notes about internal office supplies.', ['supplies'], ['ent-supplies']);

      vi.mocked(MemoryRepository.listMemories).mockResolvedValue([mem1, mem2, mem3]);

      const candidates = await MemoryConsolidationEngine.findConsolidationCandidates('ws-test', 'org-test');
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].sourceMemoryIds).toContain('m1');
      expect(candidates[0].sourceMemoryIds).toContain('m2');
      expect(candidates[0].sourceMemoryIds).not.toContain('m3');
      expect(candidates[0].proposedTitle).toBeDefined();
    });
  });

  describe('applyConsolidation', () => {
    it('creates a synthesized memory and marks source memories as consolidated/archived', async () => {
      const mem1 = createMockMemory('m1', 'Acme part 1', 'Acme pays net-30 days.');
      const mem2 = createMockMemory('m2', 'Acme part 2', 'Invoices for Acme sent on 1st.');

      vi.mocked(MemoryRepository.getMemoryById).mockImplementation(async (id: string) => {
        if (id === 'm1') return mem1;
        if (id === 'm2') return mem2;
        return null;
      });

      const consolidatedSaved = createMockMemory(
        'm-consolidated-1',
        'Consolidated: Acme Billing',
        'Acme pays net-30 days. Invoices for Acme sent on 1st.'
      );

      vi.mocked(OrganizationMemoryService.remember).mockResolvedValue({
        memory: consolidatedSaved,
        conflicts: [],
      });

      const candidate = {
        id: 'cand-1',
        workspaceId: 'ws-test',
        organizationId: 'org-test',
        sourceMemoryIds: ['m1', 'm2'],
        proposedTitle: 'Consolidated: Acme Billing',
        proposedContent: 'Acme pays net-30 days. Invoices for Acme sent on 1st.',
        proposedType: 'fact' as const,
        confidenceScore: 0.9,
        reasoning: 'Synthesized billing facts',
        topics: ['billing'],
        entityIds: ['ent-acme'],
        createdAt: new Date().toISOString(),
      };

      const result = await MemoryConsolidationEngine.applyConsolidation(
        candidate,
        'user-editor-1'
      );

      expect(result.id).toBe('m-consolidated-1');
      expect(OrganizationMemoryService.remember).toHaveBeenCalled();
      expect(MemoryRepository.invalidateMemory).toHaveBeenCalledWith(
        'm1',
        expect.stringContaining('Consolidated into'),
        'user-editor-1'
      );
      expect(MemoryRepository.invalidateMemory).toHaveBeenCalledWith(
        'm2',
        expect.stringContaining('Consolidated into'),
        'user-editor-1'
      );
    });
  });
});
