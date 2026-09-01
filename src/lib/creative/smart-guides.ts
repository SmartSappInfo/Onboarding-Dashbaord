/**
 * ARCHITECTURE:
 * Smart Guides, Snapping & Alignment Math Engine (Phase 2)
 * 
 * Provides high-precision mathematical operations for multi-selection bounding boxes,
 * axis alignments, equidistant gap distribution, and magnetic snapping guides.
 * 
 * CAUTION:
 * All calculations use percentage coordinates (0 - 100%) normalized to a 16:9 base frame.
 * Strict typing enforced (0% any).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/smart-guides.test.ts
 */

import type {
  CreativeElement,
  BoundingBox,
  AlignmentType,
  DistributionType,
  SnapGuideLine,
} from './creative-types';

/**
 * Computes the axis-aligned bounding box enclosing an array of elements.
 */
export function computeBoundingBox(elements: CreativeElement[]): BoundingBox | null {
  if (!elements || elements.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    const right = el.x + el.width;
    const bottom = el.y + el.height;

    if (el.x < minX) minX = el.x;
    if (el.y < minY) minY = el.y;
    if (right > maxX) maxX = right;
    if (bottom > maxY) maxY = bottom;
  }

  return {
    x: Math.max(0, minX),
    y: Math.max(0, minY),
    width: Math.min(100, maxX - minX),
    height: Math.min(100, maxY - minY),
  };
}

/**
 * Calculates alignment patches for a set of selected elements relative to their common bounding box.
 */
export function calculateAlignment(
  elements: CreativeElement[],
  alignment: AlignmentType
): { id: string; patch: Partial<CreativeElement> }[] {
  if (elements.length < 2) return [];

  const bbox = computeBoundingBox(elements);
  if (!bbox) return [];

  return elements.map((el) => {
    let newX = el.x;
    let newY = el.y;

    switch (alignment) {
      case 'left':
        newX = bbox.x;
        break;
      case 'center':
        newX = bbox.x + (bbox.width - el.width) / 2;
        break;
      case 'right':
        newX = bbox.x + bbox.width - el.width;
        break;
      case 'top':
        newY = bbox.y;
        break;
      case 'middle':
        newY = bbox.y + (bbox.height - el.height) / 2;
        break;
      case 'bottom':
        newY = bbox.y + bbox.height - el.height;
        break;
    }

    return {
      id: el.id,
      patch: { x: Number(newX.toFixed(2)), y: Number(newY.toFixed(2)) },
    };
  });
}

/**
 * Calculates equal-gap distribution patches for 3 or more elements along a specified axis.
 */
export function calculateDistribution(
  elements: CreativeElement[],
  axis: DistributionType
): { id: string; patch: Partial<CreativeElement> }[] {
  if (elements.length < 3) return [];

  // Sort elements along the target axis
  const sorted = [...elements].sort((a, b) => (axis === 'horizontal' ? a.x - b.x : a.y - b.y));

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (axis === 'horizontal') {
    const totalSpan = last.x + last.width - first.x;
    const totalElementsWidth = sorted.reduce((sum, el) => sum + el.width, 0);
    const availableGap = (totalSpan - totalElementsWidth) / (sorted.length - 1);

    let currentX = first.x;
    return sorted.map((el, idx) => {
      if (idx === 0) {
        currentX += el.width + availableGap;
        return { id: el.id, patch: { x: el.x } };
      }
      const patchX = Number(currentX.toFixed(2));
      currentX += el.width + availableGap;
      return { id: el.id, patch: { x: patchX } };
    });
  } else {
    const totalSpan = last.y + last.height - first.y;
    const totalElementsHeight = sorted.reduce((sum, el) => sum + el.height, 0);
    const availableGap = (totalSpan - totalElementsHeight) / (sorted.length - 1);

    let currentY = first.y;
    return sorted.map((el, idx) => {
      if (idx === 0) {
        currentY += el.height + availableGap;
        return { id: el.id, patch: { y: el.y } };
      }
      const patchY = Number(currentY.toFixed(2));
      currentY += el.height + availableGap;
      return { id: el.id, patch: { y: patchY } };
    });
  }
}

