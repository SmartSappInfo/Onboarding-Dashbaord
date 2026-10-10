'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Trophy, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * @fileoverview KanbanTerminalDropBar Component
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION:
 * - Appears as a sleek, floating action dock at the bottom of the Kanban canvas while dragging a deal card.
 * - Provides two dedicated, high-contrast terminal drop zones:
 *   1. "Drop to Won" (Emerald/Green): Closes deal as Won and fires DEAL_WON automations.
 *   2. "Drop to Lost" (Rose/Red): Triggers the Lost Reason workflow and fires DEAL_LOST automations.
 *
 * WORKSPACE RULES & AGENTS MCP RULES COMPLIANCE:
 * - Rule 4: Strict zero 'any' / 'any[]'.
 * - Rule 7: Mobile-first ergonomics with touch targets >= 48px, everyday clear UI English.
 * - Rule 10: Clear inline maintainer guidance and testability pointers.
 * - Emil Kowalski Animations: Smooth slide-up transition upon drag start and slide-down upon drag end.
 *
 * TESTABILITY POINTER:
 * Covered by unit tests in `src/app/admin/pipeline/components/__tests__/KanbanTerminalDropBar.test.tsx`.
 */

export interface KanbanTerminalDropBarProps {
  /** Whether a deal card is currently being dragged across the canvas */
  isVisible: boolean;
  /** Optional name of the deal currently being dragged for screen-reader/contextual cue */
  draggedDealName?: string;
}

export function KanbanTerminalDropBar({
  isVisible,
  draggedDealName,
}: KanbanTerminalDropBarProps) {
  // Terminal Droppable: Closed Won
  const { setNodeRef: setWonRef, isOver: isWonOver } = useDroppable({
    id: 'won-drop-zone',
    data: {
      type: 'TERMINAL_DROP',
      outcome: 'won',
    },
  });

  // Terminal Droppable: Closed Lost
  const { setNodeRef: setLostRef, isOver: isLostOver } = useDroppable({
    id: 'lost-drop-zone',
    data: {
      type: 'TERMINAL_DROP',
      outcome: 'lost',
    },
  });

  return (
    <div
      aria-hidden={!isVisible}
      aria-label="Terminal stage drop targets"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out transform select-none max-w-[94vw]",
        isVisible
          ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
          : "translate-y-12 opacity-0 scale-95 pointer-events-none"
      )}
    >
      <div className="flex items-center gap-2.5 sm:gap-4 p-2 sm:p-2.5 rounded-2xl bg-card/95 backdrop-blur-xl border border-border/80 shadow-2xl">
        {/* Terminal Zone 1: Drop to Won */}
        <div
          ref={setWonRef}
          data-testid="won-drop-zone"
          aria-label={draggedDealName ? `Drop ${draggedDealName} to Mark as Won` : "Drop to Mark as Won"}
          className={cn(
            "min-h-[52px] sm:min-h-[58px] min-w-[145px] sm:min-w-[210px] px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2.5 sm:gap-3 transition-all duration-200 cursor-pointer",
            isWonOver
              ? "border-2 border-emerald-500 bg-emerald-500/25 ring-4 ring-emerald-500/30 scale-[1.03] shadow-lg text-emerald-950 dark:text-emerald-100"
              : "border-2 border-dashed border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15"
          )}
        >
          <div
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
              isWonOver
                ? "bg-emerald-500 text-white shadow-md animate-bounce"
                : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
            )}
          >
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-xs sm:text-sm font-bold tracking-tight leading-tight truncate">
              {isWonOver ? "Release to Win! 🎉" : "Drop to Won"}
            </span>
            <span className="text-[10px] opacity-80 font-medium truncate hidden sm:inline">
              Close deal won & run workflows
            </span>
          </div>
        </div>

        {/* Terminal Zone 2: Drop to Lost */}
        <div
          ref={setLostRef}
          data-testid="lost-drop-zone"
          aria-label={draggedDealName ? `Drop ${draggedDealName} to Mark as Lost` : "Drop to Mark as Lost"}
          className={cn(
            "min-h-[52px] sm:min-h-[58px] min-w-[145px] sm:min-w-[210px] px-3 sm:px-4 py-2 rounded-xl flex items-center gap-2.5 sm:gap-3 transition-all duration-200 cursor-pointer",
            isLostOver
              ? "border-2 border-rose-500 bg-rose-500/25 ring-4 ring-rose-500/30 scale-[1.03] shadow-lg text-rose-950 dark:text-rose-100"
              : "border-2 border-dashed border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300 hover:bg-rose-500/15"
          )}
        >
          <div
            className={cn(
              "h-8 w-8 sm:h-9 sm:w-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
              isLostOver
                ? "bg-rose-500 text-white shadow-md animate-bounce"
                : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
            )}
          >
            <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="flex flex-col min-w-0 text-left">
            <span className="text-xs sm:text-sm font-bold tracking-tight leading-tight truncate">
              {isLostOver ? "Release to Lose" : "Drop to Lost"}
            </span>
            <span className="text-[10px] opacity-80 font-medium truncate hidden sm:inline">
              Close deal lost & log reason
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KanbanTerminalDropBar;
