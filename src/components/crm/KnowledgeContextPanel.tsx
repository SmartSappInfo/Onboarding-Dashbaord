'use client';

/**
 * @fileOverview CRM Knowledge Context Panel (Phase 4 Milestone 5)
 *
 * Implements Rule 4 (Zero-any), Rule 7 (Mobile-first, >=44px touch targets),
 * Rule 8 & 47 (Multi-tenant context), Rule 13 & 30 (Untrusted data prompt isolation),
 * Rule 64 (Emil Kowalski tactile mechanical scaling active:scale-[0.97]).
 *
 * Embedded contextual intelligence sidebar/panel for CRM records (Contacts, Deals, Companies).
 * Displays grounded AI summaries, key takeaways, and clickable evidence cards opening
 * the standardized KnowledgeItemDrawer.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain,
  Sparkles,
  Shield,
  Search,
  FileText,
  ChevronRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  getEntityContextAction,
  type EntityContextResult,
} from '@/app/actions/memory-actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

export interface KnowledgeContextPanelProps {
  entityId: string;
  entityType?: 'contact' | 'deal' | 'company' | string;
  entityName?: string;
  onInspectEvidenceId?: (evidenceId: string) => void;
  className?: string;
}

export function KnowledgeContextPanel({
  entityId,
  entityType = 'contact',
  entityName,
  onInspectEvidenceId,
  className = '',
}: KnowledgeContextPanelProps): React.JSX.Element {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [contextData, setContextData] = useState<EntityContextResult | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuery, setActiveQuery] = useState('');

  const fetchContext = useCallback(
    async (customQuery?: string) => {
      try {
        const queryToUse = customQuery || `${entityType}: ${entityId}`;
        const res = await getEntityContextAction(entityId, entityType, {
          query: queryToUse,
          maxTokens: 2000,
        });

        if (res.success && res.data) {
          setContextData(res.data);
        } else {
          toast({
            title: 'Context Retrieval',
            description: res.error || 'Failed to retrieve institutional memory',
            variant: 'destructive',
          });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error fetching context';
        toast({
          title: 'Context Retrieval Error',
          description: message,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [entityId, entityType, toast]
  );

  useEffect(() => {
    setLoading(true);
    fetchContext();
  }, [fetchContext]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setRefreshing(true);
    setActiveQuery(searchQuery.trim());
    fetchContext(searchQuery.trim());
  };

  const handleResetSearch = () => {
    setSearchQuery('');
    setActiveQuery('');
    setRefreshing(true);
    fetchContext();
  };

  if (loading) {
    return (
      <div
        data-testid="knowledge-context-skeleton"
        className={`p-5 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm space-y-4 animate-pulse ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-muted/60" />
            <div className="h-4 w-40 bg-muted/60 rounded" />
          </div>
          <div className="h-5 w-16 bg-muted/60 rounded-full" />
        </div>
        <div className="h-20 bg-muted/40 rounded-xl" />
        <div className="space-y-2">
          <div className="h-10 bg-muted/30 rounded-lg" />
          <div className="h-10 bg-muted/30 rounded-lg" />
        </div>
      </div>
    );
  }

  const evidence = contextData?.evidence ?? [];
  const tokenCount = contextData?.tokenCount ?? 0;
  const compiledContext = contextData?.compiledContext ?? '';

  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm overflow-hidden flex flex-col ${className}`}
    >
      {/* Panel Header */}
      <div className="min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
            <Brain className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate flex items-center gap-2">
              Institutional Memory & Context
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-mono">
                {tokenCount} tokens
              </Badge>
            </h3>
            {entityName && (
              <p className="text-xs text-muted-foreground truncate">{entityName}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            fetchContext(activeQuery);
          }}
          disabled={refreshing}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 active:scale-[0.97] transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          title="Refresh memory context"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* On-Demand Query Bar */}
      <div className="p-4 border-b border-border/60 bg-muted/5">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Ask SmartSapp about this entity..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-border/80 bg-background/50 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary min-h-[44px]"
            />
          </div>
          <button
            type="submit"
            disabled={refreshing || !searchQuery.trim()}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 active:scale-[0.97] transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5 shrink-0"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Query'}
          </button>
          {activeQuery && (
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground active:scale-[0.97] min-h-[44px]"
            >
              Reset
            </button>
          )}
        </form>
      </div>

      {/* Main Content Body */}
      <div className="p-4 space-y-4">
        {evidence.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto text-muted-foreground">
              <Sparkles className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium text-foreground">No institutional memory found</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              As interactions, meeting notes, and deal activities are logged, company knowledge will appear here.
            </p>
          </div>
        ) : (
          <>
            {/* Rule 30 Prompt Injection Isolation Banner & Context Display */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium">
                  <Shield className="w-3 h-3 text-emerald-500" />
                  Grounded Memory Summary
                </span>
                <span className="font-mono text-[10px] text-muted-foreground/70">
                  {'<untrusted_reference_data>'}
                </span>
              </div>
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 font-mono text-xs text-foreground leading-relaxed max-h-48 overflow-y-auto whitespace-pre-wrap">
                {compiledContext || evidence.map((e) => e.verbatimSnippet).join('\n\n')}
              </div>
            </div>

            {/* Evidence Citations Timeline */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-primary" />
                Verified Citations ({evidence.length})
              </h4>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {evidence.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border border-border/70 bg-card hover:bg-muted/15 transition-all space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] py-0 px-1.5 shrink-0"
                        >
                          {item.citationTag}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground truncate">
                          by {item.author}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 shrink-0 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        {Math.round(item.confidence * 100)}% Match
                      </Badge>
                    </div>

                    <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                      {item.verbatimSnippet}
                    </p>

                    <div className="flex items-center justify-end pt-1">
                      <button
                        type="button"
                        onClick={() => onInspectEvidenceId?.(item.id)}
                        className="text-[11px] text-primary hover:text-primary/80 font-medium inline-flex items-center gap-1 active:scale-[0.97] transition-all min-h-[44px] px-2"
                      >
                        Inspect
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
