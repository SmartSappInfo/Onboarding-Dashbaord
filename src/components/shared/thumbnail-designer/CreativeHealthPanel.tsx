'use client';

/**
 * ARCHITECTURE:
 * Creative Health Intelligence Panel (Phase 4 - Creative Intelligence)
 * 
 * Provides comprehensive multi-vector diagnostic breakdown across 7 dimensions,
 * individual auto-fix triggers, batch "Improve All" execution, and heatmap toggles.
 * 
 * CAUTION:
 * Touch targets must be >= 36px (>= 44px on mobile).
 * Strict typing (0% any).
 */

import * as React from 'react';
import type {
  CreativeHealthReport,
  CreativeHealthIssue,
} from '@/lib/creative/creative-types';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Zap,
  Eye,
  Wand2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreativeHealthPanelProps {
  report: CreativeHealthReport;
  brandKit?: BrandKit | null;
  heatmapVisible: boolean;
  onToggleHeatmap: () => void;
  onApplyFix: (issue: CreativeHealthIssue) => void;
  onImproveAll: () => void;
}

export function CreativeHealthPanel({
  report,
  heatmapVisible,
  onToggleHeatmap,
  onApplyFix,
  onImproveAll,
}: CreativeHealthPanelProps) {
  const { overallScore, vectors, issues } = report;

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400';
    if (score >= 75) return 'text-amber-400';
    return 'text-rose-400';
  };

  const getProgressColor = (score: number) => {
    if (score >= 90) return 'bg-emerald-500';
    if (score >= 75) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const fixableIssues = issues.filter((i) => Boolean(i.fixActionType));

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Score Summary Card */}
      <div className="p-4 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span>CREATIVE HEALTH</span>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-slate-950 border border-slate-800">
            {report.status.toUpperCase()}
          </span>
        </div>

        <div className="py-1">
          <div className={cn('text-5xl font-black font-mono tracking-tight', getScoreColor(overallScore))}>
            {overallScore}
            <span className="text-sm font-semibold text-slate-500">/100</span>
          </div>
          <div className="text-xs font-semibold text-slate-300 mt-1">
            {overallScore >= 90
              ? 'Excellent visual hierarchy & CTR potential'
              : overallScore >= 75
              ? 'Good composition — needs optimization'
              : 'Low conversion health — critical issues detected'}
          </div>
        </div>

        {/* Action Controls in Top Card */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            onClick={onToggleHeatmap}
            variant="outline"
            size="sm"
            className={cn(
              'h-8 text-xs font-bold rounded-xl border-slate-800',
              heatmapVisible ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-slate-950 text-slate-300'
            )}
          >
            <Eye className="w-3.5 h-3.5 mr-1" />
            {heatmapVisible ? 'Hide Heatmap' : 'Show Heatmap'}
          </Button>

          {fixableIssues.length > 0 && (
            <Button
              onClick={onImproveAll}
              size="sm"
              className="h-8 text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 text-slate-950 rounded-xl active:scale-[0.97]"
            >
              <Zap className="w-3.5 h-3.5 mr-1" /> Improve All
            </Button>
          )}
        </div>
      </div>

      {/* 7 Health Vectors Progress Bars */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          Dimension Breakdown
        </div>
        <div className="space-y-2">
          {vectors.map((vec) => (
            <div key={vec.name} className="p-2.5 rounded-2xl bg-slate-900/40 border border-slate-850 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-300">{vec.name}</span>
                <span className={cn('font-mono', getScoreColor(vec.score))}>{vec.score}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                <div
                  style={{ width: `${vec.score}%` }}
                  className={cn('h-full transition-all duration-500', getProgressColor(vec.score))}
                />
              </div>
              <div className="text-[10px] text-slate-500">{vec.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Issue Diagnostic List */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
          <span>Diagnostic Insights</span>
          <span>{issues.length} {issues.length === 1 ? 'item' : 'items'}</span>
        </div>

        {issues.length === 0 ? (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>All safe-zone, contrast, and hierarchy benchmarks satisfied.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {issues.map((issue) => {
              const isCritical = issue.severity === 'critical';
              return (
                <div
                  key={issue.id}
                  className={cn(
                    'p-3.5 rounded-2xl border text-xs space-y-2 transition-all',
                    isCritical
                      ? 'bg-rose-950/20 border-rose-500/40 text-rose-200'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold">
                      {isCritical ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      )}
                      <span className="text-white">{issue.title}</span>
                    </div>
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded text-[9px] font-black uppercase font-mono',
                        isCritical ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      )}
                    >
                      {issue.severity}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">{issue.message}</p>

                  {issue.fixActionType && (
                    <div className="pt-1 flex justify-end">
                      <Button
                        onClick={() => onApplyFix(issue)}
                        size="sm"
                        className="h-7 px-3 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 active:scale-[0.97] text-slate-950 rounded-lg"
                      >
                        <Wand2 className="w-3 h-3 mr-1" /> {issue.fixActionLabel || 'Apply Fix'}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
