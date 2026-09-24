'use client';

/**
 * {{Org_name}} Experience Platform — Sortable Block Item
 *
 * Wraps an individual PageBlock on the Content Studio canvas with:
 * - @dnd-kit/sortable drag-and-drop reordering.
 * - Suppressed pointer events on nested iframes/media during drag to prevent drag-loss.
 * - Quick-action toolbar: Drag grip handle, 1-tap Move Up / Move Down (mobile ergonomics),
 *   Duplicate with deep ID regeneration, Delete, and selected focus ring.
 * - Performance: Memoized via React.memo; contains-intrinsic-size CSS optimization for 100+ blocks.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`, duration <= 200ms.
 * - `frontend-design`: Figtree typography, clean borders, high-contrast badges.
 * - Monorepo strict typing: Zero `any` or `any[]`.
 *
 * Caution:
 * - Child block clicks inside the renderer should not swallow editor selection.
 * - During active drag, nested iframes (e.g. YouTube video embeds) must have pointer-events: none,
 *   otherwise the browser captures mouse events and cancels the drag operation prematurely.
 */

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Copy,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageBlock } from '@/lib/types';
import { getBlock, normalizeBlockType, type BlockRenderContext } from '@/lib/page-builder/registry';
import { BlockRenderer } from '@/components/page-builder/BlockRenderer';

export interface SortableBlockItemProps {
  block: PageBlock;
  index: number;
  total: number;
  selected: boolean;
  ctx: BlockRenderContext;
  onSelect: (blockId: string) => void;
  onMove: (index: number, direction: 'up' | 'down') => void;
  onDuplicate: (index: number) => void;
  onDelete: (index: number) => void;
  disabled?: boolean;
}

export const SortableBlockItem = React.memo(function SortableBlockItem({
  block,
  index,
  total,
  selected,
  ctx,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  disabled = false,
}: SortableBlockItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    disabled,
  });

  const canonicalType = normalizeBlockType(block.type);
  const blockDef = getBlock(canonicalType);
  const IconComponent = blockDef?.icon;
  const blockLabel = blockDef?.label || block.type.replace(/_/g, ' ');

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    contentVisibility: 'auto',
    containIntrinsicSize: '1px 120px',
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(block.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleContainerClick}
      aria-label={`Block ${index + 1} of ${total}: ${blockLabel}`}
      className={cn(
        'group/block relative rounded-xl transition-all duration-150',
        'border border-dashed border-slate-200 dark:border-slate-800',
        'hover:border-slate-400 dark:hover:border-slate-600',
        'bg-card text-card-foreground',
        selected &&
          'ring-2 ring-[var(--portal-primary,#3B82F6)] border-[var(--portal-primary,#3B82F6)]/60 bg-[var(--portal-primary,#3B82F6)]/[0.015] shadow-sm',
        isDragging && 'z-50 shadow-2xl ring-2 ring-[var(--portal-primary,#3B82F6)] bg-background'
      )}
    >
      {/* Top Floating Control Bar */}
      <div
        className={cn(
          'absolute -top-3.5 left-3 right-3 flex items-center justify-between pointer-events-none z-20 transition-opacity duration-150',
          selected
            ? 'opacity-100'
            : 'opacity-0 group-hover/block:opacity-100 group-focus-within/block:opacity-100'
        )}
      >
        {/* Block Type Badge */}
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-sm pointer-events-auto">
          {IconComponent && <IconComponent className="w-3 h-3 text-emerald-400 dark:text-emerald-600" />}
          <span>{blockLabel}</span>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-background/95 backdrop-blur-sm border border-slate-200 dark:border-slate-800 shadow-md pointer-events-auto">
          {/* Drag Handle */}
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={`Drag to reorder ${blockLabel}`}
            title="Drag to reorder"
            className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 rounded text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-grab active:cursor-grabbing transition-colors focus:outline-none focus:ring-1 focus:ring-[var(--portal-primary,#3B82F6)]"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </button>

          {/* Move Up */}
          <button
            type="button"
            disabled={index === 0}
            onClick={(e) => {
              e.stopPropagation();
              onMove(index, 'up');
            }}
            aria-label="Move block up"
            title="Move block up"
            className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 rounded text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-[0.97] transition-all focus:outline-none focus:ring-1 focus:ring-[var(--portal-primary,#3B82F6)]"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>

          {/* Move Down */}
          <button
            type="button"
            disabled={index === total - 1}
            onClick={(e) => {
              e.stopPropagation();
              onMove(index, 'down');
            }}
            aria-label="Move block down"
            title="Move block down"
            className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 rounded text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 disabled:pointer-events-none active:scale-[0.97] transition-all focus:outline-none focus:ring-1 focus:ring-[var(--portal-primary,#3B82F6)]"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate Block */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate(index);
            }}
            aria-label="Duplicate block"
            title="Duplicate block"
            className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 rounded text-slate-500 hover:text-[var(--portal-primary,#3B82F6)] hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all focus:outline-none focus:ring-1 focus:ring-[var(--portal-primary,#3B82F6)]"
          >
            <Copy className="w-3 h-3" />
          </button>

          {/* Delete Block */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(index);
            }}
            aria-label="Delete block"
            title="Delete block"
            className="flex items-center justify-center w-7 h-7 sm:w-6 sm:h-6 rounded text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-[0.97] transition-all focus:outline-none focus:ring-1 focus:ring-red-500"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Block Body Content */}
      <div
        className={cn(
          'p-4 sm:p-5 transition-opacity',
          isDragging && 'pointer-events-none select-none opacity-50'
        )}
      >
        <BlockRenderer block={block} ctx={ctx} />
      </div>
    </div>
  );
});
