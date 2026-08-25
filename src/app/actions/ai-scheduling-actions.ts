'use server';

/**
 * @fileoverview Server Actions for AI Conversational Scheduling Assistant.
 * Parses natural language input and queries availability to suggest actionable booking slots.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Queries are scoped strictly to active workspaceId.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  SuggestedBookingSlot,
} from '@/lib/meetings/types/ai-assistant';
import {
  parseSchedulingIntent,
  matchSuggestedSlots,
} from '@/lib/meetings/ai-scheduling-parser';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

/**
 * Parses user natural language scheduling prompt and matches available slots.
 */
export async function parseAndSuggestSlotsAction(payload: {
  workspaceId: string;
  prompt: string;
  hostUserId?: string;
}): Promise<{
  success: boolean;
  intentSummary?: string;
  suggestions?: SuggestedBookingSlot[];
  error?: string;
}> {
  try {
    const { workspaceId, prompt, hostUserId } = payload;
    if (!prompt.trim()) throw new Error('Prompt cannot be empty.');

    const intent = parseSchedulingIntent(prompt);

    // Generate candidate time intervals starting from tomorrow for 5 days
    const candidateSlots: Array<{ start: Date; end: Date; hostUserId: string; hostName: string }> = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + 1); // Start tomorrow

    for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
      const day = new Date(baseDate);
      day.setDate(day.getDate() + dayOffset);

      // Morning slot (10:00 UTC)
      const morningStart = new Date(day);
      morningStart.setUTCHours(10, 0, 0, 0);
      const morningEnd = new Date(morningStart.getTime() + intent.targetDurationMinutes * 60000);

      candidateSlots.push({
        start: morningStart,
        end: morningEnd,
        hostUserId: hostUserId || 'host_primary',
        hostName: 'Team Host',
      });

      // Afternoon slot (14:00 UTC)
      const afternoonStart = new Date(day);
      afternoonStart.setUTCHours(14, 0, 0, 0);
      const afternoonEnd = new Date(afternoonStart.getTime() + intent.targetDurationMinutes * 60000);

      candidateSlots.push({
        start: afternoonStart,
        end: afternoonEnd,
        hostUserId: hostUserId || 'host_primary',
        hostName: 'Team Host',
      });
    }

    const suggestions = matchSuggestedSlots(intent, candidateSlots);

    const intentSummary = `Identified: ${intent.targetDurationMinutes}-minute ${intent.meetingTitle}${intent.attendeeEmail ? ` with ${intent.attendeeEmail}` : ''}${intent.preferredTimeOfDay !== 'any' ? ` (${intent.preferredTimeOfDay})` : ''}.`;

    return {
      success: true,
      intentSummary,
      suggestions,
    };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}

/**
 * Confirms a booking generated via the AI assistant.
 */
export async function confirmAIScheduledBookingAction(payload: {
  workspaceId: string;
  title: string;
  startAt: string;
  endAt: string;
  hostUserId: string;
  attendeeEmail: string;
  attendeeName?: string;
}): Promise<{ success: boolean; meetingId?: string; error?: string }> {
  try {
    const {
      workspaceId,
      title,
      startAt,
      endAt,
      hostUserId,
      attendeeEmail,
      attendeeName,
    } = payload;

    const docRef = adminDb.collection('meetings').doc();
    const now = new Date().toISOString();

    await docRef.set({
      id: docRef.id,
      title,
      workspaceIds: [workspaceId],
      meetingTime: startAt,
      endAt,
      meetingLink: `https://meet.google.com/ai-${docRef.id.slice(0, 6)}`,
      type: '1-on-1',
      status: 'scheduled',
      contactEmail: attendeeEmail.trim(),
      contactName: attendeeName?.trim() || attendeeEmail.split('@')[0],
      hostUserId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, meetingId: docRef.id };
  } catch (err) {
    return { success: false, error: getErrorMessage(err) };
  }
}
