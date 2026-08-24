'use client';

/**
 * @file src/components/page-builder/DiagnosticsDrawer.tsx
 * @description Slide-Over Diagnostics & AI Recommendation Drawer for SmartSapp Page Builder.
 * Renders severity-coded cards (Critical, Warning, Info) with 1-click **Apply AI Recommendation** buttons.
 * 
 * ARCHITECTURAL RULE COMPLIANCE:
 * - Zero `any` or `any[]` types.
 * - Mobile Touch Target Optimization (`min-h-[44px]`).
 * - Accessible focus outlines and visual active states.
 */

import React from 'react';
import type { AIInsight } from '@/lib/types';
import { AlertCircle, AlertTriangle, Info, Sparkles, X, CheckCircle2 } from 'lucide-react';

export interface DiagnosticsDrawerProps {
  insights: AIInsight[];
  isOpen: boolean;
  onClose: () => void;
  onApplyRecommendation: (insight: AIInsight) => void;
  onDismissInsight: (insightId: string) => void;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  insights,
  isOpen,
  onClose,
  onApplyRecommendation,
  onDismissInsight,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-background border-l border-border shadow-2xl flex flex-col transition-all">
      {/* Drawer Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-semibold text-sm text-foreground">AI Optimization Copilot</h3>
            <p className="text-[11px] text-muted-foreground">
              {insights.length} active diagnostic recommendations
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[44px] min-w-[44px] rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Close Diagnostics Drawer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Insights List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {insights.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
            <p className="font-medium text-xs">No active diagnostic issues found.</p>
            <p className="text-[11px]">Your landing page layout and copy are optimized!</p>
          </div>
        ) : (
          insights.map((insight) => (
            <div
              key={insight.id}
              className={`p-3.5 rounded-2xl border transition-all ${
                insight.severity === 'critical'
                  ? 'bg-rose-500/5 border-rose-500/30'
                  : insight.severity === 'warning'
                  ? 'bg-amber-500/5 border-amber-500/30'
                  : 'bg-blue-500/5 border-blue-500/30'
              }`}
            >
              {/* Severity & Title */}
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex items-center gap-2">
                  {insight.severity === 'critical' ? (
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  ) : insight.severity === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  ) : (
                    <Info className="w-4 h-4 text-blue-500 shrink-0" />
                  )}
                  <h4 className="font-semibold text-xs text-foreground">{insight.title}</h4>
                </div>
                <span
                  className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${
                    insight.severity === 'critical'
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : insight.severity === 'warning'
                      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                  }`}
                >
                  {insight.severity}
                </span>
              </div>

              {/* Description */}
              <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                {insight.description}
              </p>

              {/* Action Bar */}
              <div className="flex items-center gap-2">
                {insight.suggestedAction && (
                  <button
                    type="button"
                    onClick={() => onApplyRecommendation(insight)}
                    className="min-h-[44px] flex-1 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.97] transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary shadow-sm"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Apply AI Fix
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDismissInsight(insight.id)}
                  className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.97] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Dismiss
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
