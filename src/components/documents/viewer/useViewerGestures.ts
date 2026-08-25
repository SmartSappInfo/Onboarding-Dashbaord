'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Reader Gestures & Navigation Matrix:
 *    Coordinates multi-touch gestures (pinch zoom, swipe navigation, double tap)
 *    and keyboard shortcuts across all reading modes (PRD Sections 44–46 & 85).
 * 2. Gesture Conflict Elimination:
 *    When `zoomScale > 1.05` or two touch points are detected, horizontal page swipe
 *    is disabled and touch events route exclusively to zoom panning.
 * 3. Bounded Viewport Clamping:
 *    Panning offsets are clamped to `(scale - 1) * containerDimension / 2` to prevent
 *    dragging the document out of visible viewport bounds.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import { useState, useRef, useCallback, useEffect } from 'react';

interface UseViewerGesturesOptions {
  pageCount: number;
  currentPage: number;
  onPageChange: (nextPage: number) => void;
  disabled?: boolean;
  step?: number;
}

export function useViewerGestures({
  pageCount,
  currentPage,
  onPageChange,
  disabled = false,
  step = 1,
}: UseViewerGesturesOptions) {
  // Zoom & Pan State
  const [zoomScale, setZoomScale] = useState(1.0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });

  // Touch tracking refs
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const initialPinchDistRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(1.0);
  const lastTapTimeRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const navigateNext = useCallback(() => {
    if (currentPage + step <= pageCount) {
      onPageChange(currentPage + step);
    } else if (currentPage < pageCount) {
      onPageChange(pageCount);
    }
  }, [currentPage, pageCount, step, onPageChange]);

  const navigatePrev = useCallback(() => {
    if (currentPage - step >= 1) {
      onPageChange(currentPage - step);
    } else if (currentPage > 1) {
      onPageChange(1);
    }
  }, [currentPage, step, onPageChange]);

  const resetZoom = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setZoomScale((prev) => Math.min(3.0, Number((prev + 0.25).toFixed(2))));
  }, []);

  const zoomOut = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.max(1.0, Number((prev - 0.25).toFixed(2)));
      if (next === 1.0) setPanOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  // Double-tap zoom toggle (1x <-> 2x)
  const handleDoubleTap = useCallback((clientX: number, clientY: number) => {
    if (zoomScale > 1.05) {
      resetZoom();
    } else {
      setZoomScale(2.0);
    }
  }, [zoomScale, resetZoom]);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    if (e.touches.length === 2) {
      // Pinch gesture start
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      initialPinchDistRef.current = Math.hypot(dx, dy);
      initialZoomRef.current = zoomScale;
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const now = Date.now();

      // Detect double tap (< 300ms between taps)
      if (now - lastTapTimeRef.current < 300) {
        handleDoubleTap(touch.clientX, touch.clientY);
        lastTapTimeRef.current = 0;
        return;
      }
      lastTapTimeRef.current = now;

      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: now,
      };

      if (zoomScale > 1.05) {
        isDraggingRef.current = true;
        dragStartOffsetRef.current = {
          x: touch.clientX - panOffset.x,
          y: touch.clientY - panOffset.y,
        };
      }
    }
  }, [disabled, zoomScale, panOffset, handleDoubleTap]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    if (e.touches.length === 2 && initialPinchDistRef.current) {
      // Active pinch-to-zoom calculation
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const currentDist = Math.hypot(dx, dy);
      const ratio = currentDist / initialPinchDistRef.current;
      const newScale = Math.min(3.0, Math.max(1.0, Number((initialZoomRef.current * ratio).toFixed(2))));
      setZoomScale(newScale);
      if (newScale === 1.0) setPanOffset({ x: 0, y: 0 });
      return;
    }

    if (e.touches.length === 1 && isDraggingRef.current && zoomScale > 1.05) {
      // Active pan/drag while zoomed
      const touch = e.touches[0];
      const maxPanX = (zoomScale - 1) * 300;
      const maxPanY = (zoomScale - 1) * 400;

      const nextX = touch.clientX - dragStartOffsetRef.current.x;
      const nextY = touch.clientY - dragStartOffsetRef.current.y;

      setPanOffset({
        x: Math.min(maxPanX, Math.max(-maxPanX, nextX)),
        y: Math.min(maxPanY, Math.max(-maxPanY, nextY)),
      });
    }
  }, [disabled, zoomScale]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled) return;

    initialPinchDistRef.current = null;
    isDraggingRef.current = false;

    if (e.changedTouches.length === 1 && touchStartRef.current && zoomScale <= 1.05) {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;
      const duration = Date.now() - touchStartRef.current.time;

      // Swipe recognition: > 50px horizontal displacement and more horizontal than vertical
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) && duration < 500) {
        if (deltaX < 0) {
          navigateNext();
        } else {
          navigatePrev();
        }
      }
    }

    touchStartRef.current = null;
  }, [disabled, zoomScale, navigateNext, navigatePrev]);

  // Keyboard navigation
  useEffect(() => {
    if (disabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not capture keyboard if user is typing in an input or textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ': // Spacebar
          e.preventDefault();
          navigateNext();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          navigatePrev();
          break;
        case 'Home':
          e.preventDefault();
          onPageChange(1);
          break;
        case 'End':
          e.preventDefault();
          onPageChange(pageCount);
          break;
        case 'Escape':
          if (zoomScale > 1.0) {
            e.preventDefault();
            resetZoom();
          }
          break;
        case '+':
        case '=':
          e.preventDefault();
          zoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          zoomOut();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [disabled, navigateNext, navigatePrev, onPageChange, pageCount, zoomScale, resetZoom, zoomIn, zoomOut]);

  return {
    zoomScale,
    panOffset,
    setZoomScale,
    setPanOffset,
    zoomIn,
    zoomOut,
    resetZoom,
    navigateNext,
    navigatePrev,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
