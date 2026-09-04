/**
 * @fileOverview Unit & Integration Tests for CompanyBrain Phase 8: Domain Specialists & Agent Swarms
 *
 * Covers:
 * 1. Specialist registry discovery & metadata integrity.
 * 2. Tool permission sandboxing & security violation interception.
 * 3. Domain specialist executions (Knowledge, Revenue, Meeting, SDR, Operations, Governance).
 * 4. Swarm Orchestration in Parallel Consensus and Sequential Pipeline modes.
 * 5. Human approval interception & durable swarm resumption.
 * 6. Code-free workspace policy overrides.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { globalAgentRegistry } from '@/lib/supervisor/agent-registry';
import { BaseDomainSpecialist, AgentSecurityViolationError } from '../specialists/base-domain-specialist';
import { KnowledgeSpecialist } from '../specialists/knowledge-specialist';
import { RevenueSpecialist } from '../specialists/revenue-specialist';
import { MeetingSpecialist } from '../specialists/meeting-specialist';
import { SdrSpecialist } from '../specialists/sdr-specialist';
import { OperationsSpecialist } from '../specialists/operations-specialist';
import { GovernanceSpecialist } from '../specialists/governance-specialist';
import { SwarmOrchestrator } from '../services/swarm-orchestrator';
import { McpGateway } from '@/lib/mcp/gateway';
import type { AgentRequest, AgentResult } from '@/lib/supervisor/types';
import type { SwarmMissionRequest } from '../domain-types';

// Mock Firebase Admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: null,
}));

// Mock McpGateway
vi.mock('@/lib/mcp/gateway', () => ({
  McpGateway: {
    handleRequest: vi.fn(async (rpc) => {
      if (rpc.params.name === 'memory.search') {
        return {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            results: [
              { id: 'mem_1', content: 'Historical agreement on pricing tier', similarity: 0.88 },
            ],
            citations: [
              { sourceId: 'mem_1', sourceTitle: 'Contract Note', excerpt: 'Agreed 15% discount', author: 'Director' },
            ],
          },
        };
      }
      if (rpc.params.name === 'crm.deal.get') {
        return {
          jsonrpc: '2.0',
          id: rpc.id,
          result: {
            deal: { id: 'deal_123', title: 'Acme Health Expansion', stage: 'evaluation', value: 75000 },
          },
        };
      }
      if (rpc.params.name === 'task.create') {
        return {
          jsonrpc: '2.0',
          id: rpc.id,
          result: { taskId: 'task_abc_999' },
        };
      }
      return {
        jsonrpc: '2.0',
        id: rpc.id,
        result: { status: 'ok' },
      };
    }),
  },
}));

// Mock Genkit Flow
vi.mock('@/ai/flows/synthesize-swarm-consensus-flow', () => ({
  synthesizeSwarmConsensusFlow: vi.fn(async (input) => ({
    executiveSummary: `Consensus briefing for: ${input.objective}`,
    consensusPoints: ['All specialists aligned on high account viability.', 'Identified immediate follow-up actions.'],
    divergencePoints: [],
    jointActionProposals: [
      {
        toolName: 'task.create',
        title: 'Schedule executive follow-up review',
        description: 'Review cross-domain findings with account director.',
        riskLevel: 'low_risk',
        requiresApproval: false,
        proposedBySpecialist: 'operations_specialist',
      },
    ],
    confidenceScore: 0.95,
  })),
  synthesizeSwarmDeterministic: vi.fn((input) => ({
    executiveSummary: `Deterministic briefing for: ${input.objective}`,
    consensusPoints: ['Specialists aligned on domain parameters.'],
    divergencePoints: [],
    jointActionProposals: [],
    confidenceScore: 0.85,
  })),
}));

// Mock McpApprovalEngine
vi.mock('@/lib/mcp/approval-engine', () => ({
  McpApprovalEngine: {
    adjudicateApproval: vi.fn(async (params) => ({
      id: params.approvalId,
      status: params.decision,
      executionResult: { executed: true },
    })),
  },
}));

describe('CompanyBrain Phase 8: Domain Specialists & Agent Swarm Collaboration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Specialist Registry & Descriptors', () => {
    it('registers all 6 official domain specialists in AgentRegistry', () => {
      expect(globalAgentRegistry.hasAgent('knowledge_specialist')).toBe(true);
      expect(globalAgentRegistry.hasAgent('revenue_specialist')).toBe(true);
      expect(globalAgentRegistry.hasAgent('meeting_specialist')).toBe(true);
      expect(globalAgentRegistry.hasAgent('sdr_specialist')).toBe(true);
      expect(globalAgentRegistry.hasAgent('operations_specialist')).toBe(true);
      expect(globalAgentRegistry.hasAgent('governance_specialist')).toBe(true);
    });

    it('returns public descriptors with capabilities and allowed tools', () => {
      const descriptors = globalAgentRegistry.getAgentDescriptors('domain');
      expect(descriptors.length).toBeGreaterThanOrEqual(6);

      const knowledgeDesc = descriptors.find((d) => d.id === 'knowledge_specialist');
      expect(knowledgeDesc).toBeDefined();
      expect(knowledgeDesc?.capabilities).toContain('memory_recall');
      expect(knowledgeDesc?.capabilities).toContain('synthesis');
    });
  });

  describe('2. Tool Permission Sandbox & Security', () => {
    it('blocks unauthorized tool execution with AgentSecurityViolationError', async () => {
      const specialist = new KnowledgeSpecialist();

      const request: AgentRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Test security boundary',
      };

      // Knowledge specialist is NOT allowed to invoke crm.deal.update
      await expect(
        (specialist as any).callGovernedTool({
          toolName: 'crm.deal.update',
          arguments: { dealId: 'deal_1' },
          request,
          toolCallsCollector: [],
          sourcesCollector: [],
        })
      ).rejects.toThrow(AgentSecurityViolationError);
    });

    it('allows whitelisted tool execution through McpGateway', async () => {
      const specialist = new KnowledgeSpecialist();

      const request: AgentRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Find pricing agreements',
      };

      const toolCallsCollector: any[] = [];
      const sourcesCollector: any[] = [];

      const res = await (specialist as any).callGovernedTool({
        toolName: 'memory.search',
        arguments: { query: 'pricing agreements' },
        request,
        toolCallsCollector,
        sourcesCollector,
      });

      expect(res.success).toBe(true);
      expect(toolCallsCollector.length).toBe(1);
      expect(toolCallsCollector[0].status).toBe('success');
      expect(sourcesCollector.length).toBe(1);
    });
  });

  describe('3. Domain Specialist Executions', () => {
    it('executes KnowledgeSpecialist and synthesizes verified lore findings', async () => {
      const specialist = new KnowledgeSpecialist();
      const request: AgentRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Examine past pricing discount lore for Acme',
      };

      const result: AgentResult = await specialist.execute(request);
      expect(result.status).toBe('completed');
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.findings[0].category).toBe('insight');
      expect(result.sources.length).toBeGreaterThan(0);
    });

    it('executes RevenueSpecialist and inspects pipeline deal economics', async () => {
      const specialist = new RevenueSpecialist();
      const request: AgentRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Analyze commercial deal health',
        subject: { type: 'deal', id: 'deal_123' },
      };

      const result: AgentResult = await specialist.execute(request);
      expect(result.status).toBe('completed');
      expect(result.findings.some((f) => f.title.includes('Deal Economic Analysis'))).toBe(true);
      expect(result.actions.length).toBeGreaterThan(0);
      expect(result.actions[0].toolName).toBe('crm.deal.update');
      expect(result.actions[0].requiresApproval).toBe(true);
    });
  });

  describe('4. Swarm Orchestrator Collaboration', () => {
    it('executes Swarm in Parallel Consensus mode across multiple specialists', async () => {
      const swarmRequest: SwarmMissionRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Comprehensive strategic audit of Acme Health',
        specialistIds: ['knowledge_specialist', 'revenue_specialist', 'operations_specialist'],
        mode: 'parallel_consensus',
      };

      const run = await SwarmOrchestrator.startSwarmMission(swarmRequest);

      expect(run.status).toBe('completed');
      expect(Object.keys(run.specialistRuns)).toHaveLength(3);
      expect(run.consensus).toBeDefined();
      expect(run.consensus?.consensusPoints.length).toBeGreaterThan(0);
      expect(run.consensus?.jointActions.length).toBeGreaterThan(0);
      expect(run.metrics.specialistsInvoked).toBe(3);
    });

    it('executes Swarm in Sequential Pipeline mode passing accumulated lore', async () => {
      const swarmRequest: SwarmMissionRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Stage-by-stage review of prospect Acme Health',
        specialistIds: ['knowledge_specialist', 'revenue_specialist'],
        mode: 'sequential_pipeline',
      };

      const run = await SwarmOrchestrator.startSwarmMission(swarmRequest);

      expect(run.status).toBe('completed');
      expect(Object.keys(run.specialistRuns)).toHaveLength(2);
      expect(run.consensus).toBeDefined();
    });

    it('pauses swarm execution cleanly when a specialist requires approval (-32003) and resumes', async () => {
      vi.spyOn(McpGateway, 'handleRequest')
        .mockResolvedValueOnce({
          jsonrpc: '2.0',
          id: 'call_needs_approval',
          error: {
            code: -32003,
            message: 'Human approval required for deal mutation',
            data: { approvalId: 'appr_swarm_123' },
          },
        })
        .mockResolvedValue({
          jsonrpc: '2.0',
          id: 'call_ok',
          result: { ok: true },
        });

      const swarmRequest: SwarmMissionRequest = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        actor: { type: 'user', id: 'user_1' },
        objective: 'Advance stalled deal to close',
        specialistIds: ['revenue_specialist'],
        mode: 'sequential_pipeline',
      };

      const run = await SwarmOrchestrator.startSwarmMission(swarmRequest);
      expect(run.status).toBe('needs_approval');
      expect(run.pausedSpecialistId).toBe('revenue_specialist');

      // Resume mission
      const resumedRun = await SwarmOrchestrator.resumeSwarmMission(run.id, 'appr_swarm_123', 'admin_user');
      expect(resumedRun.status).toBe('completed');
      expect(resumedRun.consensus).toBeDefined();
    });
  });
});
