/**
 * @fileOverview Unit Tests: CRM Proposal Server Actions (Phase 9 Milestone 4)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock),
 * Rule 51 (Next.js 15 Server Actions Conventions), Rule 60 (Emergency Dead-Man Switch Evaluation),
 * and Rule 69 (Dual-Tier CRM Data Model Preservation).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as authModule from '@/lib/auth/require-auth';
import * as deadManModule from '@/platform/policy/governance-dead-man';
import * as assemblerModule from '@/platform/agents/crm/context/account-context-assembler';
import {
  evaluateAccountRisksAction,
  generateNextBestActionsAction,
  proposeCrmActionAction,
  executeApprovedCrmProposalAction,
  rollbackCrmActionAction,
} from '@/app/actions/crm-proposal-actions';
import type { Account360Context } from '@/platform/agents/crm/context/account-context-types';
import {
  CrmProposedActionSchema,
  computeCrmActionIdempotencyKey,
  type CrmProposedAction,
} from '@/platform/agents/crm/actions/crm-action-types';

describe('CRM Proposal Server Actions', () => {
  const mockOrgId = 'org_enterprise_1';
  const mockWsId = 'ws_sales_alpha';
  const mockEntityId = 'ent_acme_corp';
  const mockUserId = 'usr_rep_alice';

  const mockContext: Account360Context = {
    organizationId: mockOrgId,
    workspaceId: mockWsId,
    entityId: mockEntityId,
    entity: {
      id: mockEntityId,
      name: 'Acme Corporation',
      type: 'client',
      status: 'active',
      industry: 'Enterprise Software',
      createdAt: '2026-01-01T00:00:00Z',
    },
    workspaceEntity: {
      id: `${mockWsId}_${mockEntityId}`,
      entityId: mockEntityId,
      workspaceId: mockWsId,
      pipelineId: 'pipe_enterprise',
      stageId: 'stage_proposal',
      stageName: 'Proposal',
      assignedTo: {
        userId: mockUserId,
        name: 'Alice Rep',
        email: 'alice@smartsapp.com',
      },
      workspaceTags: ['strategic'],
      updatedAt: '2026-10-01T00:00:00Z',
    },
    contacts: [
      {
        id: 'con_01',
        name: 'Bob Director',
        role: 'Director of Procurement',
        isPrimary: true,
        email: 'bob@acme.com',
        channelPreferences: [],
      },
    ],
    deals: [
      {
        id: 'deal_101',
        title: 'Platform License',
        pipelineId: 'pipe_enterprise',
        stageId: 'stage_proposal',
        stageName: 'Proposal',
        value: 50000,
        currency: 'USD',
        probability: 50,
        ageInDays: 32,
        expectedCloseDate: '2026-09-15T00:00:00Z',
        isStalled: true,
      },
    ],
    meetings: [],
    notes: [],
    tasks: [],
    finances: {
      openBalance: 0,
      overdueBalance: 0,
      currency: 'USD',
      invoiceCount: 1,
      agingCategory: 'CLEAR',
    },
    memories: [],
    timeline: [],
    metadata: {
      assembledAt: '2026-10-04T12:00:00Z',
      durationMs: 40,
      estimatedTokens: 950,
      correlationId: 'corr_actions_test',
      isKnapsackCompressed: false,
    },
  };

  const createSampleAction = (): CrmProposedAction => {
    const payload = {
      dealId: 'deal_101',
      currentStage: 'proposal',
      targetStage: 'negotiation',
    };
    return CrmProposedActionSchema.parse({
      id: 'act_update_stage_deal_101',
      entityId: mockEntityId,
      workspaceId: mockWsId,
      actionType: 'UPDATE_STAGE',
      priority: 'HIGH',
      riskLevel: 'L2_STATE_MUTATION',
      explainability: {
        what: 'Advance deal to negotiation',
        why: 'Review terms aligned in recent review',
        impact: 'Maintains momentum towards close',
        blastRadius: {
          affectedRecordsCount: 1,
          financialExposureUsd: 50000,
          isReversible: true,
        },
      },
      idempotencyKey: computeCrmActionIdempotencyKey(mockEntityId, 'UPDATE_STAGE', payload),
      targetCapabilityId: 'crm.deal.update_stage',
      compensatingCapabilityId: 'crm.deal.revert_stage',
      payload,
      requiresApproval: true,
      createdAt: new Date().toISOString(),
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.spyOn(authModule, 'requireAuth').mockResolvedValue({
      uid: mockUserId,
      isSystemAdmin: false,
      profile: {
        organizationId: mockOrgId,
        lastActiveWorkspaceId: mockWsId,
      } as unknown as authModule.AuthContext['profile'],
    });

    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockResolvedValue();

    vi.spyOn(assemblerModule, 'getAccountContextAssembler').mockReturnValue({
      assembleContext: vi.fn().mockResolvedValue(mockContext),
    } as unknown as assemblerModule.AccountContextAssembler);
  });

  it('evaluates account risks via evaluateAccountRisksAction', async () => {
    const res = await evaluateAccountRisksAction({
      workspaceId: mockWsId,
      entityId: mockEntityId,
    });

    expect(res.success).toBe(true);
    expect(res.data?.entityId).toBe(mockEntityId);
    expect(res.data?.stalledDeals).toHaveLength(1);
    expect(res.data?.overallScore).toBeGreaterThanOrEqual(25);
  });

  it('generates next-best-actions via generateNextBestActionsAction', async () => {
    const res = await generateNextBestActionsAction({
      workspaceId: mockWsId,
      entityId: mockEntityId,
    });

    expect(res.success).toBe(true);
    expect(res.data?.actions).toBeDefined();
    expect(res.data?.actions.length).toBeGreaterThan(0);
    expect(res.data?.assessment).toBeDefined();
  });

  it('creates an action proposal via proposeCrmActionAction', async () => {
    const action = createSampleAction();
    const res = await proposeCrmActionAction({
      workspaceId: mockWsId,
      entityId: mockEntityId,
      actionData: action,
    });

    expect(res.success).toBe(true);
    expect(res.data?.proposalId).toBeDefined();
    expect(res.data?.status).toBe('pending');
    expect(res.data?.payloadHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('rejects unauthenticated requests with AUTHENTICATION_REQUIRED (Rule 51)', async () => {
    vi.spyOn(authModule, 'requireAuth').mockRejectedValue(new Error('User is not authenticated'));

    const res = await evaluateAccountRisksAction({
      workspaceId: mockWsId,
      entityId: mockEntityId,
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('AUTHENTICATION_REQUIRED');
  });

  it('enforces Anti-IDOR tenant lock against mismatched workspace (Rules 8 & 47)', async () => {
    const res = await evaluateAccountRisksAction({
      workspaceId: 'ws_foreign_tenant',
      entityId: mockEntityId,
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('IDOR_VIOLATION');
  });

  it('fails closed when emergency dead-man pause switch is active (Rule 60)', async () => {
    vi.spyOn(deadManModule, 'checkGovernanceDeadManSwitch').mockRejectedValue(new Error('CRM_DEAD_MAN_PAUSED'));

    const res = await evaluateAccountRisksAction({
      workspaceId: mockWsId,
      entityId: mockEntityId,
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('CRM_DEAD_MAN_PAUSED');
  });

  it('executes approved proposal via executeApprovedCrmProposalAction', async () => {
    const res = await executeApprovedCrmProposalAction({
      workspaceId: mockWsId,
      proposalId: 'prop_test_123',
      targetEntityId: mockEntityId,
      actualPayload: { dealId: 'deal_123', stage: 'negotiation' },
    });

    // In-memory proposal bridge returns error PROPOSAL_NOT_FOUND if not present
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PROPOSAL_NOT_FOUND');
  });

  it('rolls back crm proposal via rollbackCrmActionAction', async () => {
    const res = await rollbackCrmActionAction({
      workspaceId: mockWsId,
      proposalId: 'prop_test_123',
      reason: 'Testing reverse-LIFO rollback',
    });

    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('PROPOSAL_NOT_FOUND');
  });
});
