/**
 * @fileoverview Pure Queue State & Heartbeat Abandonment Service for Drop-In Office Hours.
 * Recalculates FIFO positions and computes estimated wait times.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 * - Stale heartbeat detection (>90s) prevents ghost visitors from locking queues.
 */

import type { OfficeHoursQueueEntry } from './types/polls';

/**
 * Checks if a visitor queue entry is stale due to missing heartbeat ping.
 */
export function isQueueEntryStale(
  lastHeartbeatAt: string,
  maxStaleSeconds = 90,
  referenceNow = new Date()
): boolean {
  if (!lastHeartbeatAt) return true;
  const heartbeatTime = new Date(lastHeartbeatAt).getTime();
  if (isNaN(heartbeatTime)) return true;

  const diffSeconds = (referenceNow.getTime() - heartbeatTime) / 1000;
  return diffSeconds > maxStaleSeconds;
}

/**
 * Filters out completed, admitted, or abandoned queue entries.
 */
export function filterActiveQueueEntries(
  entries: OfficeHoursQueueEntry[],
  referenceNow = new Date()
): OfficeHoursQueueEntry[] {
  return entries.filter(
    entry =>
      entry.status === 'waiting' &&
      !isQueueEntryStale(entry.lastHeartbeatAt, 90, referenceNow)
  );
}

/**
 * Recalculates contiguous 1-indexed FIFO queue positions based on arrival time (`joinedQueueAt`).
 */
export function recalculateQueuePositions(
  entries: OfficeHoursQueueEntry[],
  referenceNow = new Date()
): OfficeHoursQueueEntry[] {
  // Sort waiting entries by joinedQueueAt ascending
  const active = filterActiveQueueEntries(entries, referenceNow);
  active.sort((a, b) => new Date(a.joinedQueueAt).getTime() - new Date(b.joinedQueueAt).getTime());

  const updatedActive = active.map((entry, index) => ({
    ...entry,
    position: index + 1,
  }));

  // Non-active entries retain position 0 or their prior state
  const inactive = entries.filter(
    entry =>
      entry.status !== 'waiting' ||
      isQueueEntryStale(entry.lastHeartbeatAt, 90, referenceNow)
  ).map(entry => ({
    ...entry,
    status: isQueueEntryStale(entry.lastHeartbeatAt, 90, referenceNow) && entry.status === 'waiting'
      ? ('abandoned' as const)
      : entry.status,
    position: 0,
  }));

  return [...updatedActive, ...inactive];
}

/**
 * Calculates estimated wait time in minutes for a given queue position.
 */
export function estimateWaitTimeMinutes(
  position: number,
  avgCallDurationMinutes = 15
): number {
  if (position <= 1) return 0;
  return (position - 1) * Math.max(5, avgCallDurationMinutes);
}
