'use client';

/**
 * @fileOverview Execution Verification Inspector Modal (Phase 14 Milestone 5 Task 2)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog System Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with `min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-3.5 sm:py-4`
 * - Single-Circle Info Tooltip: `<CardInfoTooltip text="..." />` alongside title at `z-[10050]`
 * - Zero Raw Descriptions: `<DialogDescription className="sr-only">`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]` with `min-h-[44px]` touch targets
 *
 * Rules Enforced:
 * - Rule 4: Strict Typing Protocol (Zero `any` or `any[]`).
 * - Rule 7: Mobile-first responsive touch targets >= 44px, everyday UI English.
 * - Rule 10: Inline Architectural Documentation.
 * - Rule 12: Canonical Risk Vocabulary (`L0_READ` to `L4_PRIVILEGED_DESTRUCTIVE`).
 * - Rule 13 & 30: Untrusted Data Isolation inside `<untrusted_reference_data id="...">`.
 * - Rule 18: TOCTOU Optimistic Concurrency Guard (Version check visualization).
 * - Rule 21: Two-Phase Execution (6-Step Stepper: Plan, Actions, Predict, Execute, Verify, Compensate).
 * - Rule 24: Dynamic Circuit Breakers (Health state indicators).
 * - Rule 25: Dead-Letter Queue (DLQ) Quarantine Callout.
 * - Rule 27: Universal Reverse-LIFO Saga Compensation Visualizer.
 * - Rule 41: Explainability Grid (WHAT / WHY / EXPECTED vs ACTUAL / RISK).
 * - Rule 42: Shadow Mode Badge (0 live database writes).
 * - `docs/agents_mcp/agents_mcp_ui.md` (3604–3611).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Activity,
  Eye,
  FileCode,
  RotateCcw,
  Sparkles,
  Database,
  Cpu,
  Hash,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  ExecutionInspectorData,
  ExecutionInspectorZone,
} from '@/platform/verification/ui/verification-ui-types';

export interface ExecutionInspectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ExecutionInspectorData | null;
}

const STEPPER_STAGES: {
  zone: ExecutionInspectorZone;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { zone: 'PLAN', label: '1. Plan', sublabel: 'Goal & Rationale', icon: Sparkles },
  { zone: 'ACTIONS', label: '2. Actions', sublabel: 'Capabilities Invoked', icon: Zap },
  { zone: 'PREDICT', label: '3. Predict', sublabel: 'Expected Invariants', icon: Eye },
  { zone: 'EXECUTE', label: '4. Execute', sublabel: 'Actual Runtime', icon: Cpu },
  { zone: 'VERIFY', label: '5. Verify', sublabel: 'Postcondition Checks', icon: ShieldCheck },
  { zone: 'COMPENSATE', label: '6. Compensate', sublabel: 'Rollback & Healing', icon: RotateCcw },
];

export function ExecutionInspectorModal({
  open,
  onOpenChange,
  data,
}: ExecutionInspectorModalProps): React.JSX.Element {
  const [activeZone, setActiveZone] = React.useState<ExecutionInspectorZone>('PLAN');
  const [copiedHash, setCopiedHash] = React.useState<boolean>(false);
  const [expandedProofIndex, setExpandedProofIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (open) {
      setActiveZone('PLAN');
      setExpandedProofIndex(null);
    }
  }, [open]);

  if (!data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="sm:max-w-xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
        >
          <DialogHeader demarcated>
            <div className="flex flex-row items-center gap-2">
              <Activity className="w-5 h-5 text-muted-foreground" />
              <DialogTitle className="text-base font-semibold">Execution Inspector</DialogTitle>
              <CardInfoTooltip text="Inspect step-by-step postcondition verification, state predictions, actual mutations, and saga rollbacks." />
            </div>
            <DialogDescription className="sr-only">Execution Inspector</DialogDescription>
          </DialogHeader>
          <div className="p-8 text-center text-sm text-muted-foreground">
            No execution details available to inspect.
          </div>
          <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl active:scale-[0.97] min-h-[44px]"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const handleCopyHash = (text: string): void => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedHash(true);
      setTimeout(() => setCopiedHash(false), 2000);
    }
  };

  const isShadowMode = data.status === 'SHADOW_MODE';
  const isFailed = data.status === 'FAIL';
  const isDegraded = data.status === 'DEGRADED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl"
      >
        {/* DEMARCATED HEADER (theme.md §8) */}
        <DialogHeader demarcated>
          <div className="flex flex-row items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4 text-primary" />
            </div>
            <div className="flex flex-col text-left truncate">
              <div className="flex flex-row items-center gap-2">
                <DialogTitle className="text-base font-semibold truncate">
                  Execution Inspector
                </DialogTitle>
                <CardInfoTooltip text="Step-by-step execution verification: review planning intent, capability invocations, predicted invariants, real-world postcondition assertions, and automated rollbacks." />
              </div>
              <span className="text-xs text-muted-foreground font-mono truncate">
                ID: {data.executionId} · Persona: {data.personaId}
              </span>
            </div>
          </div>

          <div className="flex flex-row items-center gap-2 shrink-0">
            {isShadowMode && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px] font-medium"
              >
                Shadow Mode (0 Live Mutations)
              </Badge>
            )}
            {isFailed && (
              <Badge variant="destructive" className="text-[11px] font-medium">
                Execution Failed
              </Badge>
            )}
            {isDegraded && (
              <Badge
                variant="outline"
                className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[11px] font-medium"
              >
                Degraded
              </Badge>
            )}
            {data.status === 'PASS' && (
              <Badge
                variant="outline"
                className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[11px] font-medium"
              >
                Verified Clean
              </Badge>
            )}
          </div>
          <DialogDescription className="sr-only">
            Detailed 6-zone execution and verification inspector
          </DialogDescription>
        </DialogHeader>

        {/* 6-ZONE STEPPER NAV BAR (agents_mcp_ui.md 3604–3611) */}
        <div className="border-b border-border/80 bg-muted/10 px-4 py-2 overflow-x-auto flex flex-row items-center gap-1.5 shrink-0 scrollbar-none">
          {STEPPER_STAGES.map((step) => {
            const Icon = step.icon;
            const isActive = activeZone === step.zone;
            return (
              <button
                key={step.zone}
                type="button"
                onClick={() => setActiveZone(step.zone)}
                className={cn(
                  'flex flex-row items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 min-h-[44px] active:scale-[0.97]',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                )}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <div className="flex flex-col text-left leading-tight">
                  <span className="font-semibold">{step.label}</span>
                  <span
                    className={cn(
                      'text-[10px]',
                      isActive ? 'text-primary-foreground/80' : 'text-muted-foreground/70'
                    )}
                  >
                    {step.sublabel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* MODAL BODY (Zone Content) */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-left">
          {/* ZONE 1: PLAN */}
          {activeZone === 'PLAN' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    High-Level Goal
                  </span>
                  <p className="text-sm font-medium text-foreground">{data.plan.goal}</p>
                </div>

                <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Assigned Persona & Ceiling
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-medium text-foreground">
                      {data.plan.personaId}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-mono">
                      {data.plan.riskLevel}
                    </Badge>
                  </div>
                  {data.plan.targetSubject && (
                    <p className="text-xs text-muted-foreground">
                      Subject: {data.plan.targetSubject}
                    </p>
                  )}
                </div>
              </div>

              {data.plan.rationale && (
                <div className="p-4 rounded-xl border border-border/80 bg-muted/5 space-y-1.5">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Execution Rationale
                  </span>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {data.plan.rationale}
                  </p>
                </div>
              )}

              <div className="flex flex-row items-center gap-4 text-xs text-muted-foreground pt-2">
                <div className="flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-primary" />
                  <span>Budget: {data.plan.budgetTokens.toLocaleString()} tokens</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary" />
                  <span>
                    Executed: {data.executedAt ? new Date(data.executedAt).toLocaleString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ZONE 2: ACTIONS */}
          {activeZone === 'ACTIONS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Capabilities Executed ({data.actions.length})
                </span>
                <span className="text-xs text-muted-foreground">
                  Ordered by execution sequence
                </span>
              </div>

              {data.actions.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No discrete capability actions recorded.
                </div>
              ) : (
                <div className="space-y-3">
                  {data.actions.map((act, idx) => (
                    <div
                      key={act.stepId}
                      className="p-4 rounded-xl border border-border/80 bg-card space-y-2 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono font-bold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="text-sm font-semibold font-mono text-foreground">
                            {act.capabilityId}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {act.status === 'SUCCESS' && (
                            <Badge
                              variant="outline"
                              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]"
                            >
                              Success
                            </Badge>
                          )}
                          {act.status === 'FAILED' && (
                            <Badge variant="destructive" className="text-[10px]">
                              Failed
                            </Badge>
                          )}
                          {act.status === 'COMPENSATED' && (
                            <Badge
                              variant="outline"
                              className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]"
                            >
                              Compensated
                            </Badge>
                          )}
                          {act.durationMs !== undefined && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {act.durationMs}ms
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Inputs preview */}
                      <div className="rounded-lg bg-muted/20 p-2.5 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-32">
                        <pre className="whitespace-pre-wrap">
                          {JSON.stringify(act.inputPayload, null, 2)}
                        </pre>
                      </div>

                      {act.error && (
                        <p className="text-xs text-destructive font-mono">{act.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ZONE 3: PREDICT (Expected Result) */}
          {activeZone === 'PREDICT' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Predicted State Invariants (Pre-Commit)
                  </span>
                  {data.predict.expectedVersion !== undefined && (
                    <Badge variant="outline" className="text-[11px] font-mono">
                      Expected Version: v{data.predict.expectedVersion}
                    </Badge>
                  )}
                </div>

                <div className="rounded-lg bg-card border border-border/60 p-3 text-xs font-mono text-foreground overflow-x-auto max-h-48">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(data.predict.predictedStateChange, null, 2)}
                  </pre>
                </div>

                {data.predict.stateHash && (
                  <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                    <span className="text-muted-foreground flex items-center gap-1.5 font-mono">
                      <Hash className="w-3.5 h-3.5 text-primary" />
                      State Hash (SHA-256):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyHash(data.predict.stateHash || '')}
                      className="flex items-center gap-1 font-mono text-[11px] text-primary hover:underline"
                    >
                      <span>{data.predict.stateHash.slice(0, 16)}...</span>
                      {copiedHash ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {data.predict.blastRadius && (
                <div className="p-4 rounded-xl border border-border/80 bg-muted/5 space-y-2">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Simulated Blast Radius (Rule 41)
                  </span>
                  <div className="rounded-lg bg-card p-3 text-xs font-mono text-muted-foreground overflow-x-auto max-h-36">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(data.predict.blastRadius, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ZONE 4: EXECUTE (Actual Result) */}
          {activeZone === 'EXECUTE' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Execution Time
                  </span>
                  <p className="text-lg font-bold text-foreground font-mono">
                    {data.execute.durationMs}ms
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Tokens Consumed
                  </span>
                  <p className="text-lg font-bold text-foreground font-mono">
                    {data.execute.tokensUsed.toLocaleString()}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-border/80 bg-muted/10">
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">
                    Live Database Writes
                  </span>
                  <p
                    className={cn(
                      'text-lg font-bold font-mono',
                      data.execute.liveWritesCount === 0 ? 'text-amber-500' : 'text-foreground'
                    )}
                  >
                    {data.execute.liveWritesCount}
                    {data.execute.liveWritesCount === 0 && ' (Dry-Run)'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/80 bg-card space-y-2">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Raw Output Payload
                </span>
                <div className="rounded-lg bg-muted/20 p-3 text-xs font-mono text-foreground overflow-x-auto max-h-56">
                  <pre className="whitespace-pre-wrap">
                    {JSON.stringify(data.execute.output, null, 2)}
                  </pre>
                </div>
              </div>

              {data.execute.error && (
                <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/10 space-y-1">
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                    Runtime Error Encountered
                  </span>
                  <p className="text-xs font-mono text-destructive">{data.execute.error}</p>
                </div>
              )}
            </div>
          )}

          {/* ZONE 5: VERIFY (Postcondition Checks) */}
          {activeZone === 'VERIFY' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  Postcondition Assertions ({data.verify.result.assertions.length})
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {data.verify.result.passedCount} Passed · {data.verify.result.failedCount} Failed
                </span>
              </div>

              {/* Version validation status (Rule 18) */}
              {data.verify.versionResult && (
                <div
                  className={cn(
                    'p-3 rounded-xl border flex items-center justify-between text-xs',
                    data.verify.versionResult.isCurrent
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'border-destructive/30 bg-destructive/10 text-destructive'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {data.verify.versionResult.isCurrent ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>
                      Version Check: {data.verify.versionResult.resourceType} #
                      {data.verify.versionResult.resourceId} (Expected: v
                      {String(data.verify.versionResult.expectedVersion)}, Actual: v
                      {String(data.verify.versionResult.actualVersion)})
                    </span>
                  </div>
                  <span className="font-semibold uppercase text-[10px]">
                    {data.verify.versionResult.violationType}
                  </span>
                </div>
              )}

              {/* Assertion Checklist */}
              <div className="space-y-2.5">
                {data.verify.result.assertions.map((assertion, idx) => {
                  const isVerified = assertion.status === 'VERIFIED';
                  const isExpanded = expandedProofIndex === idx;

                  return (
                    <div
                      key={assertion.assertionId}
                      className={cn(
                        'rounded-xl border p-3.5 transition-all text-xs',
                        isVerified
                          ? 'border-border/80 bg-card hover:border-emerald-500/40'
                          : 'border-destructive/40 bg-destructive/5'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {isVerified ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <XCircle className="w-4 h-4 text-destructive shrink-0" />
                          )}
                          <div className="flex flex-col text-left truncate">
                            <span className="font-semibold font-mono text-foreground truncate">
                              {assertion.ruleName}
                            </span>
                            <span className="text-[11px] text-muted-foreground truncate">
                              Target: {assertion.targetResource} #{assertion.targetId}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] font-mono',
                              assertion.severity === 'CRITICAL'
                                ? 'border-destructive/30 text-destructive'
                                : 'border-amber-500/30 text-amber-500'
                            )}
                          >
                            {assertion.severity}
                          </Badge>
                          {assertion.evidence && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpandedProofIndex(isExpanded ? null : idx)
                              }
                              className="h-7 px-2 text-[11px] rounded-lg min-h-0 active:scale-95"
                            >
                              <FileCode className="w-3.5 h-3.5 mr-1" />
                              {isExpanded ? 'Hide Proof' : 'View Proof'}
                            </Button>
                          )}
                        </div>
                      </div>

                      {assertion.errorMessage && (
                        <p className="mt-2 text-destructive font-mono text-[11px]">
                          {assertion.errorMessage}
                        </p>
                      )}

                      {/* XML Reference Container for Proofs (Rule 13 & 30) */}
                      {isExpanded && assertion.evidence && (
                        <div className="mt-3 pt-3 border-t border-border/60">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block mb-1">
                            Proof Snapshot (&lt;untrusted_reference_data&gt;)
                          </span>
                          <div className="rounded-lg bg-muted/20 p-2.5 font-mono text-[10px] overflow-x-auto max-h-36">
                            <pre className="whitespace-pre-wrap">
                              {JSON.stringify(assertion.evidence, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ZONE 6: COMPENSATE (Exceptions / Rollback) */}
          {activeZone === 'COMPENSATE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-border/80 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                    Saga Compensation & Recovery Status
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[11px]',
                      data.compensate.required
                        ? 'border-destructive/30 text-destructive bg-destructive/10'
                        : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                    )}
                  >
                    {data.compensate.required
                      ? data.compensate.executed
                        ? 'Compensated'
                        : 'Compensation Needed'
                      : 'No Rollback Required'}
                  </Badge>
                </div>

                {/* Discrepancy details if present */}
                {data.verify.discrepancyReport && (
                  <div className="p-3 rounded-lg bg-card border border-border/60 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">
                        Side-Effect Discrepancy Detected
                      </span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {data.verify.discrepancyReport.varianceType}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Remediation Action: {data.verify.discrepancyReport.remediationAction} (
                      {data.verify.discrepancyReport.isRemediable
                        ? 'Autonomous Self-Healing'
                        : 'Operator Escalation Required'}
                      )
                    </p>
                  </div>
                )}

                {/* Reverse-LIFO Saga steps */}
                {data.compensate.compensatingSteps &&
                  data.compensate.compensatingSteps.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border/60">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Reverse-LIFO Rollback Steps Executed:
                      </span>
                      {data.compensate.compensatingSteps.map((step, idx) => (
                        <div
                          key={step.stepId}
                          className="flex items-center justify-between p-2 rounded-lg bg-card text-xs"
                        >
                          <span className="font-mono text-muted-foreground">
                            {idx + 1}. {step.capabilityId}
                          </span>
                          <Badge variant="outline" className="text-[10px]">
                            {step.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                {data.compensate.dlqEnqueued && (
                  <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-xs text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Quarantined in Dead Letter Queue (DLQ) for operator intervention.</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* DEMARCATED FOOTER (theme.md §8) */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0">
          <div className="text-xs text-muted-foreground font-mono">
            Zone: {activeZone} (Step{' '}
            {STEPPER_STAGES.findIndex((s) => s.zone === activeZone) + 1} of 6)
          </div>
          <div className="flex flex-row items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl active:scale-[0.97] min-h-[44px]"
            >
              Close Inspector
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
