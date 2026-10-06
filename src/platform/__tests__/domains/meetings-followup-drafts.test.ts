// @vitest-environment node
/**
 * @fileOverview meeting.draft_followup / meeting.delete_followup_draft through the gateway
 * (Phase 11 M2 · T4.2, T4.4). Contract suites; recipients from participants + linked-record contacts
 * (real loader); outside recipient refused; sensitive draft blocked; agents need an explicit flag
 * and AI use allowed; output labelled untrusted; soft delete; cross-workspace NOT_FOUND.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/meetings/intelligence/intelligence-model', () => ({ createFollowupDraftModel: () => null, createIntelligenceModel: () => null }));
vi.mock('@/lib/contact-adapter', () => ({ resolveContact: vi.fn(async () => null) }));

import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  MEETINGS_CONVERSATIONS_CAPABILITIES,
  meetingDeleteFollowupDraftCapability,
  meetingDraftFollowupCapability,
  setFollowupDraftDepsForTests,
  type MeetingDraftFollowupOutput,
} from '../../domains/meetings_conversations';
import { PIPELINE_ID, writeIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import { loadMeetingRecipients } from '@/lib/meetings/intelligence/followup-recipients';
import { FOLLOWUP_DRAFTS } from '@/lib/meetings/intelligence/followup-drafts';
import { createEgressDataPolicyEngine } from '../../mcp/security/egress-data-policy';
import { createEventBus } from '../../events/event-bus';
import { delegatedAgentPrincipal } from '../../capabilities/policy/live-user-principal';
import { MEETING_TOOL_MATRIX } from '../../agents/meetings/personas/meeting-agent-matrix';

const db = new FakeFirestore();
h.db = db;
const NOW = '2026-10-07T12:00:00.000Z';
let modelText: string;
let modelCalls: number;

async function seed(): Promise<void> {
  db.docs.clear();
  modelCalls = 0;
  modelText = 'We will send the revised quote by Friday.';
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: NOW, updatedAt: 'v1', entityId: 'ent-1' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], title: 'Other tenant', meetingTime: NOW });
  db.write('participants/p-1', { meetingId: 'm-1', name: 'Ama', email: 'Ama@Customer.test' });
  db.write('participants/p-2', { meetingId: 'm-1', name: 'No email', email: '' });
  db.write('meeting_transcripts/t-1', {
    workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'completed', version: 1, schemaVersion: 2, dataClass: 'personal',
    aiUse: 'allowed', provenance: { createdBy: 'u', principalKind: 'user' }, createdAt: NOW, updatedAt: NOW,
  });
  await writeIntelligenceV2(db.asFirestore(), {
    schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
    promptVersion: 'v', promptHash: 'h', summary: null,
    counts: { kept: 1, needsReview: 0, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
    coverage: 1, truncated: false, version: 0, generatedAt: NOW, updatedAt: NOW,
  }, [{
    workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: 'it_a', type: 'commitment', text: 'Send the revised quote by Friday',
    confidence: 0.9, evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview: false,
    reviewReasons: [], status: 'valid', promptVersion: 'v', createdAt: NOW,
  }]);
  db.write(`${FOLLOWUP_DRAFTS}/d-seeded`, {
    draftId: 'd-seeded', requestKey: 'k', workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', intelligenceVersion: 0,
    status: 'draft', version: 1, recipients: ['ama@customer.test'], subject: 'Hi', sentences: [{ text: 'x', itemHashes: ['it_a'] }],
    body: 'x', sourceItemHashes: ['it_a'], droppedSentences: 0, provider: { modelId: 'm', promptVersion: 'mi_followup_v1' },
    createdBy: 'u-1', createdAt: NOW,
  });
  setFollowupDraftDepsForTests(() => ({
    nowMs: () => Date.parse(NOW),
    model: {
      breakerKey: 'test',
      draft: async () => {
        modelCalls += 1;
        return { output: { subject: 'Next steps', sentences: [{ text: modelText, itemIds: ['it_a'] }] }, modelId: 'pro-test' };
      },
    },
    // The real loader: participants + linked-record contacts.
    loadAllowedRecipients: (params) => loadMeetingRecipients(db.asFirestore(), params, {
      resolveContacts: async (entityId) => (entityId === 'ent-1' ? [{ email: 'kofi@customer.test', name: 'Kofi' }, { email: null, name: 'Phone only' }] : []),
    }),
    egress: (payload, tenant) => createEgressDataPolicyEngine({ eventBus: createEventBus() }).evaluateEgress(payload, 'external_email', tenant, { allowedSensitivityCeiling: 'confidential' }),
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

const run = <T = unknown>(cap: AnyCapabilityDefinition, input: unknown, principal: AgentPrincipal = editor, flagsOn = false) =>
  executeCapability<T>(
    { capabilityId: cap.id, surface: principal.actorType === 'agent' ? 'agent' : 'ui', input, correlationId: 'c-1', principal },
    {
      registryLookup: (id) => (id === cap.id ? cap : undefined), auditSink: () => undefined, outboxSink: () => undefined,
      ...(flagsOn ? { flagChecker: { checkFlag: async () => ({ enabled: true }) } } : {}),
    }
  );

const draftCap = meetingDraftFollowupCapability as AnyCapabilityDefinition;
const deleteCap = meetingDeleteFollowupDraftCapability as AnyCapabilityDefinition;
const draftInput = { workspaceId: 'ws-a', meetingId: 'm-1', recipients: ['ama@customer.test', 'Kofi@customer.test'] };

beforeEach(seed);
afterAll(() => setFollowupDraftDepsForTests(null));

defineContractSuite({
  capability: meetingDraftFollowupCapability,
  validInput: draftInput,
  invalidInput: { workspaceId: 'ws-a', meetingId: 'm-1', recipients: ['not-an-email'] },
  authorizedPrincipal: editor,
  unauthorizedPrincipal: viewer,
  foreignWorkspacePrincipal: foreign,
});
defineContractSuite({
  capability: meetingDeleteFollowupDraftCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-1', draftId: 'd-seeded' },
  invalidInput: { workspaceId: 'ws-a', meetingId: 'm-1' },
  authorizedPrincipal: editor,
  unauthorizedPrincipal: viewer,
  foreignWorkspacePrincipal: foreign,
});

describe('meeting follow-up draft capabilities (M2 · T4.2)', () => {
  it('are registered and in the Meeting Analyst matrix; the prep persona has neither', () => {
    const ids = MEETINGS_CONVERSATIONS_CAPABILITIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['meeting.draft_followup', 'meeting.delete_followup_draft']));
    expect(MEETING_TOOL_MATRIX.meeting_analyst.map((e) => e.capabilityId)).toEqual(expect.arrayContaining(['meeting.draft_followup', 'meeting.delete_followup_draft']));
    expect(MEETING_TOOL_MATRIX.meeting_prep.map((e) => e.capabilityId)).not.toContain('meeting.draft_followup');
    expect(meetingDraftFollowupCapability.risk.openWorld).toBe(false);
  });

  it('a participant and a contact of the linked record can receive it; asking again returns the same draft', async () => {
    const first = await run<MeetingDraftFollowupOutput>(draftCap, draftInput);
    const again = await run<MeetingDraftFollowupOutput>(draftCap, { ...draftInput, recipients: ['kofi@customer.test', 'ama@customer.test'] });

    expect(first.success && first.data).toMatchObject({
      trust: 'model_generated_from_customer_content', replayed: false,
      recipients: ['ama@customer.test', 'kofi@customer.test'], subject: 'Next steps', body: 'We will send the revised quote by Friday.',
    });
    expect(again.success && again.data).toMatchObject({ replayed: true });
    expect(first.success && again.success && again.data.draftId).toBe(first.success ? first.data.draftId : '');
    expect(modelCalls).toBe(1);
  });

  it('refuses anyone who is not a participant or a contact of the linked record', async () => {
    const res = await run(draftCap, { ...draftInput, recipients: ['ama@customer.test', 'yaw@competitor.test'] });
    expect(!res.success && res.error).toMatchObject({ code: 'FORBIDDEN', message: expect.stringContaining('yaw@competitor.test') });
    expect(modelCalls).toBe(0);
  });

  it('blocks a draft that carries sensitive data and stores nothing', async () => {
    modelText = 'Your card 4111111111111111 will be charged for the quote.';
    const res = await run(draftCap, draftInput);
    expect(!res.success && res.error.code).toBe('FORBIDDEN');
    expect([...db.docs.keys()].filter((k) => k.startsWith(`${FOLLOWUP_DRAFTS}/`))).toEqual([`${FOLLOWUP_DRAFTS}/d-seeded`]);
  });

  it('agents need an explicit flag, and AI use allowed', async () => {
    const off = await run(draftCap, draftInput, analyst);
    expect(!off.success && off.error.message).toMatch(/explicit enablement/);

    await db.asFirestore().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'restricted' });
    const restricted = await run(draftCap, draftInput, analyst, true);
    expect(!restricted.success && restricted.error.code).toBe('FORBIDDEN');
    expect(modelCalls).toBe(0);
  });

  it('delete is a soft delete; deleting again reports nothing deleted; another workspace is NOT_FOUND', async () => {
    const created = await run<MeetingDraftFollowupOutput>(draftCap, draftInput);
    const draftId = created.success ? created.data.draftId : '';

    const first = await run(deleteCap, { workspaceId: 'ws-a', meetingId: 'm-1', draftId });
    const second = await run(deleteCap, { workspaceId: 'ws-a', meetingId: 'm-1', draftId });
    expect(first.success && first.data).toEqual({ deleted: true });
    expect(second.success && second.data).toEqual({ deleted: false });
    expect(db.read(`${FOLLOWUP_DRAFTS}/${draftId}`)).toMatchObject({ status: 'deleted', deletedBy: 'u-1' });

    const foreignMeeting = await run(draftCap, { ...draftInput, meetingId: 'm-b' });
    expect(!foreignMeeting.success && foreignMeeting.error.code).toBe('NOT_FOUND');
  });
});
