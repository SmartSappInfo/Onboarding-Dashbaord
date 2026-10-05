// @vitest-environment node
/**
 * @fileOverview Backoffice meeting ops (Phase 11 M1 · T9): authorize first, audit changes,
 * kill switches, DLQ recovery, retention run bound to the reviewed preview.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown, allowed: true, audits: [] as Array<{ action: string; before?: unknown; after?: unknown }>, scheduled: [] as string[] }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() { return h.db; },
  adminStorage: { file: () => ({ delete: async () => undefined }) },
}));
vi.mock('../backoffice-auth', () => ({
  authorizeBackoffice: vi.fn(async () => {
    if (!h.allowed) throw new Error('Forbidden: meetings_monitor');
    return { userId: 'op-1', name: 'Op', email: 'op@x', role: 'super_admin' };
  }),
}));
vi.mock('../audit-logger', () => ({
  logBackofficeAction: vi.fn(async (_actor: unknown, action: string, _t: string, _id: string, opts: { before?: unknown; after?: unknown }) => { h.audits.push({ action, ...opts }); }),
}));
vi.mock('@/lib/gcp-tasks-client', () => ({ scheduleTaskWithKey: vi.fn(async (key: string) => { h.scheduled.push(key); return key; }) }));
vi.mock('@/platform/capabilities/storage/audit-store', () => ({ defaultAuditSink: vi.fn(async () => undefined) }));

import {
  getMeetingOpsSnapshotAction,
  previewWorkspaceRetentionAction,
  reprocessDeadLetterAction,
  runWorkspaceRetentionNowAction,
  setMeetingControlsAction,
  setTranscriptionQuotaAction,
} from '../backoffice-meeting-ops-actions';

const TID = `tr_${'a'.repeat(32)}`;
let db: FakeFirestore;
beforeEach(() => {
  db = new FakeFirestore();
  h.db = db;
  h.allowed = true;
  h.audits = [];
  h.scheduled = [];
});

const header = (status: string) => ({
  workspaceId: 'ws-a', meetingId: 'm-1', recordingId: 'r-1', recordingVersion: 'v1', source: 'recording', status, version: 4, schemaVersion: 2,
  language: 'en', speakers: [], wordCount: 0, segmentCount: 0, chunkCount: 0, durationMs: 0, contentHash: '', dataClass: 'personal',
  aiUse: 'allowed', injection: { flagged: false, patterns: [] }, provenance: { createdBy: 'u', principalKind: 'user' },
  attempts: 3, error: { code: 'provider_unavailable', message: 'x' }, createdAt: 'c', updatedAt: '2026-10-05T00:00:00.000Z',
});

describe('backoffice meeting ops', () => {
  it('refuses callers without Backoffice access before touching data', async () => {
    h.allowed = false;
    expect(await setMeetingControlsAction('t', { transcriptionPaused: true })).toMatchObject({ success: false });
    expect(db.read('platform_config/meeting_controls')).toBeUndefined();
  });

  it('kill switches and quotas are saved with before/after audit', async () => {
    expect((await setMeetingControlsAction('t', { blockAudioEgress: true })).success).toBe(true);
    expect(db.read('platform_config/meeting_controls')).toMatchObject({ blockAudioEgress: true });
    expect((await setTranscriptionQuotaAction('t', 'ws-a', 30)).success).toBe(true);
    expect(db.read('meeting_transcription_quotas/ws-a')).toMatchObject({ dailyMinutes: 30 });
    expect(h.audits.map((a) => a.action)).toEqual(['meeting_controls.update', 'transcription_quota.update']);
    expect((await setTranscriptionQuotaAction('t', 'ws-a', -1)).success).toBe(false);
  });

  it('requeues only dead-lettered transcriptions, with a fresh attempt budget and task name', async () => {
    db.write(`meeting_transcripts/${TID}`, header('dead_lettered'));
    db.write(`meeting_transcription_dlq/${TID}`, { resolved: false, code: 'provider_unavailable', message: 'x', at: 'a' });
    expect(await reprocessDeadLetterAction('t', TID)).toEqual({ success: true, data: { requeued: true } });
    expect(db.read(`meeting_transcripts/${TID}`)).toMatchObject({ status: 'pending', attempts: 0, version: 5 });
    expect(db.read(`meeting_transcripts/${TID}`)).not.toHaveProperty('error');
    expect(h.scheduled).toEqual([`${TID}-v5`]);
    expect(await reprocessDeadLetterAction('t', TID)).toEqual({ success: true, data: { requeued: false } });
  });

  it('snapshot shows states and counts only, never content', async () => {
    db.write(`meeting_transcripts/${TID}`, header('processing'));
    const res = await getMeetingOpsSnapshotAction('t');
    expect(res.success && res.data.queue).toEqual([expect.objectContaining({ transcriptId: TID, status: 'processing', attempts: 3 })]);
    expect(JSON.stringify(res)).not.toMatch(/segments|mediaUrl|https?:/);
  });

  it('run-now is bound to the reviewed preview', async () => {
    db.write('meeting_compliance_policies/ws-a', { workspaceId: 'ws-a', retentionPeriodDays: 90, autoPurgeTranscripts: true, retentionMode: 'enforced', retentionEnabled: true, retentionLastRunAt: '', updatedAt: 'v' });
    const preview = await previewWorkspaceRetentionAction('t', 'ws-a');
    expect(preview.success).toBe(true);
    expect(await runWorkspaceRetentionNowAction('t', 'ws-a', 'stale-hash')).toMatchObject({ success: false, error: 'The data to remove changed. Preview again before running.' });
    if (preview.success) {
      expect(await runWorkspaceRetentionNowAction('t', 'ws-a', preview.data.candidateSetHash)).toMatchObject({ success: true, data: { mode: 'enforced' } });
    }
  });
});
