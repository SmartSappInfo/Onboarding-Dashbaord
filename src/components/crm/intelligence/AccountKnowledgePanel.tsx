'use client';

/**
 * @fileOverview Account Knowledge Panel & Citation Drawer Component (Phase 9 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-First >= 44px touch targets),
 * Rule 13/30 (Untrusted Reference Data XML containerization), and `theme.md` §8 (Standardized Modal Architecture).
 *
 * Displays:
 * - Grounded institutional facts categorized with source chips
 * - Meeting takeaways and stakeholder decisions
 * - Citation Drawer slide-over with isolated reference text (<untrusted_reference_data id="...">)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  BookOpen,
  Calendar,
  CheckCircle2,
  FileText,
  Quote,
  Sparkles,
  ExternalLink,
  Receipt,
  Layers,
  X,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { AccountKnowledge, KnowledgeCitation } from '@/platform/agents/crm/intelligence/crm-intelligence-types';

export interface AccountKnowledgePanelProps {
  knowledge: AccountKnowledge;
  isLoading?: boolean;
  className?: string;
}

// Untrusted reference data container (Rule 13 & 30)
function UntrustedReferenceData({ id, children }: { id: string; children: React.ReactNode }) {
  return React.createElement('untrusted_reference_data', { id, className: 'block font-mono text-xs' }, children);
}

export function AccountKnowledgePanel({
  knowledge,
  isLoading = false,
  className,
}: AccountKnowledgePanelProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<string>('ALL');
  const [isCitationDrawerOpen, setIsCitationDrawerOpen] = React.useState(false);
  const [activeCitation, setActiveCitation] = React.useState<KnowledgeCitation | null>(null);

  // Extract unique categories
  const categories = React.useMemo(() => {
    const set = new Set<string>();
    for (const fact of knowledge.groundedFacts) {
      set.add(fact.category);
    }
    return ['ALL', ...Array.from(set)];
  }, [knowledge.groundedFacts]);

  // Filtered facts
  const filteredFacts = React.useMemo(() => {
    if (selectedCategory === 'ALL') return knowledge.groundedFacts;
    return knowledge.groundedFacts.filter((f) => f.category === selectedCategory);
  }, [knowledge.groundedFacts, selectedCategory]);

  const handleOpenCitation = (citationId: string) => {
    const citation = knowledge.citations.find((c) => c.id === citationId) || knowledge.citations[0] || null;
    setActiveCitation(citation);
    setIsCitationDrawerOpen(true);
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'meeting':
        return Calendar;
      case 'invoice':
        return Receipt;
      case 'memory':
        return Layers;
      case 'note':
      default:
        return FileText;
    }
  };

  return (
    <>
      <Card className={cn('rounded-2xl border border-border/80 bg-card text-card-foreground shadow-sm', className)}>
        <CardHeader className="min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <BookOpen className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold tracking-tight">Account Knowledge & Citations</CardTitle>
              <CardInfoTooltip text="Grounded institutional knowledge extracted from notes, meetings, and historical interactions." />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenCitation(knowledge.citations[0]?.id || '')}
              disabled={isLoading || knowledge.citations.length === 0}
              className="min-h-[44px] sm:min-h-[36px] px-3 rounded-xl border-border/80 hover:bg-muted/40 active:scale-[0.97]"
            >
              <Quote className="h-3.5 w-3.5 mr-1.5" />
              <span>View Citations</span>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Category Filter Pills */}
          {categories.length > 2 && (
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    'px-3 py-1 text-xs font-semibold rounded-lg border transition-all active:scale-[0.97] min-h-[36px]',
                    selectedCategory === cat
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/30 text-muted-foreground border-border/70 hover:bg-muted/60'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Grounded Facts List */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Grounded Institutional Facts</span>
            </div>
            <div className="space-y-2.5">
              {filteredFacts.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No grounded facts in this category.</p>
              ) : (
                filteredFacts.map((fact) => {
                  const SourceIcon = getSourceIcon(fact.sourceType);
                  return (
                    <div
                      key={fact.id}
                      className="p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors flex items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-foreground leading-snug">{fact.statement}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1 font-semibold">
                            <SourceIcon className="h-3 w-3" />
                            {fact.sourceTitle}
                          </span>
                          <span>•</span>
                          <span className="uppercase text-[10px] tracking-wider font-semibold text-muted-foreground/80">
                            {fact.category}
                          </span>
                          <span>•</span>
                          <span>{Math.round(fact.confidence * 100)}% confidence</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenCitation(fact.citationId)}
                        className="min-h-[44px] sm:min-h-[32px] px-2.5 text-xs text-primary hover:bg-primary/10 rounded-lg shrink-0 active:scale-[0.97]"
                      >
                        <Quote className="h-3.5 w-3.5 mr-1" />
                        <span>Source</span>
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Meeting Takeaways & Decisions */}
          {knowledge.meetingTakeaways.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-border/60">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs uppercase font-bold tracking-wider text-muted-foreground">Meeting Decisions & Takeaways</span>
              </div>
              <div className="space-y-3">
                {knowledge.meetingTakeaways.map((takeaway) => (
                  <div key={takeaway.meetingId} className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-foreground">{takeaway.meetingTitle}</span>
                      <span className="text-muted-foreground">{takeaway.date}</span>
                    </div>
                    {takeaway.takeaways.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-foreground/80">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Standardized Citation Drawer (theme.md §8) */}
      <Dialog open={isCitationDrawerOpen} onOpenChange={setIsCitationDrawerOpen}>
        <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl">
          <DialogHeader demarcated className="px-6 py-4 min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-base font-semibold tracking-tight">Account Source Citations</DialogTitle>
              <CardInfoTooltip text="Raw context references isolated from instruction logic to protect against prompt injection (Rule 13 & 30)." />
            </div>
            <DialogDescription className="sr-only">Detailed list of citations and source documents</DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
            {knowledge.citations.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No citations available for this account.</p>
            ) : (
              knowledge.citations.map((citation) => (
                <div
                  key={citation.id}
                  className={cn(
                    'p-4 rounded-xl border transition-all text-left space-y-2',
                    activeCitation?.id === citation.id ? 'border-primary bg-primary/5' : 'border-border/70 bg-card'
                  )}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">{citation.title}</span>
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {citation.sourceType}
                    </Badge>
                  </div>
                  {/* Prompt Injection Isolated Container (Rule 13 & 30) */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/60 text-xs text-foreground/90 overflow-x-auto">
                    <UntrustedReferenceData id={citation.id}>
                      {citation.snippet}
                    </UntrustedReferenceData>
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    Recorded: {new Date(citation.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <DialogClose asChild>
              <Button
                variant="outline"
                className="rounded-xl px-4 min-h-[44px] active:scale-[0.97]"
              >
                Close
              </Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
