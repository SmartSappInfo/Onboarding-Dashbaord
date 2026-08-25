'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Interactive Document Layer Overlays:
 *    Renders interactive hotspots, video triggers, audio clips, WhatsApp CTAs, phone dialers,
 *    and download buttons over page canvas/images using normalized percentage coordinates (PRD Sections 51–52 & 66–75).
 * 2. Responsive Coordinate Scale Invariant:
 *    Positions (`left: ${x}%`, `top: ${y}%`) are normalized to 0–100% of the rendered
 *    page container bounding box, eliminating coordinate drift across desktop and mobile screens.
 * 3. Mobile Touch Ergonomics:
 *    All buttons enforce `min-h-[44px]` touch target bounds with active scaling feedback (`active:scale-95`).
 * 4. Emil Kowalski Animation Standards:
 *    Interactive badges include subtle pulsing rings and smooth hover transitions.
 * 5. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React from 'react';
import type { FlipbookHotspot } from '@/lib/types/flipbook-types';
import { 
  Video, ExternalLink, Sparkles, MessageCircle, 
  Music, Phone, Mail, Download, Send 
} from 'lucide-react';

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
        const type = h.type;
        const url = (h.targetUrl || '').toLowerCase();
        const isWhatsApp = type === 'whatsapp' || url.includes('wa.me') || url.includes('whatsapp');
        const isVideo = type === 'video';
        const isAudio = type === 'audio';
        const isPhone = type === 'phone' || url.startsWith('tel:');
        const isEmail = type === 'email' || url.startsWith('mailto:');
        const isDownload = type === 'download';
        const isForm = type === 'form' || type === 'web';

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
            className={`absolute pointer-events-auto flex items-center justify-center p-1.5 rounded-xl border backdrop-blur-md shadow-xl transition-all duration-200 hover:scale-105 active:scale-95 group focus:outline-none focus:ring-2 focus:ring-primary min-h-[44px] min-w-[44px] ${
              isVideo
                ? 'border-rose-500/50 bg-black/60 text-rose-300'
                : isAudio
                ? 'border-violet-500/50 bg-black/60 text-violet-300'
                : isWhatsApp
                ? 'border-emerald-500/50 bg-black/60 text-emerald-300'
                : isPhone
                ? 'border-sky-500/50 bg-black/60 text-sky-300'
                : isEmail
                ? 'border-amber-500/50 bg-black/60 text-amber-300'
                : isDownload
                ? 'border-indigo-500/50 bg-black/60 text-indigo-300'
                : 'border-white/40 bg-black/50 hover:bg-black/75 text-white'
            }`}
            title={h.title || 'Interactive Layer'}
          >
            {/* Subtle glow beacon */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isVideo ? 'bg-rose-400' : isWhatsApp ? 'bg-emerald-400' : isAudio ? 'bg-violet-400' : 'bg-primary'
              }`} />
              <span className={`relative inline-flex rounded-full h-3 w-3 ${
                isVideo ? 'bg-rose-500' : isWhatsApp ? 'bg-emerald-500' : isAudio ? 'bg-violet-500' : 'bg-primary'
              }`} />
            </span>

            <div className="flex items-center gap-1.5 min-w-0 px-1">
              {isVideo && <Video className="h-4 w-4 text-rose-400 shrink-0" />}
              {isAudio && <Music className="h-4 w-4 text-violet-400 shrink-0" />}
              {isWhatsApp && <MessageCircle className="h-4 w-4 text-emerald-400 shrink-0" />}
              {isPhone && <Phone className="h-4 w-4 text-sky-400 shrink-0" />}
              {isEmail && <Mail className="h-4 w-4 text-amber-400 shrink-0" />}
              {isDownload && <Download className="h-4 w-4 text-indigo-400 shrink-0" />}
              {isForm && <Send className="h-4 w-4 text-indigo-400 shrink-0" />}
              {!isVideo && !isAudio && !isWhatsApp && !isPhone && !isEmail && !isDownload && !isForm && (
                <ExternalLink className="h-4 w-4 text-indigo-400 shrink-0" />
              )}
              <span className="text-[11px] font-bold truncate max-w-[120px] select-none text-white">
                {h.title || (isVideo ? 'Watch Video' : isWhatsApp ? 'WhatsApp' : isAudio ? 'Listen' : 'Open Link')}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
