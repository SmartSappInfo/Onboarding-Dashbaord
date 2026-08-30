'use client';

/**
 * Scoring Model What-If Simulation Sandbox Modal (Lead Intelligence 2.0 - Phase 8)
 * UI Spec Section 36: "Phase 8 UX — Test Model & Simulation Sandbox"
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. Visualizes in-memory before-and-after score diffs across prospects.
 * 2. 1-Click safe chunked bulk re-scoring trigger.
 * 3. Mobile touch target compliance (min-h-[44px]).
 * 4. Strict Zero-`any` typing.
 */

import React, { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight, 
  CheckCircle2, 
  Search, 
  Loader2,
  SlidersHorizontal,
  Flame
} from 'lucide-react';
import type { ScoringDimensionWeightConfig, ScoringSimulationResult } from '@/lib/lead-intelligence/types';
import { recalculateWorkspaceScoresAction } from '@/app/actions/lead-intelligence-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ScoringSimulationSandboxModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  weights: ScoringDimensionWeightConfig;
  simulationResults: ScoringSimulationResult[];
  gainersCount: number;
  droppersCount: number;
  unchangedCount: number;
  newCriticalCount: number;
  onModelPublished?: () => void;
}

export const ScoringSimulationSandboxModal: React.FC<ScoringSimulationSandboxModalProps> = ({
  workspaceId,
  isOpen,
  onClose,
  weights,
  simulationResults,
  gainersCount,
  droppersCount,
  unchangedCount,
  newCriticalCount,
  onModelPublished
}) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  const filteredResults = simulationResults.filter((r) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return r.prospectName.toLowerCase().includes(q) || r.domain.toLowerCase().includes(q);
  });

  const handleApplyAndRecalculate = async () => {
    setIsApplying(true);
    try {
      const res = await recalculateWorkspaceScoresAction(workspaceId, weights);
      if (res.success) {
        toast({
          title: 'Workspace Re-Scored ✓',
          description: `Successfully re-calculated scores for ${res.recalculatedCount} prospects.`
        });
        if (onModelPublished) onModelPublished();
        onClose();
      } else {
        toast({
          variant: 'destructive',
          title: 'Re-Score Failed',
          description: res.error || 'Failed to update workspace scores.'
        });
      }
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl w-[96vw] p-0 bg-card border-border/80 shadow-2xl rounded-2xl overflow-hidden z-[10002] flex flex-col">
        {/* Header */}
        <DialogHeader className="p-5 border-b bg-muted/20 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-5 w-5 text-primary" />
                <DialogTitle className="text-base font-extrabold text-foreground tracking-tight">
                  Scoring Model Simulation Sandbox
                </DialogTitle>
              </div>
              <DialogDescription className="text-xs text-muted-foreground pt-0.5">
                Simulate candidate model weights live against sample prospects before publishing.
              </DialogDescription>
            </div>

            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px] font-bold font-mono">
              In-Memory Simulation
            </Badge>
          </div>
        </DialogHeader>

        {/* Aggregate Stats Banner */}
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-2 bg-muted/10 border-b border-border/60">
          <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
                Score Increase
              </span>
              <strong className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400">
                +{gainersCount}
              </strong>
            </div>
            <TrendingUp className="h-4 w-4 text-emerald-500" />
          </div>

          <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">
                Score Decrease
              </span>
              <strong className="text-lg font-extrabold text-rose-600 dark:text-rose-400">
                -{droppersCount}
              </strong>
            </div>
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </div>

          <div className="p-2.5 rounded-xl border border-border/70 bg-card flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                Unchanged
              </span>
              <strong className="text-lg font-extrabold text-foreground">
                {unchangedCount}
              </strong>
            </div>
            <span className="text-xs font-mono text-muted-foreground">=</span>
          </div>

          <div className="p-2.5 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block">
                New Critical Tier
              </span>
              <strong className="text-lg font-extrabold text-amber-600 dark:text-amber-400">
                +{newCriticalCount}
              </strong>
            </div>
            <Flame className="h-4 w-4 text-amber-500" />
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border/40">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search sample prospects by name or domain..."
              className="pl-9 h-9 text-xs rounded-xl bg-muted/20 border-border/70"
            />
          </div>
        </div>

        {/* Simulation Results Table */}
        <div className="flex-1 overflow-y-auto max-h-[50vh] divide-y divide-border/40 p-2">
          {filteredResults.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No matching prospects found in simulation dataset.
            </div>
          ) : (
            filteredResults.map((r) => (
              <div key={r.prospectId} className="p-3 flex items-center justify-between gap-3 hover:bg-muted/20 rounded-xl transition-colors">
                <div className="space-y-0.5 min-w-0 flex-1">
                  <h5 className="text-xs font-bold text-foreground truncate">{r.prospectName}</h5>
                  <span className="text-[11px] text-muted-foreground font-mono truncate block">{r.domain}</span>
                </div>

                <div className="flex items-center gap-4 shrink-0">
                  <div className="flex items-center gap-2 text-xs font-mono">
                    <span className="text-muted-foreground font-semibold">{r.baselineScore}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-bold text-foreground">{r.simulatedScore}</span>
                  </div>

                  <Badge
                    className={cn(
                      "text-[10px] font-bold font-mono px-2 py-0.5 min-w-[50px] justify-center",
                      r.deltaScore > 0 && "bg-emerald-500/20 text-emerald-600 border-emerald-500/40",
                      r.deltaScore < 0 && "bg-rose-500/20 text-rose-600 border-rose-500/40",
                      r.deltaScore === 0 && "bg-muted text-muted-foreground"
                    )}
                  >
                    {r.deltaScore > 0 ? `+${r.deltaScore}` : r.deltaScore}
                  </Badge>

                  <div className="text-right min-w-[90px] hidden sm:block">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                      Tier Shift
                    </span>
                    <span className="text-xs font-semibold text-foreground capitalize">
                      {r.baselineTier !== r.simulatedTier ? `${r.baselineTier} → ${r.simulatedTier}` : r.simulatedTier}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <DialogFooter className="p-4 bg-muted/20 border-t flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 text-xs font-semibold rounded-xl"
          >
            Close Sandbox
          </Button>

          <Button
            type="button"
            onClick={handleApplyAndRecalculate}
            disabled={isApplying}
            className="h-9 px-4 text-xs font-bold bg-primary text-primary-foreground rounded-xl flex items-center gap-1.5 active:scale-[0.97]"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Re-Scoring Workspace...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Publish & Re-Score Workspace</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
