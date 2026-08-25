/**
 * @fileoverview Domain Types for Bulk Meeting Operations & Recurring Series Exceptions.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Zero 'any' policy strictly enforced.
 * - Chunk size for bulk executions must not exceed 100 operations.
 */

export interface BulkReschedulePayload {
  meetingIds: string[];
  minuteOffsetDelta: number; // e.g. +60 (move 1 hour later) or -1440 (move 1 day earlier)
  reason?: string;
  notifyAttendees: boolean;
}

export interface BulkCancelPayload {
  meetingIds: string[];
  reason: string;
  notifyAttendees: boolean;
}

export interface SeriesInstanceOverride {
  seriesId: string;
  originalStart: string; // ISO 8601 UTC
  isCancelled: boolean;
  newStartAt?: string;   // ISO 8601 UTC
  newEndAt?: string;     // ISO 8601 UTC
  notes?: string;
}

export interface BulkOperationResult {
  totalRequested: number;
  successCount: number;
  failureCount: number;
  failedMeetingIds: string[];
  errors: string[];
}
