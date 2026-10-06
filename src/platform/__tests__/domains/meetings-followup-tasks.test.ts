// @vitest-environment node
/**
 * @fileOverview meeting.create_followup_tasks / meeting.undo_followup_task through the gateway
 * (Phase 11 M2 · T4.1, T4.4). Contract suites; double click → one task; tasks created as the
 * requesting person; agents need an explicit flag and AI use allowed; re-analysis invalidates;
 * undo refused after an edit; agents (Meeting Analyst) can never undo; cross-workspace NOT_FOUND.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({
  db: undefined as unknown,
  taskActors: [] as Array<{ kind: string; uid?: string }>,
  canDelete: true,
  seq: 0,
}));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn(async (task: { workspaceId: string; title: string; relatedParentId?: string }, actor: { kind: string; uid?: string }) => {
    h.taskActors.push(actor);
    const id = `task-${++h.seq}`;
    const at = '2026-10-07T12:00:00.000Z';
    (h.db as FakeFirestore).write(`tasks/${id}`, { workspaceId: task.workspaceId, title: task.title, relatedParentId: task.relatedParentId, createdAt: at, updatedAt: at });
    return { success: true, id };
  }),
}));
vi.mock('@/lib/workspace-permissions', () => ({
  canUser: vi.fn(async () => (h.canDelete ? { granted: true } : { granted: false, reason: 'no' })),
}));

import { defineContractSuite } from '../contract/define-contract-suite';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AgentPrincipal, AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  MEETINGS_CONVERSATIONS_CAPABILITIES,
  meetingCreateFollowupTasksCapability,
  meetingUndoFollowupTaskCapability,
  type MeetingCreateFollowupTasksOutput,
  type MeetingUndoFollowupTaskOutput,
} from '../../domains/meetings_conversations';
import { PIPELINE_ID, writeIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';
import { delegatedAgentPrincipal } from '../../capabilities/policy/live-user-principal';
import { MEETING_ROLLBACK_MATRIX, MEETING_TOOL_MATRIX } from '../../agents/meetings/personas/meeting-agent-matrix';

const db = new FakeFirestore();
h.db = db;
const NOW = '2026-10-07T12:00:00.000Z';

const item = (hash: string, type: MeetingItem['type'], needsReview = false): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', itemHash: hash, type, text: `Do ${hash}`, confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview,
  reviewReasons: needsReview ? ['low_confidence'] : [], status: 'valid', promptVersion: 'v', createdAt: NOW,
});

async function seed(version = 2): Promise<void> {
  db.docs.clear();
  h.taskActors.length = 0;
  h.canDelete = true;
  h.seq = 0;
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Renewal review', meetingTime: NOW, updatedAt: 'v1' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], title: 'Other tenant', meetingTime: NOW });
  db.write('meeting_transcripts/t-1', {
    workspaceId: 'ws-a', meetingId: 'm-1', source: 'paste', status: 'completed', version: 1, schemaVersion: 2, dataClass: 'personal',
    aiUse: 'allowed', provenance: { createdBy: 'u', principalKind: 'user' }, createdAt: NOW, updatedAt: NOW,
  });
  await writeIntelligenceV2(db.asFirestore(), {
    schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
    promptVersion: 'v', promptHash: 'h', summary: null,
    counts: { kept: 3, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
    coverage: 1, truncated: false, version, generatedAt: NOW, updatedAt: NOW,
  }, [item('it_a', 'action_item'), item('it_b', 'commitment'), item('it_r', 'action_item', true), item('it_d', 'decision')]);
}

const editor: AgentPrincipal = {
  actorType: 'user', userId: 'u-1', organizationId: 'org-1', workspaceId: 'ws-a', effectiveRole: 'member',
  grantedScopes: ['rbac:operations.meetings.view', 'rbac:operations.meetings.edit', 'rbac:operations.tasks.create', 'rbac:operations.tasks.delete'],
};
const noTasks: AgentPrincipal = { ...editor, grantedScopes: ['rbac:operations.meetings.view', 'rbac:operations.meetings.edit'] };
const foreign: AgentPrincipal = { ...editor, workspaceId: 'ws-b', organizationId: 'org-2' };
// Built the way production builds an agent principal: the person's rights ∩ the persona's.
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

const createCap = meetingCreateFollowupTasksCapability as AnyCapabilityDefinition;
const undoCap = meetingUndoFollowupTaskCapability as AnyCapabilityDefinition;

beforeEach(() => seed());

defineContractSuite({
  capability: meetingCreateFollowupTasksCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-1', itemHashes: ['it_a'] },
  invalidInput: { workspaceId: 'ws-a', meetingId: 'm-1', itemHashes: [] },
  authorizedPrincipal: editor,
  unauthorizedPrincipal: noTasks,
  foreignWorkspacePrincipal: foreign,
});
defineContractSuite({
  capability: meetingUndoFollowupTaskCapability,
  validInput: { workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_a' },
  invalidInput: { workspaceId: 'ws-a', meetingId: 'm-1' },
  authorizedPrincipal: editor,
  unauthorizedPrincipal: noTasks,
  foreignWorkspacePrincipal: foreign,
});

describe('meeting follow-up task capabilities (M2 · T4.1)', () => {
  it('are registered; the analyst may create tasks but undo stays with people (§7.1, §7.4)', () => {
    const ids = MEETINGS_CONVERSATIONS_CAPABILITIES.map((c) => c.id);
    expect(ids).toEqual(expect.arrayContaining(['meeting.create_followup_tasks', 'meeting.undo_followup_task']));
    const analystTools = MEETING_TOOL_MATRIX.meeting_analyst.map((e) => e.capabilityId);
    expect(analystTools).toContain('meeting.create_followup_tasks');
    expect(analystTools).not.toContain('meeting.undo_followup_task');
    expect(MEETING_TOOL_MATRIX.meeting_prep.map((e) => e.capabilityId)).not.toContain('meeting.create_followup_tasks');
    expect(MEETING_ROLLBACK_MATRIX['meeting.create_followup_tasks']).toBeDefined();
  });

  it('a double click creates one task per item, created as the requesting person', async () => {
    const first = await run<MeetingCreateFollowupTasksOutput>(createCap, { workspaceId: 'ws-a', meetingId: 'm-1', expectedVersion: 2 });
    const second = await run<MeetingCreateFollowupTasksOutput>(createCap, { workspaceId: 'ws-a', meetingId: 'm-1', expectedVersion: 2 });

    expect(first.success && first.data.created.map((c) => c.itemHash)).toEqual(['it_a', 'it_b']);
    expect(second.success && second.data).toMatchObject({ created: [], existing: [{ itemHash: 'it_a' }, { itemHash: 'it_b' }] });
    expect(h.taskActors).toEqual([{ kind: 'user', uid: 'u-1' }, { kind: 'user', uid: 'u-1' }]);
  });

  it('a re-analysis since the review invalidates the call', async () => {
    const res = await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-1', expectedVersion: 1 });
    expect(!res.success && res.error.code).toBe('VERSION_CONFLICT');
    expect(h.taskActors).toEqual([]);
  });

  it('agents need an explicit flag, and AI use allowed for the transcript', async () => {
    const off = await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, analyst);
    expect(!off.success && off.error.message).toMatch(/explicit enablement/);

    await db.asFirestore().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'restricted' });
    const restricted = await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, analyst, true);
    expect(!restricted.success && restricted.error.code).toBe('FORBIDDEN');
    expect(h.taskActors).toEqual([]);

    await db.asFirestore().collection('meeting_transcripts').doc('t-1').update({ aiUse: 'allowed' });
    const allowed = await run<MeetingCreateFollowupTasksOutput>(createCap, { workspaceId: 'ws-a', meetingId: 'm-1' }, analyst, true);
    expect(allowed.success && allowed.data.created).toHaveLength(2);
    // The agent acts for its user: the task domain checks that person's rights.
    expect(h.taskActors[0]).toEqual({ kind: 'user', uid: 'u-1' });
  });

  it('the Meeting Analyst can never undo (no task-delete permission in the persona)', async () => {
    await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHashes: ['it_a'] });
    expect(analyst.grantedScopes).not.toContain('rbac:operations.tasks.delete');
    const res = await run(undoCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_a' }, analyst, true);
    expect(!res.success && res.error.code).toBe('AUTHORIZATION_DENIED');
    expect(db.read('tasks/task-1')).toBeDefined();
  });

  it('undo removes an unchanged task; after an edit it is refused and the task kept', async () => {
    await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHashes: ['it_a', 'it_b'] });

    const removed = await run<MeetingUndoFollowupTaskOutput>(undoCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_a' });
    expect(removed.success && removed.data).toEqual({ status: 'removed', taskId: 'task-1' });
    expect(db.read('tasks/task-1')).toBeUndefined();

    db.write('tasks/task-2', { ...db.read('tasks/task-2'), title: 'Renamed', updatedAt: '2026-10-07T13:00:00.000Z' });
    const edited = await run(undoCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_b' });
    expect(!edited.success && edited.error).toMatchObject({ code: 'VERSION_CONFLICT', message: "This task was edited, so it wasn't removed. Remove it from Tasks if needed." });
    expect(db.read('tasks/task-2')).toBeDefined();
  });

  it("undo needs the person's own right to delete tasks", async () => {
    await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHashes: ['it_a'] });
    h.canDelete = false;
    const res = await run(undoCap, { workspaceId: 'ws-a', meetingId: 'm-1', itemHash: 'it_a' });
    expect(!res.success && res.error.code).toBe('FORBIDDEN');
  });

  it("another workspace's meeting is NOT_FOUND", async () => {
    const res = await run(createCap, { workspaceId: 'ws-a', meetingId: 'm-b' });
    expect(!res.success && res.error.code).toBe('NOT_FOUND');
  });
});
