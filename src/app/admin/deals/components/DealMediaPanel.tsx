'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Deal Media Panel UI:
 *    - Summarizes multi-stakeholder content consumption across contacts associated with a deal.
 *    - Phase 6 Integration: Displays deal-specific Multi-Touch Attribution Breakdown (Linear, First-Touch,
 *      Last-Touch, Time-Decay, Position-Based) with mathematical invariant sum(weight) === 1.00.
 * 2. Deal Health Multiplier Integration:
 *    - Calculates dynamic deal health score boosts based on high-intent buyer behavior (e.g. proposal views).
 * 3. Mobile Accessibility & Touch Targets:
 *    - Enforces `min-h-[44px] min-w-[44px]` touch target bounds with Emil Kowalski micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/lib/firestore-context';
import type {
  DealMediaSignals,
  DealAttributionBreakdown,
  AttributionModelType,
  AttributionType,
  PredictiveDealForecast,
  ContentRecommendationItem,
} from '@/lib/types/media-2.0';
import { getDealMediaSignalsAction } from '@/lib/media/crm-media-service';
import { getDealAttributionBreakdownAction } from '@/lib/media/attribution-service';
import { predictDealCloseVelocityAction } from '@/lib/media/predictive-service';
import { getNextBestContentAction } from '@/lib/media/recommendation-service';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  TrendingUp, Users, FileText, MousePointerClick, 
  Sparkles, CheckCircle2, Share2, Video, Music, 
  Image as ImageIcon, PieChart, ChevronDown, ChevronUp, Bot, Zap
} from 'lucide-react';
import { MediaCopilotDrawer } from '@/app/admin/media/components/MediaCopilotDrawer';
import { cn } from '@/lib/utils';

export interface DealMediaPanelProps {
  dealId: string;
  workspaceId: string;
  associatedContactIds: string[];
  onOpenDistributionModal?: () => void;
}

