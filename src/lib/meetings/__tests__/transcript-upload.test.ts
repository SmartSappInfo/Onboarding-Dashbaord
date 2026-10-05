// @vitest-environment node
/**
 * @fileOverview Transcript upload policy + read-back (Phase 11 M1 · T3.5).
 */
import { describe, it, expect } from 'vitest';
import {
  createUploadPolicy,
  isTranscriptUploadPath,
  readUploadedTranscript,
  TranscriptUploadError,
  type UploadBucket,
} from '../transcript-upload';

function fakeBucket(objects: Record<string, Buffer> = {}) {
  const policies: Array<Record<string, unknown>> = [];
  const deleted: string[] = [];
  const bucket: UploadBucket = {
    file: (path) => ({
      generateSignedPostPolicyV4: async (options) => {
        policies.push({ path, ...options });
        return [{ url: 'https://storage.googleapis.com/bucket', fields: { key: path, ...options.fields } }];
      },
      getMetadata: async () => {
        if (!objects[path]) throw new Error('No such object');
        return [{ size: objects[path].length }];
      },
      download: async () => [objects[path]],
      delete: async () => {
        deleted.push(path);
      },
    }),
  };
  return { bucket, policies, deleted };
}

describe('upload policy', () => {
  it('binds the exact key, content type, size range and a short expiry', async () => {
    const { bucket, policies } = fakeBucket();
    const res = await createUploadPolicy(bucket, { workspaceId: 'ws-a', meetingId: 'm-1', fileName: 'Call.VTT', sizeBytes: 1200, nowMs: 1_000 });
    expect(res.contentType).toBe('text/vtt');
    expect(isTranscriptUploadPath(res.storagePath, 'ws-a', 'm-1')).toBe(true);
    expect(policies[0]).toMatchObject({
      expires: 1_000 + 10 * 60 * 1000,
      conditions: [['eq', '$Content-Type', 'text/vtt'], ['content-length-range', 1, 5 * 1024 * 1024]],
    });
  });

  it('refuses unsupported types, empty and oversize files', async () => {
    const { bucket } = fakeBucket();
    const base = { workspaceId: 'ws-a', meetingId: 'm-1', nowMs: 0 };
    await expect(createUploadPolicy(bucket, { ...base, fileName: 'x.exe', sizeBytes: 10 })).rejects.toThrow('.vtt, .srt, .txt or .docx');
    await expect(createUploadPolicy(bucket, { ...base, fileName: 'x.txt', sizeBytes: 0 })).rejects.toThrow('empty');
    await expect(createUploadPolicy(bucket, { ...base, fileName: 'x.txt', sizeBytes: 6 * 1024 * 1024 })).rejects.toThrow('larger than 5 MB');
  });
});

describe('read back', () => {
  const good = 'workspaces/ws-a/meetings/m-1/transcripts/123e4567-e89b-12d3-a456-426614174000.txt';

  it('only accepts paths this module builds for the same workspace and meeting', () => {
    expect(isTranscriptUploadPath(good, 'ws-a', 'm-1')).toBe(true);
    for (const bad of [
      good.replace('ws-a', 'ws-b'),
      'workspaces/ws-a/meetings/m-1/transcripts/../../m-2/transcripts/123e4567-e89b-12d3-a456-426614174000.txt',
      'workspaces/ws-a/meetings/m-1/transcripts/evil.sh',
      'workspaces/ws-a/meetings/m-1/recordings/123e4567-e89b-12d3-a456-426614174000.txt',
    ]) {
      expect(isTranscriptUploadPath(bad, 'ws-a', 'm-1'), bad).toBe(false);
    }
  });

  it('decodes strict UTF-8 text', async () => {
    const { bucket } = fakeBucket({ [good]: Buffer.from('Ama: Akwaaba — welcome') });
    await expect(readUploadedTranscript(bucket, { storagePath: good, workspaceId: 'ws-a', meetingId: 'm-1' })).resolves.toMatchObject({ text: 'Ama: Akwaaba — welcome' });
  });

  it('refuses non-UTF-8 files, missing uploads and foreign paths', async () => {
    const { bucket } = fakeBucket({ [good]: Buffer.from([0xff, 0xfe, 0x41, 0x00, 0xc3]) });
    await expect(readUploadedTranscript(bucket, { storagePath: good, workspaceId: 'ws-a', meetingId: 'm-1' })).rejects.toThrow('UTF-8');
    const empty = fakeBucket();
    await expect(readUploadedTranscript(empty.bucket, { storagePath: good, workspaceId: 'ws-a', meetingId: 'm-1' })).rejects.toThrow('Upload the file again');
    await expect(readUploadedTranscript(bucket, { storagePath: good, workspaceId: 'ws-b', meetingId: 'm-1' })).rejects.toBeInstanceOf(TranscriptUploadError);
  });
});
