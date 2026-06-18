import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useZoom } from '../use-zoom';

describe('useZoom', () => {
  it('starts at the default zoom of 1', () => {
    const { result } = renderHook(() => useZoom());
    expect(result.current.zoom).toBe(1);
    expect(result.current.canZoomIn).toBe(true);
    expect(result.current.canZoomOut).toBe(true);
  });

  it('honours a custom initial value', () => {
    const { result } = renderHook(() => useZoom(1.5));
    expect(result.current.zoom).toBe(1.5);
  });

  it('zooms in by the step and stays rounded to 2 decimals', () => {
    const { result } = renderHook(() => useZoom(1, { step: 0.1 }));
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(1.1);
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(1.2);
  });

  it('zooms out by the step', () => {
    const { result } = renderHook(() => useZoom(1, { step: 0.1 }));
    act(() => result.current.zoomOut());
    expect(result.current.zoom).toBe(0.9);
  });

  it('clamps at the maximum and reports canZoomIn=false', () => {
    const { result } = renderHook(() => useZoom(1.9, { max: 2, step: 0.1 }));
    act(() => result.current.zoomIn()); // 2.0
    expect(result.current.zoom).toBe(2);
    expect(result.current.canZoomIn).toBe(false);
    act(() => result.current.zoomIn()); // stays clamped
    expect(result.current.zoom).toBe(2);
  });

  it('clamps at the minimum and reports canZoomOut=false', () => {
    const { result } = renderHook(() => useZoom(0.7, { min: 0.6, step: 0.1 }));
    act(() => result.current.zoomOut()); // 0.6
    expect(result.current.zoom).toBe(0.6);
    expect(result.current.canZoomOut).toBe(false);
    act(() => result.current.zoomOut()); // stays clamped
    expect(result.current.zoom).toBe(0.6);
  });

  it('clamps an out-of-range initial value into bounds', () => {
    const { result } = renderHook(() => useZoom(5, { min: 0.6, max: 2 }));
    expect(result.current.zoom).toBe(2);
  });

  it('resets back to the (clamped) initial value', () => {
    const { result } = renderHook(() => useZoom(1, { step: 0.1 }));
    act(() => result.current.zoomIn());
    act(() => result.current.zoomIn());
    expect(result.current.zoom).toBe(1.2);
    act(() => result.current.reset());
    expect(result.current.zoom).toBe(1);
  });

  it('keeps action callbacks stable across renders', () => {
    const { result, rerender } = renderHook(() => useZoom());
    const first = result.current.zoomIn;
    rerender();
    expect(result.current.zoomIn).toBe(first);
  });
});
