'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Executive Media Command Center:
 *    - Synthesizes media viewing telemetry with CRM Deals, Closed-Won Revenue, and Deal Velocity.
 *    - Real-time recalculation across 5 attribution models (Linear, First-Touch, Last-Touch, Time-Decay, Position-Based).
 *    - Enforces strict mathematical invariant: sum(weight_i) === 1.00 (no double-counted revenue).
 * 2. Responsive UI & Accessibility:
 *    - All buttons, selector controls, and interactive KPI cards conform to `min-h-[44px] min-w-[44px]`.
 *    - Emil Kowalski micro-animations (`active:scale-[0.97]`).
 * 3. Strict Typing Standard:
 *    - Zero use of `any` or `any[]`.
 */

import * as React from 'react';
import { useFirestore } from '@/lib/firestore-context';
import type {
  AttributionModelType,
  MediaInfluenceSummary,
} from '@/lib/types/media-2.0';
import {
  getMediaInfluenceSummaryAction,
  getAttributionGovernanceConfigAction,
} from '@/lib/media/attribution-service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  TrendingUp,
  Clock,
  Eye,
  Users,
  Target,
  BarChart3,
  Video,
  FileText,
  Music,
  Image as ImageIcon,
  CheckCircle2,
  MousePointerClick,
  Sparkles,
  ArrowRight,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { MediaCopilotDrawer } from '@/app/admin/media/components/MediaCopilotDrawer';
import { cn } from '@/lib/utils';

interface MediaCommandCenterProps {
  workspaceId: string;
  onNavigateToAsset?: (assetId: string) => void;
  onOpenExplorerTab?: () => void;
}

const MODEL_DESCRIPTIONS: Record<AttributionModelType, { label: string; desc: string }> = {
  LINEAR: {
    label: 'Linear (1/N Equal)',
    desc: 'Distributes 100% of deal value equally across all touched media assets.',
  },
  FIRST_TOUCH: {
    label: 'First-Touch (100% Lead Gen)',
    desc: 'Awards 100% credit to the initial media asset that first introduced the contact.',
  },
  LAST_TOUCH: {
    label: 'Last-Touch (100% Closer)',
    desc: 'Awards 100% credit to the final media asset consumed before deal closure.',
  },
  TIME_DECAY: {
    label: 'Time-Decay (7-Day Half-Life)',
    desc: 'Exponential decay favoring touchpoints consumed closest in time to deal signing.',
  },
  POSITION_BASED: {
    label: 'Position-Based (40/20/40 U-Shape)',
    desc: '40% first touch, 40% last touch, and 20% distributed among middle assists.',
  },
};

