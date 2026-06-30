'use client';

import * as React from 'react';

export type HistoryState<T> = {
  past: T[];
  present: T;
  future: T[];
};

/**
 * A custom hook that tracks state history, enabling undo and redo transactions.
 * Designed to be lightweight and prevent duplicate historical entries.
 */
export function useFormHistory<T>(initialPresent: T) {
  const [state, setState] = React.useState<HistoryState<T>>({
    past: [],
    present: initialPresent,
    future: [],
  });

  const set = React.useCallback((newPresent: T | ((prev: T) => T)) => {
    setState(current => {
      const resolvedPresent = typeof newPresent === 'function'
        ? (newPresent as (prev: T) => T)(current.present)
        : newPresent;

      // Direct string comparison to prevent pushing duplicate states onto history
      if (JSON.stringify(current.present) === JSON.stringify(resolvedPresent)) {
        return current;
      }
      return {
        past: [...current.past, current.present].slice(-50), // Cap undo history at 50 records
        present: resolvedPresent,
        future: [], // Reset redo stack when a new action is performed
      };
    });
  }, []);

  const undo = React.useCallback(() => {
    setState(current => {
      if (current.past.length === 0) return current;
      
      const previous = current.past[current.past.length - 1];
      const newPast = current.past.slice(0, current.past.length - 1);
      
      return {
        past: newPast,
        present: previous,
        future: [current.present, ...current.future],
      };
    });
  }, []);

  const redo = React.useCallback(() => {
    setState(current => {
      if (current.future.length === 0) return current;
      
      const next = current.future[0];
      const newFuture = current.future.slice(1);
      
      return {
        past: [...current.past, current.present],
        present: next,
        future: newFuture,
      };
    });
  }, []);

  const reset = React.useCallback((newPresent: T) => {
    setState({
      past: [],
      present: newPresent,
      future: [],
    });
  }, []);

  return {
    state: state.present,
    update: set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
