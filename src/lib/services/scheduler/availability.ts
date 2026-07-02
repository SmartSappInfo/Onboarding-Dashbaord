import { adminDb } from '@/lib/firebase-admin';
import type { UserAvailability, Meeting, Task, CalendarConnection } from '@/lib/types';
import { parseISO, addMinutes, isAfter, isBefore, isEqual } from 'date-fns';
import { queryGoogleFreeBusy } from '../integrations/google-calendar';

export interface TimeSlot {
  start: string; // ISO UTC
  end: string;   // ISO UTC
}

interface InternalBusyInterval {
  start: Date;
  end: Date;
}

/**
 * Normalizes a date-time to a specific IANA timezone offset for local calculations,
 * without using the Temporal API if not available.
 */
function getLocalDateInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  parts.forEach(p => {
    map[p.type] = p.value;
  });

  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}`;
}

/**
 * Calculates available timeslots on a target day (YYYY-MM-DD) for a given workspace/user availability configuration.
 * Automatically queries internal DB and external integrations (Google/Microsoft) to detect busy times.
 */
export async function calculateFreeSlots(
  availabilityId: string,
  dateStr: string // Format: YYYY-MM-DD
): Promise<TimeSlot[]> {
  const firestore = adminDb;

  // 1. Fetch Availability Document
  const availDoc = await firestore.collection('user_availabilities').doc(availabilityId).get();
  if (!availDoc.exists) {
    return [];
  }

  const availability = availDoc.data() as UserAvailability;
  const timezone = availability.timezone || 'UTC';

  // Find the weekday for the requested date in the host's timezone
  const targetDate = new Date(`${dateStr}T00:00:00`);
  const localDayOfWeek = targetDate.toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).toLowerCase() as 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

  const daySchedule = availability.weeklySchedule.find(d => d.day === localDayOfWeek);
  if (!daySchedule || daySchedule.slots.length === 0) {
    return [];
  }

  // Define target boundary start/end in the host's timezone
  const startOfDay = new Date(`${dateStr}T00:00:00Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59Z`);

  const busyIntervals: InternalBusyInterval[] = [];

  // 2. Fetch Firestore Meetings that overlap this date
  const meetingsSnap = await firestore.collection('meetings')
    .where('workspaceIds', 'array-contains', availability.workspaceId)
    .get();

  meetingsSnap.docs.forEach(doc => {
    const meeting = doc.data() as Meeting;
    if (meeting.meetingTime && meeting.status !== 'cancelled') {
      const start = parseISO(meeting.meetingTime);
      const end = addMinutes(start, meeting.durationMinutes || 30);
      
      // Expand conflict boundaries to include availability buffers
      busyIntervals.push({
        start: addMinutes(start, -availability.bufferBeforeMinutes),
        end: addMinutes(end, availability.bufferAfterMinutes),
      });
    }
  });

  // 3. Fetch Firestore Tasks that overlap this date (treating tasks as busy if start/due dates exist)
  const tasksSnap = await firestore.collection('tasks')
    .where('workspaceId', '==', availability.workspaceId)
    .get();

  tasksSnap.docs.forEach(doc => {
    const task = doc.data() as Task;
    if (task.dueDate) {
      const due = parseISO(task.dueDate);
      const start = task.startDate ? parseISO(task.startDate) : addMinutes(due, -30);
      
      busyIntervals.push({
        start: addMinutes(start, -availability.bufferBeforeMinutes),
        end: addMinutes(due, availability.bufferAfterMinutes),
      });
    }
  });

  // 4. Query connected calendars (Google Calendar, Microsoft Teams)
  const connectionsSnap = await firestore.collection('calendar_connections')
    .where('workspaceId', '==', availability.workspaceId)
    .get();

  for (const doc of connectionsSnap.docs) {
    const conn = doc.data() as CalendarConnection;
    try {
      if (conn.provider === 'google_calendar') {
        const externalBusy = await queryGoogleFreeBusy(
          conn.id,
          startOfDay.toISOString(),
          endOfDay.toISOString()
        );
        externalBusy.forEach(slot => {
          busyIntervals.push({
            start: addMinutes(parseISO(slot.start), -availability.bufferBeforeMinutes),
            end: addMinutes(parseISO(slot.end), availability.bufferAfterMinutes),
          });
        });
      }
      // Future integrations: Microsoft Graph Calendar FreeBusy query can go here
    } catch {
      // Degrade gracefully on external API connection errors
      continue;
    }
  }

  // 5. Generate potential slots based on working hours
  const resultSlots: TimeSlot[] = [];

  daySchedule.slots.forEach(workSlot => {
    // Construct slot start & end in host's local date time context
    const slotStartStr = `${dateStr}T${workSlot.start}:00`;
    const slotEndStr = `${dateStr}T${workSlot.end}:00`;

    // To parse them correctly in the context of the user timezone:
    // Convert to Date objects matching timezone offset
    const localStart = new Date(new Date(slotStartStr).toLocaleString('en-US', { timeZone: timezone }));
    const localEnd = new Date(new Date(slotEndStr).toLocaleString('en-US', { timeZone: timezone }));

    // Generate individual slots (e.g. 30-minute steps)
    const slotDuration = 30; // 30 minutes increments
    let currentStart = localStart;

    while (isBefore(currentStart, localEnd)) {
      const currentEnd = addMinutes(currentStart, slotDuration);
      if (isAfter(currentEnd, localEnd)) {
        break;
      }

      // Check if slot overlaps with any busy interval
      const hasOverlap = busyIntervals.some(busy => {
        return (
          (isBefore(currentStart, busy.end) && isAfter(currentEnd, busy.start)) ||
          isEqual(currentStart, busy.start) ||
          isEqual(currentEnd, busy.end)
        );
      });

      if (!hasOverlap) {
        resultSlots.push({
          start: currentStart.toISOString(),
          end: currentEnd.toISOString(),
        });
      }

      currentStart = currentEnd;
    }
  });

  return resultSlots;
}
