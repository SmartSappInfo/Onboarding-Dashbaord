'use client';

/**
 * {{Org_name}} Experience Platform — Content Block Canvas
 *
 * Lightweight, 60fps drag-and-drop sortable canvas for Portal Content Studio.
 * Directly integrates Page Builder's SortableContext and BlockRenderer without
 * heavy landing-page chrome (no floating header controls or parallax zoom).
 *
 * Features:
 * - Empty state with 1-click starter template hydration (Standard Article, Lesson, Vault, KB).
 * - Mobile-first drag sensors: PointerSensor with 5px constraint, TouchSensor with 150ms delay.
 * - 1-tap Move Up / Move Down buttons for accessible reordering without dragging.
 * - Inter-block "+ Add Block" hover line insertions.
 * - Deep ID regeneration on duplication to guarantee valid dnd keys.
 * - Memoized render context and `contain-intrinsic-size` virtualization safety for 100+ blocks.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`.
 * - `vercel-react-best-practices`: Memoized callbacks, stable dependencies.
 * - Strict Typing: Zero `any`, zero `any[]`.
 */

import React, { useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import {
  Plus,
  Sparkles,
  FileText,
  GraduationCap,
  Download,
  BookOpen,
  Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageBlock, BuilderResources, ResolvedTheme } from '@/lib/types';
import { DEFAULT_THEME } from '@/lib/page-builder/resolve-theme';
import type { BlockRenderContext } from '@/lib/page-builder/registry';
import {
  CONTENT_STARTER_TEMPLATES,
  instantiateContentTemplate,
} from '@/lib/page-builder/templates/content-templates';
import { SortableBlockItem } from './SortableBlockItem';
import { BlockInsertButton } from './BlockInsertButton';

export interface ContentBlockCanvasProps {
  blocks: PageBlock[];
  selectedBlockId: string | null;
  onSelectBlock: (id: string | null) => void;
  onChangeBlocks: (blocks: PageBlock[]) => void;
  onInsertAtIndex: (index: number) => void;
  resources?: BuilderResources;
  workspaceId?: string;
  portalPrimaryColor?: string;
  className?: string;
}

const DEFAULT_RESOURCES: BuilderResources = {
  forms: [],
  surveys: [],
  agreements: [],
  meetings: [],
  qrCodes: [],
};

/** Deep clone block and assign freshly generated unique IDs */
function deepCloneBlockWithNewIds(block: PageBlock): PageBlock {
  const uniqueSuffix = Math.random().toString(36).slice(2, 8);
  const newId = `blk_${block.type}_${Date.now()}_${uniqueSuffix}`;
  return {
    ...block,
    id: newId,
    props: JSON.parse(JSON.stringify(block.props ?? {})),
    blocks: block.blocks ? block.blocks.map(deepCloneBlockWithNewIds) : undefined,
  };
}

export const ContentBlockCanvas = React.memo(function ContentBlockCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onChangeBlocks,
  onInsertAtIndex,
  resources = DEFAULT_RESOURCES,
  workspaceId,
  portalPrimaryColor,
  className,
}: ContentBlockCanvasProps) {
  // Configured sensors: Pointer constraint protects clicks; touch delay protects scrolling
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 150,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, touchSensor, keyboardSensor);

  // Memoized effective theme
  const effectiveTheme: ResolvedTheme = useMemo(() => {
    return {
      ...DEFAULT_THEME,
      colors: {
        ...DEFAULT_THEME.colors,
        primary: portalPrimaryColor || DEFAULT_THEME.colors.primary,
      },
      typography: {
        headingFont: 'Figtree, sans-serif',
        bodyFont: 'Figtree, sans-serif',
        baseSize: '16px',
      },
    };
  }, [portalPrimaryColor]);

  // Handle inline property changes
  const handlePropChange = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedBlockId) return;
      const updated = blocks.map((b) => {
        if (b.id === selectedBlockId) {
          return {
            ...b,
            props: { ...b.props, ...patch },
          };
        }
        return b;
      });
      onChangeBlocks(updated);
    },
    [blocks, selectedBlockId, onChangeBlocks]
  );

  // Memoized render context for BlockRenderer
  const renderCtx: BlockRenderContext = useMemo(() => {
    return {
      mode: 'edit',
      theme: effectiveTheme,
      interpolate: (text: string) => text,
      resources,
      onPropChange: handlePropChange,
    };
  }, [effectiveTheme, resources, handlePropChange]);

  // Drag End handler
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = blocks.findIndex((b) => b.id === active.id);
      const newIndex = blocks.findIndex((b) => b.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reordered = arrayMove(blocks, oldIndex, newIndex);
        onChangeBlocks(reordered);
      }
    },
    [blocks, onChangeBlocks]
  );

  // 1-tap Move Up / Move Down
  const handleMove = useCallback(
    (index: number, direction: 'up' | 'down') => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= blocks.length) return;
      const reordered = arrayMove(blocks, index, targetIndex);
      onChangeBlocks(reordered);
    },
    [blocks, onChangeBlocks]
  );

  // Duplicate with fresh unique ID
  const handleDuplicate = useCallback(
    (index: number) => {
      const target = blocks[index];
      if (!target) return;
      const cloned = deepCloneBlockWithNewIds(target);
      const nextBlocks = [...blocks];
      nextBlocks.splice(index + 1, 0, cloned);
      onChangeBlocks(nextBlocks);
      onSelectBlock(cloned.id);
    },
    [blocks, onChangeBlocks, onSelectBlock]
  );

  // Delete Block
  const handleDelete = useCallback(
    (index: number) => {
      const target = blocks[index];
      if (!target) return;
      const nextBlocks = blocks.filter((_, i) => i !== index);
      onChangeBlocks(nextBlocks);
      if (selectedBlockId === target.id) {
        const fallback = nextBlocks[index] ?? nextBlocks[index - 1] ?? null;
        onSelectBlock(fallback ? fallback.id : null);
      }
    },
    [blocks, selectedBlockId, onChangeBlocks, onSelectBlock]
  );

  // Starter Template Apply Handler
  const handleApplyTemplate = useCallback(
    (templateId: string) => {
      const newBlocks = instantiateContentTemplate(templateId);
      onChangeBlocks(newBlocks);
      if (newBlocks.length > 0) {
        onSelectBlock(newBlocks[0].id);
      }
    },
    [onChangeBlocks, onSelectBlock]
  );

  // Start Blank Document Handler
  const handleStartBlank = useCallback(() => {
    onInsertAtIndex(0);
  }, [onInsertAtIndex]);

  const blockIds = useMemo(() => blocks.map((b) => b.id), [blocks]);

  // Empty State: Render Starter Template Cards
  if (blocks.length === 0) {
    return (
      <div className={cn('max-w-4xl mx-auto py-8 sm:py-12 px-4 space-y-8', className)}>
        {/* Empty State Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive Starter Layouts</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            How would you like to start?
          </h2>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Choose a pre-structured template crafted for professional articles, lessons, and
            downloads, or start with a blank canvas.
          </p>
        </div>

        {/* 4 Template Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {CONTENT_STARTER_TEMPLATES.map((tpl) => {
            const getIcon = () => {
              switch (tpl.id) {
                case 'article-standard-starter':
                  return FileText;
                case 'lesson-curriculum-starter':
                  return GraduationCap;
                case 'resource-download-starter':
                  return Download;
                case 'documentation-kb-starter':
                  return BookOpen;
                default:
                  return Layers;
              }
            };
            const Icon = getIcon();

            return (
              <div
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl.id)}
                className="group relative flex flex-col justify-between p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card hover:border-[var(--portal-primary,#3B82F6)] hover:shadow-lg hover:shadow-[var(--portal-primary,#3B82F6)]/5 transition-all duration-200 cursor-pointer active:scale-[0.98]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-[var(--portal-primary,#3B82F6)] group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {tpl.blocks.length} Blocks
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground group-hover:text-[var(--portal-primary,#3B82F6)] transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {tpl.description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-[var(--portal-primary,#3B82F6)]">
                  <span>Use this layout</span>
                  <span className="text-sm font-bold group-hover:translate-x-0.5 transition-transform">
                    &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Blank Slate Option */}
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={handleStartBlank}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Start with a blank canvas</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectBlock(null)}
      className={cn('relative min-h-[500px] pb-32 focus:outline-none', className)}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          {/* Top Insert Button (index 0) */}
          <BlockInsertButton
            index={0}
            onInsert={onInsertAtIndex}
            label="Insert Block at Top"
          />

          {/* Render Sortable Blocks */}
          <div className="space-y-2">
            {blocks.map((block, index) => (
              <React.Fragment key={block.id}>
                <SortableBlockItem
                  block={block}
                  index={index}
                  total={blocks.length}
                  selected={selectedBlockId === block.id}
                  ctx={renderCtx}
                  onSelect={onSelectBlock}
                  onMove={handleMove}
                  onDuplicate={handleDuplicate}
                  onDelete={handleDelete}
                />

                {/* Inter-block Insert Button */}
                <BlockInsertButton
                  index={index + 1}
                  onInsert={onInsertAtIndex}
                />
              </React.Fragment>
            ))}
          </div>

          {/* Canvas Bottom Quick Add Trigger */}
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              onClick={() => onInsertAtIndex(blocks.length)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-[var(--portal-primary,#3B82F6)] hover:text-[var(--portal-primary,#3B82F6)] text-xs font-semibold text-muted-foreground bg-card/50 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-[0.97] transition-all min-h-[44px]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Block to End</span>
            </button>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
});
