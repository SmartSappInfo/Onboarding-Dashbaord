import { describe, it, expect } from 'vitest';
import type { Booking, BookingHold, BookingStatus } from '../types';

describe('Booking Lifecycle State Machine Transitions', () => {
  const mockHold: BookingHold = {
    id: 'hold-123',
    workspaceId: 'ws-1',
    organizationId: 'org-1',
    eventTypeId: 'event-1',
    startAt: '2026-09-15T14:00:00Z',
    endAt: '2026-09-15T14:30:00Z',
    sessionId: 'session-xyz',
    expiresAt: '2026-09-15T13:05:00Z',
    status: 'active',
    createdAt: '2026-09-15T13:00:00Z',
    updatedAt: '2026-09-15T13:00:00Z',
  };

  it('validates hold conversion to confirmed booking', () => {
    const isHoldValid = (hold: BookingHold, checkTime: Date, session: string): boolean => {
      return (
        hold.status === 'active' &&
        new Date(hold.expiresAt).getTime() >= checkTime.getTime() &&
        hold.sessionId === session
      );
    };

    // Valid check within 5 mins
    expect(isHoldValid(mockHold, new Date('2026-09-15T13:02:00Z'), 'session-xyz')).toBe(true);

    // Invalid: expired
    expect(isHoldValid(mockHold, new Date('2026-09-15T13:06:00Z'), 'session-xyz')).toBe(false);

    // Invalid: hijacked session
    expect(isHoldValid(mockHold, new Date('2026-09-15T13:02:00Z'), 'session-wrong')).toBe(false);
  });

  it('handles valid state transitions for Booking entity', () => {
    const validTransitions: Record<BookingStatus, BookingStatus[]> = {
      pending: ['held', 'confirmed', 'cancelled', 'expired'],
      held: ['confirmed', 'cancelled', 'expired'],
      confirmed: ['rescheduled', 'cancelled', 'completed', 'no_show'],
      rescheduled: ['confirmed', 'cancelled'],
      cancelled: [],
      declined: [],
      expired: [],
      completed: [],
      no_show: [],
    };

    const canTransition = (from: BookingStatus, to: BookingStatus): boolean => {
      return validTransitions[from]?.includes(to) ?? false;
    };

    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('held', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'rescheduled')).toBe(true);
    expect(canTransition('confirmed', 'cancelled')).toBe(true);
    expect(canTransition('cancelled', 'confirmed')).toBe(false); // Terminal state
    expect(canTransition('completed', 'rescheduled')).toBe(false); // Terminal state
  });
});
