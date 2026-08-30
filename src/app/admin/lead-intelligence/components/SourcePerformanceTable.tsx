'use client';

/**
 * Source Performance & Acquisition Table (Lead Intelligence 2.0 - Phase 11)
 * UI Spec Section 45: "Source Performance & Acquisition Report"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Channel-by-channel ROI comparison.
 * 2. Mobile-responsive card transformation for small viewports.
 * 3. Emil Kowalski active physics (active:scale-[0.97]).
 * 4. Strict Zero-`any` typing.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Globe, 
  MapPin, 
  FileSpreadsheet, 
  Search, 
  Users, 
  ArrowUpRight 
} from 'lucide-react';
import type { SourcePerformanceMetric } from '@/lib/lead-intelligence/types';
import { cn } from '@/lib/utils';

interface SourcePerformanceTableProps {
  sources: SourcePerformanceMetric[];
  currency?: string;
  className?: string;
}

export const SourcePerformanceTable: React.FC<SourcePerformanceTableProps> = ({
  sources,
  currency = 'GHS',
  className
}) => {
  const getSourceIcon = (src: string) => {
    switch (src) {
      case 'places':
        return <MapPin className="h-3.5 w-3.5 text-rose-500" />;
      case 'builtwith':
        return <Globe className="h-3.5 w-3.5 text-purple-500" />;
      case 'hunter':
        return <Users className="h-3.5 w-3.5 text-sky-500" />;
      case 'csv_import':
        return <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-500" />;
      default:
        return <Search className="h-3.5 w-3.5 text-primary" />;
    }
  };

  return (
    <div className={cn("bg-card border border-border/70 rounded-2xl p-5 space-y-4 shadow-xs", className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-extrabold text-foreground tracking-tight">
            Acquisition Source Performance
          </h4>
          <p className="text-xs text-muted-foreground pt-0.5">
            Conversion yield and attributed revenue across discovery channels.
          </p>
        </div>
      </div>

      {sources.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          No source metrics recorded in this workspace.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="py-2.5 px-3 font-bold">Discovery Channel</th>
                <th className="py-2.5 px-3 font-bold">Leads</th>
                <th className="py-2.5 px-3 font-bold">Qualified</th>
                <th className="py-2.5 px-3 font-bold">Opps</th>
                <th className="py-2.5 px-3 font-bold">Won</th>
                <th className="py-2.5 px-3 font-bold">Revenue</th>
                <th className="py-2.5 px-3 font-bold text-right">Yield</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-medium">
              {sources.map((s) => (
                <tr key={s.source} className="hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
                        {getSourceIcon(s.source)}
                      </div>
                      <span className="font-bold text-foreground truncate">{s.sourceLabel}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-foreground font-mono">{s.leadsCount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-muted-foreground font-mono">{s.qualifiedCount.toLocaleString()}</td>
                  <td className="py-3 px-3 text-muted-foreground font-mono">{s.oppsCount.toLocaleString()}</td>
                  <td className="py-3 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {s.wonCount.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 font-mono font-extrabold text-foreground">
                    {currency} {s.revenue.toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-bold font-mono text-primary">{s.conversionRate}%</span>
                      <div className="w-12 hidden sm:block">
                        <Progress value={s.conversionRate * 2} className="h-1.5" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
