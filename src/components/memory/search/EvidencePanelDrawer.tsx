'use client';

/**
 * @fileOverview CompanyBrain 2.0: EvidencePanelDrawer Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Semantic Attribution (PRD Section 21 & UI Section 6):
 *    - Surfaces exact verbatim matching chunks, cosine similarity percentage,
 *      and "Why this matched" semantic reasoning.
 * 2. Mobile Accessibility & Touch Targets:
 *    - Guaranteed >= 44px touch targets on mobile (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Buttons feature `active:scale-[0.97]`, smooth easing, and keyboard focus outlines.
 * 4. Zero-`any` Standard:
 *    - Strictly typed with `SemanticSearchResult` and `MemoryObject`.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Quote,
  Sparkles,
  ExternalLink,
  Building2,
  Brain,
  Calendar,
  Layers,
  Copy,
  Check,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { SemanticSearchResult } from '@/lib/memory/semantic-types';
import type { MemoryObject } from '@/lib/memory/types';
import { MEMORY_TYPE_CONFIG, VERIFICATION_CONFIG } from '../MemoryCard';

export interface EvidencePanelDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: SemanticSearchResult | null;
  _onSelectRelated?: (memory: MemoryObject) => void;
}

export function EvidencePanelDrawer({
  open,
  onOpenChange,
  result,
  _onSelectRelated,
}: EvidencePanelDrawerProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  if (!result) return null;

  const memory = result.memory;
  const whyMatched = result.whyMatched;
  const matchScorePercent = whyMatched.semanticSimilarityPercent || Math.round(result.score * 100);

  const typeConfig = MEMORY_TYPE_CONFIG[memory.type] ?? {
    label: memory.type,
    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    icon: Brain,
  };
  const TypeIcon = typeConfig.icon;

  const verifConfig = VERIFICATION_CONFIG[memory.verification] ?? VERIFICATION_CONFIG.unverified;
  const VerifIcon = verifConfig.icon;

  const handleCopyChunk = async () => {
    try {
      await navigator.clipboard.writeText(result.matchedChunk.content);
      setCopied(true);
      toast({ title: 'Copied chunk excerpt to clipboard' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Failed to copy', variant: 'destructive' });
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto flex flex-col justify-between p-6 gap-6"
      >
        <div className="space-y-6">
          {/* Header */}
          <SheetHeader className="space-y-2 border-b border-border/60 pb-4 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={cn('gap-1 text-xs font-semibold border px-2.5 py-0.5', typeConfig.color)}
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                  {typeConfig.label}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn('gap-1 text-xs font-medium border px-2 py-0.5', verifConfig.badgeClass)}
                >
                  <VerifIcon className="h-3 w-3" />
                  {verifConfig.label}
                </Badge>
              </div>

              <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {matchScorePercent}% Match
              </span>
            </div>

            <SheetTitle className="text-lg font-semibold text-foreground tracking-tight pt-1">
              {memory.title || 'Semantic Search Evidence'}
            </SheetTitle>
            <SheetDescription className="text-xs text-muted-foreground">
              Deep vector match attribution and verbatim source evidence.
            </SheetDescription>
          </SheetHeader>

          {/* Semantic Match Meter */}
          <div className="rounded-xl border border-border/80 bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Cosine Proximity Score
              </span>
              <span className="font-mono font-bold text-foreground">
                {(result.score).toFixed(4)} ({matchScorePercent}%)
              </span>
            </div>
            <Progress value={matchScorePercent} className="h-2 rounded-full" />
          </div>

          {/* "Why this matched" Attribution Box */}
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/20 p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900 dark:text-indigo-300">
              <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <span>Why This Matched</span>
            </div>
            <p className="text-xs text-indigo-950/90 dark:text-indigo-200 leading-relaxed">
              {whyMatched.reason}
            </p>
            {whyMatched.matchedTerms && whyMatched.matchedTerms.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[10px] uppercase font-bold text-indigo-700/80 dark:text-indigo-400/80">
                  Keywords:
                </span>
                {whyMatched.matchedTerms.map((term, idx) => (
                  <span
                    key={`${term}-${idx}`}
                    className="inline-flex items-center rounded-md bg-indigo-100 dark:bg-indigo-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-800 dark:text-indigo-300"
                  >
                    {term}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Verbatim Matching Chunk */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Quote className="h-3.5 w-3.5 text-primary" />
                Matching Chunk Excerpt
              </h5>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyChunk}
                className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground min-h-[44px] sm:min-h-[28px] active:scale-[0.97]"
              >
                {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                <span>{copied ? 'Copied' : 'Copy Excerpt'}</span>
              </Button>
            </div>
            <div className="rounded-xl border border-border bg-card p-3.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap border-l-4 border-l-primary">
              {result.matchedChunk.content}
            </div>
          </div>

          {/* Full Memory Statement */}
          <div className="space-y-2">
            <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Full Knowledge Statement
            </h5>
            <div className="rounded-xl border border-border/70 bg-muted/20 p-3 text-xs text-foreground leading-relaxed">
              {memory.content}
            </div>
          </div>

          {/* Connected CRM Records */}
          {memory.entities && memory.entities.length > 0 && (
            <div className="space-y-2">
              <h5 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-blue-500" />
                Connected CRM Entities
              </h5>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {memory.entities.map((ent, idx) => (
                  <div
                    key={`${ent.entityName}-${idx}`}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/20 p-2 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-medium text-foreground truncate">{ent.entityName}</span>
                    </div>
                    <Badge variant="secondary" className="text-[9px] uppercase px-1.5 py-0 shrink-0">
                      {ent.entityType}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Provenance Context */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5" /> Source Record
              </span>
              <span className="font-mono text-foreground">{memory.source.type}</span>
            </div>

            {memory.source.type === 'user_note' && (
              <div className="flex items-center justify-between text-muted-foreground pt-1">
                <span className="text-[11px]">Direct Note Link</span>
                <Link
                  href={`/admin/quick-notes?search=${encodeURIComponent(memory.source.sourceId)}`}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-semibold"
                >
                  <span>Open Quick Note</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            )}

            <div className="flex items-center justify-between text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Date Recorded
              </span>
              <span className="text-foreground">
                {new Date(memory.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <SheetFooter className="border-t border-border/60 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="min-h-[44px] sm:min-h-[36px] text-xs font-semibold"
          >
            Close
          </Button>

          {memory.source.type === 'user_note' && (
            <Link href={`/admin/quick-notes?search=${encodeURIComponent(memory.source.sourceId)}`}>
              <Button
                type="button"
                className="w-full text-xs font-semibold min-h-[44px] sm:min-h-[36px] active:scale-[0.97] gap-1.5"
              >
                <span>View Full Note</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
