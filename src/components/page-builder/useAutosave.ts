'use client';

/**
 * Debounced autosave. Calls `onSave` with the latest value after `delay` ms of
 * idle; rapid changes reschedule (only the final value is saved), and a pending
 * save is cancelled on unmount. Gate with `enabled` (e.g. only after the first
 * edit) to avoid writing freshly-loaded, unchanged data.
 */
import { useEffect, useRef } from 'react';

interface UseAutosaveOptions {
  delay?: number;
  enabled?: boolean;
}

export function useAutosave<T>(value: T, onSave: (value: T) => void, options?: UseAutosaveOptions): void {
  const delay = options?.delay ?? 1500;
  const enabled = options?.enabled ?? true;

  // Keep the latest callback without resubscribing the timer effect.
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;
    const id = setTimeout(() => onSaveRef.current(value), delay);
    return () => clearTimeout(id);
  }, [value, delay, enabled]);
}
