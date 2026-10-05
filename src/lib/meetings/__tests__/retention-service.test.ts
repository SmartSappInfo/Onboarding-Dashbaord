// @vitest-environment node
/**
 * @fileOverview Meeting retention (Phase 11 M1 · T6.1). Shadow deletes nothing; enforced deletes
 * exactly the plan; holds, pins, floor and other workspaces are untouched; deletions resume.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import {
  deleteTranscriptCascade,
  planWorkspaceRetention,
  registerRetentionCascade,
  runRetentionSweep,
  runWorkspaceRetention,
  MAX_WORKSPACES_PER_RUN,
} from '../retention-service';
import { isRetentionTightening, updateCompliancePolicy } from '../compliance-policy-store';

const NOW = Date.parse('2026-10-05T00:00:00.000Z');
const OLD = '2026-05-01T10:00:00.000Z'; // > 90 days ago
const RECENT = '2026-09-20T10:00:00.000Z'; // < 30 days ago

let db: FakeFirestore;
let deletedObjects: string[];
let audits: unknown[];
const deps = () => ({
  nowMs: NOW,
  storage: { deleteObject: async (p: string) => { deletedObjects.push(p); } },
  audit: async (e: unknown) => { audits.push(e); },
});

function transcript(id: string, meetingId: string, ws = 'ws-a', chunks = 2) {
  db.write(`meeting_transcripts/${id}`, {
    workspaceId: ws, meetingId, source: 'paste', status: 'completed', version: 1, schemaVersion: 2, language: 'en',
    speakers: [], wordCount: 1, segmentCount: chunks * 500, chunkCount: chunks, durationMs: 1, contentHash: 'h',
    dataClass: 'personal', aiUse: 'allowed', injection: { flagged: false, patterns: [] },
    provenance: { createdBy: 'u', principalKind: 'user' }, createdAt: OLD, updatedAt: OLD,
  });
  for (let i = 0; i < chunks; i += 1) db.write(`meeting_transcripts/${id}/segments/${String(i).padStart(4, '0')}`, { index: i, segments: [] });
}

function policy(over: Record<string, unknown> = {}) {
  db.write('meeting_compliance_policies/ws-a', {
    workspaceId: 'ws-a', retentionPeriodDays: 90, autoPurgeTranscripts: true, autoPurgeRecordings: true,
    retentionEnabled: true, retentionLastRunAt: '', retentionMode: 'shadow', updatedAt: 'pv1', ...over,
  });
}

beforeEach(() => {
  db = new FakeFirestore();
  deletedObjects = [];
  audits = [];
  db.write('meetings/old', { workspaceIds: ['ws-a'], meetingTime: OLD });
  db.write('meetings/recent', { workspaceIds: ['ws-a'], meetingTime: RECENT });
  db.write('meetings/held', { workspaceIds: ['ws-a'], meetingTime: OLD, legalHold: { on: true } });
  db.write('meetings/pinned', { workspaceIds: ['ws-a'], meetingTime: OLD, isPinned: true });
  db.write('meetings/shared', { workspaceIds: ['ws-a', 'ws-b'], meetingTime: OLD });
  transcript('t-old', 'old');
  transcript('t-recent', 'recent');
  transcript('t-held', 'held');
  transcript('t-pinned', 'pinned');
  transcript('t-shared-a', 'shared');
  transcript('t-shared-b', 'shared', 'ws-b');
  db.write('meeting_recordings/r-old', { workspaceId: 'ws-a', meetingId: 'old', mediaUrl: '', storagePath: 'workspaces/ws-a/meetings/old/recordings/a.mp4', durationSeconds: 1, status: 'available', createdAt: OLD, updatedAt: OLD });
  db.write('meeting_intelligence/old', { workspaceId: 'ws-a', meetingId: 'old' });
});

describe('retention plan', () => {
  it('selects only old, unheld, unpinned meetings and only this workspace\'s data', async () => {
    policy();
    const plan = await planWorkspaceRetention(db.asFirestore(), { workspaceId: 'ws-a', nowMs: NOW });
    const ids = plan.candidates.map((c) => c.meetingId).sort();
    expect(ids).toEqual(['old', 'shared']);
    expect(plan.candidates.find((c) => c.meetingId === 'shared')?.transcriptIds).toEqual(['t-shared-a']);
    expect(plan.counts).toEqual({ meetings: 2, transcripts: 2, recordings: 1, intelligence: 1 });
  });

  it('never goes below the 30-day floor and is empty when retention is off', async () => {
    policy({ retentionPeriodDays: 1 });
    const plan = await planWorkspaceRetention(db.asFirestore(), { workspaceId: 'ws-a', nowMs: NOW });
    expect(plan.candidates.map((c) => c.meetingId)).not.toContain('recent');
    policy({ retentionPeriodDays: 0 });
    expect((await planWorkspaceRetention(db.asFirestore(), { workspaceId: 'ws-a', nowMs: NOW })).candidates).toEqual([]);
  });
});

describe('retention run', () => {
  it('SHADOW mode deletes nothing and records what it would delete', async () => {
    policy();
    const before = db.docs.size;
    const run = await runWorkspaceRetention(db.asFirestore(), deps(), 'ws-a');
    expect(run.mode).toBe('shadow');
    expect(run.deleted).toEqual({ transcripts: 0, recordings: 0, intelligence: 0 });
    expect(db.read('meeting_transcripts/t-old')).toBeDefined();
    expect(deletedObjects).toEqual([]);
    const runs = [...db.docs.entries()].filter(([k]) => k.startsWith('meeting_retention_runs/'));
    expect(runs).toHaveLength(1);
    expect(runs[0][1]).toMatchObject({ mode: 'shadow', planned: { meetings: 2 } });
    expect(db.docs.size).toBe(before + 1);
  });

  it('ENFORCED mode deletes exactly the plan (chunks, objects, intelligence), audits and verifies', async () => {
    policy({ retentionMode: 'enforced' });
    const seen: string[] = [];
    const off = registerRetentionCascade(async ({ sourceId }) => { seen.push(sourceId); });
    const run = await runWorkspaceRetention(db.asFirestore(), deps(), 'ws-a');
    off();
    expect(run.deleted).toEqual({ transcripts: 2, recordings: 1, intelligence: 1 });
    expect(run.verified).toBe(true);
    for (const gone of ['meeting_transcripts/t-old', 'meeting_transcripts/t-old/segments/0000', 'meeting_transcripts/t-shared-a', 'meeting_recordings/r-old', 'meeting_intelligence/old']) {
      expect(db.read(gone), gone).toBeUndefined();
    }
    for (const kept of ['meeting_transcripts/t-recent', 'meeting_transcripts/t-held', 'meeting_transcripts/t-pinned', 'meeting_transcripts/t-shared-b', 'meetings/old']) {
      expect(db.read(kept), kept).toBeDefined();
    }
    expect(deletedObjects).toEqual(['workspaces/ws-a/meetings/old/recordings/a.mp4']);
    expect(seen.sort()).toEqual(['t-old', 't-shared-a']);
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits)).not.toMatch(/segments|text/);

    const again = await runWorkspaceRetention(db.asFirestore(), deps(), 'ws-a');
    expect(again.deleted).toEqual({ transcripts: 0, recordings: 0, intelligence: 0 });
  });

  it('resumes an interrupted deletion from its tombstone', async () => {
    policy();
    db.write('meeting_transcripts/t-old', { ...db.read('meeting_transcripts/t-old'), status: 'deleting' });
    const run = await runWorkspaceRetention(db.asFirestore(), deps(), 'ws-a');
    expect(run.resumedTombstones).toBe(1);
    expect(db.read('meeting_transcripts/t-old')).toBeUndefined();
    expect(db.read('meeting_transcripts/t-old/segments/0001')).toBeUndefined();
  });

  it('manual delete refuses another workspace and a stale version', async () => {
    expect(await deleteTranscriptCascade(db.asFirestore(), { workspaceId: 'ws-a', transcriptId: 't-shared-b', reason: 'manual', nowIso: 'x' })).toBe(false);
    await expect(deleteTranscriptCascade(db.asFirestore(), { workspaceId: 'ws-a', transcriptId: 't-old', reason: 'manual', nowIso: 'x', expectedVersion: 7 })).rejects.toThrow('changed');
    expect(db.read('meeting_transcripts/t-old')).toBeDefined();
  });

  it('the sweep only touches opted-in workspaces, least recently run first, bounded', async () => {
    for (let i = 0; i < MAX_WORKSPACES_PER_RUN + 3; i += 1) {
      db.write(`meeting_compliance_policies/ws-${i}`, { workspaceId: `ws-${i}`, retentionEnabled: true, retentionLastRunAt: `2026-01-0${(i % 9) + 1}`, retentionPeriodDays: 90, autoPurgeTranscripts: true, updatedAt: 'x' });
    }
    db.write('meeting_compliance_policies/ws-off', { workspaceId: 'ws-off', retentionEnabled: false, retentionLastRunAt: '', updatedAt: 'x' });
    const runs = await runRetentionSweep(db.asFirestore(), deps());
    expect(runs).toHaveLength(MAX_WORKSPACES_PER_RUN);
    expect(runs.map((r) => r.workspaceId)).not.toContain('ws-off');
  });
});

describe('policy binding (Rules 21/22)', () => {
  it('detects changes that can delete more data', () => {
    const shadow = { retentionMode: 'shadow', retentionPeriodDays: 90, autoPurgeTranscripts: true };
    const enforced = { ...shadow, retentionMode: 'enforced' };
    expect(isRetentionTightening(shadow, enforced)).toBe(true);
    expect(isRetentionTightening(enforced, { ...enforced, retentionPeriodDays: 60 })).toBe(true);
    expect(isRetentionTightening(enforced, { ...enforced, retentionPeriodDays: 120 })).toBe(false);
    expect(isRetentionTightening(enforced, { ...enforced, autoPurgeRecordings: true })).toBe(true);
    expect(isRetentionTightening(enforced, shadow)).toBe(false);
  });

  it('refuses a tightening save unless the confirmation callback passes, and keeps derived fields', async () => {
    await expect(updateCompliancePolicy(db.asFirestore(), {
      update: { workspaceId: 'ws-z', retentionPeriodDays: 90, autoPurgeTranscripts: true, retentionMode: 'enforced' },
      actorUid: 'u', nowIso: 'n',
      assertImpactConfirmed: async () => { throw new Error('not confirmed'); },
    })).rejects.toThrow('not confirmed');
    expect(db.read('meeting_compliance_policies/ws-z')).toBeUndefined();

    await updateCompliancePolicy(db.asFirestore(), {
      update: { workspaceId: 'ws-z', retentionPeriodDays: 90, autoPurgeTranscripts: true, retentionMode: 'shadow' },
      actorUid: 'u', nowIso: 'n', assertImpactConfirmed: async () => { throw new Error('should not be called for shadow'); },
    });
    expect(db.read('meeting_compliance_policies/ws-z')).toMatchObject({ retentionEnabled: true, retentionLastRunAt: '' });
  });
});
