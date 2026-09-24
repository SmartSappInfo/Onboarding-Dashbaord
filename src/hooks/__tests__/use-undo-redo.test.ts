import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUndoRedo } from '../use-undo-redo';

describe('useUndoRedo hook', () => {
  it('initializes with present value and empty past/future', () => {
    const { result } = renderHook(() => useUndoRedo<string>('initial'));
    expect(result.current.state).toBe('initial');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('records state transitions and allows undo/redo', () => {
    const { result } = renderHook(() => useUndoRedo<string>('v1'));

    act(() => {
      result.current.set('v2');
    });

    expect(result.current.state).toBe('v2');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);

    act(() => {
      result.current.undo();
    });

    expect(result.current.state).toBe('v1');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    act(() => {
      result.current.redo();
    });

    expect(result.current.state).toBe('v2');
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('caps history size to prevent unbounded memory growth', () => {
    const { result } = renderHook(() => useUndoRedo<number>(0, 5));

    for (let i = 1; i <= 10; i++) {
      act(() => {
        result.current.set(i);
      });
    }

    expect(result.current.state).toBe(10);
    // Bounded to 5 items in past history
    for (let i = 0; i < 5; i++) {
      act(() => {
        result.current.undo();
      });
    }
    expect(result.current.canUndo).toBe(false);
    expect(result.current.state).toBe(5);
  });

  it('resets history cleanly with new present value', () => {
    const { result } = renderHook(() => useUndoRedo<string>('initial'));

    act(() => {
      result.current.set('changed');
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.reset('fresh');
    });
    expect(result.current.state).toBe('fresh');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
