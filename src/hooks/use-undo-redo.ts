'use client';

/**
 * {{Org_name}} Experience Platform — Generic Type-Safe Undo/Redo Hook
 *
 * Provides a bounded history stack with single-source-of-truth state transitions.
 *
 * Conforms to:
 * - Strict Typing: Zero `any`, zero `any[]`, zero unhandled `unknown`.
 * - Memory Safety: Bounded past history stack (`maxHistory`, default 50) to prevent memory leaks.
 * - Immutability: Pure functional state updates without direct mutation.
 * - `vercel-react-best-practices`: Stable callbacks with useCallback and functional setState.
 *
 * Caution for future maintainers:
 * - Do not mutate `past` or `future` in place; always return new array references.
 * - `deepEqual` uses JSON serialization for state equality comparison to avoid duplicate frames.
 */

import { useState, useCallback } from 'react';

function deepEqual<T>(a: T, b: T): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

export interface UseUndoRedoReturn<T> {
  readonly state: T;
  readonly set: (newPresent: T) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly reset: (newPresent: T) => void;
}

export const useUndoRedo = <T>(
  initialPresent: T,
  maxHistory: number = 50
): UseUndoRedoReturn<T> => {
  const [history, setHistory] = useState<{
    past: T[];
    present: T;
    future: T[];
  }>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const canUndo = history.past.length !== 0;
  const canRedo = history.future.length !== 0;

  const undo = useCallback(() => {
    setHistory((currentState) => {
      const { past, present, future } = currentState;
      if (past.length === 0) return currentState;

      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);

      return {
        past: newPast,
        present: previous,
        future: [present, ...future],
      };
    });
  }, []);

  const redo = useCallback(() => {
    setHistory((currentState) => {
      const { past, present, future } = currentState;
      if (future.length === 0) return currentState;

      const next = future[0];
      const newFuture = future.slice(1);

      return {
        past: [...past, present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const set = useCallback(
    (newPresent: T) => {
      setHistory((currentState) => {
        const { past, present } = currentState;

        if (deepEqual(newPresent, present)) {
          return currentState;
        }
        return {
          past: [...past.slice(-(maxHistory - 1)), present],
          present: newPresent,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const reset = useCallback((newPresent: T) => {
    setHistory({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    set,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
  };
};
