/**
 * @fileOverview Test Suite: Knowledge Domain Contracts & Error Taxonomy (Phase 11 M3 · T0)
 *
 * Enforces Zod v4 schemas, strict typing (Rule 4: Zero any/any[]),
 * Rule 55 graph ceilings (<= 80 nodes, depth <= 2 or 3),
 * structured error codes and domain error class.
 */

import { describe, it, expect } from 'vitest';
import {
  KnowledgeCandidateSchema,
  ProposeCandidateInputSchema,
  ReviewQueueDecideInputSchema,
  KnowledgeConflictSchema,
  ResolveConflictInputSchema,
  GraphNeighborQuerySchema,
  GraphFindPathQuerySchema,
  type KnowledgeCandidate,
  type ProposeCandidateInput,
  type ReviewQueueDecideInput,
  type KnowledgeConflict,
  type ResolveConflictInput,
  type GraphNeighborQuery,
  type GraphFindPathQuery,
} from '../../domains/knowledge/contracts/knowledge-schemas';
import {
  KNOWLEDGE_ERROR_CODES,
  KnowledgeDomainError,
} from '../../domains/knowledge/contracts/knowledge-errors';

describe('Knowledge Domain Contracts (Phase 11 M3 · T0)', () => {
  describe('KnowledgeCandidateSchema', () => {
    it('validates a complete, compliant knowledge candidate', () => {
      const validCandidate: KnowledgeCandidate = {
        id: 'cand_12345',
        organizationId: 'org_test_01',
        workspaceId: 'ws_test_01',
        source: {
          type: 'meeting',
          id: 'meet_abc123',
          span: {
            start: 120,
            end: 180,
            text: 'We agreed that payment terms are Net-30.',
          },
        },
        type: 'fact',
        title: 'Payment Terms Agreed',
        content: 'Payment terms for Oakridge Academy confirmed as Net-30.',
        subjectRefs: ['deal_999', 'entity_888'],
        suggestedRelationships: [
          {
            targetId: 'entity_888',
            predicate: 'has_payment_terms',
            confidence: 0.95,
          },
        ],
        confidence: 0.92,
        verificationState: 'unverified',
        sensitivity: 'internal',
        status: 'pending',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const parsed = KnowledgeCandidateSchema.parse(validCandidate);
      expect(parsed.id).toBe('cand_12345');
      expect(parsed.status).toBe('pending');
      expect(parsed.suggestedRelationships).toHaveLength(1);
    });

    it('rejects invalid candidate missing required fields', () => {
      const invalid = {
        id: 'cand_bad',
        // missing organizationId, workspaceId
        title: 'Bad item',
      };
      expect(() => KnowledgeCandidateSchema.parse(invalid)).toThrow();
    });
  });

  describe('ProposeCandidateInputSchema', () => {
    it('applies defaults for optional fields', () => {
      const input = {
        organizationId: 'org_01',
        workspaceId: 'ws_01',
        source: {
          type: 'note',
          id: 'note_123',
        },
        type: 'entity',
        title: 'New Stakeholder',
        content: 'Dr. Mensah was appointed Head of Curriculum.',
      };

      const parsed = ProposeCandidateInputSchema.parse(input);
      expect(parsed.subjectRefs).toEqual([]);
      expect(parsed.suggestedRelationships).toEqual([]);
      expect(parsed.sensitivity).toBe('internal');
      expect(parsed.confidence).toBe(0.8);
    });
  });

  describe('ReviewQueueDecideInputSchema', () => {
    it('accepts valid decisions: accept, accept_with_edit, reject', () => {
      const acceptInput: ReviewQueueDecideInput = {
        candidateId: 'cand_12345',
        workspaceId: 'ws_01',
        decision: 'accept',
        version: 1,
      };
      expect(() => ReviewQueueDecideInputSchema.parse(acceptInput)).not.toThrow();

      const editInput: ReviewQueueDecideInput = {
        candidateId: 'cand_12345',
        workspaceId: 'ws_01',
        decision: 'accept_with_edit',
        editedContent: 'Corrected payment terms are Net-45.',
        editedTitle: 'Payment Terms Updated',
        reason: 'Client updated terms in follow-up email',
        version: 1,
      };
      expect(() => ReviewQueueDecideInputSchema.parse(editInput)).not.toThrow();

      const rejectInput: ReviewQueueDecideInput = {
        candidateId: 'cand_12345',
        workspaceId: 'ws_01',
        decision: 'reject',
        reason: 'Outdated or inaccurate',
        version: 1,
      };
      expect(() => ReviewQueueDecideInputSchema.parse(rejectInput)).not.toThrow();
    });

    it('rejects an invalid decision token', () => {
      const badInput = {
        candidateId: 'cand_12345',
        workspaceId: 'ws_01',
        decision: 'ignore', // invalid
        version: 1,
      };
      expect(() => ReviewQueueDecideInputSchema.parse(badInput)).toThrow();
    });
  });

  describe('KnowledgeConflictSchema & ResolveConflictInputSchema', () => {
    it('validates a conflict object and resolution input', () => {
      const conflict: KnowledgeConflict = {
        id: 'conf_123',
        organizationId: 'org_01',
        workspaceId: 'ws_01',
        candidateId: 'cand_new',
        existingMemoryId: 'mem_old',
        conflictType: 'contradiction',
        status: 'open',
        detectedAt: new Date().toISOString(),
        version: 1,
      };
      expect(KnowledgeConflictSchema.parse(conflict).status).toBe('open');

      const resolveInput: ResolveConflictInput = {
        conflictId: 'conf_123',
        workspaceId: 'ws_01',
        resolution: 'supersede_existing',
        notes: 'Superseding old terms per latest meeting transcript',
        version: 1,
      };
      expect(ResolveConflictInputSchema.parse(resolveInput).resolution).toBe('supersede_existing');
    });
  });

  describe('Graph Query Ceilings (Rule 55)', () => {
    it('clamps maxNodes to <= 80 and maxDepth to <= 2 on neighbor queries', () => {
      const validQuery: GraphNeighborQuery = {
        workspaceId: 'ws_01',
        nodeId: 'node_deal_123',
        maxNodes: 50,
        maxDepth: 2,
      };
      expect(() => GraphNeighborQuerySchema.parse(validQuery)).not.toThrow();

      const overLimitQuery = {
        workspaceId: 'ws_01',
        nodeId: 'node_deal_123',
        maxNodes: 100, // exceeds ceiling of 80
        maxDepth: 1,
      };
      expect(() => GraphNeighborQuerySchema.parse(overLimitQuery)).toThrow();

      const overDepthQuery = {
        workspaceId: 'ws_01',
        nodeId: 'node_deal_123',
        maxNodes: 50,
        maxDepth: 3, // exceeds ceiling of 2 for neighbors
      };
      expect(() => GraphNeighborQuerySchema.parse(overDepthQuery)).toThrow();
    });

    it('enforces findPath query ceilings (maxDepth <= 3, maxNodes <= 80)', () => {
      const validPathQuery: GraphFindPathQuery = {
        workspaceId: 'ws_01',
        sourceNodeId: 'node_A',
        targetNodeId: 'node_B',
        maxDepth: 3,
        maxNodes: 80,
      };
      expect(() => GraphFindPathQuerySchema.parse(validPathQuery)).not.toThrow();

      const excessivePathQuery = {
        workspaceId: 'ws_01',
        sourceNodeId: 'node_A',
        targetNodeId: 'node_B',
        maxDepth: 5, // exceeds 3
      };
      expect(() => GraphFindPathQuerySchema.parse(excessivePathQuery)).toThrow();
    });
  });

  describe('KNOWLEDGE_ERROR_CODES & KnowledgeDomainError', () => {
    it('contains all required error codes with proper taxonomy', () => {
      expect(KNOWLEDGE_ERROR_CODES.AUTHENTICATION_REQUIRED).toBe('AUTHENTICATION_REQUIRED');
      expect(KNOWLEDGE_ERROR_CODES.NON_DELEGABLE_ACTION).toBe('NON_DELEGABLE_ACTION');
      expect(KNOWLEDGE_ERROR_CODES.CANDIDATE_ALREADY_DECIDED).toBe('CANDIDATE_ALREADY_DECIDED');
      expect(KNOWLEDGE_ERROR_CODES.GRAPH_QUERY_EXCEEDED_LIMIT).toBe('GRAPH_QUERY_EXCEEDED_LIMIT');
      expect(KNOWLEDGE_ERROR_CODES.VERSION_MISMATCH).toBe('VERSION_MISMATCH');
    });

    it('instantiates KnowledgeDomainError with code and details', () => {
      const err = new KnowledgeDomainError(
        'NON_DELEGABLE_ACTION',
        'Review queue decisions are strictly non-delegable to AI agents (Rule 17).',
        { actorType: 'agent', candidateId: 'cand_123' }
      );
      expect(err.name).toBe('KnowledgeDomainError');
      expect(err.code).toBe('NON_DELEGABLE_ACTION');
      expect(err.details?.actorType).toBe('agent');
      expect(err.message).toContain('Rule 17');
    });
  });
});
