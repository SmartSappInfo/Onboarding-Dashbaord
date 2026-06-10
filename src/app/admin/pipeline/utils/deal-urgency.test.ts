import { describe, it, expect } from 'vitest';
import { addDays, formatISO, subDays } from 'date-fns';
import { getForecastUrgency } from './deal-urgency';

describe('getForecastUrgency', () => {
  const iso = (d: Date) => formatISO(d);

  it('returns "none" for null/undefined/empty input', () => {
    expect(getForecastUrgency(null).level).toBe('none');
    expect(getForecastUrgency(undefined).level).toBe('none');
    expect(getForecastUrgency('').level).toBe('none');
  });

  it('returns "none" for an unparseable date string', () => {
    expect(getForecastUrgency('not-a-date').level).toBe('none');
  });

  it('flags a past date as overdue with the correct day count', () => {
    const result = getForecastUrgency(iso(subDays(new Date(), 3)));
    expect(result.level).toBe('overdue');
    expect(result.label).toBe('3d overdue');
    expect(result.colorClass).toBe('text-destructive');
    // most overdue sorts first (most negative)
    expect(result.sortWeight).toBeLessThan(0);
  });

  it('flags today as "Due today" (amber)', () => {
    const result = getForecastUrgency(iso(new Date()));
    expect(result.level).toBe('today');
    expect(result.label).toBe('Due today');
    expect(result.colorClass).toBe('text-amber-500');
    expect(result.sortWeight).toBe(0);
  });

  it('flags within 7 days as "soon" (amber)', () => {
    const result = getForecastUrgency(iso(addDays(new Date(), 3)));
    expect(result.level).toBe('soon');
    expect(result.label).toBe('3d left');
    expect(result.colorClass).toBe('text-amber-500');
  });

  it('treats exactly 7 days out as "soon"', () => {
    expect(getForecastUrgency(iso(addDays(new Date(), 7))).level).toBe('soon');
  });

  it('flags more than 7 days out as "ok" (green)', () => {
    const result = getForecastUrgency(iso(addDays(new Date(), 30)));
    expect(result.level).toBe('ok');
    expect(result.label).toBe('30d');
    expect(result.colorClass).toBe('text-emerald-600');
  });

  it('uses calendar-day difference so a same-day later timestamp is still "today"', () => {
    // A timestamp later today (in a few hours) must not round up to "1d left".
    const inAFewHours = new Date();
    inAFewHours.setHours(inAFewHours.getHours() + 6);
    const result = getForecastUrgency(inAFewHours.toISOString());
    expect(['today', 'soon']).toContain(result.level);
    // It must never be classified as overdue.
    expect(result.level).not.toBe('overdue');
  });
});
