'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 7: Supervisor Step Deep Inspector Drawer
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Deep Step Inspection & Explainability:
 *    - Displays exact parameters, outputs, errors, duration, and rationale.
 * 2. Mobile Accessibility:
 *    - Min interactive touch targets >= 44px (`min-h-[44px]`).
 * 3. Strict Zero-`any` & Zero-`unknown` Standard.
 */

import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wrench,
  Clock,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
} from 'lucide-react';
import type { SupervisorPlanStep } from '@/lib/supervisor/types';

export interface SupervisorStepInspectorDrawerProps {
  step: SupervisorPlanStep | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SupervisorStepInspectorDrawer({
  step,
  isOpen,
  onClose,
}: SupervisorStepInspectorDrawerProps) {
  const [copied, setCopied] = React.useState(false);

  if (!step) return null;

  const handleCopyJson = () => {
    const payload = {
      stepNumber: step.stepNumber,
      title: step.title,
      tool: step.assignedAgentOrTool,
      arguments: step.arguments,
      result: step.result,
      error: step.error,
    };
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-4 sm:p-6 space-y-5 font-figtree">
        <SheetHeader className="border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
              {step.stepNumber}
            </span>
            <SheetTitle className="text-base font-bold text-slate-900 leading-tight">
              {step.title}
            </SheetTitle>
          </div>
          <SheetDescription className="text-xs text-slate-500 flex items-center gap-2 pt-1">
            <Badge variant="outline" className="font-mono text-[10px] bg-slate-50">
              <Wrench className="w-2.5 h-2.5 mr-1 text-indigo-500" />
              {step.assignedAgentOrTool}
            </Badge>
            {step.durationMs !== undefined && (
              <span className="flex items-center gap-1 font-mono">
                <Clock className="w-3 h-3 text-slate-400" />
                {step.durationMs}ms
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Intent & Rationale */}
        <div className="space-y-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
              <HelpCircle className="w-3 h-3 text-indigo-600" />
              Step Intent & Strategic Rationale
            </span>
            <p className="text-xs text-slate-600 leading-relaxed">{step.intent}</p>
            <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-200/60">
              Why planned: {step.whyThisStep}
            </p>
          </div>
        </div>

        {/* Input Parameters Payload */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Tool Input Arguments
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCopyJson}
              className="h-7 text-[11px] text-slate-500 gap-1 active:scale-[0.97]"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </Button>
          </div>
          <pre className="p-3 bg-slate-900 text-slate-100 font-mono text-xs rounded-xl overflow-x-auto max-h-48">
            {JSON.stringify(step.arguments, null, 2)}
          </pre>
        </div>

        {/* Execution Output or Error */}
        {step.error ? (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1 text-xs text-rose-800">
            <span className="font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
              Execution Failure
            </span>
            <p className="font-mono text-[11px]">{step.error}</p>
          </div>
        ) : step.result ? (
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase text-slate-500 tracking-wider">
              Structured Tool Output
            </span>
            <pre className="p-3 bg-slate-900 text-emerald-300 font-mono text-xs rounded-xl overflow-x-auto max-h-60">
              {JSON.stringify(step.result, null, 2)}
            </pre>
          </div>
        ) : (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
            Step is pending execution. Output will appear once completed.
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button
            onClick={onClose}
            className="min-h-[44px] px-5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-xl active:scale-[0.97] transition-transform"
          >
            Close Inspector
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
