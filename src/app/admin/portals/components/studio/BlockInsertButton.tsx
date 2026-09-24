'use client';

/**
 * {{Org_name}} Experience Platform — Block Insert Button
 *
 * Touch-friendly, accessible "+ Add Block" hover line and button.
 * Placed above, between, and below blocks in the Content Studio canvas.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`, duration <= 200ms.
 * - Mobile ergonomics: `min-h-[44px]` tap target.
 * - Zero `any` / 0 `any[]`.
 */

import React from 'react';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BlockInsertButtonProps {
  /** Index position where a new block will be inserted */
  index: number;
  /** Callback when user clicks the insert button */
  onInsert: (index: number) => void;
  /** Optional custom label (defaults to "Add Block") */
  label?: string;
  /** Whether the line should always remain visible (e.g. at the bottom of canvas or on mobile) */
  alwaysVisible?: boolean;
  className?: string;
}

export const BlockInsertButton = React.memo(function BlockInsertButton({
  index,
  onInsert,
  label = 'Add Block',
  alwaysVisible = false,
  className,
}: BlockInsertButtonProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onInsert(index);
  };

  return (
    <div
      className={cn(
        'group/insert relative flex items-center justify-center my-1 py-1.5 transition-all duration-200',
        alwaysVisible ? 'opacity-100' : 'opacity-0 hover:opacity-100 focus-within:opacity-100',
        className
      )}
    >
      {/* Subtle guide line */}
      <div className="absolute inset-x-4 h-px bg-slate-200 dark:bg-slate-800 transition-colors group-hover/insert:bg-[var(--portal-primary,#3B82F6)]/40" />

      {/* Insert trigger capsule button with min-h-[44px] touch target */}
      <button
        type="button"
        onClick={handleClick}
        aria-label={`Insert block at position ${index + 1}`}
        className={cn(
          'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
          'min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0', // Mobile touch target assurance
          'bg-background border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-sm',
          'hover:border-[var(--portal-primary,#3B82F6)] hover:text-[var(--portal-primary,#3B82F6)] hover:bg-slate-50 dark:hover:bg-slate-900',
          'active:scale-[0.97] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)]'
        )}
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{label}</span>
      </button>
    </div>
  );
});
