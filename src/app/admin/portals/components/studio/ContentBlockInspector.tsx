'use client';

/**
 * {{Org_name}} Experience Platform — Content Block Inspector
 *
 * Dedicated property inspector for Content Studio blocks. Wraps Page Builder's
 * `AutoBlockEditor` to ensure full parity with schema-driven property controls.
 *
 * Performance:
 * - Uses `useDeferredValue` on the active block to decouple high-frequency typing in the
 *   property panel from canvas re-renders (`vercel-react-best-practices`).
 *
 * Capabilities:
 * - Block header with type badge and icon.
 * - Quick actions: Reset to Defaults, Delete Block, Close/Deselect.
 * - Auto-scrollable properties surface.
 * - Friendly empty state when no block is selected.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`.
 * - `frontend-design`: High contrast, responsive touch targets.
 * - Strict Typing: Zero `any`, zero `any[]`.
 */

import React, { useDeferredValue, useCallback } from 'react';
import {
  Sliders,
  RotateCcw,
  Trash2,
  X,
  MousePointerClick,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageBlock, BuilderResources } from '@/lib/types';
import { getBlock, normalizeBlockType } from '@/lib/page-builder/registry';
import { AutoBlockEditor } from '@/components/page-builder/AutoBlockEditor';

export interface ContentBlockInspectorProps {
  selectedBlock: PageBlock | null;
  resources?: BuilderResources;
  workspaceId?: string;
  onUpdateProps: (blockId: string, patch: Record<string, unknown>) => void;
  onDeleteBlock: (blockId: string) => void;
  onDeselect: () => void;
  onResetDefaults?: (blockId: string) => void;
  className?: string;
}

const DEFAULT_RESOURCES: BuilderResources = {
  forms: [],
  surveys: [],
  agreements: [],
  meetings: [],
  qrCodes: [],
};

export const ContentBlockInspector = React.memo(function ContentBlockInspector({
  selectedBlock,
  resources = DEFAULT_RESOURCES,
  workspaceId,
  onUpdateProps,
  onDeleteBlock,
  onDeselect,
  onResetDefaults,
  className,
}: ContentBlockInspectorProps) {
  // Deferred block value avoids canvas lag while typing rapidly in property inputs
  const deferredBlock = useDeferredValue(selectedBlock);

  const blockDef = selectedBlock
    ? getBlock(normalizeBlockType(selectedBlock.type))
    : undefined;
  const Icon = blockDef?.icon;
  const blockLabel = blockDef?.label || selectedBlock?.type.replace(/_/g, ' ') || 'Block';

  const handleReset = useCallback(() => {
    if (!selectedBlock || !blockDef) return;
    if (onResetDefaults) {
      onResetDefaults(selectedBlock.id);
    } else {
      onUpdateProps(selectedBlock.id, blockDef.defaults);
    }
  }, [selectedBlock, blockDef, onResetDefaults, onUpdateProps]);

  const handleDelete = useCallback(() => {
    if (!selectedBlock) return;
    onDeleteBlock(selectedBlock.id);
  }, [selectedBlock, onDeleteBlock]);

  // Empty state when no block is selected
  if (!selectedBlock) {
    return (
      <div
        className={cn(
          'flex flex-col h-full bg-background border-l border-slate-200 dark:border-slate-800 p-6 items-center justify-center text-center select-none',
          className
        )}
      >
        <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-muted-foreground mb-4">
          <MousePointerClick className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-foreground tracking-tight">
          No Block Selected
        </h4>
        <p className="text-xs text-muted-foreground mt-1 max-w-[220px]">
          Click any block on the canvas to configure its content, layout, styling, and options.
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border-l border-slate-200 dark:border-slate-800 select-none',
        className
      )}
    >
      {/* Inspector Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--portal-primary,#3B82F6)]/10 text-[var(--portal-primary,#3B82F6)] shrink-0">
            {Icon ? <Icon className="w-4 h-4" /> : <Sliders className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-bold text-foreground truncate tracking-tight">
              {blockLabel}
            </h3>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Properties
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Reset to Defaults */}
          <button
            type="button"
            onClick={handleReset}
            title="Reset to default settings"
            aria-label="Reset to default settings"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Delete Block */}
          <button
            type="button"
            onClick={handleDelete}
            title="Delete this block"
            aria-label="Delete this block"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.97] transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          {/* Close/Deselect */}
          <button
            type="button"
            onClick={onDeselect}
            title="Deselect block"
            aria-label="Deselect block"
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Inspector Body: AutoBlockEditor */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AutoBlockEditor
          block={deferredBlock}
          resources={resources}
          workspaceId={workspaceId}
          onUpdateProps={onUpdateProps}
        />
      </div>
    </div>
  );
});
