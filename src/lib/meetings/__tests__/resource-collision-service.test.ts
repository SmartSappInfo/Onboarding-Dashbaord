import { describe, it, expect } from 'vitest';
import { detectResourceCollision } from '../resource-collision-service';
import type { ResourceReservation } from '../types/resources';

describe('Resource Collision Service', () => {
  const existing: ResourceReservation[] = [
    {
      id: 'res_1',
      resourceId: 'room_boardroom_a',
      meetingId: 'm1',
      workspaceId: 'w1',
      startAt: '2026-08-25T10:00:00Z',
      endAt: '2026-08-25T11:30:00Z',
      status: 'confirmed',
      reservedByUserId: 'u1',
    },
    {
      id: 'res_2',
      resourceId: 'room_boardroom_a',
      meetingId: 'm2',
      workspaceId: 'w1',
      startAt: '2026-08-25T14:00:00Z',
      endAt: '2026-08-25T15:00:00Z',
      status: 'cancelled', // Cancelled should be ignored!
      reservedByUserId: 'u2',
    },
  ];

  it('detects interval overlap against active resource reservations', () => {
    // Collides with res_1 (10:30 - 11:00)
    const collision = detectResourceCollision(
      new Date('2026-08-25T10:30:00Z'),
      new Date('2026-08-25T11:00:00Z'),
      existing
    );
    expect(collision?.id).toBe('res_1');
  });

  it('permits booking on cancelled reservations or open intervals', () => {
    // Overlaps with cancelled res_2 (14:00 - 15:00) -> Allowed!
    const collisionCancelled = detectResourceCollision(
      new Date('2026-08-25T14:15:00Z'),
      new Date('2026-08-25T14:45:00Z'),
      existing
    );
    expect(collisionCancelled).toBeNull();

    // Open interval (12:00 - 13:00)
    const freeSlot = detectResourceCollision(
      new Date('2026-08-25T12:00:00Z'),
      new Date('2026-08-25T13:00:00Z'),
      existing
    );
    expect(freeSlot).toBeNull();
  });
});
