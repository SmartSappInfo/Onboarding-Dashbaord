'use client';

/**
 * @fileOverview Shared sheet for the outcomes panel (Phase 11 M2 · T6; theme.md §8, plan §13).
 * Bottom sheet on phones, side sheet on larger screens. Semantic surface tokens, demarcated header
 * with guidance in `CardInfoTooltip` (no visible description paragraph), optional footer bar.
 */

import * as React from 'react';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { useIsMobile } from '@/hooks/use-mobile';

export function OutcomeSheet({
  open,
  onOpenChange,
  title,
  info,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  info: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const isMobile = useIsMobile();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={`p-0 gap-0 flex flex-col border-border/80 bg-card text-card-foreground ${isMobile ? 'max-h-[85vh] rounded-t-2xl' : 'w-full sm:max-w-lg'}`}
      >
        <div className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center gap-2 shrink-0 pr-12">
          <SheetTitle className="text-sm font-semibold">{title}</SheetTitle>
          <CardInfoTooltip text={info} />
          <SheetDescription className="sr-only">{info}</SheetDescription>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 text-xs">{children}</div>
        {footer && (
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5 shrink-0">{footer}</div>
        )}
      </SheetContent>
    </Sheet>
  );
}
