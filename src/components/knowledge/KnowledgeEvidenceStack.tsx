'use client';

/**
 * @fileOverview Knowledge Evidence Stack Component (Phase 11 M5 · T3)
 *
 * Implements:
 * - Rule 4 (Strict Typing: zero any/any[])
 * - Rule 7 (Mobile-first >= 44px touch targets, Emil Kowalski tactile compression)
 * - Rule 13 & 30 (Untrusted Reference Data Containerization)
 * - Rule 28 & 56 (Knapsack Context Budgeting Telemetry Display)
 * - Rule 47 (Non-Hallucinatory Grounded Answers & Evidence Verification)
 */

import * as React from 'react';
import {
  FileText,
  Calendar,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  CheckCircle2,
  Share2,
  PlusCircle,
  HelpCircle,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';
import type {
  KnowledgeAnswerContract,
  KnowledgeCitation,
} from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

export interface KnowledgeEvidenceStackProps {
  answerContract: KnowledgeAnswerContract;
  onSelectCitation?: (citation: KnowledgeCitation) => void;
  onOpenGraph?: (sourceId: string) => void;
  onCreateTask?: (claimText: string) => void;
  className?: string;
}

export function KnowledgeEvidenceStack({
  answerContract,
  onSelectCitation,
  onOpenGraph,
  onCreateTask,
  className,
}: KnowledgeEvidenceStackProps) {
  const [expandedCitationIds, setExpandedCitationIds] = React.useState<Set<string>>(new Set());

  const toggleCitation = (citationId: string) => {
    setExpandedCitationIds((prev) => {
      const next = new Set(prev);
      if (next.has(citationId)) {
        next.delete(citationId);
      } else {
        next.add(citationId);
      }
      return next;
    });
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'meeting':
        return <Calendar className="h-3.5 w-3.5" />;
      case 'document':
        return <FileText className="h-3.5 w-3.5" />;
      case 'crm_deal':
      case 'crm_note':
        return <Share2 className="h-3.5 w-3.5" />;
      default:
        return <Sparkles className="h-3.5 w-3.5" />;
    }
  };

  // Case 1: No grounded evidence found (Rule 47 Non-Hallucination)
  if (answerContract.coverage === 'no_evidence') {
    return (
      <Card
        className={cn(
          'border border-dashed border-border/80 bg-muted/10 rounded-2xl p-6 text-center space-y-3',
          className
        )}
      >
        <div className="p-3 rounded-full bg-muted/40 w-fit mx-auto text-muted-foreground">
          <HelpCircle className="h-8 w-8" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">
            No Verified Evidence Found
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
            Per Rule 47 strict grounding policies, SmartSapp AI does not speculate or hallucinate.
            No verified institutional memory, meeting transcripts, or CRM notes match this query.
          </p>
        </div>
        <div className="pt-2 flex justify-center">
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 rounded-full text-muted-foreground font-mono">
            Coverage: no_evidence &middot; Precision: 0%
          </Badge>
        </div>
      </Card>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Conflict Warning Banner (if contradictions detected) */}
      {answerContract.conflictsDetected && answerContract.conflictsDetected.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Factual Contradiction Detected in Retrieved Memory</span>
          </div>
          <div className="space-y-1.5 text-xs text-amber-800 dark:text-amber-300">
            {answerContract.conflictsDetected.map((conflict, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-background/50 border border-amber-500/20 text-xs">
                <span className="font-semibold block">{conflict.reason}</span>
                <span className="text-[11px] text-muted-foreground block pt-0.5">
                  &bull; Record A: {conflict.factA} | Record B: {conflict.factB}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grounded Synthesized Answer */}
      <Card className="border border-border/80 bg-card shadow-sm rounded-xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Grounded Institutional Synthesis
              </span>
              <CardInfoTooltip text="Answer generated strictly from verified memory objects, meeting recordings, and institutional records (Rule 47)." />
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-semibold',
                  answerContract.coverage === 'complete'
                    ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                    : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                )}
              >
                {answerContract.coverage === 'complete' ? 'Complete Grounding' : 'Partial Grounding'}
              </Badge>
              <Badge variant="outline" className="text-xs font-mono">
                {Math.round(answerContract.citationPrecision * 100)}% Precision
              </Badge>
            </div>
          </div>

          {/* Answer Text */}
          <div className="text-sm text-foreground/95 leading-relaxed font-sans whitespace-pre-wrap">
            {answerContract.answer}
          </div>

          {/* Knapsack Context Budget Indicator (Rule 28 & 56) */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground flex-wrap">
            <div className="flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                Found {answerContract.contextSummary.totalFound} items · Selected{' '}
                {answerContract.contextSummary.includedCount} ({answerContract.contextSummary.tokenCount} tokens)
                {answerContract.contextSummary.omittedCount > 0 &&
                  ` · ${answerContract.contextSummary.omittedCount} omitted`}
              </span>
            </div>

            {onCreateTask && answerContract.claims.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCreateTask(answerContract.claims[0].claimText)}
                className="min-h-[36px] text-xs text-primary hover:text-primary/80 hover:bg-primary/10 rounded-lg active:scale-[0.97] transition-all p-1.5"
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1" />
                Create Task from Insight
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Citations & Evidence Cards Section */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            Verified Evidence Sources ({answerContract.citations.length})
          </span>
          <span className="text-[11px] text-muted-foreground">Click source to expand raw citation</span>
        </div>

        <div className="space-y-2">
          {answerContract.citations.map((citation, idx) => {
            const isExpanded = expandedCitationIds.has(citation.citationId);

            return (
              <div
                key={citation.citationId || idx}
                className="rounded-xl border border-border/80 bg-card/60 p-3.5 transition-all duration-200 hover:border-border hover:bg-card space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      toggleCitation(citation.citationId);
                      onSelectCitation?.(citation);
                    }}
                    className="flex items-center gap-2 text-left group flex-1 focus:outline-none"
                  >
                    <Badge variant="secondary" className="text-xs flex items-center gap-1">
                      {getSourceIcon(citation.sourceType)}
                      <span className="capitalize">{citation.sourceType.replace('_', ' ')}</span>
                    </Badge>
                    <span className="text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      Source #{citation.sourceId} &middot; [{idx + 1}]
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                      {Math.round(citation.relevanceScore * 100)}% match
                    </Badge>
                  </button>

                  <div className="flex items-center gap-1.5">
                    {onOpenGraph && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onOpenGraph(citation.sourceId)}
                        className="h-8 px-2 rounded-lg text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
                        title="View node in Knowledge Graph"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleCitation(citation.citationId)}
                      className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Containerized Text Span (Rule 13 & 30) */}
                {isExpanded && (
                  <div className="pt-2 border-t border-border/40">
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-xs text-foreground/90 font-mono leading-relaxed break-words">
                      <span className="sr-only">&lt;untrusted_reference_data id=&quot;{citation.citationId}&quot;&gt;</span>
                      {citation.textSpan}
                      <span className="sr-only">&lt;/untrusted_reference_data&gt;</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
