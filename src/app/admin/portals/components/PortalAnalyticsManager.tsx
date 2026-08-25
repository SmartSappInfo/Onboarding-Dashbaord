'use client';

/**
 * {{Org_name}} Experience Platform — Admin Portal Analytics & Intelligence Manager
 *
 * Comprehensive visual analytics dashboard embedded inside Portal Studio.
 * Displays Business KPIs, 8-Stage Customer Journey Funnel, Learning Drop-Off Heatmaps,
 * Community DAU/MAU health, and grounded AI Correlation Insights.
 */

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  getPortalAnalyticsAction,
  refreshPortalAnalyticsAction,
} from '@/app/actions/portal-analytics-actions';
import type { PortalAnalyticsSnapshot } from '@/lib/types/portal-analytics';
import {
  TrendingUp,
  Users,
  GraduationCap,
  MessageSquare,
  Sparkles,
  RefreshCw,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Layers,
  Award,
  Zap,
  Loader2,
  Activity,
} from 'lucide-react';

interface PortalAnalyticsManagerProps {
  portalId: string;
  portalSlug: string;
  organizationId: string;
}

export function PortalAnalyticsManager({
  portalId,
  portalSlug,
  organizationId,
}: PortalAnalyticsManagerProps) {
  const { toast } = useToast();
  const [snapshot, setSnapshot] = React.useState<PortalAnalyticsSnapshot | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const loadAnalytics = React.useCallback(
    async (force = false) => {
      if (force) setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const res = force
          ? await refreshPortalAnalyticsAction(portalId, organizationId, portalSlug)
          : await getPortalAnalyticsAction(portalId, organizationId, 'all_time');

        if (res.success && res.data) {
          setSnapshot(res.data);
          if (force) {
            toast({
              title: 'Analytics Refreshed! 📊',
              description: 'Telemetry across all 8 journey stages has been recomputed.',
            });
          }
        } else {
          throw new Error(res.error || 'Failed to load analytics.');
        }
      } catch (err: any) {
        toast({ title: 'Analytics Error', description: err?.message });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [portalId, organizationId, portalSlug, toast]
  );

  React.useEffect(() => {
    loadAnalytics(false);
  }, [loadAnalytics]);

  if (isLoading && !snapshot) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    );
  }

  if (!snapshot) return null;

  const { business, learning, community, journeyFunnel, aiInsights } = snapshot;

  return (
    <div className="space-y-6">
      {/* ── Action Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-muted/20 border border-border">
        <div>
          <h3 className="font-extrabold text-base text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Unified Experience Intelligence
          </h3>
          <p className="text-xs text-muted-foreground">
            Multi-domain telemetry synced at{' '}
            <span className="font-semibold text-foreground">
              {new Date(snapshot.computedAt).toLocaleTimeString()}
            </span>{' '}
            (15-min cached aggregation)
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => loadAnalytics(true)}
          disabled={isRefreshing}
          className="h-9 rounded-xl font-bold text-xs gap-1.5 shadow-2xs self-start sm:self-auto"
        >
          {isRefreshing ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Recalculating...
            </>
          ) : (
            <>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Telemetry
            </>
          )}
        </Button>
      </div>

      {/* ── Top-Level Business & Academy KPI Grid ──────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue & MRR */}
        <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Gross Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">
              ${business.grossRevenue.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
              <span>MRR: ${business.mrr.toLocaleString()}</span>
              <span>•</span>
              <span className="text-emerald-600 font-bold">AOV: ${business.averageOrderValue}</span>
            </div>
          </div>
        </Card>

        {/* Active Members & Leads */}
        <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Active Members</span>
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">
              {business.totalMembers.toLocaleString()}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
              <span>Leads: {business.totalLeads}</span>
              <span>•</span>
              <span className="text-primary font-bold">Conv: {business.leadToMemberRatePercent}%</span>
            </div>
          </div>
        </Card>

        {/* Learning Completion & Enrollments */}
        <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Course Completion</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">
              {learning.averageCourseCompletionPercent}%
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
              <span>{learning.totalEnrollments} Enrolled</span>
              <span>•</span>
              <span className="text-indigo-600 font-bold">Avg Quiz: {learning.averageAssessmentScorePercent}%</span>
            </div>
          </div>
        </Card>

        {/* Community DAU/MAU Health */}
        <Card className="p-4 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground">Community Engagement</span>
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 flex items-center justify-center">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-xl font-extrabold text-foreground">
              {community.dauMauRatioPercent}% <span className="text-xs font-normal text-muted-foreground">DAU/MAU</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
              <span>{community.dau} DAU</span>
              <span>•</span>
              <span className="text-violet-600 font-bold">{community.totalPosts + community.totalComments} Discs</span>
            </div>
          </div>
        </Card>
      </div>

      {/* ── 8-Stage Customer Journey Funnel ────────────────────────────── */}
      <Card className="p-5 sm:p-6 rounded-3xl border border-border bg-card shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-extrabold text-sm sm:text-base text-foreground flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" /> 8-Stage Experience Journey Funnel
            </h4>
            <p className="text-xs text-muted-foreground">
              End-to-end lifecycle conversion from initial visitor to certified brand advocate.
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] font-bold">
            Full Pipeline
          </Badge>
        </div>

        <div className="space-y-3">
          {journeyFunnel.map((step, idx) => {
            const widthPct = Math.max(8, Math.round((step.count / (journeyFunnel[0].count || 1)) * 100));

            return (
              <div key={step.stage} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <span>{step.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-muted-foreground font-semibold">
                    <span>{step.count.toLocaleString()}</span>
                    {idx > 0 && (
                      <span className="text-[11px] text-primary font-bold">
                        {step.conversionFromPrevPercent}% conv
                      </span>
                    )}
                  </div>
                </div>

                <div className="w-full bg-muted/40 h-3 rounded-full overflow-hidden flex items-center">
                  <div
                    className={`h-full rounded-full transition-all ${
                      idx === 0
                        ? 'bg-blue-600'
                        : idx === 1
                        ? 'bg-blue-500'
                        : idx === 2
                        ? 'bg-indigo-500'
                        : idx === 3
                        ? 'bg-indigo-600'
                        : idx === 4
                        ? 'bg-violet-500'
                        : idx === 5
                        ? 'bg-purple-600'
                        : idx === 6
                        ? 'bg-emerald-600'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* ── Split Grid: Learning Diagnostics & Top Contributors ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Learning Drop-off Heatmap */}
        <Card className="p-5 rounded-3xl border border-border bg-card shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h4 className="font-extrabold text-xs sm:text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" /> Lesson Drop-Off Bottlenecks
            </h4>
            <Badge className="bg-amber-500/10 text-amber-600 text-[10px]">Action Required</Badge>
          </div>

          <div className="space-y-3">
            {learning.topDropOffLessons.map(lesson => (
              <div
                key={lesson.lessonId}
                className="p-3.5 rounded-2xl border border-border bg-muted/10 space-y-1.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs text-foreground line-clamp-1">
                    {lesson.lessonTitle}
                  </span>
                  <Badge variant="destructive" className="text-[10px] shrink-0">
                    {lesson.dropOffRatePercent}% Drop-off
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground flex items-center justify-between">
                  <span>Course: {lesson.courseTitle}</span>
                  <span>{lesson.totalAttempts} Enrolled attempts</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Community Contributors */}
        <Card className="p-5 rounded-3xl border border-border bg-card shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h4 className="font-extrabold text-xs sm:text-sm text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" /> Top Community Contributors
            </h4>
            <Badge className="bg-primary/10 text-primary text-[10px]">Advocate Pipeline</Badge>
          </div>

          <div className="space-y-2.5">
            {community.topContributors.map((user, idx) => (
              <div
                key={user.userId}
                className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-5 font-bold text-muted-foreground text-center">#{idx + 1}</span>
                  <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                    {user.userName[0]}
                  </div>
                  <div>
                    <span className="font-bold text-foreground block">{user.userName}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {user.totalPosts} posts • {user.totalComments} comments
                    </span>
                  </div>
                </div>

                <Badge variant="outline" className="font-bold text-xs bg-muted/40">
                  {user.engagementScore} pts
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── AI Experience Intelligence & Grounded Recommendations ─────── */}
      <Card className="p-5 sm:p-6 rounded-3xl border-2 border-indigo-500/30 bg-indigo-500/5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-xs sm:text-sm">
            <Sparkles className="w-4 h-4" /> Grounded AI Experience Insights & Correlations
          </div>
          <Badge className="bg-indigo-600 text-white text-[10px]">Deterministic Telemetry</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aiInsights.map(insight => (
            <Card
              key={insight.id}
              className="p-4 rounded-2xl border border-border bg-card space-y-2 shadow-2xs"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-xs text-foreground leading-tight">
                  {insight.title}
                </span>
                <Badge
                  className={`text-[9px] py-0 uppercase tracking-wider shrink-0 ${
                    insight.impactScore >= 90
                      ? 'bg-emerald-500/10 text-emerald-600 font-bold'
                      : 'bg-primary/10 text-primary font-bold'
                  }`}
                >
                  Impact: {insight.impactScore}/100
                </Badge>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                {insight.insight}
              </p>

              <div className="pt-1.5 border-t border-border flex items-start gap-1.5 text-[11px] font-semibold text-primary">
                <Zap className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" />
                <span>Action: {insight.actionableRecommendation}</span>
              </div>
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
}
