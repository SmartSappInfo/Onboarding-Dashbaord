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
import { PIPELINE_ID, writeIntelligenceV2 } from '@/lib/meetings/intelligence/intelligence-store';

const h = vi.hoisted(() => ({
  signedIn: true,
  workspaces: ['ws-a'] as string[],
  canManage: true,
  db: undefined as unknown,
  tasksCreated: 0,
  taskCoreOk: true,
  audits: [] as unknown[],
  scheduled: [] as string[],
}));

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return {
    ...actual,
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      if (!h.signedIn) throw new actual.UnauthorizedError('Not signed in.');
      if (!h.workspaces.includes(workspaceId)) throw new actual.ForbiddenError('No access to this workspace.');
      // Flat legacy permissions, as real profiles carry them (`meetings_manage` → meetings scopes).
      return { uid: 'user-1', isSystemAdmin: false, profile: { organizationId: 'org-1', workspaceIds: h.workspaces, permissions: h.canManage ? ['meetings_manage'] : [] } };
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
  adminStorage: {
    file: (path: string) => ({
      getSignedUrl: async (o: { version: string; action: string; expires: number }) => [`https://signed.example/${path}?v=${o.version}&a=${o.action}&exp=${o.expires}`],
    }),
  },
}));
vi.mock('@/lib/gcp-tasks-client', () => ({
  scheduleTaskWithKey: vi.fn(async (key: string) => {
    h.scheduled.push(key);
  }),
}));
vi.mock('@/lib/meetings/intelligence/intelligence-model', () => ({ createIntelligenceModel: () => null }));
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
  generateRecordingPlaybackUrlAction,
} from '@/app/actions/meeting-recording-actions';
import { saveWorkspaceCompliancePolicyAction } from '@/app/actions/meeting-compliance-actions';
import {
  generateMeetingIntelligenceAction,
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

describe('fail-closed intelligence (B1, T7)', () => {
  const seedTranscript = (over: Record<string, unknown> = {}) => {
    db.write('meeting_transcripts/t-1', {
      workspaceId: 'ws-a', meetingId: 'm-a', source: 'paste', status: 'completed', version: 1, schemaVersion: 2,
      language: 'en', speakers: [], wordCount: 4, segmentCount: 1, chunkCount: 1, durationMs: 1000, contentHash: 'h',
      dataClass: 'personal', aiUse: 'allowed', injection: { flagged: false, patterns: [] },
      provenance: { createdBy: 'user-1', principalKind: 'user' }, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: 'x', ...over,
    });
    db.write('meeting_transcripts/t-1/segments/0000', { index: 0, segments: [
      { id: 's0', speakerId: 'sp1', speakerName: 'Ama', startMs: 0, endMs: 1000, text: 'Send the proposal Friday' },
    ] });
  };

  beforeEach(() => {
    db.docs.delete('meeting_intelligence/m-a');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('with no transcript: nothing queued, nothing stored, a clear state for the UI', async () => {
    const res = await generateMeetingIntelligenceAction('m-a', 'ws-a');
    expect(res).toMatchObject({ success: false, code: 'NO_TRANSCRIPT' });
    expect(h.scheduled).toHaveLength(0);
    expect(db.read('meeting_intelligence/m-a')).toBeUndefined();
  });

  it('starting analysis queues the governed pipeline and stores nothing until it has validated results (M2 · T3.5)', async () => {
    seedTranscript();
    h.scheduled.length = 0;
    const res = await generateMeetingIntelligenceAction('m-a', 'ws-a');
    expect(res).toMatchObject({ success: true, status: 'pending' });
    expect(res.intelligence).toBeUndefined();
    expect(res.progress).toMatchObject({ transcriptId: 't-1', status: 'pending' });
    expect(h.scheduled).toHaveLength(1);
    expect(db.read('meeting_intelligence/m-a')).toBeUndefined();
    // Asking again rejoins the same run (no second job).
    expect(await generateMeetingIntelligenceAction('m-a', 'ws-a')).toMatchObject({ success: true, status: 'pending' });
    expect(h.scheduled).toHaveLength(1);
  });

  it('refuses when AI use is restricted', async () => {
    seedTranscript({ aiUse: 'restricted' });
    expect(await generateMeetingIntelligenceAction('m-a', 'ws-a')).toMatchObject({ success: false, code: 'NOT_ALLOWED' });
  });

  it('needs meetings_manage to start analysis; members can still read', async () => {
    seedTranscript();
    h.canManage = false;
    await expect(generateMeetingIntelligenceAction('m-a', 'ws-a')).rejects.toThrow('permission to manage meetings');
    expect((await getMeetingIntelligenceAction('m-a', 'ws-a')).success).toBe(true);
  });

  it('v2 analysis: read in the v1 shape; an item converts to exactly one task; review items are refused', async () => {
    seedTranscript();
    await writeIntelligenceV2(db.asFirestore(), {
      schemaVersion: 2, workspaceId: 'ws-a', meetingId: 'm-a', transcriptId: 't-1', runId: 'mir_1', pipelineId: PIPELINE_ID,
      promptVersion: 'v', promptHash: 'h', summary: { sentences: [{ text: 'Ama sends the proposal.', itemHashes: ['it_ok'] }], promptVersion: 's' },
      counts: { kept: 2, needsReview: 1, dropped: { schema: 0, unknown_segment: 0, quote_not_found: 0, quote_too_short: 0, duplicate: 0, over_limit: 0 } },
      coverage: 1, truncated: false, version: 0, generatedAt: 'g', updatedAt: 'u',
    }, [
      { workspaceId: 'ws-a', meetingId: 'm-a', transcriptId: 't-1', itemHash: 'it_ok', type: 'action_item', text: 'Send the proposal', confidence: 0.9,
        evidence: [{ segmentIds: ['s0'], quote: 'send the proposal friday' }], contradicts: [], needsReview: false, reviewReasons: [], status: 'valid', promptVersion: 'v', createdAt: 'c' },
      { workspaceId: 'ws-a', meetingId: 'm-a', transcriptId: 't-1', itemHash: 'it_rev', type: 'action_item', text: 'Maybe call', confidence: 0.4,
        evidence: [{ segmentIds: ['s0'], quote: 'send the proposal friday' }], contradicts: [], needsReview: true, reviewReasons: ['low_confidence'], status: 'valid', promptVersion: 'v', createdAt: 'c' },
    ]);
    const read = await getMeetingIntelligenceAction('m-a', 'ws-a');
    expect(read.intelligence).toMatchObject({ executiveSummary: 'Ama sends the proposal.', actionItems: [{ id: 'it_ok', needsReview: false }, { id: 'it_rev', needsReview: true }] });
    const before = h.tasksCreated;
    const first = await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'it_ok');
    const second = await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'it_ok');
    expect(first.crmTaskId).toBeDefined();
    expect(second.crmTaskId).toBe(first.crmTaskId);
    expect(h.tasksCreated).toBe(before + 1);
    expect(await convertActionItemToCrmTaskAction('m-a', 'ws-a', 'it_rev')).toMatchObject({ success: false, error: expect.stringContaining('Review') });
    expect((await getMeetingIntelligenceAction('m-a', 'ws-a')).intelligence?.actionItems[0]).toMatchObject({ status: 'converted_to_crm_task', crmTaskId: first.crmTaskId });
  });

  it('shows a stored v1 analysis (validated) until the meeting is re-analysed', async () => {
    db.write('meeting_intelligence/m-a', {
      workspaceId: 'ws-a', meetingId: 'm-a', executiveSummary: 'Old summary', keyTopics: ['pricing'], keyDecisions: [],
      actionItems: [{ id: 'ai-9', text: 'Old item', priority: 'high', status: 'open' }], buyingSignals: [], objections: [],
      dealRisks: [], sentiment: { category: 'positive', score: 0.5, explanation: 'x' }, recommendedFollowUp: '', generatedAt: 'g', updatedAt: 'u',
    });
    const res = await getMeetingIntelligenceAction('m-a', 'ws-a');
    expect(res.intelligence).toMatchObject({ executiveSummary: 'Old summary', sentiment: { category: 'positive' }, actionItems: [{ id: 'ai-9' }] });
  });
});

describe('recording playback (G8, T7)', () => {
  it('signs uploaded files for 15 minutes and audits the access', async () => {
    db.write('meeting_recordings/r-up', { workspaceId: 'ws-a', meetingId: 'm-a', mediaUrl: '', storagePath: 'workspaces/ws-a/meetings/m-a/recordings/a.mp4', durationSeconds: 1, status: 'available', createdAt: 'x', updatedAt: 'x' });
    const res = await generateRecordingPlaybackUrlAction('r-up', 'ws-a');
    expect(res).toMatchObject({ success: true, kind: 'signed' });
    expect(res.playbackUrl).toContain('v=v4&a=read');
    expect(h.audits).toHaveLength(1);
    expect(JSON.stringify(h.audits)).not.toContain('signed.example');
  });

  it('returns safe external links as-is and refuses unsafe stored links', async () => {
    expect(await generateRecordingPlaybackUrlAction('r-a', 'ws-a')).toMatchObject({ success: true, kind: 'external_link', playbackUrl: 'https://cdn.example.com/a.mp4' });
    db.write('meeting_recordings/r-js', { workspaceId: 'ws-a', meetingId: 'm-a', mediaUrl: 'javascript:alert(1)', durationSeconds: 1, status: 'available', createdAt: 'x', updatedAt: 'x' });
    expect((await generateRecordingPlaybackUrlAction('r-js', 'ws-a')).success).toBe(false);
  });

  it('does not return share tokens or store new ones', async () => {
    const res = await attach();
    expect(db.read(`meeting_recordings/${res.recordingId}`)).not.toHaveProperty('shareToken');
  });
});
