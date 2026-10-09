'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { 
    AlertTriangle, 
    CheckCircle2, 
    UserCheck, 
    Trash2, 
    Loader2, 
    RefreshCw, 
    Layers 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export type BulkActionType = 'status' | 'assign' | 'delete';

export interface BulkTaskFailure {
    id: string;
    title: string;
    error: string;
}

export interface BulkActionSnapshot {
    actionType: BulkActionType;
    taskIds: string[];
    targetValue?: string;
    targetLabel?: string;
}

export interface BulkActionReviewDialogProps {
    isOpen: boolean;
    onClose: () => void;
    actionType: BulkActionType;
    selectedTaskIds: string[];
    selectedTasks?: Array<{ id: string; title: string }>;
    targetValue?: string;
    targetLabel?: string;
    isExecuting?: boolean;
    failedTasks?: BulkTaskFailure[];
    onConfirm: (snapshot: BulkActionSnapshot) => void | Promise<void>;
    onRetryFailed?: (failedIds: string[]) => void | Promise<void>;
}

/**
 * BulkActionReviewDialog
 * Two-phase bulk action review and partial failure retry flow.
 * Strictly adheres to theme.md Section 8 and .agents/AGENTS.md Modal Architecture:
 * - Demarcated header with single-circle CardInfoTooltip.
 * - Screen-reader only DialogDescription.
 * - Demarcated footer with tactile buttons (active:scale-[0.97]).
 * - Clear execution state and partial-failure retry mechanisms.
 */
