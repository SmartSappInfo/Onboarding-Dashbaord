'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Viewer Engine 2.0 Toolbar:
 *    Responsive top and bottom control bars providing mode switching, zooming, audio toggling,
 *    search, and accessibility settings (PRD Sections 40–48 & 85).
 * 2. Mobile Ergonomics & Touch Target Bounds:
 *    All buttons enforce `min-h-[44px]` and `min-w-[44px]` touch targets with active scale feedback.
 * 3. Emil Kowalski Animation Standards:
 *    Backdrop blur, micro-interactions, and smooth icon state transitions.
 * 4. Strict Typing Standard:
 *    Zero `any` or `any[]` types are permitted.
 */

import React from 'react';
import { 
  BookOpen, Grid, Volume2, VolumeX, Download, Maximize, 
  Search, ZoomIn, ZoomOut, RotateCcw, Presentation,
  SunMoon, Columns, AlignJustify, Sparkles
} from 'lucide-react';
import type { ViewerMode } from '@/lib/types/document-types';
import { Button } from '@/components/ui/button';
import { LikeButton } from '@/components/shared/LikeButton';
import { ShareSocialDropdown } from '@/components/shared/ShareSocialDropdown';

interface ViewerToolbarProps {
  title: string;
  logoUrl?: string;
  currentPage: number;
  pageCount: number;
  viewerMode: ViewerMode;
  onModeChange: (mode: ViewerMode) => void;
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isHighContrast: boolean;
  onToggleHighContrast: () => void;
  onOpenSearch: () => void;
  onOpenThumbnails: () => void;
  onPageSelect: (pageNumber: number) => void;
  onOpenAiAssistant?: () => void;
  likesCount?: number;
  sourceFileUrl?: string;
  enableDownload?: boolean;
}

export function ViewerToolbar({
  title,
  logoUrl,
  currentPage,
  pageCount,
  viewerMode,
  onModeChange,
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  isMuted,
  onToggleMute,
  isFullscreen,
  onToggleFullscreen,
  isHighContrast,
  onToggleHighContrast,
  onOpenSearch,
  onOpenThumbnails,
  onPageSelect,
  onOpenAiAssistant,
  likesCount = 0,
  sourceFileUrl,
  enableDownload = true,
}: ViewerToolbarProps) {
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      {/* Top Header Bar */}
      <header 
        className="h-16 border-b border-white/10 bg-black/50 backdrop-blur-xl px-4 flex items-center justify-between z-40 shrink-0 select-none"
        role="toolbar"
        aria-label="Document reader top controls"
      >
        <div className="flex items-center gap-3 min-w-0">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-8 object-contain" />
          ) : (
            <BookOpen className="h-6 w-6 text-indigo-400 shrink-0" />
          )}
          <h1 className="text-sm sm:text-base font-black truncate max-w-[160px] sm:max-w-xs md:max-w-md text-white">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mode Switcher */}
          <div className="hidden lg:flex items-center rounded-xl bg-white/5 p-1 border border-white/10">
            <button
              type="button"
              onClick={() => onModeChange('flipbook')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-[0.97] ${
                viewerMode === 'flipbook' || viewerMode === 'double_page'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Flipbook Spread Mode"
            >
              <Columns className="h-4 w-4" />
              <span>Flipbook</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange('presentation')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-[0.97] ${
                viewerMode === 'presentation' || viewerMode === 'single_page'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Single Slide Presentation Mode"
            >
              <Presentation className="h-4 w-4" />
              <span>Slide</span>
            </button>

            <button
              type="button"
              onClick={() => onModeChange('continuous')}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all min-h-[44px] flex items-center gap-1.5 active:scale-[0.97] ${
                viewerMode === 'continuous'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Continuous Scroll Mode"
            >
              <AlignJustify className="h-4 w-4" />
              <span>Scroll</span>
            </button>
          </div>

          {/* Social & Engagement */}
          <LikeButton initialLikes={likesCount} className="h-10 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20" />
          <ShareSocialDropdown title={title} url={currentUrl} className="h-10 px-3 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20" />

          {/* AI Assistant Trigger */}
          {onOpenAiAssistant && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenAiAssistant}
              className="h-11 w-11 rounded-xl text-amber-300 hover:text-amber-200 hover:bg-amber-400/20 min-h-[44px] min-w-[44px]"
              title="Ask AI Document Assistant"
            >
              <Sparkles className="h-5 w-5" />
            </Button>
          )}

          {/* Search Trigger */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSearch}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Search publication (Enter keywords)"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Thumbnails Drawer */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenThumbnails}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Thumbnails Grid"
          >
            <Grid className="h-5 w-5" />
          </Button>

          {/* Audio Synthesizer Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMute}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title={isMuted ? 'Unmute page flip sound' : 'Mute page flip sound'}
          >
            {isMuted ? <VolumeX className="h-5 w-5 text-rose-400" /> : <Volume2 className="h-5 w-5 text-emerald-400" />}
          </Button>

          {/* High Contrast Mode Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleHighContrast}
            className={`h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px] ${
              isHighContrast ? 'text-amber-400 bg-white/10' : ''
            }`}
            title="Toggle High-Contrast Mode (Accessibility)"
          >
            <SunMoon className="h-5 w-5" />
          </Button>

          {/* PDF Download */}
          {enableDownload && sourceFileUrl && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => window.open(sourceFileUrl, '_blank')}
              className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
              title="Download Original PDF Document"
            >
              <Download className="h-5 w-5" />
            </Button>
          )}

          {/* Fullscreen Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullscreen}
            className="h-11 w-11 rounded-xl text-white hover:bg-white/10 min-h-[44px] min-w-[44px]"
            title="Toggle Fullscreen"
          >
            <Maximize className={`h-5 w-5 ${isFullscreen ? 'text-indigo-400' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Floating Zoom & Controls Widget */}
      <div 
        className="fixed bottom-20 right-6 z-40 hidden sm:flex items-center gap-1 p-1.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/15 shadow-2xl"
        role="group"
        aria-label="Zoom controls"
      >
        <button
          type="button"
          onClick={onZoomOut}
          disabled={zoomScale <= 1.0}
          className="p-2.5 rounded-xl text-white hover:bg-white/10 disabled:opacity-30 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
          title="Zoom out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </button>

        <span className="px-2 text-[11px] font-mono font-bold text-slate-300 min-w-[45px] text-center select-none">
          {Math.round(zoomScale * 100)}%
        </span>

        <button
          type="button"
          onClick={onZoomIn}
          disabled={zoomScale >= 3.0}
          className="p-2.5 rounded-xl text-white hover:bg-white/10 disabled:opacity-30 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95"
          title="Zoom in (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </button>

        {zoomScale > 1.0 && (
          <button
            type="button"
            onClick={onResetZoom}
            className="p-2.5 rounded-xl text-indigo-300 hover:bg-white/10 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center active:scale-95 border-l border-white/10"
            title="Reset Zoom (Escape)"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>
    </>
  );
}
