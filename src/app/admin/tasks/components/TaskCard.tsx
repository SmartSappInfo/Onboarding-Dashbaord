'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task, TaskPriority } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
    Clock, 
    AlertTriangle, 
    ShieldAlert, 
    Circle, 
    Building2, 
    Link as LinkIcon,
    Bell,
    ArrowRight,
    MessageSquare,
    Paperclip
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isPast } from 'date-fns';
import { getTaskInterlinkUrl } from '@/lib/task-actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getProgressValue } from './task-utils';

const PRIORITY_CONFIG: Record<TaskPriority, { color: string, icon: any }> = {
    urgent: { color: 'text-rose-600 bg-rose-50 border-rose-200', icon: ShieldAlert },
    high: { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
    medium: { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    low: { color: 'text-slate-500 bg-muted/10 border-slate-200', icon: Circle }
};

import { AsyncEntityAvatar } from '../../components/AsyncEntityAvatar';

interface TaskCardProps {
    task: Task;
    entityLogoUrl?: string;
    isOverlay?: boolean;
    onClick?: () => void;
    userMap?: Map<string, any>;
}

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

export default function TaskCard({ task, entityLogoUrl, isOverlay, onClick, userMap }: TaskCardProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: task.id, 
        data: { type: 'TASK', task } 
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging && !isOverlay ? 0.3 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
    };

    const P = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
    const isDone = task.status === 'done';
    const isOverdue = isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && !isDone;
    const interlinkUrl = getTaskInterlinkUrl(task);

    return (
        <div ref={setNodeRef} style={style} className="w-full max-w-full min-w-0">
        <Card 
            onClick={onClick}
            className={cn(
                "group mb-3 rounded-2xl border-border/50 bg-card transition-all duration-300 select-none w-full max-w-full overflow-hidden",
                !isOverlay && "hover:shadow-lg hover:border-primary/20",
                isOverlay && "shadow-2xl border-primary ring-1 ring-primary/20 rotate-2 scale-105 cursor-grabbing",
                isDone && "opacity-60 bg-background"
            )}
        >
            <CardContent className="p-4 space-y-4" {...attributes} {...listeners}>
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0 flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap text-left">
                            <Badge variant="outline" className={cn("text-[7px] font-semibold uppercase h-4 px-1.5 rounded-sm border-none shadow-xs", P.color)}>
                                <P.icon className="h-2.5 w-2.5 mr-1" /> {task.priority}
                            </Badge>
                            {task.reminders?.length > 0 && (
                                <Badge variant="outline" className={cn(
                                    "text-[7px] font-semibold uppercase h-4 px-1.5 rounded-sm border-none gap-1",
                                    task.reminders.some(r => !r.sent) ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                                )}>
                                    <Bell className="h-2 w-2" /> {task.reminders.length}
                                </Badge>
                            )}
                        </div>
                        <h4 className={cn("font-semibold text-xs tracking-tight leading-normal text-foreground whitespace-normal break-words text-left", isDone && "line-through opacity-40")}>
                            {task.title}
                        </h4>
                    </div>
                    {interlinkUrl && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-lg text-primary opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 border border-primary/10 shrink-0 self-start"
                            asChild
                            onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking link
                        >
                            <Link href={interlinkUrl}>
                                <ArrowRight className="h-3 w-3" />
                            </Link>
                        </Button>
                    )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                    {(task.entityName || task.entityId) && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground tracking-tighter opacity-60 min-w-0 w-full">
                            <AsyncEntityAvatar 
                                entityId={task.entityId}
                                src={entityLogoUrl} 
                                name={task.entityName || 'Entity'} 
                                className="h-4 w-4 rounded-sm shadow-none ring-0 p-0 shrink-0"
                                fallbackClassName="text-[6px]"
                            /> 
                            <span className="truncate flex-1">
                                {task.entityName || 'Entity'}
                            </span>
                            {task.entityType && (
                                <Badge variant="outline" className="text-[7px] font-semibold uppercase h-3.5 px-1 rounded-sm border-none bg-primary/10 text-primary ml-1 shrink-0">
                                    {task.entityType}
                                </Badge>
                            )}
                        </div>
                    )}
                    
                    {(() => {
                        const ids = Array.isArray(task.assignedTo) ? task.assignedTo : (task.assignedTo ? [task.assignedTo] : []);
                        const commentsCount = task.notes?.length || 0;
                        const attachmentsCount = task.attachments?.length || 0;

                        return (
                            <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-border/40 w-full">
                                {ids.length > 0 ? (
                                    <div className="flex items-center -space-x-1 shrink-0">
                                        {ids.map((id) => {
                                            const u = userMap?.get(id);
                                            return (
                                                <Avatar key={id} className="h-5 w-5 border border-background shadow-xs shrink-0 select-none">
                                                    <AvatarImage src={u?.photoURL || undefined} />
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

                                <div className="flex items-center gap-2 text-muted-foreground/60 shrink-0">
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30 text-[9px] font-semibold" title="Comments">
                                        <MessageSquare className="h-3 w-3 opacity-60" />
                                        <span className="tabular-nums">{commentsCount}</span>
                                    </div>
                                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/30 text-[9px] font-semibold" title="Attachments">
                                        <Paperclip className="h-3 w-3 opacity-60" />
                                        <span className="tabular-nums">{attachmentsCount}</span>
                                    </div>
                                    <div className={cn(
                                        "flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-tighter transition-colors ml-1",
                                        isOverdue ? "text-rose-600 animate-pulse font-bold" : isToday(new Date(task.dueDate)) ? "text-orange-600 font-bold" : "text-muted-foreground/60"
                                    )}>
                                        <Clock className="h-3 w-3" />
                                        {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            </CardContent>
        </Card>
        </div>
    );
}
