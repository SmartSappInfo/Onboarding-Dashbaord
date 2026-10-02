'use client';

/**
 * @fileOverview SmartSapp Design System — Card & Modal Header Info Tooltip
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Accessible, touch-first popover/tooltip for card headers and modal title areas.
 * - Single-circle presentation: renders clean Lucide Info icon without outer button rings or nested borders.
 * - Unified state machine: supports mouse hover, keyboard focus, and mobile tap/click toggling.
 * - High z-index (z-[10050]) to cleanly overlay above Radix modal dialogs (z-[100]) without clipping.
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
  align = 'center',
}: CardInfoTooltipProps) {
  const [open, setOpen] = React.useState(false);

  if (!text) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onPointerDown={(e) => {
              // Prevent Radix tooltip trigger from suppressing click toggling
              e.preventDefault();
              setOpen((prev) => !prev);
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
            className={cn(
              'inline-flex items-center justify-center p-0.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted/80 transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-95 shrink-0 cursor-help',
              className
            )}
            data-testid="card-info-tooltip"
            aria-label="More information"
          >
            <Info className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side={side}
          align={align}
          className="z-[10050] max-w-xs text-xs font-normal leading-relaxed p-2.5 rounded-xl shadow-xl border border-border/80 bg-popover text-popover-foreground animate-in fade-in-50 zoom-in-95 pointer-events-none"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
