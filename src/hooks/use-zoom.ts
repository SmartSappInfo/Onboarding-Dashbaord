import * as React from 'react';

export interface UseZoomOptions {
  /** Smallest allowed zoom factor (default 0.6). */
  min?: number;
  /** Largest allowed zoom factor (default 2). */
  max?: number;
  /** Increment applied by zoomIn / zoomOut (default 0.1). */
  step?: number;
}

export interface UseZoomResult {
  zoom: number;
  zoomIn: () => void;
  zoomOut: () => void;
  reset: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

const DEFAULT_MIN = 0.6;
const DEFAULT_MAX = 2;
const DEFAULT_STEP = 0.1;

/** Round to 2 decimals to avoid floating-point drift from repeated 0.1 steps. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Headless zoom state with clamping. Used by surfaces that scale their content
 * (e.g. the interactive script view's dialogue panel). Pure and side-effect free
 * so it can be unit-tested in isolation.
 */
export function useZoom(initial = 1, options: UseZoomOptions = {}): UseZoomResult {
  const { min = DEFAULT_MIN, max = DEFAULT_MAX, step = DEFAULT_STEP } = options;

  // Lazy init so the clamp only runs once (rerender-lazy-state-init).
  const [zoom, setZoom] = React.useState(() => round2(clamp(initial, min, max)));

  // Functional updates → stable callbacks, no stale closures (rerender-functional-setstate).
  const zoomIn = React.useCallback(() => {
    setZoom((z) => round2(clamp(z + step, min, max)));
  }, [min, max, step]);

  const zoomOut = React.useCallback(() => {
    setZoom((z) => round2(clamp(z - step, min, max)));
  }, [min, max, step]);

  const reset = React.useCallback(() => {
    setZoom(round2(clamp(initial, min, max)));
  }, [initial, min, max]);

  return {
    zoom,
    zoomIn,
    zoomOut,
    reset,
    canZoomIn: zoom < max,
    canZoomOut: zoom > min,
  };
}
