'use client';

/**
 * @fileOverview Context Rail Header Trigger Button (Phase 8 Milestone 4 Task 4)
 *
 * Implements accessible trigger button for the Global Context Rail:
 * - Option+C keyboard shortcut indicator
 * - Live badge counts for pending approvals & active runs
 * - Rule 7: Touch target >= 44px min-h-[44px]
 * - Rule 10: Strict typing, zero any
 * - Tactile feedback active:scale-[0.97]
 */

import * as React from 'react';
import { PanelRightClose, PanelRightOpen, Sparkles, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useContextRail } from './ContextRailContext';

export interface ContextRailTriggerProps {
  className?: string;
}

export function ContextRailTrigger({ className }: ContextRailTriggerProps) {
  const { isOpen, toggle, pendingApprovalsCount, activeRunsCount } = useContextRail();

  const totalBadges = pendingApprovalsCount + activeRunsCount;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={toggle}
            aria-label="Toggle Context Intelligence Rail (Option+C)"
            aria-expanded={isOpen}
            data-testid="context-rail-trigger-btn"
            className={`relative min-h-[44px] min-w-[44px] px-2.5 sm:px-3 text-muted-foreground hover:text-foreground active:scale-[0.97] rounded-xl flex items-center gap-1.5 transition-all ${className || ''}`}
          >
            {isOpen ? (
              <PanelRightClose className="h-4 w-4 text-primary" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}

            <span className="hidden sm:inline-block text-xs font-medium">
              Context Rail
            </span>

            {/* Notification Badge Indicator */}
            {totalBadges > 0 && (
              <span
                data-testid="context-rail-trigger-badge"
                className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                  pendingApprovalsCount > 0
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-primary text-primary-foreground'
                }`}
              >
                {totalBadges}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-xs">
          <div className="flex items-center gap-2">
            <span>Context Intelligence Rail</span>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted/80 rounded border border-border/80">
              ⌥C
            </kbd>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
