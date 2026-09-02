'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Realistic iPhone 16 Pro Device Frame
 */

import * as React from 'react';
import { Signal, Wifi, Battery } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IPhoneFrameProps {
  children: React.ReactNode;
  isDark?: boolean;
  className?: string;
}

export function IPhoneFrame({ children, className }: IPhoneFrameProps) {
  return (
    <div
      className={cn(
        'relative w-[375px] h-[720px] rounded-[52px] border-[6px] border-[#1C1C1E] bg-[#1C1C1E] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col ring-1 ring-white/10 shrink-0 mx-auto transition-all duration-300',
        className
      )}
    >
      {/* Status Bar & Dynamic Island */}
      <div className="h-11 px-7 flex items-center justify-between z-30 select-none bg-transparent shrink-0">
        <span className="text-[12px] font-semibold text-foreground tracking-tight">9:41</span>

        {/* Dynamic Island */}
        <div className="w-24 h-6 rounded-full bg-black flex items-center justify-end px-2 gap-1.5 shadow-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-[#0D0D0D] border border-white/5" />
        </div>

        <div className="flex items-center gap-1.5 text-foreground">
          <Signal className="h-3 w-3" />
          <Wifi className="h-3 w-3" />
          <Battery className="h-4 w-4" />
        </div>
      </div>

      {/* Screen Content Viewport */}
      <div className="flex-1 relative overflow-hidden rounded-b-[44px] bg-background">
        {children}
      </div>

      {/* Home Indicator Bar */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-32 h-1 rounded-full bg-foreground/30 z-30 pointer-events-none" />
    </div>
  );
}
