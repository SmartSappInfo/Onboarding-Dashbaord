'use client';

/**
 * Motion props for animating block enter/reorder in the editor canvas.
 *
 * Follows emilkowal-animations: animate transform/opacity only, short spring for
 * interruptible drags, and a hard opt-out under `prefers-reduced-motion`.
 *
 * The decision logic is a PURE function (`getBlockMotion`) so it's testable
 * without `matchMedia`; the hook just feeds it the detected preference.
 */
import { useReducedMotion } from 'framer-motion';

export interface BlockMotion {
  layout: boolean;
  initial: false | { opacity: number; y: number };
  animate: { opacity: number; y: number };
  transition: { duration: number } | { type: 'spring'; stiffness: number; damping: number };
}

const REDUCED: BlockMotion = {
  layout: false,
  initial: false,
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0 },
};

const FULL: BlockMotion = {
  layout: true,
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { type: 'spring', stiffness: 500, damping: 40 },
};

/** Pure: choose motion config from the reduced-motion preference. */
export function getBlockMotion(reduced: boolean): BlockMotion {
  return reduced ? REDUCED : FULL;
}

/** Hook: resolve motion config from the user's reduced-motion preference. */
export function useBlockMotion(): BlockMotion {
  const reduced = useReducedMotion();
  return getBlockMotion(reduced ?? false);
}
