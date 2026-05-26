import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormHistory } from '../../hooks/use-form-history';

describe('useFormHistory', () => {
  it('should initialize with the provided initial state', () => {
    const { result } = renderHook(() => useFormHistory({ name: 'form-1' }));
    
    expect(result.current.state).toEqual({ name: 'form-1' });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });

  it('should update present state and push previous state to past history', () => {
    const { result } = renderHook(() => useFormHistory({ counter: 0 }));

    act(() => {
      result.current.update({ counter: 1 });
    });

    expect(result.current.state).toEqual({ counter: 1 });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should prevent duplicate snapshots from being pushed to past stack', () => {
    const { result } = renderHook(() => useFormHistory({ text: 'hello' }));

    act(() => {
      result.current.update({ text: 'hello' }); // identical
    });

    expect(result.current.canUndo).toBe(false);
  });

  it('should handle undo and redo transitions correctly', () => {
    const { result } = renderHook(() => useFormHistory({ val: 'A' }));

    // A -> B -> C
    act(() => {
      result.current.update({ val: 'B' });
    });
    act(() => {
      result.current.update({ val: 'C' });
    });

    expect(result.current.state).toEqual({ val: 'C' });
    expect(result.current.canUndo).toBe(true);

    // Undo: present becomes B
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ val: 'B' });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Undo: present becomes A
    act(() => {
      result.current.undo();
    });
    expect(result.current.state).toEqual({ val: 'A' });
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Redo: present becomes B
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toEqual({ val: 'B' });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Redo: present becomes C
    act(() => {
      result.current.redo();
    });
    expect(result.current.state).toEqual({ val: 'C' });
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should cap the undo history stack at 50 records', () => {
    const { result } = renderHook(() => useFormHistory(0));

    // Perform 60 updates
    act(() => {
      for (let i = 1; i <= 60; i++) {
        result.current.update(i);
      }
    });

    expect(result.current.state).toBe(60);
    expect(result.current.canUndo).toBe(true);

    // We should only be able to undo 50 times (since it capped at 50 past entries)
    // present (60), undo 50 times brings us to 10 (not 0)
    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.undo();
      }
    });

    expect(result.current.state).toBe(10);
    expect(result.current.canUndo).toBe(false); // Stack is now empty
  });

  it('should reset present state and clear past/future history stacks', () => {
    const { result } = renderHook(() => useFormHistory('Initial'));

    act(() => {
      result.current.update('Updated');
    });
    expect(result.current.canUndo).toBe(true);

    act(() => {
      result.current.reset('Reset');
    });

    expect(result.current.state).toBe('Reset');
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
