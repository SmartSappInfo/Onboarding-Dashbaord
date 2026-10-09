'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — 4-Card Responsive KPI Metrics Grid
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Renders the 4 primary operational stat cards matching user mockup (media_1791516336748_2f0e908d.jpg):
 *   1. Messages Sent (Volume + 7-day trend delta)
 *   2. Delivery Rate (Percentage + 7-day delta)
 *   3. SMS Unit Balance (Count + Top up shortcut + low balance alert)
 *   4. Provider Status (Health pill + pulsing indicator)
 * - Mobile ergonomics (Rule 7):
 *   - Desktop: 4 columns (lg:grid-cols-4).
 *   - Tablet & Mobile: 2x2 grid (grid-cols-2 gap-3 sm:gap-4).
 * - Skeleton component prevents layout shift (CLS) during server action aggregation (Rule 1 & 2).
 * - Strict Zero-Any Invariant (Rule 4).
 * - Safe relative billing navigation (Rule 8).
 */

import * as React from 'react';
import { MessageSquare, CheckCircle2, Smartphone, ShieldCheck } from 'lucide-react';
import type { MessagingKpiMetrics } from '@/lib/types/messaging-dashboard';
import {
  formatMetricNumber,
  formatTrendDelta,
  resolveProviderStatusDisplay,
  resolveSmsBalanceStatus,
} from '@/lib/messaging/kpi-utils';
import { MessagingKpiCard } from './MessagingKpiCard';
import { cn } from '@/lib/utils';

export interface MessagingKpiGridProps {
  metrics?: MessagingKpiMetrics | null;
  isLoading?: boolean;
  lowBalanceThreshold?: number;
  className?: string;
  onTopUpClick?: () => void;
}

export function MessagingKpiGridSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-label="Loading metrics"
      className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5', className)}
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          data-testid="kpi-skeleton-card"
          className="rounded-2xl border border-border/60 bg-card p-3.5 sm:p-4 md:p-5 shadow-xs animate-pulse flex flex-col justify-between min-h-[120px] sm:min-h-[135px]"
        >
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 sm:w-24 bg-muted rounded-md" />
            <div className="h-8 w-8 bg-muted rounded-xl" />
          </div>
          <div className="my-2">
            <div className="h-7 w-24 sm:w-32 bg-muted rounded-lg" />
          </div>
          <div className="h-4 w-16 bg-muted rounded-md" />
        </div>
      ))}
    </div>
  );
}

export function MessagingKpiGrid({
  metrics,
  isLoading = false,
  lowBalanceThreshold = 100,
  className,
  onTopUpClick,
}: MessagingKpiGridProps) {
  if (isLoading || !metrics) {
    return <MessagingKpiGridSkeleton className={className} />;
  }

  // Card 1: Messages Sent
  const messagesSentTrend = formatTrendDelta(metrics.messagesSentDeltaPercentage);

  // Card 2: Delivery Rate
  const deliveryRateTrend = formatTrendDelta(metrics.deliveryRateDeltaPercentage, true);

  // Card 3: SMS Unit Balance
  const smsStatus = resolveSmsBalanceStatus(metrics.smsBalance, lowBalanceThreshold);

  // Card 4: Provider Status
  const providerDisplay = resolveProviderStatusDisplay(metrics.providerStatus);

  return (
    <div
      className={cn(
        // Responsive 2x2 grid on mobile/tablet; 4-column row on desktop
        'grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-5',
        className
      )}
    >
      {/* 1. Messages Sent */}
      <MessagingKpiCard
        title="Messages Sent"
        value={formatMetricNumber(metrics.messagesSent)}
        icon={<MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
        trend={messagesSentTrend}
        subtitle="vs. last 7 days"
      />

      {/* 2. Delivery Rate */}
      <MessagingKpiCard
        title="Delivery Rate"
        value={`${metrics.deliveryRate.toFixed(1)}%`}
        icon={<CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
        trend={deliveryRateTrend}
        subtitle="vs. last 7 days"
      />

      {/* 3. SMS Unit Balance */}
      <MessagingKpiCard
        title="SMS Unit Balance"
        value={formatMetricNumber(metrics.smsBalance)}
        icon={<Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-orange-50 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400"
        badge={
          smsStatus.isLow
            ? {
                label: smsStatus.badgeLabel ?? 'Low balance',
                variant: smsStatus.isExhausted ? 'rose' : 'amber',
              }
            : undefined
        }
        actionLink={{
          label: 'Top up now →',
          href: '/admin/settings?tab=billing',
          onClick: onTopUpClick,
        }}
      />

      {/* 4. Provider Status */}
      <MessagingKpiCard
        title="Provider Status"
        value={metrics.providerStatusLabel}
        icon={<ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5" />}
        iconBgClass="bg-purple-50 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
        badge={{
          label: providerDisplay.label,
          variant: providerDisplay.badgeVariant,
          indicatorDotClass: cn(providerDisplay.dotColorClass, 'animate-pulse'),
        }}
      />
    </div>
  );
}
