// @vitest-environment node
/**
 * @fileOverview Meeting server-action security (Phase 11 M1 · T0, findings G1–G4).
 *
 * Server Actions are public endpoints. Each one must refuse an anonymous caller, a caller from
 * another workspace, a foreign meeting id and (for changes) a member without `meetings_manage`,
 * BEFORE touching data. Reads stay open to workspace members, exactly as before.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';

const h = vi.hoisted(() => ({
  signedIn: true,
  workspaces: ['ws-a'] as string[],
  canManage: true,
  db: undefined as unknown,
  tasksCreated: 0,
  taskCoreOk: true,
  audits: [] as unknown[],
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return {
    ...actual,
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      if (!h.signedIn) throw new actual.UnauthorizedError('Not signed in.');
      if (!h.workspaces.includes(workspaceId)) throw new actual.ForbiddenError('No access to this workspace.');
      return { uid: 'user-1', isSystemAdmin: false, profile: { organizationId: 'org-1', workspaceIds: h.workspaces } };
    }),
  };
});
vi.mock('@/lib/workspace-permissions', () => ({
  checkWorkspacePermission: vi.fn(async () => (h.canManage ? { granted: true } : { granted: false, reason: 'no' })),
}));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/meetings/activity-logger', () => ({ logMeetingActivity: vi.fn(async () => ({ success: true })) }));
vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn(async () => {
    if (!h.taskCoreOk) return { success: false, error: 'Firestore unavailable' };
    h.tasksCreated += 1;
    return { success: true, id: `task-${h.tasksCreated}` };
  }),
}));
vi.mock('@/platform/capabilities/storage/audit-store', () => ({
  defaultAuditSink: vi.fn(async (entry: unknown) => {
    h.audits.push(entry);
  }),
}));

import {
  attachMeetingRecordingAction,
  getMeetingRecordingsAction,
  deleteMeetingRecordingAction,
} from '@/app/actions/meeting-recording-actions';
import { saveWorkspaceCompliancePolicyAction } from '@/app/actions/meeting-compliance-actions';
import {
  convertActionItemToCrmTaskAction,
  getMeetingIntelligenceAction,
  generateMeetingPrepBriefAction,
} from '@/app/actions/meeting-intelligence-actions';

let db: FakeFirestore;

beforeEach(() => {
  db = new FakeFirestore();
  h.db = db;
  h.signedIn = true;
  h.workspaces = ['ws-a'];
  h.canManage = true;
  h.tasksCreated = 0;
  h.taskCoreOk = true;
  h.audits = [];
  db.write('meetings/m-a', { workspaceIds: ['ws-a'], organizationId: 'org-1', title: 'Demo A' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'], organizationId: 'org-2', title: 'Demo B' });
  db.write('meeting_recordings/r-a', {
    workspaceId: 'ws-a', meetingId: 'm-a', provider: 'zoom', mediaUrl: 'https://cdn.example.com/a.mp4',
    durationSeconds: 60, status: 'available', shareToken: 'secret', createdAt: 'x', updatedAt: 'x',
  });
  db.write('meeting_intelligence/m-a', {
    workspaceId: 'ws-a', organizationId: 'org-1', meetingId: 'm-a',
    actionItems: [{ id: 'ai-1', text: 'Send proposal', priority: 'high', status: 'open' }],
  });
  db.write('meeting_intelligence/m-b', {
    workspaceId: 'ws-b', meetingId: 'm-b', actionItems: [{ id: 'ai-1', text: 'Other tenant', priority: 'low', status: 'open' }],
  });
});

const attach = (overrides: Partial<Parameters<typeof attachMeetingRecordingAction>[0]> = {}) =>
  attachMeetingRecordingAction({
    workspaceId: 'ws-a', meetingId: 'm-a', provider: 'google_meet',
    mediaUrl: 'https://drive.example.com/rec.mp4', durationSeconds: 1800, ...overrides,
  });

describe('recordings (G1)', () => {
  it('refuses anonymous callers for list and attach', async () => {
    h.signedIn = false;
    await expect(getMeetingRecordingsAction('m-a', 'ws-a')).rejects.toThrow('Not signed in.');
    await expect(attach()).rejects.toThrow('Not signed in.');
  });

  it('refuses a caller outside the workspace', async () => {
    await expect(getMeetingRecordingsAction('m-b', 'ws-b')).rejects.toThrow('No access to this workspace.');
  });

  it('refuses a foreign meeting id passed with the caller\'s own workspace', async () => {
    await expect(getMeetingRecordingsAction('m-b', 'ws-a')).rejects.toThrow('Meeting not found.');
    await expect(attach({ meetingId: 'm-b' })).rejects.toThrow('Meeting not found.');
  });

  it('lists recordings for members without exposing share tokens', async () => {
    h.canManage = false; // reads need membership only, as before
    const res = await getMeetingRecordingsAction('m-a', 'ws-a');
    expect(res.success).toBe(true);
    expect(res.recordings).toHaveLength(1);
    expect(res.recordings?.[0]).not.toHaveProperty('shareToken');
  });

  it('needs meetings_manage to attach or delete', async () => {
    h.canManage = false;
    await expect(attach()).rejects.toThrow('permission to manage meetings');
    await expect(deleteMeetingRecordingAction('r-a', 'ws-a')).rejects.toThrow('permission to manage meetings');
  });

  it('attaches an https link and stamps the session organization', async () => {
    const res = await attach({ organizationId: 'org-spoofed' });
    expect(res.success).toBe(true);
    const stored = db.read(`meeting_recordings/${res.recordingId}`);
    expect(stored?.organizationId).toBe('org-1');
  });

  it('refuses unsafe links and foreign storage paths', async () => {
    for (const mediaUrl of ['javascript:alert(1)', 'http://plain.example.com/a.mp4', 'https://user:pw@x.com/a.mp4', 'data:video/mp4;base64,AAA']) {
      const res = await attach({ mediaUrl });
      expect(res.success, mediaUrl).toBe(false);
    }
    const traversal = await attach({ storagePath: 'workspaces/ws-a/meetings/m-a/recordings/../../m-b/recordings/x.mp4' });
    expect(traversal.success).toBe(false);
    const foreign = await attach({ storagePath: 'workspaces/ws-b/meetings/m-b/recordings/x.mp4' });
    expect(foreign.success).toBe(false);
    const own = await attach({ storagePath: 'workspaces/ws-a/meetings/m-a/recordings/x.mp4' });
    expect(own.success).toBe(true);
  });

  it('cannot delete another workspace\'s recording', async () => {
    db.write('meeting_recordings/r-b', { workspaceId: 'ws-b', meetingId: 'm-b', mediaUrl: 'https://x', durationSeconds: 1, status: 'available', createdAt: 'x', updatedAt: 'x' });
    const res = await deleteMeetingRecordingAction('r-b', 'ws-a');
    expect(res.success).toBe(false);
    expect(db.read('meeting_recordings/r-b')).toBeDefined();
  });
});

describe('compliance policy (G2)', () => {
  const policy = { workspaceId: 'ws-a', retentionPeriodDays: 90, enforceHostConsentForAI: true, updatedAt: 'ignored' };

  it('refuses anonymous callers, other workspaces and members without meetings_manage', async () => {
    h.signedIn = false;
    await expect(saveWorkspaceCompliancePolicyAction(policy)).rejects.toThrow('Not signed in.');
    h.signedIn = true;
    await expect(saveWorkspaceCompliancePolicyAction({ ...policy, workspaceId: 'ws-b' })).rejects.toThrow('No access');
    h.canManage = false;
    await expect(saveWorkspaceCompliancePolicyAction(policy)).rejects.toThrow('permission to manage meetings');
    expect(db.read('meeting_compliance_policies/ws-a')).toBeUndefined();
  });

  it('merges page fields, keeps other fields, records history and audit', async () => {
    db.write('meeting_compliance_policies/ws-a', { workspaceId: 'ws-a', autoPurgeTranscripts: true, updatedAt: 'v1' });
    const res = await saveWorkspaceCompliancePolicyAction(policy);
    expect(res.success).toBe(true);
    const stored = db.read('meeting_compliance_policies/ws-a');
    expect(stored).toMatchObject({ retentionPeriodDays: 90, enforceHostConsentForAI: true, autoPurgeTranscripts: true, updatedBy: 'user-1' });
    const history = [...db.docs.keys()].filter((k) => k.startsWith('meeting_compliance_policies/ws-a/history/'));
    expect(history).toHaveLength(1);
    expect(h.audits).toHaveLength(1);
  });

  it('refuses a stale edit when the caller sends the version it loaded', async () => {
    db.write('meeting_compliance_policies/ws-a', { workspaceId: 'ws-a', updatedAt: 'v2' });
    const res = await saveWorkspaceCompliancePolicyAction(policy, { expectedUpdatedAt: 'v1' });
    expect(res.success).toBe(false);
    expect(res.error).toContain('Someone else changed');
  });

  it('rejects invalid values without writing', async () => {
    const res = await saveWorkspaceCompliancePolicyAction({ ...policy, retentionPeriodDays: -5 });
    expect(res.success).toBe(false);
    expect(db.read('meeting_compliance_policies/ws-a')).toBeUndefined();
  });
});

describe('intelligence (G3, G4)', () => {
  it('refuses foreign meetings for read, prep brief and conversion', async () => {
    await expect(getMeetingIntelligenceAction('m-b', 'ws-a')).rejects.toThrow('Meeting not found.');
    await expect(generateMeetingPrepBriefAction('m-b', 'ws-a')).rejects.toThrow('Meeting not found.');
    await expect(convertActionItemToCrmTaskAction('m-b', 'ws-a', 'ai-1')).rejects.toThrow('Meeting not found.');
    expect(h.tasksCreated).toBe(0);
  });

  it('needs meetings_manage to convert an action item', async () => {
    h.canManage = false;
    await expect(convertActionItemToCrmTaskAction('m-a', 'ws-a', 'ai-1')).rejects.toThrow('permission to manage meetings');
  });

  it('creates exactly one task per action item, even when clicked twice', async () => {
    const first = await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'ai-1');
    const second = await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'ai-1');
    expect(first).toEqual({ success: true, crmTaskId: 'task-1' });
    expect(second).toEqual({ success: true, crmTaskId: 'task-1' });
    expect(h.tasksCreated).toBe(1);
    const item = (db.read('meeting_intelligence/m-a')?.actionItems as Array<Record<string, unknown>>)[0];
    expect(item).toMatchObject({ status: 'converted_to_crm_task', crmTaskId: 'task-1' });
    expect(item).not.toHaveProperty('conversionClaimedAt');
  });

  it('releases the claim when task creation fails so the user can retry', async () => {
    h.taskCoreOk = false;
    const failed = await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'ai-1');
    expect(failed.success).toBe(false);
    h.taskCoreOk = true;
    const retried = await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'ai-1');
    expect(retried.success).toBe(true);
  });
});
