import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAutosave } from '../useAutosave';

describe('useAutosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('saves the latest value once after the idle delay', () => {
    const onSave = vi.fn();
    const { rerender } = renderHook(({ v }) => useAutosave(v, onSave, { delay: 1000 }), {
      initialProps: { v: 1 },
    });

    rerender({ v: 2 });
    vi.advanceTimersByTime(500);
    rerender({ v: 3 }); // resets the debounce
    vi.advanceTimersByTime(500);
    expect(onSave).not.toHaveBeenCalled(); // timer was reset

    vi.advanceTimersByTime(500);
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(3);
  });

  it('does not save when disabled', () => {
    const onSave = vi.fn();
    renderHook(() => useAutosave(1, onSave, { delay: 1000, enabled: false }));
    vi.advanceTimersByTime(5000);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('cancels a pending save on unmount', () => {
    const onSave = vi.fn();
    const { unmount } = renderHook(() => useAutosave(1, onSave, { delay: 1000 }));
    vi.advanceTimersByTime(500);
    unmount();
    vi.advanceTimersByTime(1000);
    expect(onSave).not.toHaveBeenCalled();
  });
});