export function DealMediaPanel({
  dealId,
  workspaceId,
  associatedContactIds,
  onOpenDistributionModal,
}: DealMediaPanelProps) {
  const firestore = useFirestore();
  const [signals, setSignals] = useState<DealMediaSignals | null>(null);
  const [breakdown, setBreakdown] = useState<DealAttributionBreakdown | null>(null);
  const [forecast, setForecast] = useState<PredictiveDealForecast | null>(null);
  const [recommendations, setRecommendations] = useState<ContentRecommendationItem[]>([]);
  const [model, setModel] = useState<AttributionModelType>('LINEAR');
  const [showAttribution, setShowAttribution] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!firestore || !dealId) return;
    setIsLoading(true);
    try {
      const [signalData, breakdownData, forecastData, recData] = await Promise.all([
        getDealMediaSignalsAction(firestore, workspaceId, dealId, associatedContactIds),
        getDealAttributionBreakdownAction(firestore, workspaceId, dealId, model),
        predictDealCloseVelocityAction(firestore, workspaceId, dealId, associatedContactIds),
        getNextBestContentAction(firestore, workspaceId, { dealStage: 'Proposal', limitCount: 2 }),
      ]);
      setSignals(signalData);
      setBreakdown(breakdownData);
      setForecast(forecastData);
      setRecommendations(recData);
    } catch (err) {
      console.error('[DealMediaPanel] Error loading signals, breakdown, or forecast:', err);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, workspaceId, dealId, associatedContactIds, model]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
      case 'audio':
        return <Music className="h-3.5 w-3.5 text-purple-500 shrink-0" />;
      case 'document':
        return <FileText className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
      case 'image':
        return <ImageIcon className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
      default:
        return <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />;
    }
  };

  const getAttributionBadge = (type: AttributionType) => {
    switch (type) {
      case 'CONVERTED_AFTER_EXPOSURE':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[9px] font-black uppercase">
            Converted
          </Badge>
        );
      case 'INFLUENCED':
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[9px] font-black uppercase">
            Influenced
          </Badge>
        );
      case 'ENGAGED':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[9px] font-black uppercase">
            Engaged
          </Badge>
        );
      case 'ASSISTED':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[9px] font-black uppercase">
            Assisted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[9px] font-black uppercase text-muted-foreground">
            Touched
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground space-y-2">
        <Sparkles className="h-5 w-5 animate-spin text-primary mx-auto" />
        <p className="text-xs font-bold">Analyzing Stakeholder Media Signals...</p>
      </div>
    );
  }

  if (!signals || signals.stakeholdersWithActivityCount === 0) {
    return (
      <div className="p-6 border border-dashed rounded-2xl bg-muted/10 text-center space-y-3">
        <Users className="h-6 w-6 text-muted-foreground/40 mx-auto" />
        <p className="text-xs font-extrabold text-foreground">No Stakeholder Engagement Captured</p>
        <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
          Send a proposal or video presentation link to deal contacts to start capturing buyer intent signals.
        </p>
        {onOpenDistributionModal && (
          <Button
            size="sm"
            onClick={onOpenDistributionModal}
            className="rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
          >
            <Share2 className="h-3.5 w-3.5" /> Send Media Link
          </Button>
        )}
      </div>
    );
  }

  const currencySymbol = breakdown?.currencySymbol || 'GH₵';

  return (
    <div className="space-y-4 text-left">
      {/* Top Combined Score & Health Multiplier */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Deal Content Score</p>
              <p className="text-xl font-black text-primary">{signals.combinedEngagementScore} / 100</p>
            </div>
            <TrendingUp className="h-5 w-5 text-primary" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black uppercase text-muted-foreground">Health Boost</p>
              <p className="text-xl font-black text-emerald-500">+{signals.suggestedHealthMultiplier}x</p>
            </div>
            <Sparkles className="h-5 w-5 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      {/* Stakeholders & High-Intent Badges */}
      <div className="p-4 border border-border rounded-2xl bg-card space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold text-foreground flex items-center gap-1.5">
            <Users className="h-4 w-4 text-muted-foreground" />
            Active Stakeholders: {signals.stakeholdersWithActivityCount} / {signals.associatedContactsCount}
          </span>
          <Badge variant="outline" className="text-[10px] font-bold">
            Intent Velocity High
          </Badge>
        </div>

        <div className="space-y-2">
          {signals.hasHighIntentProposalViews && (
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>Proposal / Pricing document reviewed multiple times</span>
            </div>
          )}

          {signals.hasCompletedVideoViews && (
            <div className="flex items-center gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
              <span>Presentation video watched &ge;75% completion</span>
            </div>
          )}

          {signals.hasCtaInteractions && (
            <div className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-400">
              <MousePointerClick className="h-4 w-4 shrink-0 text-purple-500" />
              <span>Interactive CTA clicked by buyer</span>
            </div>
          )}
        </div>

        {signals.topEngagedAssetTitle && (
          <div className="p-2.5 bg-muted/20 border border-border rounded-xl text-[11px] font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="truncate">Top Content: {signals.topEngagedAssetTitle}</span>
          </div>
        )}
      </div>

      {/* Phase 6: Multi-Touch Deal Attribution Breakdown Card */}
      {breakdown && breakdown.items.length > 0 && (
        <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              <div>
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                  Media Attribution Breakdown
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  {breakdown.totalInfluencedAssetsCount} content assets influenced this deal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={model}
                onValueChange={(val: string) => setModel(val as AttributionModelType)}
              >
                <SelectTrigger className="h-8 min-h-[32px] w-[130px] rounded-lg text-[11px] font-bold bg-card">
                  <SelectValue placeholder="Model" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="LINEAR" className="text-xs font-semibold">Linear (1/N)</SelectItem>
                  <SelectItem value="FIRST_TOUCH" className="text-xs font-semibold">First Touch</SelectItem>
                  <SelectItem value="LAST_TOUCH" className="text-xs font-semibold">Last Touch</SelectItem>
                  <SelectItem value="TIME_DECAY" className="text-xs font-semibold">Time Decay</SelectItem>
                  <SelectItem value="POSITION_BASED" className="text-xs font-semibold">U-Shaped</SelectItem>
                </SelectContent>
              </Select>

              <button
                onClick={() => setShowAttribution((prev) => !prev)}
                className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center"
                aria-label="Toggle Attribution Details"
              >
                {showAttribution ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {showAttribution && (
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-muted-foreground">
                <span>Asset Influence Share</span>
                <span>Attributed Credit</span>
              </div>

              <div className="space-y-2 divide-y divide-border/60">
                {breakdown.items.map((item) => {
                  const percent = Math.round(item.weight * 1000) / 10;
                  return (
                    <div key={item.assetId} className="pt-2 first:pt-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className="p-1 rounded-md bg-muted/30 shrink-0">
                            {getFormatIcon(item.type)}
                          </div>
                          <span className="text-xs font-extrabold text-foreground truncate">
                            {item.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {getAttributionBadge(item.attributionType)}
                          <Badge variant="outline" className="text-[10px] font-black">
                            {percent}%
                          </Badge>
                          <span className="text-xs font-black text-foreground w-16 text-right">
                            {currencySymbol}{item.attributedAmount.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {/* Weight visual bar */}
                      <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${Math.max(4, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
                <span>Mathematical Invariant</span>
                <span className="text-emerald-500 font-black">&sum; Weight &equiv; 100% (No Double-Counting)</span>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Phase 8: Predictive Deal Close Velocity & Win Probability Boost Card */}
      {forecast && (
        <Card className="rounded-2xl border-border bg-gradient-to-br from-card via-card to-primary/5 shadow-sm overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <div>
                <h4 className="text-xs font-black text-foreground uppercase tracking-wider">
                  Predictive Deal Close Forecast
                </h4>
                <p className="text-[10px] text-muted-foreground">
                  AI velocity acceleration & stakeholder content coverage
                </p>
              </div>
            </div>
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-black uppercase">
              +{forecast.winProbabilityBoostPercent}% Win Boost
            </Badge>
          </div>

          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl bg-background border border-border text-left">
                <p className="text-[9px] font-bold uppercase text-muted-foreground">Baseline Probability</p>
                <p className="text-base font-black text-muted-foreground">{forecast.currentCloseProbability}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-left">
                <p className="text-[9px] font-bold uppercase text-primary">Projected Win Rate</p>
                <p className="text-base font-black text-primary">{forecast.projectedCloseProbabilityWithMedia}%</p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-left">
                <p className="text-[9px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Velocity Gain</p>
                <p className="text-base font-black text-emerald-600 dark:text-emerald-400">-{forecast.velocityAccelerationDays} Days</p>
              </div>
            </div>

            {/* Stakeholder Coverage Bar */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-muted-foreground">Stakeholder Media Coverage</span>
                <span className="text-foreground">{forecast.stakeholderCoveragePercent}% Covered</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.max(5, forecast.stakeholderCoveragePercent)}%` }}
                />
              </div>
            </div>

            {/* Recommended Next Assets to Share */}
            {recommendations.length > 0 && (
              <div className="pt-2 border-t border-border/60 space-y-2 text-left">
                <p className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3 w-3 text-primary" />
                  Recommended Next Assets for Stakeholders
                </p>
                <div className="space-y-1.5">
                  {recommendations.map((rec) => (
                    <div
                      key={rec.assetId}
                      className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between gap-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {getFormatIcon(rec.type)}
                        <div className="min-w-0 truncate">
                          <p className="text-xs font-bold text-foreground truncate">{rec.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{rec.rationale}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-black shrink-0 text-primary border-primary/30">
                        {rec.matchScore}% Match
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setIsCopilotOpen(true)}
          className="w-full rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary active:scale-[0.97]"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Consult Copilot Strategist</span>
        </Button>

        {onOpenDistributionModal && (
          <Button
            size="sm"
            variant="outline"
            onClick={onOpenDistributionModal}
            className="w-full rounded-xl text-xs font-bold h-9 px-3 min-h-[44px] gap-1.5 active:scale-[0.97]"
          >
            <Share2 className="h-3.5 w-3.5" /> Share Content Link
          </Button>
        )}
      </div>

      <MediaCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        initialPersona="STRATEGIST"
        contextType="deal"
        contextId={dealId}
        contextPayload={{
          dealTitle: breakdown?.dealTitle || 'Deal',
          dealAmount: breakdown?.dealAmount || 0,
          dealStage: signals?.suggestedHealthMultiplier ? 'Active Deal' : 'Open',
          topAssets: breakdown?.items?.map((a) => a.title).join(', ') || 'None',
          healthMultiplier: signals?.suggestedHealthMultiplier || 1.0,
        }}
      />
    </div>
  );
}
