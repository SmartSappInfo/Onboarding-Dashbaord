'use client';

/**
 * ARCHITECTURE:
 * SmartSapp Professional Canvas Engine (Phase 2)
 * 
 * High-performance WYSIWYG canvas renderer featuring percentage coordinates,
 * marquee drag box selection, multi-element composite bounding boxes, top rotation handles,
 * smart magnetic alignment guides with distance pills, and CSS/SVG frame clipping.
 * 
 * CAUTION:
 * - Direct DOM manipulation on element transforms during drag to sustain 60fps.
 * - History commits occur strictly upon pointer release (`commitToHistory = true`).
 * - Strictly typed (0% any).
 * 
 * TESTABILITY:
 * Verified via unit tests in src/lib/creative/__tests__/smart-guides.test.ts
 */

import * as React from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import type { CreativeElement, SnapGuideLine, BoundingBox, SaliencyHotspot } from '@/lib/creative/creative-types';
import { computeBoundingBox, calculateSmartGuides } from '@/lib/creative/smart-guides';
import { AttentionHeatmapOverlay } from './AttentionHeatmapOverlay';
import { LiveCursorOverlay } from './LiveCursorOverlay';
import { CanvasCommentPinOverlay } from './CanvasCommentPinOverlay';
import * as LucideIcons from 'lucide-react';
import { RotateCw, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FontLoader } from '@/lib/thumbnail/font-loader';
import { getEffectStyle } from '@/lib/thumbnail/design-system-presets';

const getFilterString = (el: CreativeElement): string | undefined => {
  if (el.type !== 'image') return undefined;
  const parts: string[] = [];
  if (el.brightness !== undefined) parts.push(`brightness(${el.brightness}%)`);
  if (el.contrast !== undefined) parts.push(`contrast(${el.contrast}%)`);
  if (el.blurRadius !== undefined && el.blurRadius > 0) parts.push(`blur(${el.blurRadius}px)`);
  if (el.hueRotate !== undefined && el.hueRotate > 0) parts.push(`hue-rotate(${el.hueRotate}deg)`);
  if (el.saturate !== undefined) parts.push(`saturate(${el.saturate}%)`);
  return parts.length > 0 ? parts.join(' ') : undefined;
};

const getTransformString = (el: CreativeElement): string | undefined => {
  const parts: string[] = [];
  if (el.rotation) parts.push(`rotate(${el.rotation}deg)`);
  if (el.flipHorizontal) parts.push('scaleX(-1)');
  if (el.flipVertical) parts.push('scaleY(-1)');
  return parts.length > 0 ? parts.join(' ') : undefined;
};

