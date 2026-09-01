'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 9: Workspace Predictive Intelligence Dashboard
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Portfolio Predictive Health Distribution: Churn risk forecasting, conversion propensity queues.
 * 2. Next-Best-Action (NBA) Prescriptions.
 * 3. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import type { WorkspacePredictiveOverview, EntityPredictiveHealth } from '@/lib/types';
import {
  getWorkspacePredictiveOverviewAction,
  executePredictiveNextBestAction,
} from '@/lib/surveys/survey-predictive-actions';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Flame,
  HeartPulse,
  Layers,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

export function PredictiveIntelligenceClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [overview, setOverview] = React.useState<WorkspacePredictiveOverview | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [executingEntityId, setExecutingEntityId] = React.useState<string | null>(null);

  const fetchOverview = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getWorkspacePredictiveOverviewAction(activeWorkspaceId);
      if (res.success && res.overview) {
        setOverview(res.overview);
      }
    } catch (err) {
      console.error('[PredictiveIntelligenceClient] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId]);

  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const handleExecuteAction = async (entity: EntityPredictiveHealth) => {
    setExecutingEntityId(entity.entityId);
    try {
      const res = await executePredictiveNextBestAction(
        entity.entityId,
        entity.nextBestAction.type,
        entity.nextBestAction.rationale,
        activeWorkspaceId || ''
      );

      if (res.success) {
        toast({
          title: 'Prescription Executed',
          description: "Follow-up CRM task dispatched for " + entity.entityName,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Execution Failed',
          description: res.error || 'Failed to dispatch action',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred during execution.',
      });
    } finally {
      setExecutingEntityId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          Synthesizing Portfolio Predictive Intelligence...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-left">
      {/* 1. Header with Breadcrumbs & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/surveys"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Surveys
            </Link>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                Predictive Survey Intelligence Hub
                <Badge variant="outline" className="text-[10px] font-mono text-indigo-600 border-indigo-300">
                  Phase 9 (Apex)
                </Badge>
              </h1>
              <p className="text-xs text-muted-foreground">
                Cross-system predictive convergence of Survey Sentiment + CRM Pipeline + Engagement Signals.
              </p>
            </div>
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={fetchOverview}
          className="h-10 px-4 gap-2 text-xs font-semibold active:scale-[0.97]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Re-evaluate Telemetry
        </Button>
      </div>

      {overview && (
        <>
          {/* 2. Top KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Evaluated Accounts
              </span>
              <p className="text-3xl font-black text-foreground">{overview.totalEvaluatedEntities}</p>
              <p className="text-[11px] text-muted-foreground">Active in workspace</p>
            </Card>

            <Card className="p-5 rounded-2xl border border-border bg-card shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Portfolio Health Avg
              </span>
              <div className="flex items-baseline gap-1.5">
                <p className="text-3xl font-black text-foreground">{overview.averageHealthScore}</p>
                <span className="text-xs text-muted-foreground">/ 100</span>
              </div>
              <Progress value={overview.averageHealthScore} className="h-1.5" />
            </Card>

            <Card className="p-5 rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/10 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600">
                At-Risk Accounts
              </span>
              <p className="text-3xl font-black text-rose-600">{overview.atRiskAccountsCount}</p>
              <p className="text-[11px] text-rose-600/80 font-medium">Require proactive outreach</p>
            </Card>

            <Card className="p-5 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/20 dark:bg-emerald-950/10 shadow-sm space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                High-Propensity Leads
              </span>
              <p className="text-3xl font-black text-emerald-600">{overview.highPropensityLeadsCount}</p>
              <p className="text-[11px] text-emerald-600/80 font-medium">Ready for deal acceleration</p>
            </Card>
          </div>

          {/* 3. Predictive Queues (Tabs) */}
          <Tabs defaultValue="at_risk" className="space-y-6">
            <TabsList className="grid grid-cols-2 max-w-md h-11 p-1 bg-muted rounded-xl">
              <TabsTrigger value="at_risk" className="text-xs font-semibold gap-2 rounded-lg">
                <Flame className="h-3.5 w-3.5 text-rose-600" />
                At-Risk Queue ({overview.atRiskEntities.length})
              </TabsTrigger>
              <TabsTrigger value="high_propensity" className="text-xs font-semibold gap-2 rounded-lg">
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                Conversion Leads ({overview.highPropensityLeads.length})
              </TabsTrigger>
            </TabsList>

            {/* Tab A: At-Risk & Churn Prevention Queue */}
            <TabsContent value="at_risk" className="space-y-4">
              {overview.atRiskEntities.length === 0 ? (
                <Card className="p-12 text-center rounded-2xl border border-border bg-card">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-foreground">Zero Critical At-Risk Accounts</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    All accounts maintain healthy survey satisfaction and active pipeline engagement.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overview.atRiskEntities.map((entity) => (
                    <Card key={entity.entityId} className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={"/admin/entities/" + entity.entityId}
                            className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {entity.entityName}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </Link>
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            {entity.surveySubmissionsCount} Survey Submissions • {entity.openDealsCount} Open Deals
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs text-rose-600 bg-rose-500/10 border-rose-300 font-bold">
                          {entity.churnRiskPercent}% Churn Risk
                        </Badge>
                      </div>

                      {/* Health Gauge */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                          <span>Health Score</span>
                          <span>{entity.healthScore} / 100</span>
                        </div>
                        <Progress value={entity.healthScore} className="h-1.5" />
                      </div>

                      {/* Prescribed Next-Best-Action */}
                      <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                          <Zap className="h-3.5 w-3.5 fill-indigo-600" />
                          <span>Prescribed: {entity.nextBestAction.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {entity.nextBestAction.rationale}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleExecuteAction(entity)}
                          disabled={executingEntityId === entity.entityId}
                          className="w-full h-10 min-h-[44px] text-xs font-semibold gap-1.5 active:scale-[0.97] bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {executingEntityId === entity.entityId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3 fill-white" />
                          )}
                          Execute Prescription
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Tab B: High-Propensity Lead Conversion Queue */}
            <TabsContent value="high_propensity" className="space-y-4">
              {overview.highPropensityLeads.length === 0 ? (
                <Card className="p-12 text-center rounded-2xl border border-border bg-card">
                  <TrendingUp className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <h3 className="text-sm font-bold text-foreground">No High-Propensity Leads Pending</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Send qualification surveys to identify high-intent prospects.
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {overview.highPropensityLeads.map((entity) => (
                    <Card key={entity.entityId} className="rounded-2xl border border-border bg-card p-5 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <Link
                            href={"/admin/entities/" + entity.entityId}
                            className="text-sm font-bold text-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                          >
                            {entity.entityName}
                            <ExternalLink className="h-3 w-3 text-muted-foreground" />
                          </Link>
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            {entity.openDealsCount} Open Deals • {entity.surveySubmissionsCount} Survey Responses
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs text-emerald-600 bg-emerald-500/10 border-emerald-300 font-bold">
                          {entity.conversionPropensityPercent}% Propensity
                        </Badge>
                      </div>

                      {/* Prescribed Next-Best-Action */}
                      <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-400">
                          <Zap className="h-3.5 w-3.5 fill-indigo-600" />
                          <span>Prescribed: {entity.nextBestAction.title}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {entity.nextBestAction.rationale}
                        </p>
                        <Button
                          size="sm"
                          onClick={() => handleExecuteAction(entity)}
                          disabled={executingEntityId === entity.entityId}
                          className="w-full h-10 min-h-[44px] text-xs font-semibold gap-1.5 active:scale-[0.97] bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                          {executingEntityId === entity.entityId ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Zap className="h-3 w-3 fill-white" />
                          )}
                          Execute Prescription
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
