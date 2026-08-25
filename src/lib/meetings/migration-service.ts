/**
 * @fileoverview Migration and dual-write synchronization service for SmartSapp Meetings 2.0.
 * Backfills legacy meetings, registrants, facilitators, and attendees into the unified
 * `MeetingParticipant` and `ConferenceSession` architecture.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Chunk all Firestore batch writes to a maximum of 400 operations per batch.
 * - This service is idempotent; running it repeatedly will update existing records safely.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  MeetingParticipant,
  ConferenceSession,
  ParticipantRole,
  ParticipantAttendanceStatus,
} from './types';
import { hashParticipantToken } from './participant-service';
import { generateConferenceSession } from './conference-adapters';
import type { Meeting, MeetingRegistrant, MeetingFacilitator, Attendee } from '@/lib/types';

export interface MigrationSummary {
  meetingId: string;
  participantsCreated: number;
  conferenceSessionCreated: boolean;
  errors: string[];
}

/**
 * Migrates a single Meeting and its legacy subcollections into the unified Phase 2 schema.
 */
export async function migrateMeetingToUnifiedSchema(
  meetingId: string
): Promise<MigrationSummary> {
  const summary: MigrationSummary = {
    meetingId,
    participantsCreated: 0,
    conferenceSessionCreated: false,
    errors: [],
  };

  try {
    const meetingRef = adminDb.collection('meetings').doc(meetingId);
    const meetingSnap = await meetingRef.get();

    if (!meetingSnap.exists) {
      summary.errors.push('Meeting not found.');
      return summary;
    }

    const meetingData = meetingSnap.data() as Meeting;
    const workspaceId = (meetingData.workspaceIds && meetingData.workspaceIds[0]) || 'default';
    const now = new Date().toISOString();

    // 1. Initialize ConferenceSession if not already linked
    const existingSessionSnap = await adminDb
      .collection('conference_sessions')
      .where('meetingId', '==', meetingId)
      .limit(1)
      .get();

    if (existingSessionSnap.empty) {
      const confSession = generateConferenceSession({
        meetingId,
        workspaceId,
        organizationId: meetingData.organizationId,
        provider: meetingData.meetingLink ? 'google_meet' : 'custom',
        title: meetingData.title || meetingData.entityName || 'Meeting',
        customLink: meetingData.meetingLink,
      });

      await adminDb.collection('conference_sessions').doc(confSession.id).set(confSession);
      summary.conferenceSessionCreated = true;
    }

    // 2. Fetch legacy Facilitators
    const facilitators: MeetingFacilitator[] = meetingData.facilitators || [];

    // 3. Fetch legacy Registrants
    const registrantsSnap = await adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('registrants')
      .get();

    // 4. Fetch legacy Attendees
    const attendeesSnap = await adminDb
      .collection('meetings')
      .doc(meetingId)
      .collection('attendees')
      .get();

    const attendeeMap = new Map<string, Record<string, unknown>>();
    attendeesSnap.docs.forEach(doc => {
      const att = doc.data() as Record<string, unknown>;
      const attEmail = typeof att.email === 'string' ? att.email.toLowerCase() : '';
      if (attEmail) attendeeMap.set(attEmail, att);
    });

    // 5. Batch write participants into `meetings/{meetingId}/participants`
    let currentBatch = adminDb.batch();
    let opsInBatch = 0;

    // A. Migrate Facilitators
    for (const fac of facilitators) {
      const participantId = `p_fac_${fac.id || Math.random().toString(36).substring(2, 9)}`;
      const pRef = adminDb
        .collection('meetings')
        .doc(meetingId)
        .collection('participants')
        .doc(participantId);

      const participant: MeetingParticipant = {
        id: participantId,
        meetingId,
        workspaceId,
        organizationId: meetingData.organizationId,
        userId: fac.userId,
        name: fac.name || 'Facilitator',
        email: fac.email || '',
        phone: fac.phone,
        avatarUrl: fac.image,
        role: (fac.type === 'workspace_user' ? 'host' : 'facilitator') as ParticipantRole,
        rsvpStatus: 'accepted',
        attendanceStatus: 'not_joined',
        notes: fac.bio,
        createdAt: now,
        updatedAt: now,
      };

      currentBatch.set(pRef, participant, { merge: true });
      opsInBatch++;
      summary.participantsCreated++;

      if (opsInBatch >= 400) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opsInBatch = 0;
      }
    }

    // B. Migrate Registrants & Attendees
    for (const regDoc of registrantsSnap.docs) {
      const reg = regDoc.data() as MeetingRegistrant;
      const emailLower = (reg.email || '').toLowerCase();
      const matchedAttendee = attendeeMap.get(emailLower);

      const participantId = `p_reg_${regDoc.id}`;
      const pRef = adminDb
        .collection('meetings')
        .doc(meetingId)
        .collection('participants')
        .doc(participantId);

      const rawJoinToken = reg.token || regDoc.id;
      const tokenHash = hashParticipantToken(rawJoinToken);

      let attendanceStatus: ParticipantAttendanceStatus = 'not_joined';
      let joinedAt: string | undefined;
      let leftAt: string | undefined;
      let totalAttendanceSeconds: number | undefined;

      if (matchedAttendee) {
        attendanceStatus = 'joined';
        joinedAt = typeof matchedAttendee.joinedAt === 'string' ? matchedAttendee.joinedAt : undefined;
        leftAt = typeof matchedAttendee.leftAt === 'string' ? matchedAttendee.leftAt : undefined;
        totalAttendanceSeconds = typeof matchedAttendee.durationSeconds === 'number' ? matchedAttendee.durationSeconds : 0;
      }

      const participant: MeetingParticipant = {
        id: participantId,
        meetingId,
        workspaceId,
        organizationId: meetingData.organizationId,
        contactId: reg.entityId,
        name: reg.name || 'Registrant',
        email: reg.email || '',
        phone: reg.phone,
        role: 'attendee',
        rsvpStatus: reg.status === 'registered' || reg.status === 'approved' || reg.status === 'attended' ? 'accepted' : 'pending',
        attendanceStatus,
        registrationId: regDoc.id,
        tokenHash,
        joinedAt,
        leftAt,
        totalAttendanceSeconds,
        createdAt: reg.registeredAt || now,
        updatedAt: now,
      };

      currentBatch.set(pRef, participant, { merge: true });
      opsInBatch++;
      summary.participantsCreated++;

      if (opsInBatch >= 400) {
        await currentBatch.commit();
        currentBatch = adminDb.batch();
        opsInBatch = 0;
      }
    }

    if (opsInBatch > 0) {
      await currentBatch.commit();
    }

    return summary;
  } catch (error) {
    console.error('[migrateMeetingToUnifiedSchema]', error);
    summary.errors.push(error instanceof Error ? error.message : 'Unknown migration error.');
    return summary;
  }
}
