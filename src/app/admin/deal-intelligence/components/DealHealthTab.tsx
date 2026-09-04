'use client';

/**
 * @fileoverview Deal Health & Risk Matrix Tab (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 44 and UI Specifications Section 23 & 771-789:
 * 1. Multi-factor Deal Health Scorecards with 4-pillar sub-scores (Recency, Stakeholders, Velocity, Sentiment).
 * 2. Explainable "Why?" drivers detailing exact reasons for deal health deterioration or momentum.
 * 3. Prioritized AI Recommended Action with urgency indicators.
 * 4. Deal Risk Matrix (Pipeline Value vs. Health Score) quadrant visualization.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Users,
  MessageSquare,
  Sparkles,
  ArrowUpRight,
  ShieldAlert,
} from 'lucide-react';
import type { DealHealthScorecard, DealHealthTier } from '@/lib/deal-intelligence/types';

interface DealHealthTabProps {
  scorecards: DealHealthScorecard[];
  onSelectDeal?: (dealId: string) => void;
}

export const DealHealthTab: React.FC<DealHealthTabProps> = ({ scorecards, onSelectDeal }) => {
  const [tierFilter, setTierFilter] = React.useState<string>('all');

  const filteredCards = React.useMemo(() => {
    if (tierFilter === 'all') return scorecards;
    return scorecards.filter((c) => c.healthTier === tierFilter);
  }, [scorecards, tierFilter]);

  const getTierBadge = (tier: DealHealthTier) => {
    switch (tier) {
      case 'healthy':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30">Needs Attention</Badge>;
      case 'at_risk':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30">At Risk</Badge>;
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-400';
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Deal Health & Risk Intelligence
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Algorithmic 4-pillar health scoring with explainable drivers and tactical next-best-actions.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'all', label: `All Deals (${scorecards.length})` },
            { id: 'at_risk', label: `At Risk (${scorecards.filter((c) => c.healthTier === 'at_risk').length})` },
            { id: 'warning', label: `Warning (${scorecards.filter((c) => c.healthTier === 'warning').length})` },
            { id: 'healthy', label: `Healthy (${scorecards.filter((c) => c.healthTier === 'healthy').length})` },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={tierFilter === tab.id ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTierFilter(tab.id)}
              className="min-h-[44px] text-xs font-semibold active:scale-[0.97]"
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Deal Risk Matrix Quadrant Overview */}
      <Card className="p-5 bg-muted/20 border space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Deal Risk Matrix (Pipeline Value vs. Health)
            </h3>
            <p className="text-xs text-muted-foreground">
              Prioritize intervention where deal value is high and health score is declining.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {scorecards.length} Deals Analyzed
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
          {/* Top Left: Critical Attention */}
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Critical Attention (High Value + At Risk)
              </span>
              <Badge className="bg-rose-500/20 text-rose-600 border-none text-[10px]">
                {scorecards.filter((c) => c.dealValue >= 20000 && c.healthTier === 'at_risk').length} Deals
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Large opportunities suffering from communication silence, single-threading, or unresolved objections.
            </p>
          </div>

          {/* Top Right: Crown Jewels */}
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                Crown Jewels (High Value + Healthy)
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-600 border-none text-[10px]">
                {scorecards.filter((c) => c.dealValue >= 20000 && c.healthTier === 'healthy').length} Deals
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Strategic enterprise opportunities progressing with multi-threaded champions and strong cadence.
            </p>
          </div>
        </div>
      </Card>

      {/* Deal Scorecards List */}
      {filteredCards.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-muted-foreground mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">No deals found in this category</h3>
            <p className="text-xs text-muted-foreground">
              No deals currently meet the selected health tier criteria.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredCards.map((card) => (
            <Card
              key={card.id}
              className="p-5 transition-all hover:border-primary/40 space-y-5"
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 border-b pb-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">{card.dealName}</h3>
                    {getTierBadge(card.healthTier)}
                    <Badge variant="outline" className="text-xs">
                      {card.stageName}
                    </Badge>
                    {card.factors.stakeholderBreadth.isSingleThreaded && (
                      <Badge className="bg-rose-500/15 text-rose-600 border-rose-500/30 text-[11px] font-semibold">
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Single-Threaded
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>Owner: {card.ownerName}</span>
                    <span>•</span>
                    <span className="font-semibold text-foreground">
                      ${card.dealValue.toLocaleString()} Pipeline Value
                    </span>
                  </div>
                </div>

                {/* Score Big Display */}
                <div className="text-right flex items-center sm:flex-col sm:items-end gap-2 sm:gap-0">
                  <div className={`text-3xl font-black font-mono tracking-tight ${getHealthScoreColor(card.overallHealthScore)}`}>
                    {card.overallHealthScore}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ 100</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold">
                    Health Score
                  </span>
                </div>
              </div>

              {/* 4 Pillars Breakdown Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Pillar 1: Recency */}
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      Recency & Cadence
                    </span>
                    <span className="text-xs font-bold font-mono">{card.factors.engagementRecency.score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${card.factors.engagementRecency.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {card.factors.engagementRecency.details}
                  </p>
                </div>

                {/* Pillar 2: Stakeholders */}
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-purple-500" />
                      Multi-Threading
                    </span>
                    <span className="text-xs font-bold font-mono">{card.factors.stakeholderBreadth.score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full"
                      style={{ width: `${card.factors.stakeholderBreadth.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {card.factors.stakeholderBreadth.details}
                  </p>
                </div>

                {/* Pillar 3: Velocity */}
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
                      Stage Velocity
                    </span>
                    <span className="text-xs font-bold font-mono">{card.factors.stageVelocity.score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-1.5 rounded-full"
                      style={{ width: `${card.factors.stageVelocity.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {card.factors.stageVelocity.details}
                  </p>
                </div>

                {/* Pillar 4: Sentiment */}
                <div className="rounded-lg border p-3 bg-muted/20 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                      Sentiment & Calls
                    </span>
                    <span className="text-xs font-bold font-mono">{card.factors.conversationSentiment.score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${card.factors.conversationSentiment.score}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {card.factors.conversationSentiment.details}
                  </p>
                </div>
              </div>

              {/* Explainable "Why?" Bullets */}
              <div className="rounded-lg bg-muted/30 border p-4 space-y-2">
                <span className="text-xs font-bold text-foreground">Why this score?</span>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {card.explainableDrivers.map((driver, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary mt-0.5">•</span>
                      <span>{driver}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI Recommended Tactical Action Card */}
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">
                      AI Recommended Action:
                    </span>
                    <Badge
                      className={
                        card.aiRecommendedAction.urgency === 'immediate'
                          ? 'bg-rose-500/20 text-rose-600 border-none text-[10px] font-bold'
                          : 'bg-primary/20 text-primary border-none text-[10px] font-bold'
                      }
                    >
                      {card.aiRecommendedAction.urgency.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs font-semibold text-foreground">
                    {card.aiRecommendedAction.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {card.aiRecommendedAction.rationale}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => onSelectDeal && onSelectDeal(card.dealId)}
                    className="min-h-[44px] active:scale-[0.97] text-xs font-semibold w-full sm:w-auto"
                  >
                    View Stakeholders & Action
                    <ArrowUpRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
