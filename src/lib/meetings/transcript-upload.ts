import 'server-only';

/**
 * @fileOverview Transcript file uploads via signed POST policies (Phase 11 M1 · T3.5).
 *
 * WHY NOT A SERVER ACTION BODY: Server Actions accept at most 2 MB here (next.config.ts) and
 * transcripts may be 5 MB. The browser therefore uploads straight to Cloud Storage with a V4 signed
 * POST policy that the server issues ONLY after authorization. Google enforces the policy's
 * conditions before the object exists (Context7, @google-cloud/storage, 2026-10-05):
 *   - exact object key (no path choice for the client, Rule 34),
 *   - exact Content-Type derived from the extension,
 *   - content-length-range 1 … 5 MB,
 *   - 10-minute expiry.
 * Storage rules stay default-deny for this prefix: no client SDK access at all.
 *
 * READ BACK: the ingest action re-validates the path prefix, checks the stored size, decodes
 * strictly (UTF-8 `fatal`, or the DOCX guard) and deletes the object afterwards (it is a staging
 * copy; the transcript lives in Firestore).
 *
 * CAUTION: never accept a storage path that this module did not build for the same workspace and
 * meeting.
 *
 * Tests: src/lib/meetings/__tests__/transcript-upload.test.ts
 */

import { randomUUID } from 'node:crypto';
import { extractDocxText } from './docx-guard';
import { MAX_TRANSCRIPT_TEXT_BYTES } from './transcript-ingestion';

export const TRANSCRIPT_UPLOAD_TTL_MS = 10 * 60 * 1000;

export const TRANSCRIPT_CONTENT_TYPES = {
  vtt: 'text/vtt',
  srt: 'application/x-subrip',
  txt: 'text/plain',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const;
export type TranscriptExtension = keyof typeof TRANSCRIPT_CONTENT_TYPES;

export class TranscriptUploadError extends Error {
  readonly code = 'VALIDATION';
  constructor(message: string) {
    super(message);
    this.name = 'TranscriptUploadError';
  }
}

/** Minimal bucket surface (the Admin SDK bucket satisfies it; tests use a fake). */
export interface UploadBucket {
  file(path: string): {
    generateSignedPostPolicyV4(options: {
      expires: number;
      conditions: Array<Array<string | number>>;
      fields: Record<string, string>;
    }): Promise<readonly [{ url: string; fields: Record<string, string> }, ...unknown[]]>;
    getMetadata(): Promise<readonly [{ size?: string | number; contentType?: string }, ...unknown[]]>;
    download(): Promise<readonly [Buffer, ...unknown[]]>;
    delete(options?: { ignoreNotFound?: boolean }): Promise<unknown>;
  };
}

export function transcriptUploadPrefix(workspaceId: string, meetingId: string): string {
  return `workspaces/${workspaceId}/meetings/${meetingId}/transcripts/`;
}

export function extensionOf(fileName: string): TranscriptExtension | null {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  return ext in TRANSCRIPT_CONTENT_TYPES ? (ext as TranscriptExtension) : null;
}

/** True only for `<prefix><uuid>.<allowed ext>` — exactly what `createUploadPolicy` builds. */
export function isTranscriptUploadPath(path: string, workspaceId: string, meetingId: string): boolean {
  const prefix = transcriptUploadPrefix(workspaceId, meetingId);
  if (!path.startsWith(prefix)) return false;
  return /^[0-9a-f-]{36}\.(vtt|srt|txt|docx)$/.test(path.slice(prefix.length));
}

export async function createUploadPolicy(
  bucket: UploadBucket,
  params: { workspaceId: string; meetingId: string; fileName: string; sizeBytes: number; nowMs: number }
): Promise<{ url: string; fields: Record<string, string>; storagePath: string; contentType: string }> {
  const ext = extensionOf(params.fileName);
  if (!ext) throw new TranscriptUploadError('Use a .vtt, .srt, .txt or .docx file.');
  if (!Number.isFinite(params.sizeBytes) || params.sizeBytes <= 0) throw new TranscriptUploadError('This file is empty.');
  if (params.sizeBytes > MAX_TRANSCRIPT_TEXT_BYTES) throw new TranscriptUploadError('This file is larger than 5 MB. Split it and try again.');

  const storagePath = `${transcriptUploadPrefix(params.workspaceId, params.meetingId)}${randomUUID()}.${ext}`;
  const contentType = TRANSCRIPT_CONTENT_TYPES[ext];
  const [policy] = await bucket.file(storagePath).generateSignedPostPolicyV4({
    expires: params.nowMs + TRANSCRIPT_UPLOAD_TTL_MS,
    conditions: [
      ['eq', '$Content-Type', contentType],
      ['content-length-range', 1, MAX_TRANSCRIPT_TEXT_BYTES],
    ],
    fields: { 'Content-Type': contentType },
  });
  return { url: policy.url, fields: policy.fields, storagePath, contentType };
}

/** Reads an uploaded transcript file as text (strict UTF-8 or guarded DOCX). */
export async function readUploadedTranscript(
  bucket: UploadBucket,
  params: { storagePath: string; workspaceId: string; meetingId: string }
): Promise<{ text: string; fileName: string }> {
  if (!isTranscriptUploadPath(params.storagePath, params.workspaceId, params.meetingId)) {
    throw new TranscriptUploadError("This file isn't in this meeting's upload folder.");
  }
  const file = bucket.file(params.storagePath);
  let meta: { size?: string | number };
  try {
    [meta] = await file.getMetadata();
  } catch {
    throw new TranscriptUploadError('The upload expired or failed. Upload the file again.');
  }
  const size = Number(meta.size ?? 0);
  if (!(size > 0) || size > MAX_TRANSCRIPT_TEXT_BYTES) throw new TranscriptUploadError('This file is larger than 5 MB. Split it and try again.');

  const [buf] = await file.download();
  const fileName = params.storagePath.split('/').pop() ?? 'transcript.txt';
  if (fileName.endsWith('.docx')) return { text: await extractDocxText(buf), fileName };
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(buf), fileName };
  } catch {
    throw new TranscriptUploadError("This file isn't UTF-8 text. Save it as UTF-8 and try again.");
  }
}

/** Best-effort removal of the staging object. */
export async function deleteUploadedTranscript(bucket: UploadBucket, storagePath: string): Promise<void> {
  await bucket.file(storagePath).delete({ ignoreNotFound: true }).catch(() => undefined);
}
