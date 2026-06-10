import { describe, it, expect } from 'vitest';
import { mergeById } from './deal-select-utils';

describe('mergeById', () => {
  const a = { id: 'a', name: 'A' };
  const b = { id: 'b', name: 'B' };

  it('returns the list unchanged when current is already present', () => {
    const result = mergeById([a, b], a);
    expect(result).toEqual([a, b]);
    expect(result).toHaveLength(2);
  });

  it('appends current when it is missing from the list', () => {
    expect(mergeById([a], b)).toEqual([a, b]);
  });

  it('returns the list unchanged when current is null/undefined', () => {
    expect(mergeById([a, b], null)).toEqual([a, b]);
    expect(mergeById([a, b], undefined)).toEqual([a, b]);
  });

  it('handles a null/undefined list', () => {
    expect(mergeById(null, a)).toEqual([a]);
    expect(mergeById(undefined, a)).toEqual([a]);
    expect(mergeById(null, null)).toEqual([]);
  });

  it('matches by id, not reference (stale snapshot vs fresh doc)', () => {
    const staleA = { id: 'a', name: 'A (old)' };
    const freshA = { id: 'a', name: 'A (new)' };
    // current already in list by id → list kept as-is (no duplicate)
    const result = mergeById([staleA], freshA);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('A (old)');
  });
});
