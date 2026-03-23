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
    Building, 
    Link as LinkIcon,
    Bell,
    ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isPast } from 'date-fns';
import { getTaskInterlinkUrl } from '@/lib/task-actions';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

const PRIORITY_CONFIG: Record<TaskPriority, { color: string, icon: any }> = {
    urgent: { color: 'text-rose-600 bg-rose-50 border-rose-200', icon: ShieldAlert },
    high: { color: 'text-orange-600 bg-orange-50 border-orange-200', icon: AlertTriangle },
    medium: { color: 'text-blue-600 bg-blue-50 border-blue-200', icon: Clock },
    low: { color: 'text-slate-500 bg-slate-50 border-slate-200', icon: Circle }
};

interface TaskCardProps {
    task: Task;
    isOverlay?: boolean;
    onClick?: () => void;
}

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

export default function TaskCard({ task, isOverlay, onClick }: TaskCardProps) {
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
        <div ref={setNodeRef} style={style}>
        <Card 
            onClick={onClick}
            className={cn(
                "group mb-3 rounded-2xl border-border/50 bg-card transition-all duration-300 select-none",
                !isOverlay && "hover:shadow-lg hover:border-primary/20",
                isOverlay && "shadow-2xl border-primary ring-1 ring-primary/20 rotate-2 scale-105 cursor-grabbing",
                isDone && "opacity-60 bg-muted/10"
            )}
        >
            <CardContent className="p-4 space-y-4" {...attributes} {...listeners}>
                <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={cn("text-[7px] font-black uppercase h-4 px-1.5 rounded-sm border-none shadow-xs", P.color)}>
                                <P.icon className="h-2 w-2 mr-1" /> {task.priority}
                            </Badge>
                            {task.reminders?.length > 0 && (
                                <Badge variant="outline" className={cn(
                                    "text-[7px] font-black uppercase h-4 px-1.5 rounded-sm border-none gap-1",
                                    task.reminders.some(r => !r.sent) ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-400"
                                )}>
                                    <Bell className="h-2 w-2" /> {task.reminders.length}
                                </Badge>
                            )}
                        </div>
                        <h4 className={cn("font-black text-xs uppercase tracking-tight leading-tight truncate text-foreground", isDone && "line-through opacity-40")}>
                            {task.title}
                        </h4>
                    </div>
                    <Avatar className="h-6 w-6 border border-white shadow-sm shrink-0">
                        <AvatarImage src={`https://i.pravatar.cc/150?u=${task.assignedTo}`} />
                        <AvatarFallback className="text-[8px] font-black">{getInitials(task.assignedToName)}</AvatarFallback>
                    </Avatar>
                </div>

                <div className="flex flex-col gap-2 pt-1">
                    {task.schoolName && (
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground uppercase tracking-tighter truncate opacity-60">
                            <Building className="h-2.5 w-2.5" /> {task.schoolName}
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <div className={cn(
                            "flex items-center gap-1.5 text-[9px] font-black uppercase tracking-tighter transition-colors",
                            isOverdue ? "text-rose-600 animate-pulse" : isToday(new Date(task.dueDate)) ? "text-orange-600" : "text-muted-foreground/60"
                        )}>
                            <Clock className="h-2.5 w-2.5" />
                            {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                        </div>
                        
                        {interlinkUrl && (
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6 rounded-lg text-primary opacity-0 group-hover:opacity-100 transition-opacity bg-primary/5 border border-primary/10"
                                asChild
                                onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking link
                            >
                                <Link href={interlinkUrl}>
                                    <ArrowRight className="h-3 w-3" />
                                </Link>
                            </Button>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
        </div>
    );
}
