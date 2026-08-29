/**
 * @fileoverview Mobile Segmented Stage Switcher & Quick Navigation Bar
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 123 & Rule 7):
 * - Mobile-only horizontal stage navigator for rapid column switching on touch screens.
 * - Displays active stage pills with stage colors, names, and deal counters.
 * - Meets 44x44px minimum touch target requirements for accessibility.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Optimized for mobile viewports (< 768px).
 */

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import type { OnboardingStage, Deal } from '@/lib/types';

interface MobileStageSwitcherProps {
  stages: OnboardingStage[];
  deals: Deal[];
  activeStageId: string | null;
  onSelectStage: (stageId: string) => void;
}

export default function MobileStageSwitcher({
  stages,
  deals,
  activeStageId,
  onSelectStage,
}: MobileStageSwitcherProps) {
  if (!stages || stages.length === 0) return null;

  return (
    <div className="md:hidden shrink-0 mb-3 px-1">
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {stages.map(stage => {
          const isActive = stage.id === activeStageId;
          const stageDealsCount = deals.filter(d => !d.isArchived && d.stageId === stage.id).length;

          return (
            <button
              key={stage.id}
              type="button"
              onClick={() => onSelectStage(stage.id)}
              className={cn(
                'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition-all min-h-[44px] select-none border',
                isActive
                  ? 'bg-card border-primary text-foreground shadow-xs ring-1 ring-primary/20'
                  : 'bg-muted/40 border-border/50 text-muted-foreground hover:bg-muted/70 hover:text-foreground'
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: stage.color || '#3b82f6' }}
              />
              <span className="truncate max-w-[130px]">{stage.name}</span>
              <span
                className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-background text-muted-foreground border border-border/60'
                )}
              >
                {stageDealsCount}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
