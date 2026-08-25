'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Interactive Document Layer Overlays:
 *    Renders interactive hotspots, links, video triggers, and WhatsApp CTAs
 *    over page canvas/images using normalized percentage coordinates (PRD Sections 20–22 & 66–75).
 * 2. Responsive Coordinate Scale Invariant:
 *    Positions (`left: ${x}%`, `top: ${y}%`) are normalized to 0–100% of the rendered
 *    page container bounding box, eliminating coordinate drift across desktop and mobile screens.
 * 3. Emil Kowalski Animation Standards:
 *    Interactive badges include subtle pulsing rings and `active:scale-[0.95]` feedback.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React from 'react';
import type { FlipbookHotspot } from '@/lib/types/flipbook-types';
import { Video, ExternalLink, Sparkles, MessageCircle } from 'lucide-react';

interface DocumentLayerOverlayProps {
  hotspots: FlipbookHotspot[];
  currentPage: number;
  onHotspotClick: (hotspot: FlipbookHotspot) => void;
}

export function DocumentLayerOverlay({
  hotspots,
  currentPage,
  onHotspotClick,
}: DocumentLayerOverlayProps) {
  const currentHotspots = hotspots.filter((h) => h.pageNumber === currentPage);

  if (currentHotspots.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
      {currentHotspots.map((h) => {
        const isVideo = h.type === 'video';
        const url = (h.targetUrl || '').toLowerCase();
        const isWhatsApp = url.includes('wa.me') || url.includes('whatsapp');

        return (
          <button
            key={h.id}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHotspotClick(h);
            }}
            style={{
              left: `${Math.min(95, Math.max(2, h.x))}%`,
              top: `${Math.min(95, Math.max(2, h.y))}%`,
              width: `${Math.min(90, Math.max(8, h.width || 20))}%`,
              height: `${Math.min(90, Math.max(6, h.height || 10))}%`,
            }}
            className="absolute pointer-events-auto flex items-center justify-center p-1.5 rounded-xl border border-white/40 bg-black/50 hover:bg-black/75 backdrop-blur-md text-white shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px]"
            title={h.title || 'Interactive Layer'}
          >
            {/* Subtle glow beacon */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>

            <div className="flex items-center gap-1.5 min-w-0 px-1">
              {isVideo ? (
                <Video className="h-4 w-4 text-rose-400 shrink-0" />
              ) : isWhatsApp ? (
                <MessageCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              ) : (
                <ExternalLink className="h-4 w-4 text-indigo-400 shrink-0" />
              )}
              <span className="text-[11px] font-bold truncate max-w-[120px] select-none">
                {h.title || (isVideo ? 'Watch Video' : 'Open Link')}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
