'use server';

/**
 * @fileoverview Server Actions for meeting transcripts and consent (Phase 11 M1 · T3/T5).
 *
 * Every action is a public endpoint (Rule 51): it authorizes FIRST (`requireMeetingAccess`), then
 * runs the governed capability through `executeCapability` with the verified session principal, so
 * the UI gets the same scoping, consent gate, audit, idempotency and events as agents (Rule 69).
 *
 * UPLOAD FLOW (files up to 5 MB; Server Actions are capped at 2 MB):
 *   1. createTranscriptUploadAction → signed POST policy for one exact object (10 min).
 *   2. Browser POSTs the file to Cloud Storage.
 *   3. ingestUploadedTranscriptAction → read back strictly, ingest, delete the staging object.
 *
 * CAUTION: errors returned to the browser are plain, user-facing messages; never return stack
 * traces or transcript content in errors.
 *
 * Tests: src/lib/__tests__/meetings/meeting-transcript-actions.test.ts
 */

import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { requireMeetingAccess } from '@/lib/meetings/meeting-auth';
import { executeCapability } from '@/platform/capabilities/execution/execute-capability';
import { createServerActionInvocation } from '@/platform/capabilities/execution/invocation';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import { resolvePrincipalFromSession } from '@/platform/capabilities/policy/session-principal-resolver';
import type { AuthContext } from '@/lib/auth/require-auth';
import {
  createUploadPolicy,
  deleteUploadedTranscript,
  readUploadedTranscript,
  TranscriptUploadError,
  type UploadBucket,
} from '@/lib/meetings/transcript-upload';
import { DocxRejectedError } from '@/lib/meetings/docx-guard';
import { readMeetingConsents, type ConsentType, type MeetingConsents } from '@/lib/meetings/consent-store';
import { deleteTranscriptCascade } from '@/lib/meetings/retention-service';
import { randomUUID } from 'node:crypto';
import { defaultAuditSink } from '@/platform/capabilities/storage/audit-store';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';
import type { MeetingGetTranscriptOutput, MeetingIngestTranscriptOutput, MeetingRecordConsentOutput, MeetingTranscribeRecordingOutput } from '@/platform/domains/meetings_conversations';
import { TranscriptHeaderSchema } from '@/lib/meetings/transcript-store';

/**
 * Paste limit in UTF-8 BYTES (M1 review L1): multi-byte text (e.g. accented or non-Latin) could pass a
 * character cap yet exceed the 2 MB Server Action body. Leaves room for JSON overhead.
 */
const MAX_PASTE_BYTES = 1_800_000;

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function errorMessage(err: unknown): string {
  if (err instanceof TranscriptUploadError || err instanceof DocxRejectedError) return err.message;
  return 'Something went wrong. Try again.';
}

async function runAsUser<T>(ctx: AuthContext, workspaceId: string, capabilityId: string, input: Record<string, unknown>): Promise<ActionResult<T>> {
  ensureCapabilitiesRegistered();
  const principal = await resolvePrincipalFromSession(workspaceId, { authContext: ctx });
  const result = await executeCapability<T>(createServerActionInvocation({ capabilityId, input, principal }));
  return result.success ? { success: true, data: result.data } : { success: false, error: result.error.message };
}

const bucket = (): UploadBucket => adminStorage;

/** Step 1 of an upload: a signed POST policy for one exact object. */
export async function createTranscriptUploadAction(
  workspaceId: string,
  meetingId: string,
  file: { name: string; size: number }
): Promise<ActionResult<{ url: string; fields: Record<string, string>; storagePath: string }>> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  try {
    const policy = await createUploadPolicy(bucket(), {
      workspaceId, meetingId, fileName: String(file?.name ?? ''), sizeBytes: Number(file?.size ?? 0), nowMs: Date.now(),
    });
    return { success: true, data: { url: policy.url, fields: policy.fields, storagePath: policy.storagePath } };
  } catch (err) {
    return { success: false, error: errorMessage(err) };
  }
}

