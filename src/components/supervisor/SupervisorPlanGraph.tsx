'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Execution Plan Graph
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Visual Execution Progress:
 *    - Renders an animated step-by-step DAG timeline of decomposed plan steps.
 * 2. Mobile Accessibility:
 *    - Min interactive touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Smooth pulse on active steps and tactile clicks (`active:scale-[0.97]`).
 * 4. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  ShieldAlert,
  Loader2,
  Wrench,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { SupervisorPlanStep } from '@/lib/supervisor/types';

export interface SupervisorPlanGraphProps {
  steps: SupervisorPlanStep[];
  onSelectStep: (step: SupervisorPlanStep) => void;
  selectedStepNumber?: number;
}

export function SupervisorPlanGraph({
  steps,
  onSelectStep,
  selectedStepNumber,
}: SupervisorPlanGraphProps) {
  if (!steps || steps.length === 0) {
    return (
      <div className="bg-slate-50 border border-dashed border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
        No execution plan steps synthesized yet.
      </div>
    );
  }

  const completedCount = steps.filter((s) => s.status === 'completed').length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="space-y-3">
      {/* Progress Bar Header */}
      <div className="flex items-center justify-between text-xs text-slate-600 px-1">
        <span className="font-semibold flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Execution Progress: {completedCount} of {steps.length} Steps
        </span>
        <span className="font-mono text-slate-500">{progressPercent}%</span>
      </div>

      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          className="bg-indigo-600 h-2 transition-all duration-500 rounded-full"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Step Timeline Cards */}
      <div className="space-y-2.5 pt-1">
        {steps.map((step, _idx) => {
          const isSelected = selectedStepNumber === step.stepNumber;
          const isRunning = step.status === 'running';
          const isApproval = step.status === 'needs_approval';
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';

          return (
            <button
              key={step.stepNumber}
              type="button"
              onClick={() => onSelectStep(step)}
              className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all duration-200 min-h-[56px] flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:scale-[0.98] ${
                isSelected
                  ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500/30'
                  : isRunning
                  ? 'border-blue-300 bg-blue-50/40 shadow-sm animate-pulse'
                  : isApproval
                  ? 'border-amber-300 bg-amber-50/60 shadow-sm'
                  : isFailed
                  ? 'border-rose-200 bg-rose-50/50'
                  : isCompleted
                  ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/40'
                  : 'border-slate-200 bg-slate-50/30 opacity-75'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Step Number Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 ${
                    isCompleted
                      ? 'bg-emerald-600 text-white'
                      : isRunning
                      ? 'bg-blue-600 text-white'
                      : isApproval
                      ? 'bg-amber-600 text-white'
                      : isFailed
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : isRunning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isApproval ? (
                    <ShieldAlert className="w-4 h-4" />
                  ) : isFailed ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    step.stepNumber
                  )}
                </div>

                {/* Title & Intent */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 leading-tight">
                      {step.title}
                    </span>
                    <Badge
                      variant="outline"
                      className="font-mono text-[10px] bg-white border-slate-200 text-slate-700 flex items-center gap-1"
                    >
                      <Wrench className="w-2.5 h-2.5 text-indigo-500" />
                      {step.assignedAgentOrTool}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed line-clamp-2">
                    {step.intent}
                  </p>
                </div>
              </div>

              {/* Status & Latency Badge */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                {step.durationMs !== undefined && (
                  <span className="text-[11px] font-mono text-slate-400 flex items-center gap-0.5">
                    <Clock className="w-3 h-3" />
                    {step.durationMs}ms
                  </span>
                )}

                <Badge
                  variant="outline"
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    isCompleted
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : isRunning
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : isApproval
                      ? 'border-amber-300 bg-amber-100 text-amber-900'
                      : isFailed
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-slate-200 bg-slate-50 text-slate-500'
                  }`}
                >
                  {step.status.replace('_', ' ')}
                </Badge>

                <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
