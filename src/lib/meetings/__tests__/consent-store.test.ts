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
    const records = [...db.docs.entries()].filter(([k]) => k.startsWith('meeting_consents/m-1/records/'));
    expect(records.map(([, v]) => v.granted)).toEqual([true, false]);
    const current = await readMeetingConsents(db.asFirestore(), 'm-1', 'ws-a');
    expect(current.version).toBe(2);
    expect(current.current.transcription?.granted).toBe(false);
  });

  it('refuses a stale version (TOCTOU)', async () => {
    await grant('transcription', 0);
    await expect(grant('aiProcessing', 0)).rejects.toBeInstanceOf(ConsentConflictError);
  });

  it('ignores and refuses to overwrite consent owned by another workspace (shared meeting)', async () => {
    db.write('meeting_consents/m-1', { workspaceId: 'ws-b', meetingId: 'm-1', version: 3, current: { transcription: { granted: true, method: 'form', recordedBy: 'x', at: NOW } }, updatedAt: NOW });
    expect((await readMeetingConsents(db.asFirestore(), 'm-1', 'ws-a')).current).toEqual({});
    await expect(grant('transcription', 0)).rejects.toBeInstanceOf(ConsentConflictError);
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
});
