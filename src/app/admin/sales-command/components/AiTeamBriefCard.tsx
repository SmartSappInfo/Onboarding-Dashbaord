'use client';

/**
 * @fileoverview Executive AI Team Brief Card for SmartSapp Manager Command Center (Phase 3).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 38 & UI Section 40:
 * - Executive natural language synthesis of overall sales team performance.
 * - Key risk attribution (pipeline gaps, disengagement, deal stalling).
 * - Actionable managerial directives with direct interactive jump triggers.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Interactive elements must provide minimum 44px touch targets on mobile.
 * - Micro-interactions use active:scale-[0.97] and sub-200ms transitions.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sparkles,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { AiTeamBrief } from '@/lib/manager-command/types';

interface AiTeamBriefCardProps {
  brief: AiTeamBrief;
  onReviewRisksClick?: () => void;
  className?: string;
}

export function AiTeamBriefCard({
  brief,
  onReviewRisksClick,
  className = '',
}: AiTeamBriefCardProps) {
  const formattedDate = React.useMemo(() => {
    try {
      const d = new Date(brief.generatedAt);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'Just now';
    }
  }, [brief.generatedAt]);

  return (
    <Card
      className={`rounded-2xl border bg-gradient-to-br from-card/80 via-card/50 to-primary/5 backdrop-blur-md shadow-sm overflow-hidden transition-all duration-200 ${className}`}
    >
      <CardHeader className="p-4 sm:p-5 pb-3 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                Executive Team Intelligence Brief
              </CardTitle>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Updated {formattedDate}
                </span>
                <span>•</span>
                <span>Automated Synthesis</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20 font-mono text-[10px] font-semibold tracking-wide py-0.5 px-2"
            >
              {brief.confidenceScore}% Confidence
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Headline & Summary */}
        <div className="space-y-1.5">
          <h3 className="text-base sm:text-lg font-black tracking-tight text-foreground leading-snug">
            {brief.headline}
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {brief.summary}
          </p>
        </div>

        {/* Dual Grid: Key Risks vs Recommended Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          {/* Key Risks */}
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-destructive">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Key Risk Attribution</span>
            </div>
            <ul className="space-y-1.5">
              {brief.keyRisks.map((risk, idx) => (
                <li
                  key={`risk-${idx}`}
                  className="flex items-start gap-2 text-xs text-foreground/90 leading-relaxed"
                >
                  <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recommended Actions */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Recommended Manager Actions</span>
            </div>
            <ul className="space-y-1.5">
              {brief.recommendedActions.map((action, idx) => (
                <li
                  key={`act-${idx}`}
                  className="flex items-start gap-2 text-xs text-foreground/90 leading-relaxed"
                >
                  <ArrowRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                  <span>{action}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Action Trigger */}
        {onReviewRisksClick && (
          <div className="pt-2 flex justify-end border-t border-border/30">
            <Button
              variant="default"
              size="sm"
              onClick={onReviewRisksClick}
              className="h-9 min-h-[44px] sm:min-h-[36px] px-4 font-semibold text-xs gap-1.5 rounded-xl transition-all duration-200 active:scale-[0.97] shadow-sm"
            >
              <span>Review Operational Attention Items</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
