'use server';

/**
 * @fileoverview Server Actions for Meeting Recordings management.
 * Handles recording registration, retrieval, short-lived playback signing, and deletion.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All playback URLs are ephemeral signed URLs generated server-side.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { MeetingRecording } from '@/lib/meetings/types/intelligence';
import { generateRecordingShareToken, isValidMediaFormat } from '@/lib/meetings/recording-service';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';

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
  try {
    const { workspaceId, organizationId, meetingId, provider, externalRecordingId, mediaUrl, storagePath, durationSeconds, fileSizeBytes, format } = payload;
    const now = new Date().toISOString();

    if (!mediaUrl) {
      throw new Error('Media URL is required to attach a recording.');
    }

    const docRef = adminDb.collection('meeting_recordings').doc();
    const shareToken = generateRecordingShareToken();

    const recording: MeetingRecording = {
      id: docRef.id,
      workspaceId,
      organizationId,
      meetingId,
      provider,
      externalRecordingId,
      mediaUrl,
      storagePath,
      durationSeconds: Math.max(0, durationSeconds || 0),
      fileSizeBytes: fileSizeBytes || 0,
      format: format || 'mp4',
      status: 'available',
      shareToken,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(recording);

    // Update meeting doc hasRecording flag
    await adminDb.collection('meetings').doc(meetingId).update({
      hasRecording: true,
      updatedAt: now,
    }).catch(err => {
      console.warn('[attachMeetingRecordingAction] Failed to update meeting flag:', err);
    });

    // Log activity
    await logMeetingActivity({
      workspaceId,
      meetingId,
      actorType: 'system',
      type: 'recording_uploaded',
      description: `Recording attached via ${provider} (${Math.round(durationSeconds / 60)} min)`,
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
  try {
    const snap = await adminDb
      .collection('meeting_recordings')
      .where('meetingId', '==', meetingId)
      .where('workspaceId', '==', workspaceId)
      .get();

    const recordings: MeetingRecording[] = snap.docs.map(doc => ({
      ...(doc.data() as MeetingRecording),
      id: doc.id,
    }));

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
  try {
    const docRef = adminDb.collection('meeting_recordings').doc(recordingId);
    const snap = await docRef.get();

    if (!snap.exists) {
      throw new Error('Recording not found.');
    }

    const data = snap.data() as MeetingRecording;
    if (data.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    await docRef.delete();
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
  try {
    const snap = await adminDb.collection('meeting_recordings').doc(recordingId).get();
    if (!snap.exists) {
      throw new Error('Recording not found.');
    }

    const recording = snap.data() as MeetingRecording;
    if (recording.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    // Return the mediaUrl with token parameter
    const token = recording.shareToken || generateRecordingShareToken();
    const separator = recording.mediaUrl.includes('?') ? '&' : '?';
    const playbackUrl = `${recording.mediaUrl}${separator}token=${token}&expires=${Date.now() + 15 * 60 * 1000}`;

    return { success: true, playbackUrl };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
