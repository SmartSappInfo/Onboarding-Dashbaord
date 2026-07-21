import { describe, it, expect } from 'vitest';
import { mapWithConcurrency } from '../concurrency';

/** Resolves after a tick, recording how many calls were in flight simultaneously. */
function tracker() {
  const state = { inFlight: 0, peak: 0 };
  return {
    state,
    run: async <T>(value: T): Promise<T> => {
      state.inFlight++;
      state.peak = Math.max(state.peak, state.inFlight);
      await new Promise((r) => setTimeout(r, 1));
      state.inFlight--;
      return value;
    },
  };
}

describe('mapWithConcurrency', () => {
  it('never exceeds the concurrency limit', async () => {
    const t = tracker();
    const items = Array.from({ length: 20 }, (_, i) => i);

    await mapWithConcurrency(items, 3, (i) => t.run(i));

    expect(t.state.peak).toBeLessThanOrEqual(3);
    expect(t.state.peak).toBeGreaterThan(1); // actually parallel, not serial
  });

  it('returns settled results in input order', async () => {
    const items = ['a', 'b', 'c'];
    const results = await mapWithConcurrency(items, 2, async (v) => v.toUpperCase());

    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual(['A', 'B', 'C']);
  });

  it('isolates failures without aborting the rest', async () => {
    const items = [1, 2, 3, 4];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      if (n === 2) throw new Error('boom');
      return n * 10;
    });

    expect(results[1].status).toBe('rejected');
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(3);
    expect(results[3].status === 'fulfilled' && results[3].value).toBe(40);
  });

  it('passes the index to the worker', async () => {
    const seen: number[] = [];
    await mapWithConcurrency(['x', 'y'], 1, async (_v, i) => {
      seen.push(i);
      return i;
    });
    expect(seen).toEqual([0, 1]);
  });

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapWithConcurrency([], 5, async (v) => v)).toEqual([]);
    const r = await mapWithConcurrency([1], 99, async (v) => v);
    expect(r).toHaveLength(1);
  });

  it('treats a non-positive limit as serial rather than stalling', async () => {
    const results = await mapWithConcurrency([1, 2], 0, async (v) => v);
    expect(results.map((r) => (r.status === 'fulfilled' ? r.value : null))).toEqual([1, 2]);
  });
});
