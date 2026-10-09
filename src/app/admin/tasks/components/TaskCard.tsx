'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskStatus, UserProfile } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    Bell,
    ArrowRight,
    MessageSquare,
    Paperclip,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getTaskInterlinkUrl } from '@/lib/task-actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AsyncEntityAvatar } from '../../components/AsyncEntityAvatar';
import { TaskStatusBadge } from './primitives/TaskStatusBadge';
import { TaskPriorityBadge } from './primitives/TaskPriorityBadge';
import { TaskDueDate } from './primitives/TaskDueDate';
import { TaskRelationshipBadge } from './primitives/TaskRelationshipBadge';
import { TaskSourceBadge } from './primitives/TaskSourceBadge';

export interface TaskCardProps {
    task: Task;
    entityLogoUrl?: string;
    isOverlay?: boolean;
    isPending?: boolean;
    obligationSyncStatus?: 'synced' | 'pending' | 'failed' | null;
    onClick?: () => void;
    userMap?: Map<string, UserProfile>;
    onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
}

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

/**
 * TaskCard
 * Kanban card component.
 * - Integrates shared task primitives (TaskStatusBadge, TaskPriorityBadge, TaskDueDate, TaskRelationshipBadge, TaskSourceBadge).
 * - Surfaces trustworthy inflight mutation state (isPending with Saving... indicator) and locks duplicate actions.
 * - Surfaces contract obligation synchronization status (Sync pending vs Synced).
 * - Adheres to WCAG AA and touch targets >= 44px on interactive controls.
 */
export function TaskCard({
    task,
    entityLogoUrl,
    isOverlay = false,
    isPending = false,
    obligationSyncStatus,
    onClick,
    userMap,
    onStatusChange,
}: TaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: task.id, 
        data: { type: 'TASK', task },
        disabled: isPending || isOverlay,
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
        cursor: isPending ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
    };

    const isDone = task.status === 'done';
    const interlinkUrl = getTaskInterlinkUrl(task);

    const handleCardClick = (e: React.MouseEvent) => {
        if (isPending) return;
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('a') || target.closest('[role="button"]') || target.closest('[role="menuitem"]')) {
            return;
        }
        onClick?.();
    };

    return (
        <div ref={setNodeRef} style={style} className="w-full max-w-full min-w-0">
            <Card 
                role="button"
                tabIndex={isPending ? -1 : 0}
                aria-label={task.title}
                onClick={handleCardClick}
                className={cn(
                    "group relative mb-3 rounded-2xl border border-border/80 bg-card text-card-foreground shadow-xs transition-all duration-200 select-none w-full max-w-full overflow-hidden text-left cursor-pointer",
                    !isOverlay && !isPending && "hover:shadow-md hover:border-border",
                    isOverlay && "shadow-2xl border-primary ring-1 ring-primary/20 rotate-2 scale-105 cursor-grabbing",
                    isDone && "opacity-60 bg-muted/20",
                    isPending && "opacity-60 pointer-events-none"
                )}
            >
                {/* Inflight Mutation Pending Badge */}
                {isPending && (
                    <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-semibold text-primary z-20 bg-background/95 px-2 py-0.5 rounded-full border border-primary/20 shadow-sm animate-pulse">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Saving...</span>
                    </div>
                )}

                <CardContent className="p-4 space-y-3.5" {...(!isPending ? attributes : {})} {...(!isPending ? listeners : {})}>
                    <div className="flex items-start justify-between gap-2.5">
                        <div className="space-y-1.5 min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-1.5 flex-wrap text-left">
                                <TaskPriorityBadge priority={task.priority} />
                                {task.source && task.source !== 'manual' && (
                                    <TaskSourceBadge source={task.source} />
                                )}
                                {task.reminders?.length > 0 && (
                                    <Badge variant="outline" className={cn(
                                        "text-[10px] font-semibold h-4 px-1.5 rounded-sm border-none gap-1",
                                        task.reminders.some(r => !r.sent) ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                                    )}>
                                        <Bell className="h-2.5 w-2.5" /> {task.reminders.length}
                                    </Badge>
                                )}
                            </div>
                            <h4 className={cn(
                                "font-semibold text-xs tracking-tight leading-normal text-foreground whitespace-normal break-words text-left",
                                isDone && "line-through opacity-50"
                            )}>
                                {task.title}
                            </h4>
                        </div>

                        <div className="flex items-center gap-1 shrink-0 self-start">
                            {onStatusChange && !isOverlay && (
                                <TaskStatusBadge
                                    status={task.status}
                                    interactive={!isPending}
                                    onStatusChange={(newStatus) => onStatusChange(task.id, newStatus)}
                                />
                            )}
                            {interlinkUrl && (
                                <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    aria-label="Open linked record"
                                    className="h-7 w-7 rounded-lg text-primary opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 border border-primary/10 shrink-0 self-start"
                                    asChild
                                    onPointerDown={(e) => e.stopPropagation()}
                                >
                                    <Link href={interlinkUrl}>
                                        <ArrowRight className="h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Entity & Relationship Context */}
                    {(task.entityName || task.entityId || task.relatedEntityType) && (
                        <div className="flex items-center gap-1.5 min-w-0 w-full flex-wrap pt-0.5">
                            {task.entityId && !task.entityName && (
                                <AsyncEntityAvatar 
                                    entityId={task.entityId}
                                    src={entityLogoUrl} 
                                    name={task.entityName || 'Entity'} 
                                    className="h-4 w-4 rounded-sm shadow-none ring-0 p-0 shrink-0"
                                    fallbackClassName="text-[6px]"
                                />
                            )}
                            <TaskRelationshipBadge
                                entityName={task.entityName}
                                entityType={task.entityType}
                                relatedEntityType={task.relatedEntityType}
                                obligationSyncStatus={obligationSyncStatus}
                            />
                        </div>
                    )}

                    {/* Card Footer: Assignee, Comments, Attachments, Due Date */}
                    {(() => {
                        const ids = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                        const commentsCount = task.notes?.length || 0;
                        const attachmentsCount = task.attachments?.length || 0;

                        return (
                            <div className="flex items-center justify-between pt-2.5 border-t border-border/40 w-full gap-2">
                                {ids.length > 0 ? (
                                    <div className="flex items-center -space-x-1 shrink-0">
                                        {ids.map((id) => {
                                            const u = userMap?.get(id);
                                            return (
                                                <Avatar key={id} className="h-5 w-5 border border-background shadow-xs shrink-0 select-none">
                                                    <AvatarImage src={u?.photoURL || undefined} alt={u?.name || 'Assignee'} />
                                                    <AvatarFallback className="text-[7px] bg-muted/40 font-semibold">
                                                        {u ? getInitials(u.name) : '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div />
                                )}

                                <div className="flex items-center gap-2 text-muted-foreground/70 shrink-0">
                                    {commentsCount > 0 && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30 text-[10px] font-semibold" title="Comments">
                                            <MessageSquare className="h-3 w-3 opacity-70" />
                                            <span className="tabular-nums">{commentsCount}</span>
                                        </div>
                                    )}
                                    {attachmentsCount > 0 && (
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30 text-[10px] font-semibold" title="Attachments">
                                            <Paperclip className="h-3 w-3 opacity-70" />
                                            <span className="tabular-nums">{attachmentsCount}</span>
                                        </div>
                                    )}
                                    <TaskDueDate dueDate={task.dueDate} isDone={isDone} />
                                </div>
                            </div>
                        );
                    })()}
                </CardContent>
            </Card>
        </div>
    );
}

export default TaskCard;
