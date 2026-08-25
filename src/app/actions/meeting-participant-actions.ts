'use server';

/**
 * @fileoverview Server Actions for Meeting Participants in SmartSapp Meetings 2.0.
 * Handles participant CRUD, multi-role promotion, RSVP state updates,
 * live attendance check-in/check-out with duration tracking, and calendar email dispatches.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Dual-writes to legacy registrants/attendees subcollections to maintain backward compatibility.
 * - Always use getErrorMessage(error) instead of any in catch blocks.
 * - Batch operations must stay under 400 ops per chunk.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingParticipant,
  ParticipantRole,
  ParticipantRsvpStatus,
  ParticipantAttendanceStatus,
} from '@/lib/meetings/types';
import {
  computeTotalAttendanceSeconds,
  validateRsvpTransition,
  validateAttendanceTransition,
  generateSecureJoinToken,
} from '@/lib/meetings/participant-service';
import { logMeetingActivity } from '@/lib/meetings/activity-logger';
import { sendEmail } from '@/lib/resend-service';
import { generateIcsContent } from '@/lib/meetings/ics-helpers';
import type { Meeting } from '@/lib/types';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export interface AddParticipantInput {
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  name: string;
  email: string;
  phone?: string;
  role?: ParticipantRole;
  contactId?: string;
  userId?: string;
  sendInviteEmail?: boolean;
}

/**
 * Adds a new participant to a meeting occurrence.
 */
