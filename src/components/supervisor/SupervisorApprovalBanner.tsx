'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Human Approval Interception Banner
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Human-in-the-Loop Interception:
 *    - Prominently rendered whenever a mission step halts at `-32003 (APPROVAL_REQUIRED)`.
 * 2. Mobile Accessibility:
 *    - Interactive touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]`.
 * 4. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Loader2,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import type { SupervisorPlanStep } from '@/lib/supervisor/types';

export interface SupervisorApprovalBannerProps {
  pausedStep: SupervisorPlanStep | null;
  pendingApprovalId?: string;
  onApprove: () => Promise<void>;
  onCancel: () => Promise<void>;
  isAdjudicating: boolean;
}

export function SupervisorApprovalBanner({
  pausedStep,
  pendingApprovalId,
  onApprove,
  onCancel,
  isAdjudicating,
}: SupervisorApprovalBannerProps) {
  if (!pausedStep) return null;

  return (
    <Card className="border-amber-300 bg-amber-50/80 shadow-md p-4 sm:p-5 rounded-xl space-y-3.5 animate-in fade-in-50 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-amber-950">
                Action Requires Human Sign-Off (Step {pausedStep.stepNumber})
              </span>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 text-xs font-mono">
                <Wrench className="w-3 h-3 mr-1 text-amber-700" />
                {pausedStep.assignedAgentOrTool}
              </Badge>
            </div>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              {pausedStep.error || 'This tool carries commercial risk or workspace policy gating and requires human administrator confirmation before executing.'}
            </p>
          </div>
        </div>
      </div>

      {/* Planned Action Arguments Preview */}
      <div className="p-3 bg-white/90 border border-amber-200 rounded-lg text-xs space-y-1 text-amber-950">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800 block">
          Queued Arguments for Review:
        </span>
        <pre className="font-mono text-[11px] overflow-x-auto max-h-24 p-2 bg-amber-50/60 rounded border border-amber-100">
          {JSON.stringify(pausedStep.arguments, null, 2)}
        </pre>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isAdjudicating}
          className="min-h-[44px] text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 active:scale-[0.97] transition-all"
        >
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          Cancel Mission
        </Button>

        <Button
          type="button"
          onClick={onApprove}
          disabled={isAdjudicating}
          className="min-h-[44px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] transition-all shadow-sm gap-1.5"
        >
          {isAdjudicating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Resuming Mission...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve & Resume Mission</span>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
