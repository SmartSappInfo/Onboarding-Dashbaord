import { describe, it, expect } from 'vitest';
import {
  computeBoundingBox,
  calculateAlignment,
  calculateDistribution,
  calculateSmartGuides,
} from '../smart-guides';
import type { CreativeElement, BoundingBox } from '../creative-types';

describe('Smart Guides & Alignment Math Engine (Phase 2)', () => {
  const el1: CreativeElement = {
    id: 'el-1',
    type: 'text',
    x: 10,
    y: 20,
    width: 30,
    height: 10,
    zIndex: 1,
  };

  const el2: CreativeElement = {
    id: 'el-2',
    type: 'text',
    x: 50,
    y: 40,
    width: 20,
    height: 10,
    zIndex: 2,
  };

  const el3: CreativeElement = {
    id: 'el-3',
    type: 'text',
    x: 80,
    y: 60,
    width: 10,
    height: 10,
    zIndex: 3,
  };

  it('should compute the bounding box enclosing multiple elements', () => {
    const bbox = computeBoundingBox([el1, el2, el3]);
    expect(bbox).not.toBeNull();
    expect(bbox?.x).toBe(10);
    expect(bbox?.y).toBe(20);
    expect(bbox?.width).toBe(80); // max X is 80 + 10 = 90. 90 - 10 = 80
    expect(bbox?.height).toBe(50); // max Y is 60 + 10 = 70. 70 - 20 = 50
  });

  it('should calculate left, center, and right alignments', () => {
    const leftPatches = calculateAlignment([el1, el2], 'left');
    expect(leftPatches[0].patch.x).toBe(10);
    expect(leftPatches[1].patch.x).toBe(10);

    const rightPatches = calculateAlignment([el1, el2], 'right');
    // Bbox width is (50+20) - 10 = 60. Right edge is 70.
    // el1 (w=30) -> x = 70 - 30 = 40
    // el2 (w=20) -> x = 70 - 20 = 50
    expect(rightPatches[0].patch.x).toBe(40);
    expect(rightPatches[1].patch.x).toBe(50);

    const centerPatches = calculateAlignment([el1, el2], 'center');
    // Bbox center is 10 + 60/2 = 40
    // el1 (w=30) -> x = 10 + (60 - 30)/2 = 25
    // el2 (w=20) -> x = 10 + (60 - 20)/2 = 30
    expect(centerPatches[0].patch.x).toBe(25);
    expect(centerPatches[1].patch.x).toBe(30);
  });

  it('should calculate top, middle, and bottom vertical alignments', () => {
    const topPatches = calculateAlignment([el1, el2], 'top');
    expect(topPatches[0].patch.y).toBe(20);
    expect(topPatches[1].patch.y).toBe(20);

    const bottomPatches = calculateAlignment([el1, el2], 'bottom');
    // Bbox bottom is 50.
    // el1 (h=10) -> y = 50 - 10 = 40
    // el2 (h=10) -> y = 50 - 10 = 40
    expect(bottomPatches[0].patch.y).toBe(40);
    expect(bottomPatches[1].patch.y).toBe(40);
  });

  it('should distribute elements with equal gaps along horizontal axis', () => {
    const patches = calculateDistribution([el1, el2, el3], 'horizontal');
    expect(patches).toHaveLength(3);
    // Elements should be evenly spaced between 10 and 90
    expect(patches[0].patch.x).toBe(10);
    expect(patches[2].patch.x).toBe(80);
    // Middle element x should be in between
    expect(patches[1].patch.x).toBeGreaterThan(10);
    expect(patches[1].patch.x).toBeLessThan(80);
  });

  it('should snap to canvas center (50%) within threshold', () => {
    const boxNearCenter: BoundingBox = {
      x: 34.5, // width = 30, center = 34.5 + 15 = 49.5 (0.5% away from 50)
      y: 20,
      width: 30,
      height: 20,
    };

    const { snappedBox, guides } = calculateSmartGuides(boxNearCenter, [], 1.0);
    expect(snappedBox.x).toBe(35); // 50 - 15 = 35
    expect(guides.some((g) => g.position === 50)).toBe(true);
  });

  it('should snap to peer element left edge', () => {
    const peer: CreativeElement = {
      id: 'peer-1',
      type: 'text',
      x: 25,
      y: 10,
      width: 20,
      height: 10,
      zIndex: 1,
    };

    const boxNearPeer: BoundingBox = {
      x: 25.4, // 0.4% from peer left (25)
      y: 50,
      width: 20,
      height: 20,
    };

    const { snappedBox, guides } = calculateSmartGuides(boxNearPeer, [peer], 1.0);
    expect(snappedBox.x).toBe(25);
    expect(guides.some((g) => g.position === 25)).toBe(true);
  });
});
