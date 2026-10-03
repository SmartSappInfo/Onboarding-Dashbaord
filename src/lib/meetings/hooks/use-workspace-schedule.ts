/**
 * @fileoverview Real-Time Workspace Schedule & Executive Metrics Hook (Meetings 2.0).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Subscribes reactively to both 'bookings' and 'meetings' collections for the active workspace.
 * - Bridges data using the SSOT UnifiedMeetingItem domain model.
 * - All heavy calculations and metric evaluations are memoized.
 * - Zero 'any' policy strictly enforced.
 */

'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Booking } from '@/lib/meetings/types';
import type { Meeting } from '@/lib/types';
import type { UnifiedMeetingItem } from '../types/unified-meeting';
import {
  normalizeBookingToUnified,
  normalizeMeetingToUnified,
  deduplicateUnifiedMeetings,
  sortUnifiedMeetingsChronologically,
} from '../unified-meeting-service';
import { useConnectedMeetingProviders } from './use-connected-meeting-providers';

export interface ScheduleMetricsCalculationInput {
  allEvents: UnifiedMeetingItem[];
  referenceNow?: Date;
  connectedCalendarCount?: number;
}

export interface WorkspaceScheduleMetrics {
  todayEvents: UnifiedMeetingItem[];
  upcomingWeekEvents: UnifiedMeetingItem[];
  nextUpcomingSession: UnifiedMeetingItem | null;
  attendanceRate: number;
  attendanceSubtitle: string;
  unconfirmedBookings: UnifiedMeetingItem[];
  sessionsMissingLink: UnifiedMeetingItem[];
  isCalendarConnected: boolean;
  connectedCalendarCount: number;
  totalAttentionCount: number;
}

export interface WorkspaceScheduleState extends WorkspaceScheduleMetrics {
  isLoading: boolean;
  allEvents: UnifiedMeetingItem[];
  rawBookings: Booking[];
}

/**
 * Pure calculation engine for operational schedule KPIs.
 * 100% deterministic and testable without database mocks.
 */
export function calculateScheduleMetrics({
  allEvents,
  referenceNow = new Date(),
  connectedCalendarCount = 0,
}: ScheduleMetricsCalculationInput): WorkspaceScheduleMetrics {
  const nowMs = referenceNow.getTime();
  const startOfTodayMs = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate()
  ).getTime();
  const endOfTodayMs = new Date(
    referenceNow.getFullYear(),
    referenceNow.getMonth(),
    referenceNow.getDate(),
    23,
    59,
    59,
    999
  ).getTime();
  const endOfWeekMs = nowMs + 7 * 86400000;

  // 1. Filter today's events (00:00:00 to 23:59:59)
  const todayEvents = allEvents.filter(e => {
    if (e.status === 'cancelled') return false;
    const startMs = new Date(e.startAt).getTime();
    return startMs >= startOfTodayMs && startMs <= endOfTodayMs;
  });

  // 2. Filter upcoming 7 days horizon
  const upcomingWeekEvents = allEvents.filter(e => {
    if (e.status === 'cancelled') return false;
    const startMs = new Date(e.startAt).getTime();
    return startMs >= startOfTodayMs && startMs <= endOfWeekMs;
  });

  // 3. Find the nearest upcoming group session/webinar (sourceType === 'meeting')
  const upcomingGroupSessions = allEvents
    .filter(e => e.sourceType === 'meeting' && e.status !== 'cancelled')
    .filter(e => new Date(e.endAt).getTime() >= nowMs)
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  const nextUpcomingSession = upcomingGroupSessions[0] || null;

  // 4. Calculate real attendance rate
  const completedCount = allEvents.filter(e => e.status === 'completed').length;
  const noShowCount = allEvents.filter(e => e.status === 'no_show').length;
  const resolvedCount = completedCount + noShowCount;

  let attendanceRate = 100;
  let attendanceSubtitle = 'No past no-shows';

  if (resolvedCount > 0) {
    attendanceRate = Math.round((completedCount / resolvedCount) * 100);
    attendanceSubtitle = `${completedCount} completed • ${noShowCount} no-show${noShowCount === 1 ? '' : 's'}`;
  }

  // 5. Actionable items for Needs Attention
  const unconfirmedBookings = allEvents.filter(e => e.status === 'pending');

  const sessionsMissingLink = allEvents.filter(e => {
    if (e.status === 'cancelled') return false;
    const startMs = new Date(e.startAt).getTime();
    const isUpcomingOrToday = startMs >= startOfTodayMs && startMs <= endOfWeekMs;
    return isUpcomingOrToday && (!e.joinUrl || e.joinUrl.trim() === '');
  });

  const isCalendarConnected = connectedCalendarCount > 0;

  const totalAttentionCount =
    (unconfirmedBookings.length > 0 ? 1 : 0) +
    (sessionsMissingLink.length > 0 ? 1 : 0) +
    (!isCalendarConnected ? 1 : 0);

  return {
    todayEvents,
    upcomingWeekEvents,
    nextUpcomingSession,
    attendanceRate,
    attendanceSubtitle,
    unconfirmedBookings,
    sessionsMissingLink,
    isCalendarConnected,
    connectedCalendarCount,
    totalAttentionCount,
  };
}

