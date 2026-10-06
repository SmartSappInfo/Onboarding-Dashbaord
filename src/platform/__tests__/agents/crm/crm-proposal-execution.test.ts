// @vitest-environment node
/**
 * @fileOverview CRM proposal execution & compensation (Phase 11 M0 · T4.1, findings F6/F7).
 *
 * Through the real gateway and the unified approval store (fake Firestore; capabilities use the
 * REAL alias permission strings, so canonical permission equivalence is exercised):
 * approve → the record really changes; stale record → VERSION_CONFLICT, nothing written; rollback
 * restores the before-state, refused if the record changed after; unregistered/unmappable targets
 * are recommendations; postcondition mismatch → unknown + operator alert; flag off → refused;
 * requester lost access → refused; idempotent second click; task rollback refused with guidance.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { FakeFirestore } from '../../helpers/fake-firestore';

const h = vi.hoisted(() => ({ events: [] as Array<{ type: string; payload: Record<string, unknown> }> }));
vi.mock('@/platform/policy/governance-dead-man', () => ({ checkGovernanceDeadManSwitch: vi.fn(async () => undefined) }));
vi.mock('@/platform/events/event-bus', () => {
  const publish = vi.fn(async (event: { type: string; payload: Record<string, unknown> }) => { h.events.push(event); });
  return { defaultEventBus: { publish }, globalEventBus: { publish } };
});

import { CrmProposalBridge, CRM_PROPOSAL_EXECUTION_FLAG } from '@/platform/agents/crm/actions/crm-proposal-bridge';
import type { CrmProposedAction } from '@/platform/agents/crm/actions/crm-action-types';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import type { CapabilityFlagRecord } from '@/platform/capabilities/flags/capability-flags-types';
import { createInMemoryIdempotencyStore } from '@/platform/capabilities/storage/execution-store';
import { createUnifiedApprovalVerifier, decideApproval } from '@/platform/policy/unified-approval-store';

let db: FakeFirestore;
let flag: CapabilityFlagRecord | null;
let breakPostcondition: boolean;
const fs = () => db.asFirestore();

const STAGES = ['discovery', 'proposal_review', 'won'];
const okResult = <T>(data: T) => ({ success: true as const, data, executionId: 'e', emittedEvents: [], durationMs: 1 });
const base = { version: '1.0.0', workspaceScoped: true, tenantScoped: true } as const;
const exec = (maxDurationMs = 2000) => ({ synchronous: true, maxDurationMs, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 });
const policies = { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false };

const DealGetInput = z.object({ workspaceId: z.string(), dealId: z.string() });
const dealGet: AnyCapabilityDefinition = {
  ...base, id: 'deal.get', name: 'Get deal', description: 'Reads a deal', domain: 'deals_revenue', operation: 'read',
  inputSchema: DealGetInput, outputSchema: z.object({ id: z.string(), stageId: z.string() }).loose(),
  permissions: ['sales:pipeline:view', 'app:deals_view', 'deal:read'],
  risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec(), policies,
  handler: async (input) => {
    const { dealId } = DealGetInput.parse(input);
    const deal = db.read(`deals/${dealId}`);
    if (!deal) return { success: false, error: { code: 'NOT_FOUND', message: 'Deal not found', stateChanged: 'no', retryable: false }, executionId: 'e', emittedEvents: [], durationMs: 1 };
    return okResult({ id: dealId, stageId: String(deal.stageId) });
  },
};
const AdvanceInput = z.object({ workspaceId: z.string(), dealId: z.string(), stageId: z.string(), reason: z.string().optional() });
const dealAdvance: AnyCapabilityDefinition = {
  ...base, id: 'deal.advance_stage', name: 'Advance stage', description: 'Moves a deal to another stage', domain: 'deals_revenue', operation: 'update',
  inputSchema: AdvanceInput, outputSchema: z.object({ dealId: z.string(), stageId: z.string() }).loose(),
  permissions: ['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update'],
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec(), policies,
  handler: async (input) => {
    const { dealId, stageId } = AdvanceInput.parse(input);
    if (!STAGES.includes(stageId)) return { success: false, error: { code: 'VALIDATION', message: 'Stage is not in this pipeline', stateChanged: 'no', retryable: false }, executionId: 'e', emittedEvents: [], durationMs: 1 };
    db.write(`deals/${dealId}`, { ...db.read(`deals/${dealId}`), stageId: breakPostcondition ? 'discovery' : stageId });
    return okResult({ dealId, stageId });
  },
};
const TaskInput = z.object({ workspaceId: z.string(), title: z.string(), dueDate: z.string().optional(), priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(), entityId: z.string().optional(), description: z.string().optional() });
const taskCreate: AnyCapabilityDefinition = {
  ...base, id: 'task.create', name: 'Create task', description: 'Creates a task', domain: 'tasks_productivity', operation: 'create',
  inputSchema: TaskInput, outputSchema: z.object({ taskId: z.string() }).loose(),
  permissions: ['operations:tasks:create', 'app:tasks_create', 'tasks:create'],
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec(), policies,
  handler: async (input) => {
    const t = TaskInput.parse(input);
    db.write('tasks/t-new', { title: t.title, workspaceId: t.workspaceId });
    return okResult({ taskId: 't-new' });
  },
};
const registry = new Map([dealGet, dealAdvance, taskCreate].map((c) => [c.id, c]));

const human = (uid: string, scopes: string[]): AgentPrincipal => ({ actorType: 'user', userId: uid, organizationId: 'org-1', workspaceId: 'ws-a', grantedScopes: scopes, effectiveRole: 'member' });
const people: Record<string, AgentPrincipal> = {
  'rep-1': human('rep-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'rbac:operations.tasks.view', 'rbac:operations.tasks.create']),
  'admin-1': human('admin-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'rbac:operations.tasks.create', 'agent_approvals_decide']),
  'viewer-1': human('viewer-1', ['rbac:operations.pipeline.view']),
};

let bridge: CrmProposalBridge;
function makeBridge(): CrmProposalBridge {
  return new CrmProposalBridge({
    db: fs(),
    lookup: (id) => registry.get(id),
    loadPrincipal: async ({ uid }) => people[uid] ?? null,
    flags: { getFlagRecord: async (id) => (id === CRM_PROPOSAL_EXECUTION_FLAG ? flag : null) },
    gatewayDeps: {
      registryLookup: (id) => registry.get(id),
      approvals: createUnifiedApprovalVerifier(fs()),
      idempotencyStore: createInMemoryIdempotencyStore(),
      flagChecker: { checkFlag: async () => ({ enabled: true }) },
      verifyActorStanding: async () => ({ active: true }),
      auditSink: () => undefined,
      outboxSink: () => undefined,
    },
    nowMs: () => Date.parse('2026-10-06T12:00:00.000Z'),
  });
}

const action = (over: Partial<CrmProposedAction> = {}): CrmProposedAction => ({
  id: 'act_update_stage_d-1', entityId: 'ent-1', workspaceId: 'ws-a', actionType: 'UPDATE_STAGE', priority: 'HIGH', riskLevel: 'L2_STATE_MUTATION',
  explainability: { what: 'Move deal to proposal review', why: 'Stalled 40 days', impact: 'Momentum', blastRadius: { affectedRecordsCount: 1, financialExposureUsd: 0, isReversible: true } },
  idempotencyKey: 'idem-1', targetCapabilityId: 'crm.deal.update_stage',
  payload: { dealId: 'd-1', currentStage: 'discovery', targetStage: 'proposal_review' }, requiresApproval: true, createdAt: '2026-10-06T11:00:00.000Z',
  ...over,
});
const approve = (approvalId: string) => decideApproval(fs(), {
  approvalId, organizationId: 'org-1', decision: 'approved', nowMs: Date.parse('2026-10-06T12:00:00.000Z'),
  actor: { uid: 'admin-1', isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['agent_approvals_decide'] },
});
const execute = (proposalId: string, callerId = 'admin-1') => bridge.executeApprovedProposal({ organizationId: 'org-1', workspaceId: 'ws-a', callerId, proposalId });
const rollback = (proposalId: string, callerId = 'admin-1') => bridge.rollbackAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId, proposalId, reason: 'Customer asked to wait' });

beforeEach(() => {
  db = new FakeFirestore();
  h.events.length = 0;
  flag = { capabilityId: CRM_PROPOSAL_EXECUTION_FLAG, workspaceOverrides: { 'ws-a': { enabled: true } } };
  breakPostcondition = false;
  db.write('deals/d-1', { workspaceId: 'ws-a', stageId: 'discovery' });
  bridge = makeBridge();
});

describe('CRM proposal execution (M0 · T4)', () => {
  it('maps to the registered capability, captures the before-state, and executes as deal_coach for the requester', async () => {
    const proposal = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    expect(proposal).toMatchObject({ capabilityId: 'deal.advance_stage', agentPersonaId: 'deal_coach', payload: { workspaceId: 'ws-a', dealId: 'd-1', stageId: 'proposal_review' } });
    expect(db.read(`capability_approvals/${proposal.proposalId}`)).toMatchObject({ executable: true, beforeState: { stageId: 'discovery' } });
    await approve(proposal.proposalId);
    const res = await execute(proposal.proposalId);
    expect(res).toMatchObject({ status: 'executed', affectedRecord: { type: 'deal', id: 'd-1', targetPath: '/deals/d-1' } });
    expect(db.read('deals/d-1')?.stageId).toBe('proposal_review');
    expect(db.read(`crm_proposal_executions/${proposal.proposalId}`)).toMatchObject({ status: 'applied', beforeState: { stageId: 'discovery' }, afterState: { stageId: 'proposal_review' } });
    expect(db.read(`capability_approvals/${proposal.proposalId}`)?.status).toBe('bound');
    expect(h.events.map((e) => e.type)).toContain('crm.action.executed');
  });

  it('a second click returns the same result without writing again', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    await approve(p.proposalId);
    const first = await execute(p.proposalId);
    db.write('deals/d-1', { workspaceId: 'ws-a', stageId: 'proposal_review', touched: true });
    expect(await execute(p.proposalId)).toEqual(first);
  });

  it('refuses when the record moved since the proposal: VERSION_CONFLICT, nothing written', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    await approve(p.proposalId);
    db.write('deals/d-1', { workspaceId: 'ws-a', stageId: 'won' });
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(db.read('deals/d-1')?.stageId).toBe('won');
    expect(db.read(`capability_approvals/${p.proposalId}`)?.status).toBe('approved');
  });

  it('refuses unapproved requests, and refuses everything while the flag is off', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_APPROVED' });
    await approve(p.proposalId);
    flag = null;
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'EXECUTION_DISABLED' });
    flag = { capabilityId: CRM_PROPOSAL_EXECUTION_FLAG, defaultState: true, killSwitch: true };
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'EXECUTION_DISABLED' });
    expect(db.read('deals/d-1')?.stageId).toBe('discovery');
  });

  it('a stage outside the pipeline is refused by the capability (business validation); nothing written', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action({ payload: { dealId: 'd-1', targetStage: 'imaginary' } }) });
    await approve(p.proposalId);
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'EXECUTION_REFUSED' });
    expect(db.read('deals/d-1')?.stageId).toBe('discovery');
  });

  it('a requester who lost access means nothing is applied', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    await approve(p.proposalId);
    delete people['rep-1'];
    try {
      await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'REQUESTER_NOT_ACTIVE' });
    } finally {
      people['rep-1'] = human('rep-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'rbac:operations.tasks.view', 'rbac:operations.tasks.create']);
    }
  });

  it('the agent never exceeds the requester: a view-only requester cannot get a stage change applied', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'viewer-1', action: action() });
    await approve(p.proposalId);
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'EXECUTION_REFUSED' });
    expect(db.read('deals/d-1')?.stageId).toBe('discovery');
  });

  it('a postcondition mismatch is recorded as unknown and alerts operators', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    await approve(p.proposalId);
    breakPostcondition = true;
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'POSTCONDITION_FAILED' });
    expect(db.read(`crm_proposal_executions/${p.proposalId}`)?.status).toBe('postcondition_failed');
    expect(h.events.map((e) => e.type)).toContain('crm.action.postcondition_failed');
  });

  it('rollback restores the previous stage; refused if the record changed after the update', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action() });
    await approve(p.proposalId);
    await execute(p.proposalId);
    const res = await rollback(p.proposalId);
    expect(res).toMatchObject({ status: 'reverted', compensatingCapabilityId: 'deal.advance_stage' });
    expect(db.read('deals/d-1')?.stageId).toBe('discovery');
    await expect(rollback(p.proposalId)).rejects.toMatchObject({ code: 'ALREADY_REVERTED' });

    const q = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action({ id: 'act-2' }) });
    await approve(q.proposalId);
    await execute(q.proposalId);
    db.write('deals/d-1', { workspaceId: 'ws-a', stageId: 'won' });
    await expect(rollback(q.proposalId)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(db.read('deals/d-1')?.stageId).toBe('won');
  });

  it('tasks: created for real (as task_coordinator); undo is refused with guidance (no governed inverse yet)', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action({ id: 'act_task', actionType: 'CREATE_TASK', targetCapabilityId: 'crm.task.create', payload: { title: 'Call the bursar', priority: 'urgent' } }) });
    expect(p.agentPersonaId).toBe('task_coordinator');
    await approve(p.proposalId);
    expect((await execute(p.proposalId)).affectedRecord).toMatchObject({ type: 'task', id: 't-new' });
    expect(db.read('tasks/t-new')?.title).toBe('Call the bursar');
    await expect(rollback(p.proposalId)).rejects.toMatchObject({ code: 'NOT_REVERSIBLE' });
  });

  it('unmappable actions are recommendations: approvable, never executed', async () => {
    const p = await bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action({ id: 'act_owner', actionType: 'ASSIGN_OWNER', targetCapabilityId: 'crm.workspace_entity.assign_owner', payload: { entityId: 'ent-1', workspaceId: 'ws-a' } }) });
    expect(db.read(`capability_approvals/${p.proposalId}`)?.executable).toBe(false);
    expect(p.agentPersonaId).toBe('crm_assistant');
    await approve(p.proposalId);
    await expect(execute(p.proposalId)).rejects.toMatchObject({ code: 'NOT_EXECUTABLE' });
  });

  it('a target that no longer exists is refused at proposal time', async () => {
    await expect(bridge.proposeAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'rep-1', action: action({ payload: { dealId: 'gone', targetStage: 'won' } }) }))
      .rejects.toMatchObject({ code: 'TARGET_NOT_FOUND' });
  });
});
