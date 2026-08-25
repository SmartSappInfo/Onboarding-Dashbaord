/**
 * @fileoverview Domain types for Team Scheduling & Multi-Host Assignment Primitives.
 * Supports Single Host, Collective Scheduling (all hosts required), and Round-Robin distribution.
 */

export type HostAssignmentStrategy = 'single' | 'collective' | 'round_robin' | 'round_robin_weighted';

export type RoundRobinDistribution = 'availability' | 'strict_round_robin' | 'weighted';

export interface TeamHostMember {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** Percentage weight between 1 and 100 for weighted round-robin */
  weight?: number;
  /** Whether this host is mandatory in collective scheduling */
  isRequired?: boolean;
  /** Priority tier (lower numbers get assigned first in availability-based allocation) */
  priority?: number;
}

export interface TeamSchedulingConfig {
  strategy: HostAssignmentStrategy;
  hosts: TeamHostMember[];
  roundRobinDistribution?: RoundRobinDistribution;
  /** Pointer to circular queue index for strict round robin */
  lastAssignedIndex?: number;
  /** Booking count cache per host for availability-balanced distribution */
  hostBookingCounts?: Record<string, number>;
}

export interface HostAvailabilityMatrix {
  userId: string;
  name: string;
  email: string;
  availableIntervals: Array<{ start: string; end: string }>;
}
