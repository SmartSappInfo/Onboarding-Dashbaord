'use client';

/**
 * @fileOverview SmartSapp Messaging Dashboard — Stat Card Component
 * 
 * ARCHITECTURAL GUIDANCE (Rule 10 Maintainer Guidance):
 * - Institutional card geometry adhering to theme.md Section 4:
 *   - Surface: bg-card text-card-foreground border border-border/80 rounded-2xl shadow-xs hover:shadow-md transition-all.
 *   - Tabular numbers (tabular-nums) to prevent layout shifting on data refresh (Rule 1 & 2).
 *   - Directional trend badge with high contrast for both light and dark modes.
 *   - Mobile ergonomics: Compact padding for 2x2 mobile grid (p-3.5 sm:p-4 md:p-5), touch targets min-h-[44px].
 * - Strict Zero-Any Invariant (Rule 4).
 * - Safe relative routing (Rule 8).
 */

import * as React from 'react';
import Link from 'next/link';
import type { TrendDeltaResult } from '@/lib/messaging/kpi-utils';
import { cn } from '@/lib/utils';

export interface MessagingKpiCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  iconBgClass: string;
  trend?: TrendDeltaResult;
  subtitle?: string;
  badge?: {
    label: string;
    variant: 'emerald' | 'amber' | 'rose';
    indicatorDotClass?: string;
  };
  actionLink?: {
    label: string;
    href: string;
    onClick?: () => void;
  };
  className?: string;
}

export function MessagingKpiCard({
  title,
  value,
  icon,
  iconBgClass,
  trend,
  subtitle,
  badge,
  actionLink,
  className,
}: MessagingKpiCardProps) {
  return (
    <div
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden',
        'rounded-2xl border border-border/80 bg-card p-3.5 sm:p-4 md:p-5 text-card-foreground',
        'shadow-xs hover:shadow-md hover:border-border transition-all duration-200',
        className
      )}
    >
      {/* Top Header: Title & Icon Container */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs sm:text-sm font-medium text-muted-foreground line-clamp-1">
          {title}
        </span>
        <div
          className={cn(
            'flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105',
            iconBgClass
          )}
        >
          {icon}
        </div>
      </div>

      {/* Main Metric Value */}
      <div className="my-2 sm:my-2.5">
        <span
          className={cn(
            'font-bold tracking-tight text-foreground tabular-nums block line-clamp-1',
            typeof value === 'number' || (typeof value === 'string' && /^\d+/.test(value))
              ? 'text-xl sm:text-2xl lg:text-3xl'
              : 'text-base sm:text-lg lg:text-xl'
          )}
        >
          {value}
        </span>
      </div>

      {/* Bottom Subtitle / Trend Badge / Action Link */}
      <div className="flex items-center justify-between gap-1.5 text-xs flex-wrap">
        {/* Trend or Status Badge */}
        {trend && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] sm:text-xs font-semibold tabular-nums',
                trend.isPositive
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : trend.isNeutral
                  ? 'bg-muted text-muted-foreground border border-border'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              )}
            >
              {trend.formatted}
            </span>
            {subtitle && (
              <span className="text-[11px] sm:text-xs text-muted-foreground/80 line-clamp-1">
                {subtitle}
              </span>
            )}
          </div>
        )}

        {badge && (
          <div className="flex items-center gap-1.5">
            {badge.indicatorDotClass && (
              <span
                aria-hidden="true"
                className={cn('h-2 w-2 rounded-full shrink-0', badge.indicatorDotClass)}
              />
            )}
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] sm:text-xs font-medium',
                badge.variant === 'emerald'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : badge.variant === 'amber'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
              )}
            >
              {badge.label}
            </span>
          </div>
        )}

        {/* Action Link (e.g. Top up now →) */}
        {actionLink && (
          <Link
            href={actionLink.href}
            onClick={actionLink.onClick}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400',
              'hover:text-blue-700 dark:hover:text-blue-300 hover:underline',
              'active:scale-[0.97] transition-all min-h-[44px] cursor-pointer'
            )}
          >
            <span>{actionLink.label}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
