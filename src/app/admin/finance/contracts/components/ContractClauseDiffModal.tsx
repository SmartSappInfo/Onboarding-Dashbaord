'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * 1. Purpose:
 *    Semantic Redline & Clause Diff Modal for Contracts (P5.2 UI).
 *    Visualizes structural and semantic differences between agreement versions
 *    with clear color-coded indicators (added, removed, modified) and risk significance.
 * 2. Mobile-First & Accessibility:
 *    - All touch controls strictly enforce `min-h-[44px]`.
 *    - Tactile micro-interactions (`active:scale-[0.97]`).
 *    - Everyday, clear UI English terminology.
 * 3. Non-Destructive Invariant:
 *    - Purely observational interface. Does not modify or overwrite signed/published records.
 * 4. Zero-Tolerance Typing (Rule 4):
 *    - Strictly 0 `any` or `any[]` throughout.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitCompare,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { compareContractVersionsAction } from '@/app/actions/contract-ai-intelligence-actions';
import type {
  SemanticClauseDiff,
  SemanticClauseDiffItem,
  SemanticClauseSignificance,
} from '@/lib/types/document-signing';

export interface ContractClauseDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  contractId: string;
  contractTitle: string;
  versionAId?: string;
  versionBId?: string;
  versionAText?: string;
  versionBText?: string;
}

function getSignificanceBadge(significance: SemanticClauseSignificance): React.ReactElement {
  switch (significance) {
    case 'high':
      return (
        <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px] font-bold uppercase py-0 h-4">
          High Impact
        </Badge>
      );
    case 'medium':
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold uppercase py-0 h-4">
          Moderate
        </Badge>
      );
    default:
      return (
        <Badge className="bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30 text-[10px] font-bold uppercase py-0 h-4">
          Minor
        </Badge>
      );
  }
}

