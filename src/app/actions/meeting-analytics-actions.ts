'use server';

/**
 * @fileoverview Server Actions for Operational Meetings Overview & Analytics.
 * Computes live KPIs, today's schedule roster, and requires-attention items.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Queries are scoped strictly to active workspaceId.
 */

import { adminDb } from '@/lib/firebase-admin';
import {
  aggregateMeetingKPIs,
  computePeakBookingHours,
  computeHostWorkload,
  type MeetingKPIOverview,
  type PeakHourBucket,
  type HostWorkloadItem,
} from '@/lib/meetings/analytics-service';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

export interface TodayAgendaItem {
  id: string;
  title: string;
  meetingTime: string;
  endTime?: string;
  duration: number;
  hostName: string;
  locationType: string;
  status: string;
  joinUrl?: string;
  attendeeCount: number;
}

export interface OperationalOverviewResult {
  kpis: MeetingKPIOverview;
  todayMeetings: TodayAgendaItem[];
  requiresAttention: {
    noVideoLinkCount: number;
    overdueFollowupsCount: number;
    pendingApprovalsCount: number;
  };
  peakHours: PeakHourBucket[];
  hostWorkloads: HostWorkloadItem[];
}

/**
 * Loads operational dashboard overview for a workspace.
 */
export async function getMeetingsOperationalOverviewAction(
  workspaceId: string
): Promise<{ success: boolean; data?: OperationalOverviewResult; error?: string }> {
  try {
    // 1. Fetch meetings
    const meetingsSnap = await adminDb
      .collection('meetings')
      .where('workspaceId', '==', workspaceId)
      .limit(200)
      .get();

    const meetings = meetingsSnap.docs.map(d => ({
      id: d.id,
      meetingTime: d.data().meetingTime || '',
      duration: Number(d.data().duration) || 30,
      status: d.data().status || 'scheduled',
      hostUserId: d.data().hostUserId,
      hostName: d.data().hostName,
      eventTypeId: d.data().eventTypeId,
      locationType: d.data().locationType || 'google_meet',
      joinUrl: d.data().joinUrl,
      attendeeCount: d.data().attendeeCount || 1,
      title: d.data().title || 'Untitled Meeting',
    }));

    // 2. Fetch bookings
    const bookingsSnap = await adminDb
      .collection('bookings')
      .where('workspaceId', '==', workspaceId)
      .limit(200)
      .get();

    const bookings = bookingsSnap.docs.map(d => ({
      id: d.id,
      startAt: d.data().startAt || '',
      status: d.data().status || 'confirmed',
      createdAt: d.data().createdAt || '',
    }));

    // 3. Fetch participants
    const participantsSnap = await adminDb
      .collection('meeting_participants')
      .where('workspaceId', '==', workspaceId)
      .limit(300)
      .get();

    const participants = participantsSnap.docs.map(d => ({
      id: d.id,
      meetingId: d.data().meetingId || '',
      status: (d.data().status || 'registered') as 'registered' | 'invited' | 'accepted' | 'waiting' | 'in_session' | 'completed' | 'no_show' | 'left_early',
      attendedDurationSeconds: d.data().attendedDurationSeconds,
    }));

    const kpis = aggregateMeetingKPIs(meetings, bookings, participants);
    const peakHours = computePeakBookingHours(bookings);
    const hostWorkloads = computeHostWorkload(meetings);

    // 4. Extract Today's Agenda
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayMeetings: TodayAgendaItem[] = meetings
      .filter(m => {
        if (m.status === 'cancelled') return false;
        const t = new Date(m.meetingTime).getTime();
        return t >= todayStart.getTime() && t <= todayEnd.getTime();
      })
      .map(m => ({
        id: m.id,
        title: m.title,
        meetingTime: m.meetingTime,
        duration: m.duration,
        hostName: m.hostName || 'Host',
        locationType: m.locationType,
        status: m.status,
        joinUrl: m.joinUrl,
        attendeeCount: m.attendeeCount,
      }));

    todayMeetings.sort((a, b) => new Date(a.meetingTime).getTime() - new Date(b.meetingTime).getTime());

    // 5. Requires Attention items
    const noVideoLinkCount = meetings.filter(
      m => m.status === 'scheduled' && !m.joinUrl && m.locationType !== 'in_person' && m.locationType !== 'phone'
    ).length;

    const noShowFollowups = participants.filter(p => p.status === 'no_show').length;

    return {
      success: true,
      data: {
        kpis,
        todayMeetings,
        requiresAttention: {
          noVideoLinkCount,
          overdueFollowupsCount: noShowFollowups,
          pendingApprovalsCount: 0,
        },
        peakHours,
        hostWorkloads,
      },
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
