'use client';

/**
 * @fileOverview CompactTaskCard Component
 *
 * Universal canonical cross-module task presentation component conforming to
 * Roadmap §77 and UI Spec Phase 5:
 * - High-density layout displaying task title, status, priority, due date, assignee, and relationship.
 * - Mobile-first touch targets: >= 44px on interactive controls.
 * - Emil Kowalski tactile micro-interactions (`active:scale-[0.97]`).
 * - Downstream contract obligation synchronization failure alert and inline retry affordance (Roadmap §78).
 * - Full keyboard navigation (Enter & Space) and screen reader accessibility.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import { CheckCircle2, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TaskPriorityBadge } from './primitives/TaskPriorityBadge';
import { TaskStatusBadge } from './primitives/TaskStatusBadge';
import { TaskDueDate } from './primitives/TaskDueDate';
import { TaskAssignee } from './primitives/TaskAssignee';
import { TaskRelationshipBadge } from './primitives/TaskRelationshipBadge';
import { TaskSourceBadge } from './primitives/TaskSourceBadge';
import { TaskChecklistProgress } from './primitives/TaskChecklistProgress';
import type { Task, UserProfile } from '@/lib/types';
import { cn } from '@/lib/utils';

export interface CompactTaskCardProps {
  task: Task;
  onToggleComplete?: (task: Task) => void;
  onClick?: (task: Task) => void;
  onRetrySync?: (taskId: string) => void;
  isPending?: boolean;
  isRetryingSync?: boolean;
  userMap?: Map<string, UserProfile>;
  showRelationship?: boolean;
  className?: string;
}

export function CompactTaskCard({
  task,
  onToggleComplete,
  onClick,
  onRetrySync,
  isPending = false,
  isRetryingSync = false,
  userMap,
  showRelationship = true,
  className,
}: CompactTaskCardProps) {
  const isDone = task.status === 'done';
  const hasSyncFailed = task.obligationSyncStatus === 'failed';

  const assignees = React.useMemo(() => {
    if (!userMap || !task.assignedTo) return [];
    const ids = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
    return ids.map((id) => userMap.get(id)).filter(Boolean) as UserProfile[];
  }, [task.assignedTo, userMap]);

  const checklistTotal = task.checklist?.length || 0;
  const checklistCompleted = React.useMemo(() => {
    return task.checklist?.filter((c) => c.completed).length || 0;
  }, [task.checklist]);

  const handleCardClick = (e: React.MouseEvent) => {
    if (isPending) return;
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('a')) {
      return;
    }
    onClick?.(task);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isPending) return;
    if (e.key === 'Enter' || e.key === ' ') {
      const target = e.target as HTMLElement;
      if (target.closest('button') || target.closest('[role="checkbox"]') || target.closest('a')) {
        return;
      }
      e.preventDefault();
      onClick?.(task);
    }
  };

  return (
    <div
      role="button"
      tabIndex={isPending ? -1 : 0}
      aria-label={`Task: ${task.title}`}
      aria-disabled={isPending}
      onClick={handleCardClick}
      onKeyDown={handleKeyDown}
      className={cn(
        "group relative flex flex-col p-3.5 sm:p-4 rounded-xl border border-border/70 bg-card hover:bg-muted/30 transition-all select-none text-left cursor-pointer",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        "active:scale-[0.97] duration-150",
        isDone && "opacity-65",
        isPending && "pointer-events-none opacity-50",
        className
      )}
    >
      {/* Top Row: Complete Checkbox / Circle + Title + Priority */}
      <div className="flex items-start gap-3 justify-between">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          {/* Accessible 44px touch target toggle button */}
          <button
            type="button"
            disabled={isPending}
            aria-label={isDone ? 'Reopen task' : 'Mark complete'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete?.(task);
            }}
            className={cn(
              "flex items-center justify-center shrink-0 min-h-[44px] min-w-[44px] -ml-2 -mt-2.5 rounded-full cursor-pointer transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              isPending && "pointer-events-none opacity-50"
            )}
          >
            <span
              className={cn(
                "h-6 w-6 rounded-full border border-border/90 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all shrink-0",
                isDone && "border-emerald-500 bg-emerald-500/10 text-emerald-600"
              )}
            >
              {isDone && <CheckCircle2 className="h-4 w-4" />}
            </span>
          </button>

          <div className="min-w-0 flex-1 pt-0.5">
            <h4
              className={cn(
                "text-xs sm:text-sm font-semibold tracking-tight leading-snug text-foreground break-words",
                isDone && "line-through opacity-70"
              )}
            >
              {task.title}
            </h4>

            {/* Secondary Metadata Row */}
            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] text-muted-foreground">
              <TaskStatusBadge status={task.status} />
              <TaskDueDate dueDate={task.dueDate} isDone={isDone} />
              {assignees.length > 0 && <TaskAssignee assignees={assignees} size="sm" />}
              {checklistTotal > 0 && (
                <TaskChecklistProgress
                  completedCount={checklistCompleted}
                  totalCount={checklistTotal}
                />
              )}
            </div>
          </div>
        </div>

        {/* Priority & Source Badges */}
        <div className="flex items-center gap-1.5 shrink-0 self-start">
          <TaskPriorityBadge priority={task.priority} />
          {task.source && task.source !== 'manual' && (
            <TaskSourceBadge source={task.source} />
          )}
        </div>
      </div>

      {/* Tertiary Row: Relationship Badges */}
      {showRelationship && (task.entityName || task.dealId || task.relatedEntityType) && (
        <div className="mt-2.5 pt-2 border-t border-border/40 flex items-center gap-2 flex-wrap">
          <TaskRelationshipBadge
            entityId={task.entityId}
            entityName={task.entityName}
            entityType={task.entityType}
            relatedEntityType={task.relatedEntityType}
            relatedParentId={task.relatedParentId}
            relatedEntityId={task.relatedEntityId}
            dealId={task.dealId}
            obligationSyncStatus={task.obligationSyncStatus}
          />
        </div>
      )}

      {/* Contract Obligation Sync Failure Recovery Alert (Roadmap §78) */}
      {hasSyncFailed && (
        <div className="mt-2.5 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span className="text-[11px] font-medium truncate">
              Contract obligation sync failed.
            </span>
          </div>
          {onRetrySync && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={isRetryingSync}
              aria-label="Retry sync"
              onClick={(e) => {
                e.stopPropagation();
                onRetrySync(task.id);
              }}
              className="h-7 min-h-[44px] sm:min-h-[28px] px-2.5 rounded-md text-[10px] font-semibold gap-1 text-rose-700 border-rose-300 hover:bg-rose-100 dark:text-rose-300 dark:border-rose-800 dark:hover:bg-rose-900/40 active:scale-[0.97]"
            >
              {isRetryingSync ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              <span>Retry</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default CompactTaskCard;
