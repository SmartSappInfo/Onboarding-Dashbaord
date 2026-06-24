import { describe, it, expect } from 'vitest';
import { getBlockMotion } from '../useBlockMotion';

describe('getBlockMotion', () => {
  it('disables transforms and layout animation when reduced motion is preferred', () => {
    const m = getBlockMotion(true);
    expect(m.layout).toBe(false);
    expect(m.initial).toBe(false);
    expect(m.transition).toEqual({ duration: 0 });
  });

  it('uses an interruptible spring with a subtle enter offset otherwise', () => {
    const m = getBlockMotion(false);
    expect(m.layout).toBe(true);
    expect(m.initial).toEqual({ opacity: 0, y: 8 });
    expect(m.transition).toMatchObject({ type: 'spring' });
  });
});
