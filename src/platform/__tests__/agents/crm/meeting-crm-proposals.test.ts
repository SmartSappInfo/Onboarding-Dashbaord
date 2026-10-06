// @vitest-environment node
/**
 * @fileOverview CRM update proposals from meeting outcomes (Phase 11 M2 · T4.3, T4.4; plan §4.11, §4.12, D17).
 *
 * Real bridge + unified approval store + gateway over a fake database. Covers: a deal-stage
 * proposal bound to a checked item; lost response → key replay; self-approval denied; approved →
 * executed, verified and rolled back; stale target → re-propose; re-analysis invalidates the
 * approval; review / unknown / foreign items refused; tags and notes are recommendations only;
 * amounts and owners can never be proposed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { FakeFirestore } from '../../helpers/fake-firestore';

vi.mock('@/platform/policy/governance-dead-man', () => ({ checkGovernanceDeadManSwitch: vi.fn(async () => undefined) }));
vi.mock('@/platform/events/event-bus', () => {
  const publish = vi.fn(async () => undefined);
  return { defaultEventBus: { publish }, globalEventBus: { publish } };
});

import { CrmProposalBridge, CRM_PROPOSAL_EXECUTION_FLAG } from '@/platform/agents/crm/actions/crm-proposal-bridge';
import type { AgentPrincipal, AnyCapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import { createInMemoryIdempotencyStore } from '@/platform/capabilities/storage/execution-store';
import { createUnifiedApprovalVerifier, decideApproval, getApproval } from '@/platform/policy/unified-approval-store';
import { PIPELINE_ID, writeIntelligenceV2, type IntelligenceHeaderV2 } from '@/lib/meetings/intelligence/intelligence-store';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import { MeetingCrmTargetSchema, proposeMeetingCrmUpdate, type MeetingCrmProposalDeps } from '@/lib/meetings/intelligence/crm-proposals';

let db: FakeFirestore;
const fs = () => db.asFirestore();
const NOW = '2026-10-07T12:00:00.000Z';
const nowMs = () => Date.parse(NOW);

const ok = <T>(data: T) => ({ success: true as const, data, executionId: 'e', emittedEvents: [], durationMs: 1 });
const base = { version: '1.0.0', workspaceScoped: true, tenantScoped: true } as const;
const exec = { synchronous: true, maxDurationMs: 2000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 10_000 };
const policies = { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false };
const DealGetInput = z.object({ workspaceId: z.string(), dealId: z.string() });
const dealGet: AnyCapabilityDefinition = {
  ...base, id: 'deal.get', name: 'Get deal', description: 'Reads a deal', domain: 'deals_revenue', operation: 'read',
  inputSchema: DealGetInput, outputSchema: z.object({ id: z.string(), stageId: z.string() }).loose(),
  permissions: ['sales:pipeline:view', 'app:deals_view', 'deal:read'],
  risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec, policies,
  handler: async (input) => {
    const { dealId, workspaceId } = DealGetInput.parse(input);
    const deal = db.read(`deals/${dealId}`);
    if (!deal || deal.workspaceId !== workspaceId) return { success: false, error: { code: 'NOT_FOUND', message: 'Deal not found', stateChanged: 'no', retryable: false }, executionId: 'e', emittedEvents: [], durationMs: 1 };
    return ok({ id: dealId, stageId: String(deal.stageId) });
  },
};
const AdvanceInput = z.object({ workspaceId: z.string(), dealId: z.string(), stageId: z.string(), reason: z.string().optional() });
const dealAdvance: AnyCapabilityDefinition = {
  ...base, id: 'deal.advance_stage', name: 'Advance stage', description: 'Moves a deal', domain: 'deals_revenue', operation: 'update',
  inputSchema: AdvanceInput, outputSchema: z.object({ dealId: z.string(), stageId: z.string() }).loose(),
  permissions: ['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update'],
  risk: { level: 'L2_STATE_MUTATION', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
  execution: exec, policies,
  handler: async (input) => {
    const { dealId, stageId } = AdvanceInput.parse(input);
    db.write(`deals/${dealId}`, { ...db.read(`deals/${dealId}`), stageId });
    return ok({ dealId, stageId });
  },
};
const registry = new Map([dealGet, dealAdvance].map((c) => [c.id, c]));

const human = (uid: string, scopes: string[]): AgentPrincipal => ({ actorType: 'user', userId: uid, organizationId: 'org-1', workspaceId: 'ws-a', grantedScopes: scopes, effectiveRole: 'member' });
const people: Record<string, AgentPrincipal> = {
  'rep-1': human('rep-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'rbac:operations.meetings.edit']),
  'admin-1': human('admin-1', ['rbac:operations.pipeline.view', 'rbac:operations.pipeline.edit', 'agent_approvals_decide']),
};

let bridge: CrmProposalBridge;
const deps = (): MeetingCrmProposalDeps => ({
  nowMs,
  propose: (input) => bridge.proposeAction(input),
  approvalState: async (approvalId, organizationId) => {
    const stored = await getApproval(fs(), approvalId, organizationId);
    return stored?.kind === 'v2' ? { status: stored.record.status, executable: stored.record.executable } : null;
  },
});

const header: IntelligenceHeaderV2 = {
  schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
  promptVersion: 'v', promptHash: 'h', summary: null,
  counts: { kept: 2, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
  coverage: 1, truncated: false, version: 2, generatedAt: NOW, updatedAt: NOW,
};
const item = (hash: string, type: MeetingItem['type'], needsReview = false): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text: 'They agreed to move to the proposal stage', confidence: 0.9,
  evidence: [{ segmentIds: ['s7'], quote: 'move this to proposal review' }], contradicts: [], needsReview,
  reviewReasons: needsReview ? ['low_confidence'] : [], status: 'valid', promptVersion: 'v', createdAt: NOW,
});

const params = (over: Partial<Parameters<typeof proposeMeetingCrmUpdate>[2]> = {}): Parameters<typeof proposeMeetingCrmUpdate>[2] => ({
  workspaceId: 'ws-a', organizationId: 'org-1', meetingId: 'm-1', meetingTitle: 'Renewal review', itemHash: 'it_dec', actorUid: 'rep-1',
  target: { kind: 'deal_stage', dealId: 'd-1', stageId: 'proposal_review' },
  ...over,
});
const approve = (approvalId: string, uid = 'admin-1') => decideApproval(fs(), {
  approvalId, organizationId: 'org-1', decision: 'approved', nowMs: nowMs(),
  actor: { uid, isSystemAdmin: false, workspaceIds: ['ws-a'], permissions: ['agent_approvals_decide'] },
});
const execute = (proposalId: string) => bridge.executeApprovedProposal({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'admin-1', proposalId });

beforeEach(async () => {
  db = new FakeFirestore();
  db.write('deals/d-1', { workspaceId: 'ws-a', stageId: 'discovery' });
  await writeIntelligenceV2(fs(), header, [item('it_dec', 'decision'), item('it_rev', 'decision', true)]);
  bridge = new CrmProposalBridge({
    db: fs(),
    lookup: (id) => registry.get(id),
    loadPrincipal: async ({ uid }) => people[uid] ?? null,
    flags: { getFlagRecord: async (id) => (id === CRM_PROPOSAL_EXECUTION_FLAG ? { capabilityId: id, workspaceOverrides: { 'ws-a': { enabled: true } } } : null) },
    gatewayDeps: {
      registryLookup: (id) => registry.get(id),
      approvals: createUnifiedApprovalVerifier(fs()),
      idempotencyStore: createInMemoryIdempotencyStore(),
      flagChecker: { checkFlag: async () => ({ enabled: true }) },
      verifyActorStanding: async () => ({ active: true }),
      auditSink: () => undefined,
      outboxSink: () => undefined,
    },
    nowMs,
  });
});

describe('proposeMeetingCrmUpdate (M2 · T4.3)', () => {
  it('proposes a deal-stage change bound to the checked item, with its quote, for 24 hours', async () => {
    const result = await proposeMeetingCrmUpdate(fs(), deps(), params());

    expect(result).toMatchObject({ replayed: false, executable: true });
    const stored = await getApproval(fs(), result.proposalId, 'org-1');
    expect(stored?.kind).toBe('v2');
    if (stored?.kind !== 'v2') return;
    expect(stored.record).toMatchObject({
      capabilityId: 'deal.advance_stage', status: 'pending', executable: true,
      payload: { workspaceId: 'ws-a', dealId: 'd-1', stageId: 'proposal_review' },
      beforeState: { stageId: 'discovery' },
      evidence: { origin: 'meeting', meetingId: 'm-1', itemHash: 'it_dec', runId: 'mir_1', transcriptId: 't-1', intelligenceVersion: 2 },
    });
    expect(stored.record.why).toContain('move this to proposal review');
    expect(Date.parse(stored.record.expiresAt) - nowMs()).toBe(24 * 3600 * 1000);
  });

  it('a retry after a lost response returns the same proposal', async () => {
    const first = await proposeMeetingCrmUpdate(fs(), deps(), params());
    const again = await proposeMeetingCrmUpdate(fs(), deps(), params());
    expect(again).toEqual({ ...first, replayed: true });
  });

  it('the proposer can never approve it', async () => {
    const { proposalId } = await proposeMeetingCrmUpdate(fs(), deps(), params());
    const self = await approve(proposalId, 'rep-1');
    expect(self.ok).toBe(false);
  });

  it('approved → applied, verified, and can be rolled back', async () => {
    const { proposalId } = await proposeMeetingCrmUpdate(fs(), deps(), params());
    await approve(proposalId);
    const executed = await execute(proposalId);
    expect(executed.status).toBe('executed');
    expect(db.read('deals/d-1')?.stageId).toBe('proposal_review');

    await bridge.rollbackAction({ organizationId: 'org-1', workspaceId: 'ws-a', callerId: 'admin-1', proposalId, reason: 'Customer asked to wait' });
    expect(db.read('deals/d-1')?.stageId).toBe('discovery');
  });

  it('a record changed since the proposal must be proposed again', async () => {
    const { proposalId } = await proposeMeetingCrmUpdate(fs(), deps(), params());
    await approve(proposalId);
    db.write('deals/d-1', { workspaceId: 'ws-a', stageId: 'won' });
    await expect(execute(proposalId)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(db.read('deals/d-1')?.stageId).toBe('won');
  });

  it('re-analysing the meeting invalidates an approved proposal; a new one can be made', async () => {
    const { proposalId } = await proposeMeetingCrmUpdate(fs(), deps(), params());
    await approve(proposalId);
    await writeIntelligenceV2(fs(), { ...header, runId: 'mir_2', version: 3 }, [item('it_dec', 'decision')]);

    await expect(execute(proposalId)).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
    expect(db.read('deals/d-1')?.stageId).toBe('discovery');
    const fresh = await proposeMeetingCrmUpdate(fs(), deps(), params());
    expect(fresh.proposalId).not.toBe(proposalId);
    expect(fresh.replayed).toBe(false);
  });

  it('refuses items that need review, unknown items, other workspaces and a stale review', async () => {
    await expect(proposeMeetingCrmUpdate(fs(), deps(), params({ itemHash: 'it_rev' }))).rejects.toMatchObject({ code: 'ITEM_NEEDS_REVIEW' });
    await expect(proposeMeetingCrmUpdate(fs(), deps(), params({ itemHash: 'it_zz' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(proposeMeetingCrmUpdate(fs(), deps(), params({ workspaceId: 'ws-b' }))).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(proposeMeetingCrmUpdate(fs(), deps(), params({ expectedVersion: 1 }))).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('tags and notes are recommendations only (approvable, never executed)', async () => {
    const tags = await proposeMeetingCrmUpdate(fs(), deps(), params({ target: { kind: 'entity_tags', entityId: 'ent-1', tagIds: ['tag_renewal'] } }));
    const note = await proposeMeetingCrmUpdate(fs(), deps(), params({ target: { kind: 'entity_note', entityId: 'ent-1', content: 'Customer wants a revised quote.' } }));
    expect(tags.executable).toBe(false);
    expect(note.executable).toBe(false);
    await approve(note.proposalId);
    await expect(execute(note.proposalId)).rejects.toMatchObject({ code: 'NOT_EXECUTABLE' });
  });

  it('amounts and owners can never be proposed (D17)', () => {
    expect(MeetingCrmTargetSchema.safeParse({ kind: 'deal_value', dealId: 'd-1', value: 1 }).success).toBe(false);
    expect(MeetingCrmTargetSchema.safeParse({ kind: 'deal_owner', dealId: 'd-1', userId: 'u' }).success).toBe(false);
  });
});
