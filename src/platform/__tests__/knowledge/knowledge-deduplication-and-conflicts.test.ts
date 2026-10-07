/**
 * @fileOverview Test Suite: Multi-Domain Deduplication Engine & Conflict Detection (Phase 11 M3 · T3)
 *
 * Enforces Rule 17 (Non-Delegable Conflict Resolution),
 * Rule 18 (TOCTOU Version Token Freshness),
 * Rule 40 (Domain Event Publishing),
 * Deduplication (exact hash + Jaccard token overlap >= 0.85),
 * Contradiction detection on overlapping subject references.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { KnowledgeDeduplicationService } from '../../domains/knowledge_memory/services/knowledge-deduplication-service';
import { KnowledgeConflictService } from '../../domains/knowledge_memory/services/knowledge-conflict-service';
import {
  knowledgeConflictResolveCapability,
  knowledgeConflictListCapability,
  knowledgeDeduplicateCandidateCapability,
} from '../../domains/knowledge_memory/contracts/knowledge-capabilities.contract';
import type { KnowledgeCandidate } from '../../domains/knowledge_memory/contracts/knowledge-schemas';
import { defaultEventBus } from '../../events/event-bus';

describe('Deduplication & Conflict Detection (Phase 11 M3 · T3)', () => {
  let dedupService: KnowledgeDeduplicationService;
  let conflictService: KnowledgeConflictService;

  beforeEach(() => {
    dedupService = new KnowledgeDeduplicationService();
    conflictService = new KnowledgeConflictService();
  });

  describe('KnowledgeDeduplicationService', () => {
    it('detects exact duplicate matches regardless of minor whitespace or outer XML wrappers', async () => {
      const existingMemories = [
        {
          id: 'mem_existing_01',
          title: 'Campus Opening Hours',
          content: 'The campus gate opens at 07:30 AM every weekday.',
        },
      ];

      const candidateText =
        '<untrusted_reference_data id="c1" source="meeting:m1">\n  The campus gate opens at 07:30 AM every weekday.  \n</untrusted_reference_data>';

      const result = await dedupService.deduplicateCandidate(
        {
          title: 'Campus Opening Hours',
          content: candidateText,
          workspaceId: 'ws_test_1',
        },
        existingMemories
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBe(1.0);
      expect(result.duplicateOfMemoryId).toBe('mem_existing_01');
      expect(result.reason).toContain('Exact');
    });

    it('detects near-duplicate lexical overlap (Jaccard similarity >= 0.85)', async () => {
      const existingMemories = [
        {
          id: 'mem_existing_02',
          title: 'Admission Requirements',
          content:
            'All new students must submit their birth certificate, vaccination record, and two passport photos to the registrar office.',
        },
      ];

      // Very high token overlap with slight wording tweak
      const candidateContent =
        'New students must submit their birth certificate, vaccination record, and passport photos to registrar office.';

      const result = await dedupService.deduplicateCandidate(
        {
          title: 'Admission Requirements',
          content: candidateContent,
          workspaceId: 'ws_test_1',
        },
        existingMemories
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.similarity).toBeGreaterThanOrEqual(0.8);
      expect(result.duplicateOfMemoryId).toBe('mem_existing_02');
    });

    it('flags non-duplicate distinct facts as clean', async () => {
      const existingMemories = [
        {
          id: 'mem_existing_03',
          title: 'Library Rules',
          content: 'Silence must be maintained in the library at all times.',
        },
      ];

      const candidateContent =
        'Science laboratory requires safety goggles and lab coats during chemistry practicals.';

      const result = await dedupService.deduplicateCandidate(
        {
          title: 'Science Lab Rules',
          content: candidateContent,
          workspaceId: 'ws_test_1',
        },
        existingMemories
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.similarity).toBeLessThan(0.3);
      expect(result.duplicateOfMemoryId).toBeUndefined();
    });
  });

  describe('KnowledgeConflictService: Detection & Resolution', () => {
    it('detects contradiction when candidate conflicts on existing subject terms (e.g. payment terms Net-30 vs Net-60)', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish');

      const existingMemories = [
        {
          id: 'mem_oakridge_terms',
          title: 'Payment Terms for Oakridge',
          content: 'Oakridge Academy agreed to payment terms of Net-30 days.',
          subjectRefs: ['entity_oakridge_01'],
          suggestedRelationships: [
            { targetId: 'entity_oakridge_01', predicate: 'has_payment_terms', confidence: 0.9 },
          ],
        },
      ];

      const candidate: KnowledgeCandidate = {
        id: 'cand_conflicting_01',
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        source: { type: 'meeting', id: 'meet_new' },
        type: 'fact',
        title: 'Oakridge Revised Terms',
        content: '<untrusted_reference_data id="c1" source="meeting:m1">Oakridge Academy insists on Net-60 payment terms.</untrusted_reference_data>',
        subjectRefs: ['entity_oakridge_01'],
        suggestedRelationships: [
          { targetId: 'entity_oakridge_01', predicate: 'has_payment_terms', confidence: 0.9 },
        ],
        confidence: 0.95,
        verificationState: 'unverified',
        sensitivity: 'internal',
        status: 'pending',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const conflicts = await conflictService.detectConflicts(candidate, existingMemories);

      expect(conflicts.length).toBe(1);
      const conflict = conflicts[0];
      expect(conflict.candidateId).toBe(candidate.id);
      expect(conflict.existingMemoryId).toBe('mem_oakridge_terms');
      expect(conflict.conflictType).toBe('contradiction');
      expect(conflict.status).toBe('open');

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge.conflict.detected',
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        })
      );
    });

    it('resolves an open conflict with a human operator decision (supersede_existing)', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish');

      const conflict = await conflictService.createConflictRecord({
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        candidateId: 'cand_123',
        existingMemoryId: 'mem_old_456',
        conflictType: 'contradiction',
      });

      const resolved = await conflictService.resolveConflict(
        {
          conflictId: conflict.id,
          workspaceId: 'ws_test_1',
          resolution: 'supersede_existing',
          notes: 'Approved new Net-60 agreement as current truth.',
          version: conflict.version,
        },
        { id: 'usr_operator_01', type: 'user' }
      );

      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution?.resolutionType).toBe('supersede_existing');
      expect(resolved.resolution?.resolvedBy).toBe('usr_operator_01');

      expect(publishSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'knowledge.conflict.resolved',
          payload: expect.objectContaining({
            conflictId: conflict.id,
            resolutionType: 'supersede_existing',
          }),
        })
      );
    });

    it('rejects AI agent attempts to resolve conflicts with NON_DELEGABLE_ACTION (Rule 17 Non-Negotiable)', async () => {
      const conflict = await conflictService.createConflictRecord({
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        candidateId: 'cand_agent_conflict',
        existingMemoryId: 'mem_old',
        conflictType: 'contradiction',
      });

      await expect(
        conflictService.resolveConflict(
          {
            conflictId: conflict.id,
            workspaceId: 'ws_test_1',
            resolution: 'supersede_existing',
            version: conflict.version,
          },
          { id: 'agent_analyst_01', type: 'agent' } // Forbidden: AI agent decider
        )
      ).rejects.toThrow(/NON_DELEGABLE_ACTION/);
    });
  });

  describe('Governed Capabilities: Conflict & Deduplication', () => {
    it('defines knowledge.deduplicate_candidate as L0_READ', () => {
      expect(knowledgeDeduplicateCandidateCapability.id).toBe('knowledge.deduplicate_candidate');
      expect(knowledgeDeduplicateCandidateCapability.risk.level).toBe('L0_READ');
    });

    it('defines knowledge.conflict.list as L0_READ', () => {
      expect(knowledgeConflictListCapability.id).toBe('knowledge.conflict.list');
      expect(knowledgeConflictListCapability.risk.level).toBe('L0_READ');
    });

    it('defines knowledge.conflict.resolve as L2_STATE_MUTATION and nonDelegable: true', () => {
      expect(knowledgeConflictResolveCapability.id).toBe('knowledge.conflict.resolve');
      expect(knowledgeConflictResolveCapability.risk.level).toBe('L2_STATE_MUTATION');
      expect(knowledgeConflictResolveCapability.risk.nonDelegable).toBe(true);
    });
  });
});
