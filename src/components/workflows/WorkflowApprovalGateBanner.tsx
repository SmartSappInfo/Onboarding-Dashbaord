'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Workflow Human Approval Gate Banner
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Human-in-the-Loop Interception:
 *    - Prominently displays paused workflow runs waiting for administrator sign-off.
 * 2. Mobile Accessibility:
 *    - Interactive touch targets >= 44px (`min-h-[44px]`).
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]` and smooth state transitions.
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
  Clock,
} from 'lucide-react';
import type { WorkflowRun, WorkflowStepResult } from '@/lib/workflows/types';

export interface WorkflowApprovalGateBannerProps {
  run: WorkflowRun;
  onAdjudicate: (runId: string, approvalId: string, adjudication: 'approved' | 'rejected') => Promise<void>;
  isAdjudicating: boolean;
}

export function WorkflowApprovalGateBanner({
  run,
  onAdjudicate,
  isAdjudicating,
}: WorkflowApprovalGateBannerProps) {
  if (run.status !== 'waiting_approval' || !run.pendingApprovalId || !run.pausedNodeId) {
    return null;
  }

  const pausedStep = run.stepResults[run.pausedNodeId] as WorkflowStepResult | undefined;
  const payloadJson = pausedStep?.outputPayload
    ? JSON.stringify(pausedStep.outputPayload, null, 2)
    : '{}';

  return (
    <Card className="border-amber-300 bg-amber-50/90 shadow-md p-4 sm:p-5 rounded-xl space-y-3.5 animate-in fade-in-50 duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-amber-950">
                Autonomous Workflow Paused: Human Sign-Off Required
              </span>
              <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-900 text-xs font-mono">
                Node ID: {run.pausedNodeId}
              </Badge>
            </div>
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              This workflow has encountered an intentional policy approval gate. Commercial mutations and customer-facing updates require operational sign-off before proceeding.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-md self-start sm:self-auto shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>Paused at {new Date(pausedStep?.timestamp || run.startedAt).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Upstream Payload & Arguments Context */}
      <div className="p-3 bg-white/95 border border-amber-200 rounded-lg text-xs space-y-1.5 text-amber-950">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
            Pending Node Output / Context Carried:
          </span>
          <span className="text-[10px] font-mono text-amber-700">Approval ID: {run.pendingApprovalId}</span>
        </div>
        <pre className="font-mono text-[11px] overflow-x-auto max-h-32 p-2 bg-amber-50/60 rounded border border-amber-100 text-slate-800 leading-relaxed">
          {payloadJson}
        </pre>
      </div>

      {/* Decision Buttons */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => onAdjudicate(run.id, run.pendingApprovalId!, 'rejected')}
          disabled={isAdjudicating}
          className="min-h-[44px] text-xs font-semibold text-rose-700 border-rose-200 hover:bg-rose-50 active:scale-[0.97] transition-all"
        >
          <XCircle className="w-3.5 h-3.5 mr-1.5" />
          Reject & Terminate
        </Button>

        <Button
          type="button"
          onClick={() => onAdjudicate(run.id, run.pendingApprovalId!, 'approved')}
          disabled={isAdjudicating}
          className="min-h-[44px] text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white active:scale-[0.97] transition-all shadow-sm gap-1.5"
        >
          {isAdjudicating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Resuming Pipeline...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Approve & Continue Pipeline</span>
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
