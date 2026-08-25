import { describe, it, expect } from 'vitest';
import {
  calculateCollectiveSlots,
  mergeRoundRobinSlots,
  selectRoundRobinHost,
} from '../team-scheduling-service';
import type { AvailableSlot } from '../types';
import type { TeamHostMember } from '../types/team';

describe('Multi-Host & Team Scheduling Engine', () => {
  const slot1: AvailableSlot = {
    start: '2026-09-01T09:00:00.000Z',
    end: '2026-09-01T09:30:00.000Z',
    formattedTime: '09:00',
    formattedEndTime: '09:30',
    available: true,
  };
  const slot2: AvailableSlot = {
    start: '2026-09-01T10:00:00.000Z',
    end: '2026-09-01T10:30:00.000Z',
    formattedTime: '10:00',
    formattedEndTime: '10:30',
    available: true,
  };
  const slot3: AvailableSlot = {
    start: '2026-09-01T11:00:00.000Z',
    end: '2026-09-01T11:30:00.000Z',
    formattedTime: '11:00',
    formattedEndTime: '11:30',
    available: true,
  };

  it('calculates collective availability as the strict intersection of required hosts', () => {
    const hostMap = new Map<string, AvailableSlot[]>();
    // Host A has slot 1 and slot 2
    hostMap.set('host_a', [slot1, slot2]);
    // Host B has slot 2 and slot 3
    hostMap.set('host_b', [slot2, slot3]);

    const collectiveSlots = calculateCollectiveSlots(hostMap);
    expect(collectiveSlots).toHaveLength(1);
    expect(collectiveSlots[0].start).toBe(slot2.start);
  });

  it('merges round-robin slots to expose union of all available host slots', () => {
    const hostMap = new Map<string, AvailableSlot[]>();
    hostMap.set('host_a', [slot1]);
    hostMap.set('host_b', [slot2, slot3]);

    const merged = mergeRoundRobinSlots(hostMap);
    expect(merged).toHaveLength(3);
    expect(merged[0].formattedTime).toBe('09:00');
    expect(merged[1].formattedTime).toBe('10:00');
    expect(merged[2].formattedTime).toBe('11:00');
  });

  it('selects round-robin host based on lowest booking load (availability strategy)', () => {
    const hosts: TeamHostMember[] = [
      { userId: 'host_1', name: 'Alice', email: 'alice@smartsapp.com' },
      { userId: 'host_2', name: 'Bob', email: 'bob@smartsapp.com' },
      { userId: 'host_3', name: 'Charlie', email: 'charlie@smartsapp.com' },
    ];

    const hostBookingCounts = {
      host_1: 5,
      host_2: 2, // Bob has the lowest booking count
      host_3: 4,
    };

    const availableHostIds = ['host_1', 'host_2', 'host_3'];

    const result = selectRoundRobinHost(
      hosts,
      availableHostIds,
      hostBookingCounts,
      'availability'
    );

    expect(result).not.toBeNull();
    expect(result?.host.userId).toBe('host_2');
    expect(result?.host.name).toBe('Bob');
  });

  it('selects round-robin host with strict circular queue advancement', () => {
    const hosts: TeamHostMember[] = [
      { userId: 'host_1', name: 'Alice', email: 'alice@smartsapp.com' },
      { userId: 'host_2', name: 'Bob', email: 'bob@smartsapp.com' },
      { userId: 'host_3', name: 'Charlie', email: 'charlie@smartsapp.com' },
    ];

    const availableHostIds = ['host_1', 'host_2', 'host_3'];

    // If last assigned index was 0 (Alice), Bob (index 1) is selected, and nextIndex becomes 2
    const result1 = selectRoundRobinHost(
      hosts,
      availableHostIds,
      {},
      'strict_round_robin',
      0
    );
    expect(result1?.host.userId).toBe('host_2');
    expect(result1?.nextIndex).toBe(2);

    // If last assigned index was 1 (Bob), Charlie (index 2) is selected, and nextIndex wraps around to 0
    const result2 = selectRoundRobinHost(
      hosts,
      availableHostIds,
      {},
      'strict_round_robin',
      1
    );
    expect(result2?.host.userId).toBe('host_3');
    expect(result2?.nextIndex).toBe(0);
  });
});
