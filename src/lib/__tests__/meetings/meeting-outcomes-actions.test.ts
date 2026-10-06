// @vitest-environment node
/**
 * @fileOverview Outcomes panel Server Actions (Phase 11 M2 · T6).
 * Public endpoints: anonymous / foreign workspace / foreign meeting / bad ids refused before any
 * read. The read view joins tasks, live drafts and proposals. Changes go through the governed
 * capabilities as the person: flat `tasks_manage` creates tasks (T6 bridge) but can't undo
 * (never delete); a stale analysis version is refused; deal targets are this workspace's open deals.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import { PIPELINE_ID, writeIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';
import type { MeetingItem } from '@/lib/meetings/intelligence/intelligence-schemas';

const h = vi.hoisted(() => ({
  signedIn: true,
  workspaces: ['ws-a'] as string[],
  canManage: true,
  permissions: ['meetings_manage', 'tasks_manage'] as string[],
  schema: undefined as unknown,
  db: undefined as unknown,
  seq: 0,
}));

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return {
    ...actual,
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      if (!h.signedIn) throw new actual.UnauthorizedError('Not signed in.');
      if (!h.workspaces.includes(workspaceId)) throw new actual.ForbiddenError('No access to this workspace.');
      return { uid: 'user-1', isSystemAdmin: false, profile: { organizationId: 'org-1', workspaceIds: h.workspaces, permissions: h.permissions, ...(h.schema ? { permissionsSchema: h.schema } : {}) } };
    }),
  };
});
vi.mock('@/lib/workspace-permissions', () => ({
  checkWorkspacePermission: vi.fn(async () => (h.canManage ? { granted: true } : { granted: false, reason: 'no' })),
  canUser: vi.fn(async () => ({ granted: true })),
}));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn(async (task: { workspaceId: string; title: string }) => {
    const id = `task-${++h.seq}`;
    (h.db as FakeFirestore).write(`tasks/${id}`, { workspaceId: task.workspaceId, title: task.title, createdAt: 'x', updatedAt: 'x' });
    return { success: true, id };
  }),
}));
vi.mock('@/lib/contact-adapter', () => ({ resolveContact: vi.fn(async () => ({ entityContacts: [{ email: 'kofi@customer.test', name: 'Kofi' }] })) }));
vi.mock('@/platform/capabilities/storage/audit-store', () => ({ defaultAuditSink: vi.fn(async () => undefined) }));

import {
  createFollowupTasksAction,
  getFollowupRecipientsAction,
  getMeetingOutcomesAction,
  getProposalTargetsAction,
  undoFollowupTaskAction,
} from '@/app/actions/meeting-outcomes-actions';
import { getFullAdminPermissions } from '@/lib/permissions-engine';

let db: FakeFirestore;
const NOW = '2026-10-07T12:00:00.000Z';
const item = (hash: string, type: MeetingItem['type'], needsReview = false): MeetingItem => ({
  workspaceId: 'ws-a', meetingId: 'm-a', transcriptId: 't-1', itemHash: hash, type, text: `Do ${hash}`, confidence: 0.9,
  evidence: [{ segmentIds: ['s1'], quote: 'send the revised quote' }], contradicts: [], needsReview,
  reviewReasons: needsReview ? ['low_confidence'] : [], status: 'valid', promptVersion: 'v', createdAt: NOW,
});

beforeEach(async () => {
  db = new FakeFirestore();
  h.db = db.asFirestore();
  h.signedIn = true;
  h.workspaces = ['ws-a'];
  h.canManage = true;
  h.permissions = ['meetings_manage', 'tasks_manage'];
  h.schema = undefined;
  h.seq = 0;
  db.write('meetings/m-a', { workspaceIds: ['ws-a'], organizationId: 'org-1', title: 'Demo A', entityId: 'ent-1' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], organizationId: 'org-2', title: 'Demo B' });
  db.write('participants/p-1', { meetingId: 'm-a', name: 'Ama', email: 'ama@customer.test' });
  await writeIntelligenceV2(db.asFirestore(), {
    schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-a', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
    promptVersion: 'mi_extract_v1', promptHash: 'h', summary: null, modelId: 'flash',
    counts: { kept: 3, needsReview: 1, dropped: { schema: 1, unknown_segment: 0, quote_not_found: 2, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
    coverage: 1, truncated: false, version: 2, generatedAt: NOW, updatedAt: NOW,
  }, [item('it_a', 'action_item'), item('it_b', 'commitment'), item('it_r', 'action_item', true)]);
});

describe('outcomes actions: public endpoint guards', () => {
  it('refuses anonymous callers, other workspaces, foreign meetings and malformed ids', async () => {
    h.signedIn = false;
    expect((await getMeetingOutcomesAction('ws-a', 'm-a')).success).toBe(false);
    h.signedIn = true;
    expect((await getMeetingOutcomesAction('ws-b', 'm-b')).success).toBe(false);
    expect((await getMeetingOutcomesAction('ws-a', 'm-b')).success).toBe(false);
    expect((await getMeetingOutcomesAction('ws-a', 'a/b')).success).toBe(false);
    expect((await createFollowupTasksAction('ws-a', 'm-a', { expectedVersion: -1 })).success).toBe(false);
  });

  it('needs meetings manage for changes (view is enough to read)', async () => {
    h.canManage = false;
    expect((await getMeetingOutcomesAction('ws-a', 'm-a')).success).toBe(true);
    const res = await createFollowupTasksAction('ws-a', 'm-a', { expectedVersion: 2 });
    expect(res.success).toBe(false);
    expect(h.seq).toBe(0);
  });
});

describe('getMeetingOutcomesAction', () => {
  it('returns the analysis with tasks, live drafts and proposals per item', async () => {
    db.write('meeting_item_conversions/ws-a__it_a', { workspaceId: 'ws-a', meetingId: 'm-a', itemHash: 'it_a', taskId: 'task-9' });
    const draft = (id: string, status: 'draft' | 'deleted') => db.write(`meeting_followup_drafts/${id}`, {
      draftId: id, requestKey: 'k', workspaceId: 'ws-a', meetingId: 'm-a', transcriptId: 't-1', intelligenceVersion: 2, status, version: 1,
      recipients: ['ama@customer.test'], subject: `Subject ${id}`, sentences: [{ text: 'x', itemHashes: ['it_a'] }], body: 'x', sourceItemHashes: ['it_a'],
      droppedSentences: 0, provider: { modelId: 'pro', promptVersion: 'mi_followup_v1' }, createdBy: 'user-1', createdAt: NOW,
    });
    draft('d-live', 'draft');
    draft('d-gone', 'deleted');

    const res = await getMeetingOutcomesAction('ws-a', 'm-a');
    expect(res.success).toBe(true);
    if (!res.success || !res.data) return;
    expect(res.data.header).toMatchObject({ version: 2, runId: 'mir_1', promptVersion: 'mi_extract_v1', modelId: 'flash', kept: 3, needsReview: 1, dropped: 3 });
    expect(res.data.items.map((i) => i.itemHash).sort()).toEqual(['it_a', 'it_b', 'it_r']);
    expect(res.data.tasks).toEqual({ it_a: 'task-9' });
    expect(res.data.drafts.map((d) => d.draftId)).toEqual(['d-live']);
  });

  it('a meeting without analysis returns null', async () => {
    db.docs.delete('meeting_intelligence/m-a');
    expect(await getMeetingOutcomesAction('ws-a', 'm-a')).toEqual({ success: true, data: null });
  });
});

describe('task actions through the gateway', () => {
  it('a flat tasks_manage role creates tasks for checked items only', async () => {
    const res = await createFollowupTasksAction('ws-a', 'm-a', { expectedVersion: 2 });
    expect(res.success).toBe(true);
    if (!res.success) return;
    expect(res.data.created.map((c) => c.itemHash).sort()).toEqual(['it_a', 'it_b']);
  });

  it('without a task permission the gateway refuses; a stale version is refused', async () => {
    h.permissions = ['meetings_manage'];
    expect((await createFollowupTasksAction('ws-a', 'm-a', { expectedVersion: 2 })).success).toBe(false);
    h.permissions = ['meetings_manage', 'tasks_manage'];
    const stale = await createFollowupTasksAction('ws-a', 'm-a', { expectedVersion: 1 });
    expect(!stale.success && stale.error).toMatch(/changed since you reviewed/);
    expect(h.seq).toBe(0);
  });

  it('undo needs task-delete rights: a flat role cannot, a role with delete can', async () => {
    await createFollowupTasksAction('ws-a', 'm-a', { itemHashes: ['it_a'], expectedVersion: 2 });
    expect((await undoFollowupTaskAction('ws-a', 'm-a', 'it_a')).success).toBe(false);
    h.schema = getFullAdminPermissions();
    const res = await undoFollowupTaskAction('ws-a', 'm-a', 'it_a');
    expect(res.success && res.data).toEqual({ status: 'removed', taskId: 'task-1' });
  });
});

describe('panel reads', () => {
  it('recipients: participants and contacts of the linked record', async () => {
    const res = await getFollowupRecipientsAction('ws-a', 'm-a');
    expect(res.success && res.data.map((r) => r.email).sort()).toEqual(['ama@customer.test', 'kofi@customer.test']);
  });

  it("proposal targets: this workspace's open deals of the linked record, stages in order", async () => {
    db.write('deals/d-1', { workspaceId: 'ws-a', entityId: 'ent-1', name: 'Renewal', stageId: 'st-1', pipelineId: 'p-1', status: 'open' });
    db.write('deals/d-2', { workspaceId: 'ws-a', entityId: 'ent-1', name: 'Old', stageId: 'st-2', pipelineId: 'p-1', status: 'won' });
    db.write('deals/d-3', { workspaceId: 'ws-b', entityId: 'ent-1', name: 'Other tenant', stageId: 'st-1', pipelineId: 'p-1' });
    db.write('onboardingStages/st-2', { pipelineId: 'p-1', name: 'Proposal', order: 2 });
    db.write('onboardingStages/st-1', { pipelineId: 'p-1', name: 'Discovery', order: 1 });

    const res = await getProposalTargetsAction('ws-a', 'm-a');
    expect(res.success && res.data).toEqual({
      entityId: 'ent-1',
      deals: [{ dealId: 'd-1', name: 'Renewal', stageId: 'st-1', stages: [{ stageId: 'st-1', name: 'Discovery' }, { stageId: 'st-2', name: 'Proposal' }] }],
    });
  });
});
