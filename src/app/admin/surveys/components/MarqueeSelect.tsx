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
  containerRef: React.RefObject<HTMLDivElement>;
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

    const container = containerRef.current;
    if (!container) return;

    const x = e.clientX;
    const y = e.clientY;
    
    startPos.current = { x, y };
    const initialState = { startX: x, startY: y, endX: x, endY: y };
    marqueeRef.current = initialState;
    setMarquee(initialState);

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const updatedState = { 
            startX: startPos.current!.x, 
            startY: startPos.current!.y, 
            endX: moveEvent.clientX, 
            endY: moveEvent.clientY 
        };
        marqueeRef.current = updatedState;
        setMarquee(updatedState);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        
        const finalMarquee = marqueeRef.current;
        if (finalMarquee) {
            const mL = Math.min(finalMarquee.startX, finalMarquee.endX);
            const mT = Math.min(finalMarquee.startY, finalMarquee.endY);
            const mR = Math.max(finalMarquee.startX, finalMarquee.endX);
            const mB = Math.max(finalMarquee.startY, finalMarquee.endY);

            // Small drag threshold
            if (Math.abs(finalMarquee.endX - finalMarquee.startX) > 5 || Math.abs(finalMarquee.endY - finalMarquee.startY) > 5) {
                const selectedIds: string[] = [];
                container.querySelectorAll(itemSelector).forEach(el => {
                    const id = el.getAttribute('data-block-id');
                    if (!id) return;
                    const rect = el.getBoundingClientRect();
                    if (!(rect.left > mR || rect.right < mL || rect.top > mB || rect.bottom < mT)) {
                        selectedIds.push(id);
                    }
                });
                onSelectionChange(selectedIds, upEvent.shiftKey || upEvent.metaKey || upEvent.ctrlKey);
            }
        }

        setMarquee(null);
        marqueeRef.current = null;
        startPos.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  // Map viewport coordinates to wrapper-relative coordinates for rendering the visual box
  const getRenderStyle = () => {
    if (!marquee || !wrapperRef.current) return {};
    const r = wrapperRef.current.getBoundingClientRect();
    
    // Calculate position relative to the wrapper's current viewport position
    const left = Math.min(marquee.startX, marquee.endX) - r.left;
    const top = Math.min(marquee.startY, marquee.endY) - r.top;
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
