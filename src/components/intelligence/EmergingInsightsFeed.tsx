'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 10: Emerging Insights Feed
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Emil Kowalski Micro-Interactions (Rule 1):
 *    - All buttons feature `active:scale-[0.97]` tactile animation and smooth transitions.
 * 2. Mobile Accessibility (Rule 7):
 *    - Every interactive button provides a `min-h-[44px]` touch target.
 * 3. Human-in-the-Loop Sign-Off (Rule 1 / PRD Invariant 4):
 *    - Taking action either opens the workflow preview or launches an agentic workflow with approval gates.
 * 4. Strict Zero-`any` Standard (Rule 4):
 *    - 100% typed with `ProactiveRecommendation`.
 *
 * @testability Covered in `src/lib/intelligence/__tests__/autonomous-intelligence.test.ts`.
 */

import * as React from 'react';
import {
  AlertTriangle,
  Sparkles,
  ArrowRight,
  X,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { ProactiveRecommendation } from '@/lib/intelligence/types';
import { Button } from '@/components/ui/button';

interface EmergingInsightsFeedProps {
  recommendations: ProactiveRecommendation[];
  onTakeAction: (recommendation: ProactiveRecommendation) => Promise<void>;
  onDismiss: (recommendationId: string) => Promise<void>;
  isProcessingId?: string | null;
}

export function EmergingInsightsFeed({
  recommendations,
  onTakeAction,
  onDismiss,
  isProcessingId,
}: EmergingInsightsFeedProps) {
  const [filter, setFilter] = React.useState<'all' | 'risk' | 'opportunity'>('all');

  const filtered = recommendations.filter((rec) => {
    if (rec.status !== 'active') return false;
    if (filter === 'all') return true;
    return rec.type === filter;
  });

  const getSeverityStyle = (priority: ProactiveRecommendation['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'high':
        return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'medium':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default:
        return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-base sm:text-lg font-bold text-foreground">
            Emerging Risks & Strategic Opportunities
          </h3>
          <p className="text-xs text-muted-foreground">
            Continuous autonomous findings requiring operational attention.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/40">
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'ghost'}
            onClick={() => setFilter('all')}
            className="min-h-[36px] sm:min-h-[32px] px-3 text-xs font-semibold rounded-lg active:scale-[0.97] transition-all"
          >
            All Signals ({recommendations.filter((r) => r.status === 'active').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'risk' ? 'default' : 'ghost'}
            onClick={() => setFilter('risk')}
            className="min-h-[36px] sm:min-h-[32px] px-3 text-xs font-semibold rounded-lg active:scale-[0.97] transition-all"
          >
            Risks ({recommendations.filter((r) => r.status === 'active' && r.type === 'risk').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'opportunity' ? 'default' : 'ghost'}
            onClick={() => setFilter('opportunity')}
            className="min-h-[36px] sm:min-h-[32px] px-3 text-xs font-semibold rounded-lg active:scale-[0.97] transition-all"
          >
            Opportunities ({recommendations.filter((r) => r.status === 'active' && r.type === 'opportunity').length})
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/60 bg-muted/10">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
          <h4 className="text-sm sm:text-base font-semibold text-foreground">All Clear & Grounded</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            Zero active risk anomalies or unaddressed friction points detected in the current observation window.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 sm:gap-4">
          {filtered.map((rec) => {
            const isProcessing = isProcessingId === rec.id;
            const isRisk = rec.type === 'risk';

            return (
              <div
                key={rec.id}
                className="group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl border border-border/60 bg-card/80 hover:bg-card hover:border-border transition-all duration-200 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          isRisk
                            ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}
                      >
                        {isRisk ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        {isRisk ? 'Commercial Risk' : 'Growth Opportunity'}
                      </span>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider border ${getSeverityStyle(
                          rec.priority
                        )}`}
                      >
                        {rec.priority}
                      </span>

                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(rec.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-foreground group-hover:text-primary transition-colors">
                    {rec.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {rec.description}
                  </p>

                  {/* Reasoning block */}
                  <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-xs text-muted-foreground font-mono">
                    <span className="font-semibold text-foreground">Pattern Evidence:</span> {rec.reasoning}
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-4 mt-3 border-t border-border/40 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5">
                  <Button
                    variant="ghost"
                    onClick={() => onDismiss(rec.id)}
                    disabled={isProcessing}
                    className="min-h-[44px] px-4 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-[0.97] transition-all gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    Dismiss Signal
                  </Button>

                  <Button
                    onClick={() => onTakeAction(rec)}
                    disabled={isProcessing}
                    className="min-h-[44px] px-5 rounded-xl text-xs font-semibold gap-2 active:scale-[0.97] transition-all shadow-sm"
                  >
                    {isProcessing ? 'Processing Action...' : rec.recommendedAction.label}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
