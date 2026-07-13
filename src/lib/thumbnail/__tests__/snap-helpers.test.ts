import { expect, test, describe } from 'vitest';
import { calculateSnapping } from '../snap-helpers';
import type { CanvasElement } from '../thumbnail-types';

describe('Snapping Engine Helpers', () => {
  const otherElements: CanvasElement[] = [
    { id: 'el-static-1', type: 'rect', x: 20, y: 20, width: 10, height: 10, zIndex: 1 }
  ];

  test('snaps element left edge when close to other element left edge', () => {
    // Left edge at 20.2% is within threshold of static element at 20%
    const activeEl: CanvasElement = {
      id: 'el-active',
      type: 'rect',
      x: 20.2,
      y: 40,
      width: 15,
      height: 15,
      zIndex: 2
    };

    const res = calculateSnapping(activeEl, otherElements);
    expect(res.x).toBe(20); // Snapped
    expect(res.guides.length).toBeGreaterThan(0);
    expect(res.guides[0].type).toBe('vertical');
    expect(res.guides[0].coordinate).toBe(20);
  });

  test('snaps element center when close to canvas center (50%)', () => {
    // Center at 49.8% is within threshold of canvas center 50%
    const activeEl: CanvasElement = {
      id: 'el-active',
      type: 'rect',
      x: 44.8, // width is 10, so center is 49.8
      y: 10,
      width: 10,
      height: 10,
      zIndex: 2
    };

    const res = calculateSnapping(activeEl, []);
    expect(res.x).toBe(45); // Snapped to center: 50 - 10/2 = 45
    expect(res.guides[0].coordinate).toBe(50);
  });
});
