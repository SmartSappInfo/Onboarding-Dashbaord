/**
 * @fileOverview Approval Governance Server Actions over the UNIFIED approval record
 * (Phase 8 M3; rewritten for Phase 11 M0 · T2, findings F4/F5).
 *
 * Covers: anti-IDOR; listing limited to the person's workspaces; approver policy (permission,
 * membership, never the proposer, L4 dual); payload tamper check with the gateway envelope; one
 * decision wins (version); legacy proposals need re-proposal; decision + security-feed events;
 * metrics; emergency pause.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';
import type { AuthContext } from '@/lib/auth/require-auth';
import type { UserProfile } from '@/lib/types';

const h = vi.hoisted(() => ({
  db: undefined as unknown,
  paused: false,
  events: [] as Array<{ type: string; payload: Record<string, unknown> }>,
  enqueued: [] as Array<Record<string, unknown>>,
}));

let mockAuthUser: AuthContext;
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => mockAuthUser),
}));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async () => {
    if (h.paused) {
      const err = Object.assign(new Error('Platform emergency dead-man pause is active.'), { code: 'AGENT_GOVERNANCE_EMERGENCY_PAUSED' });
      throw err;
    }
  }),
  updateEmergencyPauseStatus: vi.fn(async (paused: boolean) => {
    h.paused = paused;
  }),
}));
vi.mock('@/platform/events/event-bus', () => {
  const publish = vi.fn(async (event: { type: string; payload: Record<string, unknown> }) => {
    h.events.push(event);
  });
  return { globalEventBus: { publish }, defaultEventBus: { publish } };
});

vi.mock('@/platform/workflows/dispatcher/workflow-dispatcher', () => ({
  getWorkflowDispatcher: () => ({
    enqueueWorkflowStep: vi.fn(async (options: Record<string, unknown>) => {
      h.enqueued.push(options);
      return { taskKey: 'task', payload: {} };
    }),
  }),
}));

import {
  listActionProposalsAction,
  getActionProposalDetailsAction,
  approveActionProposalAction,
  rejectActionProposalAction,
  getApprovalGovernanceMetricsAction,
  setEmergencyPauseAction,
} from '@/app/actions/approval-governance-actions';
import { buildApprovalRecord } from '@/platform/policy/unified-approval-store';
import type { ApprovalRecord } from '@/platform/policy/approval-record';
import { getFullAdminPermissions } from '@/lib/permissions-engine';

const db = new FakeFirestore();
h.db = db;

const samplePayload = { campaignId: 'camp_789', recipientCount: 500, discountRate: 0.15 };

function seed(id: string, over: Partial<Parameters<typeof buildApprovalRecord>[0]> = {}): ApprovalRecord {
  const record = buildApprovalRecord({
    capability: null,
    capabilityId: 'campaigns.dispatch_outbound',
    organizationId: 'org_acme_corp',
    workspaceId: 'ws_sales_01',
    payload: samplePayload,
    requestedBy: { kind: 'agent', userId: 'user_agent_supervisor', agentPersonaId: 'lead_sdr' },
    what: 'Dispatch Q4 renewal campaign to 500 targeted customers',
    why: 'Customer health score >= 80 and contracts up for renewal in 45 days',
    blastRadius: { entityCount: 500, entityType: 'contacts', estimatedCostUsd: 25, riskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE', targetSummary: 'Tier 1 Enterprise Renewals' },
    ...over,
  }, Date.now(), id);
  db.write(`capability_approvals/${id}`, record);
  return record;
}

function auth(over: Partial<UserProfile> = {}, uid = 'user_operator_1', isSystemAdmin = false): AuthContext {
  const profile: UserProfile = {
    id: uid, name: 'Operator', email: `${uid}@acme.test`, createdAt: '2026-01-01T00:00:00.000Z',
    organizationId: 'org_acme_corp', workspaceIds: ['ws_sales_01'], permissions: ['agent_approvals_decide'], ...over,
  };
  return { uid, isSystemAdmin, profile };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.docs.clear();
  h.events.length = 0;
  h.enqueued.length = 0;
  h.paused = false;
  mockAuthUser = auth();
  seed('prop_test_100');
});

describe('Approval Governance Server Actions (unified approvals)', () => {
  describe('1. listActionProposalsAction', () => {
    it('enforces Anti-IDOR: rejects requests for another tenant', async () => {
      const result = await listActionProposalsAction({ organizationId: 'org_rival_corp' });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('returns pending requests with what the approver needs (canDecide, version, approvals)', async () => {
      const result = await listActionProposalsAction({ organizationId: 'org_acme_corp', workspaceId: 'ws_sales_01' });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0]).toMatchObject({ proposalId: 'prop_test_100', canDecide: true, version: 0, requiredApprovals: 1, approvalsCount: 0, executable: false, needsReproposal: false });
    });

    it('filters by category and search query', async () => {
      expect((await listActionProposalsAction({ organizationId: 'org_acme_corp', category: 'campaigns', search: 'renewal' })).data).toHaveLength(1);
      expect((await listActionProposalsAction({ organizationId: 'org_acme_corp', category: 'campaigns', search: 'nonexistent' })).data).toHaveLength(0);
    });

    it("hides other workspaces' requests from non-members; the proposer can't decide their own", async () => {
      mockAuthUser = auth({ workspaceIds: ['ws_other'] });
      expect((await listActionProposalsAction({ organizationId: 'org_acme_corp' })).data).toHaveLength(0);
      mockAuthUser = auth({}, 'user_agent_supervisor');
      expect((await listActionProposalsAction({ organizationId: 'org_acme_corp' })).data?.[0].canDecide).toBe(false);
    });

    it('shows legacy proposals as needing re-proposal', async () => {
      db.write('capability_approvals/prop_legacy', {
        organizationId: 'org_acme_corp', workspaceId: 'ws_sales_01', capabilityId: 'campaigns.dispatch_outbound', capabilityVersion: '1.0.0',
        agentPersonaId: 'lead_sdr', authorizingUserId: 'user_agent_supervisor', what: 'Old', why: 'Old', payload: samplePayload,
        payloadHash: 'b'.repeat(64), status: 'pending', expiresAt: new Date(Date.now() + 86400000).toISOString(),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
      const legacy = (await listActionProposalsAction({ organizationId: 'org_acme_corp' })).data?.find((p) => p.proposalId === 'prop_legacy');
      expect(legacy).toMatchObject({ needsReproposal: true, canDecide: false });
      expect((await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_legacy' })).error?.code).toBe('NEEDS_REPROPOSAL');
    });
  });

  describe('2. getActionProposalDetailsAction', () => {
    it('retrieves a request by id', async () => {
      const result = await getActionProposalDetailsAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      expect(result.success).toBe(true);
      expect(result.data?.what).toContain('Dispatch Q4 renewal');
    });

    it('fails with PROPOSAL_NOT_FOUND when the id does not exist', async () => {
      const result = await getActionProposalDetailsAction({ organizationId: 'org_acme_corp', proposalId: 'prop_nonexistent' });
      expect(result.error?.code).toBe('PROPOSAL_NOT_FOUND');
    });
  });

  describe('3. approveActionProposalAction (Rules 13, 17, 18, 21, 22, 60)', () => {
    it('fails closed when the emergency dead-man switch is active (Rule 60)', async () => {
      h.paused = true;
      const result = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      expect(result.error?.code).toBe('EMERGENCY_PAUSED');
    });

    it('the proposer can never decide their own request (any risk level) and it is recorded', async () => {
      mockAuthUser = auth({}, 'user_agent_supervisor');
      const result = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      expect(result.error?.code).toBe('SELF_DECISION');
      expect(h.events.map((e) => e.type)).toContain('approval.self_decision_blocked');
    });

    it('a workspace-admin role (schema with users edit) can decide by default (D6)', async () => {
      mockAuthUser = auth({ permissions: [], permissionsSchema: getFullAdminPermissions() });
      expect((await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' })).success).toBe(true);
    });

    it('a member without the decide permission is refused and it is recorded', async () => {
      mockAuthUser = auth({ permissions: ['prospects_view'] });
      const result = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      expect(result.error?.code).toBe('NOT_PERMITTED');
      expect(h.events.map((e) => e.type)).toContain('approval.permission_denied');
    });

    it('rejects a tampered payload (Rule 22) and records the mismatch', async () => {
      const result = await approveActionProposalAction({
        organizationId: 'org_acme_corp', proposalId: 'prop_test_100',
        executionPayload: { ...samplePayload, discountRate: 0.99 },
      });
      expect(result.error?.code).toBe('PAYLOAD_TAMPERED');
      expect(h.events.map((e) => e.type)).toContain('approval.binding_mismatch');
    });

    it('approves, records the approver and emits policy.approval.granted (Rules 21, 40)', async () => {
      const result = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100', executionPayload: samplePayload, expectedVersion: 0 });
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ status: 'approved', approvedBy: 'user_operator_1', version: 1 });
      const event = h.events.find((e) => e.type === 'policy.approval.granted');
      expect(event?.payload.decision).toBe('approved');
    });

    it('a second decision is refused: someone already decided this', async () => {
      await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      const second = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      expect(second.error?.code).toBe('NOT_PENDING');
      expect(second.error?.message).toBe('Someone already decided this.');
      const stale = await rejectActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100', decisionNotes: 'Too late now', expectedVersion: 0 });
      expect(stale.error?.code).toBe('VERSION_CONFLICT');
    });

    it('L4 needs two different approvers; the decision event fires only when complete', async () => {
      seed('prop_l4', { blastRadius: { entityCount: 1, entityType: 'workspace', riskLevel: 'L4_PRIVILEGED_DESTRUCTIVE' } });
      const first = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_l4' });
      expect(first.data).toMatchObject({ status: 'pending', approvalsCount: 1, requiredApprovals: 2 });
      expect(h.events.find((e) => e.type === 'policy.approval.granted')).toBeUndefined();
      expect((await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_l4' })).error?.code).toBe('DUPLICATE_APPROVER');
      mockAuthUser = auth({}, 'user_operator_2');
      const second = await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_l4' });
      expect(second.data?.status).toBe('approved');
      expect(h.events.find((e) => e.type === 'policy.approval.granted')).toBeDefined();
    });
  });

  describe('4. rejectActionProposalAction (Rules 27, 40)', () => {
    it('requires mandatory decision notes (min 5 characters)', async () => {
      const result = await rejectActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100', decisionNotes: 'No' });
      expect(result.error?.code).toBe('INVALID_ARGUMENT');
    });

    it('rejects and emits policy.approval.rejected', async () => {
      const result = await rejectActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100', decisionNotes: 'Discount too high for this tier' });
      expect(result.data).toMatchObject({ status: 'rejected', rejectedBy: 'user_operator_1' });
      expect(h.events.find((e) => e.type === 'policy.approval.rejected')?.payload.decision).toBe('rejected');
    });
  });

  describe('4b. workflow steps resume on a complete decision (M0 · T5.3)', () => {
    const workflowRef = { workflowId: 'wf_1', stepId: 'step_1' };
    const resumeTask = { workflowId: 'wf_1', stepId: 'step_1', tenant: { organizationId: 'org_acme_corp', workspaceId: 'ws_sales_01' }, idempotencyKey: 'wf_resume_prop_wf' };

    it('approving enqueues the waiting step once, keyed by the approval', async () => {
      seed('prop_wf', { workflowRef });
      await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_wf' });
      expect(h.enqueued).toEqual([expect.objectContaining(resumeTask)]);
    });

    it('rejecting also enqueues it (the runner fails the step)', async () => {
      seed('prop_wf', { workflowRef });
      await rejectActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_wf', decisionNotes: 'Not this quarter' });
      expect(h.enqueued).toEqual([expect.objectContaining(resumeTask)]);
    });

    it('does nothing for requests without a workflow, or before an L4 decision is complete', async () => {
      await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_test_100' });
      seed('prop_wf_l4', { workflowRef, blastRadius: { entityCount: 1, entityType: 'workspace', riskLevel: 'L4_PRIVILEGED_DESTRUCTIVE' } });
      await approveActionProposalAction({ organizationId: 'org_acme_corp', proposalId: 'prop_wf_l4' });
      expect(h.enqueued).toEqual([]);
    });
  });

  describe('5. getApprovalGovernanceMetricsAction', () => {
    it('aggregates metrics', async () => {
      const result = await getApprovalGovernanceMetricsAction({ organizationId: 'org_acme_corp' });
      expect(result.data).toMatchObject({ pendingCount: 1, isEmergencyPaused: false });
    });
  });

  describe('6. setEmergencyPauseAction (Rule 60)', () => {
    it('forbids non-system-admins from toggling the emergency pause', async () => {
      const result = await setEmergencyPauseAction({ paused: true, reason: 'Testing emergency pause' });
      expect(result.error?.code).toBe('FORBIDDEN');
    });

    it('requires at least 5 characters justification when engaging emergency pause (Rule 60 & 61)', async () => {
      mockAuthUser = auth({}, 'admin', true);
      const result = await setEmergencyPauseAction({ paused: true, reason: 'No' });
      expect(result.error?.code).toBe('INVALID_ARGUMENT');
      expect(result.error?.message).toContain('at least 5 characters');
    });

    it('allows a system admin to toggle the emergency pause', async () => {
      mockAuthUser = auth({}, 'admin', true);
      const result = await setEmergencyPauseAction({ paused: true, reason: 'Security incident drill' });
      expect(result.data?.paused).toBe(true);
      expect(h.paused).toBe(true);
    });
  });
});
