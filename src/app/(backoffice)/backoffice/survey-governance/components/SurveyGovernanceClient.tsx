/**
 * @fileoverview Platform Control Plane Survey Governance Client Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Unifies survey completion rates, step drop-off friction radar, and spam moderation queue.
 * - Minimum 44px touch targets on interactive controls.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  BarChart3,
  FileCheck2,
  TrendingUp,
  ShieldAlert,
  RefreshCw,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { getSurveyGovernanceOverviewAction } from '@/lib/backoffice/backoffice-survey-actions';
import type {
  SurveyTrafficMetrics,
  SurveyDropoffInsight,
  FlaggedSurveySubmission,
} from '@/lib/backoffice/backoffice-types';
import DropoffIntelligenceRadar from './DropoffIntelligenceRadar';
import SpamAbuseQueue from './SpamAbuseQueue';
import SystemQuestionBankMatrix from './SystemQuestionBankMatrix';
import SystemCrmFieldMappingMatrix from './SystemCrmFieldMappingMatrix';
import SystemDecisionPlaybookMatrix from './SystemDecisionPlaybookMatrix';
import { SystemResearchGovernanceMatrix } from './SystemResearchGovernanceMatrix';
import { SystemPredictiveIntelligenceMatrix } from './SystemPredictiveIntelligenceMatrix';

export default function SurveyGovernanceClient() {
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [metrics, setMetrics] = React.useState<SurveyTrafficMetrics | null>(null);
  const [dropoffs, setDropoffs] = React.useState<SurveyDropoffInsight[]>([]);
  const [flaggedSubmissions, setFlaggedSubmissions] = React.useState<FlaggedSurveySubmission[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchSurveyData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await getSurveyGovernanceOverviewAction(idToken);

      if (res.success && res.metrics) {
        setMetrics(res.metrics);
        setDropoffs(res.dropoffs || []);
        setFlaggedSubmissions(res.flaggedSubmissions || []);
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load survey telemetry.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [getToken, toast]);

  React.useEffect(() => {
    fetchSurveyData();
  }, [fetchSurveyData]);

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <BarChart3 className="h-6 w-6 text-emerald-500" />
            Survey & Intake Governance Hub
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Global survey submission throughput, step drop-off friction radar, and bot spam moderation.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSurveyData}
          disabled={isLoading}
          className="h-11 rounded-xl text-xs font-semibold active:scale-[0.97] gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 text-emerald-500 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning...' : 'Scan Traffic'}
        </Button>
      </div>

      {/* KPI Stats Grid */}
      {metrics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">24h Submissions</span>
              <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <FileCheck2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                {metrics.totalSubmissions24h.toLocaleString()}
              </span>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">responses</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Active Forms</span>
              <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{metrics.activeSurveysCount}</span>
              <span className="text-[11px] text-muted-foreground">live</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Completion Rate</span>
              <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">{metrics.averageCompletionRate}%</span>
              <span className="text-[11px] text-purple-500 font-bold">avg conversion</span>
            </div>
          </Card>

          <Card className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Spam Detections</span>
              <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground font-mono">
                {metrics.flaggedSpamSubmissions24h}
              </span>
              <span className="text-[11px] text-rose-600 dark:text-rose-400 font-bold">in queue</span>
            </div>
          </Card>
        </div>
      )}

      {/* Global System Question Bank Matrix */}
      <SystemQuestionBankMatrix />

      {/* Global System CRM Field Mapping Governance Matrix */}
      <SystemCrmFieldMappingMatrix />

      {/* Global System Autonomous Decision Playbooks Matrix */}
      <SystemDecisionPlaybookMatrix />

      {/* Global System Research & Data Retention Governance Matrix */}
      <SystemResearchGovernanceMatrix />

      {/* Global System Predictive Intelligence & Churn Forecasting Matrix */}
      <SystemPredictiveIntelligenceMatrix />

      {/* Drop-off Intelligence Radar Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          Step Drop-off & Funnel Friction Radar
        </h2>
        <DropoffIntelligenceRadar dropoffs={dropoffs} />
      </div>

      {/* Spam Moderation Queue Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          Flagged Bot & Flood Submission Moderation Queue
        </h2>
        <SpamAbuseQueue
          flaggedSubmissions={flaggedSubmissions}
          onRefresh={fetchSurveyData}
        />
      </div>
    </div>
  );
}
