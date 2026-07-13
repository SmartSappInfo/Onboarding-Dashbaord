'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { CanvasElement } from '@/lib/thumbnail/thumbnail-types';
import { ArrowRight, Move } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThumbnailCanvasProps {
  backgroundColor: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    angle?: number;
    colors: string[];
  };
  backgroundImage?: string;
  elements: CanvasElement[];
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, patch: Partial<CanvasElement>) => void;
}

interface DragState {
  type: 'move' | 'resize';
  handle?: string;
  startX: number;
  startY: number;
  elX: number;
  elY: number;
  elW: number;
  elH: number;
}

export default function ThumbnailCanvas({
  backgroundColor,
  backgroundGradient,
  backgroundImage,
  elements,
  selectedId,
  onSelectElement,
  onUpdateElement,
}: ThumbnailCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [containerWidth, setContainerWidth] = useState(1280);
  const [isMounted, setIsMounted] = useState(false);

  // Monitor size of container for mobile scaling
  useEffect(() => {
    setIsMounted(true);
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const scale = containerWidth / 1280;

  const getBackgroundStyle = (): React.CSSProperties => {
    if (backgroundImage) {
      return { 
        backgroundImage: `url(${backgroundImage})`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center' 
      };
    }
    if (backgroundGradient && backgroundGradient.colors.length > 0) {
      const colorsStr = backgroundGradient.colors.join(', ');
      if (backgroundGradient.type === 'radial') {
        return { background: `radial-gradient(circle, ${colorsStr})` };
      }
      const angle = backgroundGradient.angle !== undefined ? `${backgroundGradient.angle}deg` : '135deg';
      return { background: `linear-gradient(${angle}, ${colorsStr})` };
    }
    return { backgroundColor };
  };

  const handleStartDrag = (e: React.MouseEvent, element: CanvasElement, type: 'move' | 'resize', handle?: string) => {
    e.stopPropagation();
    onSelectElement(element.id);

    if (!canvasRef.current) return;
    
    // Coordinates are out of 1280x720 absolute scale on the target canvas
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
      
      // Calculate delta in raw pixels and scale by viewport coefficient
      const deltaX = (ev.clientX - dragRef.current.startX) / scale;
      const deltaY = (ev.clientY - dragRef.current.startY) / scale;
      
      // Convert deltas to percentage values of 1280x720 canvas
      const dx = (deltaX / 1280) * 100;
      const dy = (deltaY / 720) * 100;

      if (dragRef.current.type === 'move') {
        onUpdateElement(element.id, {
          x: Math.max(0, Math.min(100 - dragRef.current.elW, dragRef.current.elX + dx)),
          y: Math.max(0, Math.min(100 - dragRef.current.elH, dragRef.current.elY + dy)),
        });
      } else if (dragRef.current.type === 'resize' && dragRef.current.handle) {
        let newX = dragRef.current.elX;
        let newY = dragRef.current.elY;
        let newW = dragRef.current.elW;
        let newH = dragRef.current.elH;

        const h = dragRef.current.handle;

        if (h.includes('e')) newW = Math.max(2, dragRef.current.elW + dx);
        if (h.includes('s')) newH = Math.max(2, dragRef.current.elH + dy);
        if (h.includes('w')) {
          const possibleW = dragRef.current.elW - dx;
          if (possibleW > 2) {
            newW = possibleW;
            newX = dragRef.current.elX + dx;
          }
        }
        if (h.includes('n')) {
          const possibleH = dragRef.current.elH - dy;
          if (possibleH > 2) {
            newH = possibleH;
            newY = dragRef.current.elY + dy;
          }
        }

        onUpdateElement(element.id, {
          x: Math.max(0, Math.min(100, newX)),
          y: Math.max(0, Math.min(100, newY)),
          width: Math.max(2, Math.min(100, newW)),
          height: Math.max(2, Math.min(100, newH)),
        });
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

  const getShadowCss = (shadow?: { color: string; blur: number; offsetX: number; offsetY: number }): string | undefined => {
    if (!shadow) return undefined;
    return `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`;
  };

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      className="w-full relative bg-slate-900 border border-slate-800 rounded-2xl p-2 select-none overflow-hidden aspect-video flex items-start justify-start"
    >
      <div
        ref={canvasRef}
        id="thumbnail-canvas-container"
        className="relative overflow-hidden shrink-0"
        style={{
          width: '1280px',
          height: '720px',
          ...getBackgroundStyle(),
          transform: isMounted ? `scale(${scale})` : 'scale(1)',
          transformOrigin: 'top left',
          transition: 'transform 0.1s ease-out',
        }}
        onClick={() => onSelectElement(null)}
      >
        {/* Alignment Assist Grids */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800d_1px,transparent_1px),linear-gradient(to_bottom,#8080800d_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {sortedElements.map((el) => {
          const isSelected = selectedId === el.id;
          const shadowStyle = getShadowCss(el.textShadow || el.imageShadow);

          return (
            <div
              key={el.id}
              style={{
                position: 'absolute',
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                zIndex: el.zIndex,
                transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                opacity: el.opacity !== undefined ? el.opacity : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                onSelectElement(el.id);
              }}
            >
              <div
                className={cn(
                  "w-full h-full relative group transition-shadow",
                  isSelected && "ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-950"
                )}
                onMouseDown={(e) => handleStartDrag(e, el, 'move')}
              >
                {/* 1. Text Element */}
                {el.type === 'text' && (
                  <div
                    className="w-full h-full flex items-center justify-center p-2 leading-tight"
                    style={{
                      fontFamily: el.fontFamily || 'Inter',
                      fontSize: el.fontSize ? `${el.fontSize}px` : '32px',
                      fontWeight: el.fontWeight || 'bold',
                      fontStyle: el.fontStyle || 'normal',
                      color: el.fill || '#ffffff',
                      textAlign: el.textAlign || 'center',
                      WebkitTextStroke: el.textStrokeWidth ? `${el.textStrokeWidth}px ${el.textStrokeColor || '#000000'}` : undefined,
                      textShadow: shadowStyle,
                      backgroundColor: el.badgeColor || undefined,
                      opacity: el.badgeOpacity !== undefined ? el.badgeOpacity : 1,
                      borderRadius: el.badgeColor ? '8px' : undefined,
                    }}
                  >
                    <span className="break-words w-full select-none">{el.text || 'Text Layer'}</span>
                  </div>
                )}

                {/* 2. Image Element */}
                {el.type === 'image' && (
                  <div
                    className="w-full h-full relative overflow-hidden"
                    style={{
                      boxShadow: shadowStyle,
                      border: el.imageOutlineWidth ? `${el.imageOutlineWidth}px solid ${el.imageOutlineColor || '#ffffff'}` : undefined,
                      borderRadius: el.borderRadius ? `${el.borderRadius}px` : '12px',
                    }}
                  >
                    {el.imageSrc ? (
                      /* Use standard img with crossOrigin for html-to-image serialization integrity */
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={el.imageSrc}
                        alt="Canvas layer subject"
                        className="w-full h-full object-cover"
                        crossOrigin="anonymous"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 font-bold text-xs">
                        Subject Placeholder
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Rect Element */}
                {el.type === 'rect' && (
                  <div
                    className="w-full h-full"
                    style={{
                      backgroundColor: el.shapeFill || '#e2e8f0',
                      border: el.shapeStrokeWidth ? `${el.shapeStrokeWidth}px solid ${el.shapeStroke || '#000000'}` : undefined,
                      borderRadius: el.borderRadius ? `${el.borderRadius}px` : '0px',
                    }}
                  />
                )}

                {/* 4. Circle Element */}
                {el.type === 'circle' && (
                  <div
                    className="w-full h-full rounded-full"
                    style={{
                      backgroundColor: el.shapeFill || '#e2e8f0',
                      border: el.shapeStrokeWidth ? `${el.shapeStrokeWidth}px solid ${el.shapeStroke || '#000000'}` : undefined,
                    }}
                  />
                )}

                {/* 5. Arrow Element */}
                {el.type === 'arrow' && (
                  <div className="w-full h-full flex items-center justify-center">
                    <div
                      className="flex items-center justify-center"
                      style={{
                        color: el.shapeFill || '#facc15',
                        filter: shadowStyle ? `drop-shadow(${shadowStyle})` : 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
                      }}
                    >
                      <ArrowRight className="w-16 h-16 stroke-[4]" />
                    </div>
                  </div>
                )}

                {/* Selected outline handles */}
                {isSelected && (
                  <>
                    {['nw', 'ne', 'sw', 'se'].map((h) => (
                      <div
                        key={h}
                        className="absolute w-5 h-5 bg-white border-2 border-emerald-500 rounded-full z-45 cursor-pointer pointer-events-auto shadow-md"
                        style={{
                          top: h.includes('n') ? '-10px' : 'calc(100% - 10px)',
                          left: h.includes('w') ? '-10px' : 'calc(100% - 10px)',
                        }}
                        onMouseDown={(e) => handleStartDrag(e, el, 'resize', h)}
                      />
                    ))}
                    <div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-full p-2 shadow-lg z-45 cursor-move pointer-events-auto hover:bg-slate-800"
                      onMouseDown={(e) => handleStartDrag(e, el, 'move')}
                    >
                      <Move className="w-4 h-4 text-emerald-500" />
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
