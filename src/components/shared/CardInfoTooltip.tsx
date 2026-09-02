'use client';

/**
 * @fileOverview SmartSapp Design System — Card Header Info Tooltip
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Accessible, touch-first popover/tooltip for card headers and configuration labels.
 * - Supports hover on desktop and tap on touch devices.
 * - Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface CardInfoTooltipProps {
  text: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
}

export function CardInfoTooltip({
  text,
  className,
  side = 'top',
  align = 'start',
}: CardInfoTooltipProps) {
  const [popoverOpen, setPopoverOpen] = React.useState(false);

  if (!text) return null;

  return (
    <TooltipProvider delayDuration={150}>
      {/* Popover wrapper specifically for mobile tap without hover requirements */}
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                }}
                className={cn(
                  'inline-flex items-center justify-center h-5 w-5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-all focus:outline-none focus:ring-1 focus:ring-primary/40 active:scale-95 shrink-0 cursor-help',
                  className
                )}
                aria-label="More information"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent
            side={side}
            align={align}
            className="hidden sm:block max-w-xs text-xs font-normal leading-relaxed p-2.5 rounded-xl shadow-lg border border-border/70 bg-popover text-popover-foreground z-50 animate-in fade-in-50 zoom-in-95"
          >
            {text}
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          side={side}
          align={align}
          className="sm:hidden max-w-[280px] text-xs font-normal leading-relaxed p-3 rounded-xl shadow-xl border border-border/80 bg-popover text-popover-foreground z-50"
        >
          {text}
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}
