'use client';

/**
 * Morning Rep Cockpit Briefing Card (Lead Intelligence 2.0 - Phase 12)
 * UI Spec Section 53: "Who Should I Contact Today?"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Daily morning briefing synthesizing high-intent accounts and priority queues.
 * 2. Mobile-responsive layout with touch targets >= 44px.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Flame, 
  TrendingUp, 
  Clock, 
  Target, 
  ArrowRight, 
  Sparkles,
  Sun
} from 'lucide-react';
import type { DailyRepBriefing } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface MorningRepBriefingCardProps {
  briefing: DailyRepBriefing;
  onStartQueue: () => void;
  className?: string;
}

export const MorningRepBriefingCard: React.FC<MorningRepBriefingCardProps> = ({
  briefing,
  onStartQueue,
  className
}) => {
  return (
    <Card className={cn("bg-gradient-to-br from-primary/10 via-card to-card border border-primary/30 shadow-md rounded-2xl p-5 space-y-4", className)}>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600">
              <Sun className="h-4 w-4" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Autonomous AI SDR Briefing
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-foreground tracking-tight">
            Good morning, {briefing.repName} 👋
          </h3>
          <p className="text-xs text-muted-foreground">
            <span className="font-bold text-foreground">{briefing.totalNeedingAttention} high-priority prospects</span> need your sales attention today based on live intent signals and score momentum.
          </p>
        </div>

        <Button
          size="sm"
          onClick={onStartQueue}
          disabled={briefing.totalNeedingAttention === 0}
          className="h-10 px-5 bg-primary text-primary-foreground font-black text-xs rounded-xl flex items-center gap-2 shadow-sm active:scale-[0.97] shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          <span>Start My Priority Queue</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
        <div className="p-3 rounded-xl bg-card/70 border border-border/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-bold">
            <Flame className="w-3.5 h-3.5" />
            <span>High Intent</span>
          </div>
          <p className="text-base font-black text-foreground font-mono">{briefing.highIntentCount}</p>
          <span className="text-[10px] text-muted-foreground block">Active tech signals</span>
        </div>

        <div className="p-3 rounded-xl bg-card/70 border border-border/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 font-bold">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Score Boosts</span>
          </div>
          <p className="text-base font-black text-foreground font-mono">{briefing.scoreIncreasedCount}</p>
          <span className="text-[10px] text-muted-foreground block">&ge; 75 Priority score</span>
        </div>

        <div className="p-3 rounded-xl bg-card/70 border border-border/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>Due Cadence</span>
          </div>
          <p className="text-base font-black text-foreground font-mono">{briefing.followupsDueCount}</p>
          <span className="text-[10px] text-muted-foreground block">Synced in CRM</span>
        </div>

        <div className="p-3 rounded-xl bg-card/70 border border-border/70 space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
            <Target className="w-3.5 h-3.5" />
            <span>Top Lookalikes</span>
          </div>
          <p className="text-base font-black text-foreground font-mono">{briefing.winnerLookalikeCount}</p>
          <span className="text-[10px] text-muted-foreground block">&ge; 85 Score tier</span>
        </div>
      </div>
    </Card>
  );
};
