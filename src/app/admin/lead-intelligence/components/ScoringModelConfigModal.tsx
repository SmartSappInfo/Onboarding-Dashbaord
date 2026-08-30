'use client';

/**
 * Scoring Model Configuration & Weight Fine-Tuner Modal (Lead Intelligence 2.0 - Phase 8)
 * UI Spec Section 36: "Score Configuration UX & What-If Simulator"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Proportional auto-balancing algorithm guarantees total weight = 100%.
 * 2. 1-Click "Test Model" trigger opening the What-If simulation sandbox.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Sliders, 
  Sparkles, 
  RotateCcw, 
  ShieldCheck, 
  Flame, 
  AlertCircle, 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  Loader2 
} from 'lucide-react';
import type { 
  ScoringDimensionWeightConfig, 
  ScoringModelConfig, 
  ScoringSimulationResult 
} from '@/lib/lead-intelligence/types';
import { ExplainableScoringEngine } from '@/lib/lead-intelligence/scoring';
import { 
  getWorkspaceScoringModelAction, 
  saveWorkspaceScoringModelAction, 
  simulateScoringModelAction 
} from '@/app/actions/lead-intelligence-actions';
import { ScoringSimulationSandboxModal } from './ScoringSimulationSandboxModal';
import { useToast } from '@/hooks/use-toast';

interface ScoringModelConfigModalProps {
  workspaceId: string;
  organizationId: string;
  isOpen: boolean;
  onClose: () => void;
  onModelSaved?: (model: ScoringModelConfig) => void;
}

export const ScoringModelConfigModal: React.FC<ScoringModelConfigModalProps> = ({
  workspaceId,
  organizationId,
  isOpen,
  onClose,
  onModelSaved
}) => {
  const { toast } = useToast();
  const [weights, setWeights] = useState<ScoringDimensionWeightConfig>(ExplainableScoringEngine.getDefaultWeights());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  // Simulation Sandbox State
  const [isSandboxOpen, setIsSandboxOpen] = useState(false);
  const [simulationResults, setSimulationResults] = useState<ScoringSimulationResult[]>([]);
  const [simMetrics, setSimMetrics] = useState({
    gainersCount: 0,
    droppersCount: 0,
    unchangedCount: 0,
    newCriticalCount: 0
  });

  useEffect(() => {
    if (!workspaceId || !isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    getWorkspaceScoringModelAction(workspaceId)
      .then((res) => {
        if (isMounted && res.success && res.model) {
          setWeights(res.model.weights);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [workspaceId, isOpen]);

  const handleSliderChange = (key: keyof ScoringDimensionWeightConfig, val: number) => {
    const normalized = ExplainableScoringEngine.normalizeWeights(weights, key, val);
    setWeights(normalized);
  };

  const handleResetDefaults = () => {
    setWeights(ExplainableScoringEngine.getDefaultWeights());
    toast({ title: 'Reset to Defaults', description: 'Restored standard 30/25/20/15/10 weight model.' });
  };

  const handleSimulate = async () => {
    setIsSimulating(true);
    try {
      const res = await simulateScoringModelAction(workspaceId, weights);
      if (res.success) {
        setSimulationResults(res.results);
        setSimMetrics({
          gainersCount: res.gainersCount,
          droppersCount: res.droppersCount,
          unchangedCount: res.unchangedCount,
          newCriticalCount: res.newCriticalCount
        });
        setIsSandboxOpen(true);
      } else {
        toast({
          variant: 'destructive',
          title: 'Simulation Failed',
          description: res.error || 'Failed to simulate weights.'
        });
      }
    } finally {
      setIsSimulating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await saveWorkspaceScoringModelAction(workspaceId, organizationId, weights);
      if (res.success && res.model) {
        toast({ title: 'Scoring Model Saved ✓', description: 'Custom dimension weights saved to workspace.' });
        if (onModelSaved) onModelSaved(res.model);
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save scoring model.'
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const totalWeight = weights.icpFitWeight + weights.intentWeight + weights.needWeight + weights.engagementWeight + weights.similarityWeight;

  return (
    <>
      <Dialog open={isOpen && !isSandboxOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10001] flex flex-col">
          {/* Header */}
          <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-primary" />
                  <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                    Custom Scoring Model & Weights
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                  Fine-tune dimension multipliers to match your organization's sales priorities.
                </DialogDescription>
              </div>

              <Badge 
                className={totalWeight === 100 ? "bg-emerald-500/20 text-emerald-600 border-emerald-500/40 text-xs font-bold font-mono" : "bg-rose-500/20 text-rose-600"}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                <span>Total: {totalWeight}%</span>
              </Badge>
            </div>
          </DialogHeader>

          {/* Sliders Body */}
          <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center space-y-2">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-xs text-muted-foreground">Loading scoring model...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. ICP Fit Slider */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-sky-500" /> ICP Fit Weight
                    </span>
                    <span className="text-xs font-extrabold text-sky-600 dark:text-sky-400 font-mono">
                      {weights.icpFitWeight}%
                    </span>
                  </div>
                  <Slider
                    value={[weights.icpFitWeight]}
                    min={5}
                    max={60}
                    step={1}
                    onValueChange={(vals) => handleSliderChange('icpFitWeight', vals[0])}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Rewards scale, online rating, registered physical location, and custom domain presence.
                  </p>
                </div>

                {/* 2. Intent Signals Slider */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-rose-500" /> Intent Signals Weight
                    </span>
                    <span className="text-xs font-extrabold text-rose-600 dark:text-rose-400 font-mono">
                      {weights.intentWeight}%
                    </span>
                  </div>
                  <Slider
                    value={[weights.intentWeight]}
                    min={5}
                    max={60}
                    step={1}
                    onValueChange={(vals) => handleSliderChange('intentWeight', vals[0])}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Rewards active infrastructure deltas, gateway changes, and admissions portal deployments.
                  </p>
                </div>

                {/* 3. Need Gaps Slider */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <AlertCircle className="h-4 w-4 text-amber-500" /> Need Gaps Weight
                    </span>
                    <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                      {weights.needWeight}%
                    </span>
                  </div>
                  <Slider
                    value={[weights.needWeight]}
                    min={5}
                    max={60}
                    step={1}
                    onValueChange={(vals) => handleSliderChange('needWeight', vals[0])}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Rewards detected payment gaps (missing fee checkout) and missing parent/student portals.
                  </p>
                </div>

                {/* 4. Contacts & Engagement Slider */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-emerald-500" /> Decision Makers Weight
                    </span>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
                      {weights.engagementWeight}%
                    </span>
                  </div>
                  <Slider
                    value={[weights.engagementWeight]}
                    min={5}
                    max={60}
                    step={1}
                    onValueChange={(vals) => handleSliderChange('engagementWeight', vals[0])}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Rewards verified leadership contacts (Headmaster, Principal, Bursar) and deliverable emails.
                  </p>
                </div>

                {/* 5. Customer Similarity Slider */}
                <div className="p-3.5 rounded-xl border border-border/70 bg-muted/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4 text-purple-500" /> Similarity Weight
                    </span>
                    <span className="text-xs font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                      {weights.similarityWeight}%
                    </span>
                  </div>
                  <Slider
                    value={[weights.similarityWeight]}
                    min={5}
                    max={60}
                    step={1}
                    onValueChange={(vals) => handleSliderChange('similarityWeight', vals[0])}
                    className="py-1"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Rewards accounts matching high-converting private school customer profiles.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDefaults}
              className="h-9 px-3 text-xs font-semibold rounded-xl flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Defaults</span>
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSimulate}
                disabled={isSimulating || isLoading}
                className="h-9 px-3 text-xs font-bold rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
              >
                {isSimulating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Simulating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    <span>Test Model / Simulate</span>
                  </>
                )}
              </Button>

              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading || totalWeight !== 100}
                className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl active:scale-[0.97]"
              >
                {isSaving ? 'Saving...' : 'Save Weights'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Simulation Sandbox Modal */}
      <ScoringSimulationSandboxModal
        workspaceId={workspaceId}
        isOpen={isSandboxOpen}
        onClose={() => setIsSandboxOpen(false)}
        weights={weights}
        simulationResults={simulationResults}
        gainersCount={simMetrics.gainersCount}
        droppersCount={simMetrics.droppersCount}
        unchangedCount={simMetrics.unchangedCount}
        newCriticalCount={simMetrics.newCriticalCount}
        onModelPublished={() => {
          setIsSandboxOpen(false);
          onClose();
        }}
      />
    </>
  );
};