export async function addMeetingParticipantAction(
  input: AddParticipantInput
): Promise<{ success: boolean; participantId?: string; error?: string }> {
  try {
    const { meetingId, workspaceId, organizationId, name, email, phone, role = 'attendee', contactId, userId, sendInviteEmail } = input;
    const now = new Date().toISOString();

    const meetingRef = adminDb.collection('meetings').doc(meetingId);
    const meetingSnap = await meetingRef.get();
    if (!meetingSnap.exists) {
      return { success: false, error: 'Meeting not found.' };
    }
    const meetingData = meetingSnap.data() as Meeting;

    const { rawToken, tokenHash } = generateSecureJoinToken();
    const docRef = meetingRef.collection('participants').doc();

    const participant: MeetingParticipant = {
      id: docRef.id,
      meetingId,
      workspaceId,
      organizationId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone?.trim() || undefined,
      role,
      rsvpStatus: 'accepted',
      attendanceStatus: 'not_joined',
      contactId,
      userId,
      tokenHash,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(participant);

    // Dual-write to legacy registrants subcollection for backward compatibility
    if (role === 'attendee') {
      await meetingRef
        .collection('registrants')
        .doc(docRef.id)
        .set({
          id: docRef.id,
          meetingId,
          name: participant.name,
          email: participant.email,
          phone: participant.phone,
          status: 'confirmed',
          registeredAt: now,
          joinToken: rawToken,
          entityId: contactId,
        })
        .catch(() => {});
    }

    // Log Activity
    await logMeetingActivity({
      workspaceId,
      meetingId,
      type: 'participant_added',
      description: `Added ${name} (${role}) to meeting.`,
      metadata: { participantId: docRef.id, role, email: participant.email },
    });

    // Optionally dispatch invitation email
    if (sendInviteEmail && participant.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://smartsapp.com';
      const joinUrl = `${appUrl}/meetings/${meetingData.type || 'consultation'}/${meetingData.meetingSlug || meetingId}/join?token=${rawToken}`;
      const startTime = meetingData.meetingTime ? new Date(meetingData.meetingTime) : new Date();
      const endTime = new Date(startTime.getTime() + (meetingData.durationMinutes || 30) * 60000);

      const ics = generateIcsContent({
        uid: `meeting-${meetingId}-${docRef.id}`,
        title: meetingData.title || meetingData.entityName || 'Meeting Invitation',
        description: `Your meeting invitation. Join URL: ${joinUrl}`,
        startAt: startTime.toISOString(),
        endAt: endTime.toISOString(),
        location: joinUrl,
        organizerName: 'SmartSapp Meetings',
        organizerEmail: 'no-reply@smartsapp.com',
        attendeeName: participant.name,
        attendeeEmail: participant.email,
      });

      await sendEmail({
        to: participant.email,
        subject: `Invitation: ${meetingData.title || meetingData.entityName || 'Meeting'}`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <h2>You're invited to ${meetingData.title || meetingData.entityName || 'a meeting'}</h2>
            <p>Hi ${participant.name},</p>
            <p>You have been added as a <strong>${role}</strong>.</p>
            <p><strong>Date & Time:</strong> ${startTime.toUTCString()}</p>
            <p style="margin-top: 24px;">
              <a href="${joinUrl}" style="background-color: #2563eb; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
                Join Meeting
              </a>
            </p>
            <p style="color: #666; font-size: 13px; margin-top: 20px;">
              A calendar invitation is attached for your convenience.
            </p>
          </div>
        `,
        attachments: [
          {
            filename: 'invite.ics',
            content: Buffer.from(ics).toString('base64'),
            type: 'text/calendar',
          },
        ],
      }).catch(err => console.error('[addMeetingParticipantAction] Email send error:', err));
    }

    return { success: true, participantId: docRef.id };
  } catch (error) {
    console.error('[addMeetingParticipantAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Updates a participant's role.
 */
export async function updateParticipantRoleAction(input: {
  meetingId: string;
  participantId: string;
  newRole: ParticipantRole;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { meetingId, participantId, newRole } = input;
    const now = new Date().toISOString();

    const pRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('participants')
      .doc(participantId);

    const snap = await pRef.get();
    if (!snap.exists) return { success: false, error: 'Participant not found.' };

    const participant = snap.data() as MeetingParticipant;

    await pRef.update({
      role: newRole,
      updatedAt: now,
    });

    await logMeetingActivity({
      workspaceId: participant.workspaceId,
      meetingId,
      type: 'role_updated',
      description: `Updated role for ${participant.name} to ${newRole}.`,
      metadata: { participantId, oldRole: participant.role, newRole },
    });

    return { success: true };
  } catch (error) {
    console.error('[updateParticipantRoleAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Updates a participant's RSVP status.
 */
export async function updateParticipantRsvpAction(input: {
  meetingId: string;
  participantId: string;
  newRsvp: ParticipantRsvpStatus;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { meetingId, participantId, newRsvp } = input;
    const now = new Date().toISOString();

    const pRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('participants')
      .doc(participantId);

    const snap = await pRef.get();
    if (!snap.exists) return { success: false, error: 'Participant not found.' };

    const participant = snap.data() as MeetingParticipant;
    if (!validateRsvpTransition(participant.rsvpStatus, newRsvp)) {
      return { success: false, error: `Invalid RSVP transition from ${participant.rsvpStatus} to ${newRsvp}.` };
    }

    await pRef.update({
      rsvpStatus: newRsvp,
      updatedAt: now,
    });

    await logMeetingActivity({
      workspaceId: participant.workspaceId,
      meetingId,
      type: 'rsvp_updated',
      description: `${participant.name} updated RSVP to ${newRsvp}.`,
      metadata: { participantId, rsvpStatus: newRsvp },
    });

    return { success: true };
  } catch (error) {
    console.error('[updateParticipantRsvpAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Live manual or automated attendance check-in/check-out toggle.
 */
export async function toggleParticipantAttendanceAction(input: {
  meetingId: string;
  participantId: string;
  targetStatus?: ParticipantAttendanceStatus;
}): Promise<{ success: boolean; newStatus?: ParticipantAttendanceStatus; error?: string }> {
  try {
    const { meetingId, participantId, targetStatus } = input;
    const now = new Date().toISOString();

    const pRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('participants')
      .doc(participantId);

    const snap = await pRef.get();
    if (!snap.exists) return { success: false, error: 'Participant not found.' };

    const participant = snap.data() as MeetingParticipant;

    let nextStatus: ParticipantAttendanceStatus;
    if (targetStatus) {
      nextStatus = targetStatus;
    } else {
      // Toggle logic
      nextStatus = participant.attendanceStatus === 'joined' ? 'left' : 'joined';
    }

    if (!validateAttendanceTransition(participant.attendanceStatus, nextStatus)) {
      return { success: false, error: `Invalid attendance transition from ${participant.attendanceStatus} to ${nextStatus}.` };
    }

    let joinedAt = participant.joinedAt;
    let leftAt = participant.leftAt;
    let totalSeconds = participant.totalAttendanceSeconds || 0;

    if (nextStatus === 'joined') {
      joinedAt = now;
      leftAt = undefined;
    } else if (nextStatus === 'left') {
      leftAt = now;
      totalSeconds = computeTotalAttendanceSeconds(joinedAt, leftAt, totalSeconds);
    }

    await pRef.update({
      attendanceStatus: nextStatus,
      joinedAt: joinedAt || null,
      leftAt: leftAt || null,
      totalAttendanceSeconds: totalSeconds,
      updatedAt: now,
    });

    // Dual-write to legacy attendees subcollection
    const attendeeRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('attendees')
      .doc(participantId);

    if (nextStatus === 'joined' || nextStatus === 'left') {
      await attendeeRef.set(
        {
          id: participantId,
          name: participant.name,
          email: participant.email,
          phone: participant.phone,
          joinedAt: joinedAt || now,
          leftAt: leftAt || null,
          durationSeconds: totalSeconds,
          updatedAt: now,
        },
        { merge: true }
      ).catch(() => {});
    }

    await logMeetingActivity({
      workspaceId: participant.workspaceId,
      meetingId,
      type: nextStatus === 'joined' ? 'participant_joined' : 'participant_left',
      description: `${participant.name} ${nextStatus === 'joined' ? 'checked in to' : 'left'} the meeting.`,
      metadata: { participantId, attendanceStatus: nextStatus, totalAttendanceSeconds: totalSeconds },
    });

    return { success: true, newStatus: nextStatus };
  } catch (error) {
    console.error('[toggleParticipantAttendanceAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Removes a participant from a meeting occurrence.
 */
export async function removeParticipantAction(input: {
  meetingId: string;
  participantId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { meetingId, participantId } = input;
    const pRef = adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('participants')
      .doc(participantId);

    const snap = await pRef.get();
    if (!snap.exists) return { success: true };

    const participant = snap.data() as MeetingParticipant;
    await pRef.delete();

    // Clean up legacy registrants / attendees
    await adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('registrants')
      .doc(participantId)
      .delete()
      .catch(() => {});

    await logMeetingActivity({
      workspaceId: participant.workspaceId,
      meetingId,
      type: 'participant_removed',
      description: `Removed ${participant.name} (${participant.role}) from meeting.`,
      metadata: { participantId, email: participant.email },
    });

    return { success: true };
  } catch (error) {
    console.error('[removeParticipantAction]', error);
    return { success: false, error: getErrorMessage(error) };
  }
}

/**
 * Bulk import multiple participants from CRM contacts.
 */
export async function bulkImportParticipantsAction(input: {
  meetingId: string;
  workspaceId: string;
  organizationId?: string;
  participants: Array<{
    name: string;
    email: string;
    phone?: string;
    role?: ParticipantRole;
    contactId?: string;
  }>;
}): Promise<{ success: boolean; importedCount: number; error?: string }> {
  try {
    const { meetingId, workspaceId, organizationId, participants } = input;
    const now = new Date().toISOString();

    let batch = adminDb.batch();
    let opsCount = 0;
    let totalImported = 0;

    for (const item of participants) {
      if (!item.name || !item.email) continue;

      const { rawToken, tokenHash } = generateSecureJoinToken();
      const pRef = adminDb
        .collection('meetings')
        .doc(meetingId)
        .collection('participants')
        .doc();

      const participant: MeetingParticipant = {
        id: pRef.id,
        meetingId,
        workspaceId,
        organizationId,
        name: item.name.trim(),
        email: item.email.trim().toLowerCase(),
        phone: item.phone?.trim(),
        role: item.role || 'attendee',
        rsvpStatus: 'accepted',
        attendanceStatus: 'not_joined',
        contactId: item.contactId,
        tokenHash,
        createdAt: now,
        updatedAt: now,
      };

      batch.set(pRef, participant);
      opsCount++;
      totalImported++;

      if (opsCount >= 400) {
        await batch.commit();
        batch = adminDb.batch();
        opsCount = 0;
      }
    }

    if (opsCount > 0) {
      await batch.commit();
    }

    await logMeetingActivity({
      workspaceId,
      meetingId,
      type: 'participant_added',
      description: `Bulk imported ${totalImported} participants.`,
      metadata: { totalImported },
    });

    return { success: true, importedCount: totalImported };
  } catch (error) {
    console.error('[bulkImportParticipantsAction]', error);
    return { success: false, importedCount: 0, error: getErrorMessage(error) };
  }
}
