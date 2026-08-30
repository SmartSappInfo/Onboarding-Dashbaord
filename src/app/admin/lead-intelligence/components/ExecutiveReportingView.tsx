'use client';

/**
 * Executive Reporting & Attribution View (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Section 44: "Executive Reporting Dashboard"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. High-level metric highlights for executive and RevOps leadership.
 * 2. Mobile-responsive card grid with touch targets >= 44px.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  TrendingUp, 
  Users, 
  Briefcase, 
  CheckCircle2, 
  DollarSign, 
  Clock, 
  ArrowUpRight 
} from 'lucide-react';
import type { ExecutiveAttributionSummary } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface ExecutiveReportingViewProps {
  summary: ExecutiveAttributionSummary;
  className?: string;
}

export const ExecutiveReportingView: React.FC<ExecutiveReportingViewProps> = ({
  summary,
  className
}) => {
  const formatCurrency = (val: number) => {
    return `${summary.currency || 'GHS'} ${val.toLocaleString()}`;
  };

  const cards = [
    {
      title: 'Pipeline Generated',
      value: formatCurrency(summary.pipelineGenerated),
      subtitle: 'From active outbound leads',
      icon: TrendingUp,
      color: 'text-sky-500',
      bgColor: 'bg-sky-500/10'
    },
    {
      title: 'Qualified Leads',
      value: summary.qualifiedLeads.toLocaleString(),
      subtitle: '&ge; 70 Priority Score',
      icon: Users,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      title: 'Opportunities Created',
      value: summary.opportunitiesCount.toLocaleString(),
      subtitle: 'Synced into CRM Pipelines',
      icon: Briefcase,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      title: 'Won Deals',
      value: summary.wonDealsCount.toLocaleString(),
      subtitle: `${summary.winRatePercent}% Opportunity Win Rate`,
      icon: CheckCircle2,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      title: 'Attributed Revenue',
      value: formatCurrency(summary.totalRevenue),
      subtitle: 'Closed-won contract value',
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      title: 'Sales Cycle Velocity',
      value: `${summary.avgSalesCycleDays} Days`,
      subtitle: 'Discovery to Won deal duration',
      icon: Clock,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10'
    }
  ];

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <span>Executive Performance Summary</span>
            <Badge variant="outline" className="text-[10px] font-mono font-bold uppercase">
              {summary.currency} Normalized
            </Badge>
          </h4>
          <p className="text-xs text-muted-foreground pt-0.5">
            Holistic attribution linking discovered intelligence directly to closed CRM revenue.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card
              key={c.title}
              className="bg-card border-border/70 shadow-xs hover:border-primary/40 transition-all rounded-2xl"
            >
              <CardHeader className="p-4 flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {c.title}
                </CardTitle>
                <div className={cn("p-2 rounded-xl", c.bgColor)}>
                  <Icon className={cn("h-4 w-4", c.color)} />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-1">
                <div className="text-2xl font-black text-foreground tracking-tight">
                  {c.value}
                </div>
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
                  <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" />
                  <span>{c.subtitle}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
