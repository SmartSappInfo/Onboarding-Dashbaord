// @vitest-environment node
/**
 * @fileOverview Follow-up drafts from meeting outcomes (Phase 11 M2 · T4.2; plan §4.7, §4.11, §7.2).
 *
 * Drafts use checked items only and keep only cited sentences; recipients are restricted to
 * meeting participants and the linked record's contacts; another person's email address never
 * reaches the draft; the egress scan blocks credentials / financial / personal identifiers; AI use
 * and consent stops apply; asking again returns the same draft; drafts are never edited in place
 * and deletion is a soft delete. Nothing here sends anything.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import type { MeetingItem } from '../intelligence/intelligence-schemas';
import { PIPELINE_ID, writeIntelligenceV2, type IntelligenceHeaderV2 } from '../intelligence/intelligence-store';
import { createEgressDataPolicyEngine } from '@/platform/mcp/security/egress-data-policy';
import { createEventBus } from '@/platform/events/event-bus';
import {
  FOLLOWUP_DRAFTS,
  deleteFollowupDraft,
  generateFollowupDraft,
  readFollowupDraft,
  type FollowupDraftDeps,
} from '../intelligence/followup-drafts';

let db: FakeFirestore;
let modelCalls: string[];
let modelOutput: unknown;
const fs = () => db.asFirestore();
const NOW = '2026-10-07T12:00:00.000Z';

const header: IntelligenceHeaderV2 = {
  schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
  promptVersion: 'v', promptHash: 'h', summary: null,
  counts: { kept: 3, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
  coverage: 1, truncated: false, version: 4, generatedAt: NOW, updatedAt: NOW,
};
const item = (hash: string, type: MeetingItem['type'], text: string, needsReview = false): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text, confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview,
  reviewReasons: needsReview ? ['low_confidence'] : [], status: 'valid', promptVersion: 'v', createdAt: NOW,
});

const deps = (): FollowupDraftDeps => ({
  nowMs: () => Date.parse(NOW),
  model: {
    breakerKey: 'test',
    draft: async (request) => {
      modelCalls.push(request.prompt);
      return { output: modelOutput, modelId: 'pro-test' };
    },
  },
  loadAllowedRecipients: async () => [
    { email: 'ama@customer.test', name: 'Ama' },
    { email: 'kofi@customer.test', name: 'Kofi' },
  ],
  egress: async (payload, tenant) => createEgressDataPolicyEngine({ eventBus: createEventBus() })
    .evaluateEgress(payload, 'external_email', tenant, { allowedSensitivityCeiling: 'confidential' }),
});
const base = { workspaceId: 'ws-a', organizationId: 'org-1', meetingId: 'm-1', meetingTitle: 'Renewal review', actorUid: 'u-1', recipients: ['Ama@Customer.test'] };

beforeEach(async () => {
  db = new FakeFirestore();
  modelCalls = [];
  modelOutput = {
    subject: 'Next steps from our renewal review',
    sentences: [
      { text: 'We will send the revised quote by Friday.', itemIds: ['it_a'] },
      { text: 'You agreed to confirm the seat count.', itemIds: ['it_b'] },
      { text: 'We also discussed lunch.', itemIds: [] },
      { text: 'Pricing is final.', itemIds: ['it_unknown'] },
    ],
  };
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: NOW });
  db.write('meeting_transcripts/t-1', {
    workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'completed', version: 1, schemaVersion: 2, dataClass: 'personal',
    aiUse: 'allowed', provenance: { createdBy: 'u', principalKind: 'user' }, createdAt: NOW, updatedAt: NOW,
  });
  await writeIntelligenceV2(fs(), header, [
    item('it_a', 'commitment', 'Send the revised quote by Friday'),
    item('it_b', 'action_item', 'Customer confirms the seat count'),
    item('it_r', 'risk', 'Budget may be cut', true),
  ]);
});

describe('generateFollowupDraft', () => {
  it('writes a draft from checked items only and keeps only cited sentences', async () => {
    const result = await generateFollowupDraft(fs(), deps(), base);

    expect(result.replayed).toBe(false);
    expect(modelCalls).toHaveLength(1);
    expect(modelCalls[0]).toContain('[it_a]');
    expect(modelCalls[0]).not.toContain('it_r');
    expect(result.draft).toMatchObject({
      workspaceId: 'ws-a', meetingId: 'm-1', intelligenceVersion: 4, status: 'draft', version: 1,
      recipients: ['ama@customer.test'],
      subject: 'Next steps from our renewal review',
      body: 'We will send the revised quote by Friday. You agreed to confirm the seat count.',
      sourceItemHashes: ['it_a', 'it_b'],
      droppedSentences: 2,
      provider: { modelId: 'pro-test', promptVersion: 'mi_followup_v1' },
      createdBy: 'u-1',
    });
    expect(db.read(`${FOLLOWUP_DRAFTS}/${result.draftId}`)).toBeDefined();
  });

  it('asking again returns the same draft without another model call', async () => {
    const first = await generateFollowupDraft(fs(), deps(), base);
    const again = await generateFollowupDraft(fs(), deps(), { ...base, recipients: ['ama@customer.test'] });
    expect(again).toMatchObject({ draftId: first.draftId, replayed: true });
    expect(modelCalls).toHaveLength(1);
  });

  it('refuses a recipient who is not a participant or a contact of the linked record', async () => {
    await expect(generateFollowupDraft(fs(), deps(), { ...base, recipients: ['ama@customer.test', 'stranger@other.test'] }))
      .rejects.toMatchObject({ code: 'RECIPIENT_NOT_ALLOWED', message: expect.stringContaining('stranger@other.test') });
    expect(modelCalls).toEqual([]);
  });

  it("removes sentences naming someone else's email address", async () => {
    modelOutput = {
      subject: 'Follow-up',
      sentences: [
        { text: 'We will send the revised quote by Friday.', itemIds: ['it_a'] },
        { text: 'Please also loop in yaw@competitor.test about the seat count.', itemIds: ['it_b'] },
      ],
    };
    const result = await generateFollowupDraft(fs(), deps(), base);
    expect(result.draft.body).toBe('We will send the revised quote by Friday.');
    expect(result.draft.body).not.toContain('yaw@');
  });

  it('blocks a draft the egress scan finds sensitive data in, and stores nothing', async () => {
    modelOutput = { subject: 'Follow-up', sentences: [{ text: 'Card 4111111111111111 is on file for the quote.', itemIds: ['it_a'] }] };
    await expect(generateFollowupDraft(fs(), deps(), base)).rejects.toMatchObject({ code: 'EGRESS_BLOCKED' });
    expect([...db.docs.keys()].some((k) => k.startsWith(`${FOLLOWUP_DRAFTS}/`))).toBe(false);
  });

  it('refuses when nothing cited survives', async () => {
    modelOutput = { subject: 'x', sentences: [{ text: 'Thanks for your time.', itemIds: [] }] };
    await expect(generateFollowupDraft(fs(), deps(), base)).rejects.toMatchObject({ code: 'NOTHING_TO_DRAFT' });
  });

  it('stops when AI use is restricted for the transcript', async () => {
    await fs().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'restricted' });
    await expect(generateFollowupDraft(fs(), deps(), base)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(modelCalls).toEqual([]);
  });

  it('refuses when the analysis changed since the person reviewed it', async () => {
    await expect(generateFollowupDraft(fs(), deps(), { ...base, expectedVersion: 3 })).rejects.toMatchObject({ code: 'VERSION_CONFLICT' });
  });

  it('another workspace sees no analysis', async () => {
    await expect(generateFollowupDraft(fs(), deps(), { ...base, workspaceId: 'ws-b' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('readFollowupDraft / deleteFollowupDraft', () => {
  it('reads a draft only in its own workspace; delete is a soft delete and idempotent', async () => {
    const { draftId } = await generateFollowupDraft(fs(), deps(), base);

    expect((await readFollowupDraft(fs(), 'ws-a', draftId))?.subject).toBe('Next steps from our renewal review');
    expect(await readFollowupDraft(fs(), 'ws-b', draftId)).toBeNull();

    expect(await deleteFollowupDraft(fs(), { workspaceId: 'ws-a', draftId, actorUid: 'u-2', nowMs: Date.parse(NOW) })).toEqual({ deleted: true });
    expect(await deleteFollowupDraft(fs(), { workspaceId: 'ws-a', draftId, actorUid: 'u-2', nowMs: Date.parse(NOW) })).toEqual({ deleted: false });
    expect(await readFollowupDraft(fs(), 'ws-a', draftId)).toBeNull();
    expect(db.read(`${FOLLOWUP_DRAFTS}/${draftId}`)).toMatchObject({ status: 'deleted', deletedBy: 'u-2' });
    await expect(deleteFollowupDraft(fs(), { workspaceId: 'ws-b', draftId, actorUid: 'u-2', nowMs: Date.parse(NOW) })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('a new request after delete writes a fresh draft', async () => {
    const { draftId } = await generateFollowupDraft(fs(), deps(), base);
    await deleteFollowupDraft(fs(), { workspaceId: 'ws-a', draftId, actorUid: 'u-1', nowMs: Date.parse(NOW) });
    const again = await generateFollowupDraft(fs(), deps(), base);
    expect(again.replayed).toBe(false);
    expect(again.draft.status).toBe('draft');
    expect(modelCalls).toHaveLength(2);
  });
});
