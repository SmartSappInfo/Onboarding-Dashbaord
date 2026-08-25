/**
 * @fileoverview Pure domain service for Meeting Participants in SmartSapp Meetings 2.0.
 * Handles attendance duration computation, RSVP state machine validation,
 * attendance transitions, and cryptographic SHA-256 token hashing for magic join links.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Never store raw join tokens in database documents. Always store tokenHash.
 * - Attendance duration must accumulate accurately across multiple join/leave events.
 * - Zero 'any' or 'any[]' allowed.
 */

import crypto from 'crypto';
import type {
  ParticipantRole,
  ParticipantRsvpStatus,
  ParticipantAttendanceStatus,
} from './types';

/**
 * Computes accumulated attendance duration in seconds.
 * If joinedAt is provided without leftAt, computes elapsed duration up to current time or leftAt.
 */
export function computeTotalAttendanceSeconds(
  joinedAt?: string,
  leftAt?: string,
  previousSeconds: number = 0
): number {
  if (!joinedAt) return Math.max(0, previousSeconds);

  const joinTime = new Date(joinedAt).getTime();
  if (isNaN(joinTime)) return Math.max(0, previousSeconds);

  const endTime = leftAt ? new Date(leftAt).getTime() : Date.now();
  if (isNaN(endTime) || endTime < joinTime) return Math.max(0, previousSeconds);

  const sessionSeconds = Math.floor((endTime - joinTime) / 1000);
  return Math.max(0, previousSeconds + sessionSeconds);
}

/**
 * Validates whether an RSVP state transition is logically permitted.
 */
export function validateRsvpTransition(
  current: ParticipantRsvpStatus,
  next: ParticipantRsvpStatus
): boolean {
  if (current === next) return true;

  // Once declined or accepted, can still transition to other active states
  const validTransitions: Record<ParticipantRsvpStatus, ParticipantRsvpStatus[]> = {
    pending: ['accepted', 'declined', 'tentative'],
    tentative: ['accepted', 'declined', 'pending'],
    accepted: ['declined', 'tentative', 'pending'],
    declined: ['accepted', 'tentative', 'pending'],
  };

  return validTransitions[current]?.includes(next) ?? false;
}

/**
 * Validates attendance status transitions.
 */
export function validateAttendanceTransition(
  current: ParticipantAttendanceStatus,
  next: ParticipantAttendanceStatus
): boolean {
  if (current === next) return true;

  const validTransitions: Record<ParticipantAttendanceStatus, ParticipantAttendanceStatus[]> = {
    not_joined: ['joined', 'no_show'],
    joined: ['left', 'not_joined'],
    left: ['joined', 'not_joined'],
    no_show: ['not_joined', 'joined'],
  };

  return validTransitions[current]?.includes(next) ?? false;
}

/**
 * Computes a SHA-256 hash string from a raw token.
 */
export function hashParticipantToken(rawToken: string): string {
  if (!rawToken || typeof rawToken !== 'string') return '';
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}

/**
 * Generates a high-entropy cryptographically secure join token and its SHA-256 hash.
 */
export function generateSecureJoinToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(24).toString('hex');
  const tokenHash = hashParticipantToken(rawToken);
  return { rawToken, tokenHash };
}

/**
 * Formats a duration in seconds into a human-readable string (e.g. "1h 24m", "45m", "30s").
 */
export function formatAttendanceDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';

  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts: string[] = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  if (parts.length === 0 || (hrs === 0 && mins === 0 && secs > 0)) {
    parts.push(`${secs}s`);
  }

  return parts.join(' ');
}

/**
 * Returns a human-friendly display label and badge color style for a participant role.
 */
export function getParticipantRoleMeta(role: ParticipantRole): {
  label: string;
  badgeClass: string;
} {
  switch (role) {
    case 'host':
      return { label: 'Host', badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900' };
    case 'co_host':
      return { label: 'Co-Host', badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900' };
    case 'facilitator':
      return { label: 'Facilitator', badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900' };
    case 'panelist':
      return { label: 'Panelist', badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900' };
    case 'guest':
      return { label: 'Guest', badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' };
    case 'attendee':
    default:
      return { label: 'Attendee', badgeClass: 'bg-muted text-muted-foreground border-border' };
  }
}
