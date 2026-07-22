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

  it('should return null if no explicit date and pipeline is null or undefined', () => {
    expect(calculateExpectedCloseDate(null, null, mockBaseDate)).toBeNull();
    expect(calculateExpectedCloseDate(undefined, '', mockBaseDate)).toBeNull();
  });

  it('should return null if pipeline offset value is not set or <= 0', () => {
    const configZero: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 0, defaultCloseDateOffsetUnit: 'days' };
    const configNegative: PipelineOffsetConfig = { defaultCloseDateOffsetValue: -5, defaultCloseDateOffsetUnit: 'days' };
    const configNil: PipelineOffsetConfig = { defaultCloseDateOffsetValue: null, defaultCloseDateOffsetUnit: 'days' };

    expect(calculateExpectedCloseDate(configZero, null, mockBaseDate)).toBeNull();
    expect(calculateExpectedCloseDate(configNegative, null, mockBaseDate)).toBeNull();
    expect(calculateExpectedCloseDate(configNil, null, mockBaseDate)).toBeNull();
  });

  it('should return null if offset unit is not valid', () => {
    const configNoUnit: PipelineOffsetConfig = { defaultCloseDateOffsetValue: 14, defaultCloseDateOffsetUnit: null };
    expect(calculateExpectedCloseDate(configNoUnit, null, mockBaseDate)).toBeNull();
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
