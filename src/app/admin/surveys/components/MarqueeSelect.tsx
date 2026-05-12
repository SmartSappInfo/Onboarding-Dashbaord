'use client';

import * as React from 'react';

interface MarqueeState {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
}

interface MarqueeSelectProps {
  children: React.ReactNode;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSelectionChange: (selectedIds: string[], isAccumulating: boolean) => void;
  itemSelector: string;
}

export function MarqueeSelect({ children, containerRef, onSelectionChange, itemSelector }: MarqueeSelectProps) {
  const [marquee, setMarquee] = React.useState<MarqueeState | null>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const startPos = React.useRef<{ x: number, y: number } | null>(null);

  const marqueeRef = React.useRef<MarqueeState | null>(null);
  
  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button') || 
        target.closest('input') || 
        target.closest('textarea') || 
        target.closest('[contenteditable]') ||
        target.closest('[role="button"]') ||
        target.closest('[data-marquee-ignore="true"]') ||
        target.closest('a')) return;

    const r = wrapperRef.current?.getBoundingClientRect();
    if (!r) return;

    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    
    startPos.current = { x, y };
    const initialState = { startX: x, startY: y, endX: x, endY: y };
    marqueeRef.current = initialState;
    setMarquee(initialState);

    const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!r) return;
        const updatedState = { 
            startX: startPos.current!.x, 
            startY: startPos.current!.y, 
            endX: moveEvent.clientX - r.left, 
            endY: moveEvent.clientY - r.top 
        };
        marqueeRef.current = updatedState;
        setMarquee(updatedState);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        
        if (marqueeRef.current) {
            const finalMarquee = {
                ...marqueeRef.current,
                endX: upEvent.clientX - r.left,
                endY: upEvent.clientY - r.top
            };
            
            // Convert relative marquee to absolute for selection logic if needed, 
            // or update selection logic to use relative coords.
            // Selection logic probably uses getBoundingClientRect of items, 
            // so we should use absolute viewport coords for selection but relative for rendering.
            
            performSelection(finalMarquee, upEvent.shiftKey || upEvent.metaKey || upEvent.ctrlKey);
        }
        
        setMarquee(null);
        marqueeRef.current = null;
        startPos.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  const performSelection = (m: MarqueeState, isAccumulating: boolean) => {
    const r = wrapperRef.current?.getBoundingClientRect();
    if (!r) return;

    // Convert relative to absolute for selection
    const absStart = { x: m.startX + r.left, y: m.startY + r.top };
    const absEnd = { x: m.endX + r.left, y: m.endY + r.top };

    const x1 = Math.min(absStart.x, absEnd.x);
    const x2 = Math.max(absStart.x, absEnd.x);
    const y1 = Math.min(absStart.y, absEnd.y);
    const y2 = Math.max(absStart.y, absEnd.y);

    const items = document.querySelectorAll(itemSelector);
    const selectedIds: string[] = [];

    items.forEach((item: Element) => {
      const rect = item.getBoundingClientRect();
      const id = item.getAttribute('data-block-id');
      
      if (id && 
          rect.left < x2 && 
          rect.right > x1 && 
          rect.top < y2 && 
          rect.bottom > y1) {
        selectedIds.push(id);
      }
    });

    onSelectionChange(selectedIds, isAccumulating);
  };

  // Map relative coordinates for rendering the visual box
  const getRenderStyle = () => {
    if (!marquee) return {};
    
    const left = Math.min(marquee.startX, marquee.endX);
    const top = Math.min(marquee.startY, marquee.endY);
    const width = Math.abs(marquee.endX - marquee.startX);
    const height = Math.abs(marquee.endY - marquee.startY);

    return { left, top, width, height };
  };

  return (
    <div 
      ref={wrapperRef}
      className="relative min-h-full w-full"
      onMouseDown={onMouseDown}
    >
      {children}
      {marquee && (
        <div 
          className="absolute border-2 border-primary bg-primary/5 pointer-events-none z-50 rounded-xl shadow-2xl backdrop-blur-[2px]"
          style={getRenderStyle()}
        />
      )}
    </div>
  );
}
