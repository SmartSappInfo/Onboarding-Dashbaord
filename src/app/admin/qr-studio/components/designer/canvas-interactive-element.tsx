'use client';

import * as React from 'react';
import type { CanvasElement } from './canvas-types';

interface Props {
  element: CanvasElement;
  isSelected: boolean;
  scaleFactor: number;
  onSelect: (e: React.MouseEvent) => void;
  onUpdate: (patch: Partial<CanvasElement>) => void;
  children: React.ReactNode;
}

export default function CanvasInteractiveElement({ element, isSelected, scaleFactor, onSelect, onUpdate, children }: Props) {
  const dragRef = React.useRef<{ type: 'move' | 'resize'; handle?: string; startX: number; startY: number; elX: number; elY: number; elW: number; elH: number } | null>(null);

  const startDrag = (e: React.MouseEvent, type: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    onSelect(e);
    
    // We need the parent container to calculate relative percentages
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
        onUpdate({
          x: Math.max(0, Math.min(100 - dragRef.current.elW, dragRef.current.elX + dx)),
          y: Math.max(0, Math.min(100 - dragRef.current.elH, dragRef.current.elY + dy)),
        });
      } else if (dragRef.current.type === 'resize' && dragRef.current.handle) {
        let newX = dragRef.current.elX;
        let newY = dragRef.current.elY;
        let newW = dragRef.current.elW;
        let newH = dragRef.current.elH;

        const h = dragRef.current.handle;
        
        if (h.includes('e')) newW = Math.max(1, dragRef.current.elW + dx);
        if (h.includes('s')) newH = Math.max(1, dragRef.current.elH + dy);
        if (h.includes('w')) {
          newW = Math.max(1, dragRef.current.elW - dx);
          if (newW > 1) newX = dragRef.current.elX + dx;
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
      {/* The actual element content, scaled to fit the bounding box exactly */}
      <div 
        className="w-full h-full"
        onMouseDown={e => startDrag(e, 'move')}
        onClick={e => e.stopPropagation()}
        style={{ cursor: isSelected ? 'move' : 'pointer' }}
      >
        {children}
      </div>

      {/* Selection outline and resize handles */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-primary pointer-events-none">
          {handles.map(h => (
            <div
              key={h}
              className="absolute bg-white border border-primary pointer-events-auto"
              style={{
                width: '8px', height: '8px', borderRadius: '50%',
                top: h.includes('n') ? '-4px' : h.includes('s') ? 'calc(100% - 4px)' : 'calc(50% - 4px)',
                left: h.includes('w') ? '-4px' : h.includes('e') ? 'calc(100% - 4px)' : 'calc(50% - 4px)',
                cursor: `${h}-resize`,
              }}
              onMouseDown={e => startDrag(e, 'resize', h)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
