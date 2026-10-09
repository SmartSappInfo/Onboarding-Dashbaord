'use client';

/**
 * @fileOverview Knowledge Candidate Triage Card Component (Phase 11 M3 · T7)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 7 (Mobile-first >= 44px touch targets),
 * Rule 13 & 30 (Untrusted Reference Data containerization), and Rule 17 (Human Review Decider).
 *
 * Provides:
 * - Title, confidence badge, source type pill, sensitivity badge
 * - Untrusted reference data container with injection isolation
 * - Direct tactile Accept / Reject actions with active compression
 * - Conflict detection warning badge & "Resolve Conflict" action
 */

import * as React from 'react';
import {
  Check,
  X,
  AlertTriangle,
  FileText,
  Calendar,
  Sparkles,
  Link as LinkIcon,
  Shield,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { KnowledgeCandidate } from '@/platform/domains/knowledge_memory/contracts/knowledge-schemas';

export interface KnowledgeCandidateCardProps {
  candidate: KnowledgeCandidate;
  onDecide?: (candidateId: string, decision: 'accept' | 'reject') => void;
  onResolveConflict?: (candidate: KnowledgeCandidate) => void;
  onInspect?: (candidate: KnowledgeCandidate) => void;
  className?: string;
}

export function KnowledgeCandidateCard({
  candidate,
  onDecide,
  onResolveConflict,
  onInspect,
  className,
}: KnowledgeCandidateCardProps) {
  const confidencePercent = Math.round(candidate.confidence * 100);

  const getConfidenceBadgeColor = (conf: number) => {
    if (conf >= 0.85) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    if (conf >= 0.65) return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
  };

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType.toLowerCase()) {
      case 'meeting':
        return <Calendar className="h-3.5 w-3.5" />;
      case 'agent_run':
        return <Sparkles className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  // Extract clean display text if wrapped in XML container (Rule 30)
  const displayContent = React.useMemo(() => {
    const match = candidate.content.match(/<untrusted_reference_data[^>]*>([\s\S]*?)<\/untrusted_reference_data>/i);
    return match ? match[1].trim() : candidate.content;
  }, [candidate.content]);

  return (
    <Card
      className={cn(
        'border border-border/80 bg-card even:bg-muted/20 dark:even:bg-muted/10 text-card-foreground shadow-sm rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md hover:border-border',
        candidate.conflictId && 'border-amber-500/40 bg-amber-500/[0.02]',
        className
      )}
    >
      <CardContent className="p-5 space-y-4">
        {/* Top Header: Title, Source & Confidence */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                onClick={() => onInspect?.(candidate)}
                className="text-base font-semibold text-foreground tracking-tight hover:text-primary transition-colors cursor-pointer"
              >
                {candidate.title}
              </h3>
              <Badge
                variant="outline"
                className={cn('text-xs px-2 py-0.5 rounded-full font-semibold', getConfidenceBadgeColor(candidate.confidence))}
              >
                {confidencePercent}% Confidence
              </Badge>
              {candidate.conflictId && (
                <Badge
                  variant="outline"
                  className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"
                >
                  <AlertTriangle className="h-3 w-3" />
                  Conflict
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1 capitalize px-2 py-0.5 rounded-md bg-muted/40 border border-border/60">
                {getSourceIcon(candidate.source.type)}
                {candidate.source.type}
              </span>
              <span className="flex items-center gap-1 uppercase tracking-wider text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted/30">
                {candidate.type}
              </span>
              <span className="flex items-center gap-1 text-[11px]">
                <Shield className="h-3 w-3" />
                {candidate.sensitivity}
              </span>
              {candidate.subjectRefs.length > 0 && (
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Layers className="h-3 w-3" />
                  {candidate.subjectRefs.length} ref{candidate.subjectRefs.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {candidate.suggestedRelationships && candidate.suggestedRelationships.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 px-2.5 py-1 rounded-lg border border-border/40 self-start sm:self-auto">
              <LinkIcon className="h-3.5 w-3.5 text-primary" />
              <span>{candidate.suggestedRelationships.length} suggested link(s)</span>
            </div>
          )}
        </div>

        {/* Content Box (Untrusted Reference Data Container) */}
        <div className="rounded-lg border border-border/80 bg-muted/20 p-3.5 text-xs text-foreground/90 font-sans leading-relaxed break-words">
          <span className="sr-only">&lt;untrusted_reference_data id=&quot;{candidate.id}&quot;&gt;</span>
          {displayContent}
          <span className="sr-only">&lt;/untrusted_reference_data&gt;</span>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-border/60">
          <div className="flex items-center gap-2">
            {candidate.conflictId && onResolveConflict && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onResolveConflict(candidate)}
                className="min-h-[44px] px-3.5 rounded-xl border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 active:scale-[0.97] transition-all flex items-center gap-1.5 font-medium text-xs"
              >
                <AlertTriangle className="h-4 w-4" />
                Resolve Conflict
              </Button>
            )}
            {onInspect && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onInspect(candidate)}
                className="min-h-[44px] px-3 rounded-xl text-xs text-muted-foreground hover:text-foreground active:scale-[0.97]"
              >
                Inspect Details
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDecide?.(candidate.id, 'reject')}
              className="min-h-[44px] px-4 rounded-xl border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-[0.97] transition-all flex items-center gap-1.5 font-medium text-xs"
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => onDecide?.(candidate.id, 'accept')}
              className="min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] transition-all flex items-center gap-1.5 font-medium text-xs shadow-sm"
            >
              <Check className="h-4 w-4" />
              Accept
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
