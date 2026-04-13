
'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import TaskCard from './TaskCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Layers, CheckCircle2, Clock, PlayCircle, Hourglass } from 'lucide-react';

const STATUS_CONFIG: Record<TaskStatus, { label: string, color: string, icon: any }> = {
    todo: { label: 'Backlog', color: 'border-t-slate-400', icon: Layers },
    in_progress: { label: 'In Progress', color: 'border-t-blue-500', icon: PlayCircle },
    waiting: { label: 'Waiting', color: 'border-t-orange-400', icon: Hourglass },
    review: { label: 'Review', color: 'border-t-purple-500', icon: Clock },
    done: { label: 'Resolved', color: 'border-t-emerald-500', icon: CheckCircle2 }
};

interface TaskColumnProps {
    status: TaskStatus;
    tasks: Task[];
    onTaskClick: (task: Task) => void;
}

export default function TaskColumn({ status, tasks, onTaskClick }: TaskColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: status,
        data: { type: 'COLUMN', status }
    });

    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
 <div ref={setNodeRef} className="h-full w-72 flex-shrink-0 flex flex-col">
 <Card className={cn(
                "h-full flex flex-col bg-muted/30 border-none ring-1 ring-border rounded-[2rem] overflow-hidden transition-all duration-300",
                isOver && "ring-primary bg-primary/5 shadow-2xl",
                "border-t-4",
                config.color
            )}>
 <CardHeader className="p-5 pb-3 shrink-0 flex flex-row items-center justify-between">
 <div className="flex items-center gap-3">
 <div className="p-2 bg-card rounded-xl shadow-sm">
 <Icon className="h-4 w-4 text-muted-foreground" />
                        </div>
 <CardTitle className="text-xs font-semibold text-foreground/80">{config.label}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="rounded-full h-5 font-semibold tabular-nums border-none shadow-inner">{tasks.length}</Badge>
                </CardHeader>
                
 <ScrollArea className="flex-1">
 <CardContent className="p-3">
                        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                            {tasks.map(task => (
                                <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
                            ))}
                        </SortableContext>
                        
                        {tasks.length === 0 && !isOver && (
 <div className="py-20 text-center opacity-10 flex flex-col items-center gap-3">
                                <Icon size={32} />
 <span className="text-[10px] font-semibold ">Pipe Clear</span>
                            </div>
                        )}
                    </CardContent>
                </ScrollArea>
            </Card>
        </div>
    );
}
