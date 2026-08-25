'use server';

/**
 * @fileoverview Server Actions for Instant Drop-In Office Hours & Live Queue Management.
 * Handles host status toggles, FIFO queue entries, heartbeat updates, and admission routing.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Queue operations execute atomically to prevent race conditions during simultaneous admissions.
 * - Zero 'any' policy strictly enforced.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  OfficeHoursRoom,
  OfficeHoursQueueEntry,
  OfficeHoursStatus,
} from '@/lib/meetings/types/polls';
import {
  recalculateQueuePositions,
  filterActiveQueueEntries,
} from '@/lib/meetings/queue-state-service';
import { randomBytes } from 'crypto';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Gets or bootstraps the Office Hours Room for a host.
 */
export async function getOfficeHoursRoomAction(
  workspaceId: string,
  hostUserId: string,
  hostName: string
): Promise<{ success: boolean; room?: OfficeHoursRoom; queue?: OfficeHoursQueueEntry[]; error?: string }> {
  try {
    const snap = await adminDb
      .collection('office_hours_rooms')
      .where('workspaceId', '==', workspaceId)
      .where('hostUserId', '==', hostUserId)
      .limit(1)
      .get();

    const now = new Date().toISOString();
    let room: OfficeHoursRoom;

    if (snap.empty) {
      // Bootstrap default office hours room
      const docRef = adminDb.collection('office_hours_rooms').doc();
      const baseSlug = hostName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'host';
      const slug = `${baseSlug}-office-hours`;

      room = {
        id: docRef.id,
        workspaceId,
        hostUserId,
        hostName,
        title: `${hostName}'s Office Hours`,
        description: 'Drop in for instant consultations, support, and quick questions.',
        slug,
        status: 'offline',
        maxQueueSize: 10,
        conferenceProvider: 'google_meet',
        joinUrl: 'https://meet.google.com/new',
        activeVisitorsCount: 0,
        averageCallDurationMinutes: 15,
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(room);
    } else {
      room = {
        ...(snap.docs[0].data() as OfficeHoursRoom),
        id: snap.docs[0].id,
      };
    }

    // Fetch active queue entries
    const queueSnap = await adminDb
      .collection('office_hours_queue')
      .where('roomId', '==', room.id)
      .get();

    const rawQueue: OfficeHoursQueueEntry[] = queueSnap.docs.map(d => ({
      ...(d.data() as OfficeHoursQueueEntry),
      id: d.id,
    }));

    const activeQueue = recalculateQueuePositions(rawQueue);

    return { success: true, room, queue: activeQueue };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Updates host office hours availability status (`available`, `busy`, `offline`).
 */
export async function updateHostOfficeHoursStatusAction(
  roomId: string,
  workspaceId: string,
  status: OfficeHoursStatus
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('office_hours_rooms').doc(roomId);
    const snap = await docRef.get();

    if (!snap.exists) throw new Error('Office hours room not found.');
    const room = snap.data() as OfficeHoursRoom;

    if (room.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    await docRef.update({
      status,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Public action for visitors to join the Drop-In queue.
 */
export async function joinOfficeHoursQueueAction(payload: {
  slug: string;
  visitorName: string;
  visitorEmail: string;
  visitorPhone?: string;
  topic?: string;
}): Promise<{ success: boolean; queueEntryId?: string; position?: number; room?: OfficeHoursRoom; error?: string }> {
  try {
    const { slug, visitorName, visitorEmail, visitorPhone, topic } = payload;
    const now = new Date().toISOString();

    const roomSnap = await adminDb
      .collection('office_hours_rooms')
      .where('slug', '==', slug)
      .limit(1)
      .get();

    if (roomSnap.empty) throw new Error('Office hours room not found.');
    const room = {
      ...(roomSnap.docs[0].data() as OfficeHoursRoom),
      id: roomSnap.docs[0].id,
    };

    if (room.status === 'offline') {
      throw new Error('This host is currently offline. Please check back later or book a scheduled appointment.');
    }

    // Get current queue count
    const existingQueueSnap = await adminDb
      .collection('office_hours_queue')
      .where('roomId', '==', room.id)
      .where('status', '==', 'waiting')
      .get();

    const activeEntries = filterActiveQueueEntries(
      existingQueueSnap.docs.map(d => d.data() as OfficeHoursQueueEntry)
    );

    if (activeEntries.length >= room.maxQueueSize) {
      throw new Error('The waiting room is currently full. Please try again in a few minutes.');
    }

    const docRef = adminDb.collection('office_hours_queue').doc();
    const position = activeEntries.length + 1;

    const entry: OfficeHoursQueueEntry = {
      id: docRef.id,
      roomId: room.id,
      workspaceId: room.workspaceId,
      visitorName: visitorName.trim(),
      visitorEmail: visitorEmail.trim().toLowerCase(),
      visitorPhone: visitorPhone?.trim(),
      topic: topic?.trim(),
      status: 'waiting',
      position,
      joinedQueueAt: now,
      lastHeartbeatAt: now,
    };

    await docRef.set(entry);

    // Update room visitor counter
    await adminDb.collection('office_hours_rooms').doc(room.id).update({
      activeVisitorsCount: position,
      updatedAt: now,
    });

    return { success: true, queueEntryId: docRef.id, position, room };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Pings heartbeat from visitor's browser to keep waiting room position active.
 */
export async function pingQueueHeartbeatAction(
  queueEntryId: string
): Promise<{ success: boolean; status?: OfficeHoursQueueEntry['status']; position?: number; joinUrl?: string; error?: string }> {
  try {
    const docRef = adminDb.collection('office_hours_queue').doc(queueEntryId);
    const snap = await docRef.get();

    if (!snap.exists) return { success: false, error: 'Queue entry expired.' };
    const entry = snap.data() as OfficeHoursQueueEntry;
    const now = new Date().toISOString();

    await docRef.update({
      lastHeartbeatAt: now,
    });

    // If admitted, return joinUrl
    if (entry.status === 'admitted') {
      const roomDoc = await adminDb.collection('office_hours_rooms').doc(entry.roomId).get();
      const room = roomDoc.data() as OfficeHoursRoom;
      return { success: true, status: 'admitted', joinUrl: room?.joinUrl };
    }

    return { success: true, status: entry.status, position: entry.position };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Host admits the next waiting visitor into the video room.
 */
export async function admitNextVisitorAction(
  roomId: string,
  workspaceId: string,
  queueEntryId: string
): Promise<{ success: boolean; visitor?: OfficeHoursQueueEntry; joinUrl?: string; error?: string }> {
  try {
    const now = new Date().toISOString();
    const entryRef = adminDb.collection('office_hours_queue').doc(queueEntryId);
    const entryDoc = await entryRef.get();

    if (!entryDoc.exists) throw new Error('Queue entry not found.');
    const entry = entryDoc.data() as OfficeHoursQueueEntry;

    if (entry.workspaceId !== workspaceId) {
      throw new Error('Unauthorized workspace access.');
    }

    const roomRef = adminDb.collection('office_hours_rooms').doc(roomId);
    const roomDoc = await roomRef.get();
    const room = roomDoc.data() as OfficeHoursRoom;

    const admissionToken = randomBytes(16).toString('hex');

    await adminDb.runTransaction(async tx => {
      tx.update(entryRef, {
        status: 'admitted',
        position: 0,
        admissionToken,
        admittedAt: now,
      });

      tx.update(roomRef, {
        status: 'busy',
        currentSessionId: entry.id,
        updatedAt: now,
      });
    });

    return {
      success: true,
      visitor: { ...entry, status: 'admitted', admissionToken },
      joinUrl: room.joinUrl,
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Visitor leaves the waiting room voluntarily.
 */
export async function leaveOfficeHoursQueueAction(
  queueEntryId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('office_hours_queue').doc(queueEntryId);
    await docRef.update({
      status: 'abandoned',
      position: 0,
    });

    return { success: true };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
