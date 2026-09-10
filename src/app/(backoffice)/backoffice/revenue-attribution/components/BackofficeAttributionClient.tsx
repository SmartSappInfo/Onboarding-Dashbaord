'use client';

/**
 * @fileoverview Backoffice Platform Control Plane for Revenue Attribution & Predictive Forecasting (Phase 7).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 7:
 * 1. Attribution Model Governance: Configure default models, position weights, and custom stage weights.
 * 2. Visual Stage Weight Builder with 1-click Auto-Balance to Σ = 1.0 (100%).
 * 3. Predictive Forecasting Bounds: Monte Carlo iterations (10,000), commit probability thresholds, and slippage days.
 * 4. FER Migration Runner: Idempotent Fetch-Enrich-Restore provisioning for demo attributions, deals, and targets.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing policy enforced. Zero 'any' or 'any[]'.
 * - Mobile accessibility: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  TrendingUp,
  Layers,
  Sliders,
  Save,
  Loader2,
  Database,
  CheckCircle2,
  BarChart3,
  ShieldCheck,
} from 'lucide-react';
import type {
  AttributionModelType,
  RevenueForecastingGovernance,
} from '@/lib/revenue-forecasting/types';
import {
  autoBalanceAttributionWeights,
  DEFAULT_FORECASTING_GOVERNANCE,
} from '@/lib/revenue-forecasting/forecasting-engine';
import {
  getRevenueForecastOverviewAction,
  saveRevenueGovernanceAction,
  executeRevenueMigrationAction,
} from '@/app/actions/revenue-forecasting-actions';

export const BackofficeAttributionClient: React.FC = () => {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const actorId = user?.uid || 'usr_admin';
  const actorName = user?.displayName || 'RevOps Administrator';

  // State
  const [governance, setGovernance] = React.useState<RevenueForecastingGovernance>({
    ...DEFAULT_FORECASTING_GOVERNANCE,
    workspaceId,
    organizationId,
  });

  const [isLoading, setIsLoading] = React.useState<boolean>(true);
  const [isSaving, setIsSaving] = React.useState<boolean>(false);
  const [isSeeding, setIsSeeding] = React.useState<boolean>(false);

  // Load governance configuration
  const loadGovernance = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getRevenueForecastOverviewAction({
        workspaceId,
        organizationId,
        userId: actorId,
        userName: actorName,
      });

      if (res.success && res.governance) {
        setGovernance(res.governance);
      }
    } catch {
      toast({
        title: 'Loading Failed',
        description: 'Failed to load revenue forecasting governance settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, organizationId, actorId, actorName, toast]);

  React.useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  // Stage Weights Total
  const stageWeightsSum = Math.round(
    ((governance.customStageWeights.lead || 0) +
      (governance.customStageWeights.discovery || 0) +
      (governance.customStageWeights.demo || 0) +
      (governance.customStageWeights.proposal || 0) +
      (governance.customStageWeights.closing || 0)) *
      100
  );

  const isStageWeightsBalanced = stageWeightsSum === 100;

  const handleAutoBalanceStages = () => {
    const balanced = autoBalanceAttributionWeights(governance.customStageWeights);
    setGovernance((prev) => ({
      ...prev,
      customStageWeights: balanced,
    }));
    toast({
      title: 'Stage Weights Auto-Balanced',
      description: 'Stage attribution weights have been normalized to sum to exactly 100%.',
    });
  };

  const handleSaveGovernance = async () => {
    try {
      setIsSaving(true);
      const res = await saveRevenueGovernanceAction({
        workspaceId,
        organizationId,
        governance,
        actorId,
        actorName,
      });

      if (res.success && res.governance) {
        setGovernance(res.governance);
        toast({
          title: 'Governance Policy Saved',
          description: 'Attribution rules and simulation parameters updated successfully.',
        });
      } else {
        throw new Error(res.error || 'Failed to save governance');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed';
      toast({
        title: 'Save Failed',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunMigration = async () => {
    try {
      setIsSeeding(true);
      const res = await executeRevenueMigrationAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
      });

      if (res.success) {
        toast({
          title: 'FER Migration Successful',
          description: `Provisioned sample touchpoints (${res.touchpointsCreated}), attribution records (${res.attributionsCreated}), and forecast pipeline.`,
        });
        await loadGovernance();
      } else {
        throw new Error(res.error || 'Migration failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Migration failed';
      toast({
        title: 'Migration Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-medium">
          Loading revenue attribution governance...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Title Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Revenue Attribution & Forecasting Governance
              </h1>
              <p className="text-xs text-muted-foreground">
                Configure enterprise multi-touch attribution models, stage weights, Monte Carlo simulation parameters, and FER seeding.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handleSaveGovernance}
            disabled={isSaving}
            className="rounded-xl font-bold text-xs gap-2 min-h-[44px] shadow-sm active:scale-[0.97]"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Governance Policy</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="models" className="space-y-6">
        <TabsList className="bg-muted/40 p-1 rounded-2xl border flex flex-wrap gap-1 justify-start h-auto">
          <TabsTrigger
            value="models"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97]"
          >
            <Layers className="w-4 h-4 text-emerald-600" />
            <span>Attribution Models & Weights</span>
          </TabsTrigger>

          <TabsTrigger
            value="simulation"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97]"
          >
            <BarChart3 className="w-4 h-4 text-primary" />
            <span>Monte Carlo & Pacing Parameters</span>
          </TabsTrigger>

          <TabsTrigger
            value="migration"
            className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 min-h-[44px] active:scale-[0.97]"
          >
            <Database className="w-4 h-4 text-indigo-600" />
            <span>FER Migration Protocol</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Attribution Models & Weights */}
        <TabsContent value="models" className="space-y-6 focus-visible:outline-none">
          {/* Default Model Selector */}
          <Card className="border-border/50 rounded-2xl p-6 bg-card shadow-sm space-y-4">
            <div className="space-y-1 border-b pb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Default Workspace Attribution Model
              </h3>
              <p className="text-xs text-muted-foreground">
                The primary attribution algorithm applied to won and in-flight pipeline credit splits.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                {
                  id: 'position_based',
                  name: 'Position-Based (40/20/40)',
                  desc: '40% credit to first touch, 40% to closing touch, 20% split among nurturing touches.',
                },
                {
                  id: 'linear',
                  name: 'Linear (Equal Split)',
                  desc: 'Equal percentage credit split across all validated touches in the buyer journey.',
                },
                {
                  id: 'time_decay',
                  name: 'Time-Decay',
                  desc: 'Exponential half-life favoring touches closest to the deal closed-won date.',
                },
                {
                  id: 'first_touch',
                  name: 'First-Touch',
                  desc: '100% credit to the initial lead generation touchpoint.',
                },
                {
                  id: 'last_touch',
                  name: 'Last-Touch',
                  desc: '100% credit to the final closing interaction.',
                },
                {
                  id: 'custom_weighted',
                  name: 'Custom Stage Weighted',
                  desc: 'Weighted based on specific enterprise stage value multipliers.',
                },
              ].map((m) => {
                const isSelected = governance.defaultAttributionModel === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() =>
                      setGovernance((prev) => ({
                        ...prev,
                        defaultAttributionModel: m.id as AttributionModelType,
                      }))
                    }
                    className={`p-4 rounded-xl border cursor-pointer transition-all active:scale-[0.97] min-h-[44px] ${
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                        : 'border-border/50 bg-card hover:bg-muted/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-foreground">{m.name}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">
                      {m.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Custom Stage Weights Visual Builder */}
          <Card className="border-border/50 rounded-2xl p-6 bg-card shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-600" />
                  Custom Stage Attribution Weight Builder
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define revenue credit percentage by deal stage. Weights must sum to exactly 100% (1.00).
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={`text-xs font-bold px-3 py-1 ${
                    isStageWeightsBalanced
                      ? 'border-emerald-500/40 text-emerald-700 bg-emerald-500/10'
                      : 'border-rose-500/40 text-rose-700 bg-rose-500/10'
                  }`}
                >
                  Total: {stageWeightsSum}% {isStageWeightsBalanced ? '(Balanced)' : '(Unbalanced)'}
                </Badge>
                {!isStageWeightsBalanced && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleAutoBalanceStages}
                    className="h-9 text-xs font-bold rounded-xl text-primary border-primary/30 min-h-[44px]"
                  >
                    Auto-Balance (100%)
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {[
                { key: 'lead', label: '1. Lead Generation', current: governance.customStageWeights.lead },
                { key: 'discovery', label: '2. Discovery Meeting', current: governance.customStageWeights.discovery },
                { key: 'demo', label: '3. Technical Demo', current: governance.customStageWeights.demo },
                { key: 'proposal', label: '4. Proposal & Pricing', current: governance.customStageWeights.proposal },
                { key: 'closing', label: '5. Contract & Closing', current: governance.customStageWeights.closing },
              ].map((stage) => (
                <div key={stage.key} className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-2">
                  <span className="text-xs font-bold text-foreground block">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={stage.current}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setGovernance((prev) => ({
                          ...prev,
                          customStageWeights: {
                            ...prev.customStageWeights,
                            [stage.key]: val,
                          },
                        }));
                      }}
                      className="h-10 text-xs font-bold rounded-xl"
                    />
                    <span className="text-xs font-bold text-muted-foreground w-12">
                      {Math.round(stage.current * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Monte Carlo & Pacing Parameters */}
        <TabsContent value="simulation" className="space-y-6 focus-visible:outline-none">
          <Card className="border-border/50 rounded-2xl p-6 bg-card shadow-sm space-y-6">
            <div className="space-y-1 border-b pb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Monte Carlo Predictive Simulation Tuning
              </h3>
              <p className="text-xs text-muted-foreground">
                Statistical simulation iterations, threshold confidence, and slippage alert triggers.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Iterations */}
              <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/10">
                <label className="text-xs font-bold text-foreground block">
                  Monte Carlo Iterations
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Number of simulated pipeline runs. Recommended: 10,000 for enterprise accuracy.
                </p>
                <Input
                  type="number"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={governance.monteCarloIterations}
                  onChange={(e) =>
                    setGovernance((prev) => ({
                      ...prev,
                      monteCarloIterations: parseInt(e.target.value, 10) || 10000,
                    }))
                  }
                  className="h-10 text-xs font-bold rounded-xl"
                />
              </div>

              {/* Commit Probability Threshold */}
              <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/10">
                <label className="text-xs font-bold text-foreground block">
                  Commit Probability Threshold
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Minimum calculated win probability to qualify for Committed category.
                </p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0.5"
                    max="0.99"
                    step="0.05"
                    value={governance.commitProbabilityThreshold}
                    onChange={(e) =>
                      setGovernance((prev) => ({
                        ...prev,
                        commitProbabilityThreshold: parseFloat(e.target.value) || 0.85,
                      }))
                    }
                    className="h-10 text-xs font-bold rounded-xl"
                  />
                  <span className="text-xs font-bold text-primary">
                    {Math.round(governance.commitProbabilityThreshold * 100)}%
                  </span>
                </div>
              </div>

              {/* Slippage Alert Threshold Days */}
              <div className="space-y-2 p-4 rounded-xl border border-border/50 bg-muted/10">
                <label className="text-xs font-bold text-foreground block">
                  Slippage Alert Threshold (Days)
                </label>
                <p className="text-[11px] text-muted-foreground">
                  Calendar days of delay before a deal is escalated to High Slippage Severity.
                </p>
                <Input
                  type="number"
                  min="5"
                  max="60"
                  value={governance.slippageAlertThresholdDays}
                  onChange={(e) =>
                    setGovernance((prev) => ({
                      ...prev,
                      slippageAlertThresholdDays: parseInt(e.target.value, 10) || 14,
                    }))
                  }
                  className="h-10 text-xs font-bold rounded-xl"
                />
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: FER Migration Runner */}
        <TabsContent value="migration" className="space-y-6 focus-visible:outline-none">
          <Card className="border-border/50 rounded-2xl p-6 bg-card shadow-sm space-y-6">
            <div className="space-y-1 border-b pb-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                Fetch-Enrich-Restore (FER) Migration Protocol
              </h3>
              <p className="text-xs text-muted-foreground">
                Idempotently seeds canonical governance policies, sample multi-touch buyer interactions, Clari categorized opportunities, and quarterly quota pace records.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-muted/20 border border-border/50 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Idempotent Operation Guarantees</span>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc pl-5">
                <li>Non-destructive: Will not overwrite existing custom governance policies or live CRM deals.</li>
                <li>Batch write resilience: All Firestore write commits are strictly bounded to $\le 25$ operations.</li>
                <li>Exact penny reconciliation: Reconciles all sample multi-rep credit splits with zero rounding float drift.</li>
              </ul>
            </div>

            <div className="pt-2">
              <Button
                onClick={handleRunMigration}
                disabled={isSeeding}
                className="h-11 text-xs font-bold rounded-xl gap-2 min-h-[44px] shadow-sm bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.97]"
              >
                {isSeeding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Database className="w-4 h-4" />
                )}
                <span>Execute Idempotent FER Migration</span>
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