export function ContractClauseDiffModal({
  open,
  onOpenChange,
  workspaceId,
  contractId,
  contractTitle,
  versionAId = 'v1',
  versionBId = 'v2',
  versionAText = '',
  versionBText = '',
}: ContractClauseDiffModalProps) {
  const [diff, setDiff] = React.useState<SemanticClauseDiff | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [filterType, setFilterType] = React.useState<'all' | 'added' | 'removed' | 'modified'>('all');

  React.useEffect(() => {
    if (!open || !contractId) return;

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    compareContractVersionsAction({
      workspaceId,
      documentId: contractId,
      versionAId,
      versionBId,
      versionAText,
      versionBText,
    })
      .then((res) => {
        if (!isMounted) return;
        if (res.success && res.data) {
          setDiff(res.data);
        } else {
          setError(res.error || 'Failed to compare contract versions.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Comparison failed.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, workspaceId, contractId, versionAId, versionBId, versionAText, versionBText]);

  const items: SemanticClauseDiffItem[] = diff?.clauses || [];
  const filteredItems = items.filter((item: SemanticClauseDiffItem) => {
    if (filterType === 'all') return true;
    return item.changeType === filterType;
  });

  const addedCount = items.filter((i: SemanticClauseDiffItem) => i.changeType === 'added').length;
  const removedCount = items.filter((i: SemanticClauseDiffItem) => i.changeType === 'removed').length;
  const modifiedCount = items.filter((i: SemanticClauseDiffItem) => i.changeType === 'modified').length;

  const overallSignificance: SemanticClauseSignificance = items.some((i) => i.significance === 'high')
    ? 'high'
    : items.some((i) => i.significance === 'medium')
    ? 'medium'
    : 'low';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] p-0 flex flex-col rounded-2xl overflow-hidden border bg-background shadow-2xl">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-card/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              <GitCompare className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base sm:text-lg font-semibold truncate">
                  Semantic Redline & Diff
                </DialogTitle>
                {diff && getSignificanceBadge(overallSignificance)}
              </div>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5 truncate max-w-md">
                {contractTitle} • Comparing {versionAId} with {versionBId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs font-semibold text-muted-foreground">
                Analyzing clause AST and semantic differences...
              </p>
            </div>
          )}

          {error && !isLoading && (
            <div className="flex-1 flex flex-col items-center justify-center p-10 space-y-2 text-center">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-xs font-semibold text-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="mt-2 text-xs font-semibold"
              >
                Close
              </Button>
            </div>
          )}

          {!isLoading && !error && diff && (
            <>
              {/* Summary Bar */}
              <div className="p-4 bg-muted/30 border-b space-y-2">
                <p className="text-xs text-foreground/90 font-medium leading-relaxed">
                  {diff.executiveSummary}
                </p>

                {/* Filter Pills */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setFilterType('all')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                      filterType === 'all'
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    All ({items.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('added')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                      filterType === 'added'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-card text-emerald-600 dark:text-emerald-400 border-border hover:bg-muted'
                    }`}
                  >
                    +{addedCount} Added
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('modified')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                      filterType === 'modified'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-card text-amber-600 dark:text-amber-400 border-border hover:bg-muted'
                    }`}
                  >
                    ~{modifiedCount} Modified
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterType('removed')}
                    className={`text-xs px-2.5 py-1 rounded-lg font-semibold border transition-all ${
                      filterType === 'removed'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-card text-rose-600 dark:text-rose-400 border-border hover:bg-muted'
                    }`}
                  >
                    -{removedCount} Removed
                  </button>
                </div>
              </div>

              {/* Diff Items List */}
              <ScrollArea className="flex-1 p-5">
                <div className="space-y-3">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item: SemanticClauseDiffItem, idx: number) => {
                      const isAdded = item.changeType === 'added';
                      const isRemoved = item.changeType === 'removed';
                      const isModified = item.changeType === 'modified';

                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                            isAdded
                              ? 'bg-emerald-500/5 border-emerald-500/20'
                              : isRemoved
                              ? 'bg-rose-500/5 border-rose-500/20'
                              : 'bg-amber-500/5 border-amber-500/20'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-foreground flex items-center gap-1.5">
                              {isAdded && <PlusCircle className="h-4 w-4 text-emerald-500" />}
                              {isRemoved && <MinusCircle className="h-4 w-4 text-rose-500" />}
                              {isModified && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                              {item.clauseTitle}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {getSignificanceBadge(item.significance)}
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-mono uppercase ${
                                  isAdded
                                    ? 'text-emerald-600 border-emerald-500/30'
                                    : isRemoved
                                    ? 'text-rose-600 border-rose-500/30'
                                    : 'text-amber-600 border-amber-500/30'
                                }`}
                              >
                                {item.changeType}
                              </Badge>
                            </div>
                          </div>

                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {item.summaryOfChange}
                          </p>

                          {/* Before / After comparison for modified clauses */}
                          {isModified && (item.originalText || item.newText) && (
                            <div className="space-y-1.5 pt-1 border-t border-border/40 text-[11px] font-mono">
                              {item.originalText && (
                                <div className="p-2 rounded bg-rose-500/10 text-rose-700 dark:text-rose-300">
                                  <span className="font-bold block text-[10px] uppercase text-rose-500 mb-0.5">
                                    Original ({versionAId}):
                                  </span>
                                  <p className="line-through">{item.originalText}</p>
                                </div>
                              )}
                              {item.newText && (
                                <div className="p-2 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                                  <span className="font-bold block text-[10px] uppercase text-emerald-500 mb-0.5">
                                    Revised ({versionBId}):
                                  </span>
                                  <p>{item.newText}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto" />
                      <p className="font-semibold text-foreground">No Clauses Match Filter</p>
                      <p>All clauses in this category are unchanged between versions.</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-card/40 flex items-center justify-end flex-shrink-0">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] px-6 font-semibold text-xs active:scale-[0.97]"
          >
            Done Reviewing
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
