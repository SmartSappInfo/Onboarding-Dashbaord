'use client';

/**
 * ARCHITECTURE:
 * Canvas Visual Comment Pin Layer (Phase 7 - Real-Time Collaboration)
 * 
 * Renders visual pin comment markers at normalized coordinates (0-100%) on the canvas.
 * Supports active pin-dropping mode where clicking anywhere drops a new comment marker.
 * 
 * CAUTION:
 * Pin buttons MUST call e.stopPropagation() to prevent unintended canvas selection.
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import type { CreativeComment } from '@/lib/creative/creative-types';
import { cn } from '@/lib/utils';

interface CanvasCommentPinOverlayProps {
  comments: CreativeComment[];
  isPinDropperActive: boolean;
  onDropPin: (xPercent: number, yPercent: number) => void;
  onSelectPin: (comment: CreativeComment) => void;
  activeCommentId?: string | null;
}

export function CanvasCommentPinOverlay({
  comments,
  isPinDropperActive,
  onDropPin,
  onSelectPin,
  activeCommentId,
}: CanvasCommentPinOverlayProps) {
  const pinComments = comments.filter((c) => c.pinX !== undefined && c.pinY !== undefined);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPinDropperActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    onDropPin(Math.round(x * 10) / 10, Math.round(y * 10) / 10);
  };

  return (
    <div
      onClick={handleCanvasClick}
      className={cn(
        'absolute inset-0 z-20',
        isPinDropperActive ? 'cursor-crosshair bg-cyan-500/5' : 'pointer-events-none'
      )}
    >
      {pinComments.map((comment, index) => {
        const isSelected = activeCommentId === comment.id;
        const isResolved = comment.resolved;

        return (
          <div
            key={comment.id}
            style={{
              left: `${comment.pinX}%`,
              top: `${comment.pinY}%`,
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectPin(comment);
              }}
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-xl transition-all active:scale-[0.9]',
                isSelected
                  ? 'bg-emerald-400 text-slate-950 scale-110 ring-4 ring-emerald-500/30'
                  : isResolved
                  ? 'bg-slate-800 text-slate-400 border border-slate-700 opacity-60'
                  : 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 hover:scale-110'
              )}
              title={`${comment.authorName}: ${comment.text}`}
            >
              {isResolved ? '✓' : index + 1}
            </button>
          </div>
        );
      })}
    </div>
  );
}
