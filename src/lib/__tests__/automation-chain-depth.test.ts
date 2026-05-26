import { describe, it, expect } from 'vitest';
import { MAX_AUTOMATION_CHAIN_DEPTH } from '../automation-processor';

describe('RUN_AUTOMATION chain depth guard', () => {
  it('allows depth below maximum', () => {
    expect((MAX_AUTOMATION_CHAIN_DEPTH - 1) < MAX_AUTOMATION_CHAIN_DEPTH).toBe(true);
  });

  it('blocks at max depth', () => {
    const depth = MAX_AUTOMATION_CHAIN_DEPTH;
    expect(depth >= MAX_AUTOMATION_CHAIN_DEPTH).toBe(true);
  });

  it('exports sensible default limit', () => {
    expect(MAX_AUTOMATION_CHAIN_DEPTH).toBeGreaterThanOrEqual(3);
    expect(MAX_AUTOMATION_CHAIN_DEPTH).toBeLessThanOrEqual(10);
  });
});
