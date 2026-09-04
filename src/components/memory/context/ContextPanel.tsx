'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 5: Reusable Context Panel Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Core Reusable Context Surface (UI PRD Section 70):
 *    - Answers "What should AI know here?" across CRM, Deals, and Meetings.
 * 2. 4-Tier Stratified Token Meter:
 *    - Visually displays prompt token utilization and tier breakdown.
 * 3. Contradiction Interception:
 *    - Elevates active dispute warnings with opposing quotes and 1-click
 *      navigation to `/admin/quick-notes/conflicts`.
 * 4. Mobile Ergonomics (Rule 7):
 *    - Strict >= 44px min-height touch targets (`min-h-[44px]`).
 * 5. Emil Kowalski Micro-Interactions:
 *    - Tactile compression on click (`active:scale-[0.97]`).
 * 6. Zero-`any` Standard:
 *    - Strictly typed with `ContextPackage`.
 *
 * @testability Interactive slide-over tested across desktop and mobile screens.
 */

import * as React from 'react';
import Link from 'next/link';
import {
  Brain,
  Sparkles,
  ShieldAlert,
  Building2,
  CheckCircle2,
  Layers,
  Copy,
  Check,
  Quote,
  ChevronRight,
  Clock,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import type { ContextPackage } from '@/lib/memory/context-types';
import { ContextCitationDrawer } from './ContextCitationDrawer';

export interface ContextPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextPackage: ContextPackage | null;
  isLoading?: boolean;
  onGenerateAiBrief?: () => void;
  isGeneratingBrief?: boolean;
}

