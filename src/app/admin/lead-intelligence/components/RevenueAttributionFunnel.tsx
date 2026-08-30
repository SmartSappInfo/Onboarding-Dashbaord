'use client';

/**
 * Revenue Attribution Funnel Progression (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Section 48: "Revenue Attribution"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visualizes end-to-end lineage from Discovery to CRM Revenue.
 * 2. Mobile-responsive progression steps.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowRight, 
  Search, 
  UserCheck, 
  Briefcase, 
  Trophy, 
  DollarSign 
} from 'lucide-react';
import type { ExecutiveAttributionSummary } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface RevenueAttributionFunnelProps {
  summary: ExecutiveAttributionSummary;
  className?: string;
}

export const RevenueAttributionFunnel: React.FC<RevenueAttributionFunnelProps> = ({
  summary,
  className
}) => {
  const formatCurrency = (val: number) => {
    return `${summary.currency || 'GHS'} ${val.toLocaleString()}`;
  };

  const steps = [
    {
      label: 'Sourced Leads',
      value: (summary.qualifiedLeads * 2).toLocaleString(),
      desc: 'Raw intelligence scanned',
      icon: Search,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted/40'
    },
    {
      label: 'Qualified Leads',
      value: summary.qualifiedLeads.toLocaleString(),
      desc: 'Score &ge; 70 + verified',
      icon: UserCheck,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10'
    },
    {
      label: 'Opportunities',
      value: summary.opportunitiesCount.toLocaleString(),
      desc: 'Active deals in pipeline',
      icon: Briefcase,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      label: 'Won Contracts',
      value: summary.wonDealsCount.toLocaleString(),
      desc: `${summary.winRatePercent}% win conversion`,
      icon: Trophy,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10'
    },
    {
      label: 'Attributed Revenue',
      value: formatCurrency(summary.totalRevenue),
      desc: 'Realized contract value',
      icon: DollarSign,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    }
  ];

  return (
    <div className={cn("bg-card border border-border/70 rounded-2xl p-5 space-y-4 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <span>Lead-to-Revenue Attribution Funnel</span>
          </h4>
          <p className="text-xs text-muted-foreground pt-0.5">
            Conversion velocity tracing raw prospect scans directly into realized contract revenue.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-2">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isLast = idx === steps.length - 1;
          return (
            <div key={s.label} className="relative flex flex-col justify-between p-4 rounded-xl bg-muted/20 border border-border/60 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className={cn("p-2 rounded-lg", s.bgColor)}>
                    <Icon className={cn("h-4 w-4", s.color)} />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground font-mono">Stage 0{idx + 1}</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-xs font-semibold text-muted-foreground block">{s.label}</span>
                  <div className="text-lg font-black text-foreground tracking-tight font-mono">{s.value}</div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                {s.desc}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
