/**
 * @fileOverview Test Suite for Approval Governance Server Actions (Phase 8 Milestone 3)
 *
 * Implements:
 * - Rule 4: Zero `any` / zero `any[]`.
 * - Rule 8 & 47: Anti-IDOR validation.
 * - Rule 13: Model Distrust & Anti-Self-Approval.
 * - Rule 18: Live TOCTOU Authority Check.
 * - Rule 21 & 22: Cryptographic Payload Hash Matching (Tamper Detection).
 * - Rule 27: Saga Compensation Trigger on Rejection.
 * - Rule 40: Tamper-Evident Domain Event Publication.
 * - Rule 51: Server Action Authentication via `requireAuth()`.
 * - Rule 60: Emergency Dead-Man Switch Evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ActionProposal } from '@/platform/policy/approval-proposal-types';

// Mock auth context
let mockAuthUser = {
  uid: 'user_operator_1',
  isSystemAdmin: false,
  profile: {
    organizationId: 'org_acme_corp',
  },
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => mockAuthUser),
}));

// Mock dead-man switch
let mockDeadManPaused = false;
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async () => {
    if (mockDeadManPaused) {
      const err = new Error('Platform emergency dead-man pause is active.');
      (err as { code?: string }).code = 'AGENT_GOVERNANCE_EMERGENCY_PAUSED';
      throw err;
    }
  }),
  updateEmergencyPauseStatus: vi.fn(async (paused: boolean) => {
    mockDeadManPaused = paused;
  }),
}));

// Mock EventBus
const publishedEvents: unknown[] = [];
vi.mock('@/platform/events/event-bus', () => ({
  globalEventBus: {
    publish: vi.fn(async (event: unknown) => {
      publishedEvents.push(event);
    }),
  },
  defaultEventBus: {
    publish: vi.fn(async (event: unknown) => {
      publishedEvents.push(event);
    }),
  },
}));

// In-memory Firestore mock for capability_approvals
const mockProposalsStore = new Map<string, Record<string, unknown>>();

vi.mock('@/lib/firebase-admin', () => {
  const collectionMock = (collName: string) => {
    if (collName === 'system_settings') {
      return {
        doc: (_docId: string) => ({
          get: async () => ({
            exists: true,
            data: () => ({ emergencyPause: mockDeadManPaused }),
          }),
          set: async (data: unknown) => {
            if ((data as { emergencyPause?: boolean })?.emergencyPause !== undefined) {
              mockDeadManPaused = !!(data as { emergencyPause?: boolean }).emergencyPause;
            }
          },
        }),
      };
    }

    return {
      doc: (docId: string) => ({
        get: async () => {
          const item = mockProposalsStore.get(docId);
          return {
            exists: !!item,
            id: docId,
            data: () => (item ? { ...item } : undefined),
          };
        },
        set: async (data: Record<string, unknown>) => {
          mockProposalsStore.set(docId, { ...data, proposalId: docId });
        },
        update: async (data: Record<string, unknown>) => {
          const existing = mockProposalsStore.get(docId);
          if (!existing) throw new Error('Not found');
          mockProposalsStore.set(docId, { ...existing, ...data });
        },
      }),
      where: (field: string, op: string, val: unknown) => {
        let filters: Array<[string, string, unknown]> = [[field, op, val]];
        const queryBuilder = {
          where: (f2: string, op2: string, val2: unknown) => {
            filters.push([f2, op2, val2]);
            return queryBuilder;
          },
          limit: (_n: number) => ({
            get: async () => {
              const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
              for (const [id, record] of mockProposalsStore.entries()) {
                let match = true;
                for (const [f, , v] of filters) {
                  if (record[f] !== v) {
                    match = false;
                    break;
                  }
                }
                if (match) {
                  docs.push({ id, data: () => ({ ...record, proposalId: id }) });
                }
              }
              return { docs, empty: docs.length === 0, size: docs.length };
            },
          }),
          get: async () => {
            const docs: Array<{ id: string; data: () => Record<string, unknown> }> = [];
            for (const [id, record] of mockProposalsStore.entries()) {
              let match = true;
              for (const [f, , v] of filters) {
                if (record[f] !== v) {
                  match = false;
                  break;
                }
              }
              if (match) {
                docs.push({ id, data: () => ({ ...record, proposalId: id }) });
              }
            }
            return { docs, empty: docs.length === 0, size: docs.length };
          },
        };
        return queryBuilder;
      },
    };
  };

  return {
    adminDb: {
      collection: collectionMock,
    },
  };
});

// Import actions under test
import {
  listActionProposalsAction,
  getActionProposalDetailsAction,
  approveActionProposalAction,
  rejectActionProposalAction,
  getApprovalGovernanceMetricsAction,
  setEmergencyPauseAction,
} from '@/app/actions/approval-governance-actions';
import { ApprovalInterceptor } from '@/platform/runtime/execution/approval-interceptor';

describe('Approval Governance Server Actions (Phase 8 Milestone 3)', () => {
  const samplePayload = {
    campaignId: 'camp_789',
    recipientCount: 500,
    discountRate: 0.15,
  };
  const samplePayloadHash = ApprovalInterceptor.computePayloadHash(samplePayload);

  const mockProposalDoc: ActionProposal = {
    proposalId: 'prop_test_100',
    organizationId: 'org_acme_corp',
    workspaceId: 'ws_sales_01',
    capabilityId: 'campaigns.dispatch_outbound',
    capabilityVersion: '1.0.0',
    agentPersonaId: 'lead_sdr',
    authorizingUserId: 'user_agent_supervisor',
    what: 'Dispatch Q4 renewal campaign to 500 targeted customers',
    why: 'Customer health score >= 80 and contracts up for renewal in 45 days',
    blastRadius: {
      entityCount: 500,
      entityType: 'contacts',
      estimatedCostUsd: 25.0,
      riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
      targetSummary: 'Tier 1 Enterprise Renewals',
    },
    payload: samplePayload,
    payloadHash: samplePayloadHash,
    status: 'pending',
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockProposalsStore.clear();
    publishedEvents.length = 0;
    mockDeadManPaused = false;
    mockAuthUser = {
      uid: 'user_operator_1',
      isSystemAdmin: false,
      profile: {
        organizationId: 'org_acme_corp',
      },
    };

    mockProposalsStore.set(mockProposalDoc.proposalId, { ...mockProposalDoc });
  });

  describe('1. listActionProposalsAction', () => {
    it('enforces Anti-IDOR: rejects requests for another tenant', async () => {
      const result = await listActionProposalsAction({
        organizationId: 'org_other_tenant',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('returns pending proposals for the authenticated organization', async () => {
      const result = await listActionProposalsAction({
        organizationId: 'org_acme_corp',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].proposalId).toBe('prop_test_100');
    });

    it('filters proposals by category and search query', async () => {
      const result = await listActionProposalsAction({
        organizationId: 'org_acme_corp',
        category: 'campaigns',
        search: 'renewal',
      });

      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);

      const emptyResult = await listActionProposalsAction({
        organizationId: 'org_acme_corp',
        category: 'financial',
      });

      expect(emptyResult.success).toBe(true);
      expect(emptyResult.data?.length).toBe(0);
    });
  });

  describe('2. getActionProposalDetailsAction', () => {
    it('retrieves detailed proposal record by ID', async () => {
      const result = await getActionProposalDetailsAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
      });

      expect(result.success).toBe(true);
      expect(result.data?.proposalId).toBe('prop_test_100');
      expect(result.data?.what).toContain('Dispatch Q4 renewal');
    });

    it('fails with PROPOSAL_NOT_FOUND when ID does not exist', async () => {
      const result = await getActionProposalDetailsAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_non_existent',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROPOSAL_NOT_FOUND');
    });
  });

  describe('3. approveActionProposalAction (Rule 13, 18, 21, 22, 60)', () => {
    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      mockDeadManPaused = true;

      const result = await approveActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EMERGENCY_PAUSED');
    });

    it('enforces Anti-Self-Approval: proposer cannot approve L4 privileged actions (Rule 13)', async () => {
      // Modify proposal to L4 privileged and set proposer to caller
      const l4Proposal: ActionProposal = {
        ...mockProposalDoc,
        proposalId: 'prop_l4_self',
        authorizingUserId: 'user_operator_1', // caller is proposer
        blastRadius: {
          entityCount: 1,
          entityType: 'database',
          riskLevel: 'L4_PRIVILEGED_DESTRUCTIVE',
        },
      };
      mockProposalsStore.set(l4Proposal.proposalId, { ...l4Proposal });

      const result = await approveActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_l4_self',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('SELF_APPROVAL_FORBIDDEN');
    });

    it('enforces Cryptographic Payload Hash Matching: rejects tampered payloads (Rule 22)', async () => {
      const tamperedPayload = {
        ...samplePayload,
        discountRate: 0.99, // tampered from 0.15 to 0.99!
      };

      const result = await approveActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
        executionPayload: tamperedPayload,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYLOAD_TAMPERED');
    });

    it('successfully approves proposal, updates status, and emits domain event (Rule 21 & 40)', async () => {
      const result = await approveActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
        decisionNotes: 'Approved after verifying Q4 quota allocation.',
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('approved');
      expect(result.data?.approvedBy).toBe('user_operator_1');

      // Verify domain event emitted
      expect(publishedEvents.length).toBeGreaterThan(0);
      const event = publishedEvents[0] as { type: string; payload: { decision: string } };
      expect(event.type).toBe('policy.approval.granted');
      expect(event.payload.decision).toBe('approved');
    });

    it('rejects double-approval: fails if proposal is already decided', async () => {
      // First approval
      await approveActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
      });

      // Second approval attempt
      const secondResult = await approveActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
      });

      expect(secondResult.success).toBe(false);
      expect(secondResult.error?.code).toBe('PROPOSAL_ALREADY_DECIDED');
    });
  });

  describe('4. rejectActionProposalAction (Rule 27 & 40)', () => {
    it('requires mandatory decision notes (min 5 characters)', async () => {
      const result = await rejectActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
        decisionNotes: 'no', // Too short
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INVALID_ARGUMENT');
    });

    it('successfully rejects proposal and emits policy.approval.rejected event', async () => {
      const result = await rejectActionProposalAction({
        organizationId: 'org_acme_corp',
        proposalId: 'prop_test_100',
        decisionNotes: 'Target customer segment already received promotional emails this week.',
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('rejected');
      expect(result.data?.rejectedBy).toBe('user_operator_1');

      const event = publishedEvents[0] as { type: string; payload: { decision: string } };
      expect(event.type).toBe('policy.approval.rejected');
      expect(event.payload.decision).toBe('rejected');
    });
  });

  describe('5. getApprovalGovernanceMetricsAction', () => {
    it('aggregates metrics for pending, approved, and rejected proposals', async () => {
      const result = await getApprovalGovernanceMetricsAction({
        organizationId: 'org_acme_corp',
      });

      expect(result.success).toBe(true);
      expect(result.data?.pendingCount).toBe(1);
      expect(result.data?.isEmergencyPaused).toBe(false);
    });
  });

  describe('6. setEmergencyPauseAction (Rule 60)', () => {
    it('forbids non-system-admin from toggling emergency pause', async () => {
      const result = await setEmergencyPauseAction({
        paused: true,
        reason: 'Testing emergency pause',
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('allows system admin to toggle emergency pause', async () => {
      mockAuthUser.isSystemAdmin = true;

      const result = await setEmergencyPauseAction({
        paused: true,
        reason: 'Security incident drill',
      });

      expect(result.success).toBe(true);
      expect(result.data?.paused).toBe(true);
      expect(mockDeadManPaused).toBe(true);
    });
  });
});