export function ContextPanel({
  open,
  onOpenChange,
  contextPackage,
  isLoading = false,
  onGenerateAiBrief,
  isGeneratingBrief = false,
}: ContextPanelProps) {
  const { toast } = useToast();
  const [citationsDrawerOpen, setCitationsDrawerOpen] = React.useState(false);
  const [copiedPrompt, setCopiedPrompt] = React.useState(false);

  const handleCopyPrompt = () => {
    if (!contextPackage) return;

    const factsText = contextPackage.structuredFacts.map((f) => `- ${f.label}: ${f.value}`).join('\n');
    const memoriesText = contextPackage.memories.map((m) => `- [${m.memory.type.toUpperCase()}] ${m.memory.content}`).join('\n');
    const conflictsText = contextPackage.conflicts.map((c) => `- WARNING: ${c.summary} (Opposing: ${c.opposingAspects.join(', ')})`).join('\n');
    const actionsText = contextPackage.openActions.map((a) => `- Task: ${a.title} (${a.priority})`).join('\n');

    const promptBody = `### AI CONTEXT FOR ${contextPackage.subject?.name || 'ACCOUNT'}\n\n` +
      `**OBJECTIVE:** ${contextPackage.objective}\n\n` +
      `**FACTS:**\n${factsText || 'None'}\n\n` +
      `**INSTITUTIONAL MEMORIES:**\n${memoriesText || 'None'}\n\n` +
      (conflictsText ? `**ACTIVE CONTRADICTIONS:**\n${conflictsText}\n\n` : '') +
      `**OPEN COMMITMENTS:**\n${actionsText || 'None'}`;

    navigator.clipboard.writeText(promptBody);
    setCopiedPrompt(true);
    toast({
      title: 'Context Copied',
      description: 'Assembled AI context copied as structured prompt text.',
    });
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col h-full bg-background border-l shadow-2xl"
        >
          {/* Header */}
          <SheetHeader className="p-6 pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <SheetTitle className="text-lg font-semibold tracking-tight">
                      AI Context Panel
                    </SheetTitle>
                    <Badge variant="outline" className="text-[10px] uppercase font-mono tracking-wider">
                      Phase 5
                    </Badge>
                  </div>
                  <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                    What AI knows about {contextPackage?.subject?.name || 'this account'}
                  </SheetDescription>
                </div>
              </div>

              {contextPackage && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyPrompt}
                  className="h-9 min-h-[44px] px-3 text-xs gap-1.5 active:scale-[0.97] transition-all"
                  title="Copy formatted AI prompt context"
                >
                  {copiedPrompt ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">Copy Prompt</span>
                </Button>
              )}
            </div>
          </SheetHeader>

          {/* Body Content */}
          <ScrollArea className="flex-1 p-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Brain className="w-10 h-10 animate-pulse text-primary mb-3" />
                <p className="text-sm font-medium text-foreground">Assembling Context...</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Querying Firestore facts, Qdrant vectors, and Graph relations
                </p>
              </div>
            ) : !contextPackage ? (
              <div className="text-center py-16 text-muted-foreground">
                <Brain className="w-10 h-10 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-medium">No Context Available</p>
                <p className="text-xs mt-1">Select an account or entity to build context.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Subject Profile Card */}
                {contextPackage.subject && (
                  <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {contextPackage.subject.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {contextPackage.subject.category || 'General'} • Record ID:{' '}
                            <span className="font-mono">{contextPackage.subject.id.slice(0, 8)}...</span>
                          </p>
                        </div>
                      </div>

                      {contextPackage.subject.value !== undefined && (
                        <div className="text-right">
                          <span className="text-[10px] font-mono uppercase text-muted-foreground block">
                            Pipeline Value
                          </span>
                          <span className="text-sm font-bold text-foreground">
                            GHS {contextPackage.subject.value.toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Token Budget Meter */}
                <div className="rounded-xl border border-border/70 bg-muted/30 p-4 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-medium text-foreground">
                      <Layers className="w-3.5 h-3.5 text-primary" />
                      <span>Token Budget Utilization</span>
                    </div>
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {contextPackage.tokenBudget.totalTokens.toLocaleString()} /{' '}
                      {contextPackage.tokenBudget.maxBudget.toLocaleString()} tokens (
                      {contextPackage.tokenBudget.utilizationPercentage}%)
                    </span>
                  </div>

                  <Progress
                    value={contextPackage.tokenBudget.utilizationPercentage}
                    className="h-2 rounded-full"
                  />

                  {/* Tier Breakdown Pills */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] font-mono text-muted-foreground">
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                      Tier 1 Critical: {contextPackage.tokenBudget.tierBreakdown.tier1Critical}t
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      Tier 2 Relevant: {contextPackage.tokenBudget.tierBreakdown.tier2Relevant}t
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      Tier 3 Supporting: {contextPackage.tokenBudget.tierBreakdown.tier3Supporting}t
                    </span>
                  </div>
                </div>

                {/* Active Contradiction Warnings (Tier 1 Priority) */}
                {contextPackage.conflicts.length > 0 && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-semibold text-xs">
                        <ShieldAlert className="w-4 h-4 text-rose-600 animate-pulse" />
                        <span>Active Factual Contradictions ({contextPackage.conflicts.length})</span>
                      </div>
                      <Link href="/admin/quick-notes/conflicts">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] text-rose-700 dark:text-rose-400 hover:text-rose-900 px-2 active:scale-[0.97]"
                        >
                          Resolve in Conflict Center
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    </div>

                    <div className="space-y-2">
                      {contextPackage.conflicts.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-lg bg-background/80 border border-rose-200 dark:border-rose-900/40 p-3 text-xs"
                        >
                          <p className="font-semibold text-foreground mb-1">{c.summary}</p>
                          <p className="text-[11px] text-muted-foreground italic mb-1">
                            &ldquo;{c.evidenceQuoteA}&rdquo; <span className="font-bold">vs</span> &ldquo;{c.evidenceQuoteB}&rdquo;
                          </p>
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-rose-700 dark:text-rose-400">
                            <span>Dispute: {c.opposingAspects.join(' • ')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Structured CRM Facts */}
                {contextPackage.structuredFacts.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Structured Facts
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {contextPackage.structuredFacts.map((fact) => (
                        <div
                          key={fact.id}
                          className="rounded-lg border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground">{fact.label}</span>
                          <span className="font-semibold text-foreground">{String(fact.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Institutional Memories */}
                {contextPackage.memories.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                        Verified Memories ({contextPackage.memories.length})
                      </h4>
                    </div>

                    <div className="space-y-2">
                      {contextPackage.memories.map((m) => (
                        <div
                          key={m.id}
                          className="rounded-xl border border-border/70 bg-card p-3.5 space-y-2 transition-all hover:border-border"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="outline" className="text-[10px] uppercase font-mono">
                              {m.memory.type}
                            </Badge>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <Clock className="w-3 h-3 text-emerald-600" />
                              <span>{Math.round(m.freshness.freshnessScore * 100)}% Fresh</span>
                            </div>
                          </div>

                          <p className="text-xs text-foreground/90 leading-relaxed line-clamp-3">
                            {m.memory.content}
                          </p>

                          <div className="text-[10px] text-muted-foreground font-mono">
                            Relevance: {Math.round(m.relevanceScore * 100)}% • {m.whyRelevant}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Open Action Commitments */}
                {contextPackage.openActions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Open Actions & Commitments ({contextPackage.openActions.length})
                    </h4>
                    <div className="space-y-1.5">
                      {contextPackage.openActions.map((action) => (
                        <div
                          key={action.id}
                          className="rounded-lg border border-border/60 bg-muted/20 p-2.5 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="font-medium text-foreground truncate">{action.title}</span>
                          </div>
                          <Badge
                            variant={
                              action.priority === 'urgent'
                                ? 'destructive'
                                : action.priority === 'high'
                                ? 'secondary'
                                : 'outline'
                            }
                            className="text-[10px] uppercase font-mono px-1.5 py-0"
                          >
                            {action.priority}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {contextPackage.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                      Strategic AI Guidance
                    </h4>
                    <div className="space-y-2">
                      {contextPackage.recommendations.map((rec, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-primary/20 bg-primary/[0.02] p-3 space-y-1 text-xs"
                        >
                          <div className="flex items-center gap-1.5 text-primary font-semibold">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>{rec.title}</span>
                          </div>
                          <p className="text-muted-foreground text-[11px] leading-relaxed">
                            {rec.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>

          {/* Footer Actions */}
          <SheetFooter className="p-4 border-t bg-muted/10 flex sm:flex-row items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCitationsDrawerOpen(true)}
              className="h-10 min-h-[44px] px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
              disabled={!contextPackage || contextPackage.sources.length === 0}
            >
              <Quote className="w-3.5 h-3.5" />
              <span>Inspect Citations ({contextPackage?.sources.length ?? 0})</span>
            </Button>

            {onGenerateAiBrief && (
              <Button
                size="sm"
                onClick={onGenerateAiBrief}
                disabled={!contextPackage || isGeneratingBrief}
                className="h-10 min-h-[44px] px-4 gap-2 text-xs font-semibold bg-primary text-primary-foreground active:scale-[0.97] transition-all"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isGeneratingBrief ? 'Synthesizing...' : 'Generate AI Brief'}</span>
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Citations Inspector Drawer */}
      <ContextCitationDrawer
        open={citationsDrawerOpen}
        onOpenChange={setCitationsDrawerOpen}
        citations={contextPackage?.sources || []}
      />
    </>
  );
}
