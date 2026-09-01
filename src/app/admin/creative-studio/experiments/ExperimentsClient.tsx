'use client';

/**
 * ARCHITECTURE:
 * Creative Experiments & Analytics Client (Phase 9 - A/B Testing)
 * 
 * Renders live visual experiments, side-by-side variant performance metrics,
 * statistical confidence scores, and one-click winning variant promotion.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { CreativeExperiment } from '@/lib/creative/creative-types';
import { calculateStatisticalSignificance } from '@/lib/creative/creative-experiments-engine';
import { promoteWinningVariantAction } from '@/app/actions/creative-experiment-actions';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  FlaskConical,
  ArrowLeft,
  Trophy,
  TrendingUp,
  Split,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExperimentsClientProps {
  initialExperiments: CreativeExperiment[];
}

export function ExperimentsClient({
  initialExperiments,
}: ExperimentsClientProps) {
  const { toast } = useToast();
  const [experiments, setExperiments] = useState<CreativeExperiment[]>(initialExperiments);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const handlePromoteWinner = (experimentId: string, winnerVariantId: string) => {
    setPromotingId(experimentId);
    startTransition(async () => {
      const res = await promoteWinningVariantAction(experimentId, winnerVariantId);
      setPromotingId(null);

      if (res.success) {
        setExperiments((prev) =>
          prev.map((exp) =>
            exp.id === experimentId
              ? { ...exp, status: 'concluded', winningVariantId: winnerVariantId }
              : exp
          )
        );
        toast({
          title: 'Winner Promoted',
          description: 'Winning variant layout is now active in production.',
        });
      } else {
        toast({
          title: 'Promotion Failed',
          description: res.error || 'Could not promote winner.',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-850 pb-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/creative-studio/projects"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="p-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FlaskConical className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-black text-white">Experiments & Creative Analytics</h1>
          </div>
          <p className="text-xs md:text-sm text-slate-400 max-w-2xl">
            Scientifically optimize CTR and conversion performance across visual variants with two-proportion z-tests.
          </p>
        </div>
      </div>

      {experiments.length === 0 ? (
        <div className="p-12 text-center rounded-3xl border border-slate-850 bg-slate-900/20 space-y-3">
          <div className="text-sm font-bold text-slate-300">No experiments running yet</div>
          <p className="text-xs text-slate-500">
            Open any visual canvas in the editor and click &quot;A/B Test&quot; in the top bar to launch a multi-variant test.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {experiments.map((exp) => {
            const control = exp.variants.find((v) => v.isControl) || exp.variants[0];
            const test = exp.variants.find((v) => !v.isControl) || exp.variants[1];
            const stats = control && test ? calculateStatisticalSignificance(control, test, 100, 95) : null;

            return (
              <div
                key={exp.id}
                className="p-6 rounded-3xl border border-slate-850 bg-slate-900/60 shadow-xl space-y-6"
              >
                {/* Top Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-base text-white">{exp.name}</span>
                      <span
                        className={cn(
                          'px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] tracking-wider',
                          exp.status === 'running'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        )}
                      >
                        {exp.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 italic">
                      &quot;{exp.hypothesis}&quot;
                    </p>
                  </div>

                  {stats && stats.isSignificant && exp.status === 'running' && stats.winningVariantId && (
                    <Button
                      onClick={() => handlePromoteWinner(exp.id, stats.winningVariantId!)}
                      disabled={promotingId === exp.id}
                      className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs h-9 px-4 rounded-xl shadow-lg active:scale-[0.97]"
                    >
                      {promotingId === exp.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Trophy className="w-3.5 h-3.5 mr-1.5" />
                      )}
                      Promote Winner to Publishing
                    </Button>
                  )}
                </div>

                {/* Variants Comparison Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {exp.variants.map((v) => {
                    const isWinning = exp.winningVariantId === v.id || v.isWinner;

                    return (
                      <div
                        key={v.id}
                        className={cn(
                          'p-5 rounded-2xl border transition-all space-y-4',
                          isWinning
                            ? 'bg-emerald-950/20 border-emerald-500/40 shadow-lg shadow-emerald-500/5'
                            : 'bg-slate-950/60 border-slate-800'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{v.name}</span>
                            {v.isControl && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                                Control
                              </span>
                            )}
                          </div>

                          {isWinning && (
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 flex items-center gap-1">
                              <Trophy className="w-3 h-3" /> Winner
                            </span>
                          )}
                        </div>

                        {/* Metric Tiles */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-850">
                            <div className="text-[10px] text-slate-400 font-medium">Impressions</div>
                            <div className="text-xs font-black text-white font-mono mt-0.5">
                              {v.impressions.toLocaleString()}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-850">
                            <div className="text-[10px] text-slate-400 font-medium">Clicks</div>
                            <div className="text-xs font-black text-white font-mono mt-0.5">
                              {v.clicks.toLocaleString()}
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-850">
                            <div className="text-[10px] text-slate-400 font-medium">CTR</div>
                            <div className="text-xs font-black text-emerald-400 font-mono mt-0.5">
                              {v.ctr}%
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-850">
                            <div className="text-[10px] text-slate-400 font-medium">Conv Rate</div>
                            <div className="text-xs font-black text-blue-400 font-mono mt-0.5">
                              {v.conversionRate}%
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Statistical Confidence Footer */}
                {stats && (
                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      {stats.isSignificant ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-slate-300 font-medium">{stats.recommendation}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {stats.liftPercentage !== 0 && (
                        <div className="flex items-center gap-1 font-bold text-emerald-400">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>+{stats.liftPercentage}% Lift</span>
                        </div>
                      )}
                      <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
                        <Split className="w-3.5 h-3.5 text-blue-400" />
                        <span>Confidence: {stats.confidenceLevel}% (p={stats.pValue})</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
