import { describe, it, expect, vi } from 'vitest';
import { calculateExecuteAt } from '../automations/nodes/delay';
import type { ExecutionContext } from '../automations/execution-types';

vi.mock('../../firebase-admin', () => ({
  adminDb: { collection: vi.fn() },
}));

vi.mock('../../contact-adapter', () => ({
  resolveContact: vi.fn().mockResolvedValue({
    onboarding_date: '2026-06-01T12:00:00.000Z',
    customData: {
      webinar_date: '2026-06-15T18:30:00.000Z',
    },
  }),
}));

describe('Automation Delay Calculator (calculateExecuteAt)', () => {
  const dummyContext: ExecutionContext = {
    runId: 'run-123',
    automationId: 'auto-456',
    workspaceId: 'ws-789',
    organizationId: 'org-111',
    entityId: 'contact-000',
    entityType: 'person',
    payload: {
      onboarding_date: '2026-06-01T12:00:00.000Z',
    },
  };

  it('handles relative period delay (Minutes, Hours, Days, Weeks)', async () => {
    const baseTime = new Date('2026-07-10T12:00:00.000Z');

    // 10 minutes
    const res1 = await calculateExecuteAt({ waitType: 'period', value: 10, unit: 'Minutes' }, dummyContext, baseTime);
    expect(res1.toISOString()).toBe('2026-07-10T12:10:00.000Z');

    // 2 hours
    const res2 = await calculateExecuteAt({ waitType: 'period', value: 2, unit: 'Hours' }, dummyContext, baseTime);
    expect(res2.toISOString()).toBe('2026-07-10T14:00:00.000Z');

    // 3 days
    const res3 = await calculateExecuteAt({ waitType: 'period', value: 3, unit: 'Days' }, dummyContext, baseTime);
    expect(res3.toISOString()).toBe('2026-07-13T12:00:00.000Z');

    // 1 week
    const res4 = await calculateExecuteAt({ waitType: 'period', value: 1, unit: 'Weeks' }, dummyContext, baseTime);
    expect(res4.toISOString()).toBe('2026-07-17T12:00:00.000Z');
  });

  it('handles specific calendar date delay (specific_date)', async () => {
    const baseTime = new Date('2026-07-10T12:00:00.000Z');
    const config = {
      waitType: 'specific_date',
      specificDate: '2026-12-25',
      specificTime: '18:30',
    };
    const res = await calculateExecuteAt(config, dummyContext, baseTime);
    expect(res.getFullYear()).toBe(2026);
    expect(res.getMonth()).toBe(11); // December (0-indexed)
    expect(res.getDate()).toBe(25);
    expect(res.getHours()).toBe(18);
    expect(res.getMinutes()).toBe(30);

    // Test omitted date with future time today (baseTime is 12:00 PM, target is 3:00 PM / 15:00)
    const configTimeOnlyFuture = {
      waitType: 'specific_date',
      specificTime: '15:00',
    };
    const resFuture = await calculateExecuteAt(configTimeOnlyFuture, dummyContext, baseTime);
    expect(resFuture.getFullYear()).toBe(2026);
    expect(resFuture.getMonth()).toBe(6); // July
    expect(resFuture.getDate()).toBe(10); // Today
    expect(resFuture.getHours()).toBe(15);
    expect(resFuture.getMinutes()).toBe(0);

    // Test omitted date with past time today (baseTime is 12:00 PM, target is 9:00 AM / 09:00 -> should roll to tomorrow July 11)
    const configTimeOnlyPast = {
      waitType: 'specific_date',
      specificTime: '09:00',
    };
    const resPast = await calculateExecuteAt(configTimeOnlyPast, dummyContext, baseTime);
    expect(resPast.getDate()).toBe(11); // Tomorrow
    expect(resPast.getHours()).toBe(9);
    expect(resPast.getMinutes()).toBe(0);
  });

  it('handles scheduled day of week delay (scheduled_day)', async () => {
    // Friday July 10, 2026
    const baseTime = new Date('2026-07-10T12:00:00.000Z');
    
    // Target next Monday (July 13, 2026) at 9:00 AM
    const config = {
      waitType: 'scheduled_day',
      scheduledDay: 'Monday',
      scheduledTime: '09:00',
    };
    const res = await calculateExecuteAt(config, dummyContext, baseTime);
    expect(res.getFullYear()).toBe(2026);
    expect(res.getMonth()).toBe(6); // July
    expect(res.getDate()).toBe(13);
    expect(res.getHours()).toBe(9);
    expect(res.getMinutes()).toBe(0);

    // Target Friday July 10, 2026 at 3:00 PM (15:00) -> since 3:00 PM is after 12:00 PM baseTime, should be same day
    const configTodayFuture = {
      waitType: 'scheduled_day',
      scheduledDay: 'Friday',
      scheduledTime: '15:00',
    };
    const resToday = await calculateExecuteAt(configTodayFuture, dummyContext, baseTime);
    expect(resToday.getDate()).toBe(10);
    expect(resToday.getHours()).toBe(15);

    // Target Friday July 10, 2026 at 9:00 AM -> already passed, should roll to next Friday (July 17, 2026)
    const configTodayPast = {
      waitType: 'scheduled_day',
      scheduledDay: 'Friday',
      scheduledTime: '09:00',
    };
    const resNextWeek = await calculateExecuteAt(configTodayPast, dummyContext, baseTime);
    expect(resNextWeek.getDate()).toBe(17);
    expect(resNextWeek.getHours()).toBe(9);
  });

  it('handles scheduled month, day of month, year delay (scheduled_month)', async () => {
    // Friday July 10, 2026
    const baseTime = new Date('2026-07-10T12:00:00.000Z');

    // Specific Year, Month, Day
    const config = {
      waitType: 'scheduled_month',
      scheduledYear: '2027',
      scheduledMonth: '12', // December
      scheduledDayOfMonth: '31',
      scheduledTime: '23:59',
    };
    const res = await calculateExecuteAt(config, dummyContext, baseTime);
    expect(res.getFullYear()).toBe(2027);
    expect(res.getMonth()).toBe(11); // December
    expect(res.getDate()).toBe(31);
    expect(res.getHours()).toBe(23);
    expect(res.getMinutes()).toBe(59);

    // "Last Day" of specific month
    const configLastDay = {
      waitType: 'scheduled_month',
      scheduledYear: '2026',
      scheduledMonth: '2', // February 2026 has 28 days
      scheduledDayOfMonth: 'last',
      scheduledTime: '12:00',
    };
    const resLast = await calculateExecuteAt(configLastDay, dummyContext, baseTime);
    expect(resLast.getDate()).toBe(28);

    // "Last Day" of leap year February
    const configLeapLast = {
      waitType: 'scheduled_month',
      scheduledYear: '2028', // Leap year
      scheduledMonth: '2',
      scheduledDayOfMonth: 'last',
      scheduledTime: '12:00',
    };
    const resLeapLast = await calculateExecuteAt(configLeapLast, dummyContext, baseTime);
    expect(resLeapLast.getDate()).toBe(29);
  });

  it('handles custom date field relative delay (date_field)', async () => {
    const baseTime = new Date('2026-07-10T12:00:00.000Z');

    // Matches exactly on onboarding_date (2026-06-01T12:00:00.000Z)
    const configDirect = {
      waitType: 'date_field',
      dateField: 'onboarding_date',
      offsetDirection: 'current_date',
    };
    const resDirect = await calculateExecuteAt(configDirect, dummyContext, baseTime);
    expect(resDirect.toISOString()).toBe('2026-06-01T12:00:00.000Z');

    // 5 days after onboarding_date
    const configAfter = {
      waitType: 'date_field',
      dateField: 'onboarding_date',
      offsetDirection: 'after',
      offsetDays: 5,
    };
    const resAfter = await calculateExecuteAt(configAfter, dummyContext, baseTime);
    expect(resAfter.toISOString()).toBe('2026-06-06T12:00:00.000Z');

    // 2 days before onboarding_date
    const configBefore = {
      waitType: 'date_field',
      dateField: 'onboarding_date',
      offsetDirection: 'before',
      offsetDays: 2,
    };
    const resBefore = await calculateExecuteAt(configBefore, dummyContext, baseTime);
    expect(resBefore.toISOString()).toBe('2026-05-30T12:00:00.000Z');
  });

  it('handles concatenated delay periods (e.g. 1 Week, 3 Hours, 15 Minutes)', async () => {
    const baseTime = new Date('2026-07-10T12:00:00.000Z');

    const config = {
      waitType: 'period',
      periods: [
        { value: 1, unit: 'Weeks' },
        { value: 3, unit: 'Hours' },
        { value: 15, unit: 'Minutes' }
      ]
    };

    const res = await calculateExecuteAt(config, dummyContext, baseTime);
    // Base: 2026-07-10T12:00:00.000Z
    // + 1 week: 2026-07-17T12:00:00.000Z
    // + 3 hours: 2026-07-17T15:00:00.000Z
    // + 15 minutes: 2026-07-17T15:15:00.000Z
    expect(res.toISOString()).toBe('2026-07-17T15:15:00.000Z');
  });
});
