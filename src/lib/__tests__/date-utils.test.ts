import { describe, it, expect } from 'vitest';
import {
  parseSafeDate,
  formatSafeDate,
  formatSafeRelativeTime,
  formatSafeLocaleDate,
} from '../date-utils';

describe('parseSafeDate', () => {
  it('handles null and undefined', () => {
    expect(parseSafeDate(null)).toBeNull();
    expect(parseSafeDate(undefined)).toBeNull();
  });

  it('handles empty strings and invalid strings without throwing', () => {
    expect(parseSafeDate('')).toBeNull();
    expect(parseSafeDate('   ')).toBeNull();
    expect(parseSafeDate('invalid')).toBeNull();
    expect(parseSafeDate('Invalid Date')).toBeNull();
    expect(parseSafeDate('NaN')).toBeNull();
  });

  it('parses ISO date strings correctly', () => {
    const iso = '2026-09-14T03:00:00.000Z';
    const result = parseSafeDate(iso);
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe(iso);
  });

  it('parses YYYY-MM-DD date strings', () => {
    const dateStr = '2026-09-14';
    const result = parseSafeDate(dateStr);
    expect(result).toBeInstanceOf(Date);
    expect(Number.isNaN(result?.getTime())).toBe(false);
  });

  it('parses numeric timestamps in milliseconds', () => {
    const ms = 1726282000000;
    const result = parseSafeDate(ms);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(ms);
  });

  it('parses numeric timestamps in seconds (Unix epoch)', () => {
    const sec = 1726282000;
    const result = parseSafeDate(sec);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(sec * 1000);
  });

  it('handles Date instances', () => {
    const d = new Date('2026-09-14T03:00:00.000Z');
    expect(parseSafeDate(d)).toBe(d);

    const invalidDate = new Date(NaN);
    expect(parseSafeDate(invalidDate)).toBeNull();
  });

  it('parses client Firestore Timestamp with toDate() method', () => {
    const mockTimestamp = {
      toDate: () => new Date('2026-09-14T10:00:00.000Z'),
    };
    const result = parseSafeDate(mockTimestamp);
    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2026-09-14T10:00:00.000Z');
  });

  it('parses serialized Firestore Timestamp objects ({ seconds, nanoseconds })', () => {
    const serialized = { seconds: 1726282000, nanoseconds: 0 };
    const result = parseSafeDate(serialized);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1726282000000);
  });

  it('parses Admin SDK serialized Firestore Timestamp ({ _seconds, _nanoseconds })', () => {
    const adminSerialized = { _seconds: 1726282000, _nanoseconds: 500000000 };
    const result = parseSafeDate(adminSerialized);
    expect(result).toBeInstanceOf(Date);
    expect(result?.getTime()).toBe(1726282000000);
  });

  it('handles invalid object shapes gracefully', () => {
    expect(parseSafeDate({})).toBeNull();
    expect(parseSafeDate({ foo: 'bar' })).toBeNull();
    expect(parseSafeDate({ seconds: 'not-a-number' })).toBeNull();
  });
});

describe('formatSafeDate', () => {
  it('formats valid date with given format string', () => {
    const d = '2026-09-14T12:00:00.000Z';
    const result = formatSafeDate(d, 'yyyy-MM-dd');
    expect(result).toBe('2026-09-14');
  });

  it('returns fallback for invalid dates without throwing RangeError', () => {
    expect(formatSafeDate(null, 'PPP', 'N/A')).toBe('N/A');
    expect(formatSafeDate('invalid', 'PPP', 'TBD')).toBe('TBD');
    expect(formatSafeDate(new Date(NaN), 'PPP', 'None')).toBe('None');
    expect(formatSafeDate({}, 'PPP', 'Fallback')).toBe('Fallback');
  });
});

describe('formatSafeRelativeTime', () => {
  it('returns fallback for invalid dates without throwing', () => {
    expect(formatSafeRelativeTime(null, 'recently')).toBe('recently');
    expect(formatSafeRelativeTime('invalid', 'unknown')).toBe('unknown');
  });

  it('formats relative distance for valid date', () => {
    const now = new Date();
    const result = formatSafeRelativeTime(now);
    expect(result).toContain('ago');
  });
});

describe('formatSafeLocaleDate', () => {
  it('returns fallback for invalid dates without throwing', () => {
    expect(formatSafeLocaleDate(null, 'TBD')).toBe('TBD');
    expect(formatSafeLocaleDate('invalid', 'Recently')).toBe('Recently');
  });

  it('formats valid date with toLocaleDateString', () => {
    const result = formatSafeLocaleDate('2026-09-14T00:00:00.000Z');
    expect(result).not.toBe('TBD');
  });
});
