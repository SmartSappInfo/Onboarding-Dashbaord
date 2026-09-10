'use client';

/**
 * @fileoverview Backoffice Platform Control Plane for Deal & Buyer Intelligence (Phase 6).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills PRD Section 44 and Backoffice Governance Specs:
 * 1. Health Factor Weight Builder: Visual editor for 4-pillar weights with 1-click Auto-Balance to Σ = 1.0 (100%).
 * 2. Stage Stagnation Thresholds: Configurable benchmark days before deals are flagged as Stalled.
 * 3. Single-Threading Dollar Threshold: Custom enterprise limits (e.g. $10,000) gating multi-threading alerts.
 * 4. FER Migration Runner: 1-click execution of idempotent Fetch-Enrich-Restore provisioning for signals, cards, and briefs.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strictly typed (zero 'any' or 'any[]').
 * - Touch targets maintain >= 44px height (min-h-[44px]) for mobile accessibility.
 * - Tactile micro-interactions use active:scale-[0.97] (emilkowal-animations).
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
  Compass,
  Sliders,
  Clock,
  Users,
  Save,
  Loader2,
  Database,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { DealIntelligenceGovernance } from '@/lib/deal-intelligence/types';
import {
  autoBalanceDealHealthWeights,
  DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE,
} from '@/lib/deal-intelligence/deal-intelligence-engine';
import {
  getDealIntelligenceOverviewAction,
  saveDealIntelligenceGovernanceAction,
  executeDealIntelligenceMigrationAction,
} from '@/app/actions/deal-intelligence-actions';

export const BackofficeDealGovernanceClient: React.FC = () => {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const actorId = user?.uid || 'usr_admin';
  const actorName = user?.displayName || 'RevOps Administrator';

  // State
  const [governance, setGovernance] = React.useState<DealIntelligenceGovernance>({
    ...DEFAULT_DEAL_INTELLIGENCE_GOVERNANCE,
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
      const res = await getDealIntelligenceOverviewAction({
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
        description: 'Failed to load deal intelligence governance settings.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, organizationId, actorId, actorName, toast]);

  React.useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  // Weight Percentage Calculation
  const totalPercent = Math.round(
    ((governance.healthWeights.engagementRecency || 0) +
      (governance.healthWeights.stakeholderBreadth || 0) +
      (governance.healthWeights.stageVelocity || 0) +
      (governance.healthWeights.conversationSentiment || 0)) *
      100
  );

  const isBalanced = totalPercent === 100;

  const handleAutoBalance = () => {
    const balanced = autoBalanceDealHealthWeights(governance.healthWeights);
    setGovernance((prev) => ({
      ...prev,
      healthWeights: balanced,
    }));
    toast({
      title: 'Weights Auto-Balanced',
      description: 'Pillar weights have been normalized to sum to exactly 100%.',
    });
  };

  const handleSaveGovernance = async () => {
    if (!isBalanced) {
      toast({
        title: 'Validation Error',
        description: `Factor weights sum to ${totalPercent}%. They must equal exactly 100%.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSaving(true);
      const res = await saveDealIntelligenceGovernanceAction({
        workspaceId,
        organizationId,
        governance,
        actorId,
        actorName,
      });

      if (res.success && res.governance) {
        setGovernance(res.governance);
        toast({
          title: 'Governance Saved',
          description: 'Deal intelligence calculation rules updated across workspace.',
        });
      } else {
        toast({
          title: 'Save Failed',
          description: res.error || 'Failed to save governance rules.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Unable to communicate with server.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunSeeder = async () => {
    try {
      setIsSeeding(true);
      const res = await executeDealIntelligenceMigrationAction({
        workspaceId,
        organizationId,
        actorId,
        actorName,
      });

      if (res.success) {
        toast({
          title: 'FER Migration & Seeding Complete',
          description: `Provisioned ${res.signalsCreated} signals, ${res.dealHealthCardsCreated} health cards, ${res.stakeholderMapsCreated} stakeholder maps, and ${res.meetingBriefsCreated} briefs.`,
        });
        await loadGovernance();
      } else {
        toast({
          title: 'Seeding Notice',
          description: res.error || 'Seeding process completed with warnings.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Failed to run migration protocol.',
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
          Loading Deal Intelligence Governance...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 lg:p-10 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Compass className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Deal Intelligence Governance
              </h1>
              <p className="text-xs text-muted-foreground">
                Platform control plane for deal health scoring formulas, stagnation limits, and multi-threading thresholds.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={isSeeding}
            onClick={handleRunSeeder}
            className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
          >
            {isSeeding ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Database className="w-3.5 h-3.5 mr-1.5 text-primary" />
            )}
            Run FER Seeder
          </Button>

          <Button
            size="sm"
            disabled={isSaving || !isBalanced}
            onClick={handleSaveGovernance}
            className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5 mr-1.5" />
            )}
            Save Governance
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="weights" className="space-y-6">
        <TabsList className="grid grid-cols-1 sm:grid-cols-3 h-auto p-1 bg-muted/60 min-h-[48px]">
          <TabsTrigger
            value="weights"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background"
          >
            <Sliders className="w-3.5 h-3.5 mr-2 text-primary" />
            Health Factor Weights
          </TabsTrigger>
          <TabsTrigger
            value="stagnation"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background"
          >
            <Clock className="w-3.5 h-3.5 mr-2 text-amber-500" />
            Stage Stagnation Days
          </TabsTrigger>
          <TabsTrigger
            value="thresholds"
            className="min-h-[44px] text-xs font-semibold data-[state=active]:bg-background"
          >
            <Users className="w-3.5 h-3.5 mr-2 text-purple-500" />
            Multi-Threading & Signals
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Health Factor Weights */}
        <TabsContent value="weights">
          <Card className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  4-Pillar Deal Health Weights
                </h3>
                <p className="text-xs text-muted-foreground">
                  Configure the relative importance of each pillar. Total must sum to 100%.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Badge
                  className={
                    isBalanced
                      ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                  }
                >
                  {isBalanced ? (
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                  )}
                  Total: {totalPercent}%
                </Badge>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAutoBalance}
                  className="min-h-[44px] active:scale-[0.97] text-xs font-semibold"
                >
                  Auto-Balance (100%)
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pillar 1 */}
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    1. Engagement Recency & Cadence
                  </span>
                  <div className="flex items-center gap-1 w-24">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(governance.healthWeights.engagementRecency * 100)}
                      onChange={(e) =>
                        setGovernance({
                          ...governance,
                          healthWeights: {
                            ...governance.healthWeights,
                            engagementRecency: (Number(e.target.value) || 0) / 100,
                          },
                        })
                      }
                      className="text-xs font-mono h-9 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Evaluates elapsed days since last human customer contact and interaction frequency in the last 14 days.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    2. Multi-Threading & Stakeholders
                  </span>
                  <div className="flex items-center gap-1 w-24">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(governance.healthWeights.stakeholderBreadth * 100)}
                      onChange={(e) =>
                        setGovernance({
                          ...governance,
                          healthWeights: {
                            ...governance.healthWeights,
                            stakeholderBreadth: (Number(e.target.value) || 0) / 100,
                          },
                        })
                      }
                      className="text-xs font-mono h-9 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Measures total engaged stakeholders and flags single-threaded risk on high-value opportunities.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    3. Stage Velocity & Stagnation
                  </span>
                  <div className="flex items-center gap-1 w-24">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(governance.healthWeights.stageVelocity * 100)}
                      onChange={(e) =>
                        setGovernance({
                          ...governance,
                          healthWeights: {
                            ...governance.healthWeights,
                            stageVelocity: (Number(e.target.value) || 0) / 100,
                          },
                        })
                      }
                      className="text-xs font-mono h-9 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Penalizes deals lingering past stage benchmarks and repeated close date slippage.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">
                    4. Conversation Sentiment & Objections
                  </span>
                  <div className="flex items-center gap-1 w-24">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={Math.round(governance.healthWeights.conversationSentiment * 100)}
                      onChange={(e) =>
                        setGovernance({
                          ...governance,
                          healthWeights: {
                            ...governance.healthWeights,
                            conversationSentiment: (Number(e.target.value) || 0) / 100,
                          },
                        })
                      }
                      className="text-xs font-mono h-9 text-right"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Incorporates Phase 5 call scorecard scores, net sentiment balance, and unresolved objections.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Stage Stagnation Days */}
        <TabsContent value="stagnation">
          <Card className="p-6 space-y-6">
            <div className="space-y-1 border-b pb-4">
              <h3 className="text-base font-bold text-foreground">
                Stage Stagnation Benchmark Days
              </h3>
              <p className="text-xs text-muted-foreground">
                Deals exceeding these day thresholds in a stage will suffer automated health degradation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(governance.stageStagnationDays).map(([stage, days]) => (
                <div key={stage} className="rounded-lg border p-3.5 bg-muted/20 space-y-1.5">
                  <span className="text-xs font-bold capitalize text-foreground">
                    {stage.replace(/_/g, ' ')}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={90}
                      value={days}
                      onChange={(e) =>
                        setGovernance({
                          ...governance,
                          stageStagnationDays: {
                            ...governance.stageStagnationDays,
                            [stage]: Number(e.target.value) || 1,
                          },
                        })
                      }
                      className="text-xs font-mono h-9"
                    />
                    <span className="text-xs text-muted-foreground">days</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        {/* Tab 3: Multi-Threading & Signal Thresholds */}
        <TabsContent value="thresholds">
          <Card className="p-6 space-y-6">
            <div className="space-y-1 border-b pb-4">
              <h3 className="text-base font-bold text-foreground">
                Enterprise Multi-Threading & Intent Thresholds
              </h3>
              <p className="text-xs text-muted-foreground">
                Rule thresholds that trigger automated warnings and high-intent alerts.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <span className="text-xs font-bold text-foreground">
                  Single-Threaded Deal Value Alert ($)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min={1000}
                    step={1000}
                    value={governance.singleThreadedValueThreshold}
                    onChange={(e) =>
                      setGovernance({
                        ...governance,
                        singleThreadedValueThreshold: Number(e.target.value) || 10000,
                      })
                    }
                    className="text-xs font-mono h-9"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Opportunities at or above this value will flag a Single-Threaded warning if only 1 contact is engaged.
                </p>
              </div>

              <div className="rounded-lg border p-4 bg-muted/20 space-y-2">
                <span className="text-xs font-bold text-foreground">
                  High-Intent Confidence Minimum (%)
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={50}
                    max={99}
                    value={governance.highIntentConfidenceThreshold}
                    onChange={(e) =>
                      setGovernance({
                        ...governance,
                        highIntentConfidenceThreshold: Number(e.target.value) || 70,
                      })
                    }
                    className="text-xs font-mono h-9"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Signals meeting or exceeding this confidence score will automatically be classified as High Intent.
                </p>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
