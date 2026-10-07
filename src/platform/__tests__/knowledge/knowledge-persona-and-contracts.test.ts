/**
 * @fileOverview Test Suite: Knowledge Agent Persona & Foundation Contracts (Phase 11 M4 · T0)
 *
 * Implements Rules 4, 10, 16, 23, 47, 48.
 * Verifies:
 * 1. AGENT_PERSONA_IDS contains exactly 17 personas including 'knowledge_agent'.
 * 2. knowledge_agent persona definition adheres to L0_READ risk ceiling and budgets.
 * 3. Zod v4 schemas for adaptive retrieval, hybrid search, citations, and answer contract.
 * 4. Structured error taxonomy and KnowledgeAgentError.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_PERSONA_IDS,
  isAgentPersonaId,
} from '@/platform/identity/agent-persona-types';
import { globalAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import {
  KnowledgeSearchHybridInputSchema,
  KnowledgeAnswerContractSchema,
  ExplainContextInclusionInputSchema,
  ExplainContextInclusionOutputSchema,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';
import {
  KNOWLEDGE_AGENT_ERROR_CODES,
  KnowledgeAgentError,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-errors';

describe('Knowledge Agent Persona & Foundation Contracts (Phase 11 M4 · T0)', () => {
  describe('Persona Registration (Rule 16 & Rule 23)', () => {
    it('contains canonical personas including knowledge_agent', () => {
      expect(AGENT_PERSONA_IDS.length).toBeGreaterThanOrEqual(17);
      expect(AGENT_PERSONA_IDS).toContain('knowledge_agent');
      expect(isAgentPersonaId('knowledge_agent')).toBe(true);
    });

    it('registers knowledge_agent in globalAgentPersonaRegistry with correct permissions & budgets', () => {
      const persona = globalAgentPersonaRegistry.getPersona('knowledge_agent');
      expect(persona).not.toBeNull();
      expect(persona?.id).toBe('knowledge_agent');
      expect(persona?.maxAutonomousRiskLevel).toBe('L0_READ');
      expect(persona?.allowedDomains).toEqual([
        'knowledge_memory',
        'crm_contacts',
        'deals_revenue',
        'meetings_conversations',
      ]);
      expect(persona?.allowedPermissions).toContain('knowledge:read');
      expect(persona?.allowedPermissions).not.toContain('knowledge:read_restricted'); // Rule 17 non-delegable
      expect(persona?.budgets.maxDurationMs).toBe(20000); // 20s
      expect(persona?.budgets.maxTokens).toBe(30000); // 30k
      expect(persona?.budgets.maxToolCalls).toBe(8);
      expect(persona?.budgets.maxRecordsMutated).toBe(0);
      expect(persona?.budgets.maxOutboundMessages).toBe(0);
    });
  });

  describe('Adaptive Retrieval & Answer Contracts (Rule 4, 10, 47)', () => {
    it('validates KnowledgeSearchHybridInputSchema defaults and constraints', () => {
      const parsed = KnowledgeSearchHybridInputSchema.parse({
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
        query: 'What are the tuition payment terms?',
      });

      expect(parsed.limit).toBe(10);
      expect(parsed.includeGraphNeighbors).toBe(true);
      expect(parsed.applyRecencyDecay).toBe(true);
      expect(parsed.halfLifeDays).toBe(30);
    });

    it('validates KnowledgeAnswerContractSchema with complete citation spans', () => {
      const validAnswer = {
        query: 'What are the tuition payment terms for GIS?',
        answer: 'Tuition payment terms for Ghana International School are Net-30.',
        coverage: 'complete' as const,
        claims: [
          {
            claimText: 'Tuition payment terms are Net-30.',
            citationIds: ['cite_1'],
            confidence: 0.98,
          },
        ],
        citations: [
          {
            citationId: 'cite_1',
            sourceId: 'mem_123',
            sourceType: 'memory' as const,
            textSpan: 'Payment terms agreed: Net-30.',
            relevanceScore: 0.95,
          },
        ],
        conflictsDetected: [],
        contextSummary: {
          totalFound: 5,
          includedCount: 2,
          omittedCount: 3,
          tokenCount: 450,
        },
        citationPrecision: 1.0,
      };

      const parsed = KnowledgeAnswerContractSchema.parse(validAnswer);
      expect(parsed.coverage).toBe('complete');
      expect(parsed.citationPrecision).toBe(1.0);
      expect(parsed.claims).toHaveLength(1);
      expect(parsed.citations).toHaveLength(1);
    });

    it('validates ExplainContextInclusion schemas', () => {
      const input = {
        organizationId: 'org_1',
        workspaceId: 'ws_1',
        query: 'Tuition policy',
        itemId: 'mem_99',
      };
      const parsedInput = ExplainContextInclusionInputSchema.parse(input);
      expect(parsedInput.itemId).toBe('mem_99');

      const output = {
        itemId: 'mem_99',
        included: true,
        reason: 'High dense cosine similarity and verified graph connection.',
        metrics: {
          denseRank: 1,
          sparseRank: 2,
          graphHops: 1,
          rrfScore: 0.032,
          recencyWeight: 0.95,
          verificationWeight: 1.25,
        },
      };
      const parsedOutput = ExplainContextInclusionOutputSchema.parse(output);
      expect(parsedOutput.included).toBe(true);
      expect(parsedOutput.metrics.verificationWeight).toBe(1.25);
    });
  });

  describe('Structured Error Taxonomy (Rule 48)', () => {
    it('instantiates KnowledgeAgentError with valid error code and details', () => {
      const err = new KnowledgeAgentError(
        KNOWLEDGE_AGENT_ERROR_CODES.RESTRICTED_ACCESS_DENIED,
        'Access to restricted knowledge requires elevated scope',
        { sensitivity: 'restricted', requiredScope: 'knowledge:read_restricted' }
      );

      expect(err.name).toBe('KnowledgeAgentError');
      expect(err.code).toBe('RESTRICTED_ACCESS_DENIED');
      expect(err.message).toContain('Access to restricted knowledge');
      expect(err.details?.sensitivity).toBe('restricted');
    });
  });
});
