'use client';

/**
 * {{Org_name}} Experience Platform — Block Insert Button & Quick Block Picker Popover
 *
 * Touch-friendly, accessible "+ Add Block" button and hover line.
 * Features an integrated Quick Block Picker Popover:
 * - 1-tap insertion of core editorial blocks (Text, Title, Image, Video, Callout, Checklist, FAQ, etc.).
 * - Instant in-situ search filter for blocks.
 * - Deep link to open the full left sidebar palette.
 * - Anchored popover rendered via Radix Portal to prevent any container clipping.
 *
 * Conforms to:
 * - `emilkowal-animations`: `active:scale-[0.97]`, duration <= 200ms.
 * - Mobile ergonomics: `min-h-[44px]` touch targets.
 * - Zero `any` or `any[]` typing.
 */

import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Type,
  Heading,
  Image as ImageIcon,
  Video,
  AlertCircle,
  ListChecks,
  HelpCircle,
  Columns as ColumnsIcon,
  Minus,
  Download,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PageBlockType } from '@/lib/types';
import {
  getContentStudioBlocks,
  type AnyBlockDefinition,
} from '@/lib/page-builder/registry';

export interface BlockInsertButtonProps {
  /** Index position where a new block will be inserted */
  index: number;
  /** Callback when user selects a block type to insert */
  onInsertBlockType?: (type: PageBlockType, index: number) => void;
  /** Fallback callback when user requests insertion */
  onInsert?: (index: number) => void;
  /** Callback to open the full left sidebar palette */
  onOpenFullPalette?: (index: number) => void;
  /** Optional custom label (defaults to "Add Block") */
  label?: string;
  /** Whether the line should always remain visible (e.g. at the bottom or top of canvas) */
  alwaysVisible?: boolean;
  className?: string;
}

interface QuickBlockOption {
  type: PageBlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  tag?: string;
}

const QUICK_BLOCKS: QuickBlockOption[] = [
  {
    type: 'text',
    label: 'Text / Paragraph',
    description: 'Formatted prose, bullet lists, and links',
    icon: Type,
  },
  {
    type: 'title',
    label: 'Heading / Title',
    description: 'Section headline with optional badge',
    icon: Heading,
  },
  {
    type: 'image',
    label: 'Image / Figure',
    description: 'High-res image with optional caption',
    icon: ImageIcon,
  },
  {
    type: 'video',
    label: 'Video Lecture',
    description: 'YouTube, Vimeo, Wistia or MP4 embed',
    icon: Video,
  },
  {
    type: 'procedure_list',
    label: 'Checklist / Steps',
    description: 'Numbered steps and actionable tasks',
    icon: ListChecks,
  },
  {
    type: 'faq',
    label: 'FAQ Accordion',
    description: 'Expandable questions and answers',
    icon: HelpCircle,
  },
  {
    type: 'columns',
    label: '2-Column Grid',
    description: 'Side-by-side content columns',
    icon: ColumnsIcon,
  },
  {
    type: 'divider',
    label: 'Divider Line',
    description: 'Subtle section separator',
    icon: Minus,
  },
];

export const BlockInsertButton = React.memo(function BlockInsertButton({
  index,
  onInsertBlockType,
  onInsert,
  onOpenFullPalette,
  label = 'Add Block',
  alwaysVisible = false,
  className,
}: BlockInsertButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allStudioBlocks = useMemo(() => getContentStudioBlocks(), []);

  // Filtered blocks based on search
  const filteredBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;

    return allStudioBlocks.filter((def) => {
      const labelMatch = def.label.toLowerCase().includes(q);
      const typeMatch = def.type.toLowerCase().includes(q);
      const catMatch = def.category.toLowerCase().includes(q);
      return labelMatch || typeMatch || catMatch;
    });
  }, [searchQuery, allStudioBlocks]);

  const handleSelectType = (blockType: PageBlockType) => {
    setIsOpen(false);
    setSearchQuery('');
    if (onInsertBlockType) {
      onInsertBlockType(blockType, index);
    } else if (onInsert) {
      onInsert(index);
    }
  };

  const handleOpenFullSidebar = () => {
    setIsOpen(false);
    setSearchQuery('');
    if (onOpenFullPalette) {
      onOpenFullPalette(index);
    } else if (onInsert) {
      onInsert(index);
    }
  };

  return (
    <div
      className={cn(
        'group/insert relative flex items-center justify-center transition-all duration-200',
        alwaysVisible ? 'my-2.5 opacity-100' : 'h-4 -my-2 opacity-0 hover:opacity-100 focus-within:opacity-100',
        className
      )}
    >
      {/* Subtle guide line */}
      <div
        className={cn(
          'absolute inset-x-4 h-px transition-colors',
          alwaysVisible
            ? 'bg-slate-200/80 dark:bg-slate-800/80'
            : 'bg-transparent group-hover/insert:bg-[var(--portal-primary,#3B82F6)]/30'
        )}
      />

      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`${label} at position ${index + 1}`}
            className={cn(
              'relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
              'min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-0', // Mobile touch target assurance
              'bg-background border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 shadow-xs',
              'hover:border-[var(--portal-primary,#3B82F6)] hover:text-[var(--portal-primary,#3B82F6)] hover:bg-slate-50 dark:hover:bg-slate-900',
              'active:scale-[0.97] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)]',
              isOpen && 'border-[var(--portal-primary,#3B82F6)] text-[var(--portal-primary,#3B82F6)] ring-2 ring-[var(--portal-primary,#3B82F6)]/20'
            )}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="center"
          side="bottom"
          sideOffset={8}
          className="w-80 sm:w-96 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-card text-card-foreground shadow-2xl z-[10000] space-y-3 animate-in zoom-in-95 duration-150"
        >
          {/* Popover Header & Search */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[var(--portal-primary,#3B82F6)]" />
                <span>Insert Content Block</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Position {index + 1}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search blocks (text, image, video)..."
                className="w-full h-8 pl-8 pr-3 rounded-xl bg-slate-100/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] transition-all"
              />
            </div>
          </div>

          {/* Block Selection Grid */}
          <div className="max-h-64 overflow-y-auto space-y-1 pr-1">
            {filteredBlocks ? (
              filteredBlocks.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No matching blocks found for &quot;{searchQuery}&quot;.
                </div>
              ) : (
                filteredBlocks.map((def: AnyBlockDefinition) => {
                  const Icon = def.icon || Type;
                  return (
                    <button
                      key={def.type}
                      type="button"
                      onClick={() => handleSelectType(def.type)}
                      className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-[0.98] transition-all group/item min-h-[44px]"
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover/item:bg-[var(--portal-primary,#3B82F6)]/10 group-hover/item:text-[var(--portal-primary,#3B82F6)] shrink-0 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold text-foreground truncate">
                          {def.label}
                        </div>
                        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                          {def.category}
                        </div>
                      </div>
                    </button>
                  );
                })
              )
            ) : (
              QUICK_BLOCKS.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => handleSelectType(opt.type)}
                    className="w-full flex items-center gap-3 p-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800/80 active:scale-[0.98] transition-all group/item min-h-[44px]"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover/item:bg-[var(--portal-primary,#3B82F6)]/10 group-hover/item:text-[var(--portal-primary,#3B82F6)] shrink-0 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground truncate">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {opt.description}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer: Browse Full Palette in Sidebar */}
          <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={handleOpenFullSidebar}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all min-h-[36px]"
            >
              <Layers className="w-3.5 h-3.5 text-[var(--portal-primary,#3B82F6)]" />
              <span>Browse all blocks in sidebar</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
