/**
 * @fileoverview Pure Team Scheduling & Multi-Host Assignment Service.
 * Implements Collective Scheduling (all hosts required) and Round-Robin distribution.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Pure algorithms with zero database dependencies.
 * - Multi-host intersections compare slots by exact ISO 8601 startAt and endAt timestamps.
 */

import type { AvailableSlot } from './types';
import type { TeamHostMember, RoundRobinDistribution } from './types/team';

/**
 * Calculates the collective availability intersection across multiple host slot lists.
 * A slot is valid collectively if and only if EVERY required host has an identical available slot.
 */
export function calculateCollectiveSlots(
  hostSlotsMap: Map<string, AvailableSlot[]>,
  requiredHostIds?: string[]
): AvailableSlot[] {
  const hostIds = Array.from(hostSlotsMap.keys());
  if (hostIds.length === 0) return [];

  // Filter down to only required hosts if specified, or all hosts
  const targetHostIds = requiredHostIds && requiredHostIds.length > 0
    ? hostIds.filter(id => requiredHostIds.includes(id))
    : hostIds;

  if (targetHostIds.length === 0) return [];

  // Start with the first host's slots
  const firstHostSlots = hostSlotsMap.get(targetHostIds[0]) || [];
  if (firstHostSlots.length === 0) return [];

  // Filter slots where every other required host also has an exact slot starting and ending at the same time
  const intersectionSlots = firstHostSlots.filter(slot => {
    for (let i = 1; i < targetHostIds.length; i++) {
      const otherHostSlots = hostSlotsMap.get(targetHostIds[i]) || [];
      const hasMatchingSlot = otherHostSlots.some(
        s => s.start === slot.start && s.end === slot.end
      );
      if (!hasMatchingSlot) {
        return false;
      }
    }
    return true;
  });

  return intersectionSlots;
}

/**
 * Merges slot lists across multiple hosts for Round-Robin scheduling.
 * A slot is available in Round-Robin if AT LEAST ONE host is free.
 */
export function mergeRoundRobinSlots(
  hostSlotsMap: Map<string, AvailableSlot[]>
): AvailableSlot[] {
  const slotMap = new Map<string, AvailableSlot>();

  hostSlotsMap.forEach((slots) => {
    slots.forEach((slot) => {
      const key = `${slot.start}_${slot.end}`;
      if (!slotMap.has(key)) {
        slotMap.set(key, slot);
      }
    });
  });

  return Array.from(slotMap.values()).sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );
}

export interface RoundRobinSelectionResult {
  host: TeamHostMember;
  nextIndex: number;
}

/**
 * Selects the optimal team member for a round-robin booking.
 */
export function selectRoundRobinHost(
  hosts: TeamHostMember[],
  availableHostIdsForSlot: string[],
  hostBookingCounts: Record<string, number> = {},
  distribution: RoundRobinDistribution = 'availability',
  lastAssignedIndex = 0
): RoundRobinSelectionResult | null {
  if (!hosts || hosts.length === 0) return null;

  // Filter to only hosts who are available for this specific slot
  const candidateHosts = hosts.filter(h => availableHostIdsForSlot.includes(h.userId));
  if (candidateHosts.length === 0) {
    // If no specific slot filter provided or none available, fallback to all hosts
    return { host: hosts[0], nextIndex: (lastAssignedIndex + 1) % hosts.length };
  }

  if (distribution === 'availability') {
    // Pick candidate with fewest past bookings (load balancing)
    let bestHost = candidateHosts[0];
    let minBookings = hostBookingCounts[bestHost.userId] ?? 0;

    for (let i = 1; i < candidateHosts.length; i++) {
      const candidate = candidateHosts[i];
      const count = hostBookingCounts[candidate.userId] ?? 0;
      if (count < minBookings) {
        minBookings = count;
        bestHost = candidate;
      }
    }

    const hostIndex = hosts.findIndex(h => h.userId === bestHost.userId);
    return {
      host: bestHost,
      nextIndex: hostIndex >= 0 ? (hostIndex + 1) % hosts.length : 0,
    };
  }

  if (distribution === 'weighted') {
    // Pick candidate with highest weight or lowest load relative to weight
    let bestHost = candidateHosts[0];
    let bestScore = -Infinity;

    for (const candidate of candidateHosts) {
      const weight = candidate.weight && candidate.weight > 0 ? candidate.weight : 10;
      const count = hostBookingCounts[candidate.userId] ?? 0;
      // Ratio of weight to existing load
      const score = weight / (count + 1);
      if (score > bestScore) {
        bestScore = score;
        bestHost = candidate;
      }
    }

    const hostIndex = hosts.findIndex(h => h.userId === bestHost.userId);
    return {
      host: bestHost,
      nextIndex: hostIndex >= 0 ? (hostIndex + 1) % hosts.length : 0,
    };
  }

  // Strict circular round-robin
  const nextIdx = (lastAssignedIndex + 1) % hosts.length;
  // Try finding next candidate starting from nextIdx
  for (let i = 0; i < hosts.length; i++) {
    const candidateIdx = (nextIdx + i) % hosts.length;
    const candidate = hosts[candidateIdx];
    if (candidateHosts.some(h => h.userId === candidate.userId)) {
      return {
        host: candidate,
        nextIndex: (candidateIdx + 1) % hosts.length,
      };
    }
  }

  return { host: candidateHosts[0], nextIndex: 0 };
}
