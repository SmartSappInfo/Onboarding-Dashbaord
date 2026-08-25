/**
 * @fileoverview Pure Analytics & Metric Aggregation Service for SmartSapp Meetings 2.0.
 * Calculates workspace-level attendance rates, peak scheduling hours, host workloads,
 * and operational health metrics.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Handles empty datasets safely without division by zero.
 */

export interface MeetingSummaryItem {
  id: string;
  meetingTime: string;
  duration: number;
  status: string;
  hostUserId?: string;
  hostName?: string;
  eventTypeId?: string;
}

export interface BookingSummaryItem {
  id: string;
  startAt: string;
  status: string;
  createdAt: string;
}

export interface ParticipantSummaryItem {
  id: string;
  meetingId: string;
  status: 'registered' | 'invited' | 'accepted' | 'waiting' | 'in_session' | 'completed' | 'no_show' | 'left_early';
  attendedDurationSeconds?: number;
}

export interface MeetingKPIOverview {
  totalScheduledMeetings: number;
  totalBookings: number;
  overallAttendanceRate: number; // percentage 0-100
  totalMeetingHours: number;
  completedMeetingsCount: number;
  noShowCount: number;
}

export interface PeakHourBucket {
  hour: number;
  label: string; // e.g. "10:00"
  count: number;
}

export interface HostWorkloadItem {
  hostUserId: string;
  hostName: string;
  totalMeetings: number;
  totalMinutes: number;
}

/**
 * Aggregates high-level KPI cards for operational dashboards.
 */
export function aggregateMeetingKPIs(
  meetings: MeetingSummaryItem[],
  bookings: BookingSummaryItem[],
  participants: ParticipantSummaryItem[]
): MeetingKPIOverview {
  const totalScheduledMeetings = meetings.filter(m => m.status !== 'cancelled').length;
  const totalBookings = bookings.filter(b => b.status !== 'cancelled').length;

  const attendedCount = participants.filter(
    p => p.status === 'completed' || p.status === 'in_session' || (p.attendedDurationSeconds && p.attendedDurationSeconds > 60)
  ).length;

  const noShowCount = participants.filter(p => p.status === 'no_show').length;
  const totalEvaluated = attendedCount + noShowCount;

  const overallAttendanceRate =
    totalEvaluated > 0 ? Math.round((attendedCount / totalEvaluated) * 100) : 100;

  const totalMinutes = meetings
    .filter(m => m.status !== 'cancelled')
    .reduce((sum, m) => sum + (m.duration || 0), 0);

  const completedMeetingsCount = meetings.filter(m => m.status === 'completed').length;

  return {
    totalScheduledMeetings,
    totalBookings,
    overallAttendanceRate,
    totalMeetingHours: Math.round((totalMinutes / 60) * 10) / 10,
    completedMeetingsCount,
    noShowCount,
  };
}

/**
 * Computes distribution of booking creations across 24 hours of the day.
 */
export function computePeakBookingHours(bookings: BookingSummaryItem[]): PeakHourBucket[] {
  const hourCounts = new Array(24).fill(0);

  for (const b of bookings) {
    if (!b.createdAt) continue;
    const hour = new Date(b.createdAt).getHours();
    if (hour >= 0 && hour < 24) {
      hourCounts[hour] += 1;
    }
  }

  return hourCounts.map((count, hour) => ({
    hour,
    label: `${hour.toString().padStart(2, '0')}:00`,
    count,
  }));
}

/**
 * Aggregates workload distributions across team hosts.
 */
export function computeHostWorkload(meetings: MeetingSummaryItem[]): HostWorkloadItem[] {
  const hostMap = new Map<string, { hostName: string; totalMeetings: number; totalMinutes: number }>();

  for (const m of meetings) {
    if (m.status === 'cancelled') continue;
    const hostId = m.hostUserId || 'unassigned';
    const hostName = m.hostName || 'Unassigned Host';

    const existing = hostMap.get(hostId) || { hostName, totalMeetings: 0, totalMinutes: 0 };
    existing.totalMeetings += 1;
    existing.totalMinutes += m.duration || 0;
    hostMap.set(hostId, existing);
  }

  const result: HostWorkloadItem[] = [];
  hostMap.forEach((val, hostUserId) => {
    result.push({
      hostUserId,
      hostName: val.hostName,
      totalMeetings: val.totalMeetings,
      totalMinutes: val.totalMinutes,
    });
  });

  result.sort((a, b) => b.totalMeetings - a.totalMeetings);
  return result;
}
