'use client';

/**
 * @fileoverview Commercial Analytics & AI Insights Tab
 *
 * ARCHITECTURAL POINTER (Revenue Intelligence & Pricing Advisor - Rule 10):
 * Embeds interactive visual breakdown of catalog commercial performance:
 * - Won revenue leaderboard across SKUs and subscription tiers
 * - Category revenue share & MRR contribution
 * - Discount depth analysis & margin health
 * - Deterministic AI pricing & bundling recommendations
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - All percentages must be clamped between 0 and 100%.
 * - Action buttons must adhere to min 44px mobile touch guidelines.
 * - Zero 'any' or 'any[]' in types.
 */

import * as React from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  Layers, 
  Sparkles, 
  ArrowUpRight, 
  Percent, 
  Repeat, 
  AlertTriangle,
  Lightbulb,
  CheckCircle2,
  Tag
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency-utils';
import type { CommercialAnalyticsSummary } from '@/lib/types';
import { generateCatalogPricingRecommendations } from '@/lib/deals/deal-commercial-analytics';

interface CatalogAnalyticsTabProps {
  summary: CommercialAnalyticsSummary;
  currency?: string;
  isLoading?: boolean;
}

export default function CatalogAnalyticsTab({
  summary,
  currency = 'USD',
  isLoading = false,
}: CatalogAnalyticsTabProps) {
  const recommendations = React.useMemo(() => {
    return generateCatalogPricingRecommendations(summary);
  }, [summary]);

  const maxProductRevenue = React.useMemo(() => {
    if (!summary.topProducts.length) return 1;
    return Math.max(1, ...summary.topProducts.map(p => p.totalRevenueWon));
  }, [summary.topProducts]);

  if (isLoading) {
    return (
      <div className="space-y-6 text-left">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-2xl border-border/60 bg-card p-4 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-3 w-20" />
            </Card>
          ))}
        </div>
        <Card className="rounded-3xl border-border/60 bg-card p-6 space-y-4">
          <Skeleton className="h-5 w-48" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left">
      {/* KPI Top Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Won Revenue */}
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Catalog Revenue Won</span>
            <DollarSign className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-foreground tracking-tight">
            {formatCurrency(summary.totalCatalogRevenueWon, currency)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
            <span>From closed won deals</span>
          </div>
        </Card>

        {/* Normalized MRR */}
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Recurring MRR Contribution</span>
            <Repeat className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl font-black text-primary tracking-tight">
            {formatCurrency(summary.recurringVsOneTimeRatio.mrr, currency)}
            <span className="text-xs font-bold text-muted-foreground ml-1">/mo</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold flex items-center gap-1">
            <span>ARR: {formatCurrency(summary.recurringVsOneTimeRatio.arr, currency)}</span>
          </div>
        </Card>

        {/* Recurring Mix Ratio */}
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Recurring Revenue Mix</span>
            <Percent className="h-4 w-4 text-purple-500" />
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
            {summary.recurringVsOneTimeRatio.recurringPercentage}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
            <span>Recurring vs one-time fees</span>
          </div>
        </Card>

        {/* Average Discount Depth */}
        <Card className="rounded-2xl border-border/60 bg-card p-4 shadow-xs hover:border-primary/30 transition-all">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-bold mb-1">
            <span>Avg Discount Depth</span>
            <TrendingUp className="h-4 w-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tight">
            {summary.avgDiscountDepth}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 font-semibold">
            <span>{summary.avgDiscountDepth > 15 ? 'Elevated discounting' : 'Healthy margin health'}</span>
          </div>
        </Card>
      </div>

      {/* AI Pricing & Commercial Insights Card */}
      <Card className="rounded-3xl border-primary/20 bg-gradient-to-r from-primary/5 via-card to-background p-5 md:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">AI Commercial Intelligence & Pricing Tips</h3>
              <p className="text-xs text-muted-foreground">Automated observations and pricing guidance based on catalog win rates</p>
            </div>
          </div>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-extrabold uppercase px-2 py-0.5">
            Real-Time Engine
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {recommendations.map(rec => (
            <div 
              key={rec.id} 
              className="p-4 rounded-2xl bg-card border border-border/60 space-y-2 hover:border-primary/30 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {rec.type === 'warning' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  ) : rec.type === 'opportunity' ? (
                    <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Lightbulb className="h-4 w-4 text-primary shrink-0" />
                  )}
                  <span className="text-xs font-bold text-foreground">{rec.title}</span>
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-[9px] font-black uppercase px-1.5 h-4 ${
                    rec.impactScore === 'high' ? 'border-destructive/30 text-destructive bg-destructive/5' : 'border-border text-muted-foreground'
                  }`}
                >
                  {rec.impactScore} Impact
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                {rec.description}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Grid: Top Products Leaderboard & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Products Leaderboard */}
        <Card className="lg:col-span-2 rounded-3xl border-border/60 bg-card p-5 space-y-4 shadow-xs">
          <CardHeader className="p-0 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                <span>Commercial Leaderboard: Revenue & Velocity</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Performance matrix by SKU and Subscription Package
              </CardDescription>
            </div>
          </CardHeader>

          <div className="space-y-3">
            {summary.topProducts.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No closed deals with line items recorded yet.
              </div>
            ) : (
              summary.topProducts.slice(0, 8).map(prod => {
                const progressPercent = Math.min(100, Math.max(0, Math.round((prod.totalRevenueWon / maxProductRevenue) * 100)));

                return (
                  <div key={prod.skuOrId} className="space-y-1.5 p-3 rounded-2xl bg-muted/20 border border-border/40 hover:border-primary/20 transition-all">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{prod.name}</span>
                        <Badge variant="outline" className="text-[9px] font-bold px-1.5 py-0 h-4">
                          {prod.categoryName}
                        </Badge>
                        {prod.isRecurring && (
                          <Badge className="bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold px-1.5 py-0 h-4">
                            Recurring
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-muted-foreground text-[11px] font-semibold">
                          Win Rate: <strong className="text-foreground">{prod.winRatePercentage}%</strong> ({prod.dealsWonCount}/{prod.dealsTotalCount})
                        </span>
                        <span className="font-black text-foreground">
                          {formatCurrency(prod.totalRevenueWon, currency)}
                        </span>
                      </div>
                    </div>
                    <Progress value={progressPercent} className="h-1.5 bg-muted/50" />
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Category Share Donut / Bar breakdown */}
        <Card className="rounded-3xl border-border/60 bg-card p-5 space-y-4 shadow-xs">
          <CardHeader className="p-0">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" />
              <span>Category Revenue Share</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Revenue contribution by product category
            </CardDescription>
          </CardHeader>

          <div className="space-y-3 pt-1">
            {summary.categoryBreakdown.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No category data available.
              </div>
            ) : (
              summary.categoryBreakdown.map(cat => (
                <div key={cat.categoryId} className="space-y-1 p-2.5 rounded-xl bg-muted/20 border border-border/30">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#4f46e5' }} />
                      <span className="font-bold text-foreground text-[11px]">{cat.categoryName}</span>
                    </div>
                    <span className="font-black text-[11px] text-foreground">
                      {formatCurrency(cat.totalRevenueWon, currency)} ({cat.revenuePercentage}%)
                    </span>
                  </div>
                  <Progress value={cat.revenuePercentage} className="h-1 bg-muted/50" />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
