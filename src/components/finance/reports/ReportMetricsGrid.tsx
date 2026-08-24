'use client';

/**
 * SmartSapp Finance 2.0 - Report Metrics Grid Component
 * Standardized KPI telemetry cards for modular financial reports.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportMetricItem } from '@/lib/types';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export interface ReportMetricsGridProps {
  metrics: ReportMetricItem[];
}

export function ReportMetricsGrid({ metrics }: ReportMetricsGridProps) {
  if (!metrics || metrics.length === 0) return null;

  const getBorderColor = (variant?: 'default' | 'success' | 'warning' | 'danger') => {
    switch (variant) {
      case 'success': return 'border-l-emerald-500';
      case 'warning': return 'border-l-amber-500';
      case 'danger': return 'border-l-rose-500';
      default: return 'border-l-primary';
    }
  };

  const getValueColor = (variant?: 'default' | 'success' | 'warning' | 'danger') => {
    switch (variant) {
      case 'success': return 'text-emerald-600 dark:text-emerald-400';
      case 'warning': return 'text-amber-600 dark:text-amber-400';
      case 'danger': return 'text-rose-600 dark:text-rose-400';
      default: return 'text-foreground';
    }
  };

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(metrics.length, 4)} gap-4`}>
      {metrics.map((item) => (
        <Card
          key={item.id}
          className={`rounded-2xl border bg-card p-4 shadow-sm space-y-1.5 border-l-4 ${getBorderColor(item.variant)}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              {item.label}
            </span>
            {item.trend && (
              <Badge variant="outline" className="text-[10px] flex items-center gap-0.5">
                {item.trend.direction === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-600" />}
                {item.trend.direction === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-600" />}
                {item.trend.direction === 'neutral' && <Minus className="h-3 w-3 text-muted-foreground" />}
                {item.trend.label}
              </Badge>
            )}
          </div>

          <div className={`text-2xl font-black tracking-tight ${getValueColor(item.variant)}`}>
            {item.value}
          </div>

          {item.subtext && (
            <p className="text-xs text-muted-foreground">
              {item.subtext}
            </p>
          )}
        </Card>
      ))}
    </div>
  );
}
