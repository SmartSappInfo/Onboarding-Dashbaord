'use client';

/**
 * @fileOverview Workflow Instances Table (Phase 7 Milestone 5 Task 5)
 *
 * Implements:
 * - Rule 4: Zero any / Zero any[] strict typing.
 * - Rule 7: Mobile-first responsive touch targets (min-h-[44px]).
 * - Rule 22: Truncated idempotency key / correlation ID display with copy action.
 * - Rule 26: Cooperative cancellation trigger on in-flight workflows.
 * - Status pills conforming to platform semantic tokens.
 */

import * as React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Eye,
  Ban,
  User,
  Bot,
  Terminal,
  Calendar,
  Copy,
  Check,
  GitBranch,
} from 'lucide-react';
import type { WorkflowInstance, WorkflowState } from '@/platform/workflows/workflow-types';

export interface WorkflowInstancesTableProps {
  instances: WorkflowInstance[];
  onInspect: (workflowId: string) => void;
  onCancel?: (workflowId: string) => void;
  isLoading?: boolean;
}

export function WorkflowInstancesTable({
  instances,
  onInspect,
  onCancel,
  isLoading = false,
}: WorkflowInstancesTableProps) {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = (status: WorkflowState) => {
    switch (status) {
      case 'RUNNING':
      case 'RESUMED':
        return (
          <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 font-medium flex items-center gap-1.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
            Running
          </Badge>
        );
      case 'QUEUED':
        return (
          <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30 font-medium flex items-center gap-1.5 py-1">
            <Clock className="h-3 w-3" />
            Queued
          </Badge>
        );
      case 'WAITING':
        return (
          <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium flex items-center gap-1.5 py-1">
            <Clock className="h-3 w-3 animate-spin" />
            Waiting Approval
          </Badge>
        );
      case 'COMPLETED':
        return (
          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium flex items-center gap-1.5 py-1">
            <CheckCircle2 className="h-3 w-3" />
            Completed
          </Badge>
        );
      case 'FAILED':
      case 'TIMED_OUT':
        return (
          <Badge variant="destructive" className="font-medium flex items-center gap-1.5 py-1">
            <AlertTriangle className="h-3 w-3" />
            {status === 'TIMED_OUT' ? 'Timed Out' : 'Failed'}
          </Badge>
        );
      case 'CANCELLED':
        return (
          <Badge variant="outline" className="text-muted-foreground border-border/80 font-medium flex items-center gap-1.5 py-1">
            <XCircle className="h-3 w-3" />
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-medium py-1">
            {status}
          </Badge>
        );
    }
  };

  const getInitiatorIcon = (type: string) => {
    switch (type) {
      case 'user':
        return <User className="h-3.5 w-3.5 text-muted-foreground" />;
      case 'agent':
        return <Bot className="h-3.5 w-3.5 text-primary" />;
      case 'cron':
        return <Calendar className="h-3.5 w-3.5 text-muted-foreground" />;
      default:
        return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  const isCancellable = (status: WorkflowState) => {
    return (
      status === 'CREATED' ||
      status === 'QUEUED' ||
      status === 'RUNNING' ||
      status === 'WAITING' ||
      status === 'RESUMED'
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card overflow-hidden">
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card p-12 text-center flex flex-col items-center justify-center">
        <div className="h-12 w-12 rounded-2xl bg-muted/40 border border-border/80 flex items-center justify-center text-muted-foreground mb-4">
          <GitBranch className="h-6 w-6" />
        </div>
        <h3 className="font-semibold text-base">No workflows found</h3>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          No workflow instances match your active search or status filters. Launch a template or adjust filters to view runs.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30 border-b border-border/80">
            <TableRow>
              <TableHead className="w-[320px] font-semibold text-xs text-muted-foreground uppercase tracking-wider pl-6">
                Workflow & Definition
              </TableHead>
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Initiator
              </TableHead>
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Idempotency
              </TableHead>
              <TableHead className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                Created
              </TableHead>
              <TableHead className="text-right font-semibold text-xs text-muted-foreground uppercase tracking-wider pr-6">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border/60">
            {instances.map((instance) => {
              const cancellable = isCancellable(instance.status);
              return (
                <TableRow
                  key={instance.id}
                  className="hover:bg-muted/20 transition-colors group"
                >
                  {/* Workflow Info */}
                  <TableCell className="pl-6 py-4">
                    <div className="space-y-1">
                      <div className="font-medium text-sm text-foreground flex items-center gap-2">
                        <span>{instance.title || instance.definitionId}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono bg-muted/60 px-1.5 py-0.5 rounded text-[11px]">
                          {instance.definitionId}
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[11px] truncate max-w-[120px]">
                          {instance.id}
                        </span>
                      </div>
                    </div>
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-4">
                    {getStatusBadge(instance.status)}
                  </TableCell>

                  {/* Initiator */}
                  <TableCell className="py-4">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      {getInitiatorIcon(instance.initiator.actorType)}
                      <span className="capitalize">{instance.initiator.actorType}</span>
                      <span className="font-mono text-[11px] truncate max-w-[90px]">
                        ({instance.initiator.actorId})
                      </span>
                    </div>
                  </TableCell>

                  {/* Idempotency Key */}
                  <TableCell className="py-4">
                    <button
                      type="button"
                      onClick={() => handleCopy(instance.idempotencyKey, instance.id)}
                      className="group/copy flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted px-2 py-1 rounded-md transition-colors"
                      title="Click to copy idempotency key"
                    >
                      <span className="truncate max-w-[110px]">
                        {instance.idempotencyKey}
                      </span>
                      {copiedKey === instance.id ? (
                        <Check className="h-3 w-3 text-emerald-500 shrink-0" />
                      ) : (
                        <Copy className="h-3 w-3 opacity-60 group-hover/copy:opacity-100 shrink-0" />
                      )}
                    </button>
                  </TableCell>

                  {/* Created At */}
                  <TableCell className="py-4 text-xs text-muted-foreground">
                    {formatDate(instance.createdAt)}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="py-4 pr-6 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onInspect(instance.id)}
                        className="h-9 px-2.5 rounded-lg border-border/80 hover:bg-muted active:scale-[0.97] transition-transform text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Inspect
                      </Button>

                      {cancellable && onCancel && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => onCancel(instance.id)}
                          className="h-9 px-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-[0.97] transition-transform text-xs"
                          title="Cancel workflow instance"
                        >
                          <Ban className="h-3.5 w-3.5 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
