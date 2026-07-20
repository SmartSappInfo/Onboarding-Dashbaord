import { calculateExecuteAt } from '../automations/nodes/delay';
import type { ExecutionContext } from '../automations/execution-types';

import { vi, describe, it, expect } from 'vitest';

// Mock the firebase-admin module
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn().mockReturnThis(),
    doc: vi.fn().mockReturnThis(),
    get: vi.fn().mockResolvedValue({
      exists: true,
      data: () => ({
        settings: {
          defaultTimezone: 'America/New_York'
        }
      })
    })
  }
}));

describe('calculateExecuteAt - Timezone Awareness', () => {
  const mockContext: ExecutionContext = {
    runId: 'r1',
    automationId: 'a1',
    workspaceId: 'w1',
    entityId: 'e1',
    entityType: 'person',
    organizationId: 'org1',
    payload: {}
  };

  it('should correctly schedule a day/time using the organization timezone', async () => {
    // Current time: Monday, 12:00 PM UTC (which is 08:00 AM EDT)
    // We want to wait until Tuesday 09:15 AM EDT
    // This should result in Tuesday 13:15 PM UTC (or 14:15 UTC if EST depending on DST)
    const now = new Date('2026-07-20T12:00:00.000Z'); // Monday 12:00 UTC
    
    const config = {
      waitType: 'scheduled_day',
      scheduledDayPreset: 'tuesday',
      scheduledTime: '09:15'
    };

    const executeAt = await calculateExecuteAt(config, mockContext, now);
    
    // In EDT (UTC-4), 09:15 AM EDT is 13:15 UTC.
    // Let's verify the ISO string ends up correctly at 13:15 UTC
    expect(executeAt.toISOString()).toBe('2026-07-21T13:15:00.000Z');
  });

  it('should wait 7 days if the local time has already passed the target time on the same day', async () => {
    // Current time: Tuesday, 14:00 PM UTC (which is 10:00 AM EDT)
    // We want to wait until Tuesday 09:15 AM EDT.
    // Since 10:00 AM > 09:15 AM, it must schedule for next Tuesday!
    const now = new Date('2026-07-21T14:00:00.000Z'); // Tuesday 14:00 UTC
    
    const config = {
      waitType: 'scheduled_day',
      scheduledDayPreset: 'tuesday',
      scheduledTime: '09:15'
    };

    const executeAt = await calculateExecuteAt(config, mockContext, now);
    
    // Next Tuesday is 2026-07-28
    expect(executeAt.toISOString()).toBe('2026-07-28T13:15:00.000Z');
  });
});
