// @vitest-environment node
/**
 * @fileOverview Transcript + consent Server Actions through the real gateway (Phase 11 M1 · T3/T5).
 *
 * Proves: auth before anything; legacy `meetings_manage` roles reach the governed capabilities via
 * the scope mapping; paste and upload ingest end to end; the staging upload is always deleted;
 * consent is recorded by people; "no transcript yet" is a normal state.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';

const h = vi.hoisted(() => ({
  signedIn: true,
  permissions: ['meetings_manage'] as string[],
  db: undefined as unknown,
  objects: {} as Record<string, Buffer>,
  deleted: [] as string[],
}));

vi.mock('@/lib/auth/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/require-auth')>();
  return {
    ...actual,
    requireWorkspace: vi.fn(async (workspaceId: string) => {
      if (!h.signedIn) throw new actual.UnauthorizedError('Not signed in.');
      if (workspaceId !== 'ws-a') throw new actual.ForbiddenError('No access to this workspace.');
      return { uid: 'user-1', isSystemAdmin: false, profile: { organizationId: 'org-1', workspaceIds: ['ws-a'], permissions: h.permissions } };
    }),
  };
});
vi.mock('@/platform/capabilities/storage/audit-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/capabilities/storage/audit-store')>();
  return { ...actual, defaultAuditSink: vi.fn(async () => undefined) };
});
vi.mock('@/lib/workspace-permissions', () => ({
  checkWorkspacePermission: vi.fn(async () => (h.permissions.includes('meetings_manage') ? { granted: true } : { granted: false })),
}));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
  adminStorage: {
    file: (path: string) => ({
      generateSignedPostPolicyV4: async (o: { fields: Record<string, string> }) => [{ url: 'https://storage.googleapis.com/b', fields: { key: path, ...o.fields } }],
      getMetadata: async () => {
        if (!h.objects[path]) throw new Error('missing');
        return [{ size: h.objects[path].length }];
      },
      download: async () => [h.objects[path]],
      delete: async () => {
        h.deleted.push(path);
      },
    }),
  },
}));

import {
  createTranscriptUploadAction,
  getMeetingConsentsAction,
  getMeetingTranscriptAction,
  ingestPastedTranscriptAction,
  ingestUploadedTranscriptAction,
  recordMeetingConsentAction,
  deleteMeetingTranscriptAction,
} from '@/app/actions/meeting-transcript-actions';

let db: FakeFirestore;
beforeEach(() => {
  db = new FakeFirestore();
  h.db = db;
  h.signedIn = true;
  h.permissions = ['meetings_manage'];
  h.objects = {};
  h.deleted = [];
  db.write('meetings/m-1', { workspaceIds: ['ws-a'], title: 'Demo' });
  db.write('meetings/m-b', { workspaceIds: ['ws-b'] });
});

describe('transcript actions', () => {
  it('refuse anonymous callers, foreign meetings and members without meetings_manage', async () => {
    h.signedIn = false;
    await expect(ingestPastedTranscriptAction('ws-a', 'm-1', 'Ama: hi')).rejects.toThrow('Not signed in.');
    h.signedIn = true;
    await expect(ingestPastedTranscriptAction('ws-a', 'm-b', 'Ama: hi')).rejects.toThrow('Meeting not found.');
    h.permissions = [];
    await expect(ingestPastedTranscriptAction('ws-a', 'm-1', 'Ama: hi')).rejects.toThrow('permission to manage meetings');
    await expect(createTranscriptUploadAction('ws-a', 'm-1', { name: 'a.vtt', size: 10 })).rejects.toThrow('permission to manage meetings');
  });

  it('paste → stored transcript → readable page (legacy role reaches the governed capability)', async () => {
    expect(await getMeetingTranscriptAction('ws-a', 'm-1')).toEqual({ success: true, data: null });
    const res = await ingestPastedTranscriptAction('ws-a', 'm-1', 'Ama: We will send the proposal.\nKwame: Great.');
    expect(res.success).toBe(true);
    const page = await getMeetingTranscriptAction('ws-a', 'm-1');
    expect(page.success && page.data?.segments.map((s) => s.speakerName)).toEqual(['Ama', 'Kwame']);
    expect(page.success && page.data?.trust).toBe('untrusted_customer_content');
  });

  it('upload → ingest reads the staged file and always deletes it', async () => {
    const policy = await createTranscriptUploadAction('ws-a', 'm-1', { name: 'call.vtt', size: 80 });
    expect(policy.success).toBe(true);
    if (!policy.success) return;
    h.objects[policy.data.storagePath] = Buffer.from('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n<v Ama>Hello');
    const res = await ingestUploadedTranscriptAction('ws-a', 'm-1', policy.data.storagePath);
    expect(res.success).toBe(true);
    expect(h.deleted).toEqual([policy.data.storagePath]);

    const broken = await createTranscriptUploadAction('ws-a', 'm-1', { name: 'b.txt', size: 3 });
    if (!broken.success) return;
    h.objects[broken.data.storagePath] = Buffer.from('   ');
    const failed = await ingestUploadedTranscriptAction('ws-a', 'm-1', broken.data.storagePath);
    expect(failed.success).toBe(false);
    expect(h.deleted).toContain(broken.data.storagePath);
  });

  it('refuses a storage path outside this meeting without touching it', async () => {
    const res = await ingestUploadedTranscriptAction('ws-a', 'm-1', 'workspaces/ws-b/meetings/m-b/transcripts/123e4567-e89b-12d3-a456-426614174000.txt');
    expect(res.success).toBe(false);
    expect(h.deleted).toEqual([]);
  });

  it('tells people to upload when the pasted text is too long', async () => {
    // 700k three-byte characters = 2.1 MB: under a character cap, over the byte cap (M1 review L1).
    const res = await ingestPastedTranscriptAction('ws-a', 'm-1', '€'.repeat(700_000));
    expect(res).toEqual({ success: false, error: 'This text is too long to paste. Upload it as a file instead.' });
  });

  it('records consent and then enforcement lets ingestion through', async () => {
    db.write('meeting_compliance_policies/ws-a', { workspaceId: 'ws-a', enforceHostConsentForAI: true, updatedAt: 'v1' });
    const refused = await ingestPastedTranscriptAction('ws-a', 'm-1', 'Ama: hi');
    expect(!refused.success && refused.error).toContain('transcription consent');
    const consent = await recordMeetingConsentAction('ws-a', 'm-1', { type: 'transcription', granted: true, method: 'verbal', expectedVersion: 0 });
    expect(consent.success).toBe(true);
    const current = await getMeetingConsentsAction('ws-a', 'm-1');
    expect(current.success && current.data.current.transcription?.granted).toBe(true);
    expect((await ingestPastedTranscriptAction('ws-a', 'm-1', 'Ama: hi')).success).toBe(true);
  });

  it('deletes a transcript only at the version the person confirmed', async () => {
    const res = await ingestPastedTranscriptAction('ws-a', 'm-1', 'Ama: delete me later');
    expect(res.success).toBe(true);
    if (!res.success) return;
    const id = res.data.transcriptId;
    expect(await deleteMeetingTranscriptAction('ws-a', 'm-1', id, 0)).toEqual({ success: false, error: 'The transcript changed. Reload and try again.' });
    expect(await deleteMeetingTranscriptAction('ws-a', 'm-1', id, 1)).toEqual({ success: true, data: { deleted: true } });
    expect(db.read(`meeting_transcripts/${id}`)).toBeUndefined();
    expect(await getMeetingTranscriptAction('ws-a', 'm-1')).toEqual({ success: true, data: null });
  });
});
