import { describe, it, expect } from 'vitest';
import { calculateExpectedCloseDate, PipelineOffsetConfig } from './deal-expected-close';

describe('calculateExpectedCloseDate', () => {
  const mockBaseDate = new Date('2026-07-01T12:00:00.000Z');

  it('should return explicit date as ISO string if provided and valid', () => {
    const explicit = '2026-08-15';
    const result = calculateExpectedCloseDate(
      { defaultCloseDateOffsetValue: 30, defaultCloseDateOffsetUnit: 'days' },
      explicit,
      mockBaseDate
    );
    expect(result).toBe(new Date(explicit).toISOString());
  });

  it('should default to 30 days from baseDate if no explicit date and pipeline has no custom offset', () => {
    const expected = new Date('2026-07-31T12:00:00.000Z').toISOString();
    expect(calculateExpectedCloseDate(null, null, mockBaseDate)).toBe(expected);
    expect(calculateExpectedCloseDate(undefined, '', mockBaseDate)).toBe(expected);
  });

  it('should return null if fallbackDays is explicitly passed as null', () => {
    expect(calculateExpectedCloseDate(null, null, mockBaseDate, null)).toBeNull();
    expect(calculateExpectedCloseDate(undefined, '', mockBaseDate, null)).toBeNull();
  });

  it('should default to 30 days if pipeline offset value is not set or <= 0', () => {
    const expected = new Date('2026-07-31T12:00:00.000Z').toISOString();
    const configZero: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 0, defaultCloseDateOffsetUnit: 'days' };
    const configNegative: PipelineOffsetConfig = { defaultCloseDateOffsetValue: -5, defaultCloseDateOffsetUnit: 'days' };
    const configNil: PipelineOffsetConfig = { defaultCloseDateOffsetValue: null, defaultCloseDateOffsetUnit: 'days' };

    expect(calculateExpectedCloseDate(configZero, null, mockBaseDate)).toBe(expected);
    expect(calculateExpectedCloseDate(configNegative, null, mockBaseDate)).toBe(expected);
    expect(calculateExpectedCloseDate(configNil, null, mockBaseDate)).toBe(expected);
  });

  it('should default to 30 days if offset unit is not valid', () => {
    const expected = new Date('2026-07-31T12:00:00.000Z').toISOString();
    const configNoUnit: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 14, defaultCloseDateOffsetUnit: null };
    expect(calculateExpectedCloseDate(configNoUnit, null, mockBaseDate)).toBe(expected);
  });

  it('should correctly calculate offset in hours', () => {
    const config: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 48, defaultCloseDateOffsetUnit: 'hours' };
    const result = calculateExpectedCloseDate(config, null, mockBaseDate);
    const expected = new Date('2026-07-03T12:00:00.000Z').toISOString();
    expect(result).toBe(expected);
  });

  it('should correctly calculate offset in days', () => {
    const config: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 14, defaultCloseDateOffsetUnit: 'days' };
    const result = calculateExpectedCloseDate(config, null, mockBaseDate);
    const expected = new Date('2026-07-15T12:00:00.000Z').toISOString();
    expect(result).toBe(expected);
  });

  it('should correctly calculate offset in months', () => {
    const config: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 3, defaultCloseDateOffsetUnit: 'months' };
    const result = calculateExpectedCloseDate(config, null, mockBaseDate);
    const expected = new Date('2026-10-01T12:00:00.000Z').toISOString();
    expect(result).toBe(expected);
  });
});
