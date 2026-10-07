/**
 * @fileOverview Knowledge Agent Server Actions & Command Bar ⌘K Integration Tests (Phase 11 M4 · T4)
 *
 * Verifies:
 * - askKnowledgeAgentAction authentication, Anti-IDOR, and dead-man pause evaluation
 * - searchKnowledgeHybridAction execution
 * - getKnowledgeEvidenceAction and explainContextInclusionAction execution
 * - Global Command Bar executeCommandAction routing SEARCH and ANALYZE intents to Knowledge Agent
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  askKnowledgeAgentAction,
  searchKnowledgeHybridAction,
  getKnowledgeEvidenceAction,
  explainContextInclusionAction,
} from '@/app/actions/knowledge-agent-actions';
import { executeCommandAction } from '@/app/actions/command-actions';
import * as authModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import { getKnowledgeAdaptiveRetriever } from '@/platform/domains/knowledge_memory/services/knowledge-adaptive-retriever';

describe('Knowledge Agent Server Actions & ⌘K Integration (Phase 11 M4 · T4)', () => {
  const orgId = 'org_test_actions';
  const workspaceId = 'ws_primary';
  const userId = 'usr_test_agent';

  const mockAuthUser = {
    uid: userId,
    email: 'agent@test.com',
    profile: {
      id: userId,
      organizationId: orgId,
      name: 'Agent Operator',
      email: 'agent@test.com',
      role: 'admin',
    },
    isSystemAdmin: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue(mockAuthUser as unknown as authModule.AuthSession);
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue(undefined);

    const retriever = getKnowledgeAdaptiveRetriever();
    retriever.upsertItem({
      id: 'doc_sla_response',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Customer Response SLA',
      content: 'All urgent queries receive human or agent response in under 15 minutes.',
      sourceType: 'document',
      sensitivity: 'internal',
      verificationState: 'verified',
      createdAt: '2026-10-06T12:00:00.000Z',
      tags: ['sla', 'support'],
    });
  });

  describe('askKnowledgeAgentAction', () => {
    it('executes grounded knowledge query successfully for authenticated tenant', async () => {
      const res = await askKnowledgeAgentAction({
        organizationId: orgId,
        workspaceId: workspaceId,
        query: 'What is the response SLA?',
      });

      expect(res.success).toBe(true);
      expect(res.data?.answer).toBeDefined();
      expect(res.data?.coverage).toBe('complete');
      expect(res.data?.citations.length).toBeGreaterThan(0);
    });

    it('rejects cross-tenant execution with IDOR_VIOLATION', async () => {
      const res = await askKnowledgeAgentAction({
        organizationId: 'org_foreign_attacker',
        workspaceId: workspaceId,
        query: 'What is the response SLA?',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });

    it('fails closed when governance dead-man switch is engaged (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValueOnce(
        new Error('AGENT_GOVERNANCE_EMERGENCY_PAUSED')
      );

      const res = await askKnowledgeAgentAction({
        organizationId: orgId,
        workspaceId: workspaceId,
        query: 'What is the response SLA?',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('KNOWLEDGE_DEAD_MAN_PAUSED');
    });
  });

  describe('searchKnowledgeHybridAction & Helpers', () => {
    it('executes hybrid search action', async () => {
      const res = await searchKnowledgeHybridAction({
        organizationId: orgId,
        workspaceId: workspaceId,
        query: 'response SLA',
        limit: 5,
      });

      expect(res.success).toBe(true);
      expect(res.data?.hits.length).toBeGreaterThan(0);
    });

    it('retrieves evidence action', async () => {
      const res = await getKnowledgeEvidenceAction({
        organizationId: orgId,
        workspaceId: workspaceId,
        memoryIds: ['doc_sla_response'],
      });

      expect(res.success).toBe(true);
      expect(res.data?.items.length).toBe(1);
    });

    it('explains context inclusion action', async () => {
      const res = await explainContextInclusionAction({
        organizationId: orgId,
        workspaceId: workspaceId,
        query: 'response SLA',
        itemId: 'doc_sla_response',
      });

      expect(res.success).toBe(true);
      expect(res.data?.itemId).toBe('doc_sla_response');
      expect(res.data?.metrics.rrfScore).toBeDefined();
    });
  });

  describe('Global Command Bar ⌘K Routing (executeCommandAction)', () => {
    it('routes SEARCH intent to Knowledge Agent and returns grounded citations', async () => {
      const res = await executeCommandAction({
        intent: 'SEARCH',
        prompt: 'What is the response SLA?',
        organizationId: orgId,
        workspaceId: workspaceId,
        idempotencyKey: 'idem_test_search',
        parameters: {},
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('completed');
      expect(res.data?.summary).toContain('SLA');
    });

    it('routes ANALYZE intent to Knowledge Agent and returns synthesized analysis', async () => {
      const res = await executeCommandAction({
        intent: 'ANALYZE',
        prompt: 'Analyze our response SLA guarantees',
        organizationId: orgId,
        workspaceId: workspaceId,
        idempotencyKey: 'idem_test_analyze',
        parameters: {},
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('completed');
      expect(res.data?.data).toBeDefined();
    });
  });
});
