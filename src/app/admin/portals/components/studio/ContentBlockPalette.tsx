'use client';

/**
 * {{Org_name}} Experience Platform — Content Block Palette
 *
 * Authoring palette displaying modular content blocks grouped into 5 everyday
 * plain-English categories:
 * 1. Text & Headings
 * 2. Media & Forms
 * 3. Steps, Lists & FAQs
 * 4. Layout Containers
 * 5. Callouts & Quotes
 *
 * Features:
 * - Real-time instantaneous search filter across block labels, categories, and descriptions.
 * - Mobile ergonomics: `min-h-[44px]` tap targets.
 * - Emil Kowal tactile animation: `active:scale-[0.97]`.
 * - Clean UI avoiding generic AI aesthetics (`frontend-design`).
 * - Zero `any` or `any[]` typing.
 */

import React, { useState, useMemo } from 'react';
import { Search, X, Layers, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PageBlockType } from '@/lib/types';
import '@/lib/page-builder/blocks'; // Ensure all block schemas are registered
import {
  getBlock,
  normalizeBlockType,
  getContentStudioBlockCategories,
  getContentStudioBlocks,
  type AnyBlockDefinition,
} from '@/lib/page-builder/registry';

export interface ContentBlockPaletteProps {
  onSelectBlockType: (type: PageBlockType) => void;
  onClose?: () => void;
  className?: string;
}

export const ContentBlockPalette = React.memo(function ContentBlockPalette({
  onSelectBlockType,
  onClose,
  className,
}: ContentBlockPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const categories = useMemo(() => getContentStudioBlockCategories(), []);
  const allStudioBlocks = useMemo(() => getContentStudioBlocks(), []);

  // Filtered blocks when searching
  const filteredBlocks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return null;

    return allStudioBlocks.filter((def) => {
      const labelMatch = def.label.toLowerCase().includes(query);
      const typeMatch = def.type.toLowerCase().includes(query);
      const categoryMatch = def.category.toLowerCase().includes(query);
      return labelMatch || typeMatch || categoryMatch;
    });
  }, [searchQuery, allStudioBlocks]);

  return (
    <div
      className={cn(
        'flex flex-col h-full bg-background border-r border-slate-200 dark:border-slate-800 select-none',
        className
      )}
    >
      {/* Palette Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--portal-primary,#3B82F6)]/10 text-[var(--portal-primary,#3B82F6)]">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground tracking-tight">Block Palette</h3>
              <p className="text-[11px] text-muted-foreground">Click to insert into document</p>
            </div>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close palette"
              className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 active:scale-[0.97] transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search input with accessible touch target */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search blocks (e.g. video, quote, checklist)..."
            className="w-full h-10 pl-9 pr-8 rounded-xl bg-slate-100/70 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--portal-primary,#3B82F6)] focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Palette Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {filteredBlocks !== null ? (
          /* Search Results */
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Matching Blocks</span>
              <span>{filteredBlocks.length} found</span>
            </div>

            {filteredBlocks.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <p className="text-xs text-muted-foreground font-medium">No blocks match your search.</p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-xs font-semibold text-[var(--portal-primary,#3B82F6)] hover:underline"
                >
                  Clear search
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {filteredBlocks.map((def) => (
                  <PaletteBlockButton
                    key={def.type}
                    def={def}
                    onSelect={() => onSelectBlockType(def.type)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Categorized Sections */
          categories.map((group) => {
            const groupBlocks = group.types
              .map((type) => getBlock(normalizeBlockType(type)))
              .filter((def): def is AnyBlockDefinition => Boolean(def));

            if (groupBlocks.length === 0) return null;

            return (
              <div key={group.category} className="space-y-2.5">
                <div>
                  <h4 className="text-xs font-bold text-foreground tracking-tight flex items-center gap-1.5">
                    <span>{group.label}</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">{group.description}</p>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {groupBlocks.map((def) => (
                    <PaletteBlockButton
                      key={def.type}
                      def={def}
                      onSelect={() => onSelectBlockType(def.type)}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

interface PaletteBlockButtonProps {
  def: AnyBlockDefinition;
  onSelect: () => void;
}

const PaletteBlockButton = React.memo(function PaletteBlockButton({
  def,
  onSelect,
}: PaletteBlockButtonProps) {
  const Icon = def.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group flex items-center gap-3 w-full p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800/80',
        'bg-card/70 hover:bg-slate-50 dark:hover:bg-slate-900',
        'hover:border-[var(--portal-primary,#3B82F6)]/50 hover:shadow-sm',
        'active:scale-[0.97] transition-all text-left min-h-[44px]'
      )}
    >
      <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 group-hover:bg-[var(--portal-primary,#3B82F6)]/10 group-hover:text-[var(--portal-primary,#3B82F6)] transition-colors">
        {Icon ? <Icon className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-foreground group-hover:text-[var(--portal-primary,#3B82F6)] transition-colors truncate">
          {def.label}
        </div>
        <div className="text-[10px] text-muted-foreground capitalize truncate">
          {def.category} block
        </div>
      </div>
    </button>
  );
});
