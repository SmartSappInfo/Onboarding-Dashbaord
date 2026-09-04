'use client';

/**
 * @fileOverview CompanyBrain 2.0: GlobalKnowledgeSearch Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Primary Enterprise Semantic Search Surface (PRD Section 18 & UI Section 6):
 *    - Executes pre-filtered vector similarity search across institutional memories.
 * 2. Explainable AI Experience ("Why this matched"):
 *    - Each result surfaces semantic proximity score, matching concepts, and verbatim chunk evidence.
 * 3. Mobile Accessibility & Touch Targets:
 *    - All interactive inputs, buttons, and drawer triggers maintain >= 44px height (`min-h-[44px]`).
 * 4. Emil Kowalski Animation Polish:
 *    - Micro-interactions feature `active:scale-[0.97]`, smooth fade-ins, and focus states.
 * 5. Zero-`any` Standard:
 *    - Fully typed with TypeScript interfaces.
 */

import * as React from 'react';
import {
  Search,
  Sparkles,
  X,
  Brain,
  Quote,
  Eye,
  Building2,
  Loader2,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type {
  SemanticSearchResult,
  SemanticSearchFilters,
} from '@/lib/memory/semantic-types';
import type { MemoryObject, MemoryType, VerificationState } from '@/lib/memory/types';
import { semanticSearchMemoriesAction } from '@/lib/memory/actions/semantic-search-actions';
import { MEMORY_TYPE_CONFIG, VERIFICATION_CONFIG } from '../MemoryCard';
import { EvidencePanelDrawer } from './EvidencePanelDrawer';
import { MemoryInspectorDrawer } from '../MemoryInspectorDrawer';

export interface GlobalKnowledgeSearchProps {
  workspaceId: string;
  organizationId: string;
  userId: string;
  initialQuery?: string;
  className?: string;
}

const SEARCH_PROMPTS = [
  'Show me our implementation concerns',
  'What fee or pricing objections were raised?',
  'Which schools asked about WhatsApp automation?',
  'Key decisions made in recent meetings',
  'Contract renewal and expansion opportunities',
];

const TYPE_FILTERS: { id: MemoryType | 'all'; label: string }[] = [
  { id: 'all', label: 'All Types' },
  { id: 'decision', label: 'Decisions' },
  { id: 'insight', label: 'Insights' },
  { id: 'problem', label: 'Problems' },
  { id: 'opportunity', label: 'Opportunities' },
  { id: 'risk', label: 'Risks' },
  { id: 'action_item', label: 'Action Items' },
  { id: 'fact', label: 'Facts' },
];

export function GlobalKnowledgeSearch({
  workspaceId,
  organizationId,
  userId,
  initialQuery = '',
  className,
}: GlobalKnowledgeSearchProps) {
  const { toast } = useToast();

  const [query, setQuery] = React.useState(initialQuery);
  const [results, setResults] = React.useState<SemanticSearchResult[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState<MemoryType | 'all'>('all');
  const [selectedVerification, setSelectedVerification] = React.useState<
    VerificationState | 'all'
  >('all');
  const minSimilarity = 0.5;

  // Drawers
  const [evidenceTarget, setEvidenceTarget] = React.useState<SemanticSearchResult | null>(null);
  const [inspectTarget, setInspectTarget] = React.useState<MemoryObject | null>(null);

  const handleSearch = React.useCallback(
    async (searchQuery: string) => {
      const trimmed = searchQuery.trim();
      if (!trimmed || !workspaceId || !organizationId || !userId) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);

      const filters: SemanticSearchFilters = {
        minScore: minSimilarity,
      };
      if (selectedType !== 'all') {
        filters.memoryTypes = [selectedType];
      }
      if (selectedVerification !== 'all') {
        filters.verification = [selectedVerification];
      }

      try {
        const res = await semanticSearchMemoriesAction({
          workspaceId,
          organizationId,
          userId,
          query: trimmed,
          filters,
          limit: 20,
        });

        if (res.success && res.data) {
          setResults(res.data);
        } else {
          toast({
            title: 'Search notice',
            description: res.error || 'Failed to complete semantic search.',
            variant: 'destructive',
            actionConfig: {
              path: '/admin/quick-notes',
              label: 'Back to Notes',
            },
          });
        }
      } catch (err) {
        toast({
          title: 'Search error',
          description: err instanceof Error ? err.message : 'Unknown search error',
          variant: 'destructive',
          actionConfig: {
            path: '/admin/quick-notes',
            label: 'Back to Notes',
          },
        });
      } finally {
        setIsSearching(false);
      }
    },
    [workspaceId, organizationId, userId, minSimilarity, selectedType, selectedVerification, toast]
  );

  // Auto-run if initialQuery provided
  React.useEffect(() => {
    if (initialQuery.trim()) {
      handleSearch(initialQuery);
    }
  }, [initialQuery, handleSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSearch(query);
  };

  const handlePromptClick = (prompt: string) => {
    setQuery(prompt);
    handleSearch(prompt);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Search Omnibar */}
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm space-y-4">
        <form onSubmit={handleSubmit} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything across organizational memory, decisions, and meetings..."
              className="pl-11 pr-10 text-sm sm:text-base min-h-[48px] bg-background border-border/80 focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setHasSearched(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground rounded-md min-h-[44px] min-w-[44px] sm:min-h-[32px] sm:min-w-[32px] flex items-center justify-center active:scale-[0.97]"
                aria-label="Clear search input"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Button
            type="submit"
            disabled={isSearching || !query.trim()}
            className="min-h-[48px] px-5 font-semibold text-xs sm:text-sm gap-2 rounded-xl active:scale-[0.97]"
          >
            {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            <span className="hidden sm:inline">Semantic Search</span>
          </Button>
        </form>

        {/* Suggestion Prompts */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1 flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> Suggestions:
          </span>
          {SEARCH_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handlePromptClick(p)}
              className="rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] sm:min-h-[28px] flex items-center text-left active:scale-[0.97]"
            >
              {p}
            </button>
          ))}
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-border/50 pt-3">
          {/* Type pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-xs">
            {TYPE_FILTERS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedType(t.id);
                  if (query.trim()) handleSearch(query);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-lg transition-all whitespace-nowrap min-h-[44px] sm:min-h-[28px] flex items-center font-medium text-xs active:scale-[0.97]',
                  selectedType === t.id
                    ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                    : 'bg-muted/40 text-muted-foreground hover:text-foreground'
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Verification selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedVerification('all');
                  if (query.trim()) handleSearch(query);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all min-h-[44px] sm:min-h-[26px] flex items-center active:scale-[0.97]',
                  selectedVerification === 'all'
                    ? 'bg-background shadow-xs font-bold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                All Status
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedVerification('user_confirmed');
                  if (query.trim()) handleSearch(query);
                }}
                className={cn(
                  'px-2.5 py-1 rounded-md transition-all min-h-[44px] sm:min-h-[26px] flex items-center active:scale-[0.97]',
                  selectedVerification === 'user_confirmed'
                    ? 'bg-background shadow-xs font-bold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Verified Truth
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Header */}
      {hasSearched && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Found <strong className="text-foreground">{results.length}</strong> semantically relevant memories
          </span>
          {minSimilarity > 0.5 && (
            <span>Filtering at $\ge${Math.round(minSimilarity * 100)}% similarity</span>
          )}
        </div>
      )}

      {/* Results Stream */}
      {isSearching ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div className="space-y-4">
          {results.map((result) => {
            const memory = result.memory;
            const typeConfig = MEMORY_TYPE_CONFIG[memory.type] ?? {
              label: memory.type,
              color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
              icon: Brain,
            };
            const TypeIcon = typeConfig.icon;
            const verifConfig =
              VERIFICATION_CONFIG[memory.verification] ?? VERIFICATION_CONFIG.unverified;
            const VerifIcon = verifConfig.icon;
            const matchScore = result.whyMatched.semanticSimilarityPercent || Math.round(result.score * 100);

            return (
              <div
                key={`${memory.id}-${result.matchedChunk.chunkId}`}
                className="group relative rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all space-y-3"
              >
                {/* Top Row */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn('gap-1 text-xs font-semibold border px-2.5 py-0.5', typeConfig.color)}
                    >
                      <TypeIcon className="h-3 w-3" />
                      {typeConfig.label}
                    </Badge>

                    <Badge
                      variant="outline"
                      className={cn('gap-1 text-xs font-medium border px-2 py-0.5', verifConfig.badgeClass)}
                    >
                      <VerifIcon className="h-2.5 w-2.5" />
                      {verifConfig.label}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                      {matchScore}% Match
                    </span>
                  </div>
                </div>

                {/* Title */}
                {memory.title && (
                  <h4 className="font-semibold text-sm sm:text-base text-foreground tracking-tight">
                    {memory.title}
                  </h4>
                )}

                {/* "Why this matched" Callout */}
                <div className="rounded-lg bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-900/60 p-2.5 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <span className="font-bold text-[11px] uppercase tracking-wider text-indigo-700 dark:text-indigo-400 block">
                      Why this matched:
                    </span>
                    <p>{result.whyMatched.reason}</p>
                  </div>
                </div>

                {/* Matching Excerpt Snippet */}
                <div className="rounded-md bg-muted/40 p-2.5 text-xs text-foreground/90 border-l-2 border-primary/60">
                  <p className="line-clamp-3 italic">&ldquo;{result.matchedChunk.content}&rdquo;</p>
                </div>

                {/* Connected Entities Chips */}
                {memory.entities && memory.entities.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-1">
                    {memory.entities.slice(0, 4).map((ent, idx) => (
                      <span
                        key={`${ent.entityName}-${idx}`}
                        className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-2 py-0.5 text-[10px] font-medium text-secondary-foreground"
                      >
                        <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
                        {ent.entityName}
                      </span>
                    ))}
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex flex-wrap items-center justify-between border-t border-border/50 pt-3 gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Source: {memory.source.type} &middot;{' '}
                    {new Date(memory.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectTarget(memory)}
                      className="h-8 text-xs font-semibold gap-1 min-h-[44px] sm:min-h-[32px] active:scale-[0.97]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Inspect Memory
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setEvidenceTarget(result)}
                      className="h-8 text-xs font-semibold gap-1 text-primary border-primary/30 hover:bg-primary/10 min-h-[44px] sm:min-h-[32px] active:scale-[0.97]"
                    >
                      <Quote className="h-3.5 w-3.5" />
                      View Evidence
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : hasSearched ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center space-y-3 bg-muted/10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Brain className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground text-sm">No semantically matching memories</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              We couldn&apos;t find memories matching &ldquo;{query}&rdquo; at this similarity threshold. Try broadening your query or selecting &ldquo;All Types&rdquo;.
            </p>
          </div>
        </div>
      ) : null}

      {/* Evidence Panel Drawer */}
      <EvidencePanelDrawer
        open={!!evidenceTarget}
        onOpenChange={(open) => {
          if (!open) setEvidenceTarget(null);
        }}
        result={evidenceTarget}
      />

      {/* Memory Inspector Drawer */}
      <MemoryInspectorDrawer
        open={!!inspectTarget}
        onOpenChange={(open) => {
          if (!open) setInspectTarget(null);
        }}
        memory={inspectTarget}
      />
    </div>
  );
}
