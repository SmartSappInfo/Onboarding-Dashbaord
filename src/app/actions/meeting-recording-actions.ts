'use server';

/**
 * @fileoverview Server Actions for Meeting Recordings management.
 * Handles recording registration, retrieval, short-lived playback signing, and deletion.
 *
 * SECURITY (Phase 11 M1 · T0, finding G1): `getMeetingRecordingsAction` and
 * `attachMeetingRecordingAction` were unauthenticated public endpoints. Every action now proves
 * sign-in + workspace membership + meetings permission + meeting ownership BEFORE touching data
 * (`requireMeetingAccess`), and auth failures throw (they are not swallowed into `{ success }`).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Organization ids come from the verified session, never from the caller.
 * - New external links must pass `isSafeExternalMediaUrl` (https only). Existing docs are untouched.
 * - Playback (M1 · T7, finding G8): files in the meeting's own Storage folder get a real 15-minute
 *   V4 signed URL (and each access is audited); external links are returned as-is, labelled, and
 *   only when they are https. The old "?token=…&expires=…" suffix signed nothing and is gone, as is
 *   share-token generation (no consumer existed).
 * - Zero 'any' policy strictly enforced; Firestore reads are parsed (recording-schemas.ts).
 *
 * Tests: src/lib/__tests__/meetings/meeting-actions-security.test.ts
 */

import { randomUUID } from 'node:crypto';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { defaultAuditSink } from '@/platform/capabilities/storage/audit-store';
import type { MeetingRecording } from '@/lib/meetings/types/intelligence';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';
import { requireMeetingAccess, requireMeetingsPermission } from '@/lib/meetings/meeting-auth';
import { randomUUID as newObjectId } from 'node:crypto';
import {
  AttachRecordingInputSchema,
  recordingStoragePrefix,
  isRecordingPathForMeeting,
  isSafeExternalMediaUrl,
  MeetingRecordingRecordSchema,
  toClientRecording,
} from '@/lib/meetings/schemas/recording-schemas';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Registers a new recording document in `meeting_recordings`.
 */
