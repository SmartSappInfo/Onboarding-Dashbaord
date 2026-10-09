'use client';

import * as React from 'react';
import type { Task, TaskStatus, UserProfile } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { TaskStatusBadge } from './primitives/TaskStatusBadge';
import { TaskPriorityBadge } from './primitives/TaskPriorityBadge';
import { TaskAssignee } from './primitives/TaskAssignee';
import { TaskDueDate } from './primitives/TaskDueDate';
import { TaskRelationshipBadge } from './primitives/TaskRelationshipBadge';
import { TaskSourceBadge } from './primitives/TaskSourceBadge';
import { TaskChecklistProgress } from './primitives/TaskChecklistProgress';
import { 
    CheckCircle2, 
    Loader2, 
    MessageSquare, 
    Paperclip, 
    MoreVertical, 
    Pencil, 
    Trash2, 
    Clock,
    Bell 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export interface TaskListRowProps {
    task: Task;
    isSimpleView?: boolean;
    isSelectionMode?: boolean;
    isSelected?: boolean;
    isPending?: boolean;
    userMap?: Map<string, UserProfile>;
    onSelect?: (taskId: string) => void;
    onClick?: (task: Task) => void;
    onToggleComplete?: (task: Task) => void | Promise<void>;
    onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
    onEdit?: (task: Task) => void;
    onDelete?: (task: Task) => void;
    onPostpone?: (task: Task, days: number) => void;
    className?: string;
}

/**
 * TaskListRow
 * Accessible, scannable list row component.
 * - Supports both simple view (ultra-compact) and detailed view density modes.
 * - Handles row-level mutation pending states (`Saving...` spinner) and locks concurrent clicks.
 * - Provides >= 44px touch targets on interactive controls.
 * - Never conveys state by color alone.
 */
export function TaskListRow({
    task,
    isSimpleView = false,
    isSelectionMode = false,
    isSelected = false,
    isPending = false,
    userMap,
    onSelect,
    onClick,
    onToggleComplete,
    onStatusChange,
    onEdit,
    onDelete,
    onPostpone,
    className,
}: TaskListRowProps) {
    const isDone = task.status === 'done';

    // Parse assignees from UserMap
    const assignees = React.useMemo(() => {
        if (!userMap || !task.assignedTo) return [];
        const ids = Array.isArray(task.assignedTo) ? task.assignedTo : [task.assignedTo];
        return ids.map(id => userMap.get(id)).filter(Boolean) as UserProfile[];
    }, [task.assignedTo, userMap]);

    const checklistTotal = task.checklist?.length || 0;
    const checklistCompleted = React.useMemo(() => {
        return task.checklist?.filter(c => c.completed).length || 0;
    }, [task.checklist]);
    const remindersCount = task.reminders?.length || 0;

    const handleRowClick = (e: React.MouseEvent) => {
        if (isPending) return;
        // Don't trigger row click if clicking checkbox or buttons
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
            aria-label={task.title}
            aria-disabled={isPending}
            onClick={handleRowClick}
            onKeyDown={handleKeyDown}
            className={cn(
                "group/row relative flex items-center transition-all select-none text-left cursor-pointer",
                isSimpleView
                    ? "px-4 sm:px-6 py-2.5 sm:py-3 gap-3 min-h-[44px]"
                    : "px-4 sm:px-6 py-3.5 sm:py-4 gap-4 min-h-[56px]",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:bg-muted/50 focus-visible:ring-1 focus-visible:ring-primary/40",
                isDone && "opacity-60",
                isPending && "pointer-events-none opacity-50",
                className
            )}
        >
            {/* Selection Checkbox OR Quick Complete Button */}
            <div className="flex items-center justify-center shrink-0 min-h-[44px] min-w-[32px]">
                {isSelectionMode ? (
                    <Checkbox
                        checked={isSelected}
                        disabled={isPending}
                        onCheckedChange={() => onSelect?.(task.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={`Select task: ${task.title}`}
                        className="h-5 w-5 rounded-lg border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                ) : (
                    <button
                        type="button"
                        disabled={isPending}
                        aria-label={isDone ? "Reopen task" : "Mark complete"}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleComplete?.(task);
                        }}
                        className={cn(
                            "h-6 w-6 rounded-full border border-border/80 hover:border-emerald-500 hover:bg-emerald-500/10 flex items-center justify-center transition-all shrink-0 cursor-pointer active:scale-90",
                            isDone && "border-emerald-500 bg-emerald-500/10"
                        )}
                    >
                        {isDone ? (
                            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                            <div className="h-2 w-2 rounded-full bg-transparent group-hover/row:bg-emerald-500/40 transition-colors" />
                        )}
                    </button>
                )}
            </div>

            {/* Inflight Mutation Pending Overlay */}
            {isPending && (
                <div className="absolute inset-y-0 right-4 flex items-center gap-1.5 text-xs font-semibold text-primary z-10 bg-background/90 px-2 py-0.5 rounded-lg border border-primary/20 shadow-sm animate-pulse">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                </div>
            )}

            {/* Main Title & Content */}
            <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2">
                    <h4 className={cn(
                        "text-xs sm:text-sm font-bold text-foreground leading-snug truncate",
                        isDone && "line-through text-muted-foreground"
                    )}>
                        {task.title}
                    </h4>
                    {task.source && task.source !== 'manual' && (
                        <TaskSourceBadge source={task.source} className="hidden sm:inline-flex" />
                    )}
                </div>

                {!isSimpleView && (
                    <div className="flex items-center gap-2.5 mt-1 text-xs text-muted-foreground truncate">
                        {task.entityName && (
                            <TaskRelationshipBadge
                                entityName={task.entityName}
                                entityType={task.entityType}
                                dealId={task.dealId}
                                relatedParentId={task.relatedParentId}
                                relatedEntityId={task.relatedEntityId}
                                relatedEntityType={task.relatedEntityType}
                            />
                        )}
                        {checklistTotal > 0 && (
                            <TaskChecklistProgress
                                completedCount={checklistCompleted}
                                totalCount={checklistTotal}
                            />
                        )}
                        {remindersCount > 0 && (
                            <span 
                                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 shrink-0"
                                title={`${remindersCount} scheduled reminder${remindersCount > 1 ? 's' : ''}`}
                            >
                                <Bell className="h-3 w-3 text-amber-500" />
                                <span className="tabular-nums">{remindersCount}</span>
                            </span>
                        )}
                        {task.notes && task.notes.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 shrink-0">
                                <MessageSquare className="h-3 w-3" />
                                {task.notes.length}
                            </span>
                        )}
                        {task.attachments && task.attachments.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 shrink-0">
                                <Paperclip className="h-3 w-3" />
                                {task.attachments.length}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Status & Priority */}
            <div className="flex items-center gap-2 shrink-0">
                <TaskPriorityBadge priority={task.priority} />
                <TaskStatusBadge
                    status={task.status}
                    interactive={!isPending && !!onStatusChange}
                    onStatusChange={(newStatus) => onStatusChange?.(task.id, newStatus)}
                />
            </div>

            {/* Due Date & Assignee */}
            <div className="hidden md:flex items-center gap-3 shrink-0 min-w-[140px] justify-end">
                <TaskDueDate dueDate={task.dueDate} isDone={isDone} />
                <TaskAssignee assignees={assignees} size="sm" />
            </div>

            {/* Optional Row Action Menu */}
            {(onEdit || onDelete || onPostpone) && (
                <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                disabled={isPending}
                                aria-label="Task options"
                                className="h-8 w-8 rounded-lg opacity-40 hover:opacity-100 focus:opacity-100 transition-opacity"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52 rounded-xl p-1.5 border border-border bg-card text-foreground shadow-2xl">
                            <DropdownMenuLabel className="text-[10px] font-bold text-muted-foreground px-2.5 py-1.5">Task Actions</DropdownMenuLabel>
                            {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(task)} className="rounded-lg p-2 gap-2.5 cursor-pointer">
                                    <Pencil className="h-4 w-4 text-primary" /> <span className="font-semibold text-xs">Edit Task</span>
                                </DropdownMenuItem>
                            )}
                            {onPostpone && (
                                <DropdownMenuSub>
                                    <DropdownMenuSubTrigger className="rounded-lg p-2 gap-2.5 cursor-pointer">
                                        <Clock className="h-4 w-4 text-primary" />
                                        <span className="font-semibold text-xs">Postpone</span>
                                    </DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent className="bg-card border border-border rounded-xl p-1 w-44 shadow-2xl text-foreground">
                                        <DropdownMenuItem onClick={() => onPostpone(task, 1)} className="rounded-lg p-2 text-xs font-semibold cursor-pointer">
                                            Postpone 1 Day
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onPostpone(task, 3)} className="rounded-lg p-2 text-xs font-semibold cursor-pointer">
                                            Postpone 3 Days
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => onPostpone(task, 7)} className="rounded-lg p-2 text-xs font-semibold cursor-pointer">
                                            Postpone 1 Week
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuSub>
                            )}
                            {onDelete && (
                                <>
                                    <DropdownMenuSeparator className="bg-border/60" />
                                    <DropdownMenuItem onClick={() => onDelete(task)} className="text-destructive rounded-lg p-2 gap-2.5 focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                                        <Trash2 className="h-4 w-4" /> <span className="font-semibold text-xs">Delete Task</span>
                                    </DropdownMenuItem>
                                </>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
}
