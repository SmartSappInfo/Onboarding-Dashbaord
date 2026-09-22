/**
 * @fileoverview Deal Stage Stepper Component
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (Rule 10, Rule 8, Rule 5):
 * - Replaces clunky select dropdowns with an interactive, horizontal pipeline progression stepper.
 * - Displays all stages of the active pipeline dynamically (sourced from Backoffice Pipeline Settings).
 * - Distinguishes completed, active, and upcoming stages with clear visual indicators.
 * - Supports 1-click stage advancement and status changes (Won, Lost, Reopen) with guard states.
 * - Fully mobile responsive (horizontal scroll track with snap points, min 44px touch targets).
 * - Strictly typed (zero any or unknown types), WCAG AAA accessible.
 */

'use client';

import * as React from 'react';
import { 
  Check, 
  ChevronRight, 
  Trophy, 
  XCircle, 
  RotateCcw, 
  Loader2, 
  CircleDot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { OnboardingStage, Deal } from '@/lib/types';

export interface DealStageStepperProps {
  stages: OnboardingStage[];
  currentStageId: string;
  deal?: Deal;
  status?: 'open' | 'won' | 'lost';
  onStageSelect?: (stageId: string) => Promise<void> | void;
  onSelectStage?: (stageId: string) => Promise<void> | void;
  onStatusChange?: (status: 'open' | 'won' | 'lost') => Promise<void> | void;
  onSelectStatus?: (status: 'open' | 'won' | 'lost') => Promise<void> | void;
  isTransitioning?: boolean;
  disabled?: boolean;
  className?: string;
}

export function DealStageStepper({
  stages,
  currentStageId,
  deal,
  status,
  onStageSelect,
  onSelectStage,
  onStatusChange,
  onSelectStatus,
  isTransitioning = false,
  disabled = false,
  className,
}: DealStageStepperProps) {
  const effectiveStageSelect = onSelectStage || onStageSelect;
  const effectiveStatusChange = onSelectStatus || onStatusChange;
  const isBusy = isTransitioning || disabled;

  // Sort stages by order ascending
  const sortedStages = React.useMemo(() => {
    return [...stages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [stages]);

  const currentIndex = sortedStages.findIndex(s => s.id === currentStageId);

  const currentStatus = status || deal?.status || 'open';
  const isWon = currentStatus === 'won';
  const isLost = currentStatus === 'lost';

  return (
    <div className={cn("w-full space-y-2", className)}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 sm:p-3 rounded-2xl bg-card border border-border/60 shadow-xs">
        {/* Horizontal Stage Progression Track */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-1 px-0.5 snap-x flex-1 min-w-0">
          {sortedStages.map((stage, index) => {
            const isCurrent = stage.id === currentStageId;
            const isCompleted = currentIndex >= 0 && index < currentIndex;
            const isUpcoming = currentIndex >= 0 && index > currentIndex;

            return (
              <React.Fragment key={stage.id}>
                {index > 0 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0 mx-0.5 select-none" />
                )}
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    if (isCurrent || isBusy || !effectiveStageSelect) return;
                    effectiveStageSelect(stage.id);
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all shrink-0 select-none snap-start min-h-[44px] active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-primary/40 focus:outline-none cursor-pointer",
                    isCurrent && !isWon && !isLost && "bg-primary text-primary-foreground shadow-sm",
                    isCurrent && isWon && "bg-emerald-600 text-white shadow-sm",
                    isCurrent && isLost && "bg-rose-600 text-white shadow-sm",
                    isCompleted && "bg-muted/70 text-foreground hover:bg-muted border border-border/40",
                    isUpcoming && "bg-background border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/40",
                    isBusy && "pointer-events-none opacity-60"
                  )}
                  title={`Stage: ${stage.name}`}
                  aria-label={`Advance to ${stage.name}`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCurrent ? (
                    isBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CircleDot className="h-3.5 w-3.5 animate-pulse" />
                    )
                  ) : isCompleted ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 stroke-[3]" />
                  ) : (
                    <span 
                      className="h-2 w-2 rounded-full shrink-0" 
                      style={{ backgroundColor: stage.color || '#94a3b8' }} 
                    />
                  )}
                  <span className="truncate max-w-[140px] sm:max-w-[180px]">{stage.name}</span>
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Status Outcome Quick Selector */}
        {effectiveStatusChange && (
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center border-t sm:border-t-0 pt-2 sm:pt-0 border-border/40">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  className={cn(
                    "min-h-[44px] sm:min-h-[38px] px-3.5 rounded-xl font-bold text-xs gap-2 border shadow-xs active:scale-[0.97] transition-all cursor-pointer",
                    isWon && "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20",
                    isLost && "bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20",
                    !isWon && !isLost && "border-border text-foreground hover:bg-muted/50"
                  )}
                >
                  {isWon ? (
                    <>
                      <Trophy className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Closed Won</span>
                    </>
                  ) : isLost ? (
                    <>
                      <XCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      <span>Closed Lost</span>
                    </>
                  ) : (
                    <>
                      <span className="h-2 w-2 rounded-full bg-blue-500 shrink-0" />
                      <span>Open Deal</span>
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-2xl w-44 p-1.5 z-[150]">
                {(!isWon || isLost) && (
                  <DropdownMenuItem
                    onClick={() => effectiveStatusChange('won')}
                    className="flex items-center gap-2 rounded-xl p-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10 cursor-pointer min-h-[40px]"
                  >
                    <Trophy className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mark Closed Won</span>
                  </DropdownMenuItem>
                )}
                {(!isLost || isWon) && (
                  <DropdownMenuItem
                    onClick={() => effectiveStatusChange('lost')}
                    className="flex items-center gap-2 rounded-xl p-2 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/10 cursor-pointer min-h-[40px]"
                  >
                    <XCircle className="h-3.5 w-3.5 text-rose-600" />
                    <span>Mark Closed Lost</span>
                  </DropdownMenuItem>
                )}
                {(isWon || isLost) && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => effectiveStatusChange('open')}
                      className="flex items-center gap-2 rounded-xl p-2 text-xs font-bold text-foreground hover:bg-muted cursor-pointer min-h-[40px]"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-primary" />
                      <span>Reopen as Active</span>
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
