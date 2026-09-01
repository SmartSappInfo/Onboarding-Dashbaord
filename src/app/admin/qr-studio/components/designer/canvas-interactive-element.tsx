'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import type { CanvasElement } from './canvas-types';

interface Props {
  element: CanvasElement;
  isSelected: boolean;
  scaleFactor: number;
  onSelect: (e: React.MouseEvent) => void;
  onUpdate: (patch: Partial<CanvasElement>) => void;
  onSnapGuide?: (guides: { x?: number; y?: number } | null) => void;
  children: React.ReactNode;
}

export default function CanvasInteractiveElement({
  element,
  isSelected,
  scaleFactor,
  onSelect,
  onUpdate,
  onSnapGuide,
  children,
}: Props) {
  const dragRef = React.useRef<{
    type: 'move' | 'resize';
    handle?: string;
    startX: number;
    startY: number;
    elX: number;
    elY: number;
    elW: number;
    elH: number;
  } | null>(null);

  const startDrag = (e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
    if (element.isLocked) return;
    e.stopPropagation();
    onSelect(e);

    const container = (e.target as HTMLElement).closest('.canvas-container');
    if (!container) return;

    const rect = container.getBoundingClientRect();

    dragRef.current = {
      type,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      elX: element.x,
      elY: element.y,
      elW: element.width,
      elH: element.height,
    };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ((ev.clientX - dragRef.current.startX) / rect.width) * 100;
      const dy = ((ev.clientY - dragRef.current.startY) / rect.height) * 100;

      if (dragRef.current.type === 'move') {
        let newX = dragRef.current.elX + dx;
        let newY = dragRef.current.elY + dy;

        // Snapping thresholds (1.5% magnetic snap)
        const snapThreshold = 1.5;
        const centerX = newX + dragRef.current.elW / 2;
        const centerY = newY + dragRef.current.elH / 2;
        const guides: { x?: number; y?: number } = {};

        // Snap Center X to 50%
        if (Math.abs(centerX - 50) < snapThreshold) {
          newX = 50 - dragRef.current.elW / 2;
          guides.x = 50;
        }
        // Snap Left to 10% (safe margin)
        else if (Math.abs(newX - 10) < snapThreshold) {
          newX = 10;
          guides.x = 10;
        }

        // Snap Center Y to 50%
        if (Math.abs(centerY - 50) < snapThreshold) {
          newY = 50 - dragRef.current.elH / 2;
          guides.y = 50;
        }

        onSnapGuide?.(Object.keys(guides).length > 0 ? guides : null);
        onUpdate({ x: newX, y: newY });
      } else if (dragRef.current.type === 'resize' && dragRef.current.handle) {
        let newX = dragRef.current.elX;
        let newY = dragRef.current.elY;
        let newW = dragRef.current.elW;
        let newH = dragRef.current.elH;

        const h = dragRef.current.handle;

        if (h.includes('e')) newW = Math.max(2, dragRef.current.elW + dx);
        if (h.includes('s')) newH = Math.max(1, dragRef.current.elH + dy);
        if (h.includes('w')) {
          newW = Math.max(2, dragRef.current.elW - dx);
          if (newW > 2) newX = dragRef.current.elX + dx;
        }
        if (h.includes('n')) {
          newH = Math.max(1, dragRef.current.elH - dy);
          if (newH > 1) newY = dragRef.current.elY + dy;
        }

        onUpdate({ x: newX, y: newY, width: newW, height: newH });
      }
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      onSnapGuide?.(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handles = ['nw', 'ne', 'sw', 'se', 'n', 's', 'e', 'w'];

  return (
    <div
      style={{
        position: 'absolute',
        left: `${element.x}%`,
        top: `${element.y}%`,
        width: `${element.width}%`,
        height: `${element.height}%`,
        zIndex: element.isQR ? 10 : element.type === 'rect' || element.type === 'circle' ? 1 : 5,
      }}
    >
      {/* The actual element content */}
      <div
        className="w-full h-full"
        onMouseDown={(e) => startDrag(e, 'move')}
        onClick={(e) => e.stopPropagation()}
        style={{
          cursor: element.isLocked ? 'not-allowed' : isSelected ? 'move' : 'pointer',
          transform: `rotate(${element.rotation || 0}deg)`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>

      {/* Lock Indicator Badge */}
      {element.isLocked && isSelected && (
        <div className="absolute top-1 right-1 p-1 rounded bg-zinc-900/80 text-white shadow pointer-events-none">
          <Lock className="h-3 w-3" />
        </div>
      )}

      {/* Selection outline and resize handles */}
      {isSelected && !element.isLocked && (
        <div className="absolute inset-0 border-2 border-primary pointer-events-none shadow-[0_0_8px_rgba(37,99,235,0.3)]">
          {handles.map((h) => (
            <div
              key={h}
              className="absolute bg-white border-2 border-primary shadow-sm pointer-events-auto rounded-full transition-transform hover:scale-125"
              style={{
                width: `${Math.max(8, 9 / scaleFactor)}px`,
                height: `${Math.max(8, 9 / scaleFactor)}px`,
                top: h.includes('n') ? '-5px' : h.includes('s') ? 'calc(100% - 4px)' : 'calc(50% - 4px)',
                left: h.includes('w') ? '-5px' : h.includes('e') ? 'calc(100% - 4px)' : 'calc(50% - 4px)',
                cursor: `${h}-resize`,
              }}
              onMouseDown={(e) => startDrag(e, 'resize', h)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
