import { describe, it, expect } from 'vitest';
import { calculateEventGridPosition } from '../calendar-view-service';

describe('calculateEventGridPosition', () => {
  it('calculates position for a meeting starting at the start of the day', () => {
    const start = new Date(2026, 9, 5, 8, 0, 0); // 08:00
    const end = new Date(2026, 9, 5, 9, 0, 0);   // 09:00
    // Total day: 8:00 to 20:00 (12 hours = 720 minutes)
    const pos = calculateEventGridPosition(start, end, 8, 20);

    expect(pos.topPercent).toBeCloseTo(0, 1);
    expect(pos.heightPercent).toBeCloseTo((60 / 720) * 100, 1);
  });

  it('calculates position for a 30-minute afternoon meeting', () => {
    const start = new Date(2026, 9, 5, 14, 0, 0); // 14:00 (6 hours after 08:00 = 360 mins)
    const end = new Date(2026, 9, 5, 14, 30, 0);  // 14:30
    const pos = calculateEventGridPosition(start, end, 8, 20);

    expect(pos.topPercent).toBeCloseTo(50, 1); // 360 / 720 = 50%
    expect(pos.heightPercent).toBeCloseTo((30 / 720) * 100, 1); // 4.17%
  });

  it('calculates position for a 2-hour multi-hour session', () => {
    const start = new Date(2026, 9, 5, 10, 0, 0); // 10:00 (2 hours after 08:00 = 120 mins)
    const end = new Date(2026, 9, 5, 12, 0, 0);   // 12:00 (120 mins duration)
    const pos = calculateEventGridPosition(start, end, 8, 20);

    expect(pos.topPercent).toBeCloseTo((120 / 720) * 100, 1); // 16.67%
    expect(pos.heightPercent).toBeCloseTo((120 / 720) * 100, 1); // 16.67%
  });

  it('clamps gracefully if meeting extends to end of day', () => {
    const start = new Date(2026, 9, 5, 19, 0, 0); // 19:00
    const end = new Date(2026, 9, 5, 21, 0, 0);   // 21:00 (past 20:00)
    const pos = calculateEventGridPosition(start, end, 8, 20);

    expect(pos.topPercent).toBeCloseTo((660 / 720) * 100, 1);
    // Height cannot exceed remaining height in the day
    expect(pos.topPercent + pos.heightPercent).toBeLessThanOrEqual(100.01);
  });
});
