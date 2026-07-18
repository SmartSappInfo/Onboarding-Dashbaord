import { calculateExecuteAt } from './delay';

describe('Delay Node Execution Calculations', () => {
  it('correctly parses AM/PM and schedules for the next occurrence of specific time without a date', async () => {
    // Current time is 11:00 AM today
    const now = new Date(2026, 6, 18, 11, 0, 0, 0); // July 18, 2026, 11:00 AM

    const executeAt = await calculateExecuteAt({
      waitType: 'specific_date',
      specificTime: '09:00 AM'
    }, {} as any, now);

    // Should schedule for tomorrow 9:00 AM since 9:00 AM today is already past
    expect(executeAt.getFullYear()).toBe(2026);
    expect(executeAt.getMonth()).toBe(6);
    expect(executeAt.getDate()).toBe(19); // Tomorrow
    expect(executeAt.getHours()).toBe(9);
    expect(executeAt.getMinutes()).toBe(0);
  });

  it('correctly parses PM time string', async () => {
    // Current time is 11:00 AM today
    const now = new Date(2026, 6, 18, 11, 0, 0, 0);

    const executeAt = await calculateExecuteAt({
      waitType: 'specific_date',
      specificTime: '02:30 PM'
    }, {} as any, now);

    // Should schedule for today 2:30 PM since it's in the future
    expect(executeAt.getDate()).toBe(18); // Today
    expect(executeAt.getHours()).toBe(14); // 14:00 is 2:00 PM
    expect(executeAt.getMinutes()).toBe(30);
  });

  it('correctly parses standard 24-hour time strings', async () => {
    const now = new Date(2026, 6, 18, 11, 0, 0, 0);

    const executeAt = await calculateExecuteAt({
      waitType: 'specific_date',
      specificTime: '15:45'
    }, {} as any, now);

    expect(executeAt.getDate()).toBe(18); // Today
    expect(executeAt.getHours()).toBe(15);
    expect(executeAt.getMinutes()).toBe(45);
  });
});
