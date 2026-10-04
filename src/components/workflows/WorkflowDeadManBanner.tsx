'use client';

/**
 * @fileOverview Workflow Emergency Dead-Man Switch Banner (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 60: Emergency dead-man kill switch visual alert for workflow orchestration.
 * - Tactile feedback: `active:scale-[0.97]`
 * - Clear operator guidance and fail-closed state indicator.
 * - Adheres strictly to theme.md token binding.
 */

import * as React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface WorkflowDeadManBannerProps {
  active: boolean;
  onRefresh?: () => void;
}

export function WorkflowDeadManBanner({ active, onRefresh }: WorkflowDeadManBannerProps) {
  if (!active) return null;

  return (
    <div
      role="alert"
      className="p-4 rounded-2xl border-2 border-destructive bg-destructive/10 text-destructive shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-destructive/20 flex items-center justify-center shrink-0 mt-0.5">
          <AlertOctagon className="h-6 w-6 text-destructive animate-pulse" />
        </div>
        <div className="space-y-1">
          <div className="font-bold text-sm sm:text-base flex items-center gap-2">
            <span>EMERGENCY DEAD-MAN PAUSE ACTIVE (Rule 60)</span>
          </div>
          <p className="text-xs sm:text-sm text-destructive/90 leading-relaxed max-w-3xl">
            Autonomous agent workflow dispatch, step execution, and state mutations are globally halted for this tenant. All template instantiations and step dispatches will fail closed until emergency governance is lifted.
          </p>
        </div>
      </div>

      {onRefresh && (
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          className="border-destructive/40 hover:bg-destructive/20 text-destructive rounded-xl active:scale-[0.97] shrink-0 min-h-[44px] sm:min-h-[36px] gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Re-Check Status
        </Button>
      )}
    </div>
  );
}
