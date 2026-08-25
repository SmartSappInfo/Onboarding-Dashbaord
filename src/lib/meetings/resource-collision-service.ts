/**
 * @fileoverview Pure Physical Room & Equipment Resource Collision Detector.
 * Ensures physical meeting spaces and hardware cannot be double-booked.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% pure with zero side-effects.
 */

import type { ResourceReservation } from './types/resources';

/**
 * Checks for interval overlap against existing physical resource reservations.
 */
export function detectResourceCollision(
  proposedStart: Date,
  proposedEnd: Date,
  existingReservations: ResourceReservation[],
  excludeReservationId?: string
): ResourceReservation | null {
  const pStartMs = proposedStart.getTime();
  const pEndMs = proposedEnd.getTime();

  for (const res of existingReservations) {
    if (excludeReservationId && res.id === excludeReservationId) continue;
    if (res.status === 'cancelled') continue;

    const rStartMs = new Date(res.startAt).getTime();
    const rEndMs = new Date(res.endAt).getTime();

    // Standard interval overlap test: (StartA < EndB) and (EndA > StartB)
    if (pStartMs < rEndMs && pEndMs > rStartMs) {
      return res;
    }
  }

  return null;
}
