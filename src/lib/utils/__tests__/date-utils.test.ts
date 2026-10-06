import { describe, it, expect } from 'vitest';
import { safeParseDate, isValidDate, formatTaskDueDate, formatTaskDate } from '../date-utils';

describe('date-utils defensive helpers', () => {
  describe('isValidDate', () => {
    it('returns true for valid Date instances', () => {
      expect(isValidDate(new Date())).toBe(true);
      expect(isValidDate(new Date('2026-10-06T12:00:00Z'))).toBe(true);
    });

    it('returns false for invalid Date instances and non-dates', () => {
      expect(isValidDate(new Date('invalid-date'))).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate('2026-10-06')).toBe(false);
      expect(isValidDate(123456789)).toBe(false);
    });
  });

  describe('safeParseDate', () => {
    it('parses valid ISO strings into Date objects', () => {
      const parsed = safeParseDate('2026-10-06T14:30:00Z');
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.toISOString()).toBe('2026-10-06T14:30:00.000Z');
    });

    it('returns Date object as-is if already valid', () => {
      const original = new Date('2026-10-06T14:30:00Z');
      const parsed = safeParseDate(original);
      expect(parsed).toBe(original);
    });

    it('parses numeric epoch timestamps', () => {
      const epoch = 1791207921203;
      const parsed = safeParseDate(epoch);
      expect(parsed).toBeInstanceOf(Date);
      expect(parsed?.getTime()).toBe(epoch);
    });

    it('returns null safely for null, undefined, empty strings, and malformed values', () => {
      expect(safeParseDate(null)).toBeNull();
      expect(safeParseDate(undefined)).toBeNull();
      expect(safeParseDate('')).toBeNull();
      expect(safeParseDate('   ')).toBeNull();
      expect(safeParseDate('not-a-date')).toBeNull();
      expect(safeParseDate({})).toBeNull();
      expect(safeParseDate([])).toBeNull();
    });
  });

  describe('formatTaskDueDate', () => {
    it('formats a valid date string with default pattern MMM d', () => {
      const formatted = formatTaskDueDate('2026-10-06T12:00:00Z');
      expect(formatted).toBe('Oct 6');
    });

    it('formats a valid date string with custom pattern', () => {
      const formatted = formatTaskDueDate('2026-10-06T12:00:00Z', 'yyyy-MM-dd');
      expect(formatted).toBe('2026-10-06');
    });

    it('returns fallback string when date is invalid or missing', () => {
      expect(formatTaskDueDate(null)).toBe('No due date');
      expect(formatTaskDueDate(undefined)).toBe('No due date');
      expect(formatTaskDueDate('', 'MMM d', 'None')).toBe('None');
      expect(formatTaskDueDate('invalid', 'MMM d', 'TBD')).toBe('TBD');
    });
  });

  describe('formatTaskDate', () => {
    it('formats general task dates with safe fallbacks', () => {
      expect(formatTaskDate('2026-10-06T12:00:00Z', 'MMM d, yyyy')).toBe('Oct 6, 2026');
      expect(formatTaskDate(null, 'MMM d, yyyy', '—')).toBe('—');
    });
  });
});
