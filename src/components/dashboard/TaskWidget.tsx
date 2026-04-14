'use client';

import * as React from 'react';
import DashboardCard from "./DashboardCard";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isToday, isPast } from 'date-fns';
import { CheckCircle2, Circle, Clock, ArrowRight, ShieldAlert, Zap } from 'lucide-react';
import { completeTaskNonBlocking } from '@/lib/task-actions';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useTenant } from '@/context/TenantContext';

/**
 * @fileOverview Remodeled Task Widget: "Critical Focus".
 * Contextualized to the active workspace.
 */
export function TaskWidget({ 
    initialTasks,
    terminology = { singular: 'Entity', plural: 'Entities' } 
}: { 
    initialTasks?: Task[],
    terminology?: { singular: string, plural: string } 
}) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useTenant();

    // Query for unresolved tasks strictly within this workspace
    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || initialTasks) return null;
        return query(
            collection(firestore, 'tasks'),
            where('workspaceId', '==', activeWorkspaceId),
            where('status', '!=', 'done'),
            orderBy('status'), 
            orderBy('dueDate', 'asc'),
            limit(5)
        );
    }, [firestore, activeWorkspaceId, initialTasks]);

    const { data: fetchedTasks, isLoading: isFetching } = useCollection<Task>(tasksQuery);
    
    const tasks = initialTasks || fetchedTasks;
    const isLoading = initialTasks ? false : isFetching;

    const handleComplete = (id: string) => {
        if (firestore) completeTaskNonBlocking(firestore, id);
    };

    return (
        <DashboardCard 
            title="Critical Focus" 
            description="Active protocols requiring immediate intervention in this hub."
        >
            <div className="space-y-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-[1.25rem]" />
                    ))
                ) : tasks && tasks.length > 0 ? (
                    <div className="space-y-3">
                        {tasks.map((task) => {
                            const isOverdue = isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate));
                            const isTodayDue = isToday(new Date(task.dueDate));
                            const isUrgent = task.priority === 'urgent' || task.priority === 'high';

                            return (
                                <div key={task.id} className={cn(
                                    "group flex items-center gap-4 p-3.5 rounded-2xl border transition-all duration-300",
                                    isUrgent ? "bg-rose-50/30 border-rose-100 shadow-sm" : "bg-muted/20 border-transparent hover:border-primary/20 hover:bg-white"
                                )}>
                                    <button 
                                        onClick={() => handleComplete(task.id)}
                                        className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                                    >
                                        <Circle className="h-5 w-5" />
                                    </button>
                                    
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-black uppercase tracking-tight truncate leading-none">{task.title}</p>
                                            {isUrgent && <Zap className="h-3 w-3 text-rose-600 animate-pulse" />}
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter transition-colors",
                                                isOverdue ? "text-rose-600" : isTodayDue ? "text-orange-600" : "text-muted-foreground opacity-60"
                                            )}>
                                                <Clock className="h-2.5 w-2.5" />
                                                {isTodayDue ? 'Today' : isOverdue ? 'Overdue' : format(new Date(task.dueDate), 'MMM d')}
                                            </div>
                                            {task.entityName && (
                                                <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 truncate">
                                                    {task.entityName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="shrink-0">
                                        {isUrgent ? (
                                            <Badge className="bg-rose-600 border-none text-[7px] font-black h-4 px-1">{task.priority}</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[7px] font-bold h-4 px-1">{task.category}</Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center flex flex-col items-center gap-3 opacity-20 border-2 border-dashed rounded-[2rem] bg-muted/10">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none">All Missions Resolved</p>
                    </div>
                )}

                <Button variant="outline" asChild className="w-full rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5 hover:text-primary transition-all group mt-2">
                    <Link href="/admin/tasks">
                        Command Hub
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </DashboardCard>
    );
}
