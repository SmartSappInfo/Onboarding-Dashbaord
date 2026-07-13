'use client';

import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { CanvasElement } from '@/lib/thumbnail/thumbnail-types';
import { calculateSnapping, SnapLine } from '@/lib/thumbnail/snap-helpers';
import * as LucideIcons from 'lucide-react';
import { Move, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ThumbnailCanvasProps {
  backgroundColor: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    angle?: number;
  };
  backgroundImage?: string;
  elements: CanvasElement[];
  selectedId: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, patch: Partial<CanvasElement>, commitToHistory?: boolean) => void;
  onDeleteElement: (id: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  zoomPercent: number; // 10 - 200
  panX: number;
  panY: number;
  onPanChange: (x: number, y: number) => void;
}

interface DragState {
  type: 'move' | 'resize' | 'pan';
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
  onDeleteElement,
  onUndo,
  onRedo,
  zoomPercent,
  panX,
  panY,
  onPanChange,
}: ThumbnailCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  
  // Track DOM elements for smooth direct styling during dragging
  const elementRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});

  const [containerWidth, setContainerWidth] = useState(1280);
  const [isMounted, setIsMounted] = useState(false);
  const [activeGuides, setActiveGuides] = useState<SnapLine[]>([]);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  // Monitor Spacebar state for panning
  useEffect(() => {
    setIsMounted(true);

    const handleKeyDownGlobal = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        const active = document.activeElement;
        if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.hasAttribute('contenteditable')) {
          return;
        }
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };

    const handleKeyUpGlobal = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDownGlobal);
    window.addEventListener('keyup', handleKeyUpGlobal);

    return () => {
      window.removeEventListener('keydown', handleKeyDownGlobal);
      window.removeEventListener('keyup', handleKeyUpGlobal);
    };
  }, []);

  // Monitor size of container for layout scale ratio
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const baseScale = containerWidth / 1280;
  const currentScale = baseScale * (zoomPercent / 100);

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      if (
        active?.tagName === 'INPUT' || 
        active?.tagName === 'TEXTAREA' || 
        active?.hasAttribute('contenteditable')
      ) {
        return;
      }

      // 1. Delete element
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        onDeleteElement(selectedId);
      }

      // 2. Undo / Redo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo?.();
        } else {
          onUndo?.();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo?.();
      }

      // 3. Arrow Keys Nudging
      if (selectedId && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const el = elements.find(item => item.id === selectedId);
        if (el && !el.isLocked) {
          const step = e.shiftKey ? 5 : 1; // 5% or 1%
          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowLeft') dx = -step;
          if (e.key === 'ArrowRight') dx = step;
          if (e.key === 'ArrowUp') dy = -step;
          if (e.key === 'ArrowDown') dy = step;

          onUpdateElement(selectedId, {
            x: Math.max(0, Math.min(100 - el.width, el.x + dx)),
            y: Math.max(0, Math.min(100 - el.height, el.y + dy)),
          }, true); // Commit directly to history stack
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, elements, onUndo, onRedo, onDeleteElement, onUpdateElement]);

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

  const getCORSFriendlyUrl = (url?: string): string | undefined => {
    if (!url) return undefined;
    if (
      url.includes('firebasestorage.googleapis.com') || 
      url.startsWith('data:') || 
      url.startsWith('blob:') || 
      url.startsWith('/')
    ) {
      return url;
    }
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  };

  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    element: CanvasElement | null,
    type: 'move' | 'resize' | 'pan',
    handle?: string
  ) => {
    e.stopPropagation();

    // Spacebar panning check
    if (isSpacePressed || type === 'pan') {
      const startClientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const startClientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      dragRef.current = {
        type: 'pan',
        startX: startClientX,
        startY: startClientY,
        elX: panX,
        elY: panY,
        elW: 0,
        elH: 0
      };

      const handlePanMove = (moveEv: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = moveEv.clientX - dragRef.current.startX;
        const dy = moveEv.clientY - dragRef.current.startY;
        onPanChange(dragRef.current.elX + dx, dragRef.current.elY + dy);
      };

      const handlePanTouchMove = (moveEv: TouchEvent) => {
        if (moveEv.cancelable) moveEv.preventDefault();
        if (!dragRef.current || moveEv.touches.length === 0) return;
        const dx = moveEv.touches[0].clientX - dragRef.current.startX;
        const dy = moveEv.touches[0].clientY - dragRef.current.startY;
        onPanChange(dragRef.current.elX + dx, dragRef.current.elY + dy);
      };

      const handlePanUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', handlePanMove);
        window.removeEventListener('mouseup', handlePanUp);
        window.removeEventListener('touchmove', handlePanTouchMove);
        window.removeEventListener('touchend', handlePanUp);
      };

      window.addEventListener('mousemove', handlePanMove);
      window.addEventListener('mouseup', handlePanUp);
      window.addEventListener('touchmove', handlePanTouchMove, { passive: false });
      window.addEventListener('touchend', handlePanUp);
      return;
    }

    if (!element || element.isLocked) return;
    onSelectElement(element.id);

    if (!canvasRef.current) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragRef.current = {
      type,
      handle,
      startX: clientX,
      startY: clientY,
      elX: element.x,
      elY: element.y,
      elW: element.width,
      elH: element.height,
    };

    let latestX = element.x;
    let latestY = element.y;
    let latestW = element.width;
    let latestH = element.height;

    const handlePointerMove = (evX: number, evY: number) => {
      if (!dragRef.current) return;
      
      const deltaX = (evX - dragRef.current.startX) / currentScale;
      const deltaY = (evY - dragRef.current.startY) / currentScale;
      
      const dx = (deltaX / 1280) * 100;
      const dy = (deltaY / 720) * 100;

      const node = elementRefs.current[element.id];

      if (dragRef.current.type === 'move') {
        const rawX = dragRef.current.elX + dx;
        const rawY = dragRef.current.elY + dy;

        // Perform alignment snapping
        const tempElement: CanvasElement = { ...element, x: rawX, y: rawY };
        const snap = calculateSnapping(tempElement, elements);

        latestX = snap.x;
        latestY = snap.y;
        setActiveGuides(snap.guides);
        
        if (node) {
          node.style.left = `${latestX}%`;
          node.style.top = `${latestY}%`;
        }
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

        const tempElement: CanvasElement = { 
          ...element, 
          x: newX, 
          y: newY, 
          width: newW, 
          height: newH 
        };
        const snap = calculateSnapping(tempElement, elements);

        latestX = snap.x;
        latestY = snap.y;
        latestW = snap.x === newX ? newW : newW + (newX - snap.x);
        latestH = snap.y === newY ? newH : newH + (newY - snap.y);

        setActiveGuides(snap.guides);

        if (node) {
          node.style.left = `${latestX}%`;
          node.style.top = `${latestY}%`;
          node.style.width = `${latestW}%`;
          node.style.height = `${latestH}%`;
        }
      }
    };

    const handleMouseMove = (ev: MouseEvent) => {
      handlePointerMove(ev.clientX, ev.clientY);
    };

    const handleTouchMove = (ev: TouchEvent) => {
      if (ev.cancelable) ev.preventDefault();
      if (ev.touches.length > 0) {
        handlePointerMove(ev.touches[0].clientX, ev.touches[0].clientY);
      }
    };

    const handlePointerUp = () => {
      dragRef.current = null;
      setActiveGuides([]);
      
      onUpdateElement(element.id, {
        x: latestX,
        y: latestY,
        width: latestW,
        height: latestH,
      }, true); // Commit history step on release

      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  const getShadowCss = (shadow?: { color: string; blur: number; offsetX: number; offsetY: number }): string | undefined => {
    if (!shadow) return undefined;
    return `${shadow.offsetX}px ${shadow.offsetY}px ${shadow.blur}px ${shadow.color}`;
  };

  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => {
        if (isSpacePressed) handleStartDrag(e, null, 'pan');
      }}
      onTouchStart={(e) => {
        if (isSpacePressed) handleStartDrag(e, null, 'pan');
      }}
      className={cn(
        "w-full relative bg-slate-900 border border-slate-800 rounded-2xl p-2 select-none overflow-hidden aspect-video flex items-center justify-center",
        isSpacePressed ? "cursor-grab active:cursor-grabbing" : "cursor-default"
      )}
    >
      <div
        ref={canvasRef}
        id="thumbnail-canvas-container"
        className="relative overflow-hidden shrink-0 shadow-2xl transition-all duration-75"
        style={{
          width: '1280px',
          height: '720px',
          ...getBackgroundStyle(),
          transform: isMounted 
            ? `translate(${panX}px, ${panY}px) scale(${currentScale})` 
            : 'scale(1)',
          transformOrigin: 'center center',
        }}
        onClick={() => onSelectElement(null)}
      >
        {/* Grids and Guides */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800d_1px,transparent_1px),linear-gradient(to_bottom,#8080800d_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        {/* Dynamic Snap Guides Overlay */}
        {activeGuides.map((guide, idx) => (
          <div
            key={idx}
            className="absolute border-emerald-500 border-dashed pointer-events-none z-[999]"
            style={{
              left: guide.type === 'vertical' ? `${guide.coordinate}%` : '0',
              top: guide.type === 'horizontal' ? `${guide.coordinate}%` : '0',
              width: guide.type === 'vertical' ? '1px' : '100%',
              height: guide.type === 'horizontal' ? '1px' : '100%',
            }}
          />
        ))}

        {sortedElements.map((el) => {
          if (el.isHidden) return null;

          const isSelected = selectedId === el.id;
          const shadowStyle = getShadowCss(el.textShadow || el.imageShadow);

          // Get dynamically resolved Lucide icons
          const IconComponent = el.type === 'icon' && el.iconName 
            ? (LucideIcons as any)[el.iconName] || LucideIcons.HelpCircle 
            : null;

          return (
            <div
              key={el.id}
              ref={(node) => {
                elementRefs.current[el.id] = node;
              }}
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
                  isSelected && !el.isLocked && "ring-4 ring-emerald-500 ring-offset-4 ring-offset-slate-950",
                  isSelected && el.isLocked && "ring-4 ring-red-500 ring-offset-4 ring-offset-slate-950"
                )}
                onMouseDown={(e) => handleStartDrag(e, el, 'move')}
                onTouchStart={(e) => handleStartDrag(e, el, 'move')}
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
                      paintOrder: 'stroke fill',
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
                    className={cn(
                      "w-full h-full relative overflow-hidden",
                      el.maskShape === 'circle' && "rounded-full",
                      el.maskShape === 'hexagon' && "clip-path-hex" // HEX clip path in index.css
                    )}
                    style={{
                      boxShadow: shadowStyle,
                      border: el.imageOutlineWidth ? `${el.imageOutlineWidth}px solid ${el.imageOutlineColor || '#ffffff'}` : undefined,
                      borderRadius: (!el.maskShape || el.maskShape === 'none') ? `${el.borderRadius || 12}px` : undefined,
                    }}
                  >
                    {el.imageSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getCORSFriendlyUrl(el.imageSrc)}
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

                {/* 6. Icon Element */}
                {el.type === 'icon' && IconComponent && (
                  <div className="w-full h-full flex items-center justify-center" style={{ filter: shadowStyle ? `drop-shadow(${shadowStyle})` : undefined }}>
                    <IconComponent className="w-full h-full" style={{ color: el.shapeFill || '#ffffff' }} />
                  </div>
                )}

                {/* 7. Emoji Element */}
                {el.type === 'emoji' && (
                  <div className="w-full h-full flex items-center justify-center select-none text-[64px]" style={{ textShadow: shadowStyle }}>
                    {el.text || '😀'}
                  </div>
                )}

                {/* Selected resize corners */}
                {isSelected && !el.isLocked && (
                  <>
                    {/* Enlarged touch target templates */}
                    {['nw', 'ne', 'sw', 'se'].map((h) => (
                      <div
                        key={h}
                        className="absolute w-8 h-8 z-45 cursor-pointer pointer-events-auto flex items-center justify-center"
                        style={{
                          top: h.includes('n') ? '-16px' : 'calc(100% - 16px)',
                          left: h.includes('w') ? '-16px' : 'calc(100% - 16px)',
                        }}
                        onMouseDown={(e) => handleStartDrag(e, el, 'resize', h)}
                        onTouchStart={(e) => handleStartDrag(e, el, 'resize', h)}
                      >
                        <div className="w-3 h-3 bg-white border-2 border-emerald-500 rounded-full shadow-md" />
                      </div>
                    ))}
                    <div
                      className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-700 rounded-full p-2 shadow-lg z-45 cursor-move pointer-events-auto hover:bg-slate-800"
                      onMouseDown={(e) => handleStartDrag(e, el, 'move')}
                      onTouchStart={(e) => handleStartDrag(e, el, 'move')}
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
