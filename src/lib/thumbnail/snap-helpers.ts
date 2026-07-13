import type { CanvasElement } from './thumbnail-types';

export interface SnapLine {
  type: 'vertical' | 'horizontal';
  coordinate: number; // percentage value (0 - 100)
}

export interface SnapResult {
  x: number;
  y: number;
  guides: SnapLine[];
}

const SNAP_THRESHOLD_PX = 8;
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

export function calculateSnapping(
  activeEl: CanvasElement,
  otherElements: CanvasElement[]
): SnapResult {
  const xThreshold = (SNAP_THRESHOLD_PX / CANVAS_WIDTH) * 100;
  const yThreshold = (SNAP_THRESHOLD_PX / CANVAS_HEIGHT) * 100;

  let snappedX = activeEl.x;
  let snappedY = activeEl.y;
  const guides: SnapLine[] = [];

  const activeLeft = activeEl.x;
  const activeRight = activeEl.x + activeEl.width;
  const activeCenterX = activeEl.x + activeEl.width / 2;

  const activeTop = activeEl.y;
  const activeBottom = activeEl.y + activeEl.height;
  const activeCenterY = activeEl.y + activeEl.height / 2;

  // 1. Build alignment checkpoints (other elements + canvas boundaries)
  // Checkpoints for X axis (Vertical guides)
  const xCheckpoints: Array<{ value: number; label: string }> = [
    { value: 0, label: 'canvas-start' },
    { value: 50, label: 'canvas-center' },
    { value: 100, label: 'canvas-end' }
  ];

  // Checkpoints for Y axis (Horizontal guides)
  const yCheckpoints: Array<{ value: number; label: string }> = [
    { value: 0, label: 'canvas-start' },
    { value: 50, label: 'canvas-center' },
    { value: 100, label: 'canvas-end' }
  ];

  // Add other visible and unlocked elements to checkpoints
  otherElements.forEach((el) => {
    if (el.isHidden || el.id === activeEl.id) return;
    
    const left = el.x;
    const right = el.x + el.width;
    const center = el.x + el.width / 2;

    xCheckpoints.push(
      { value: left, label: el.id },
      { value: right, label: el.id },
      { value: center, label: el.id }
    );

    const top = el.y;
    const bottom = el.y + el.height;
    const vCenter = el.y + el.height / 2;

    yCheckpoints.push(
      { value: top, label: el.id },
      { value: bottom, label: el.id },
      { value: vCenter, label: el.id }
    );
  });

  // 2. Perform X Axis Snapping (Vertical lines)
  let bestDiffX = xThreshold;
  let targetSnapX: number | null = null;

  for (const checkpoint of xCheckpoints) {
    // A. Check Left Edge snapping
    const diffLeft = Math.abs(activeLeft - checkpoint.value);
    if (diffLeft < bestDiffX) {
      bestDiffX = diffLeft;
      targetSnapX = checkpoint.value;
      snappedX = checkpoint.value;
    }

    // B. Check Right Edge snapping
    const diffRight = Math.abs(activeRight - checkpoint.value);
    if (diffRight < bestDiffX) {
      bestDiffX = diffRight;
      targetSnapX = checkpoint.value;
      snappedX = checkpoint.value - activeEl.width;
    }

    // C. Check Center X snapping
    const diffCenter = Math.abs(activeCenterX - checkpoint.value);
    if (diffCenter < bestDiffX) {
      bestDiffX = diffCenter;
      targetSnapX = checkpoint.value;
      snappedX = checkpoint.value - activeEl.width / 2;
    }
  }

  if (targetSnapX !== null) {
    guides.push({ type: 'vertical', coordinate: targetSnapX });
  }

  // 3. Perform Y Axis Snapping (Horizontal lines)
  let bestDiffY = yThreshold;
  let targetSnapY: number | null = null;

  for (const checkpoint of yCheckpoints) {
    // A. Check Top Edge snapping
    const diffTop = Math.abs(activeTop - checkpoint.value);
    if (diffTop < bestDiffY) {
      bestDiffY = diffTop;
      targetSnapY = checkpoint.value;
      snappedY = checkpoint.value;
    }

    // B. Check Bottom Edge snapping
    const diffBottom = Math.abs(activeBottom - checkpoint.value);
    if (diffBottom < bestDiffY) {
      bestDiffY = diffBottom;
      targetSnapY = checkpoint.value;
      snappedY = checkpoint.value - activeEl.height;
    }

    // C. Check Center Y snapping
    const diffCenter = Math.abs(activeCenterY - checkpoint.value);
    if (diffCenter < bestDiffY) {
      bestDiffY = diffCenter;
      targetSnapY = checkpoint.value;
      snappedY = checkpoint.value - activeEl.height / 2;
    }
  }

  if (targetSnapY !== null) {
    guides.push({ type: 'horizontal', coordinate: targetSnapY });
  }

  return {
    x: snappedX,
    y: snappedY,
    guides
  };
}
