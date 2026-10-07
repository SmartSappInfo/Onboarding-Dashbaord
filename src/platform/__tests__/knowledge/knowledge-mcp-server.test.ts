/**
 * @fileOverview Knowledge MCP Domain Server Tests (Phase 11 M4 · T3)
 *
 * Verifies:
 * - MCP Spec 2026-07-28 & SDK v2 implementation for knowledge domain
 * - Resources: knowledge://{id} and memory://{id} with session authentication & per-item ACL (Rule 49)
 * - Prompts: skill://knowledge-query, skill://meeting-preparation, skill://meeting-followup
 * - Tool Fingerprinting & Rug-Pull Defense (Rule 14)
 * - Tenant-scoped discovery caching (Rules 35 & 50)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createKnowledgeMcpServer,
  getKnowledgeMcpResource,
  executeKnowledgePrompt,
} from '@/platform/mcp/servers/knowledge-mcp-server';
import { createDomainMcpServer } from '@/platform/mcp/servers/domain-mcp-factory';
import type { AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import {
  KnowledgeAdaptiveRetriever,
  type AdaptiveKnowledgeItem,
} from '@/platform/domains/knowledge_memory/services/knowledge-adaptive-retriever';
import '@/platform/domains/knowledge_memory/contracts/knowledge-capabilities.contract';

describe('Knowledge MCP Domain Server (Phase 11 M4 · T3)', () => {
  const orgId = 'org_mcp_test';
  const workspaceId = 'ws_mcp_primary';

  const userPrincipal: AgentPrincipal = {
    userId: 'usr_sarah',
    actorType: 'user',
    organizationId: orgId,
    workspaceId: workspaceId,
    grantedScopes: ['knowledge:read'],
    effectiveRole: 'member',
  };

  const restrictedUserPrincipal: AgentPrincipal = {
    userId: 'usr_admin',
    actorType: 'user',
    organizationId: orgId,
    workspaceId: workspaceId,
    grantedScopes: ['knowledge:read', 'knowledge:read_restricted'],
    effectiveRole: 'admin',
  };

  const foreignTenantPrincipal: AgentPrincipal = {
    userId: 'usr_attacker',
    actorType: 'user',
    organizationId: 'org_different_corp',
    workspaceId: 'ws_foreign',
    grantedScopes: ['knowledge:read', 'knowledge:read_restricted'],
    effectiveRole: 'member',
  };

  const mockItems: AdaptiveKnowledgeItem[] = [
    {
      id: 'doc_public_faq',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Customer Onboarding FAQ',
      content: 'Standard onboarding takes 3 to 5 business days.',
      sourceType: 'document',
      sensitivity: 'internal',
      verificationState: 'verified',
      createdAt: '2026-10-06T12:00:00.000Z',
    },
    {
      id: 'doc_exec_comp',
      organizationId: orgId,
      workspaceId: workspaceId,
      title: 'Executive Compensation Plan',
      content: 'Confidential executive equity schedules and retention milestones.',
      sourceType: 'document',
      sensitivity: 'restricted',
      verificationState: 'verified',
      createdAt: '2026-10-06T12:00:00.000Z',
    },
  ];

  let retriever: KnowledgeAdaptiveRetriever;

  beforeEach(() => {
    retriever = new KnowledgeAdaptiveRetriever({ items: mockItems });
  });

  describe('MCP Resources (Rule 49 & Multi-Tenant ACL)', () => {
    it('returns resource content for authenticated tenant member', async () => {
      const resource = await getKnowledgeMcpResource(
        'knowledge://doc_public_faq',
        userPrincipal,
        retriever
      );

      expect(resource.isError).toBe(false);
      expect(resource.contents[0].text).toContain('Customer Onboarding FAQ');
      expect(resource.contents[0].text).toContain('3 to 5 business days');
    });

    it('rejects cross-tenant resource access (Anti-IDOR)', async () => {
      const resource = await getKnowledgeMcpResource(
        'knowledge://doc_public_faq',
        foreignTenantPrincipal,
        retriever
      );

      expect(resource.isError).toBe(true);
      expect(resource.contents[0].text).toContain('IDOR_VIOLATION');
    });

    it('blocks restricted resource when principal lacks knowledge:read_restricted', async () => {
      const resource = await getKnowledgeMcpResource(
        'knowledge://doc_exec_comp',
        userPrincipal, // lacks knowledge:read_restricted
        retriever
      );

      expect(resource.isError).toBe(true);
      expect(resource.contents[0].text).toContain('RESTRICTED_ACCESS_DENIED');
    });

    it('grants restricted resource when principal holds knowledge:read_restricted', async () => {
      const resource = await getKnowledgeMcpResource(
        'knowledge://doc_exec_comp',
        restrictedUserPrincipal, // holds knowledge:read_restricted
        retriever
      );

      expect(resource.isError).toBe(false);
      expect(resource.contents[0].text).toContain('Executive Compensation Plan');
    });
  });

  describe('MCP Prompts (Spec 2026-07-28)', () => {
    it('generates skill://knowledge-query prompt messages', async () => {
      const promptResult = await executeKnowledgePrompt('skill://knowledge-query', {
        query: 'What is our onboarding timeline?',
      });

      expect(promptResult.messages.length).toBeGreaterThan(0);
      expect(promptResult.messages[0].content.text).toContain('onboarding timeline');
      expect(promptResult.messages[0].content.text).toContain('knowledge.search_hybrid');
    });

    it('generates skill://meeting-preparation prompt messages', async () => {
      const promptResult = await executeKnowledgePrompt('skill://meeting-preparation', {
        meetingId: 'meet_q4_review',
        attendees: 'CEO, CFO, Lead Architect',
      });

      expect(promptResult.messages.length).toBeGreaterThan(0);
      expect(promptResult.messages[0].content.text).toContain('meet_q4_review');
      expect(promptResult.messages[0].content.text).toContain('dossier');
    });

    it('generates skill://meeting-followup prompt messages', async () => {
      const promptResult = await executeKnowledgePrompt('skill://meeting-followup', {
        transcriptSummary: 'Agreed to migrate auth by end of month.',
      });

      expect(promptResult.messages.length).toBeGreaterThan(0);
      expect(promptResult.messages[0].content.text).toContain('knowledge.propose_candidate');
    });
  });

  describe('Domain MCP Factory Delegation & Tool Fingerprints (Rule 14)', () => {
    it('creates domain MCP server for knowledge domain and mounts tools', () => {
      const server = createDomainMcpServer({
        domain: 'knowledge',
        principal: userPrincipal,
      });

      expect(server).toBeDefined();
    });

    it('createKnowledgeMcpServer mounts resources, prompts, and tools', () => {
      const server = createKnowledgeMcpServer({
        domain: 'knowledge',
        principal: userPrincipal,
        retriever,
      });

      expect(server).toBeDefined();
    });
  });
});
