/**
 * @fileOverview Unit & Integration Tests for SDR Outbound Server Actions (Phase 10 Milestone 4 Task 4)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  draftProspectOutreachAction,
  stageSequenceApprovalAction,
  dispatchApprovedOutreachAction,
  getOutreachMetricsAction,
} from '@/app/actions/sdr-outbound-actions';

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    uid: 'user_kwame',
    profile: { organizationId: 'org_test' },
    isSystemAdmin: false,
  })),
}));

// Mock governance dead man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async (orgId?: string) => {
    if (orgId === 'org_paused') {
      throw new Error('Platform emergency dead-man pause engaged');
    }
  }),
}));

describe('SDR Outbound Server Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates personalized outreach draft for a valid prospect', async () => {
    const res = await draftProspectOutreachAction({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      prospectId: 'prosp_test_1',
      channel: 'whatsapp',
      sdrPersonaId: 'lead_sdr',
    });

    expect(res.success).toBe(true);
    expect(res.data?.draft.channel).toBe('whatsapp');
    expect(res.data?.explainability.what).toBeDefined();
  });

  it('rejects cross-tenant access with IDOR_VIOLATION (Rule 8 & 47)', async () => {
    const res = await draftProspectOutreachAction({
      organizationId: 'org_attacker',
      workspaceId: 'ws_test',
      prospectId: 'prosp_test_1',
      channel: 'email',
      sdrPersonaId: 'lead_sdr',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('IDOR_VIOLATION');
  });

  it('halts execution when emergency dead-man switch is engaged (Rule 60)', async () => {
    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementationOnce(async () => ({
      uid: 'user_kwame',
      profile: { organizationId: 'org_paused' },
      isSystemAdmin: false,
    }));

    const res = await draftProspectOutreachAction({
      organizationId: 'org_paused',
      workspaceId: 'ws_test',
      prospectId: 'prosp_test_1',
      channel: 'email',
      sdrPersonaId: 'lead_sdr',
    });

    expect(res.success).toBe(false);
    expect(res.code).toBe('SALES_DEAD_MAN_PAUSED');
  });

  it('stages sequence and creates two-phase ActionProposal with canonical payloadHash (Rules 21 & 22)', async () => {
    const prepRes = await stageSequenceApprovalAction({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      leadIds: ['prosp_test_1'],
      sequenceConfig: {
        id: 'seq_fast',
        name: 'Fast Track Cadence',
        steps: [
          { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
        ],
        dailySendingLimit: 30,
      },
      sdrPersonaId: 'lead_sdr',
    });

    expect(prepRes.success).toBe(true);
    expect(prepRes.data?.actionProposalId).toBeDefined();
    expect(prepRes.data?.payloadHash).toHaveLength(64);
    expect(prepRes.data?.status).toBe('staged');
  });

  it('rejects dispatch if proposal is not approved (Rule 21)', async () => {
    // Stage sequence first
    const prepRes = await stageSequenceApprovalAction({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      leadIds: ['prosp_test_1'],
      sequenceConfig: {
        id: 'seq_unapproved',
        name: 'Unapproved Sequence',
        steps: [
          { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
        ],
        dailySendingLimit: 10,
      },
      sdrPersonaId: 'lead_sdr',
    });

    const proposalId = prepRes.data!.actionProposalId;
    const payloadHash = prepRes.data!.payloadHash;

    // Attempt dispatch without approval
    const dispatchRes = await dispatchApprovedOutreachAction({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      draftId: prepRes.data!.drafts[0].id,
      actionProposalId: proposalId,
      payloadHash,
      dryRun: false,
    });

    expect(dispatchRes.success).toBe(false);
    expect(dispatchRes.code).toBe('PROPOSAL_NOT_APPROVED');
  });

  it('rejects dispatch if payloadHash is tampered (Rule 22)', async () => {
    const prepRes = await stageSequenceApprovalAction({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      leadIds: ['prosp_test_1'],
      sequenceConfig: {
        id: 'seq_tamper',
        name: 'Tamper Check Sequence',
        steps: [
          { stepIndex: 1, dayOffset: 0, channel: 'whatsapp', name: 'Intro', condition: 'always' },
        ],
        dailySendingLimit: 10,
      },
      sdrPersonaId: 'lead_sdr',
    });

    const proposalId = prepRes.data!.actionProposalId;

    const dispatchRes = await dispatchApprovedOutreachAction({
      organizationId: 'org_test',
      workspaceId: 'ws_test',
      draftId: prepRes.data!.drafts[0].id,
      actionProposalId: proposalId,
      payloadHash: 'tampered_hash_value_1234567890abcdef1234567890abcdef1234567890abcdef',
      dryRun: false,
    });

    expect(dispatchRes.success).toBe(false);
    expect(dispatchRes.code).toBe('PAYLOAD_TAMPERED');
  });

  it('fetches outreach metrics successfully', async () => {
    const res = await getOutreachMetricsAction('org_test', 'ws_test');
    expect(res.success).toBe(true);
    expect(res.data?.totalDrafts).toBeDefined();
    expect(res.data?.channels).toBeDefined();
  });
});