/** Step 3 of an upload: read the staged file, ingest it, remove the staging copy. */
export async function ingestUploadedTranscriptAction(
  workspaceId: string,
  meetingId: string,
  storagePath: string
): Promise<ActionResult<MeetingIngestTranscriptOutput>> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  let text: string;
  let fileName: string;
  try {
    ({ text, fileName } = await readUploadedTranscript(bucket(), { storagePath: String(storagePath ?? ''), workspaceId, meetingId }));
  } catch (err) {
    if (err instanceof TranscriptUploadError && err.message.startsWith("This file isn't in")) return { success: false, error: err.message };
    await deleteUploadedTranscript(bucket(), String(storagePath ?? ''));
    return { success: false, error: errorMessage(err) };
  }
  try {
    return await runAsUser<MeetingIngestTranscriptOutput>(ctx, workspaceId, 'meeting.ingest_transcript', {
      workspaceId, meetingId, source: 'upload', text, fileName,
    });
  } finally {
    await deleteUploadedTranscript(bucket(), storagePath);
  }
}

/** Paste a transcript directly (up to ~1.5 million characters; larger → upload a file). */
export async function ingestPastedTranscriptAction(
  workspaceId: string,
  meetingId: string,
  text: string
): Promise<ActionResult<MeetingIngestTranscriptOutput>> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  const value = typeof text === 'string' ? text : '';
  if (!value.trim()) return { success: false, error: 'Paste the transcript text first.' };
  if (Buffer.byteLength(value, 'utf8') > MAX_PASTE_BYTES) return { success: false, error: 'This text is too long to paste. Upload it as a file instead.' };
  return runAsUser<MeetingIngestTranscriptOutput>(ctx, workspaceId, 'meeting.ingest_transcript', {
    workspaceId, meetingId, source: 'paste', text: value,
  });
}

/** One page of a meeting's transcript for the meeting page (people only). */
export async function getMeetingTranscriptAction(
  workspaceId: string,
  meetingId: string,
  page = 0,
  transcriptId?: string
): Promise<ActionResult<MeetingGetTranscriptOutput | null>> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');
  const res = await runAsUser<MeetingGetTranscriptOutput>(ctx, workspaceId, 'meeting.get_transcript', {
    workspaceId, meetingId, page: Number.isInteger(page) && page >= 0 ? page : 0, ...(transcriptId ? { transcriptId } : {}),
  });
  // "No transcript yet" is a normal state for the page, not an error.
  if (!res.success && res.error === 'No transcript found for this meeting.') return { success: true, data: null };
  return res;
}

/** Current consents for the meeting (for the consent row). */
export async function getMeetingConsentsAction(workspaceId: string, meetingId: string): Promise<ActionResult<MeetingConsents>> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');
  try {
    return { success: true, data: await readMeetingConsents(adminDb, meetingId, workspaceId) };
  } catch {
    return { success: false, error: 'Could not load consent. Try again.' };
  }
}

/** Records or withdraws one consent. */
export async function recordMeetingConsentAction(
  workspaceId: string,
  meetingId: string,
  consent: { type: ConsentType; granted: boolean; method: 'verbal' | 'written' | 'form' | 'policy'; expectedVersion: number }
): Promise<ActionResult<MeetingRecordConsentOutput>> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  return runAsUser<MeetingRecordConsentOutput>(ctx, workspaceId, 'meeting.record_consent', {
    workspaceId, meetingId, type: consent?.type, granted: consent?.granted, method: consent?.method, expectedVersion: consent?.expectedVersion,
  });
}

/**
 * Deletes one transcript and everything derived from it (M1 · T6, plan §4.12). People only (a
 * non-delegable action: no agent capability exists for it). Bound to the version the person saw,
 * so a transcript that changed after the confirmation dialog is not deleted (Rules 18/22).
 */
