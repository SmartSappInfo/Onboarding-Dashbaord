/**
 * @fileOverview Unit & Integration Tests: CRM Signature Server Actions (Phase 9 Milestone 5)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 10 (Inline Architectural Documentation), Rule 29 (Memory & TTL Governance),
 * Rule 51 (Next.js 15 Server Actions Conventions), Rule 60 (Emergency Dead-Man Switch Evaluation),
 * and Rule 69 (Dual-Tier CRM Data Model Preservation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  executeCrmSignatureInquiryAction,
  sendCrmFollowupMessageAction,
  getCrmSignatureSessionAction,
  getCrmSignatureMetricsAction,
} from '@/app/actions/crm-signature-actions';
import * as requireAuthModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';

import { CrmSignatureOrchestrator } from '@/platform/agents/crm/signature/crm-signature-orchestrator';
import { CrmMultiTurnSessionManager } from '@/platform/agents/crm/signature/crm-multi-turn-session';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';

describe('CRM Signature Server Actions (Phase 9 Milestone 5)', () => {
  const organizationId = 'org_test_123';
  const workspaceId = 'ws_test_456';
  const userId = 'user_rep_789';
  const entityId = 'ent_greenfield_school';

  const mockContext: Account360Context = {
    entityId,
    workspaceId,
    organizationId,
    entity: {
      id: entityId,
      name: 'Greenfield School',
      type: 'client',
      status: 'active',
      industry: 'Education',
      email: 'admissions@greenfield.edu',
      phone: '+1-555-0199',
      city: 'Boston',
      address: '100 Academic Way',
      createdAt: '2025-01-01T00:00:00Z',
    },
    workspaceEntity: {
      id: `${workspaceId}_${entityId}`,
      workspaceId,
      entityId,
      pipelineId: 'k12_sales',
      stageId: 'proposal_sent',
      stageName: 'Proposal Sent',
      assignedTo: {
        userId: 'rep_sarah',
        name: 'Sarah',
        email: 'sarah@test.com',
      },
      workspaceTags: ['high_priority', 'tier_1'],
      leadStatus: 'QUALIFIED',
      updatedAt: '2026-10-01T00:00:00Z',
    },
    contacts: [
      {
        id: 'con_1',
        name: 'Dr. Jane Doe',
        email: 'jdoe@greenfield.edu',
        phone: '+1-555-0199',
        isPrimary: true,
        role: 'Head of Operations',
        channelPreferences: ['EMAIL'],
      },
    ],
    deals: [
      {
        id: 'deal_greenfield_exp',
        title: 'Campus Enterprise Expansion',
        pipelineId: 'k12_sales',
        stageId: 'negotiation',
        stageName: 'Negotiation',
        value: 45000,
        currency: 'USD',
        probability: 60,
        ageInDays: 35,
        expectedCloseDate: '2026-09-15',
        isStalled: true,
      },
    ],
    meetings: [
      {
        id: 'meet_sync_1',
        title: 'Quarterly Executive Alignment',
        startTime: '2026-09-05T14:00:00Z',
        attendees: ['Dr. Jane Doe', 'Sarah Jenkins'],
        sentiment: 'neutral',
        summary: 'Discussed budget constraints and delay in signing annual contract.',
        transcriptSnippet: 'We need to review our board approvals before proceeding with the expansion deal.',
      },
    ],
    notes: [
      {
        id: 'note_1',
        authorName: 'Sarah Jenkins',
        content: 'Customer mentioned they are evaluating competitor pricing.',
        createdAt: '2026-09-10T11:00:00Z',
        category: 'general',
      },
    ],
    tasks: [
      {
        id: 'task_pricing_review',
        title: 'Send Revised Tiered Pricing Schedule',
        dueDate: '2026-09-20T00:00:00Z',
        isOverdue: true,
        status: 'pending',
        priority: 'high',
        assignedToName: 'Sarah Jenkins',
      },
    ],
    finances: {
      openBalance: 120000,
      overdueBalance: 5000,
      currency: 'USD',
      invoiceCount: 1,
      agingCategory: 'OVERDUE_30',
    },
    memories: [
      {
        id: 'mem_1',
        content: 'Greenfield School prefers multi-year billing schedules.',
        sourceType: 'note',
        confidence: 0.9,
        citationId: 'note_1',
      },
    ],
    timeline: [
      {
        id: 'ev_1',
        category: 'COMMERCIAL',
        title: 'Deal Moved to Negotiation',
        summary: 'Campus Enterprise Expansion updated to negotiation stage.',
        timestamp: '2026-09-01T10:00:00Z',
        sourceRef: { type: 'deal', id: 'deal_greenfield_exp' },
      },
    ],
    metadata: {
      assembledAt: new Date().toISOString(),
      durationMs: 45,
      estimatedTokens: 850,
      correlationId: 'corr_test_01',
      isKnapsackCompressed: false,
    },
  };

  const mockAuthContext: requireAuthModule.AuthContext = {
    uid: userId,
    profile: {
      id: 'prof_1',
      organizationId,
      lastActiveWorkspaceId: workspaceId,
      role: 'staff',
      createdAt: '2025-01-01',
      updatedAt: '2025-01-01',
    } as unknown as requireAuthModule.AuthContext['profile'],
    isSystemAdmin: false,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(requireAuthModule, 'requireAuth').mockResolvedValue(mockAuthContext);
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue();

    // Provide hermetic orchestrator and session manager with mock context
    globalThis.__smartsappCrmSignatureOrchestrator = new CrmSignatureOrchestrator({ mockContext });
    globalThis.__smartsappCrmSignatureSessionManager = new CrmMultiTurnSessionManager({ mockContext });
  });

  describe('executeCrmSignatureInquiryAction', () => {
    it('executes signature inquiry successfully for authorized user', async () => {
      const res = await executeCrmSignatureInquiryAction({
        query: "What's going on with Greenfield School?",
        entityId,
        workspaceId,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.entityId).toBe(entityId);
      expect(res.data?.healthScore).toBeDefined();
      expect(res.data?.executiveNarrative).toBeDefined();
    });

    it('rejects unauthenticated requests (Rule 51)', async () => {
      vi.spyOn(requireAuthModule, 'requireAuth').mockRejectedValue(
        new Error('Unauthorized request')
      );

      const res = await executeCrmSignatureInquiryAction({
        entityId,
        workspaceId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('AUTHENTICATION_REQUIRED');
    });

    it('rejects cross-tenant IDOR tampering (Rules 8 & 47)', async () => {
      const res = await executeCrmSignatureInquiryAction({
        entityId,
        workspaceId: 'ws_other_tenant_999', // Mismatched workspace
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });

    it('halts execution when emergency dead-man switch is active (Rule 60)', async () => {
      vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(
        new deadManModule.AgentGovernanceEmergencyPausedError()
      );

      const res = await executeCrmSignatureInquiryAction({
        entityId,
        workspaceId,
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('CRM_DEAD_MAN_PAUSED');
    });
  });

  describe('sendCrmFollowupMessageAction', () => {
    it('sends follow-up question and receives grounded response', async () => {
      // First initiate an inquiry to have an active session
      const initRes = await executeCrmSignatureInquiryAction({
        entityId,
        workspaceId,
      });
      const sessionId = initRes.data?.sessionId;
      expect(sessionId).toBeDefined();

      const followRes = await sendCrmFollowupMessageAction({
        sessionId: sessionId!,
        workspaceId,
        message: 'What was discussed in the last meeting?',
      });

      expect(followRes.success).toBe(true);
      expect(followRes.data?.answer).toBeDefined();
      expect(followRes.data?.turnIndex).toBeGreaterThanOrEqual(2);
    });

    it('rejects cross-tenant session tampering (Rule 8)', async () => {
      const res = await sendCrmFollowupMessageAction({
        sessionId: 'sess_other_123',
        workspaceId: 'ws_unauthorized',
        message: 'Show me data',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('getCrmSignatureSessionAction', () => {
    it('retrieves an active session with full message turns', async () => {
      const initRes = await executeCrmSignatureInquiryAction({
        entityId,
        workspaceId,
      });
      const sessionId = initRes.data?.sessionId!;

      const res = await getCrmSignatureSessionAction({
        sessionId,
        workspaceId,
      });

      expect(res.success).toBe(true);
      expect(res.data?.sessionId).toBe(sessionId);
      expect(res.data?.messages.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getCrmSignatureMetricsAction', () => {
    it('returns aggregated inquiry metrics for workspace', async () => {
      const res = await getCrmSignatureMetricsAction({
        workspaceId,
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.averageHealthScore).toBeGreaterThanOrEqual(0);
      expect(res.data?.activeSessionsCount).toBeGreaterThanOrEqual(0);
    });
  });
});