/**
 * React hook subscribing to active workspace bookings and group meetings.
 */
export function useWorkspaceSchedule(workspaceId?: string | null): WorkspaceScheduleState {
  const firestore = useFirestore();

  // 1. Reactive subscription to 1:1 bookings
  const bookingsQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'bookings'),
      where('workspaceId', '==', workspaceId),
      orderBy('startAt', 'asc')
    );
  }, [firestore, workspaceId]);

  const { data: bookings, isLoading: isLoadingBookings } = useCollection<Booking>(bookingsQuery);

  // 2a. Reactive subscription to group meetings/webinars (multi-tenant array)
  const meetingsArrayQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'meetings'),
      where('workspaceIds', 'array-contains', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: meetingsArray, isLoading: isLoadingMeetingsArray } = useCollection<Meeting>(meetingsArrayQuery);

  // 2b. Reactive subscription to legacy scalar workspaceId meetings
  const meetingsScalarQuery = useMemoFirebase(() => {
    if (!firestore || !workspaceId) return null;
    return query(
      collection(firestore, 'meetings'),
      where('workspaceId', '==', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: meetingsScalar, isLoading: isLoadingMeetingsScalar } = useCollection<Meeting>(meetingsScalarQuery);

  // Combine and deduplicate meetings across both schema representations
  const meetings = React.useMemo(() => {
    const map = new Map<string, Meeting>();
    if (meetingsArray) {
      for (const m of meetingsArray) {
        map.set(m.id, m);
      }
    }
    if (meetingsScalar) {
      for (const m of meetingsScalar) {
        if (!map.has(m.id)) {
          map.set(m.id, m);
        }
      }
    }
    return Array.from(map.values());
  }, [meetingsArray, meetingsScalar]);

  // 3. Reactive subscription to calendar connections
  const { connectedCount: connectedCalendarCount, isLoading: isLoadingProviders } =
    useConnectedMeetingProviders(workspaceId || undefined);

  // 4. Normalize and deduplicate into unified items
  const allEvents = React.useMemo(() => {
    const rawItems: UnifiedMeetingItem[] = [];

    if (bookings) {
      for (const b of bookings) {
        rawItems.push(normalizeBookingToUnified(b));
      }
    }

    if (meetings) {
      for (const m of meetings) {
        rawItems.push(normalizeMeetingToUnified(m));
      }
    }

    const deduplicated = deduplicateUnifiedMeetings(rawItems);
    return sortUnifiedMeetingsChronologically(deduplicated, 'asc');
  }, [bookings, meetings]);

  // 5. Calculate operational metrics
  const metrics = React.useMemo(() => {
    return calculateScheduleMetrics({
      allEvents,
      referenceNow: new Date(),
      connectedCalendarCount,
    });
  }, [allEvents, connectedCalendarCount]);

  const isLoading = isLoadingBookings || isLoadingMeetingsArray || isLoadingMeetingsScalar || isLoadingProviders;

  return {
    isLoading,
    allEvents,
    rawBookings: bookings || [],
    ...metrics,
  };
}
