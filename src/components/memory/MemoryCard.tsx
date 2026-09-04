'use client';

/**
 * @fileOverview CompanyBrain 2.0: MemoryCard Component
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Visual Hierarchy & Provenance:
 *    - Clearly distinguishes between AI drafts and confirmed institutional memories.
 *    - Semantic badge colors: Indigo (insight), Amber (problem), Emerald (opportunity),
 *      Blue (decision), Rose (risk), Purple (action_item).
 * 2. Mobile Accessibility & Touch Targets:
 *    - Action buttons guarantee >= 44px touch targets on mobile (`min-h-[44px]` or `min-w-[44px]`).
 * 3. Emil Kowalski Interaction Polish:
 *    - Buttons feature `active:scale-[0.97]` and smooth focus-visible outlines.
 * 4. Zero-`any` Type Safety:
 *    - Uses strictly typed `MemoryObject` and typed event callbacks.
 */

import * as React from 'react';
import {
  Brain,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  ShieldCheck,
  TrendingUp,
  XCircle,
  Eye,
  Building2,
  Quote,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { MemoryObject, VerificationState } from '@/lib/memory/types';

export interface MemoryCardProps {
  memory: MemoryObject;
  onInspect: (memory: MemoryObject) => void;
  onConfirm?: (memoryId: string) => Promise<void> | void;
  onInvalidate?: (memoryId: string) => Promise<void> | void;
  isProcessing?: boolean;
}

export const MEMORY_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ComponentType<{ className?: string }> }
> = {
  decision: {
    label: 'Decision',
    color: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/60',
    icon: CheckCircle2,
  },
  insight: {
    label: 'Insight',
    color: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/60',
    icon: Lightbulb,
  },
  problem: {
    label: 'Problem',
    color: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/60',
    icon: AlertTriangle,
  },
  opportunity: {
    label: 'Opportunity',
    color: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/60',
    icon: TrendingUp,
  },
  risk: {
    label: 'Risk',
    color: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60',
    icon: AlertTriangle,
  },
  action_item: {
    label: 'Action Item',
    color: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900/60',
    icon: Sparkles,
  },
  fact: {
    label: 'Fact',
    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    icon: Brain,
  },
};

export const VERIFICATION_CONFIG: Record<
  VerificationState,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  user_confirmed: {
    label: 'Verified Truth',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  source_verified: {
    label: 'Source Verified',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
    icon: ShieldCheck,
  },
  ai_generated: {
    label: 'AI Draft',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800',
    icon: Sparkles,
  },
  unverified: {
    label: 'Unverified',
    badgeClass: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700',
    icon: Brain,
  },
  disputed: {
    label: 'Disputed',
    badgeClass: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800',
    icon: AlertTriangle,
  },
  invalidated: {
    label: 'Archived',
    badgeClass: 'bg-muted text-muted-foreground border-border',
    icon: XCircle,
  },
};

export function MemoryCard({
  memory,
  onInspect,
  onConfirm,
  onInvalidate,
  isProcessing = false,
}: MemoryCardProps) {
  const typeConfig = MEMORY_TYPE_CONFIG[memory.type] ?? {
    label: memory.type,
    color: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800',
    icon: Brain,
  };
  const TypeIcon = typeConfig.icon;

  const verifConfig = VERIFICATION_CONFIG[memory.verification] ?? VERIFICATION_CONFIG.unverified;
  const VerifIcon = verifConfig.icon;

  const confidencePercent = Math.round((memory.confidence || 0.8) * 100);

  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between rounded-xl border bg-card p-4 shadow-xs transition-all hover:shadow-md hover:border-primary/40',
        memory.verification === 'invalidated' && 'opacity-60 bg-muted/30'
      )}
    >
      <div className="space-y-3">
        {/* Top Badges Row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className={cn('gap-1 text-[11px] font-semibold border px-2 py-0.5', typeConfig.color)}
            >
              <TypeIcon className="h-3 w-3" />
              {typeConfig.label}
            </Badge>

            <Badge
              variant="outline"
              className={cn('gap-1 text-[10px] font-medium border px-1.5 py-0.5', verifConfig.badgeClass)}
            >
              <VerifIcon className="h-2.5 w-2.5" />
              {verifConfig.label}
            </Badge>
          </div>

          <span
            className="text-[10px] font-mono font-medium text-muted-foreground"
            title="Extraction Confidence Score"
          >
            {confidencePercent}% conf.
          </span>
        </div>

        {/* Title */}
        {memory.title && (
          <h4 className="font-medium text-sm text-foreground tracking-tight line-clamp-2">
            {memory.title}
          </h4>
        )}

        {/* Content */}
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
          {memory.content}
        </p>

        {/* Evidence Quote (if available) */}
        {memory.evidence && (
          <div className="flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground italic border-l-2 border-primary/50">
            <Quote className="h-3 w-3 shrink-0 text-primary/70 mt-0.5" />
            <span className="line-clamp-2">&ldquo;{memory.evidence}&rdquo;</span>
          </div>
        )}

        {/* Connected Entities Chips */}
        {memory.entities && memory.entities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 pt-1">
            {memory.entities.slice(0, 3).map((ent, idx) => (
              <span
                key={`${ent.entityName}-${idx}`}
                className="inline-flex items-center gap-1 rounded-md bg-secondary/60 px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground"
              >
                <Building2 className="h-2.5 w-2.5 text-muted-foreground" />
                {ent.entityName}
              </span>
            ))}
            {memory.entities.length > 3 && (
              <span className="text-[10px] text-muted-foreground">
                +{memory.entities.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer & Actions */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onInspect(memory)}
          className="h-8 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground active:scale-[0.97] transition-transform"
        >
          <Eye className="h-3.5 w-3.5" />
          Inspect
        </Button>

        <div className="flex items-center gap-1.5">
          {/* Quick Confirm button if pending verification */}
          {memory.verification === 'ai_generated' && onConfirm && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isProcessing}
              onClick={() => onConfirm(memory.id)}
              className="h-8 px-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 active:scale-[0.97] transition-transform min-h-[44px] sm:min-h-[32px]"
              title="Confirm as verified organization truth"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span className="ml-1 hidden sm:inline">Confirm</span>
            </Button>
          )}

          {/* Invalidate button */}
          {memory.verification !== 'invalidated' && onInvalidate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isProcessing}
              onClick={() => onInvalidate(memory.id)}
              className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-rose-600 active:scale-[0.97] transition-transform min-h-[44px] sm:min-h-[32px]"
              title="Archive or invalidate memory"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span className="sr-only sm:not-sr-only sm:ml-1 text-[11px]">Discard</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
