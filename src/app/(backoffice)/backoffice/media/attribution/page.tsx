'use client';

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 * 
 * 1. Single Source of Truth for Backoffice Attribution Governance:
 *    Super-admin governance UI for zero-code configuration of enterprise revenue attribution models,
 *    lookback windows, engagement qualification thresholds, and idempotent FER batch recalculation.
 * 2. High Load & Chunked Batch Safety:
 *    Attribution recalculations are partitioned into chunked batches capped at max 150 operations per commit.
 * 3. Mobile Accessibility & Touch Target Bounds:
 *    All buttons, inputs, and toggles strictly enforce `min-h-[44px] min-w-[44px]` touch target bounds
 *    with tactile micro-animations (`active:scale-[0.97]`).
 * 4. Strict Typing Standard: Zero use of `any` or `any[]`.
 */

import { useState, useEffect, useCallback } from 'react';
import { useFirestore } from '@/lib/firestore-context';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { AttributionModelType, AttributionGovernanceConfig } from '@/lib/types/media-2.0';
import {
  getAttributionGovernanceConfigAction,
  saveAttributionGovernanceConfigAction,
  DEFAULT_ATTRIBUTION_CONFIG,
} from '@/lib/media/attribution-service';
import {
  recomputeAttributionAction,
  type AttributionRecomputeSummary,
} from '@/lib/media/attribution-fer-service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  ShieldCheck, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Layers, 
  DollarSign, 
  CheckCircle2, 
  AlertTriangle, 
  PieChart 
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function BackofficeAttributionGovernancePage() {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [config, setConfig] = useState<AttributionGovernanceConfig>({
    ...DEFAULT_ATTRIBUTION_CONFIG,
    workspaceId: activeWorkspaceId || '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecomputing, setIsRecomputing] = useState(false);
  const [recomputeResult, setRecomputeResult] = useState<AttributionRecomputeSummary | null>(null);

  const loadConfig = useCallback(async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const data = await getAttributionGovernanceConfigAction(firestore, activeWorkspaceId);
      setConfig(data);
    } catch (err) {
      console.error('[BackofficeAttributionGovernance] Error loading config:', err);
    } finally {
      setIsLoading(false);
    }
  }, [firestore, activeWorkspaceId]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleSaveConfig = async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsSaving(true);
    try {
      await saveAttributionGovernanceConfigAction(firestore, activeWorkspaceId, config);
      toast({
        title: 'Attribution Governance Saved',
        description: 'Default attribution model and lookback parameters have been updated.',
      });
    } catch (err) {
      console.error('[handleSaveConfig] Error:', err);
      toast({
        title: 'Failed to Save Configuration',
        description: 'An error occurred while saving governance settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRunRecompute = async () => {
    if (!firestore || !activeWorkspaceId) return;
    setIsRecomputing(true);
    setRecomputeResult(null);
    try {
      const result = await recomputeAttributionAction(
        firestore,
        activeWorkspaceId,
        config.defaultModel
      );
      setRecomputeResult(result);
      if (result.success) {
        toast({
          title: 'Attribution Recalculation Complete',
          description: `Processed ${result.totalDealsScanned} deals, ${result.totalAttributionsComputed} touchpoints updated.`,
        });
      } else {
        toast({
          title: 'Recalculation Warning',
          description: result.errorMessage || 'Completed with warnings.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast({
        title: 'Recalculation Failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsRecomputing(false);
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-8 text-left">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-card border border-border shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border-primary/20">
              System Console
            </Badge>
            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
              Zero-Code Governance
            </Badge>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Media Attribution & Revenue Governance
          </h1>
          <p className="text-xs text-muted-foreground">
            Configure Multi-Touch attribution algorithms, lookback policies, and run chunked FER batch recomputations.
          </p>
        </div>

        <Button
          onClick={handleSaveConfig}
          disabled={isSaving || isLoading}
          className="rounded-2xl h-11 px-6 min-h-[44px] gap-2 font-black text-xs active:scale-[0.97]"
        >
          {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Save Governance Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Default Attribution Model & Window */}
        <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary shrink-0">
                <PieChart className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground">
                  Default Attribution Model & Window
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Controls how revenue credit is partitioned across media touchpoints for closed deals.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Model Select */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">
                Primary Attribution Model
              </Label>
              <Select
                value={config.defaultModel}
                onValueChange={(val: string) =>
                  setConfig((prev) => ({ ...prev, defaultModel: val as AttributionModelType }))
                }
              >
                <SelectTrigger className="rounded-xl h-11 min-h-[44px] text-xs font-bold">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="LINEAR" className="text-xs font-semibold">
                    Linear (1/N Equal Distribution)
                  </SelectItem>
                  <SelectItem value="FIRST_TOUCH" className="text-xs font-semibold">
                    First-Touch (100% Initial Asset)
                  </SelectItem>
                  <SelectItem value="LAST_TOUCH" className="text-xs font-semibold">
                    Last-Touch (100% Closer Asset)
                  </SelectItem>
                  <SelectItem value="TIME_DECAY" className="text-xs font-semibold">
                    Time-Decay (7-Day Exponential Decay)
                  </SelectItem>
                  <SelectItem value="POSITION_BASED" className="text-xs font-semibold">
                    Position-Based (40/20/40 U-Shape)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                All models strictly enforce the mathematical invariant &sum; weight &equiv; 1.0000.
              </p>
            </div>

            {/* Lookback Window */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">
                Attribution Lookback Window (Days)
              </Label>
              <Select
                value={String(config.defaultLookbackDays)}
                onValueChange={(val: string) =>
                  setConfig((prev) => ({ ...prev, defaultLookbackDays: Number(val) }))
                }
              >
                <SelectTrigger className="rounded-xl h-11 min-h-[44px] text-xs font-bold">
                  <SelectValue placeholder="Lookback Window" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="14" className="text-xs font-semibold">14 Days</SelectItem>
                  <SelectItem value="30" className="text-xs font-semibold">30 Days (Standard)</SelectItem>
                  <SelectItem value="60" className="text-xs font-semibold">60 Days</SelectItem>
                  <SelectItem value="90" className="text-xs font-semibold">90 Days (Enterprise)</SelectItem>
                  <SelectItem value="180" className="text-xs font-semibold">180 Days (Long Cycle)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Primary Currency Symbol */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">
                Primary Currency Symbol
              </Label>
              <Input
                value={config.currencySymbol}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, currencySymbol: e.target.value }))
                }
                placeholder="e.g. GH₵ or $"
                className="rounded-xl h-11 min-h-[44px] text-xs font-bold"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Engagement Qualification & Velocity Metrics */}
        <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/20 border-b border-border p-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-500 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground">
                  Qualification & Velocity Metrics
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Define thresholds for qualifying touches as &apos;ENGAGED&apos; vs casual views.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            {/* Minimum Engagement Progress Percent */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase text-muted-foreground">
                Min Watch Progress for &apos;ENGAGED&apos; Status (%)
              </Label>
              <Input
                type="number"
                min={10}
                max={90}
                value={config.minEngagementProgressPercent}
                onChange={(e) =>
                  setConfig((prev) => ({
                    ...prev,
                    minEngagementProgressPercent: Number(e.target.value) || 50,
                  }))
                }
                className="rounded-xl h-11 min-h-[44px] text-xs font-bold"
              />
              <p className="text-[11px] text-muted-foreground">
                Prospects watching at least this percentage of media qualify for Engaged status.
              </p>
            </div>

            {/* Deal Acceleration Metrics Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/20 border border-border">
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-foreground block">
                  Enable Deal Acceleration Metrics
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  Compare sales cycle durations of media-touched deals vs untouched baseline.
                </span>
              </div>
              <Switch
                checked={config.enableDealAccelerationMetrics}
                onCheckedChange={(checked: boolean) =>
                  setConfig((prev) => ({ ...prev, enableDealAccelerationMetrics: checked }))
                }
              />
            </div>

            {/* Mathematical Invariant Assurance Box */}
            <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span className="text-xs font-black uppercase">Revenue Invariant Guaranteed</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                For every closed-won deal, the sum of weights across all touched media assets strictly equals 1.0000. Revenue is never double-counted.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 3: One-Click Idempotent FER Attribution Recompute */}
      <Card className="rounded-3xl border border-border shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b border-border p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
                <Layers className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold text-foreground">
                  Idempotent FER Attribution Batch Recomputation
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground">
                  Re-scans all workspace deals and media engagement telemetry to recompute multi-touch attribution records.
                </CardDescription>
              </div>
            </div>

            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider self-start sm:self-auto">
              Batch limit: Max 150 ops / commit
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Run this batch runner when altering attribution models or lookback periods to retroactively reconcile attribution records in the <code className="text-primary font-mono text-[11px]">media_attributions</code> collection.
          </p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button
              onClick={handleRunRecompute}
              disabled={isRecomputing || isLoading}
              className="rounded-2xl h-11 px-6 min-h-[44px] gap-2 font-black text-xs active:scale-[0.97]"
            >
              {isRecomputing ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isRecomputing ? 'Recomputing Attributions...' : 'Recompute Workspace Attributions'}
            </Button>
          </div>

          {/* Recompute Results Banner */}
          {recomputeResult && (
            <div className={cn(
              'p-4 rounded-2xl border text-xs space-y-2',
              recomputeResult.success
                ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-300'
            )}>
              <div className="flex items-center gap-2 font-black">
                {recomputeResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                <span>Recomputation Summary</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-foreground">
                <div className="p-2 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground font-black block uppercase">Deals Scanned</span>
                  <span className="text-sm font-black">{recomputeResult.totalDealsScanned}</span>
                </div>
                <div className="p-2 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground font-black block uppercase">Deals Influenced</span>
                  <span className="text-sm font-black">{recomputeResult.totalDealsInfluenced}</span>
                </div>
                <div className="p-2 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground font-black block uppercase">Attributions Saved</span>
                  <span className="text-sm font-black">{recomputeResult.totalAttributionsComputed}</span>
                </div>
                <div className="p-2 rounded-xl bg-card border border-border">
                  <span className="text-[10px] text-muted-foreground font-black block uppercase">Batches Committed</span>
                  <span className="text-sm font-black">{recomputeResult.totalBatchesCommitted}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
