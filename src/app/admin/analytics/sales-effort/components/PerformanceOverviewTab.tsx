'use client';

/**
 * @fileoverview Performance Overview Tab for SmartSapp Sales Performance & Intelligence 2.0.
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 7 & UI/UX Section 41:
 * - Bento-grid layout with Top Rep Standout card (Gold gradient, key stats).
 * - Team KPI cards (Average Index, Total Workspace Effort, Active Reps, Quota Attainment).
 * - 5-Dimension Performance breakdown (Ranked bars & team averages).
 * - High-clarity Recharts visual analytics (Top Reps bar chart & CRM Action Mix donut).
 * - Explainable "How Performance Index Works" modal.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing with zero 'any'.
 * - Minimum 44px touch targets on mobile interactions.
 * - Conforms to emilkowal-animations and vercel-react-best-practices.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import {
  Trophy,
  TrendingUp,
  Target,
  Users,
  Activity,
  Sparkles,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  ListCollapse,
  Zap,
} from 'lucide-react';
import type { PerformanceOverviewData, SalesTarget } from '@/lib/sales-performance/types';

interface PerformanceOverviewTabProps {
  overviewData: PerformanceOverviewData | null;
  isLoading: boolean;
  onSelectRep: (repId: string) => void;
  onNavigateTab: (tab: 'standings' | 'targets' | 'reps') => void;
}

const PALETTE = ['#818cf8', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#22d3ee', '#f43f5e'];

export function PerformanceOverviewTab({
  overviewData,
  isLoading,
  onSelectRep,
  onNavigateTab,
}: PerformanceOverviewTabProps) {
  const [isExplainerOpen, setIsExplainerOpen] = React.useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-muted/30 border" />
        ))}
      </div>
    );
  }

  if (!overviewData) {
    return (
      <div className="py-12 text-center text-xs text-muted-foreground font-semibold">
        No performance data available for the active workspace.
      </div>
    );
  }

  const {
    teamKPIs,
    leaderboard,
    activeTargets: targets,
    chartDataActionMix: actionMix,
    teamScorecard,
  } = overviewData;

  const totalPoints = teamKPIs.totalWorkspaceEffortPoints;
  const averagePerformanceIndex = teamKPIs.averagePerformanceIndex;
  const activeRepsCount = teamKPIs.activeRepsCount;
  const topRep = teamKPIs.topRep;

  // Chart data: Top 8 reps
  const chartDataPoints = leaderboard.slice(0, 8).map((u) => ({
    name: u.userName.split(' ')[0],
    fullName: u.userName,
    Points: u.totalPoints,
    index: u.performanceIndex,
  }));

  // Dimension list sorted for ranked horizontal display
  const dimensionEntries = [
    {
      key: 'activity',
      label: 'Activity (Volume)',
      score: teamScorecard.activityScore,
      desc: 'Logged meetings, calls, tasks, campaigns',
      color: 'bg-indigo-500',
    },
    {
      key: 'effort',
      label: 'Effort (Intentional Work)',
      score: teamScorecard.effortScore,
      desc: 'Deep call minutes, structured notes, meeting prep',
      color: 'bg-emerald-500',
    },
    {
      key: 'quality',
      label: 'Quality (Hygiene & Accuracy)',
      score: teamScorecard.qualityScore,
      desc: 'Field completeness, prompt logging, CRM hygiene',
      color: 'bg-amber-500',
    },
    {
      key: 'effectiveness',
      label: 'Effectiveness (Conversion)',
      score: teamScorecard.effectivenessScore,
      desc: 'Deal stage advancement, meeting outcome completion',
      color: 'bg-sky-500',
    },
    {
      key: 'outcome',
      label: 'Outcome (Won Deals & Revenue)',
      score: teamScorecard.outcomeScore,
      desc: 'Deal value closed and revenue contribution',
      color: 'bg-purple-500',
    },
  ].sort((a, b) => b.score - a.score);

  // Targets progress summary
  const activeTargetsCount = targets.length;
  const onTrackTargetsCount = targets.filter((t: SalesTarget) => t.paceStatus === 'on_track' || t.paceStatus === 'achieved').length;

  return (
    <div className="space-y-6">
      {/* Top Standout & KPI Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Top Rep Standout Card (Gold Highlight Bento) */}
        <Card className="rounded-2xl border-yellow-500/25 bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent backdrop-blur-md shadow-sm p-5 flex items-center justify-between gap-3 relative overflow-hidden group">
          <div className="space-y-1 z-10 text-left">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              <Trophy className="h-3 w-3 fill-current" /> Leader Standout
            </span>
            <h4 className="font-extrabold text-sm text-foreground truncate max-w-[150px]">
              {topRep?.userName || 'No reps active'}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black font-mono text-muted-foreground">
                {topRep?.totalPoints || 0} pts
              </span>
              {topRep && (
                <Badge variant="outline" className="text-[10px] font-mono font-bold border-yellow-500/30 text-yellow-600 dark:text-yellow-400">
                  {topRep.performanceIndex}/100
                </Badge>
              )}
            </div>
          </div>

          {topRep ? (
            <div className="flex flex-col items-center gap-1 z-10">
              <Avatar className="h-12 w-12 border-2 border-yellow-500 shadow-md">
                <AvatarImage src={topRep.photoURL} />
                <AvatarFallback className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 font-extrabold text-sm">
                  {topRep.userName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onSelectRep(topRep.userId);
                  onNavigateTab('reps');
                }}
                className="h-6 px-1.5 text-[10px] font-bold text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/10 active:scale-[0.97]"
              >
                Inspect <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
              </Button>
            </div>
          ) : (
            <Avatar className="h-12 w-12 border-2 border-muted opacity-50">
              <AvatarFallback className="text-xs font-bold">-</AvatarFallback>
            </Avatar>
          )}
        </Card>

        {/* Average Performance Index */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Team Performance Index
              </span>
              <button
                type="button"
                onClick={() => setIsExplainerOpen(true)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded-full"
                title="How is this calculated?"
              >
                <HelpCircle className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-baseline gap-1.5">
              <h2 className="text-2xl font-black font-mono text-foreground">{averagePerformanceIndex}</h2>
              <span className="text-xs font-bold text-muted-foreground">/ 100</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium">
              Multi-factor 5-dimension balanced average
            </p>
          </div>
          <ShieldCheck className="h-8 w-8 text-primary opacity-60 shrink-0" />
        </Card>

        {/* Total Points */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Total Workspace Effort
            </span>
            <h2 className="text-2xl font-black font-mono text-foreground">{totalPoints.toLocaleString()}</h2>
            <p className="text-[10px] text-muted-foreground font-medium">
              Activity scoring points accrued
            </p>
          </div>
          <TrendingUp className="h-8 w-8 text-emerald-500 opacity-60 shrink-0" />
        </Card>

        {/* Quota & Active Reps */}
        <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md shadow-sm p-5 flex items-center justify-between">
          <div className="space-y-1 text-left">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Active Reps & Quotas
            </span>
            <div className="flex items-baseline gap-2">
              <h2 className="text-2xl font-black font-mono text-foreground">{activeRepsCount}</h2>
              <span className="text-xs font-semibold text-muted-foreground">reps</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <Target className="h-2.5 w-2.5 text-primary" />
              {activeTargetsCount > 0
                ? `${onTrackTargetsCount} of ${activeTargetsCount} quotas on pace`
                : 'No targets defined yet'}
            </p>
          </div>
          <Users className="h-8 w-8 text-indigo-500 opacity-60 shrink-0" />
        </Card>
      </div>

      {/* Middle Section: 5-Dimension Performance Breakdown & Quota Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: 5-Dimension Breakdown (7 Cols) */}
        <Card className="lg:col-span-7 rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/30 pb-4">
            <div className="text-left">
              <h3 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Workspace 5-Dimension Balance
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Evaluates team execution beyond volume across effort, hygiene, conversion, and revenue.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExplainerOpen(true)}
              className="rounded-xl text-xs font-bold text-primary hover:bg-primary/10 self-start sm:self-auto min-h-[44px] sm:min-h-[32px]"
            >
              How it works <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>

          <div className="space-y-4">
            {dimensionEntries.map((d) => (
              <div key={d.key} className="space-y-1.5 text-left">
                <div className="flex items-center justify-between text-xs font-bold">
                  <div>
                    <span className="text-foreground">{d.label}</span>
                    <span className="text-[10px] text-muted-foreground font-normal ml-2 hidden sm:inline">
                      {d.desc}
                    </span>
                  </div>
                  <span className="font-mono font-black">{d.score} / 100</span>
                </div>
                <Progress value={d.score} className="h-2 rounded-full" />
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Formula balances activity (30%), effort (25%), quality (15%), effectiveness (15%), outcome (15%).
            </span>
            <Button
              variant="link"
              size="sm"
              onClick={() => onNavigateTab('standings')}
              className="text-xs font-bold text-primary p-0 h-auto"
            >
              View Standings
            </Button>
          </div>
        </Card>

        {/* Right: Quick Action Shortcuts & Quota Snapshot (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-5 space-y-4 text-left">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Active Quotas & Pacing
              </h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigateTab('targets')}
                className="h-7 text-xs font-bold rounded-lg active:scale-[0.97]"
              >
                Manage Targets
              </Button>
            </div>

            {targets.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground font-medium">
                No active targets configured.{' '}
                <button
                  type="button"
                  onClick={() => onNavigateTab('targets')}
                  className="text-primary font-bold underline ml-1"
                >
                  Set first quota
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {targets.slice(0, 3).map((t: SalesTarget) => (
                  <div key={t.id} className="p-3 rounded-xl border bg-muted/10 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="capitalize text-foreground">
                        {t.metric} ({t.period})
                      </span>
                      <span className="font-mono text-primary font-black">
                        {t.actualValue} / {t.targetValue} ({t.attainmentPercent}%)
                      </span>
                    </div>
                    <Progress value={Math.min(100, t.attainmentPercent)} className="h-1.5 rounded-full" />
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                      <span>{t.ownerName}</span>
                      <span>Need: {t.requiredDailyPace}/day</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Standings Quick Links */}
          <Card className="rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-5 space-y-3 text-left">
            <h4 className="text-sm font-extrabold text-foreground flex items-center gap-2">
              <ListCollapse className="h-4 w-4 text-primary" /> Quick Navigation
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => onNavigateTab('standings')}
                className="rounded-xl text-xs font-bold justify-start min-h-[44px] active:scale-[0.97]"
              >
                <Trophy className="h-3.5 w-3.5 mr-2 text-yellow-500" /> Full Standings
              </Button>
              <Button
                variant="outline"
                onClick={() => onNavigateTab('reps')}
                className="rounded-xl text-xs font-bold justify-start min-h-[44px] active:scale-[0.97]"
              >
                <Users className="h-3.5 w-3.5 mr-2 text-indigo-500" /> Rep Profiles
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Visual Analytics Charts Section (Top Reps Bar + CRM Action Mix Donut) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Top Reps Points Bar Chart (7 Cols) */}
        <Card className="lg:col-span-7 rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-5 space-y-4">
          <div className="flex items-center justify-between text-left">
            <div>
              <h4 className="text-sm font-extrabold tracking-tight flex items-center gap-2 text-foreground">
                <Sparkles className="h-4 w-4 text-yellow-500 fill-current" /> Effort by Executive (Top 8)
              </h4>
              <p className="text-xs text-muted-foreground">
                Distribution of scored operational activity points across leading reps.
              </p>
            </div>
          </div>

          <div className="h-[220px] w-full">
            {chartDataPoints.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground font-semibold">
                No activity data to chart in this period.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataPoints} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.15} />
                  <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(15, 23, 42, 0.90)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                    }}
                    labelStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#fff' }}
                    itemStyle={{ fontSize: '11px', color: '#818cf8' }}
                  />
                  <Bar dataKey="Points" fill="#818cf8" radius={[6, 6, 0, 0]}>
                    {chartDataPoints.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PALETTE[index % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* CRM Action Mix Donut Chart (5 Cols) */}
        <Card className="lg:col-span-5 rounded-2xl border-border/40 bg-card/45 backdrop-blur-md p-5 space-y-4">
          <div className="text-left">
            <h4 className="text-sm font-extrabold tracking-tight flex items-center gap-2 text-foreground">
              <Activity className="h-4 w-4 text-emerald-400" /> CRM Action Mix
            </h4>
            <p className="text-xs text-muted-foreground">
              Proportion of meetings, calls, tasks, deals, and campaigns executed.
            </p>
          </div>

          <div className="h-[220px] w-full flex flex-col sm:flex-row items-center justify-around gap-4">
            {actionMix.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground font-semibold">
                No activity mix data logged yet.
              </div>
            ) : (
              <>
                <div className="h-full w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={actionMix}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="count"
                      >
                        {actionMix.map((entry: { name: string; count: number }, index: number) => (
                          <Cell key={`mix-${index}`} fill={PALETTE[index % PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(15, 23, 42, 0.90)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: '12px',
                        }}
                        itemStyle={{ fontSize: '11px', color: '#fff' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-2 w-1/2 justify-center text-left">
                  {actionMix.map((item: { name: string; count: number }, idx: number) => (
                    <div key={item.name} className="flex items-center justify-between text-xs font-semibold">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                        />
                        <span className="text-muted-foreground font-medium capitalize">{item.name}</span>
                      </div>
                      <span className="font-mono font-bold pr-2 text-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Explainable Performance Index Calculation Modal */}
      <Dialog open={isExplainerOpen} onOpenChange={setIsExplainerOpen}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader className="text-left border-b pb-4">
            <DialogTitle className="text-base font-extrabold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> How Performance Index Works
            </DialogTitle>
            <DialogDescription className="text-xs">
              Transparent, objective scoring that prevents volume spamming and rewards real sales excellence.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-left text-xs">
            <p className="text-muted-foreground leading-relaxed">
              The <strong>SmartSapp Performance Index (0-100)</strong> combines 5 distinct dimensions to prevent reps from simply spamming quick tasks to top the leaderboard:
            </p>

            <div className="space-y-3">
              <div className="p-3 rounded-xl border bg-muted/10">
                <div className="font-extrabold text-foreground flex items-center justify-between">
                  <span>1. Activity (30% weight)</span>
                  <Badge variant="outline" className="text-[10px]">Volume</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Raw count of calls, meetings, tasks, and deal interactions.
                </p>
              </div>

              <div className="p-3 rounded-xl border bg-muted/10">
                <div className="font-extrabold text-foreground flex items-center justify-between">
                  <span>2. Effort (25% weight)</span>
                  <Badge variant="outline" className="text-[10px]">Depth</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Substantive engagement such as call duration &gt; 2 mins, thorough meeting notes, and research.
                </p>
              </div>

              <div className="p-3 rounded-xl border bg-muted/10">
                <div className="font-extrabold text-foreground flex items-center justify-between">
                  <span>3. Quality (15% weight)</span>
                  <Badge variant="outline" className="text-[10px]">Hygiene</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Field completeness, logging within 2 hours, and CRM accuracy.
                </p>
              </div>

              <div className="p-3 rounded-xl border bg-muted/10">
                <div className="font-extrabold text-foreground flex items-center justify-between">
                  <span>4. Effectiveness (15% weight)</span>
                  <Badge variant="outline" className="text-[10px]">Advancement</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Conversion of leads, moving deals through pipeline stages, and completed outcomes.
                </p>
              </div>

              <div className="p-3 rounded-xl border bg-muted/10">
                <div className="font-extrabold text-foreground flex items-center justify-between">
                  <span>5. Outcome (15% weight)</span>
                  <Badge variant="outline" className="text-[10px]">Results</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Closed revenue and won deals.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-[11px] text-muted-foreground">
              <strong className="text-foreground block mb-1">Human Activity Guarantee:</strong>
              Automated system triggers (e.g. AI auto-responders or workflow rules) are flagged as system actions and do not award human points.
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
