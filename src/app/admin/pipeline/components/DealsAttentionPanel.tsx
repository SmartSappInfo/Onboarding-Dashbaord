'use client';

/**
 * @fileoverview Deals Attention Required Alert Panel
 *
 * ARCHITECTURAL POINTER (Actionable CRM Alerting):
 * Surfaces high-priority risk and operational bottlenecks:
 * - Deals breaching stage SLAs
 * - Deals missing next steps or overdue for contact
 * - Stalled opportunities with zero activity in 14+ days
 * - High-value deals closing within 7 days
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All click actions must provide immediate filter navigation or deal quick-edit triggers.
 * - Mobile responsive layout with >= 44px touch targets.
 * - Double-brace variables must not be parsed with ad-hoc regex.
 *
 * TESTABILITY POINTER:
 * Verify clicking attention items calls `onSelectFilter` or `onOpenDeal`.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Clock, Calendar, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Deal, DealStage } from '@/lib/types';
import { calculateDealHealth } from '@/lib/deals/deal-health-engine';

interface DealsAttentionPanelProps {
  deals: Deal[];
  stages: DealStage[];
  onOpenDeal?: (deal: Deal) => void;
  onFilterSlaBreached?: () => void;
  onFilterNoNextStep?: () => void;
  onFilterClosingSoon?: () => void;
}

export default function DealsAttentionPanel({
  deals,
  stages,
  onOpenDeal: _onOpenDeal,
  onFilterSlaBreached,
  onFilterNoNextStep,
  onFilterClosingSoon,
}: DealsAttentionPanelProps) {
  const stageMap = React.useMemo(() => {
    const map = new Map<string, DealStage>();
    stages.forEach(s => map.set(s.id, s));
    return map;
  }, [stages]);

  const { slaBreachedDeals, noNextStepDeals, closingSoonDeals, stalledDeals } = React.useMemo(() => {
    const now = new Date();
    const oneWeekFromNow = now.getTime() + 7 * 24 * 60 * 60 * 1000;

    const slaBreached: Deal[] = [];
    const noNextStep: Deal[] = [];
    const closingSoon: Deal[] = [];
    const stalled: Deal[] = [];

    const activeDeals = deals.filter(d => d.status === 'open');

    for (const deal of activeDeals) {
      const stage = stageMap.get(deal.stageId);
      const health = calculateDealHealth(deal, stage, deal.updatedAt, now);

      if (health.isSlaBreached) {
        slaBreached.push(deal);
      }

      if (health.status === 'stalled') {
        stalled.push(deal);
      }

      if (!deal.nextStep || deal.nextStep.isCompleted) {
        noNextStep.push(deal);
      }

      if (deal.expectedCloseDate) {
        const closeTime = new Date(deal.expectedCloseDate).getTime();
        if (!isNaN(closeTime) && closeTime >= now.getTime() && closeTime <= oneWeekFromNow) {
          closingSoonDeals.push(deal);
        }
      }
    }

    return {
      slaBreachedDeals: slaBreached,
      noNextStepDeals: noNextStep,
      closingSoonDeals: closingSoon,
      stalledDeals: stalled,
    };
  }, [deals, stageMap]);

  const hasAnyAttentionItems = 
    slaBreachedDeals.length > 0 || 
    noNextStepDeals.length > 0 || 
    closingSoonDeals.length > 0 || 
    stalledDeals.length > 0;

  if (!hasAnyAttentionItems) {
    return (
      <Card className="rounded-2xl border-border/50 bg-emerald-500/5 border-emerald-500/20 p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Pipeline Health is Optimal</h4>
            <p className="text-xs text-muted-foreground">All active opportunities are within stage SLAs with active next steps.</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          Attention Required ({slaBreachedDeals.length + noNextStepDeals.length + closingSoonDeals.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* SLA Breached Card */}
        {slaBreachedDeals.length > 0 && (
          <div 
            onClick={onFilterSlaBreached}
            className="group p-4 rounded-2xl bg-destructive/10 border border-destructive/20 hover:border-destructive/40 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
                <span className="text-xs font-bold text-destructive">Stage SLA Breached</span>
              </div>
              <Badge variant="outline" className="bg-destructive/20 text-destructive text-[10px] font-extrabold px-2 py-0.5 border-destructive/30">
                {slaBreachedDeals.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {slaBreachedDeals.length} {slaBreachedDeals.length === 1 ? 'deal has' : 'deals have'} spent longer in stage than configured target.
            </p>
            <div className="flex items-center justify-between text-xs font-bold text-destructive group-hover:translate-x-0.5 transition-transform">
              <span>Inspect Bottlenecks</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        )}

        {/* Missing Next Step Card */}
        {noNextStepDeals.length > 0 && (
          <div 
            onClick={onFilterNoNextStep}
            className="group p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">No Next Step</span>
              </div>
              <Badge variant="outline" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold px-2 py-0.5 border-amber-500/30">
                {noNextStepDeals.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              {noNextStepDeals.length} active {noNextStepDeals.length === 1 ? 'deal has' : 'deals have'} no upcoming task or meeting scheduled.
            </p>
            <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:translate-x-0.5 transition-transform">
              <span>Schedule Follow-ups</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        )}

        {/* Closing Soon Card */}
        {closingSoonDeals.length > 0 && (
          <div 
            onClick={onFilterClosingSoon}
            className="group p-4 rounded-2xl bg-primary/10 border border-primary/20 hover:border-primary/40 transition-all cursor-pointer shadow-sm flex flex-col justify-between"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold text-primary">Closing within 7 Days</span>
              </div>
              <Badge variant="outline" className="bg-primary/20 text-primary text-[10px] font-extrabold px-2 py-0.5 border-primary/30">
                {closingSoonDeals.length}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Target close dates within this week. Ensure commercial proposals are finalized.
            </p>
            <div className="flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-0.5 transition-transform">
              <span>View Closing Deals</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
