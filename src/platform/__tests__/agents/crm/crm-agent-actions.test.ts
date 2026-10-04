/**
 * @fileoverview Test Suite: CRM Agent Server Actions (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 40 (Domain Event Publishing), Rule 51 (Next.js 15 Server Actions Conventions),
 * and Rule 60 (Emergency dead-man switch).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import * as assemblerModule from '@/platform/agents/crm/context/account-context-assembler';
import { defaultEventBus } from '@/platform/events/event-bus';
import {
  getAccountAiOverviewAction,
  getAccountKnowledgeAction,
  getAccountRecommendationsAction,
  getDealIntelligenceAction,
  getMeetingBriefAction,
} from '@/app/actions/crm-agent-actions';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';

describe('CRM Agent Server Actions (Phase 9 Milestone 3)', () => {
  const mockOrgId = 'org_test_01';
  const mockWsId = 'ws_test_01';
  const mockEntityId = 'ent_test_01';
  const mockDealId = 'deal_test_01';
  const mockMeetingId = 'meet_test_01';

  const mockContext: Account360Context = {
    organizationId: mockOrgId,
    workspaceId: mockWsId,
    entityId: mockEntityId,
    entity: {
      id: mockEntityId,
      name: 'Test Academy',
      type: 'client',
      status: 'active',
      industry: 'Education',
      createdAt: '2026-01-01T00:00:00Z',
    },
    workspaceEntity: {
      id: `${mockWsId}_${mockEntityId}`,
      entityId: mockEntityId,
      workspaceId: mockWsId,
      stageId: 'stage_eval',
      stageName: 'Evaluation',
      workspaceTags: ['strategic'],
      updatedAt: '2026-10-01T00:00:00Z',
    },
    contacts: [
      {
        id: 'con_01',
        name: 'Jane Doe',
        isPrimary: true,
        email: 'jane@test.edu',
        channelPreferences: [],
      },
    ],
    deals: [
      {
        id: mockDealId,
        title: 'Annual Enterprise Subscription',
        pipelineId: 'pipe_01',
        stageId: 'stage_eval',
        stageName: 'Evaluation',
        value: 30000,
        currency: 'USD',
        probability: 60,
        ageInDays: 12,
        isStalled: false,
      },
    ],
    meetings: [
      {
        id: mockMeetingId,
        title: 'Initial Discovery Call',
        startTime: '2026-09-20T10:00:00Z',
        attendees: ['Jane Doe'],
        summary: 'Client interested in automated onboarding pipelines.',
        sentiment: 'positive',
      },
    ],
    notes: [
      {
        id: 'note_01',
        content: 'Budget approved for upcoming fiscal year.',
        createdAt: '2026-09-21T00:00:00Z',
        category: 'finance',
      },
    ],
    tasks: [],
    finances: {
      openBalance: 0,
      overdueBalance: 0,
      currency: 'USD',
      invoiceCount: 1,
      agingCategory: 'CLEAR',
    },
    memories: [],
    timeline: [
      {
        id: 'tl_01',
        timestamp: '2026-09-21T00:00:00Z',
        category: 'COMMERCIAL',
        title: 'Note recorded',
        summary: 'Budget approved note.',
        sourceRef: {
          type: 'note',
          id: 'note_01',
        },
      },
    ],
    metadata: {
      assembledAt: new Date().toISOString(),
      durationMs: 30,
      estimatedTokens: 800,
      correlationId: 'corr_action_test',
      isKnapsackCompressed: false,
    },
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    // Default: Authenticated user with matching organization
    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
      user: {
        uid: 'usr_operator_01',
        email: 'operator@smartsapp.com',
        role: 'operator',
        organizationId: mockOrgId,
        activeWorkspaceId: mockWsId,
        permissions: ['operations.campuses.view', 'operations.pipeline.view'],
      },
      organizationId: mockOrgId,
      workspaceId: mockWsId,
      profile: {
        id: 'usr_operator_01',
        organizationId: mockOrgId,
        activeWorkspaceId: mockWsId,
      },
    } as unknown as authModule.AuthContext);

    // Default: Dead-man switch healthy
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue();

    // Default: Assembler returns mock context
    const mockAssembler = {
      assembleContext: vi.fn().mockResolvedValue(mockContext),
      isGovernancePaused: vi.fn().mockResolvedValue(false),
    } as unknown as assemblerModule.AccountContextAssembler;
    vi.spyOn(assemblerModule, 'getAccountContextAssembler').mockReturnValue(mockAssembler);
  });

  describe('Authentication & Security Gating', () => {
    it('rejects unauthenticated requests with AUTHENTICATION_REQUIRED (Rule 51)', async () => {
      vi.spyOn(authModule, 'requireAuth').mockRejectedValue(new Error('User must be authenticated'));

      const result = await getAccountAiOverviewAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects cross-tenant IDOR tampering with IDOR_VIOLATION (Rule 8 & 47)', async () => {
      // Authenticated with different org
      vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
        user: {
          uid: 'usr_attacker',
          organizationId: 'org_attacker',
        },
        organizationId: 'org_attacker',
        workspaceId: 'ws_attacker',
      } as unknown as authModule.AuthContext);

      const result = await getAccountAiOverviewAction({
        workspaceId: mockWsId, // targeting another workspace
        entityId: mockEntityId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('rejects execution when dead-man switch is active with CRM_DEAD_MAN_PAUSED (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(
        new Error('Emergency halt active')
      );

      const result = await getAccountAiOverviewAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CRM_DEAD_MAN_PAUSED');
    });
  });

  describe('Server Action Executions & Domain Events', () => {
    it('getAccountAiOverviewAction returns synthesized overview and emits event (Rule 40)', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish').mockResolvedValue();

      const result = await getAccountAiOverviewAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe(mockEntityId);
      expect(result.data?.healthScore).toBeGreaterThanOrEqual(0);
      expect(publishSpy).toHaveBeenCalled();
    });

    it('getAccountKnowledgeAction returns grounded facts and citations', async () => {
      const result = await getAccountKnowledgeAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.groundedFacts.length).toBeGreaterThan(0);
      expect(result.data?.citations.length).toBeGreaterThan(0);
    });

    it('getAccountRecommendationsAction returns Next-Best-Actions with explainability', async () => {
      const result = await getAccountRecommendationsAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.items.length).toBeGreaterThan(0);
      expect(result.data?.items[0].explainability.what).toBeTruthy();
    });

    it('getDealIntelligenceAction returns velocity and playbook for target deal', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish').mockResolvedValue();

      const result = await getDealIntelligenceAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
        dealId: mockDealId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.dealId).toBe(mockDealId);
      expect(result.data?.winProbability).toBe(60);
      expect(publishSpy).toHaveBeenCalled();
    });

    it('getDealIntelligenceAction returns DEAL_NOT_FOUND if deal does not exist in context', async () => {
      const result = await getDealIntelligenceAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
        dealId: 'deal_nonexistent',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('DEAL_NOT_FOUND');
    });

    it('getMeetingBriefAction returns attendee dossiers and commitments', async () => {
      const publishSpy = vi.spyOn(defaultEventBus, 'publish').mockResolvedValue();

      const result = await getMeetingBriefAction({
        workspaceId: mockWsId,
        entityId: mockEntityId,
        meetingId: mockMeetingId,
      });

      expect(result.success).toBe(true);
      expect(result.data?.meetingId).toBe(mockMeetingId);
      expect(result.data?.attendees.length).toBeGreaterThan(0);
      expect(publishSpy).toHaveBeenCalled();
    });
  });
});
