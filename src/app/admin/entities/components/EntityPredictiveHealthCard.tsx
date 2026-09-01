'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Phase 9: Entity 360 Predictive Health Card
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Multidimensional Predictive Health: Churn Risk, Conversion Propensity, Promoter Index.
 * 2. Next-Best-Action (NBA) Prescriptive Execution.
 * 3. Mobile Ergonomics: min-h-[44px] touch targets, active:scale-[0.97] tactile press.
 * 4. Strict Zero-Any Invariant.
 */

import * as React from 'react';
import type { EntityPredictiveHealth } from '@/lib/types';
import {
  calculateEntityPredictiveHealthAction,
  executePredictiveNextBestAction,
} from '@/lib/surveys/survey-predictive-actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Flame,
  HeartPulse,
  Lightbulb,
  Loader2,
  PhoneCall,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

interface EntityPredictiveHealthCardProps {
  entityId: string;
  workspaceId: string;
  className?: string;
}

export function EntityPredictiveHealthCard({
  entityId,
  workspaceId,
  className,
}: EntityPredictiveHealthCardProps) {
  const { toast } = useToast();

  const [health, setHealth] = React.useState<EntityPredictiveHealth | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isExecutingAction, setIsExecutingAction] = React.useState(false);

  const fetchHealth = React.useCallback(async () => {
    if (!entityId || !workspaceId) return;
    setIsLoading(true);
    try {
      const res = await calculateEntityPredictiveHealthAction(entityId, workspaceId);
      if (res.success && res.health) {
        setHealth(res.health);
      }
    } catch (err) {
      console.error('[EntityPredictiveHealthCard] Fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [entityId, workspaceId]);

  React.useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const handleExecuteAction = async () => {
    if (!health?.nextBestAction) return;
    setIsExecutingAction(true);
    try {
      const res = await executePredictiveNextBestAction(
        entityId,
        health.nextBestAction.type,
        health.nextBestAction.rationale,
        workspaceId
      );

      if (res.success) {
        toast({
          title: 'Prescription Executed',
          description: "Created follow-up CRM task: " + health.nextBestAction.title,
          actionConfig: {
            path: '/admin/tasks',
            label: 'View Tasks',
          },
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Execution Failed',
          description: res.error || 'Failed to dispatch prescribed action',
        });
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'An unexpected error occurred during prescription execution.',
      });
    } finally {
      setIsExecutingAction(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="rounded-2xl border-border bg-card shadow-sm p-6 flex flex-col items-center justify-center space-y-3 min-h-[160px]">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">
          Synthesizing Cross-System Predictive Signals...
        </p>
      </Card>
    );
  }

  if (!health) {
    return null;
  }

  const getStatusColor = (status: EntityPredictiveHealth['healthStatus']) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-600 bg-emerald-500/10 border-emerald-200 dark:border-emerald-800';
      case 'neutral':
        return 'text-amber-600 bg-amber-500/10 border-amber-200 dark:border-amber-800';
      case 'at_risk':
      case 'critical':
        return 'text-rose-600 bg-rose-500/10 border-rose-200 dark:border-rose-800';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  return (
    <Card className={"rounded-2xl border-border bg-card shadow-sm overflow-hidden text-left " + (className || '')}>
      <CardHeader className="pb-4 border-b border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Predictive Survey & Account Intelligence
                <Badge variant="outline" className="text-[10px] font-mono text-indigo-600 border-indigo-300">
                  Phase 9
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Unified synthesis of Survey Telemetry + CRM Pipeline + Engagement Velocity.
              </CardDescription>
            </div>
          </div>
        </div>

        <Badge variant="outline" className={"text-xs px-3 py-1 font-bold uppercase tracking-wider " + getStatusColor(health.healthStatus)}>
          {health.healthStatus.replace('_', ' ')}
        </Badge>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* 1. Multidimensional Predictive Gauges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Health Score */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <HeartPulse className="h-4 w-4 text-indigo-600" />
              <span>Health Score</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground">{health.healthScore}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <Progress value={health.healthScore} className="h-1.5" />
          </div>

          {/* Churn Risk */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Flame className="h-4 w-4 text-rose-600" />
              <span>Churn Risk</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={"text-2xl font-black " + (health.churnRiskPercent >= 50 ? 'text-rose-600' : 'text-foreground')}>
                {health.churnRiskPercent}%
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                {health.churnRiskLevel}
              </Badge>
            </div>
            <Progress value={health.churnRiskPercent} className="h-1.5" />
          </div>

          {/* Conversion Propensity */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <span>Conversion</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground">{health.conversionPropensityPercent}%</span>
            </div>
            <Progress value={health.conversionPropensityPercent} className="h-1.5" />
          </div>

          {/* Promoter Index */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
              <Zap className="h-4 w-4 text-amber-600" />
              <span>Promoter Index</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-foreground">{health.promoterIndex}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
            <Progress value={health.promoterIndex} className="h-1.5" />
          </div>
        </div>

        {/* 2. Next-Best-Action (NBA) Prescriptive Intervention Banner */}
        <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold uppercase tracking-wider">
                Next-Best-Action
              </Badge>
              <h4 className="text-sm font-bold text-foreground">{health.nextBestAction.title}</h4>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {health.nextBestAction.rationale}
            </p>
          </div>

          <Button
            size="sm"
            onClick={handleExecuteAction}
            disabled={isExecutingAction}
            className="h-10 px-4 gap-1.5 text-xs font-semibold shrink-0 active:scale-[0.97] bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isExecutingAction ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 fill-white" />
            )}
            Execute Prescription
          </Button>
        </div>

        {/* 3. Driver Diagnostics: Risk Factors vs Positive Growth Drivers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Risk Factors */}
          <div className="p-4 rounded-xl border border-rose-200/60 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-600">
              <AlertTriangle className="h-4 w-4" />
              <span>Identified Risk Drivers</span>
            </div>
            {health.riskFactors.length > 0 ? (
              <ul className="space-y-1.5">
                {health.riskFactors.map((r, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
                    <span>{r.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">No elevated risk indicators detected.</p>
            )}
          </div>

          {/* Positive Growth Drivers */}
          <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60 bg-emerald-50/30 dark:bg-emerald-950/10 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
              <span>Positive Account Accelerators</span>
            </div>
            {health.positiveDrivers.length > 0 ? (
              <ul className="space-y-1.5">
                {health.positiveDrivers.map((p, idx) => (
                  <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <span>{p.description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground italic">No positive accelerators logged yet.</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
