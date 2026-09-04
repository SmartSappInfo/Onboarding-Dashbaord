'use client';

/**
 * @fileOverview CompanyBrain 2.0 Phase 9: Workflow Run Execution Monitor
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Step-Level Observability:
 *    - Renders detailed telemetry and step execution timeline for active and completed runs.
 * 2. Mobile Touch Targets & Responsive Layout:
 *    - All accordions, tabs, and buttons satisfy >= 44px touch targets.
 * 3. Emil Kowalski Micro-Interactions:
 *    - Tactile buttons with `active:scale-[0.97]` and smooth accordion disclosures.
 * 4. Strict Zero-`any` & Zero-`unknown` standard.
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  ShieldCheck,
  Bot,
  Layers,
  GitBranch,
  Wrench,
  Zap,
  RotateCcw,
} from 'lucide-react';
import type {
  WorkflowRun,
  WorkflowDefinition,
  WorkflowStepResult,
  WorkflowNodeType,
} from '@/lib/workflows/types';

export interface WorkflowRunMonitorProps {
  run: WorkflowRun | null;
  workflow: WorkflowDefinition | null;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
}

function getNodeIcon(nodeType: WorkflowNodeType) {
  switch (nodeType) {
    case 'trigger':
      return <Zap className="w-3.5 h-3.5 text-amber-500" />;
    case 'specialist':
      return <Bot className="w-3.5 h-3.5 text-blue-500" />;
    case 'context':
      return <Layers className="w-3.5 h-3.5 text-indigo-500" />;
    case 'decision':
      return <GitBranch className="w-3.5 h-3.5 text-purple-500" />;
    case 'tool':
      return <Wrench className="w-3.5 h-3.5 text-emerald-500" />;
    case 'approval_gate':
      return <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />;
    case 'action':
      return <Activity className="w-3.5 h-3.5 text-sky-500" />;
    default:
      return <Activity className="w-3.5 h-3.5 text-slate-500" />;
  }
}

function getStatusBadge(status: WorkflowRun['status']) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Completed
        </Badge>
      );
    case 'running':
      return (
        <Badge className="bg-blue-100 text-blue-800 border-blue-300 animate-pulse font-medium">
          <Activity className="w-3 h-3 mr-1" />
          Executing
        </Badge>
      );
    case 'waiting_approval':
      return (
        <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-medium">
          <Clock className="w-3 h-3 mr-1" />
          Awaiting Approval
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-medium">
          <XCircle className="w-3 h-3 mr-1" />
          Failed
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className="bg-slate-100 text-slate-800 border-slate-300 font-medium">
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-slate-600">
          Pending
        </Badge>
      );
  }
}

export function WorkflowRunMonitor({
  run,
  workflow,
  onRefresh,
  isLoading = false,
}: WorkflowRunMonitorProps) {
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});

  if (!run) {
    return (
      <Card className="border-slate-200 p-8 text-center bg-slate-50/50">
        <Activity className="w-8 h-8 mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-700">No active workflow run selected.</p>
        <p className="text-xs text-slate-500 mt-1">
          Select a workflow and initiate a run or simulate an event to inspect telemetry.
        </p>
      </Card>
    );
  }

  const toggleNodeExpanded = (nodeId: string) => {
    setExpandedNodes((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const executedSteps = Object.values(run.stepResults) as WorkflowStepResult[];

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden space-y-0">
      <CardHeader className="bg-slate-50/80 border-b border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <CardTitle className="text-base font-bold text-slate-900">
              {workflow?.title || 'Autonomous Workflow Run'}
            </CardTitle>
            {getStatusBadge(run.status)}
          </div>
          <p className="text-xs text-slate-500 font-mono">
            Run ID: {run.id} • Started {new Date(run.startedAt).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="min-h-[44px] sm:min-h-[36px] text-xs active:scale-[0.97] transition-all"
            >
              <RotateCcw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Run Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200/70 text-xs">
          <div>
            <span className="text-slate-500 block text-[11px]">Duration</span>
            <span className="font-semibold text-slate-900">
              {run.metrics?.totalDurationMs ? `${run.metrics.totalDurationMs}ms` : 'In Progress'}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Steps Executed</span>
            <span className="font-semibold text-slate-900">{run.executedNodeIds.length} nodes</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Approval Intercepts</span>
            <span className="font-semibold text-slate-900">
              {run.metrics?.approvalWaitCount || 0}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Trigger Source</span>
            <span className="font-semibold text-slate-900 capitalize">
              {run.triggerPayload?.eventType ? String(run.triggerPayload.eventType) : 'Manual'}
            </span>
          </div>
        </div>

        {/* Failure Error Alert if applicable */}
        {run.error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-xs space-y-1 text-rose-900">
            <span className="font-bold flex items-center gap-1.5 text-rose-800">
              <XCircle className="w-4 h-4 text-rose-600" />
              Pipeline Execution Error:
            </span>
            <p className="font-mono text-[11px] leading-relaxed pl-5.5">{run.error}</p>
          </div>
        )}

        {/* Step Execution Timeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Pipeline Execution Steps ({executedSteps.length})
          </h4>

          <div className="space-y-2.5">
            {executedSteps.map((step, idx) => {
              const isExpanded = !!expandedNodes[step.nodeId];
              const matchingConfig = workflow?.nodes.find((n) => n.id === step.nodeId);
              const nodeTitle = matchingConfig?.title || step.nodeId;

              return (
                <div
                  key={step.nodeId}
                  className={`border rounded-lg p-3 transition-all ${
                    step.status === 'failed'
                      ? 'border-rose-200 bg-rose-50/50'
                      : step.status === 'waiting_approval'
                        ? 'border-amber-200 bg-amber-50/50'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleNodeExpanded(step.nodeId)}
                    className="w-full flex items-center justify-between gap-2 text-left min-h-[44px] sm:min-h-[36px] active:scale-[0.99] transition-all"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                        {getNodeIcon(step.nodeType)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {idx + 1}. {nodeTitle}
                          </span>
                          <Badge variant="outline" className="text-[10px] font-mono capitalize">
                            {step.nodeType}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-mono text-slate-500">
                        {step.durationMs}ms
                      </span>
                      {step.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      )}
                      {step.status === 'failed' && <XCircle className="w-4 h-4 text-rose-600" />}
                      {step.status === 'waiting_approval' && (
                        <Clock className="w-4 h-4 text-amber-600" />
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Output / Payload Details */}
                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-200/70 text-xs space-y-2">
                      {step.error && (
                        <div className="p-2 bg-rose-100/70 rounded text-rose-800 font-mono text-[11px]">
                          Error: {step.error}
                        </div>
                      )}

                      <div>
                        <span className="text-[11px] font-semibold text-slate-600 block mb-1">
                          Step Output Payload:
                        </span>
                        <pre className="font-mono text-[11px] p-2 bg-slate-50 border border-slate-200 rounded max-h-48 overflow-x-auto text-slate-800">
                          {JSON.stringify(step.outputPayload, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
