import { describe, it, expect } from 'vitest';
import {
  expandRecurringDates,
  generateRruleString,
} from '../recurrence-service';

describe('Recurrence Series & RRULE Engine', () => {
  const referenceNow = new Date('2026-09-01T00:00:00Z');

  it('expands weekly recurrence on specific days within horizon', () => {
    const dates = expandRecurringDates(
      {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1, 3], // Mon, Wed
        startDate: '2026-09-01', // Tuesday
        count: 4,
      },
      30,
      referenceNow
    );

    expect(dates).toHaveLength(4);
    // 1st occurrence: Wednesday Sep 2
    expect(dates[0]).toBe('2026-09-02');
    // 2nd occurrence: Monday Sep 7
    expect(dates[1]).toBe('2026-09-07');
    // 3rd occurrence: Wednesday Sep 9
    expect(dates[2]).toBe('2026-09-09');
    // 4th occurrence: Monday Sep 14
    expect(dates[3]).toBe('2026-09-14');
  });

  it('expands daily recurrence with intervals bounded by untilDate', () => {
    const dates = expandRecurringDates(
      {
        frequency: 'daily',
        interval: 2, // Every 2 days
        startDate: '2026-09-01',
        untilDate: '2026-09-07',
      },
      60,
      referenceNow
    );

    expect(dates).toEqual([
      '2026-09-01',
      '2026-09-03',
      '2026-09-05',
      '2026-09-07',
    ]);
  });

  it('generates standard RFC 5545 RRULE string format', () => {
    const rrule1 = generateRruleString({
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1, 4], // Mon, Thu
      count: 8,
      startDate: '2026-09-01',
    });

    expect(rrule1).toBe('FREQ=WEEKLY;BYDAY=MO,TH;COUNT=8');

    const rrule2 = generateRruleString({
      frequency: 'biweekly',
      startDate: '2026-09-01',
      untilDate: '2026-12-31',
    });

    expect(rrule2).toBe('FREQ=WEEKLY;INTERVAL=2;UNTIL=20261231T235959Z');
  });
});
