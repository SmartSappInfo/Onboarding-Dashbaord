/**
 * Direct Fallback Meeting Room & Device Check Lobby
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Next.js 15 App Router server component adhering to async params convention.
 * - Resolves session metadata without requiring user authentication so public guests
 *   and invitees can join seamlessly.
 * - Only passes public, sanitized metadata to the client (no tokens, credentials, or PII).
 * - Minimum 44px touch targets on interactive elements.
 */

import * as React from 'react';
import type { Metadata } from 'next';
import { adminDb } from '@/lib/firebase-admin';
import DirectMeetingRoomClient, { type DirectRoomSessionData } from './DirectMeetingRoomClient';

interface RoomPageProps {
  params: Promise<{
    roomId: string;
  }>;
}

export async function generateMetadata({ params }: RoomPageProps): Promise<Metadata> {
  const { roomId } = await params;
  return {
    title: `Meeting Room | SmartSapp`,
    description: `Join virtual meeting room ${roomId}`,
    robots: { index: false, follow: false },
  };
}

export default async function DirectMeetingRoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;

  let sessionData: DirectRoomSessionData = {
    roomId,
    title: 'SmartSapp Virtual Meeting',
    hostName: 'Meeting Host',
    durationMinutes: 30,
    isAdHoc: true,
  };

  try {
    // 1. Check in meetings collection
    const meetingSnap = await adminDb.collection('meetings').doc(roomId).get();
    if (meetingSnap.exists) {
      const data = meetingSnap.data();
      sessionData = {
        roomId,
        title: data?.title || 'SmartSapp Virtual Meeting',
        hostName: data?.hostName || data?.userName || 'Meeting Host',
        startAt: data?.meetingTime || data?.startTime,
        durationMinutes: data?.durationMinutes || data?.duration || 30,
        externalJoinUrl: data?.meetingLink && !data.meetingLink.includes(`/meetings/room/${roomId}`)
          ? data.meetingLink
          : undefined,
        isAdHoc: false,
      };
    } else {
      // 2. Check by query if roomId was custom-generated or stored in meetingLink
      const querySnap = await adminDb
        .collection('meetings')
        .where('meetingSlug', '==', `booking-${roomId}`)
        .limit(1)
        .get();

      if (!querySnap.empty) {
        const data = querySnap.docs[0].data();
        sessionData = {
          roomId,
          title: data?.title || 'SmartSapp Virtual Meeting',
          hostName: data?.hostName || 'Meeting Host',
          startAt: data?.meetingTime || data?.startTime,
          durationMinutes: data?.durationMinutes || 30,
          externalJoinUrl: data?.meetingLink && !data.meetingLink.includes(`/meetings/room/${roomId}`)
            ? data.meetingLink
            : undefined,
          isAdHoc: false,
        };
      } else {
        // 3. Check in bookings collection
        const bookingSnap = await adminDb.collection('bookings').doc(roomId).get();
        if (bookingSnap.exists) {
          const bData = bookingSnap.data();
          sessionData = {
            roomId,
            title: bData?.eventTypeName || 'SmartSapp Virtual Meeting',
            hostName: 'Meeting Host',
            startAt: bData?.startAt,
            durationMinutes: 30,
            externalJoinUrl: bData?.joinUrl && !bData.joinUrl.includes(`/meetings/room/${roomId}`)
              ? bData.joinUrl
              : undefined,
            isAdHoc: false,
          };
        }
      }
    }
  } catch (err) {
    console.warn('[DirectMeetingRoomPage] Could not resolve session metadata for room:', roomId, err);
  }

  return <DirectMeetingRoomClient sessionData={sessionData} />;
}
