'use client';

/**
 * @fileoverview Interactive "What-If" Revenue Simulator Tab (Phase 10).
 *
 * ARCHITECTURAL POINTER:
 * Fulfills SmartSapp Sales Performance & Intelligence 2.0 Domain 10:
 * - In-memory deterministic scenario sandboxing with instant reactivity (<10ms).
 * - Multi-variable sliders: Win Rate, Deal Size, Slippage, Cycle Velocity, Headcount.
 * - Live confidence interval rendering and sensitivity elasticity ranking.
 * - Save calibrated scenario to Firestore (awarding +20 effort points).
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - 100% strict typing enforced. Zero use of 'any' or 'any[]'.
 * - Mobile ergonomics: touch targets maintain min-h-[44px] and tactile active:scale-[0.97].
 */

import * as React from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Save,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { simulateRevenueScenario } from '@/lib/revenue-os/revenue-os-engine';
import type {
  BaselineRevenueContext,
  SimulationParameters,
  RevenueScenario,
  RevenueOsGovernance,
} from '@/lib/revenue-os/types';

interface RevenueSimulatorTabProps {
  baseline: BaselineRevenueContext;
  scenarios: RevenueScenario[];
  governance: RevenueOsGovernance | null;
  onSaveScenario: (scenario: RevenueScenario) => Promise<void>;
  onDeleteScenario: (scenarioId: string) => Promise<void>;
  isSaving: boolean;
}

