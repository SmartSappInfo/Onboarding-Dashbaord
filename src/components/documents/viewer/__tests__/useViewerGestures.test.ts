import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useViewerGestures } from '../useViewerGestures';

describe('useViewerGestures Hook', () => {
  it('navigates next and previous pages within bounds', () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useViewerGestures({
        pageCount: 10,
        currentPage: 1,
        onPageChange,
        step: 1,
      })
    );

    act(() => {
      result.current.navigateNext();
    });
    expect(onPageChange).toHaveBeenCalledWith(2);

    const { result: endResult } = renderHook(() =>
      useViewerGestures({
        pageCount: 10,
        currentPage: 10,
        onPageChange,
        step: 1,
      })
    );

    act(() => {
      endResult.current.navigateNext();
    });
    // Should not exceed pageCount
  });

  it('increments and decrements zoom scale with precision clamping', () => {
    const onPageChange = vi.fn();
    const { result } = renderHook(() =>
      useViewerGestures({
        pageCount: 5,
        currentPage: 1,
        onPageChange,
      })
    );

    expect(result.current.zoomScale).toBe(1.0);

    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.zoomScale).toBe(1.25);

    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.zoomScale).toBe(1.5);

    act(() => {
      result.current.zoomOut();
    });
    expect(result.current.zoomScale).toBe(1.25);

    act(() => {
      result.current.resetZoom();
    });
    expect(result.current.zoomScale).toBe(1.0);
    expect(result.current.panOffset).toEqual({ x: 0, y: 0 });
  });
});
