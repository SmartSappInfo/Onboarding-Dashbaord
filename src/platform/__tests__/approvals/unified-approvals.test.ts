// @vitest-environment node
/**
 * @fileOverview Unified approvals + approver policy (Phase 11 M0 · T2.1, findings F4/F5).
 *
 * (a) an inbox approval passes the gateway verifier; (b) payload changed after approval →
 * APPROVAL_MISMATCH; (c) the proposer can't decide (L1–L4); (d) no permission → refused;
 * (e) non-member → refused; (f) L4 needs two distinct approvers; (g) legacy docs readable, legacy
 * hash → "Needs re-proposal"; (h) concurrent decisions → one wins; (i) agents can never hold the
 * decide permission. Plus: unregistered targets are recommendations only; old gateway records still
 * verify.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { FakeFirestore } from '../helpers/fake-firestore';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import { createInMemoryIdempotencyStore } from '../../capabilities/storage/execution-store';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import { isNonDelegableAction } from '../../capabilities/contracts/risk-levels';
import { computeApprovalPayloadHash } from '../../capabilities/policy/approval-verifier';
import { readStoredApproval } from '../../policy/approval-record';
import { canDecideApprovals, type DecisionActor } from '../../policy/approver-policy';
import { createApproval, createUnifiedApprovalVerifier, decideApproval, getApproval, hashProposalPayload, listApprovals } from '../../policy/unified-approval-store';

let db: FakeFirestore;
let handled: unknown[];
const fs = () => db.asFirestore();
const NOW = Date.parse('2026-10-06T12:00:00.000Z');

function capability(level: AnyCapabilityDefinition['risk']['level'] = 'L2_STATE_MUTATION'): AnyCapabilityDefinition {
  return {
    id: 'deal.advance_stage', version: '1.0.0', name: 'Advance stage', description: 'Moves a deal to another stage', domain: 'deals_revenue', operation: 'update',
    inputSchema: z.object({ workspaceId: z.string(), dealId: z.string(), stageId: z.string() }),
    outputSchema: z.object({ ok: z.boolean() }),
    permissions: ['rbac:operations.pipeline.edit'], workspaceScoped: true, tenantScoped: true,
    risk: { level, destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: true, nonDelegable: false },
    execution: { synchronous: true, maxDurationMs: 2000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 },
    policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
    handler: async (input) => {
      handled.push(input);
      return { success: true, data: { ok: true }, executionId: 'e', emittedEvents: [], durationMs: 1 };
    },
  };
}

const payload = { workspaceId: 'ws-a', dealId: 'd-1', stageId: 'won' };
const requestedBy = { kind: 'agent' as const, userId: 'rep-1', agentId: 'crm_assistant', agentPersonaId: 'crm_assistant' as const };
const admin: DecisionActor = { uid: 'admin-1', isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['users_manage'] };
const admin2: DecisionActor = { ...admin, uid: 'admin-2' };
const delegate: DecisionActor = { uid: 'lead-1', isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['agent_approvals_decide'] };
const member: DecisionActor = { uid: 'member-1', isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['prospects_view'] };
const outsider: DecisionActor = { ...admin, uid: 'admin-x', workspaceIds: ['ws-b'] };
const proposer: DecisionActor = { ...admin, uid: 'rep-1' };

const create = (cap: AnyCapabilityDefinition | null = capability(), over: Record<string, unknown> = {}) =>
  createApproval(fs(), { capability: cap, capabilityId: 'deal.advance_stage', organizationId: 'org-1', workspaceId: 'ws-a', payload, requestedBy, what: 'Mark deal won', why: 'Customer signed', ...over }, NOW);
const decide = (approvalId: string, actor: DecisionActor, decision: 'approved' | 'rejected' = 'approved', expectedVersion?: number) =>
  decideApproval(fs(), { approvalId, organizationId: 'org-1', actor, decision, nowMs: NOW + 1000, ...(expectedVersion !== undefined ? { expectedVersion } : {}) });

// A run-scoped agent id (not a persona), so the persona boundary doesn't mask the approval path.
const agent: AgentPrincipal = {
  actorType: 'agent', agentId: 'agent-run-1', userId: 'rep-1', organizationId: 'org-1', workspaceId: 'ws-a',
  grantedScopes: ['rbac:operations.pipeline.edit'], effectiveRole: 'member', runId: 'run-1', toolInvocationId: 'inv-1',
};
const execute = (cap: AnyCapabilityDefinition, approvalId: string, input: unknown = payload, principal: AgentPrincipal = agent) =>
  executeCapability(
    { capabilityId: cap.id, surface: 'agent', input, principal, correlationId: 'c', approvalId },
    { registryLookup: () => cap, approvals: createUnifiedApprovalVerifier(fs()), idempotencyStore: createInMemoryIdempotencyStore(),
      flagChecker: { checkFlag: async () => ({ enabled: true }) }, auditSink: () => undefined, outboxSink: () => undefined, nowMs: () => NOW + 2000 }
  );

beforeEach(() => {
  db = new FakeFirestore();
  handled = [];
});

describe('unified approvals', () => {
  it('(a) an approval decided in the inbox authorises exactly one gateway execution', async () => {
    const cap = capability();
    const rec = await create(cap);
    expect(rec).toMatchObject({ executable: true, hashVersion: 2, requiredApprovals: 1, status: 'pending' });
    expect(rec.payloadHash).toBe(computeApprovalPayloadHash({ capabilityId: cap.id, capabilityVersion: cap.version, organizationId: 'org-1', workspaceId: 'ws-a', input: payload }));
    expect(await decide(rec.approvalId, admin)).toMatchObject({ ok: true, complete: true });
    const first = await execute(cap, rec.approvalId);
    expect(first.success).toBe(true);
    expect(handled).toHaveLength(1);
    const other = await execute(cap, rec.approvalId, payload, { ...agent, runId: 'run-2', toolInvocationId: 'inv-2' });
    expect(!other.success && other.error.code).toBe('APPROVAL_ALREADY_USED');
    expect(handled).toHaveLength(1);
  });

  it('(b) a payload changed after approval is refused (APPROVAL_MISMATCH), nothing runs', async () => {
    const cap = capability();
    const rec = await create(cap);
    await decide(rec.approvalId, admin);
    const res = await execute(cap, rec.approvalId, { ...payload, stageId: 'lost' });
    expect(!res.success && res.error.code).toBe('APPROVAL_MISMATCH');
    expect(handled).toHaveLength(0);
  });

  it('(c) the proposer can never decide their own request, at any risk level', async () => {
    for (const level of ['L1_INTERNAL_DRAFT', 'L2_STATE_MUTATION', 'L3_EXTERNAL_COMMUNICATION_FINANCE', 'L4_PRIVILEGED_DESTRUCTIVE'] as const) {
      const rec = await create(capability(level));
      expect(await decide(rec.approvalId, proposer)).toEqual({ ok: false, code: 'SELF_DECISION' });
      expect(await decide(rec.approvalId, proposer, 'rejected')).toEqual({ ok: false, code: 'SELF_DECISION' });
    }
  });

  it('(d) a member without the decide permission is refused; a delegated decider and an admin may decide', async () => {
    const rec = await create();
    expect(await decide(rec.approvalId, member)).toEqual({ ok: false, code: 'NOT_PERMITTED' });
    expect((await decide(rec.approvalId, delegate)).ok).toBe(true);
    expect(canDecideApprovals(admin, 'ws-a')).toEqual({ ok: true });
    expect(canDecideApprovals({ ...member, isSystemAdmin: true }, 'ws-a')).toEqual({ ok: true });
  });

  it('(e) a non-member is refused even with the permission', async () => {
    const rec = await create();
    expect(await decide(rec.approvalId, outsider)).toEqual({ ok: false, code: 'NOT_MEMBER' });
  });

  it('(f) L4 needs two distinct approvers; the gateway refuses after only one', async () => {
    const cap = capability('L4_PRIVILEGED_DESTRUCTIVE');
    const rec = await create(cap);
    expect(rec.requiredApprovals).toBe(2);
    const first = await decide(rec.approvalId, admin);
    expect(first).toMatchObject({ ok: true, complete: false, record: { status: 'pending' } });
    expect(!(await execute(cap, rec.approvalId)).success).toBe(true);
    expect(await decide(rec.approvalId, admin)).toEqual({ ok: false, code: 'DUPLICATE_APPROVER' });
    expect(await decide(rec.approvalId, admin2)).toMatchObject({ ok: true, complete: true, record: { status: 'approved' } });
    expect((await execute(cap, rec.approvalId)).success).toBe(true);
  });

  it('(g) legacy inbox proposals stay readable but need re-proposal: never decided, never bound', async () => {
    db.write('capability_approvals/prop_old', {
      organizationId: 'org-1', workspaceId: 'ws-a', capabilityId: 'deal.advance_stage', capabilityVersion: '1.0.0',
      agentPersonaId: 'crm_assistant', authorizingUserId: 'rep-1', what: 'Old', why: 'Old', payload,
      payloadHash: 'a'.repeat(64), status: 'pending', expiresAt: '2026-12-01T00:00:00.000Z', createdAt: '2026-10-01T00:00:00.000Z', updatedAt: '2026-10-01T00:00:00.000Z',
    });
    const stored = await getApproval(fs(), 'prop_old', 'org-1');
    expect(stored?.kind).toBe('legacy_proposal');
    expect(await decide('prop_old', admin)).toEqual({ ok: false, code: 'NEEDS_REPROPOSAL' });
    db.write('capability_approvals/prop_old', { ...db.read('capability_approvals/prop_old'), status: 'approved', approvedBy: 'admin-1', approvedAt: '2026-10-02T00:00:00.000Z' });
    const res = await execute(capability(), 'prop_old');
    expect(!res.success && res.error.message).toMatch(/re-proposal/);
    expect(await getApproval(fs(), 'prop_old', 'org-2')).toBeNull();
  });

  it('(h) concurrent decisions: one wins, the other is told someone already decided', async () => {
    const rec = await create();
    const [a, b] = await Promise.all([decide(rec.approvalId, admin, 'approved', 0), decide(rec.approvalId, admin2, 'rejected', 0)]);
    const results = [a, b];
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.find((r) => !r.ok)).toMatchObject({ ok: false, code: expect.stringMatching(/VERSION_CONFLICT|NOT_PENDING/) });
  });

  it('(i) agents can never hold the decide permission (non-delegable)', () => {
    expect(isNonDelegableAction('app:agent_approvals_decide')).toBe(true);
    expect(isNonDelegableAction('agent_approvals_decide')).toBe(true);
  });

  it('a target that is not a registered capability is a recommendation: approvable, never executable', async () => {
    const rec = await create(null, { blastRadius: { entityCount: 1, entityType: 'deal', riskLevel: 'L2_STATE_MUTATION' } });
    expect(rec.executable).toBe(false);
    await decide(rec.approvalId, admin);
    const res = await execute(capability(), rec.approvalId);
    expect(!res.success && res.error.message).toMatch(/recommendation/);
  });

  it('refuses a payload the target capability would reject', async () => {
    await expect(create(capability(), { payload: { workspaceId: 'ws-a' } })).rejects.toThrow('not valid');
  });

  it('old gateway approval records stay verifiable', async () => {
    const cap = capability();
    db.write('capability_approvals/gw_old', {
      approvalId: 'gw_old', organizationId: 'org-1', workspaceId: 'ws-a', capabilityId: cap.id, capabilityVersion: cap.version,
      payloadHash: computeApprovalPayloadHash({ capabilityId: cap.id, capabilityVersion: cap.version, organizationId: 'org-1', workspaceId: 'ws-a', input: payload }),
      requestedBy: 'crm_assistant', approvedBy: 'admin-1', approvedAt: '2026-10-06T00:00:00.000Z', expiresAt: '2026-10-07T00:00:00.000Z', status: 'approved',
    });
    expect((await execute(cap, 'gw_old')).success).toBe(true);
    expect(readStoredApproval('gw_old', db.read('capability_approvals/gw_old')).kind).toBe('legacy_gateway');
  });

  it('hashProposalPayload hashes only the gateway envelope (extra fields on a whole proposal never leak in)', async () => {
    const rec = await create();
    const target = { capabilityId: rec.capabilityId, capabilityVersion: rec.capabilityVersion, organizationId: rec.organizationId, workspaceId: rec.workspaceId };
    const wholeProposal = { ...target, what: 'x', why: 'y', payloadHash: 'z' };
    const fromWhole = hashProposalPayload(wholeProposal, payload, () => capability());
    expect(fromWhole).toBe(hashProposalPayload(target, payload, () => capability()));
    expect(fromWhole).toBe(rec.payloadHash);
  });

  it('lists only this organisation\'s approvals for the workspace', async () => {
    await create();
    db.write('capability_approvals/foreign', { organizationId: 'org-2', workspaceId: 'ws-a', status: 'pending' });
    const list = await listApprovals(fs(), { workspaceId: 'ws-a', organizationId: 'org-1' });
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe('v2');
  });
});
