'use client';

import * as React from 'react';
import { 
  Play, 
  GitBranch, 
  Tag, 
  Zap, 
  Clock, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepExecution } from '@/lib/types';

interface StepTimelineProps {
  steps: Record<string, StepExecution> | undefined;
  nodes?: any[];
  className?: string;
}

const getNodeIcon = (nodeType: string) => {
  switch (nodeType) {
    case 'triggerNode':
      return Play;
    case 'conditionNode':
      return GitBranch;
    case 'tagConditionNode':
      return Tag;
    case 'actionNode':
      return Zap;
    case 'tagActionNode':
      return Tag;
    case 'delayNode':
      return Clock;
    default:
      return Activity;
  }
};

const getStatusStyles = (status: StepExecution['status']) => {
  switch (status) {
    case 'success':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-950/20',
        text: 'text-emerald-700 dark:text-emerald-400',
        border: 'border-emerald-200 dark:border-emerald-800',
        icon: CheckCircle2,
        iconColor: 'text-emerald-500',
      };
    case 'failed':
      return {
        bg: 'bg-rose-50 dark:bg-rose-950/20',
        text: 'text-rose-700 dark:text-rose-400',
        border: 'border-rose-200 dark:border-rose-800',
        icon: XCircle,
        iconColor: 'text-rose-500',
      };
    case 'waiting':
      return {
        bg: 'bg-purple-50 dark:bg-purple-950/20',
        text: 'text-purple-700 dark:text-purple-400',
        border: 'border-purple-200 dark:border-purple-800',
        icon: Clock,
        iconColor: 'text-purple-500 animate-pulse',
      };
    case 'skipped':
    default:
      return {
        bg: 'bg-gray-50 dark:bg-gray-800/40',
        text: 'text-gray-500 dark:text-gray-400',
        border: 'border-gray-200 dark:border-gray-700',
        icon: AlertCircle,
        iconColor: 'text-gray-400',
      };
  }
};

export function StepTimeline({ steps, nodes = [], className }: StepTimelineProps) {
  const [expandedErrorNodeId, setExpandedErrorNodeId] = React.useState<string | null>(null);

  if (!steps || Object.keys(steps).length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center p-6 text-center border border-dashed rounded-xl border-border/60 bg-muted/20", className)}>
        <InfoIcon className="h-6 w-6 text-muted-foreground mb-2" />
        <p className="text-xs font-medium text-foreground">No execution steps logged</p>
        <p className="text-[10px] text-muted-foreground mt-1">
          Historical runs executed before this feature do not have step logs.
        </p>
      </div>
    );
  }

  const isOverflowed = (steps as any)?.__overflow === true || (steps as any)?.__overflow === 'true';

  // Filter out the sentinel and convert steps to an array.
  // For wait/delay steps that have already resumed, we use resumedAt as the
  // effective sort timestamp so the wait entry appears between the step before
  // it started and the step that executed after it resumed — matching canvas order.
  const stepList = Object.entries(steps)
    .filter(([key]) => key !== '__overflow')
    .map(([_, step]) => step)
    .sort((a, b) => {
      const tsA = a.metadata?.resumedAt
        ? new Date(a.metadata.resumedAt).getTime() - 1   // place just before the next step
        : new Date(a.executedAt).getTime();
      const tsB = b.metadata?.resumedAt
        ? new Date(b.metadata.resumedAt).getTime() - 1
        : new Date(b.executedAt).getTime();
      
      if (tsA === tsB) {
        // If timestamps are identical, make sure a 'waiting' delayNode is placed last
        if (a.status === 'waiting' && b.status !== 'waiting') return 1;
        if (b.status === 'waiting' && a.status !== 'waiting') return -1;
      }
      return tsA - tsB;
    });

  return (
    <div className={cn("space-y-4", className)}>
      {isOverflowed && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl border border-amber-200 bg-amber-50/50 text-amber-800 dark:border-amber-900/30 dark:bg-amber-950/10 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <h5 className="text-[11px] font-semibold">Step log truncated</h5>
            <p className="text-[10px] opacity-90 mt-0.5">
              This run exceeded the limit of 500 execution entries. Step logging was stopped to conserve storage.
            </p>
          </div>
        </div>
      )}

      <div className="relative pl-4 border-l-2 border-border/40 ml-3 space-y-4">
        {stepList.map((step, idx) => {
          const NodeIcon = getNodeIcon(step.nodeType);
          const statusStyle = getStatusStyles(step.status);
          const StatusIcon = statusStyle.icon;
          const isErrorExpanded = expandedErrorNodeId === step.nodeId;

          // Attempt to find node in automation blueprint to resolve updated label
          const blueprintNode = nodes.find(n => n.id === step.nodeId);
          const displayName = blueprintNode?.data?.label || step.nodeLabel || 'Step';

          return (
            <div key={step.nodeId || idx} className="relative group">
              {/* Chronological Connector Node Bullet */}
              <div className={cn(
                "absolute -left-[25px] top-1.5 w-[14px] h-[14px] rounded-full border-2 bg-background flex items-center justify-center transition-all duration-300 z-10",
                statusStyle.border
              )}>
                <StatusIcon className={cn("h-2 w-2", statusStyle.iconColor)} />
              </div>

              {/* Step Card Container */}
              <div className={cn(
                "p-3 rounded-xl border transition-all duration-300 flex flex-col gap-1.5",
                statusStyle.bg,
                statusStyle.border
              )}>
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-background border border-border/40">
                      <NodeIcon className="h-3.5 w-3.5 text-foreground/70" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground leading-tight">
                        {displayName}
                      </h4>
                      <p className="text-[9px] text-muted-foreground">
                        {new Date(step.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  {/* Badges/Duration */}
                  <div className="flex items-center gap-1.5">
                    {step.durationMs !== undefined && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-background/60 text-muted-foreground border border-border/20">
                        {step.durationMs}ms
                      </span>
                    )}

                    {step.status === 'waiting' && step.metadata?.delayUntil && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 font-medium">
                        Wait until {new Date(step.metadata.delayUntil).toLocaleDateString([], { month: 'short', day: 'numeric' })} {new Date(step.metadata.delayUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}

                    {step.metadata?.resumedAt && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium">
                        Resumed
                      </span>
                    )}

                    {step.metadata?.evaluation && (
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded-full font-semibold border flex items-center gap-0.5",
                        step.metadata.evaluation === 'true'
                          ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800"
                          : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800"
                      )}>
                        → {step.metadata.evaluation === 'true' ? 'True' : 'False'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Subtext info for Node configurations */}
                {step.metadata?.actionType && (
                  <p className="text-[10px] text-muted-foreground">
                    Action Type: <code className="text-[9px] px-1 py-0.5 rounded bg-background/40 font-mono">{step.metadata.actionType}</code>
                  </p>
                )}

                {/* Error Accordion */}
                {step.error && (
                  <div className="mt-1 border-t border-rose-200/40 dark:border-rose-800/40 pt-1.5">
                    <button
                      onClick={() => setExpandedErrorNodeId(isErrorExpanded ? null : step.nodeId)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-400 hover:opacity-85 transition-opacity"
                    >
                      {isErrorExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      View Failure Details
                    </button>
                    {isErrorExpanded && (
                      <div className="mt-1.5 p-2 rounded-lg bg-rose-100/50 dark:bg-rose-950/30 border border-rose-200/50 dark:border-rose-900/30 font-mono text-[9px] text-rose-800 dark:text-rose-300 break-all whitespace-pre-wrap">
                        {step.error}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  );
}