export async function deleteMeetingTranscriptAction(
  workspaceId: string,
  meetingId: string,
  transcriptId: string,
  expectedVersion: number
): Promise<ActionResult<{ deleted: boolean }>> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  try {
    const snap = await adminDb.collection('meeting_transcripts').doc(String(transcriptId ?? '')).get();
    if (!snap.exists || snap.data()?.meetingId !== meetingId || snap.data()?.workspaceId !== workspaceId) {
      return { success: false, error: 'Transcript not found.' };
    }
    const nowIso = new Date().toISOString();
    const deleted = await deleteTranscriptCascade(adminDb, {
      workspaceId, transcriptId, reason: 'manual', nowIso, expectedVersion: Number(expectedVersion),
    });
    await defaultAuditSink({
      executionId: randomUUID(),
      capabilityId: 'meeting.delete_transcript',
      capabilityVersion: 'legacy-action',
      userId: ctx.uid,
      organizationId: ctx.profile.organizationId ?? '',
      workspaceId,
      correlationId: randomUUID(),
      decision: 'allowed',
      outcome: 'succeeded',
      durationMs: 0,
      stateChanged: deleted ? 'yes' : 'no',
      timestamp: nowIso,
      inputHash: sha256Hex({ meetingId, transcriptId, reason: 'manual' }),
    }).catch((auditErr: unknown) => console.error('[deleteMeetingTranscriptAction] audit failed:', auditErr));
    return { success: true, data: { deleted } };
  } catch (err) {
    return { success: false, error: err instanceof Error && err.message.includes('changed') ? 'The transcript changed. Reload and try again.' : 'Could not delete the transcript. Try again.' };
  }
}

/** Starts (or checks) transcription of an uploaded recording. Off until enabled for the workspace. */
export async function transcribeRecordingAction(
  workspaceId: string,
  meetingId: string,
  recordingId: string,
  options?: { dryRun?: boolean }
): Promise<ActionResult<MeetingTranscribeRecordingOutput>> {
  const { ctx } = await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  return runAsUser<MeetingTranscribeRecordingOutput>(ctx, workspaceId, 'meeting.transcribe_recording', {
    workspaceId, meetingId, recordingId: String(recordingId ?? ''), ...(options?.dryRun ? { dryRun: true } : {}),
  });
}

/** Status of the meeting's latest transcription job (for the progress chip). */
export async function getTranscriptionStatusAction(
  workspaceId: string,
  meetingId: string,
  transcriptId: string
): Promise<ActionResult<{ status: string; error?: string }>> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');
  const snap = await adminDb.collection('meeting_transcripts').doc(String(transcriptId ?? '')).get();
  const header = snap.exists ? TranscriptHeaderSchema.safeParse(snap.data()) : null;
  if (!header?.success || header.data.workspaceId !== workspaceId || header.data.meetingId !== meetingId) {
    return { success: false, error: 'Transcript not found.' };
  }
  return { success: true, data: { status: header.data.status, ...(header.data.error ? { error: header.data.error.message } : {}) } };
}

/** Requests cancellation; the worker stops before the provider call or before storing (Rule 26). */
export async function cancelTranscriptionAction(
  workspaceId: string,
  meetingId: string,
  transcriptId: string
): Promise<ActionResult<{ cancelRequested: boolean }>> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  const ref = adminDb.collection('meeting_transcripts').doc(String(transcriptId ?? ''));
  const result = await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const header = snap.exists ? TranscriptHeaderSchema.safeParse(snap.data()) : null;
    if (!header?.success || header.data.workspaceId !== workspaceId || header.data.meetingId !== meetingId) return null;
    if (header.data.status !== 'pending' && header.data.status !== 'processing') return false;
    tx.update(ref, { cancelRequested: true, updatedAt: new Date().toISOString() });
    return true;
  });
  if (result === null) return { success: false, error: 'Transcript not found.' };
  return { success: true, data: { cancelRequested: result } };
}