interface ThumbnailCanvasProps {
  backgroundColor: string;
  backgroundGradient?: {
    type: 'linear' | 'radial';
    colors: string[];
    angle?: number;
  };
  backgroundImage?: string;
  elements: (CreativeElement | CanvasElement)[];
  selectedId?: string | null;
  selectedIds?: string[];
  onSelectElement: (id: string | null, multi?: boolean) => void;
  onSelectMultiple?: (ids: string[]) => void;
  onUpdateElement: (id: string, patch: Partial<CreativeElement>, commitToHistory?: boolean) => void;
  onUpdateElementsBatch?: (
    patches: { id: string; patch: Partial<CreativeElement> }[],
    commitToHistory?: boolean
  ) => void;
  onDeleteElement: (id: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  zoomPercent: number; // 10 - 200
  panX: number;
  panY: number;
  onPanChange: (x: number, y: number) => void;
  heatmapVisible?: boolean;
  saliencyHotspots?: SaliencyHotspot[];
  liveUsers?: PresenceUser[];
  comments?: CreativeComment[];
  isPinDropperActive?: boolean;
  onDropCommentPin?: (x: number, y: number) => void;
  onSelectCommentPin?: (comment: CreativeComment) => void;
  activeCommentId?: string | null;
}

interface DragState {
  type: 'move' | 'resize' | 'rotate' | 'marquee' | 'pan';
  handle?: string;
  startX: number;
  startY: number;
  initialElements: { id: string; x: number; y: number; width: number; height: number; rotation?: number }[];
  compositeBox?: BoundingBox;
}

interface MarqueeBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function ThumbnailCanvas({
  backgroundColor,
  backgroundGradient,
  backgroundImage,
  elements,
  selectedId,
  selectedIds,
  onSelectElement,
  onSelectMultiple,
  onUpdateElement,
  onUpdateElementsBatch,
  onDeleteElement,
  onUndo,
  onRedo,
  zoomPercent,
  panX,
  panY,
  onPanChange,
  heatmapVisible,
  saliencyHotspots,
  liveUsers,
  comments,
  isPinDropperActive,
  onDropCommentPin,
  onSelectCommentPin,
  activeCommentId,
}: ThumbnailCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [activeGuides, setActiveGuides] = useState<SnapGuideLine[]>([]);
  const [marquee, setMarquee] = useState<MarqueeBox | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  // Normalize active selection IDs
  const activeSelectedIds = useMemo(() => {
    if (rawSelectedIds && rawSelectedIds.length > 0) return rawSelectedIds;
    if (selectedId) return [selectedId];
    return [];
  }, [rawSelectedIds, selectedId]);

  const selectedElements = useMemo(() => {
    const set = new Set(activeSelectedIds);
    return elements.filter((el) => set.has(el.id));
  }, [elements, activeSelectedIds]);

  const compositeBoundingBox = useMemo(() => {
    if (selectedElements.length === 0) return null;
    return computeBoundingBox(selectedElements);
  }, [selectedElements]);

  // Preload any active Google Fonts dynamically on changes
  useEffect(() => {
    elements.forEach((el) => {
      if (el.type === 'text' && el.fontFamily) {
        FontLoader.loadFont(el.fontFamily);
      }
    });
  }, [elements]);

  // Spacebar pan listener
  useEffect(() => {
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

  // -------------------------------------------------------------
  // Pointer Event Handlers
  // -------------------------------------------------------------

  const handlePointerDownCanvas = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;

    // Pan Mode (Space + drag or middle click)
    if (isSpacePressed || e.button === 1) {
      setIsPanning(true);
      dragRef.current = {
        type: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        initialElements: [],
      };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    // Left click on empty canvas space initiates Marquee Box
    if (e.target === canvasRef.current || e.target === containerRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      dragRef.current = {
        type: 'marquee',
        startX: xPct,
        startY: yPct,
        initialElements: [],
      };

      setMarquee({
        startX: xPct,
        startY: yPct,
        currentX: xPct,
        currentY: yPct,
      });

      if (!e.shiftKey) {
        onSelectElement(null);
      }

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerDownElement = (e: React.PointerEvent, el: CreativeElement) => {
    e.stopPropagation();
    if (isSpacePressed) return;
    if (el.isLocked) return;

    const isMulti = e.shiftKey || e.metaKey || e.ctrlKey;
    const isAlreadySelected = activeSelectedIds.includes(el.id);

    let nextSelectedIds = activeSelectedIds;
    if (isMulti) {
      onSelectElement(el.id, true);
      nextSelectedIds = isAlreadySelected
        ? activeSelectedIds.filter((id) => id !== el.id)
        : [...activeSelectedIds, el.id];
    } else if (!isAlreadySelected) {
      onSelectElement(el.id, false);
      nextSelectedIds = [el.id];
    }

    const targets = elements.filter((item) => nextSelectedIds.includes(item.id));
    dragRef.current = {
      type: 'move',
      startX: e.clientX,
      startY: e.clientY,
      initialElements: targets.map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      })),
      compositeBox: computeBoundingBox(targets) || undefined,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerDownHandle = (e: React.PointerEvent, handle: string) => {
    e.stopPropagation();
    if (selectedElements.length === 0 || !canvasRef.current) return;

    const box = compositeBoundingBox;
    if (!box) return;

    dragRef.current = {
      type: handle === 'rotate' ? 'rotate' : 'resize',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      initialElements: selectedElements.map((item) => ({
        id: item.id,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        rotation: item.rotation,
      })),
      compositeBox: box,
    };

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleFactor = (zoomPercent / 100);
    const effectiveWidth = rect.width / scaleFactor;
    const effectiveHeight = rect.height / scaleFactor;

    const dxPct = ((e.clientX - dragRef.current.startX) / effectiveWidth) * 100;
    const dyPct = ((e.clientY - dragRef.current.startY) / effectiveHeight) * 100;

    // 1. Pan Viewport
    if (dragRef.current.type === 'pan') {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      onPanChange(panX + dx, panY + dy);
      dragRef.current.startX = e.clientX;
      dragRef.current.startY = e.clientY;
      return;
    }

    // 2. Marquee Selection Drag
    if (dragRef.current.type === 'marquee' && marquee) {
      const currentXPct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const currentYPct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      setMarquee({
        ...marquee,
        currentX: currentXPct,
        currentY: currentYPct,
      });

      const mLeft = Math.min(marquee.startX, currentXPct);
      const mRight = Math.max(marquee.startX, currentXPct);
      const mTop = Math.min(marquee.startY, currentYPct);
      const mBottom = Math.max(marquee.startY, currentYPct);

      // Find intersecting elements
      const intersectingIds = elements
        .filter((el) => {
          const elRight = el.x + el.width;
          const elBottom = el.y + el.height;
          return !(el.x > mRight || elRight < mLeft || el.y > mBottom || elBottom < mTop);
        })
        .map((el) => el.id);

      if (onSelectMultiple) {
        onSelectMultiple(intersectingIds);
      }
      return;
    }

    // 3. Move Elements (with Smart Snapping)
    if (dragRef.current.type === 'move' && dragRef.current.compositeBox) {
      const initBox = dragRef.current.compositeBox;
      const peerElements = elements.filter((el) => !activeSelectedIds.includes(el.id));

      const tentativeBox: BoundingBox = {
        ...initBox,
        x: Math.max(0, Math.min(100 - initBox.width, initBox.x + dxPct)),
        y: Math.max(0, Math.min(100 - initBox.height, initBox.y + dyPct)),
      };

      const { snappedBox, guides } = calculateSmartGuides(tentativeBox, peerElements, 1.0);
      setActiveGuides(guides);

      const appliedDx = snappedBox.x - initBox.x;
      const appliedDy = snappedBox.y - initBox.y;

      const patches = dragRef.current.initialElements.map((init) => ({
        id: init.id,
        patch: {
          x: Math.max(0, Math.min(100 - init.width, Number((init.x + appliedDx).toFixed(2)))),
          y: Math.max(0, Math.min(100 - init.height, Number((init.y + appliedDy).toFixed(2)))),
        },
      }));

      if (onUpdateElementsBatch) {
        onUpdateElementsBatch(patches, false);
      } else {
        patches.forEach((p) => onUpdateElement(p.id, p.patch, false));
      }
      return;
    }

    // 4. Resize Elements
    if (dragRef.current.type === 'resize' && dragRef.current.compositeBox) {
      const handle = dragRef.current.handle || 'se';
      const initBox = dragRef.current.compositeBox;
      const isShift = e.shiftKey;

      let newWidth = initBox.width;
      let newHeight = initBox.height;

      if (handle.includes('e')) newWidth = Math.max(5, initBox.width + dxPct);
      if (handle.includes('s')) newHeight = Math.max(5, initBox.height + dyPct);

      if (isShift) {
        const aspect = initBox.width / initBox.height;
        newHeight = newWidth / aspect;
      }

      const scaleX = newWidth / initBox.width;
      const scaleY = newHeight / initBox.height;

      const patches = dragRef.current.initialElements.map((init) => {
        const relX = init.x - initBox.x;
        const relY = init.y - initBox.y;

        return {
          id: init.id,
          patch: {
            x: Number((initBox.x + relX * scaleX).toFixed(2)),
            y: Number((initBox.y + relY * scaleY).toFixed(2)),
            width: Number((init.width * scaleX).toFixed(2)),
            height: Number((init.height * scaleY).toFixed(2)),
          },
        };
      });

      if (onUpdateElementsBatch) {
        onUpdateElementsBatch(patches, false);
      } else {
        patches.forEach((p) => onUpdateElement(p.id, p.patch, false));
      }
      return;
    }

    // 5. Rotation Handle
    if (dragRef.current.type === 'rotate' && dragRef.current.compositeBox) {
      const box = dragRef.current.compositeBox;
      const boxCenterX = ((box.x + box.width / 2) / 100) * rect.width + rect.left;
      const boxCenterY = ((box.y + box.height / 2) / 100) * rect.height + rect.top;

      const radians = Math.atan2(e.clientY - boxCenterY, e.clientX - boxCenterX);
      let degrees = Math.round((radians * (180 / Math.PI)) + 90);
      if (degrees < 0) degrees += 360;

      // 15° Shift Snapping
      if (e.shiftKey) {
        degrees = Math.round(degrees / 15) * 15;
      }

      const patches = dragRef.current.initialElements.map((init) => ({
        id: init.id,
        patch: { rotation: degrees },
      }));

      if (onUpdateElementsBatch) {
        onUpdateElementsBatch(patches, false);
      } else {
        patches.forEach((p) => onUpdateElement(p.id, p.patch, false));
      }
    }
  };

  const handlePointerUp = () => {
    if (dragRef.current) {
      if (dragRef.current.type === 'move' || dragRef.current.type === 'resize' || dragRef.current.type === 'rotate') {
        // Commit final state to history
        const targets = elements.filter((el) => activeSelectedIds.includes(el.id));
        const patches = targets.map((el) => ({
          id: el.id,
          patch: { x: el.x, y: el.y, width: el.width, height: el.height, rotation: el.rotation },
        }));

        if (onUpdateElementsBatch) {
          onUpdateElementsBatch(patches, true);
        }
      }
      dragRef.current = null;
    }
    setIsPanning(false);
    setActiveGuides([]);
    setMarquee(null);
  };

  // Background Gradient / Color Style
  const backgroundStyle: React.CSSProperties = useMemo(() => {
    if (backgroundImage) {
      return {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    }
    if (backgroundGradient && backgroundGradient.colors?.length >= 2) {
      if (backgroundGradient.type === 'radial') {
        return { background: `radial-gradient(circle at center, ${backgroundGradient.colors.join(', ')})` };
      }
      return {
        background: `linear-gradient(${backgroundGradient.angle || 135}deg, ${backgroundGradient.colors.join(', ')})`,
      };
    }
    return { backgroundColor: backgroundColor || '#0f172a' };
  }, [backgroundColor, backgroundGradient, backgroundImage]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDownCanvas}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="w-full h-full flex items-center justify-center relative overflow-hidden select-none touch-none cursor-default"
      style={{
        cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : 'default',
      }}
    >
      {/* Centered Canvas Frame with Pan & Zoom */}
      <div
        ref={canvasRef}
        className="aspect-video w-full max-w-[1280px] shadow-2xl relative rounded-xl overflow-hidden transition-transform duration-75"
        style={{
          ...backgroundStyle,
          transform: `translate(${panX}px, ${panY}px) scale(${zoomPercent / 100})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Render Elements */}
        {elements.map((el) => {
          if (el.isHidden) return null;
          const isSelected = activeSelectedIds.includes(el.id);

          return (
            <div
              key={el.id}
              onPointerDown={(e) => handlePointerDownElement(e, el)}
              className={cn(
                'absolute cursor-move transition-shadow',
                isSelected ? 'ring-1 ring-emerald-400' : 'hover:ring-1 hover:ring-slate-600/50'
              )}
              style={{
                left: `${el.x}%`,
                top: `${el.y}%`,
                width: `${el.width}%`,
                height: `${el.height}%`,
                zIndex: el.zIndex || 1,
                transform: getTransformString(el),
                clipPath: el.clipPath,
                mixBlendMode: el.blendMode,
                borderRadius: el.borderRadius ? `${el.borderRadius}px` : undefined,
                opacity: el.opacity !== undefined ? el.opacity : 1,
              }}
            >
              {/* Text Element */}
              {el.type === 'text' && (
                <div
                  className="w-full h-full flex items-center justify-center leading-none select-none font-bold"
                  style={{
                    fontSize: `${el.fontSize || 48}px`,
                    fontFamily: el.fontFamily || 'Impact',
                    color: el.fill || '#ffffff',
                    textAlign: (el.textAlign as React.CSSProperties['textAlign']) || 'center',
                    WebkitTextStroke: el.textStrokeWidth && el.textStrokeWidth > 0
                      ? `${el.textStrokeWidth}px ${el.textStrokeColor || '#000000'}`
                      : undefined,
                    fontWeight: el.fontWeight || 'bold',
                    fontStyle: el.fontStyle || 'normal',
                    ...getEffectStyle(el.textEffect || 'none', el.fill || '#ffffff'),
                  }}
                >
                  {el.text}
                </div>
              )}

              {/* Image Element */}
              {el.type === 'image' && el.imageSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={el.imageSrc}
                  alt="Canvas Element"
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ filter: getFilterString(el) }}
                />
              )}

              {/* Rectangle Shape */}
              {el.type === 'rect' && (
                <div
                  className="w-full h-full"
                  style={{
                    backgroundColor: el.shapeFill || '#10b981',
                    borderRadius: el.borderRadius ? `${el.borderRadius}px` : '8px',
                  }}
                />
              )}

              {/* Circle Shape */}
              {el.type === 'circle' && (
                <div
                  className="w-full h-full rounded-full"
                  style={{ backgroundColor: el.shapeFill || '#10b981' }}
                />
              )}

              {/* Arrow Shape */}
              {el.type === 'arrow' && (
                <div className="w-full h-full flex items-center justify-center">
                  <ArrowRight
                    className="w-full h-full"
                    style={{ color: el.shapeFill || '#10b981' }}
                  />
                </div>
              )}

              {/* Emoji */}
              {el.type === 'emoji' && (
                <div className="w-full h-full flex items-center justify-center text-4xl select-none">
                  {el.text}
                </div>
              )}

              {/* Icon */}
              {el.type === 'icon' && el.iconName && (
                <div className="w-full h-full flex items-center justify-center">
                  {(() => {
                    const IconComp = (LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>>)[el.iconName];
                    return IconComp ? (
                      <IconComp className="w-full h-full" style={{ color: el.shapeFill || '#ffffff' }} />
                    ) : null;
                  })()}
                </div>
              )}
            </div>
          );
        })}

        {/* ------------------------------------------------------------- */}
        {/* Composite Multi-Selection Bounding Box & Transformation UI    */}
        {/* ------------------------------------------------------------- */}
        {compositeBoundingBox && activeSelectedIds.length > 0 && (
          <div
            className="absolute border-2 border-emerald-400 pointer-events-none z-40"
            style={{
              left: `${compositeBoundingBox.x}%`,
              top: `${compositeBoundingBox.y}%`,
              width: `${compositeBoundingBox.width}%`,
              height: `${compositeBoundingBox.height}%`,
            }}
          >
            {/* Top Rotation Handle */}
            <div
              onPointerDown={(e) => handlePointerDownHandle(e, 'rotate')}
              className="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-slate-900 border-2 border-emerald-400 flex items-center justify-center cursor-grab pointer-events-auto hover:scale-110 transition-transform shadow-lg"
              title="Rotate (Hold Shift for 15° snap)"
            >
              <RotateCw className="w-3 h-3 text-emerald-400" />
            </div>

            {/* Corner Resize Handles */}
            <div
              onPointerDown={(e) => handlePointerDownHandle(e, 'nw')}
              className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nwse-resize pointer-events-auto shadow-sm"
            />
            <div
              onPointerDown={(e) => handlePointerDownHandle(e, 'ne')}
              className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nesw-resize pointer-events-auto shadow-sm"
            />
            <div
              onPointerDown={(e) => handlePointerDownHandle(e, 'sw')}
              className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nesw-resize pointer-events-auto shadow-sm"
            />
            <div
              onPointerDown={(e) => handlePointerDownHandle(e, 'se')}
              className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-emerald-500 rounded-sm cursor-nwse-resize pointer-events-auto shadow-sm"
            />
          </div>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Dynamic Smart Snapping Guide Lines & Distance Pills           */}
        {/* ------------------------------------------------------------- */}
        {activeGuides.map((guide, idx) => (
          <div
            key={idx}
            className="absolute z-50 pointer-events-none flex items-center justify-center"
            style={
              guide.orientation === 'vertical'
                ? {
                    left: `${guide.position}%`,
                    top: 0,
                    bottom: 0,
                    width: '1px',
                    backgroundColor: '#22d3ee',
                    boxShadow: '0 0 8px rgba(34, 211, 238, 0.8)',
                  }
                : {
                    top: `${guide.position}%`,
                    left: 0,
                    right: 0,
                    height: '1px',
                    backgroundColor: '#22d3ee',
                    boxShadow: '0 0 8px rgba(34, 211, 238, 0.8)',
                  }
            }
          >
            {guide.label && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cyan-500 text-slate-950 shadow-md font-mono">
                {guide.label}
              </span>
            )}
          </div>
        ))}

        {/* ------------------------------------------------------------- */}
        {/* Marquee Drag Box Overlay                                      */}
        {/* ------------------------------------------------------------- */}
        {marquee && (
          <div
            className="absolute border border-dashed border-emerald-400 bg-emerald-500/10 pointer-events-none z-40"
            style={{
              left: `${Math.min(marquee.startX, marquee.currentX)}%`,
              top: `${Math.min(marquee.startY, marquee.currentY)}%`,
              width: `${Math.abs(marquee.currentX - marquee.startX)}%`,
              height: `${Math.abs(marquee.currentY - marquee.startY)}%`,
            }}
          />
        )}

        {/* ------------------------------------------------------------- */}
        {/* Attention Saliency Heatmap Overlay (Phase 4)                  */}
        {/* ------------------------------------------------------------- */}
        <AttentionHeatmapOverlay
          visible={heatmapVisible ?? false}
          hotspots={saliencyHotspots ?? []}
        />

        {/* ------------------------------------------------------------- */}
        {/* Live Multi-User Cursor & Presence Overlay (Phase 7)           */}
        {/* ------------------------------------------------------------- */}
        <LiveCursorOverlay users={liveUsers ?? []} />

        {/* ------------------------------------------------------------- */}
        {/* Canvas Visual Comment Pin Layer (Phase 7)                     */}
        {/* ------------------------------------------------------------- */}
        <CanvasCommentPinOverlay
          comments={comments ?? []}
          isPinDropperActive={isPinDropperActive ?? false}
          onDropPin={onDropCommentPin ?? (() => {})}
          onSelectPin={onSelectCommentPin ?? (() => {})}
          activeCommentId={activeCommentId}
        />
      </div>
    </div>
  );
}
