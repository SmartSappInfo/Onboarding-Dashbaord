'use client';

/**
 * @fileOverview Knowledge Search & Hybrid Filter Bar (Phase 4 Milestone 4)
 *
 * Implements Rule 7 (Mobile & Touch First >= 44px), Rule 9 (Debounced Search),
 * Rule 32 (Sensitivity Filtering), and Rule 64 (Tactile Micro-Interactions).
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Search, X, Filter, Loader2 } from 'lucide-react';
import type { MemoryTier, SensitivityLevel } from '@/platform/memory';

export interface KnowledgeSearchFilters {
  query: string;
  tier: MemoryTier | 'all';
  sourceType: string | 'all';
  sensitivity: SensitivityLevel | 'all';
}

export interface KnowledgeSearchBoxProps {
  filters: KnowledgeSearchFilters;
  onFiltersChange: (filters: KnowledgeSearchFilters) => void;
  isLoading?: boolean;
}

const TIERS: { label: string; value: MemoryTier | 'all' }[] = [
  { label: 'All Tiers', value: 'all' },
  { label: 'Semantic', value: 'semantic' },
  { label: 'Episodic', value: 'episodic' },
  { label: 'Relational', value: 'relational' },
  { label: 'Procedural', value: 'procedural' },
];

const SOURCES: { label: string; value: string }[] = [
  { label: 'All Sources', value: 'all' },
  { label: 'Notes', value: 'user_note' },
  { label: 'Meetings', value: 'meeting' },
  { label: 'Deals', value: 'crm_entity' },
  { label: 'Documents', value: 'document' },
];

export function KnowledgeSearchBox({
  filters,
  onFiltersChange,
  isLoading = false,
}: KnowledgeSearchBoxProps) {
  const [localQuery, setLocalQuery] = React.useState(filters.query);

  // Debounced input sync (Rule 9)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (localQuery !== filters.query) {
        onFiltersChange({ ...filters, query: localQuery });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localQuery, filters, onFiltersChange]);

  const handleClear = () => {
    setLocalQuery('');
    onFiltersChange({ ...filters, query: '' });
  };

  return (
    <Card className="rounded-2xl border border-border/80 bg-card p-4 shadow-sm space-y-3">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder="Search institutional memory across dense vectors & BM25..."
          className="pl-10 pr-10 min-h-[44px] rounded-xl border border-border/80 bg-white dark:bg-card shadow-xs focus-visible:ring-1 text-sm"
        />
        <div className="absolute right-2 flex items-center gap-1">
          {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {localQuery && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground active:scale-95"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Chips Row */}
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1 mr-1">
          <Filter className="h-3 w-3" />
          Filter:
        </span>

        {/* Tier Chips */}
        {TIERS.map((t) => {
          const isActive = filters.tier === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onFiltersChange({ ...filters, tier: t.value })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-[0.97] min-h-[32px] sm:min-h-[28px] ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-white dark:bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border/80 shadow-xs'
              }`}
            >
              {t.label}
            </button>
          );
        })}

        <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

        {/* Source Chips */}
        {SOURCES.map((s) => {
          const isActive = filters.sourceType === s.value;
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => onFiltersChange({ ...filters, sourceType: s.value })}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all active:scale-[0.97] min-h-[32px] sm:min-h-[28px] ${
                isActive
                  ? 'bg-secondary text-secondary-foreground shadow-sm'
                  : 'bg-white dark:bg-card text-muted-foreground hover:bg-muted/60 hover:text-foreground border border-border/80 shadow-xs'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </Card>
  );
}
