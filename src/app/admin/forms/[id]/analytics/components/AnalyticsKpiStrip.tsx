'use client';

/**
 * SmartSapp Forms 2.0: Analytics KPI Strip
 * 
 * Renders 5 executive performance cards: Visitors, Starts, Submissions,
 * Conversion Rate %, and Average Completion Time with status indicators.
 */

import React from 'react';
import { 
  Users, 
  PlayCircle, 
  CheckCircle2, 
  TrendingUp, 
  Clock, 
  ArrowUpRight,
  TrendingDown
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDurationSeconds } from '@/lib/forms/form-analytics-actions';
import type { FormAnalyticsSummary } from '@/lib/forms/form-analytics-types';

interface AnalyticsKpiStripProps {
  summary: FormAnalyticsSummary;
}

export default function AnalyticsKpiStrip({ summary }: AnalyticsKpiStripProps) {
  const kpis = [
    {
      id: 'visitors',
      title: 'Total Visitors',
      value: summary.totalVisitors.toLocaleString(),
      subtitle: `${summary.totalStarts.toLocaleString()} started intake`,
      icon: Users,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      id: 'starts',
      title: 'Form Starts',
      value: summary.totalStarts.toLocaleString(),
      subtitle: `${summary.completionRate}% completion rate`,
      icon: PlayCircle,
      color: 'text-indigo-500',
      bgColor: 'bg-indigo-500/10',
    },
    {
      id: 'submissions',
      title: 'Total Submissions',
      value: summary.totalSubmissions.toLocaleString(),
      subtitle: `${summary.dropOffRate}% drop-off rate`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
    {
      id: 'conversion',
      title: 'Conversion Rate',
      value: `${summary.overallConversionRate}%`,
      subtitle: summary.overallConversionRate >= 20 ? 'High performing' : 'Room for optimization',
      icon: TrendingUp,
      color: summary.overallConversionRate >= 20 ? 'text-emerald-500' : 'text-amber-500',
      bgColor: summary.overallConversionRate >= 20 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      badge: summary.overallConversionRate >= 20 ? 'Strong' : 'Moderate',
    },
    {
      id: 'avg_time',
      title: 'Avg. Completion Time',
      value: formatDurationSeconds(summary.avgCompletionTimeSeconds),
      subtitle: 'From start to submit',
      icon: Clock,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi) => {
        const IconComponent = kpi.icon;
        return (
          <Card key={kpi.id} className="rounded-3xl border border-border/60 shadow-sm overflow-hidden hover:border-primary/30 transition-all duration-200">
            <CardContent className="p-5 flex flex-col justify-between h-full space-y-3">
              <div className="flex items-center justify-between">
                <div className={cn("p-2 rounded-2xl shrink-0", kpi.bgColor)}>
                  <IconComponent className={cn("h-4 w-4", kpi.color)} />
                </div>
                {kpi.badge && (
                  <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5 rounded-full border-primary/20 text-primary bg-primary/5">
                    {kpi.badge}
                  </Badge>
                )}
              </div>

              <div className="space-y-1">
                <span className="text-xs font-semibold text-muted-foreground block truncate">
                  {kpi.title}
                </span>
                <div className="text-2xl font-extrabold tracking-tight text-foreground">
                  {kpi.value}
                </div>
              </div>

              <div className="text-[11px] text-muted-foreground/80 font-medium truncate pt-1 border-t border-border/30">
                {kpi.subtitle}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