export function MediaCommandCenter({
  workspaceId,
  onNavigateToAsset,
  onOpenExplorerTab,
}: MediaCommandCenterProps) {
  const firestore = useFirestore();
  const [model, setModel] = React.useState<AttributionModelType>('LINEAR');
  const [lookbackDays, setLookbackDays] = React.useState<number>(30);
  const [summary, setSummary] = React.useState<MediaInfluenceSummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [isCopilotOpen, setIsCopilotOpen] = React.useState(false);

  // Load Initial Governance Config
  React.useEffect(() => {
    let isMounted = true;
    async function loadConfig() {
      if (!firestore || !workspaceId) return;
      try {
        const config = await getAttributionGovernanceConfigAction(firestore, workspaceId);
        if (isMounted && config.defaultModel) {
          setModel(config.defaultModel);
          if (config.defaultLookbackDays) {
            setLookbackDays(config.defaultLookbackDays);
          }
        }
      } catch (err) {
        console.error('[MediaCommandCenter] Failed to load governance config:', err);
      }
    }
    loadConfig();
    return () => {
      isMounted = false;
    };
  }, [firestore, workspaceId]);

  // Fetch Summary when model or lookbackDays changes
  const fetchSummary = React.useCallback(
    async (showRefreshIndicator = false) => {
      if (!firestore || !workspaceId) return;
      if (showRefreshIndicator) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const data = await getMediaInfluenceSummaryAction(firestore, workspaceId, {
          model,
          lookbackDays,
        });
        setSummary(data);
      } catch (err) {
        console.error('[MediaCommandCenter] Error fetching summary:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [firestore, workspaceId, model, lookbackDays]
  );

  React.useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const currencySymbol = summary?.currencySymbol || 'GH₵';

  const formatCurrency = (amount: number) => {
    return `${currencySymbol}${amount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const getFormatIcon = (type: string) => {
    switch (type) {
      case 'video':
        return <Video className="h-4 w-4 text-blue-500 shrink-0" />;
      case 'audio':
        return <Music className="h-4 w-4 text-purple-500 shrink-0" />;
      case 'document':
        return <FileText className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'image':
        return <ImageIcon className="h-4 w-4 text-emerald-500 shrink-0" />;
      default:
        return <Video className="h-4 w-4 text-muted-foreground shrink-0" />;
    }
  };

  const getAttributionBadge = (type: string) => {
    switch (type) {
      case 'CONVERTED_AFTER_EXPOSURE':
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-extrabold uppercase">
            Converted
          </Badge>
        );
      case 'INFLUENCED':
        return (
          <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-extrabold uppercase">
            Influenced
          </Badge>
        );
      case 'ENGAGED':
        return (
          <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-extrabold uppercase">
            Engaged
          </Badge>
        );
      case 'ASSISTED':
        return (
          <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-extrabold uppercase">
            Assisted
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-extrabold uppercase text-muted-foreground">
            Touched
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4 text-center">
        <Sparkles className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-extrabold text-foreground">
          Synthesizing Media Attribution & Deal Velocity...
        </p>
        <p className="text-xs text-muted-foreground max-w-sm">
          Crunching touchpoint weights, funnel progression, and pipeline influence invariants.
        </p>
      </div>
    );
  }

  const s = summary;

  return (
    <div className="space-y-6 text-left">
      {/* Top Filter Bar: Attribution Model Switcher + Lookback Window Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/20 border border-border">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
              Attribution Model
            </span>
            <Select
              value={model}
              onValueChange={(val: string) => setModel(val as AttributionModelType)}
            >
              <SelectTrigger className="w-[260px] h-10 min-h-[44px] rounded-xl text-xs font-bold mt-1 bg-card">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {(Object.keys(MODEL_DESCRIPTIONS) as AttributionModelType[]).map((m) => (
                  <SelectItem key={m} value={m} className="text-xs font-semibold">
                    {MODEL_DESCRIPTIONS[m].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
              Lookback Window
            </span>
            <Select
              value={String(lookbackDays)}
              onValueChange={(val: string) => setLookbackDays(Number(val))}
            >
              <SelectTrigger className="w-[140px] h-10 min-h-[44px] rounded-xl text-xs font-bold mt-1 bg-card">
                <SelectValue placeholder="Lookback" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="14" className="text-xs font-semibold">Past 14 Days</SelectItem>
                <SelectItem value="30" className="text-xs font-semibold">Past 30 Days</SelectItem>
                <SelectItem value="60" className="text-xs font-semibold">Past 60 Days</SelectItem>
                <SelectItem value="90" className="text-xs font-semibold">Past 90 Days</SelectItem>
                <SelectItem value="180" className="text-xs font-semibold">Past 180 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Refresh & Model Description Subtext */}
        <div className="flex items-center gap-2">
          <div className="hidden lg:block text-right max-w-xs">
            <span className="text-[11px] text-muted-foreground font-medium flex items-center justify-end gap-1">
              <HelpCircle className="h-3 w-3 text-primary shrink-0" />
              {MODEL_DESCRIPTIONS[model].desc}
            </span>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsCopilotOpen(true)}
            className="rounded-xl h-10 px-3 min-h-[44px] gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary active:scale-[0.97] font-bold text-xs shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Ask Copilot Analyst</span>
            <span className="sm:hidden">Copilot</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchSummary(true)}
            disabled={isRefreshing}
            className="rounded-xl h-10 px-3 min-h-[44px] gap-1.5 active:scale-[0.97] font-bold text-xs shrink-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 7 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Pipeline Influenced */}
        <Card className="rounded-2xl border-border bg-card shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Pipeline Influenced
              </span>
              <span className="text-2xl font-black text-foreground block">
                {formatCurrency(s?.totalPipelineInfluenced || 0)}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                Across open deals touched by media
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 2: Attributed Won Revenue */}
        <Card className="rounded-2xl border-border bg-card shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Attributed Revenue
              </span>
              <span className="text-2xl font-black text-emerald-500 block">
                {formatCurrency(s?.totalInfluencedRevenue || 0)}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block">
                Closed-Won with {model.replace('_', ' ')} credit
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 3: Sales Velocity Acceleration */}
        <Card className="rounded-2xl border-border bg-card shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Cycle Acceleration
              </span>
              <span className="text-2xl font-black text-blue-500 block">
                +{s?.avgDealAccelerationDays || 0} Days
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                Faster close time vs non-media deals
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        {/* KPI 4: Influenced Deals Ratio */}
        <Card className="rounded-2xl border-border bg-card shadow-sm hover:border-primary/20 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Influenced Deals
              </span>
              <span className="text-2xl font-black text-foreground block">
                {s?.influencedDealsCount || 0} / {s?.totalDealsCount || 0}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                {s && s.totalDealsCount > 0
                  ? `${Math.round((s.influencedDealsCount / s.totalDealsCount) * 100)}% of sales pipeline`
                  : '0% pipeline penetration'}
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Target className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary KPI Row: Media Consumption Velocity */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Total Media Views
              </span>
              <span className="text-xl font-black text-foreground block mt-0.5">
                {s?.totalViewsCount || 0}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                Across {s?.totalAssetsCount || 0} assets in catalog
              </span>
            </div>
            <Eye className="h-5 w-5 text-muted-foreground/60" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Contacts Engaged
              </span>
              <span className="text-xl font-black text-foreground block mt-0.5">
                {s?.totalUniqueContactsCount || 0}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                Identified CRM prospects & buyers
              </span>
            </div>
            <Users className="h-5 w-5 text-muted-foreground/60" />
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider block">
                Avg Engagement & CTA
              </span>
              <span className="text-xl font-black text-foreground block mt-0.5">
                {s?.avgEngagementRate || 0}% / {s?.avgCtaConversionRate || 0}%
              </span>
              <span className="text-[10px] text-muted-foreground font-medium block">
                Watch completion vs CTA conversion
              </span>
            </div>
            <MousePointerClick className="h-5 w-5 text-muted-foreground/60" />
          </CardContent>
        </Card>
      </div>

      {/* Conversion Funnel Progression Visualizer */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Full-Funnel Content Conversion
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Step-by-step conversion drop-off from initial media view to closed-won deal.
              </p>
            </div>
            {onOpenExplorerTab && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onOpenExplorerTab}
                className="text-xs font-bold gap-1 min-h-[44px] active:scale-[0.97]"
              >
                Attribution Explorer <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 pt-2">
            {[
              { label: '1. Views', count: s?.funnel.views || 0, color: 'bg-slate-500' },
              { label: '2. Plays', count: s?.funnel.plays || 0, color: 'bg-blue-500' },
              { label: '3. Halfway (50%)', count: s?.funnel.halfway || 0, color: 'bg-indigo-500' },
              { label: '4. Completed', count: s?.funnel.completions || 0, color: 'bg-purple-500' },
              { label: '5. CTA Clicks', count: s?.funnel.ctaClicks || 0, color: 'bg-pink-500' },
              { label: '6. Deals Created', count: s?.funnel.dealsCreated || 0, color: 'bg-amber-500' },
              { label: '7. Deals Won', count: s?.funnel.dealsWon || 0, color: 'bg-emerald-500' },
            ].map((step, idx, arr) => {
              const prev = idx === 0 ? step.count : arr[idx - 1].count;
              const dropPercent = prev > 0 ? Math.round((step.count / prev) * 100) : 0;

              return (
                <div
                  key={step.label}
                  className="p-3 rounded-xl border border-border bg-muted/10 space-y-1.5"
                >
                  <span className="text-[10px] font-black uppercase text-muted-foreground block truncate">
                    {step.label}
                  </span>
                  <span className="text-lg font-black text-foreground block">
                    {step.count.toLocaleString()}
                  </span>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', step.color)}
                      style={{
                        width: `${Math.min(100, Math.max(8, dropPercent))}%`,
                      }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground font-semibold block">
                    {idx === 0 ? 'Top of funnel' : `${dropPercent}% conversion`}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top Revenue-Influencing Assets Leaderboard */}
      <Card className="rounded-2xl border-border bg-card shadow-sm overflow-hidden">
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Top Revenue-Influencing Content
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                Assets driving the highest closed-won deal value under the active {model} model.
              </p>
            </div>
            <Badge variant="outline" className="text-[10px] font-black uppercase self-start sm:self-auto">
              Invariant: &sum; Weights &equiv; 1.00
            </Badge>
          </div>

          {s?.topInfluencingAssets && s.topInfluencingAssets.length > 0 ? (
            <div className="divide-y divide-border">
              {s.topInfluencingAssets.map((asset, index) => {
                const maxRevenue = s.topInfluencingAssets[0]?.attributedRevenue || 1;
                const revenuePercent = Math.min(
                  100,
                  Math.round((asset.attributedRevenue / maxRevenue) * 100)
                );

                return (
                  <div
                    key={asset.assetId}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/10 px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-xs font-black text-muted-foreground/60 w-5 shrink-0">
                        #{index + 1}
                      </span>
                      <div className="p-2 rounded-lg bg-muted/20 shrink-0">
                        {getFormatIcon(asset.type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          onClick={() => onNavigateToAsset && onNavigateToAsset(asset.assetId)}
                          className={cn(
                            'text-xs font-extrabold text-foreground truncate',
                            onNavigateToAsset && 'hover:text-primary cursor-pointer'
                          )}
                        >
                          {asset.title}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground font-medium">
                          <span>{asset.viewsCount} views</span>
                          <span>&bull;</span>
                          <span>{asset.completionRate}% completion</span>
                          <span>&bull;</span>
                          <span>{asset.influencedDealsCount} deals influenced</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                      {getAttributionBadge(asset.topAttributionType)}
                      <div className="text-right w-28">
                        <span className="text-xs font-black text-foreground block">
                          {formatCurrency(asset.attributedRevenue)}
                        </span>
                        <div className="w-full bg-muted rounded-full h-1 mt-1 overflow-hidden">
                          <div
                            className="bg-emerald-500 h-full rounded-full"
                            style={{ width: `${Math.max(5, revenuePercent)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 border border-dashed rounded-xl bg-muted/10 text-center space-y-2">
              <BarChart3 className="h-6 w-6 text-muted-foreground/40 mx-auto" />
              <p className="text-xs font-extrabold text-foreground">
                No Influenced Revenue Captured Yet
              </p>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                As prospects view shared media links and progress into closed-won CRM deals, attributed revenue will populate here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <MediaCopilotDrawer
        isOpen={isCopilotOpen}
        onClose={() => setIsCopilotOpen(false)}
        initialPersona="ANALYST"
        contextType="analytics"
        contextPayload={{
          model,
          lookbackDays,
          totalInfluencedRevenue: summary?.totalInfluencedRevenue || 0,
          totalDealsInfluenced: summary?.totalDealsInfluenced || 0,
          avgDealVelocityDays: summary?.avgDealVelocityDays || 0,
          viewToDealConversionRate: summary?.funnelMetrics?.viewToDealConversionRate || 0,
          topAssets: summary?.topInfluencingAssets?.map(a => a.title).slice(0, 3).join(', ') || 'None',
        }}
      />
    </div>
  );
}
