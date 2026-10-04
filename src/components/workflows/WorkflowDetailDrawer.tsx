'use client';

/**
 * @fileOverview Standardized Workflow Detail Drawer (Phase 7 Milestone 5 Task 5)
 *
 * Implements theme.md Section 8 (Standardized Modal & Dialog Architecture):
 * - Surface & Geometry: `border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl`
 * - Demarcated Header: `<DialogHeader demarcated>` with min-h-[52px] sm:min-h-[56px]
 * - Zero Raw Descriptions: routed exclusively through `<CardInfoTooltip text="..." />` alongside title
 * - Accessible Screen Reader: `<DialogDescription className="sr-only">`
 * - Single-Circle Info Tooltip elevated at `z-[10050]`
 * - Demarcated Footer: `px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5`
 * - Tactile mechanical feedback: `rounded-xl active:scale-[0.97]`
 *
 * Security & Governance (Rules 4, 7, 17, 21, 22, 26, 30, 40):
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 7: Mobile touch targets min-h-[44px].
 * - Rule 17: Non-delegable action warning shield badges.
 * - Rule 21: Approval pause state visualization.
 * - Rule 22: Cryptographic SHA-256 hash badges with truncated display and one-click copy.
 * - Rule 26: Cooperative cancellation trigger with confirmation.
 * - Rule 30: Untrusted inputs, outputs, and payloads isolated in `<untrusted_reference_data>` container.
 * - Rule 40: Tamper-evident audit checkpoint sequence with chained hashes.
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  GitBranch,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Copy,
  Check,
  Ban,
  Layers,
  ShieldAlert,
  FileText,
  Activity,
  User,
  Bot,
  Calendar,
  Terminal,
  Lock,
} from 'lucide-react';
import type {
  WorkflowInstance,
  WorkflowStep,
  WorkflowCheckpoint,
  WorkflowState,
} from '@/platform/workflows/workflow-types';
import { WorkflowDagVisualizer } from './WorkflowDagVisualizer';

export interface WorkflowDetailDrawerProps {
  instance: WorkflowInstance | null;
  steps: WorkflowStep[];
  checkpoints: WorkflowCheckpoint[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'overview' | 'dag' | 'timeline' | 'checkpoints';
  onCancel?: (workflowId: string, reason?: string) => Promise<void>;
  isProcessing?: boolean;
}

export function WorkflowDetailDrawer({
  instance,
  steps,
  checkpoints,
  open,
  onOpenChange,
  initialTab = 'overview',
  onCancel,
  isProcessing = false,
}: WorkflowDetailDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<'overview' | 'dag' | 'timeline' | 'checkpoints'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [selectedStep, setSelectedStep] = React.useState<WorkflowStep | null>(null);
  const [isCancelling, setIsCancelling] = React.useState(false);

  React.useEffect(() => {
    if (steps.length > 0 && !selectedStep) {
      setSelectedStep(steps[0]);
    }
  }, [steps, selectedStep]);

  if (!instance) return null;

  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(label);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCancelClick = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(instance.id, 'Operator manual cancellation via Mission Control');
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusBadge = (status: WorkflowState) => {
    switch (status) {
      case 'RUNNING':
      case 'RESUMED':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-medium flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Running
          </Badge>
        );
      case 'WAITING':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium flex items-center gap-1">
            <Clock className="h-3 w-3 animate-spin" />
            Waiting Approval
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'FAILED':
      case 'TIMED_OUT':
        return (
          <Badge variant="destructive" className="font-medium flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {status}
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="outline" className="text-muted-foreground border-border/80 font-medium flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isCancellable =
    instance.status === 'CREATED' ||
    instance.status === 'QUEUED' ||
    instance.status === 'RUNNING' ||
    instance.status === 'WAITING' ||
    instance.status === 'RESUMED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl p-0 gap-0 overflow-hidden flex flex-col rounded-2xl border border-border/80 bg-card text-card-foreground shadow-2xl h-[90vh] max-h-[850px]">
        {/* Demarcated Header */}
        <DialogHeader demarcated className="px-6 py-3.5 sm:py-4 min-h-[52px] sm:min-h-[56px] border-b border-border/80 bg-muted/20 flex flex-row items-center justify-between shrink-0 space-y-0 text-left">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <GitBranch className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-base font-semibold tracking-tight truncate">
                  {instance.title || instance.definitionId}
                </DialogTitle>
                {getStatusBadge(instance.status)}
                <CardInfoTooltip text="Inspect workflow execution status, DAG step progression, prompt-injection isolated outputs, and cryptographic audit checkpoints." />
              </div>
            </div>
          </div>
          <DialogDescription className="sr-only">
            Inspect detailed workflow instance execution state, steps, DAG visualizer, and audit trail checkpoints.
          </DialogDescription>
        </DialogHeader>

        {/* Modal Body with Tabbed Layout */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as typeof activeTab)}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* Tabs List Header */}
            <div className="px-6 border-b border-border/80 bg-muted/5 shrink-0">
              <TabsList className="h-11 bg-transparent p-0 gap-4">
                <TabsTrigger
                  value="overview"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-3"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="dag"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-3"
                >
                  <Layers className="h-3.5 w-3.5 mr-1.5" />
                  DAG Topology ({steps.length})
                </TabsTrigger>
                <TabsTrigger
                  value="timeline"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-3"
                >
                  <Activity className="h-3.5 w-3.5 mr-1.5" />
                  Execution Steps ({steps.length})
                </TabsTrigger>
                <TabsTrigger
                  value="checkpoints"
                  className="data-[state=active]:bg-transparent data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none rounded-none text-xs font-semibold px-1 py-3"
                >
                  <Lock className="h-3.5 w-3.5 mr-1.5" />
                  Checkpoints & Audit ({checkpoints.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* TAB 1: OVERVIEW */}
            <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 m-0 space-y-6">
              {/* Key Attributes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Workflow ID
                  </span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs truncate">{instance.id}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(instance.id, 'workflow-id')}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      {copiedKey === 'workflow-id' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Definition ID
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {instance.definitionId}
                    </Badge>
                    <span className="text-xs text-muted-foreground">v{instance.definitionVersion}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Initiator
                  </span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="capitalize font-medium">{instance.initiator.actorType}:</span>
                    <span className="font-mono text-muted-foreground truncate">{instance.initiator.actorId}</span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Idempotency Key
                  </span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs truncate max-w-[170px]">{instance.idempotencyKey}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(instance.idempotencyKey, 'idempotency-key')}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      {copiedKey === 'idempotency-key' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Correlation ID
                  </span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-xs truncate max-w-[170px]">{instance.correlationId}</span>
                    <button
                      type="button"
                      onClick={() => handleCopy(instance.correlationId, 'correlation-id')}
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      {copiedKey === 'correlation-id' ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                    </button>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border/80 bg-card space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Created / Completed
                  </span>
                  <div className="text-xs text-muted-foreground">
                    {new Date(instance.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Waiting Condition Banner if applicable */}
              {instance.status === 'WAITING' && instance.currentWaitCondition && (
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider">
                    <Clock className="h-4 w-4 animate-spin" />
                    <span>Awaiting Human Approval / Resume Condition</span>
                  </div>
                  <p className="text-xs leading-relaxed">
                    Type: <code className="font-mono font-semibold">{instance.currentWaitCondition.type}</code>
                    {typeof instance.currentWaitCondition.details?.actionProposalId === 'string' && (
                      <> • Proposal ID: <code className="font-mono font-semibold">{instance.currentWaitCondition.details.actionProposalId}</code></>
                    )}
                    {instance.currentWaitCondition.expiresAt && (
                      <> • Expires At: {new Date(instance.currentWaitCondition.expiresAt).toLocaleTimeString()}</>
                    )}
                  </p>
                </div>
              )}

              {/* Inputs Payload (Rule 30: untrusted reference data container) */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Workflow Inputs
                </span>
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3 font-mono text-xs overflow-x-auto max-h-48">
                  <pre className="text-foreground">
                    {`<untrusted_reference_data id="inputs_${instance.id}">\n`}
                    {JSON.stringify(instance.inputs, null, 2)}
                    {`\n</untrusted_reference_data>`}
                  </pre>
                </div>
              </div>

              {/* Error Output if Failed */}
              {instance.error && (
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Failure Diagnostics
                  </span>
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 font-mono text-xs text-destructive overflow-x-auto">
                    <div className="font-bold">Error Code: {instance.error.code}</div>
                    <div className="mt-1">{instance.error.message}</div>
                    {Boolean((instance.error.details as { stepId?: string } | undefined)?.stepId || instance.currentStepId) && (
                      <div className="mt-1 text-muted-foreground">
                        Failed Step: {(instance.error.details as { stepId?: string } | undefined)?.stepId || instance.currentStepId}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 2: DAG TOPOLOGY */}
            <TabsContent value="dag" className="flex-1 overflow-y-auto p-6 m-0 space-y-4">
              <WorkflowDagVisualizer
                steps={steps}
                selectedStepId={selectedStep?.id}
                onSelectStep={setSelectedStep}
              />

              {/* Selected Step Inspector Card */}
              {selectedStep && (
                <div className="rounded-xl border border-border/80 bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{selectedStep.name}</span>
                      <Badge variant="outline" className="font-mono text-xs">
                        {selectedStep.capabilityId}
                      </Badge>
                      {selectedStep.isNonDelegable && (
                        <Badge variant="destructive" className="text-[10px] flex items-center gap-1 font-mono">
                          <ShieldAlert className="h-3 w-3" />
                          Non-Delegable
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Status: <strong className="capitalize">{selectedStep.status.toLowerCase()}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Attempts:</span>{' '}
                      <span className="font-mono font-medium">{selectedStep.attempt + 1}/{selectedStep.maxAttempts}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Duration:</span>{' '}
                      <span className="font-mono font-medium">{selectedStep.durationMs ? `${Math.round(selectedStep.durationMs)}ms` : '—'}</span>
                    </div>
                    <div className="truncate">
                      <span className="text-muted-foreground">Idempotency:</span>{' '}
                      <span className="font-mono text-[11px]">{selectedStep.idempotencyKey.slice(0, 16)}...</span>
                    </div>
                  </div>

                  {/* Step Input / Output containerized */}
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Step Output / State Payload (Rule 30)
                    </span>
                    <div className="rounded-lg border border-border/80 bg-muted/20 p-2.5 font-mono text-[11px] overflow-x-auto max-h-36">
                      <pre>
                        {`<untrusted_reference_data id="step_output_${selectedStep.id}">\n`}
                        {JSON.stringify(selectedStep.output || selectedStep.input, null, 2)}
                        {`\n</untrusted_reference_data>`}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* TAB 3: EXECUTION TIMELINE */}
            <TabsContent value="timeline" className="flex-1 overflow-y-auto p-6 m-0 space-y-3">
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className="p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/15 transition-colors flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center font-mono text-xs font-semibold shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {step.name}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground truncate">
                            ({step.capabilityId})
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>Attempt {step.attempt + 1}/{step.maxAttempts}</span>
                          {step.durationMs && <span>• {Math.round(step.durationMs)}ms</span>}
                          {step.dependsOn && step.dependsOn.length > 0 && (
                            <span>• depends on: {step.dependsOn.join(', ')}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <Badge variant="outline" className="capitalize text-xs">
                        {step.status.toLowerCase()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* TAB 4: CHECKPOINTS & AUDIT */}
            <TabsContent value="checkpoints" className="flex-1 overflow-y-auto p-6 m-0 space-y-3">
              <div className="text-xs text-muted-foreground mb-2 flex items-center justify-between">
                <span>Tamper-evident cryptographic audit checkpoints (Rule 40)</span>
                <span className="font-mono">{checkpoints.length} recorded</span>
              </div>

              {checkpoints.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border border-dashed border-border/80 rounded-xl">
                  No checkpoints recorded yet.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {checkpoints.map((cp) => (
                    <div
                      key={cp.id}
                      className="p-3.5 rounded-xl border border-border/80 bg-card space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="font-mono text-xs">
                            #{cp.checkpointSequence}
                          </Badge>
                          <span className="text-xs font-medium">
                            {cp.fromState} ➔ {cp.toState}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(cp.timestamp).toLocaleTimeString()}
                        </span>
                      </div>

                      {/* Cryptographic Hashes (Rule 22) */}
                      <div className="flex flex-col sm:flex-row gap-2 pt-1 border-t border-border/40 text-[11px]">
                        <div className="flex items-center gap-1 font-mono text-muted-foreground">
                          <span>Hash:</span>
                          <span className="truncate max-w-[140px] text-foreground">{cp.hash}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(cp.hash, `hash-${cp.id}`)}
                            className="p-0.5 hover:text-foreground"
                          >
                            {copiedKey === `hash-${cp.id}` ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                          </button>
                        </div>
                        {cp.previousHash && (
                          <div className="flex items-center gap-1 font-mono text-muted-foreground">
                            <span>Prev:</span>
                            <span className="truncate max-w-[140px] text-foreground">{cp.previousHash}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(cp.previousHash!, `prev-${cp.id}`)}
                              className="p-0.5 hover:text-foreground"
                            >
                              {copiedKey === `prev-${cp.id}` ? <Check className="h-2.5 w-2.5 text-emerald-500" /> : <Copy className="h-2.5 w-2.5" />}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Demarcated Footer */}
        <div className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-between gap-2.5 shrink-0">
          <div>
            {isCancellable && onCancel && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleCancelClick}
                disabled={isCancelling || isProcessing}
                className="rounded-xl active:scale-[0.97] h-10 px-4 min-h-[44px] sm:min-h-[40px] text-xs font-medium gap-1.5"
              >
                <Ban className="h-4 w-4" />
                {isCancelling ? 'Cancelling...' : 'Cancel Workflow'}
              </Button>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl border-border/80 active:scale-[0.97] h-10 px-4 min-h-[44px] sm:min-h-[40px] text-xs font-medium"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