/**
 * Evaluates magnetic snapping for an active bounding box against canvas anchors and peer elements.
 */
export function calculateSmartGuides(
  activeBox: BoundingBox,
  peerElements: CreativeElement[],
  snapThreshold = 1.0 // 1.0% threshold
): { snappedBox: BoundingBox; guides: SnapGuideLine[] } {
  let snappedX = activeBox.x;
  let snappedY = activeBox.y;
  const guides: SnapGuideLine[] = [];

  const activeLeft = activeBox.x;
  const activeCenterX = activeBox.x + activeBox.width / 2;
  const activeRight = activeBox.x + activeBox.width;

  const activeTop = activeBox.y;
  const activeCenterY = activeBox.y + activeBox.height / 2;
  const activeBottom = activeBox.y + activeBox.height;

  // 1. Canvas Boundary Snaps
  if (Math.abs(activeCenterX - 50) < snapThreshold) {
    snappedX = 50 - activeBox.width / 2;
    guides.push({ orientation: 'vertical', position: 50, label: 'Center 50%' });
  } else if (Math.abs(activeLeft - 0) < snapThreshold) {
    snappedX = 0;
    guides.push({ orientation: 'vertical', position: 0, label: 'Left Edge' });
  } else if (Math.abs(activeRight - 100) < snapThreshold) {
    snappedX = 100 - activeBox.width;
    guides.push({ orientation: 'vertical', position: 100, label: 'Right Edge' });
  }

  if (Math.abs(activeCenterY - 50) < snapThreshold) {
    snappedY = 50 - activeBox.height / 2;
    guides.push({ orientation: 'horizontal', position: 50, label: 'Middle 50%' });
  } else if (Math.abs(activeTop - 0) < snapThreshold) {
    snappedY = 0;
    guides.push({ orientation: 'horizontal', position: 0, label: 'Top Edge' });
  } else if (Math.abs(activeBottom - 100) < snapThreshold) {
    snappedY = 100 - activeBox.height;
    guides.push({ orientation: 'horizontal', position: 100, label: 'Bottom Edge' });
  }

  // 2. Peer Elements Snaps
  for (const peer of peerElements) {
    const peerLeft = peer.x;
    const peerCenterX = peer.x + peer.width / 2;
    const peerRight = peer.x + peer.width;

    const peerTop = peer.y;
    const peerCenterY = peer.y + peer.height / 2;
    const peerBottom = peer.y + peer.height;

    // Horizontal Alignment Snaps
    if (Math.abs(activeLeft - peerLeft) < snapThreshold) {
      snappedX = peerLeft;
      guides.push({ orientation: 'vertical', position: peerLeft, label: 'Align Left' });
    } else if (Math.abs(activeCenterX - peerCenterX) < snapThreshold) {
      snappedX = peerCenterX - activeBox.width / 2;
      guides.push({ orientation: 'vertical', position: peerCenterX, label: 'Align Center' });
    } else if (Math.abs(activeRight - peerRight) < snapThreshold) {
      snappedX = peerRight - activeBox.width;
      guides.push({ orientation: 'vertical', position: peerRight, label: 'Align Right' });
    }

    // Vertical Alignment Snaps
    if (Math.abs(activeTop - peerTop) < snapThreshold) {
      snappedY = peerTop;
      guides.push({ orientation: 'horizontal', position: peerTop, label: 'Align Top' });
    } else if (Math.abs(activeCenterY - peerCenterY) < snapThreshold) {
      snappedY = peerCenterY - activeBox.height / 2;
      guides.push({ orientation: 'horizontal', position: peerCenterY, label: 'Align Middle' });
    } else if (Math.abs(activeBottom - peerBottom) < snapThreshold) {
      snappedY = peerBottom - activeBox.height;
      guides.push({ orientation: 'horizontal', position: peerBottom, label: 'Align Bottom' });
    }
  }

  return {
    snappedBox: {
      ...activeBox,
      x: Number(snappedX.toFixed(2)),
      y: Number(snappedY.toFixed(2)),
    },
    guides,
  };
}