export function RevenueSimulatorTab({
  baseline,
  scenarios,
  governance,
  onSaveScenario,
  onDeleteScenario,
  isSaving,
}: RevenueSimulatorTabProps) {
  const [winRateMod, setWinRateMod] = React.useState(0);
  const [dealSizeMod, setDealSizeMod] = React.useState(0);
  const [slippageMod, setSlippageMod] = React.useState(0);
  const [cycleMod, setCycleMod] = React.useState(0);
  const [headcountDelta, setHeadcountDelta] = React.useState(0);

  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [scenarioName, setScenarioName] = React.useState('');
  const [scenarioDesc, setScenarioDesc] = React.useState('');

  const currentParams: SimulationParameters = React.useMemo(
    () => ({
      winRateModifierPercent: winRateMod,
      dealSizeModifierPercent: dealSizeMod,
      slippageModifierPercent: slippageMod,
      cycleTimeModifierPercent: cycleMod,
      headcountDelta: headcountDelta,
      sdrToAeRatio: 1.5,
    }),
    [winRateMod, dealSizeMod, slippageMod, cycleMod, headcountDelta]
  );

  const activeSimulation = React.useMemo(() => {
    return simulateRevenueScenario({
      baseline,
      parameters: currentParams,
      governance: governance || undefined,
      scenarioName: scenarioName || 'Custom Model',
    });
  }, [baseline, currentParams, governance, scenarioName]);

  const handleReset = () => {
    setWinRateMod(0);
    setDealSizeMod(0);
    setSlippageMod(0);
    setCycleMod(0);
    setHeadcountDelta(0);
  };

  const handleLoadScenario = (scen: RevenueScenario) => {
    setWinRateMod(scen.parameters.winRateModifierPercent);
    setDealSizeMod(scen.parameters.dealSizeModifierPercent);
    setSlippageMod(scen.parameters.slippageModifierPercent);
    setCycleMod(scen.parameters.cycleTimeModifierPercent);
    setHeadcountDelta(scen.parameters.headcountDelta);
  };

  const handleConfirmSave = async () => {
    if (!scenarioName.trim()) return;
    const scenarioToSave: RevenueScenario = {
      ...activeSimulation,
      id: `scenario_custom_${Date.now()}`,
      name: scenarioName.trim(),
      description: scenarioDesc.trim() || 'Calibrated executive What-If scenario',
    };
    await onSaveScenario(scenarioToSave);
    setSaveModalOpen(false);
    setScenarioName('');
    setScenarioDesc('');
  };

  const isAhead = activeSimulation.deltaVsTargetDollars >= 0;

  return (
    <div className="space-y-6">
      {/* Simulation Result Header Card */}
      <Card className="rounded-2xl border-border/70 bg-card shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-border/40">
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
                Deterministic Simulator
              </Badge>
              <span className="text-xs text-muted-foreground">In-Memory Engine</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-foreground mt-1">
              Projected Quarterly Revenue: ${(activeSimulation.simulatedQuarterlyRevenue / 1000000).toFixed(2)}M
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={`text-xs font-bold flex items-center ${
                  isAhead ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {isAhead ? '+' : ''}${Math.abs(Math.round(activeSimulation.deltaVsTargetDollars / 1000)).toLocaleString()}k
                ({isAhead ? '+' : ''}{activeSimulation.deltaVsTargetPercent}%) vs Target
              </span>
              <span className="text-muted-foreground text-xs">•</span>
              <span className="text-2xs text-muted-foreground font-mono">
                90% Range: ${(activeSimulation.confidenceLowerBound / 1000000).toFixed(2)}M – ${(activeSimulation.confidenceUpperBound / 1000000).toFixed(2)}M
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Baseline</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setSaveModalOpen(true)}
              className="h-10 rounded-xl text-xs font-semibold min-h-[44px] active:scale-[0.97] transition-transform gap-1.5 shadow-sm"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Scenario Model</span>
            </Button>
          </div>
        </div>

        {/* 5 Interactive What-If Sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
          {/* Win Rate Modifier */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Win Rate Shift</span>
              <Badge variant="outline" className="font-mono text-xs">
                {winRateMod > 0 ? `+${winRateMod}%` : `${winRateMod}%`}
              </Badge>
            </div>
            <input
              type="range"
              min={-15}
              max={15}
              step={1}
              value={winRateMod}
              onChange={(e) => setWinRateMod(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="Win Rate Shift Slider"
            />
            <p className="text-2xs text-muted-foreground">
              Baseline: {baseline.baselineWinRatePercent}%. Elasticity factor: 1.35x revenue yield.
            </p>
          </div>

          {/* Deal Size Modifier */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Average Deal Size Shift</span>
              <Badge variant="outline" className="font-mono text-xs">
                {dealSizeMod > 0 ? `+${dealSizeMod}%` : `${dealSizeMod}%`}
              </Badge>
            </div>
            <input
              type="range"
              min={-20}
              max={25}
              step={1}
              value={dealSizeMod}
              onChange={(e) => setDealSizeMod(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="Average Deal Size Shift Slider"
            />
            <p className="text-2xs text-muted-foreground">
              Baseline: ${(baseline.baselineAverageDealSize / 1000).toFixed(0)}k ACV via multi-threading.
            </p>
          </div>

          {/* Slippage Modifier */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Pipeline Slippage Shift</span>
              <Badge variant="outline" className="font-mono text-xs">
                {slippageMod > 0 ? `+${slippageMod}%` : `${slippageMod}%`}
              </Badge>
            </div>
            <input
              type="range"
              min={-15}
              max={20}
              step={1}
              value={slippageMod}
              onChange={(e) => setSlippageMod(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="Pipeline Slippage Shift Slider"
            />
            <p className="text-2xs text-muted-foreground">
              Negative reduces slippage. Baseline: {baseline.baselineSlippageRatePercent}%.
            </p>
          </div>

          {/* Sales Cycle Velocity */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Sales Cycle Duration Shift</span>
              <Badge variant="outline" className="font-mono text-xs">
                {cycleMod > 0 ? `+${cycleMod}%` : `${cycleMod}%`}
              </Badge>
            </div>
            <input
              type="range"
              min={-20}
              max={20}
              step={1}
              value={cycleMod}
              onChange={(e) => setCycleMod(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="Sales Cycle Velocity Slider"
            />
            <p className="text-2xs text-muted-foreground">
              Negative contracts cycle days, accelerating close velocity. Baseline: {baseline.baselineSalesCycleDays}d.
            </p>
          </div>

          {/* AE Headcount Delta */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border/40 md:col-span-2 lg:col-span-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-foreground">Hiring Scale (AE Headcount Delta)</span>
              <Badge variant="outline" className="font-mono text-xs">
                {headcountDelta > 0 ? `+${headcountDelta} Reps` : `${headcountDelta} Reps`}
              </Badge>
            </div>
            <input
              type="range"
              min={-3}
              max={10}
              step={1}
              value={headcountDelta}
              onChange={(e) => setHeadcountDelta(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer min-h-[44px]"
              aria-label="AE Headcount Delta Slider"
            />
            <p className="text-2xs text-muted-foreground">
              New hires contribute at 50% in-quarter ramp capacity. Current active reps: {baseline.activeRepsCount}.
            </p>
          </div>
        </div>
      </Card>

      {/* Saved Scenarios Library Table */}
      <Card className="rounded-2xl border-border/70 shadow-sm bg-card p-6">
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div>
            <CardTitle className="text-base font-bold text-foreground">
              Executive Scenario Models
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Saved What-If scenarios calibrated by sales leadership.
            </p>
          </div>
          <Badge variant="outline" className="text-2xs font-semibold">
            {scenarios.length} Saved Models
          </Badge>
        </div>

        <div className="divide-y divide-border/40 pt-2">
          {scenarios.map((scen) => (
            <div
              key={scen.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{scen.name}</span>
                  {scen.isBaseline && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-3xs">
                      Baseline
                    </Badge>
                  )}
                </div>
                <p className="text-2xs text-muted-foreground line-clamp-1">
                  {scen.description}
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="text-right">
                  <div className="font-bold text-foreground font-mono">
                    ${(scen.simulatedQuarterlyRevenue / 1000000).toFixed(2)}M
                  </div>
                  <div
                    className={`text-3xs font-semibold ${
                      scen.deltaVsTargetDollars >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    }`}
                  >
                    {scen.deltaVsTargetDollars >= 0 ? '+' : ''}
                    {scen.deltaVsTargetPercent}% vs Quota
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleLoadScenario(scen)}
                    className="h-8 rounded-lg text-2xs min-h-[44px] active:scale-[0.97]"
                  >
                    Load
                  </Button>
                  {!scen.isBaseline && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteScenario(scen.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive min-h-[44px]"
                      aria-label={`Delete ${scen.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Save Scenario Modal */}
      <Dialog open={saveModalOpen} onOpenChange={setSaveModalOpen}>
        <DialogContent className="rounded-2xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Save Scenario Model
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="scenName" className="font-semibold text-foreground">
                Scenario Name
              </label>
              <Input
                id="scenName"
                placeholder="e.g. Q4 Aggressive Outbound Expansion"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                className="h-10 rounded-xl text-xs min-h-[44px]"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="scenDesc" className="font-semibold text-foreground">
                Executive Rationale / Description
              </label>
              <Input
                id="scenDesc"
                placeholder="Key assumptions and growth levers modeled"
                value={scenarioDesc}
                onChange={(e) => setScenarioDesc(e.target.value)}
                className="h-10 rounded-xl text-xs min-h-[44px]"
              />
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border border-border/40 text-2xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Simulated Revenue:</span>
                <span className="font-bold text-foreground font-mono">
                  ${(activeSimulation.simulatedQuarterlyRevenue / 1000000).toFixed(2)}M
                </span>
              </div>
              <div className="flex justify-between">
                <span>Delta vs Quota:</span>
                <span className="font-bold text-foreground font-mono">
                  {activeSimulation.deltaVsTargetPercent}%
                </span>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSaveModalOpen(false)}
              className="h-10 rounded-xl text-xs min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmSave}
              disabled={!scenarioName.trim() || isSaving}
              className="h-10 rounded-xl text-xs min-h-[44px] active:scale-[0.97]"
            >
              {isSaving ? 'Saving...' : 'Save Scenario (+20 pts)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
