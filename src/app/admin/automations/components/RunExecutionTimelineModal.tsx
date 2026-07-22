'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { formatDistanceToNow, format } from 'date-fns';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Play,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { AutomationRun, StepRunState, StepExecution } from '@/lib/types';

interface RunExecutionTimelineModalProps {
  run: AutomationRun | null;
  isOpen: boolean;
  onClose: () => void;
}

const STEP_STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  running: { label: 'Running', color: 'bg-blue-500', icon: Play },
  waiting: { label: 'Waiting', color: 'bg-amber-500', icon: Clock },
  failed: { label: 'Failed', color: 'bg-rose-500', icon: XCircle },
  completed: { label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', color: 'bg-amber-600', icon: AlertCircle },
  skipped: { label: 'Skipped', color: 'bg-slate-400', icon: Clock },
};

export function RunExecutionTimelineModal({
  run,
  isOpen,
  onClose,
}: RunExecutionTimelineModalProps) {
  const [expandedStepNodeId, setExpandedStepNodeId] = React.useState<string | null>(null);

  if (!run) return null;

  const stepsList = Object.entries(run.steps || {}).sort((a, b) => {
    const timeA = a[1].startedAt ? new Date(a[1].startedAt).getTime() : 0;
    const timeB = b[1].startedAt ? new Date(b[1].startedAt).getTime() : 0;
    return timeA - timeB;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-2xl p-6 border border-border bg-background shadow-2xl">
        <DialogHeader className="pb-4 border-b border-border/40">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                Execution Timeline Trace
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {run.id.slice(0, 8)}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Step-by-step diagnostic execution history and payload trace
              </DialogDescription>
            </div>
            <Badge className={cn('h-5 text-[9px] font-bold uppercase text-white', (STEP_STATUS_CONFIG[run.status] || STEP_STATUS_CONFIG.completed).color)}>
              {run.status}
            </Badge>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4 mt-4">
          {stepsList.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              No step execution records found for this run.
            </div>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-border/60">
              {stepsList.map(([nodeId, stepState]: [string, StepExecution], idx: number) => {
                const cfg = STEP_STATUS_CONFIG[stepState.status] || STEP_STATUS_CONFIG.completed;
                const IconComponent = cfg.icon;
                const isExpanded = expandedStepNodeId === nodeId;
                const startTime = stepState.executedAt ? new Date(stepState.executedAt) : null;
                const endTime = stepState.executedAt && stepState.durationMs ? new Date(new Date(stepState.executedAt).getTime() + stepState.durationMs) : null;

                return (
                  <div key={nodeId} className="relative group">
                    {/* Node Dot / Icon */}
                    <div
                      className={cn(
                        'absolute -left-6 top-0.5 h-5 w-5 rounded-full flex items-center justify-center text-white ring-4 ring-background transition-transform group-hover:scale-110',
                        cfg.color
                      )}
                    >
                      <IconComponent size={11} />
                    </div>

                    {/* Step Card */}
                    <div className="rounded-xl border border-border/50 bg-muted/10 p-3 hover:bg-muted/20 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            Step #{idx + 1}: {stepState.nodeLabel || nodeId}
                          </p>
                          {startTime && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {format(startTime, 'MMM d, yyyy HH:mm:ss')} (
                              {formatDistanceToNow(startTime, { addSuffix: true })})
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-semibold">
                            {cfg.label}
                          </Badge>
                          <button
                            type="button"
                            onClick={() => setExpandedStepNodeId(isExpanded ? null : nodeId)}
                            className="p-1 rounded hover:bg-muted/80 text-muted-foreground transition-colors"
                          >
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Error Message banner */}
                      {stepState.error && (
                        <div className="mt-2.5 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-mono whitespace-pre-wrap">
                          {stepState.error}
                        </div>
                      )}

                      {/* Expanded Payload & Diagnostics */}
                      {isExpanded && (
                        <div className="mt-3 pt-3 border-t border-border/40 space-y-2 text-[10px]">
                          {stepState.metadata?.output && (
                            <div>
                              <p className="font-semibold text-muted-foreground flex items-center gap-1 mb-1">
                                <FileText size={10} /> Step Output Payload:
                              </p>
                              <pre className="p-2 rounded-lg bg-muted/60 font-mono text-[9px] overflow-x-auto">
                                {JSON.stringify(stepState.metadata.output, null, 2)}
                              </pre>
                            </div>
                          )}
                          {stepState.durationMs !== undefined && (
                            <p className="text-muted-foreground">
                              Duration: {(stepState.durationMs / 1000).toFixed(2)}s
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