export async function attachMeetingRecordingAction(payload: {
  workspaceId: string;
  organizationId?: string;
  meetingId: string;
  provider: MeetingRecording['provider'];
  externalRecordingId?: string;
  mediaUrl: string;
  storagePath?: string;
  durationSeconds: number;
  fileSizeBytes?: number;
  format?: string;
}): Promise<{ success: boolean; recordingId?: string; error?: string }> {
  const parsed = AttachRecordingInputSchema.safeParse(payload);
  if (!parsed.success) {
    return { success: false, error: 'Please check the recording details and try again.' };
  }
  const input = parsed.data;
  const { ctx, meeting } = await requireMeetingAccess(input.workspaceId, input.meetingId, 'meetings_manage');

  try {
    if (input.storagePath) {
      if (!isRecordingPathForMeeting(input.storagePath, input.workspaceId, input.meetingId)) {
        throw new Error('This file is not in this meeting\'s recordings folder.');
      }
    } else if (!isSafeExternalMediaUrl(input.mediaUrl)) {
      throw new Error('Use a secure link that starts with https://.');
    }

    const now = new Date().toISOString();
    const docRef = adminDb.collection('meeting_recordings').doc();
    const organizationId = meeting.organizationId ?? ctx.profile.organizationId;

    const recording: MeetingRecording = {
      id: docRef.id,
      workspaceId: input.workspaceId,
      ...(organizationId ? { organizationId } : {}),
      meetingId: input.meetingId,
      provider: input.provider,
      ...(input.externalRecordingId ? { externalRecordingId: input.externalRecordingId } : {}),
      mediaUrl: input.mediaUrl,
      ...(input.storagePath ? { storagePath: input.storagePath } : {}),
      durationSeconds: Math.max(0, input.durationSeconds || 0),
      fileSizeBytes: input.fileSizeBytes || 0,
      format: input.format || 'mp4',
      status: 'available',
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(recording);

    // Update meeting doc hasRecording flag
    await adminDb.collection('meetings').doc(input.meetingId).update({
      hasRecording: true,
      updatedAt: now,
    }).catch(err => {
      console.warn('[attachMeetingRecordingAction] Failed to update meeting flag:', err);
    });

    await logMeetingActivity({
      workspaceId: input.workspaceId,
      meetingId: input.meetingId,
      actorType: 'user',
      actorId: ctx.uid,
      type: 'recording_uploaded',
      description: `Recording attached via ${input.provider} (${Math.round(input.durationSeconds / 60)} min)`,
    });

    return { success: true, recordingId: docRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Lists all recordings for a specific meeting.
 */
export async function getMeetingRecordingsAction(
  meetingId: string,
  workspaceId: string
): Promise<{ success: boolean; recordings?: MeetingRecording[]; error?: string }> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_view');

  try {
    const snap = await adminDb
      .collection('meeting_recordings')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .limit(100)
      .get();

    const recordings = snap.docs
      .map(doc => toClientRecording(doc.id, doc.data()))
      .filter((r): r is MeetingRecording => r !== null);

    return { success: true, recordings };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Deletes a recording document.
 */
export async function deleteMeetingRecordingAction(
  recordingId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  const ctx = await requireMeetingsPermission(workspaceId, 'meetings_manage');

  try {
    const docRef = adminDb.collection('meeting_recordings').doc(recordingId);
    const snap = await docRef.get();
    const recording = snap.exists ? MeetingRecordingRecordSchema.safeParse(snap.data()) : null;

    // Missing and foreign recordings look the same (no cross-tenant probing).
    if (!recording?.success || recording.data.workspaceId !== workspaceId) {
      throw new Error('Recording not found.');
    }

    await docRef.delete();
    await logMeetingActivity({
      workspaceId,
      meetingId: recording.data.meetingId,
      actorType: 'user',
      actorId: ctx.uid,
      type: 'recording_deleted',
      description: 'Recording removed',
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Signed playback links live for 15 minutes (meetings PRD §96: short expiry). */
const PLAYBACK_TTL_MS = 15 * 60 * 1000;

/**
 * Returns a playback link for one recording.
 * - Uploaded file in this meeting's folder → V4 signed URL, 15 minutes, access audited.
 * - External https link → returned as-is with `kind: 'external_link'` (we never sign or fetch it).
 */
export async function generateRecordingPlaybackUrlAction(
  recordingId: string,
  workspaceId: string
): Promise<{ success: boolean; playbackUrl?: string; kind?: 'signed' | 'external_link'; expiresAt?: string; error?: string }> {
  const ctx = await requireMeetingsPermission(workspaceId, 'meetings_view');

  try {
    const snap = await adminDb.collection('meeting_recordings').doc(recordingId).get();
    const parsed = snap.exists ? MeetingRecordingRecordSchema.safeParse(snap.data()) : null;
    if (!parsed?.success || parsed.data.workspaceId !== workspaceId || parsed.data.status === 'deleted') {
      throw new Error('Recording not found.');
    }
    const recording = parsed.data;

    if (recording.storagePath && isRecordingPathForMeeting(recording.storagePath, workspaceId, recording.meetingId)) {
      const nowMs = Date.now();
      const [playbackUrl] = await adminStorage.file(recording.storagePath).getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: nowMs + PLAYBACK_TTL_MS,
      });
      // Access audit (PRD §96). The URL itself is never logged or stored (Rule 32).
      await defaultAuditSink({
        executionId: randomUUID(),
        capabilityId: 'meeting.recording.playback',
        capabilityVersion: 'legacy-action',
        userId: ctx.uid,
        organizationId: ctx.profile.organizationId ?? '',
        workspaceId,
        correlationId: randomUUID(),
        decision: 'allowed',
        outcome: 'succeeded',
        durationMs: Math.max(0, Date.now() - nowMs),
        stateChanged: 'no',
        timestamp: new Date(nowMs).toISOString(),
        inputHash: recordingId,
      }).catch((auditErr: unknown) => console.error('[generateRecordingPlaybackUrlAction] audit failed:', auditErr));
      return { success: true, playbackUrl, kind: 'signed', expiresAt: new Date(nowMs + PLAYBACK_TTL_MS).toISOString() };
    }

    if (isSafeExternalMediaUrl(recording.mediaUrl)) {
      return { success: true, playbackUrl: recording.mediaUrl, kind: 'external_link' };
    }
    throw new Error('This recording link is not secure, so it cannot be played here.');
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/** Recording upload types (audio for transcription; video/audio for playback). */
const RECORDING_UPLOAD_TYPES: Readonly<Record<string, string>> = {
  mp3: 'audio/mp3', wav: 'audio/wav', aac: 'audio/aac', ogg: 'audio/ogg', flac: 'audio/flac', aiff: 'audio/aiff',
  m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm',
};
const MAX_RECORDING_UPLOAD_BYTES = 500 * 1024 * 1024;

/**
 * Signed POST policy for uploading a recording into the meeting's own folder (M1 · T4/T8).
 * Bound to one exact key, content type, 1 B–500 MB and 10 minutes; after upload the page calls
 * `attachMeetingRecordingAction` with the returned `storagePath` (prefix re-validated there).
 * Transcription additionally requires an audio type ≤ 14 MB (checked when requested).
 */
export async function createRecordingUploadAction(
  workspaceId: string,
  meetingId: string,
  file: { name: string; size: number }
): Promise<{ success: boolean; url?: string; fields?: Record<string, string>; storagePath?: string; error?: string }> {
  await requireMeetingAccess(workspaceId, meetingId, 'meetings_manage');
  const ext = String(file?.name ?? '').toLowerCase().split('.').pop() ?? '';
  const contentType = RECORDING_UPLOAD_TYPES[ext];
  const size = Number(file?.size ?? 0);
  if (!contentType) return { success: false, error: 'Use an MP3, WAV, AAC, OGG, FLAC, AIFF, M4A, MP4 or WebM file.' };
  if (!(size > 0) || size > MAX_RECORDING_UPLOAD_BYTES) return { success: false, error: 'Recordings must be smaller than 500 MB.' };
  try {
    const storagePath = `${recordingStoragePrefix(workspaceId, meetingId)}${newObjectId()}.${ext}`;
    const [policy] = await adminStorage.file(storagePath).generateSignedPostPolicyV4({
      expires: Date.now() + 10 * 60 * 1000,
      conditions: [['eq', '$Content-Type', contentType], ['content-length-range', 1, MAX_RECORDING_UPLOAD_BYTES]],
      fields: { 'Content-Type': contentType },
    });
    return { success: true, url: policy.url, fields: policy.fields, storagePath };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
