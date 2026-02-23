/**
 * @fileOverview Utilities for converting between different coordinate systems.
 * Systems: 
 * - Percentage (0-100): Used for Firestore storage and responsive rendering.
 * - Pixel (px): Used for browser-level events and dnd-kit interactions.
 */

/**
 * Converts a pixel value to a percentage relative to a total size.
 */
export function pxToPercent(px: number, totalPx: number): number {
  if (totalPx === 0) return 0;
  return (px / totalPx) * 100;
}

/**
 * Converts a percentage value to pixels relative to a total size.
 */
export function percentToPx(percent: number, totalPx: number): number {
  return (percent / 100) * totalPx;
}

/**
 * Rounds a number to a specific precision to avoid floating point drift.
 */
export function roundCoord(value: number, precision: number = 2): number {
  const multiplier = Math.pow(10, precision);
  return Math.round(value * multiplier) / multiplier;
}

/**
 * Ensures a value stays within the 0-100 bounds.
 */
export function clampPercent(value: number, dimensionPercent: number = 0): number {
  return Math.max(0, Math.min(100 - dimensionPercent, value));
}
