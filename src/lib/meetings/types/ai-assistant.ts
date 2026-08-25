/**
 * @fileoverview Domain Types for AI Conversational Scheduling & Action Item Extraction.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - All tasks require human-in-the-loop approval before sync.
 */

export interface ParsedSchedulingIntent {
  rawPrompt: string;
  intent: 'schedule_meeting' | 'reschedule_meeting' | 'query_availability';
  targetDurationMinutes: number; // e.g. 30, 45, 60
  attendeeEmail?: string;
  attendeeName?: string;
  hostNameOrRole?: string;
  preferredTimeOfDay?: 'morning' | 'afternoon' | 'evening' | 'any';
  dateRangeStart?: string; // ISO 8601 UTC
  dateRangeEnd?: string;   // ISO 8601 UTC
  meetingTitle?: string;
}

export interface SuggestedBookingSlot {
  startAt: string; // ISO 8601 UTC
  endAt: string;   // ISO 8601 UTC
  formattedLabel: string; // e.g. "Tuesday, Aug 25 @ 2:00 PM UTC"
  hostUserId: string;
  hostName: string;
  confidenceScore: number; // 0 to 1
}

export interface AIActionItemDraft {
  id: string;
  meetingId: string;
  workspaceId: string;
  title: string;
  description?: string;
  suggestedAssigneeEmail?: string;
  suggestedAssigneeName?: string;
  suggestedDueDate?: string; // ISO 8601
  priority: 'low' | 'medium' | 'high';
  isApproved: boolean;
  syncedToCRM: boolean;
  buyingSignalDetected?: string;
  objectionDetected?: string;
  createdAt: string;
}
