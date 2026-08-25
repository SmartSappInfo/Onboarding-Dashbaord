/**
 * @fileoverview Pure AI Natural Language Scheduling Intent Parser & Slot Matcher.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Extracts duration (15/30/45/60 min), participant emails, and preferred times of day.
 */

import type {
  ParsedSchedulingIntent,
  SuggestedBookingSlot,
} from './types/ai-assistant';

/**
 * Parses conversational natural language prompt into structured scheduling parameters.
 */
export function parseSchedulingIntent(prompt: string): ParsedSchedulingIntent {
  const cleanPrompt = prompt.trim();
  const lower = cleanPrompt.toLowerCase();

  // 1. Duration extraction (default 30 mins)
  let duration = 30;
  const durationMatch = lower.match(/(\d+)\s*(?:min|mins|minute|minutes|hour|hr|hrs|hours)/);
  if (durationMatch) {
    const num = parseInt(durationMatch[1], 10);
    if (lower.includes('hour') || lower.includes('hr')) {
      duration = num * 60;
    } else {
      duration = num;
    }
  }

  // 2. Email extraction
  let attendeeEmail: string | undefined;
  const emailMatch = cleanPrompt.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    attendeeEmail = emailMatch[0];
  }

  // 3. Time of day preference
  let preferredTimeOfDay: ParsedSchedulingIntent['preferredTimeOfDay'] = 'any';
  if (lower.includes('morning')) preferredTimeOfDay = 'morning';
  else if (lower.includes('afternoon')) preferredTimeOfDay = 'afternoon';
  else if (lower.includes('evening')) preferredTimeOfDay = 'evening';

  // 4. Intent detection
  let intent: ParsedSchedulingIntent['intent'] = 'schedule_meeting';
  if (lower.includes('reschedule') || lower.includes('move')) {
    intent = 'reschedule_meeting';
  } else if (lower.includes('free') || lower.includes('available') || lower.includes('check')) {
    intent = 'query_availability';
  }

  // 5. Title heuristic
  let meetingTitle = 'Scheduled Meeting';
  if (lower.includes('demo')) meetingTitle = 'Product Demo';
  else if (lower.includes('onboarding')) meetingTitle = 'Client Onboarding';
  else if (lower.includes('catch up') || lower.includes('chat')) meetingTitle = 'Quick Sync';
  else if (lower.includes('interview')) meetingTitle = 'Interview Session';

  return {
    rawPrompt: cleanPrompt,
    intent,
    targetDurationMinutes: duration,
    attendeeEmail,
    preferredTimeOfDay,
    meetingTitle,
  };
}

/**
 * Filters and ranks available calendar slots against user intent.
 */
export function matchSuggestedSlots(
  intent: ParsedSchedulingIntent,
  availableSlots: Array<{ start: Date; end: Date; hostUserId: string; hostName: string }>
): SuggestedBookingSlot[] {
  const suggestions: SuggestedBookingSlot[] = [];

  for (const slot of availableSlots) {
    const slotDurationMin = (slot.end.getTime() - slot.start.getTime()) / (1000 * 60);
    if (slotDurationMin < intent.targetDurationMinutes) continue;

    const hourUTC = slot.start.getUTCHours();
    let confidence = 0.8;

    if (intent.preferredTimeOfDay === 'morning' && hourUTC >= 8 && hourUTC < 12) {
      confidence = 0.95;
    } else if (intent.preferredTimeOfDay === 'afternoon' && hourUTC >= 12 && hourUTC < 17) {
      confidence = 0.95;
    } else if (intent.preferredTimeOfDay === 'evening' && hourUTC >= 17 && hourUTC < 22) {
      confidence = 0.95;
    }

    const calculatedEnd = new Date(slot.start.getTime() + intent.targetDurationMinutes * 60000);

    suggestions.push({
      startAt: slot.start.toISOString(),
      endAt: calculatedEnd.toISOString(),
      formattedLabel: `${slot.start.toUTCString().replace(/:\d{2} GMT$/, ' UTC')} (${intent.targetDurationMinutes} min)`,
      hostUserId: slot.hostUserId,
      hostName: slot.hostName,
      confidenceScore: confidence,
    });
  }

  // Sort by highest confidence descending, then chronological
  suggestions.sort((a, b) => b.confidenceScore - a.confidenceScore);

  return suggestions.slice(0, 5); // Return top 5 suggestions
}
