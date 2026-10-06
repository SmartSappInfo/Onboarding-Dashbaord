// @vitest-environment node
/**
 * @fileOverview meeting.propose_crm_update through the gateway (Phase 11 M2 · T4.3, T4.4).
 * Contract suite; the proposal is made for the person; the analyst may propose (explicit flag)
 * but the proposal still needs someone else's approval; amounts/owners rejected at the boundary;
 * review items refused; cross-workspace NOT_FOUND.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown, proposals: [] as Array<{ callerId: string; actionType: string; origin?: unknown }> }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));

import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  MEETINGS_CONVERSATIONS_CAPABILITIES,
  meetingProposeCrmUpdateCapability,
  setMeetingCrmProposalDepsForTests,
  type MeetingProposeCrmUpdateOutput,
} from '../../domains/meetings_conversations';
import { PIPELINE_ID, writeIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import { delegatedAgentPrincipal } from '../../capabilities/policy/live-user-principal';
import { MEETING_TOOL_MATRIX } from '../../agents/meetings/personas/meeting-agent-matrix';

const db = new FakeFirestore();
h.db = db;
const NOW = '2026-10-07T12:00:00.000Z';

async function seed(): Promise<void> {
  db.docs.clear();
  h.proposals.length = 0;
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: NOW, updatedAt: 'v1' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], title: 'Other tenant', meetingTime: NOW });
  await writeIntelligenceV2(db.asFirestore(), {
    schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
    promptVersion: 'v', promptHash: 'h', summary: null,
    counts: { kept: 1, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
    coverage: 1, truncated: false, version: 0, generatedAt: NOW, updatedAt: NOW,
  }, [
    { workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: 'it_dec', type: 'decision', text: 'Move to proposal review', confidence: 0.9,
      evidence: [{ segmentIds: ['s1'], quote: 'move this to proposal review' }], contradicts: [], needsReview: false, reviewReasons: [], status: 'valid', promptVersion: 'v', createdAt: NOW },
    { workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: 'it_rev', type: 'decision', text: 'Maybe close next week', confidence: 0.4,
      evidence: [{ segmentIds: ['s2'], quote: 'maybe close next week' }], contradicts: [], needsReview: true, reviewReasons: ['low_confidence'], status: 'valid', promptVersion: 'v', createdAt: NOW },
  ]);
  setMeetingCrmProposalDepsForTests(() => ({
    nowMs: () => Date.parse(NOW),
    propose: async (input) => {
      h.proposals.push({ callerId: input.callerId, actionType: input.action.actionType, origin: input.origin });
      return { proposalId: `appr_${h.proposals.length}` };
    },
    approvalState: async () => ({ status: 'pending', executable: true }),
  }));
}

const editor: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a', effectiveRole: 'member',
  grantedScopes: ['rbac:operations.meetings.view', 'rbac:operations.meetings.edit', 'rbac:operations.tasks.create'],
};
const viewer: AgentPrincipal = { ...editor, grantedScopes: ['rbac:operations.meetings.view'] };
const foreign: AgentPrincipal = { ...editor, workspaceId: 'ws-b', organizationId: 'org-2' };
const delegated = delegatedAgentPrincipal(editor, 'meeting_analyst', { runId: 'run-1', toolInvocationId: 'call-1' });
if (!delegated) throw new Error('meeting_analyst persona missing');
const analyst: AgentPrincipal = delegated;

const run = <T = unknown>(input: unknown, principal: AgentPrincipal = editor, flagsOn = false) =>
  executeCapability<T>(
    { capabilityId: meetingProposeCrmUpdateCapability.id, surface: principal.actorType === 'agent' ? 'agent' : 'ui', input, correlationId: 'c-1', principal },
    {
      registryLookup: (id) => (id === meetingProposeCrmUpdateCapability.id ? (meetingProposeCrmUpdateCapability as AnyCapabilityDefinition) : undefined),
      auditSink: () => undefined, outboxSink: () => undefined,
      ...(flagsOn ? { flagChecker: { checkFlag: async () => ({ enabled: true }) } } : {}),
    }
  );
const stageInput = { workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_dec', target: { kind: 'deal_stage' as const, dealId: 'd-1', stageId: 'proposal_review' } };

beforeEach(seed);
afterAll(() => setMeetingCrmProposalDepsForTests(null));

defineContractSuite({
  capability: meetingProposeCrmUpdateCapability,
  validInput: stageInput,
  invalidInput: { ...stageInput, target: { kind: 'deal_value', dealId: 'd-1', value: 100 } },
  authorizedPrincipal: editor,
  unauthorizedPrincipal: viewer,
  foreignWorkspacePrincipal: foreign,
});

describe('meeting.propose_crm_update (M2 · T4.3)', () => {
  it('is registered and in the analyst matrix as a proposal (never autonomous change)', () => {
    expect(MEETINGS_CONVERSATIONS_CAPABILITIES.map((c) => c.id)).toContain('meeting.propose_crm_update');
    const entry = MEETING_TOOL_MATRIX.meeting_analyst.find((e) => e.capabilityId === 'meeting.propose_crm_update');
    expect(entry?.mode).toBe('proposal');
    expect(MEETING_TOOL_MATRIX.meeting_prep.map((e) => e.capabilityId)).not.toContain('meeting.propose_crm_update');
  });

  it('creates one proposal for the person, bound to the meeting outcome', async () => {
    const res = await run<MeetingProposeCrmUpdateOutput>(stageInput);
    expect(res.success && res.data).toEqual({ proposalId: 'appr_1', replayed: false, executable: true });
    expect(h.proposals).toEqual([{ callerId: 'u-1', actionType: 'UPDATE_STAGE', origin: expect.objectContaining({ origin: 'meeting', meetingId: 'm-1', itemHash: 'it_dec', runId: 'mir_1' }) }]);
  });

  it('agents need an explicit flag; with it, the analyst proposes on behalf of its person', async () => {
    const off = await run(stageInput, analyst);
    expect(!off.success && off.error.message).toMatch(/explicit enablement/);
    const on = await run<MeetingProposeCrmUpdateOutput>(stageInput, analyst, true);
    expect(on.success).toBe(true);
    // The proposer of record is the person, so the person cannot approve their agent's proposal either.
    expect(h.proposals[0]?.callerId).toBe('u-1');
  });

  it('refuses amounts and owners at the boundary, and items that need review', async () => {
    const owner = await run({ ...stageInput, target: { kind: 'deal_owner', dealId: 'd-1', userId: 'u-2' } });
    expect(!owner.success && owner.error.code).toBe('INVALID_INPUT');
    const review = await run({ ...stageInput, itemHash: 'it_rev' });
    expect(!review.success && review.error.code).toBe('VALIDATION');
    expect(h.proposals).toEqual([]);
  });

  it("another workspace's meeting is NOT_FOUND", async () => {
    const res = await run({ ...stageInput, meetingId: 'm-b' });
    expect(!res.success && res.error.code).toBe('NOT_FOUND');
  });
});
