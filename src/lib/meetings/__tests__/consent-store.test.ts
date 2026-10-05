// @vitest-environment node
/**
 * @fileOverview Per-meeting consent (Phase 11 M1 · T5.1).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';
import {
  assertConsent,
  ConsentConflictError,
  ConsentRequiredError,
  readMeetingConsents,
  recordConsent,
} from '../consent-store';

const NOW = '2026-10-05T10:00:00.000Z';
let db: FakeFirestore;

const grant = (type: 'recording' | 'transcription' | 'aiProcessing', expectedVersion: number, granted = true) =>
  recordConsent(db.asFirestore(), { workspaceId: 'ws-a', meetingId: 'm-1', type, granted, method: 'verbal', actorUid: 'u-1', expectedVersion, nowIso: NOW });

beforeEach(() => {
  db = new FakeFirestore();
});

describe('consent gate', () => {
  it('does nothing when enforcement is off (behaviour as before M1)', async () => {
    await expect(assertConsent(db.asFirestore(), { workspaceId: 'ws-a', meetingId: 'm-1', operation: 'transcribe_recording' })).resolves.toEqual({ enforced: false, version: 0 });
  });

  it('requires the right consents per operation when enforcement is on', async () => {
    db.write('meeting_compliance_policies/ws-a', { workspaceId: 'ws-a', enforceHostConsentForAI: true, updatedAt: 'v1' });
    const check = (operation: 'ingest_transcript' | 'transcribe_recording' | 'ai_read') =>
      assertConsent(db.asFirestore(), { workspaceId: 'ws-a', meetingId: 'm-1', operation });

    await expect(check('ingest_transcript')).rejects.toThrow('Record transcription consent for this meeting first.');
    await grant('transcription', 0);
    await expect(check('ingest_transcript')).resolves.toMatchObject({ enforced: true });
    await expect(check('transcribe_recording')).rejects.toThrow('Record recording consent');
    await expect(check('ai_read')).rejects.toBeInstanceOf(ConsentRequiredError);
    await grant('recording', 1);
    await expect(check('transcribe_recording')).resolves.toMatchObject({ enforced: true, version: 2 });
  });
});

describe('recording consent', () => {
  it('keeps an append-only history and versions the current state', async () => {
    await grant('transcription', 0);
    await grant('transcription', 1, false);
    const records = [...db.docs.entries()].filter(([k]) => k.startsWith('meeting_consents/ws-a__m-1/records/'));
    expect(records.map(([, v]) => v.granted)).toEqual([true, false]);
    const current = await readMeetingConsents(db.asFirestore(), 'm-1', 'ws-a');
    expect(current.version).toBe(2);
    expect(current.current.transcription?.granted).toBe(false);
  });

  it('refuses a stale version (TOCTOU)', async () => {
    await grant('transcription', 0);
    await expect(grant('aiProcessing', 0)).rejects.toBeInstanceOf(ConsentConflictError);
  });

  it('each workspace sharing a meeting keeps its own consent (M1 review R4)', async () => {
    await recordConsent(db.asFirestore(), { workspaceId: 'ws-b', meetingId: 'm-1', type: 'transcription', granted: true, method: 'form', actorUid: 'x', expectedVersion: 0, nowIso: NOW });
    expect((await readMeetingConsents(db.asFirestore(), 'm-1', 'ws-a')).current).toEqual({});
    await grant('transcription', 0);
    expect((await readMeetingConsents(db.asFirestore(), 'm-1', 'ws-a')).current.transcription?.granted).toBe(true);
    expect((await readMeetingConsents(db.asFirestore(), 'm-1', 'ws-b')).version).toBe(1);
  });

  it('withdrawing transcription or AI consent restricts the meeting\'s transcripts', async () => {
    db.write('meeting_transcripts/t-1', { workspaceId: 'ws-a', meetingId: 'm-1', aiUse: 'allowed', version: 1 });
    db.write('meeting_transcripts/t-other', { workspaceId: 'ws-a', meetingId: 'm-2', aiUse: 'allowed', version: 1 });
    await grant('aiProcessing', 0);
    const res = await grant('aiProcessing', 1, false);
    expect(res.restrictedTranscripts).toBe(1);
    expect(db.read('meeting_transcripts/t-1')).toMatchObject({ aiUse: 'restricted', version: 2 });
    expect(db.read('meeting_transcripts/t-other')).toMatchObject({ aiUse: 'allowed' });
  });

  it('withdrawing AI consent deletes the AI output already made for the meeting', async () => {
    db.write('meeting_intelligence/m-1', { workspaceId: 'ws-a', meetingId: 'm-1', transcriptId: 't-1' });
    db.write('meeting_intelligence/m-1/items/i1', { type: 'decision' });
    db.write('meeting_intelligence/m-2', { workspaceId: 'ws-a', meetingId: 'm-2' });
    await grant('aiProcessing', 0);
    await grant('aiProcessing', 1, false);
    expect(db.read('meeting_intelligence/m-1')).toBeUndefined();
    expect(db.read('meeting_intelligence/m-1/items/i1')).toBeUndefined();
    expect(db.read('meeting_intelligence/m-2')).toBeDefined();
  });
});
