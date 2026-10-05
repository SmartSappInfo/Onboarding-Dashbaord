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
 * - Playback signing is replaced by real Storage v4 signed URLs in M1 · T7.
 * - Zero 'any' policy strictly enforced; Firestore reads are parsed (recording-schemas.ts).
 *
 * Tests: src/lib/__tests__/meetings/meeting-actions-security.test.ts
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MeetingRecording } from '@/lib/meetings/types/intelligence';
import { generateRecordingShareToken } from '@/lib/meetings/recording-service';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';
import { requireMeetingAccess, requireMeetingsPermission } from '@/lib/meetings/meeting-auth';
import {
  AttachRecordingInputSchema,
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
      shareToken: generateRecordingShareToken(),
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

/**
 * Generates an authorized playback URL with a 15-minute expiration token.
 */
export async function generateRecordingPlaybackUrlAction(
  recordingId: string,
  workspaceId: string
): Promise<{ success: boolean; playbackUrl?: string; error?: string }> {
  await requireMeetingsPermission(workspaceId, 'meetings_view');

  try {
    const snap = await adminDb.collection('meeting_recordings').doc(recordingId).get();
    const parsed = snap.exists ? MeetingRecordingRecordSchema.safeParse(snap.data()) : null;
    if (!parsed?.success || parsed.data.workspaceId !== workspaceId) {
      throw new Error('Recording not found.');
    }
    const recording = parsed.data;

    // Return the mediaUrl with token parameter (replaced by real signed URLs in M1 · T7).
    const token = generateRecordingShareToken();
    const separator = recording.mediaUrl.includes('?') ? '&' : '?';
    const playbackUrl = `${recording.mediaUrl}${separator}token=${token}&expires=${Date.now() + 15 * 60 * 1000}`;

    return { success: true, playbackUrl };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
