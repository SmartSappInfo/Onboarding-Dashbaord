// @vitest-environment node
/**
 * @fileOverview meeting.extract_intelligence / summarize / get_intelligence through the gateway
 * (Phase 11 M2 · T3.2). Contract suites; idempotent start; agents need an explicit flag; agents also
 * need AI use allowed to read analysis; summary version conflicts; output labelled untrusted.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown, scheduled: [] as string[] }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/gcp-tasks-client', () => ({
  scheduleTaskWithKey: async (key: string) => {
    h.scheduled.push(key);
  },
}));
vi.mock('@/lib/meetings/intelligence/intelligence-model', () => ({ createIntelligenceModel: () => null }));

import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  MEETINGS_CONVERSATIONS_CAPABILITIES,
  meetingExtractIntelligenceCapability,
  meetingGetIntelligenceCapability,
  meetingSummarizeCapability,
  setIntelligenceModelForTests,
  type MeetingExtractIntelligenceOutput,
  type MeetingGetIntelligenceOutput,
} from '../../domains/meetings_conversations';
import { PIPELINE_ID, writeIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import { MEETING_TOOL_MATRIX } from '../../agents/meetings/personas/meeting-agent-matrix';

const db = new FakeFirestore();
h.db = db;
const NOW = '2026-10-07T12:00:00.000Z';

async function seed(): Promise<void> {
  db.docs.clear();
  h.scheduled.length = 0;
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: '2026-10-07T10:00:00.000Z', updatedAt: 'v1' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], title: 'Other tenant', meetingTime: '2026-10-07T10:00:00.000Z' });
  db.write('meeting_transcripts/t-1', {
    workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'completed', version: 1, schemaVersion: 2, dataClass: 'personal',
    aiUse: 'allowed', provenance: { createdBy: 'u', principalKind: 'user' }, createdAt: NOW, updatedAt: NOW,
  });
}

async function seedAnalysis(): Promise<void> {
  await writeIntelligenceV2(db.asFirestore(), {
    schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
    promptVersion: 'mi_extract_v1', promptHash: 'h', summary: null,
    counts: { kept: 1, needsReview: 0, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
    coverage: 1, truncated: false, version: 0, generatedAt: NOW, updatedAt: NOW,
  }, [{
    workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: 'it_a', type: 'commitment', text: 'Send the revised quote',
    confidence: 0.9, evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview: false,
    reviewReasons: [], status: 'valid', promptVersion: 'mi_extract_v1', createdAt: NOW,
  }]);
}

const editor: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a',
  grantedScopes: ['rbac:operations.meetings.view', 'rbac:operations.meetings.edit'], effectiveRole: 'member',
};
const viewer: AgentPrincipal = { ...editor, grantedScopes: ['rbac:operations.meetings.view'] };
const noScope: AgentPrincipal = { ...editor, grantedScopes: ['rbac:operations.tasks.view'] };
const foreign: AgentPrincipal = { ...editor, workspaceId: 'ws-b', organizationId: 'org-2' };
const agent: AgentPrincipal = { ...editor, actorType: 'agent', agentId: 'meeting_analyst' };

const run = <T = unknown>(cap: AnyCapabilityDefinition, input: unknown, principal: AgentPrincipal = editor, flagsOn = false) =>
  executeCapability<T>(
    { capabilityId: cap.id, surface: principal.actorType === 'agent' ? 'agent' : 'ui', input, correlationId: 'c-1', principal },
    {
      registryLookup: (id) => (id === cap.id ? cap : undefined), auditSink: () => undefined, outboxSink: () => undefined,
      ...(flagsOn ? { flagChecker: { checkFlag: async () => ({ enabled: true }) } } : {}),
    }
  );

const extractCap = meetingExtractIntelligenceCapability as AnyCapabilityDefinition;
const getCap = meetingGetIntelligenceCapability as AnyCapabilityDefinition;
const summarizeCap = meetingSummarizeCapability as AnyCapabilityDefinition;

beforeEach(seed);
afterAll(() => setIntelligenceModelForTests(null));

defineContractSuite({
  capability: meetingExtractIntelligenceCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-1', dryRun: true },
  invalidInput: { workspaceId: 'ws-a', meetingId: 'a/b' },
  authorizedPrincipal: editor,
  unauthorizedPrincipal: viewer,
  foreignWorkspacePrincipal: foreign,
});
defineContractSuite({
  capability: meetingGetIntelligenceCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-1' },
  invalidInput: { workspaceId: 'ws-a' },
  authorizedPrincipal: viewer,
  unauthorizedPrincipal: noScope,
  foreignWorkspacePrincipal: foreign,
});

describe('meeting intelligence capabilities', () => {
  it('are registered, risk-classified and in the Meeting Agent matrix as planned (§7.1)', () => {
    const ids = MEETINGS_CONVERSATIONS_CAPABILITIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['meeting.extract_intelligence', 'meeting.summarize', 'meeting.get_intelligence']));
    const tools = (p: 'meeting_prep' | 'meeting_analyst') => MEETING_TOOL_MATRIX[p].map((e) => e.capabilityId);
    expect(tools('meeting_prep')).toContain('meeting.get_intelligence');
    expect(tools('meeting_prep')).not.toContain('meeting.extract_intelligence');
    expect(tools('meeting_analyst')).toEqual(expect.arrayContaining(['meeting.extract_intelligence', 'meeting.summarize', 'meeting.get_intelligence']));
  });

  it('a person starts analysis once; asking again returns the same run', async () => {
    const first = await run(extractCap, { workspaceId: 'ws-a', meetingId: 'm-1' });
    const second = await run(extractCap, { workspaceId: 'ws-a', meetingId: 'm-1' });
    expect(first.success && first.data).toMatchObject({ status: 'pending', replayed: false, transcriptId: 't-1' });
    expect(second.success && second.data).toMatchObject({ replayed: true });
    expect(h.scheduled).toHaveLength(1);
  });

  it('dry run checks everything and writes nothing', async () => {
    const res = await run<MeetingExtractIntelligenceOutput>(extractCap, { workspaceId: 'ws-a', meetingId: 'm-1', dryRun: true });
    expect(res.success && res.data.status).toBe('eligible');
    expect(h.scheduled).toHaveLength(0);
  });

  it('agents are refused until explicitly enabled', async () => {
    const res = await run(extractCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, agent);
    expect(!res.success && res.error.message).toMatch(/explicit enablement/);
  });

  it('get_intelligence: nothing yet → not available; then items labelled as untrusted data', async () => {
    const empty = await run(getCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, viewer);
    expect(empty.success && empty.data).toMatchObject({ available: false, items: [], header: null });
    await seedAnalysis();
    const res = await run<MeetingGetIntelligenceOutput>(getCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, viewer);
    expect(res.success && res.data.trust).toBe('model_generated_from_customer_content');
    expect(res.success && res.data.items.map((i) => i.itemHash)).toEqual(['it_a']);
  });

  it('get_intelligence: an enabled agent is still refused when AI use is restricted; people can read', async () => {
    await seedAnalysis();
    await db.asFirestore().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'restricted' });
    const asAgent = await run(getCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, agent, true);
    expect(!asAgent.success && asAgent.error.code).toBe('FORBIDDEN');
    expect((await run(getCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, viewer)).success).toBe(true);
  });

  it('summarize: cited summary saved; a stale version is refused; no model → retry later', async () => {
    await seedAnalysis();
    setIntelligenceModelForTests(() => ({
      breakerKey: 't',
      extract: async () => ({ output: null, modelId: 'x' }),
      summarize: async () => ({ output: { sentences: [{ text: 'Ama will send the quote.', itemIds: ['it_a'] }] }, modelId: 'pro' }),
    }));
    const ok = await run(summarizeCap, { workspaceId: 'ws-a', meetingId: 'm-1', expectedVersion: 0 });
    expect(ok.success && ok.data).toMatchObject({ version: 1, summary: { sentences: [{ itemHashes: ['it_a'] }] } });
    const stale = await run(summarizeCap, { workspaceId: 'ws-a', meetingId: 'm-1', expectedVersion: 0 });
    expect(!stale.success && stale.error.code).toBe('VERSION_CONFLICT');
    setIntelligenceModelForTests(() => null);
    const down = await run(summarizeCap, { workspaceId: 'ws-a', meetingId: 'm-1' });
    expect(!down.success && down.error).toMatchObject({ code: 'PROVIDER_ERROR', retryable: true });
  });

  it("another workspace's meeting is NOT_FOUND", async () => {
    const res = await run(getCap, { workspaceId: 'ws-a', meetingId: 'm-b' }, viewer);
    expect(!res.success && res.error.code).toBe('NOT_FOUND');
  });
});
