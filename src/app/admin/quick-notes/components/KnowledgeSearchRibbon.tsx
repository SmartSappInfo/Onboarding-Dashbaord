'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Search,
  Sparkles,
  SlidersHorizontal,
  X,
  FileText,
  Phone,
  Calendar,
  ListTodo,
  CheckCircle2,
  Lightbulb,
  MessageSquareQuote,
  Eye,
  CheckSquare,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { KnowledgeType, UnifiedNoteSource, NoteSentiment } from '@/lib/quick-notes-types';

export interface KnowledgeSearchRibbonProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedSource: 'all' | UnifiedNoteSource;
  onSourceChange: (source: 'all' | UnifiedNoteSource) => void;
  selectedType: 'all' | KnowledgeType;
  onTypeChange: (type: 'all' | KnowledgeType) => void;
  selectedSentiment?: 'all' | NoteSentiment;
  onSentimentChange?: (sentiment: 'all' | NoteSentiment) => void;
  onOpenAskModal: () => void;
  totalResultsCount?: number;
}

const SOURCES: Array<{ id: 'all' | UnifiedNoteSource; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All Sources', icon: <SlidersHorizontal className="h-3 w-3" /> },
  { id: 'quick_note', label: 'Notes', icon: <FileText className="h-3 w-3 text-blue-500" /> },
  { id: 'entity_note', label: 'Entities', icon: <FileText className="h-3 w-3 text-emerald-500" /> },
  { id: 'call_note', label: 'Calls', icon: <Phone className="h-3 w-3 text-violet-500" /> },
  { id: 'task_note', label: 'Tasks', icon: <ListTodo className="h-3 w-3 text-rose-500" /> },
];

const TYPES: Array<{ id: 'all' | KnowledgeType; label: string; icon: React.ReactNode }> = [
  { id: 'all', label: 'All Types', icon: <SlidersHorizontal className="h-3 w-3" /> },
  { id: 'note', label: 'Note', icon: <FileText className="h-3 w-3 text-slate-500" /> },
  { id: 'idea', label: 'Idea', icon: <Lightbulb className="h-3 w-3 text-amber-500" /> },
  { id: 'insight', label: 'Insight', icon: <Sparkles className="h-3 w-3 text-violet-500" /> },
  { id: 'decision', label: 'Decision', icon: <CheckCircle2 className="h-3 w-3 text-emerald-500" /> },
  { id: 'feedback', label: 'Feedback', icon: <MessageSquareQuote className="h-3 w-3 text-sky-500" /> },
  { id: 'observation', label: 'Observation', icon: <Eye className="h-3 w-3 text-indigo-500" /> },
  { id: 'action', label: 'Action', icon: <CheckSquare className="h-3 w-3 text-rose-500" /> },
];

export function KnowledgeSearchRibbon({
  searchQuery,
  onSearchChange,
  selectedSource,
  onSourceChange,
  selectedType,
  onTypeChange,
  onOpenAskModal,
  totalResultsCount,
}: KnowledgeSearchRibbonProps) {
  const [showFilters, setShowFilters] = React.useState(false);

  const hasActiveFilters = selectedSource !== 'all' || selectedType !== 'all' || searchQuery.trim().length > 0;

  const handleResetFilters = () => {
    onSearchChange('');
    onSourceChange('all');
    onTypeChange('all');
  };

  return (
    <div className="w-full space-y-3 bg-card border border-border/70 rounded-xl p-3 md:p-4 shadow-sm">
      {/* Search Input Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes, ideas, decisions, or press ⌘K..."
            aria-label="Search organizational knowledge"
            className="pl-9 pr-8 text-sm min-h-[44px] md:min-h-[40px] bg-background border-border/80 focus-visible:ring-violet-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="min-h-[44px] md:min-h-[40px] gap-1.5 text-xs shrink-0"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Filters</span>
            {hasActiveFilters && (
              <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-violet-100 dark:bg-violet-900/60 text-violet-700 dark:text-violet-300">
                Active
              </Badge>
            )}
          </Button>

          <Link href="/admin/quick-notes/search">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-[44px] md:min-h-[40px] text-xs gap-1.5 shrink-0 border-violet-200 dark:border-violet-900/50 hover:bg-violet-50 dark:hover:bg-violet-950/40 text-violet-700 dark:text-violet-300 active:scale-[0.97] transition-transform"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Semantic Search</span>
            </Button>
          </Link>

          <Button
            type="button"
            size="sm"
            onClick={onOpenAskModal}
            className="min-h-[44px] md:min-h-[40px] bg-violet-600 hover:bg-violet-700 text-white gap-1.5 text-xs shrink-0 active:scale-95 transition-transform"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ask Brain</span>
          </Button>

          <Link href="/admin/quick-notes/ask">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden lg:inline-flex min-h-[40px] text-xs text-muted-foreground hover:text-foreground"
            >
              Full Q&A View
            </Button>
          </Link>
        </div>
      </div>

      {/* Expandable Filter Ribbon */}
      {showFilters && (
        <div className="pt-2 border-t border-border/50 space-y-2.5">
          {/* Source Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] font-medium text-muted-foreground shrink-0 mr-1">Source:</span>
            {SOURCES.map((s) => {
              const active = selectedSource === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onSourceChange(s.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 min-h-[32px] ${
                    active
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {s.icon}
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Knowledge Type Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <span className="text-[11px] font-medium text-muted-foreground shrink-0 mr-1">Type:</span>
            {TYPES.map((t) => {
              const active = selectedType === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTypeChange(t.id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0 min-h-[32px] ${
                    active
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              );
            })}

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 h-7 px-2 shrink-0 ml-auto"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Result Status Indicator */}
      {totalResultsCount !== undefined && hasActiveFilters && (
        <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1">
          <span>Showing {totalResultsCount} matching record{totalResultsCount === 1 ? '' : 's'}</span>
          {searchQuery && (
            <span className="text-violet-600 dark:text-violet-400 font-medium">
              Tip: Press ⌘K or click "Ask Brain" to synthesize answers
            </span>
          )}
        </div>
      )}
    </div>
  );
}
