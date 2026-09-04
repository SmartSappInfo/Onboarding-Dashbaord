'use client';

/**
 * @fileoverview Backoffice Platform Control Plane for Revenue OS & Simulator (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10 Backoffice Governance:
 * 1. Simulation Elasticity Bounds: Max allowable Win Rate (+5% to +50%) and Deal Size (+5% to +100%) modifiers.
 * 2. Target Quota Coverage Ratio: Sets the corporate benchmark ratio (default 3.5x).
 * 3. Ramp Curve Model Preset: Toggle between Standard 3-Month (0.35x/0.70x/1.00x) and Enterprise 6-Month ramp.
 * 4. Executive AI Model: Select foundation model for Boardroom Briefings & Strategic Recommendations.
 * 5. FER Seeder & Baseline Synchronization: Idempotent re-initialization of baseline scenarios.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile accessibility: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 *
 * @testability Isolated client component with deterministic Server Action mutations.
 */

import * as React from 'react';
import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useUser } from '@/firebase';
import {
  Save,
  Loader2,
  Sparkles,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import {
  getExecutiveBoardroomDataAction,
  updateRevenueOsGovernanceAction,
  reseedRevenueOsDefaultsAction,
} from '@/app/actions/revenue-os-actions';

export default function BackofficeRevenueOsClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  const { toast } = useToast();

  const workspaceId = activeWorkspaceId || 'ws_default';
  const organizationId = activeOrganizationId || 'org_default';
  const actorId = user?.uid || 'usr_superadmin';

  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isReseeding, setIsReseeding] = React.useState(false);

  // Governance Policy Form State
  const [maxWinRate, setMaxWinRate] = React.useState(20);
  const [maxDealSize, setMaxDealSize] = React.useState(30);
  const [targetCoverage, setTargetCoverage] = React.useState(3.5);
  const [rampModel, setRampModel] = React.useState<'standard_3month' | 'enterprise_6month'>('standard_3month');
  const [aiModel, setAiModel] = React.useState('googleai/gemini-1.5-pro');

  const loadGovernance = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await getExecutiveBoardroomDataAction({
        workspaceId,
        organizationId,
        actorId,
      });

      if (res.success && res.data?.governance) {
        const gov = res.data.governance;
        setMaxWinRate(gov.maxWinRateModifierPercent);
        setMaxDealSize(gov.maxDealSizeModifierPercent);
        setTargetCoverage(gov.targetQuotaCoverageRatio);
        setRampModel(gov.rampModel);
        setAiModel(gov.executiveAiModel || 'googleai/gemini-1.5-pro');
      }
    } catch (err) {
      toast({
        title: 'Error Loading Governance',
        description: err instanceof Error ? err.message : 'Unknown load error',
        variant: 'destructive',
        actionConfig: { path: '/backoffice/revenue-os', label: 'Revenue OS Governance' },
      });
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, organizationId, actorId, toast]);

  React.useEffect(() => {
    loadGovernance();
  }, [loadGovernance]);

  const handleSaveGovernance = async () => {
    try {
      setIsSaving(true);
      const res = await updateRevenueOsGovernanceAction({
        workspaceId,
        organizationId,
        actorId,
        maxWinRateModifierPercent: maxWinRate,
        maxDealSizeModifierPercent: maxDealSize,
        targetQuotaCoverageRatio: targetCoverage,
        rampModel,
        executiveAiModel: aiModel,
      });

      if (res.success) {
        toast({
          title: 'Governance Saved',
          description: 'Revenue OS parameters and simulation bounds updated successfully.',
        });
      } else {
        toast({
          title: 'Save Failed',
          description: res.error || 'Failed to update governance policy.',
          variant: 'destructive',
          actionConfig: { path: '/backoffice/revenue-os', label: 'Retry Save' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save',
        variant: 'destructive',
        actionConfig: { path: '/backoffice/revenue-os', label: 'Revenue OS Governance' },
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReseed = async () => {
    try {
      setIsReseeding(true);
      const res = await reseedRevenueOsDefaultsAction({
        workspaceId,
        organizationId,
        actorId,
      });

      if (res.success) {
        toast({
          title: 'Defaults Reseeded',
          description: `Initialized ${res.seededScenarios} scenarios and ${res.seededRecommendations} strategic levers.`,
        });
        await loadGovernance();
      } else {
        toast({
          title: 'Reseed Failed',
          description: res.error || 'Could not reseed defaults.',
          variant: 'destructive',
          actionConfig: { path: '/backoffice/revenue-os', label: 'Retry Defaults' },
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Reseed error',
        variant: 'destructive',
        actionConfig: { path: '/backoffice/revenue-os', label: 'Revenue OS Governance' },
      });
    } finally {
      setIsReseeding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-semibold">
          Loading Revenue OS Platform Governance...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12 px-4 sm:px-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
              <Cpu className="h-6 w-6 text-primary" />
              Revenue OS & Simulator Governance
            </h1>
            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
              Domain 10 Control Plane
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure elasticity limits for What-If scenario simulations, ramp curve models, and quota coverage targets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/revenue-operating-system">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
            >
              <span>View Executive Boardroom</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Simulator Elasticity Bounds Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6 space-y-6">
        <div>
          <CardTitle className="text-base font-bold text-foreground">
            What-If Scenario Simulation Bounds
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defensive guardrails preventing unrealistic scenario projections during executive boardroom simulations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Max Win Rate Modifier */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Max Win Rate Delta Allowed</span>
              <Badge variant="outline" className="font-mono text-xs">
                ±{maxWinRate}%
              </Badge>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={maxWinRate}
              onChange={(e) => setMaxWinRate(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="Max Win Rate Delta Slider"
            />
            <p className="text-2xs text-muted-foreground">
              Caps how aggressively sales leadership can model win rate gains in What-If simulations.
            </p>
          </div>

          {/* Max Deal Size Modifier */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Max Average Deal Size Delta Allowed</span>
              <Badge variant="outline" className="font-mono text-xs">
                ±{maxDealSize}%
              </Badge>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={maxDealSize}
              onChange={(e) => setMaxDealSize(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="Max Average Deal Size Delta Slider"
            />
            <p className="text-2xs text-muted-foreground">
              Caps how far average contract values (ACV) can be inflated in simulation scenarios.
            </p>
          </div>
        </div>
      </Card>

      {/* Corporate Targets & Ramp Model Card */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6 space-y-6">
        <div>
          <CardTitle className="text-base font-bold text-foreground">
            Corporate Planning & Capacity Standards
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Standard metrics governing pipeline adequacy and sales rep ramp curves.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          {/* Target Quota Coverage Ratio */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <span className="font-bold text-foreground text-xs block">
              Benchmark Pipeline Coverage Ratio
            </span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                step="0.1"
                min="1.5"
                max="8.0"
                value={targetCoverage}
                onChange={(e) => setTargetCoverage(Number(e.target.value))}
                className="h-10 rounded-xl font-mono text-sm min-h-[44px]"
              />
              <span className="text-xs font-bold text-muted-foreground">x Coverage</span>
            </div>
            <p className="text-2xs text-muted-foreground">
              Enterprise gold standard is 3.5x. Under-coverage triggers boardroom risk alerts.
            </p>
          </div>

          {/* Ramp Curve Model */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <span className="font-bold text-foreground text-xs block">
              Rep Ramp Curve Model
            </span>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button
                type="button"
                variant={rampModel === 'standard_3month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRampModel('standard_3month')}
                className="h-10 text-2xs font-semibold rounded-xl min-h-[44px]"
              >
                Standard (3 Mo)
              </Button>
              <Button
                type="button"
                variant={rampModel === 'enterprise_6month' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setRampModel('enterprise_6month')}
                className="h-10 text-2xs font-semibold rounded-xl min-h-[44px]"
              >
                Enterprise (6 Mo)
              </Button>
            </div>
            <p className="text-2xs text-muted-foreground">
              Standard: 35% (0-3 mo), 70% (4-12 mo), 100% (&gt;12 mo).
            </p>
          </div>

          {/* Executive AI Model */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <span className="font-bold text-foreground text-xs block">
              Executive AI Strategic Model
            </span>
            <Input
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="e.g. googleai/gemini-1.5-pro"
              className="h-10 rounded-xl font-mono text-xs min-h-[44px]"
            />
            <p className="text-2xs text-muted-foreground">
              Underlying foundation model for C-suite briefings and strategy generation.
            </p>
          </div>
        </div>

        {/* Save Governance Button */}
        <div className="flex justify-end pt-2">
          <Button
            type="button"
            size="sm"
            onClick={handleSaveGovernance}
            disabled={isSaving}
            className="h-10 px-5 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5 shadow-sm"
          >
            {isSaving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            <span>Save Platform Governance</span>
          </Button>
        </div>
      </Card>

      {/* FER Seeder & Defaults Synchronization */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-bold text-foreground">
                FER Protocol & Defaults Synchronization
              </CardTitle>
              <Badge variant="outline" className="text-2xs font-mono">
                v10.0-PROD
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Idempotently reset or re-seed baseline What-If scenarios and AI strategic recommendations.
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReseed}
            disabled={isReseeding}
            className="h-10 px-4 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            <span>{isReseeding ? 'Reseeding...' : 'Reseed Baseline Models'}</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
