'use client';

/**
 * @fileoverview Sales Rep Performance Scorecard & Leaderboard
 *
 * ARCHITECTURAL PURPOSE & DESIGN SPECIFICATION (PRD Section 52 & UI Section 35):
 * - Renders rep-by-rep performance metrics:
 *     1. Rep Name & Avatar
 *     2. Total Deals Managed
 *     3. Deals Won & Deals Lost
 *     4. Win Rate %
 *     5. Closed Won Revenue ($)
 *     6. Active Pipeline Value ($)
 *     7. Average Deal Size ($)
 *     8. Average Sales Cycle (Days)
 *     9. Logged Activities Count
 * - Supports interactive sorting by Revenue Won, Win Rate, and Total Deals.
 *
 * WORKSPACE RULES & COMPLIANCE (Rule 10, Rule 7, Rule 5):
 * - Strict zero 'any' / zero 'any[]'.
 * - Mobile horizontal scrolling with touch friendly targets.
 * - Dynamic multi-currency formatting.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatCurrency } from '@/lib/currency-utils';
import type { RepPerformanceMetrics } from '@/lib/types';
import { 
  Trophy, 
  ArrowUpDown, 
  Users
} from 'lucide-react';

interface RepPerformanceTableProps {
  reps: RepPerformanceMetrics[];
  currency?: string;
}

type SortField = 'revenueWon' | 'winRatePercentage' | 'dealsCount' | 'activePipelineValue';

export default function RepPerformanceTable({
  reps,
  currency = 'GHS',
}: RepPerformanceTableProps) {
  const [sortField, setSortField] = React.useState<SortField>('revenueWon');
  const [sortAsc, setSortAsc] = React.useState<boolean>(false);

  const sortedReps = React.useMemo(() => {
    return [...reps].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [reps, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  if (!reps || reps.length === 0) {
    return (
      <Card className="rounded-3xl border-border/80 bg-card p-8 text-center shadow-sm">
        <div className="flex flex-col items-center justify-center gap-3 opacity-40">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-bold">No rep performance data available</p>
          <p className="text-xs text-muted-foreground">Assign deals to sales reps to track quota and conversion performance.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-border/80 bg-card shadow-sm overflow-hidden">
      <CardHeader className="p-5 md:p-6 border-b border-border/40 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-lg flex items-center gap-1">
                <Trophy className="h-3 w-3" />
                Rep Scorecard
              </Badge>
            </div>
            <CardTitle className="text-lg font-black tracking-tight text-foreground">
              Sales Rep Performance Leaderboard
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Revenue closed, conversion win rates, deal velocity, and activity engagement by sales representative.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 overflow-x-auto scrollbar-thin">
        <table className="w-full text-left border-collapse min-w-[800px]">
          <thead>
            <tr className="border-b border-border/40 bg-muted/20 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider">
              <th className="py-3 px-4">Sales Representative</th>
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('revenueWon')}
                  className="flex items-center gap-1 font-extrabold hover:text-foreground transition-colors"
                >
                  <span>Won Revenue</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('winRatePercentage')}
                  className="flex items-center gap-1 font-extrabold hover:text-foreground transition-colors"
                >
                  <span>Win Rate</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-3 px-4">Won / Lost</th>
              <th className="py-3 px-4">
                <button
                  type="button"
                  onClick={() => handleSort('activePipelineValue')}
                  className="flex items-center gap-1 font-extrabold hover:text-foreground transition-colors"
                >
                  <span>Active Pipeline</span>
                  <ArrowUpDown className="h-3 w-3" />
                </button>
              </th>
              <th className="py-3 px-4">Avg Deal Size</th>
              <th className="py-3 px-4">Avg Sales Cycle</th>
              <th className="py-3 px-4 text-right">Activities</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/30 text-xs">
            {sortedReps.map((rep, idx) => {
              const initials = rep.userName
                ? rep.userName
                    .split(' ')
                    .map(n => n[0])
                    .join('')
                    .toUpperCase()
                    .substring(0, 2)
                : 'U';

              return (
                <tr key={rep.userId} className="hover:bg-muted/20 transition-colors group">
                  {/* Rep Info */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar className="h-8 w-8 rounded-full border border-border/80">
                          <AvatarImage src={rep.avatarUrl} alt={rep.userName} />
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        {idx === 0 && (
                          <span className="absolute -top-1 -right-1 text-[10px]" title="Leader">
                            👑
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                          {rep.userName}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                          {rep.userEmail}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Revenue Won */}
                  <td className="py-3 px-4 font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(rep.revenueWon, currency)}
                  </td>

                  {/* Win Rate */}
                  <td className="py-3 px-4">
                    <Badge
                      variant="outline"
                      className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                        rep.winRatePercentage >= 60
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : rep.winRatePercentage >= 35
                          ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                          : 'bg-muted text-muted-foreground border-border/80'
                      }`}
                    >
                      {rep.winRatePercentage}%
                    </Badge>
                  </td>

                  {/* Won / Lost */}
                  <td className="py-3 px-4 text-[11px] font-semibold text-muted-foreground">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{rep.dealsWonCount} won</span>
                    <span className="mx-1">/</span>
                    <span className="text-red-500 dark:text-red-400">{rep.dealsLostCount} lost</span>
                  </td>

                  {/* Active Pipeline */}
                  <td className="py-3 px-4 font-bold text-foreground">
                    {formatCurrency(rep.activePipelineValue, currency)}
                  </td>

                  {/* Avg Deal Size */}
                  <td className="py-3 px-4 font-semibold text-muted-foreground">
                    {formatCurrency(rep.avgDealSize, currency)}
                  </td>

                  {/* Avg Cycle */}
                  <td className="py-3 px-4 text-muted-foreground font-semibold">
                    {rep.avgSalesCycleDays > 0 ? `${rep.avgSalesCycleDays} days` : '—'}
                  </td>

                  {/* Activities */}
                  <td className="py-3 px-4 text-right">
                    <Badge variant="outline" className="text-[11px] font-bold bg-muted/30">
                      {rep.activitiesCount}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
