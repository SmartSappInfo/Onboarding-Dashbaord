'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Realistic macOS Safari Browser Chrome
 */

import * as React from 'react';
import { Lock, Share2, Maximize2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MacBrowserFrameProps {
  slug?: string;
  children: React.ReactNode;
  onRefresh?: () => void;
  isDark?: boolean;
  className?: string;
}

export function MacBrowserFrame({
  slug = 'survey-preview',
  children,
  onRefresh,
  className,
}: MacBrowserFrameProps) {
  const displayUrl = `smartsapp.com/s/${slug || 'survey-preview'}`;

  return (
    <div
      className={cn(
        'w-full h-full flex flex-col rounded-2xl border border-border/80 shadow-2xl overflow-hidden bg-card transition-all duration-300',
        className
      )}
    >
      {/* macOS Window Header Chrome */}
      <div className="h-11 px-4 bg-muted/40 border-b border-border/60 flex items-center justify-between shrink-0 select-none">
        {/* macOS Traffic Lights */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E] hover:opacity-80 transition-opacity" />
          <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123] hover:opacity-80 transition-opacity" />
          <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29] hover:opacity-80 transition-opacity" />
        </div>

        {/* Safari URL Address Bar */}
        <div className="flex items-center gap-2 px-3.5 py-1 rounded-lg bg-background/90 border border-border/60 shadow-xs max-w-sm w-full mx-4 justify-center text-xs text-muted-foreground font-mono">
          <Lock className="h-3 w-3 text-emerald-500 shrink-0" />
          <span className="truncate">{displayUrl}</span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 text-muted-foreground/60">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-1 rounded hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Refresh preview"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Screen Content Viewport */}
      <div className="flex-1 relative overflow-hidden">{children}</div>
    </div>
  );
}