export function BulkActionReviewDialog({
    isOpen,
    onClose,
    actionType,
    selectedTaskIds,
    selectedTasks = [],
    targetValue,
    targetLabel,
    isExecuting = false,
    failedTasks,
    onConfirm,
    onRetryFailed,
}: BulkActionReviewDialogProps) {
    const hasFailures = Boolean(failedTasks && failedTasks.length > 0);
    const count = selectedTaskIds.length;
    const isDestructive = actionType === 'delete';

    const getDialogTitle = () => {
        if (hasFailures) return 'Action Completed with Errors';
        switch (actionType) {
            case 'status':
                return 'Review Bulk Status Update';
            case 'assign':
                return 'Review Bulk Reassignment';
            case 'delete':
                return 'Review Bulk Deletion';
        }
    };

    const getTooltipText = () => {
        if (hasFailures) return 'Some tasks could not be updated due to permissions or sync constraints. You can retry the failed tasks.';
        switch (actionType) {
            case 'status':
                return 'Review the tasks to be updated. All selected tasks will atomically transition to the chosen status.';
            case 'assign':
                return 'Review the selected tasks. Assignee assignments will be updated across all selected items.';
            case 'delete':
                return 'Permanently removes the selected tasks from your workspace. This action cannot be reversed.';
        }
    };

    const handleConfirm = () => {
        onConfirm({
            actionType,
            taskIds: selectedTaskIds,
            targetValue,
            targetLabel,
        });
    };

    const handleRetry = () => {
        if (!failedTasks || failedTasks.length === 0) return;
        const failedIds = failedTasks.map((t) => t.id);
        onRetryFailed?.(failedIds);
    };

    const previewTasks = selectedTasks.length > 0 
        ? selectedTasks 
        : selectedTaskIds.map((id) => ({ id, title: `Task ${id.slice(0, 8)}...` }));
    const visiblePreviews = previewTasks.slice(0, 5);
    const remainingCount = Math.max(0, previewTasks.length - 5);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isExecuting) onClose(); }}>
            <DialogContent className="sm:max-w-lg flex flex-col p-0 overflow-hidden border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl font-figtree">
                {/* Demarcated Modal Header */}
                <DialogHeader demarcated>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-xl shrink-0",
                            hasFailures || isDestructive 
                                ? "bg-destructive/10 text-destructive" 
                                : "bg-primary/10 text-primary"
                        )}>
                            {hasFailures ? (
                                <AlertTriangle className="h-5 w-5" />
                            ) : isDestructive ? (
                                <Trash2 className="h-5 w-5" />
                            ) : actionType === 'assign' ? (
                                <UserCheck className="h-5 w-5" />
                            ) : (
                                <Layers className="h-5 w-5" />
                            )}
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <DialogTitle className="text-base font-bold text-foreground truncate">
                                {getDialogTitle()}
                            </DialogTitle>
                            <CardInfoTooltip text={getTooltipText()} />
                        </div>
                    </div>
                    <DialogDescription className="sr-only">
                        {getTooltipText()}
                    </DialogDescription>
                </DialogHeader>

                {/* Body Content */}
                <div className="p-6 space-y-4 text-sm">
                    {/* State A: Partial Failure Display */}
                    {hasFailures && failedTasks ? (
                        <div className="space-y-3.5">
                            <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 text-destructive space-y-1">
                                <div className="flex items-center gap-2 font-semibold text-xs">
                                    <AlertTriangle className="h-4 w-4" />
                                    <span>{failedTasks.length} of {count} tasks failed</span>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    The remaining {count - failedTasks.length} tasks were updated successfully. Review the failed tasks below:
                                </p>
                            </div>

                            <ScrollArea className="max-h-56 pr-2">
                                <div className="space-y-2">
                                    {failedTasks.map((failed) => (
                                        <div key={failed.id} className="p-2.5 rounded-lg border border-border/70 bg-muted/20 space-y-1 text-left">
                                            <p className="text-xs font-semibold text-foreground truncate">{failed.title}</p>
                                            <p className="text-[11px] text-destructive leading-tight">{failed.error}</p>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        </div>
                    ) : isExecuting ? (
                        /* State B: Executing Loading State */
                        <div className="py-10 flex flex-col items-center justify-center gap-3 text-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">Processing bulk action...</p>
                                <p className="text-xs text-muted-foreground">Applying changes across {count} tasks atomically</p>
                            </div>
                        </div>
                    ) : (
                        /* State C: Standard Review Stage */
                        <div className="space-y-4">
                            {/* Summary Banner */}
                            <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-2">
                                <div className="flex items-center justify-between text-xs font-medium">
                                    <span className="text-muted-foreground">{count} tasks selected</span>
                                    {targetLabel && (
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-muted-foreground text-[11px]">
                                                {actionType === 'status' ? 'Target status:' : 'Assignee:'}
                                            </span>
                                            <Badge variant="outline" className="font-semibold text-xs bg-background/60">
                                                {targetLabel}
                                            </Badge>
                                        </div>
                                    )}
                                </div>

                                {isDestructive && (
                                    <div className="pt-2 border-t border-destructive/20 text-destructive text-xs space-y-1 font-medium">
                                        <p>{count} tasks will be permanently deleted from this workspace.</p>
                                        <p className="text-muted-foreground font-normal text-[11px]">
                                            This action cannot be undone. Any linked subtasks will also be removed.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Affected Tasks Snapshot Preview */}
                            <div className="space-y-2">
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                    Affected Tasks ({count})
                                </p>
                                <div className="rounded-xl border border-border/80 divide-y divide-border/60 bg-card overflow-hidden">
                                    {visiblePreviews.map((task) => (
                                        <div key={task.id} className="p-2.5 text-xs text-foreground flex items-center justify-between gap-2">
                                            <span className="truncate font-medium">{task.title}</span>
                                            <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                        </div>
                                    ))}
                                    {remainingCount > 0 && (
                                        <div className="p-2 text-center text-[11px] text-muted-foreground font-medium bg-muted/10">
                                            + {remainingCount} more {remainingCount === 1 ? 'task' : 'tasks'}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Demarcated Modal Footer */}
                <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isExecuting}
                        onClick={onClose}
                        className="rounded-xl border-border/80 text-xs font-semibold px-4 min-h-[40px] sm:min-h-[36px] active:scale-[0.97]"
                    >
                        {hasFailures ? 'Close' : 'Cancel'}
                    </Button>

                    {hasFailures ? (
                        <Button
                            type="button"
                            variant="default"
                            disabled={isExecuting}
                            onClick={handleRetry}
                            className="rounded-xl text-xs font-semibold px-4 min-h-[40px] sm:min-h-[36px] active:scale-[0.97] shadow-sm gap-1.5"
                        >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry Failed Tasks
                        </Button>
                    ) : (
                        <Button
                            type="button"
                            variant={isDestructive ? 'destructive' : 'default'}
                            disabled={isExecuting || count === 0}
                            onClick={handleConfirm}
                            className={cn(
                                "rounded-xl text-xs font-semibold px-4 min-h-[40px] sm:min-h-[36px] active:scale-[0.97] shadow-sm",
                                isDestructive && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            )}
                        >
                            {isExecuting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                            {isDestructive
                                ? `Delete ${count} Tasks`
                                : actionType === 'assign'
                                ? 'Reassign Tasks'
                                : 'Apply Status Update'}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default BulkActionReviewDialog;
