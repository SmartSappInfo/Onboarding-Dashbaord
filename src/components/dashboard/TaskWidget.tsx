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
    
    const rawTasks = initialTasks || fetchedTasks;
    const isLoading = initialTasks ? false : isFetching;

    const tasks = React.useMemo(() => {
        if (!rawTasks) return null;
        return rawTasks.map(task => {
            const dueDateObj = new Date(task.dueDate);
            return {
                ...task,
                dueDateObj,
                isOverdue: isPast(dueDateObj) && !isToday(dueDateObj),
                isTodayDue: isToday(dueDateObj),
                isUrgent: task.priority === 'urgent' || task.priority === 'high'
            };
        });
    }, [rawTasks]);

    const handleComplete = (id: string) => {
        if (firestore) completeTaskNonBlocking(firestore, id);
    };

    return (
        <DashboardCard 
            title="Urgent Tasks" 
            terminology={terminology}
        >
            <div className="space-y-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 w-full bg-muted/20 animate-pulse rounded-2xl" />
                    ))
                ) : tasks && tasks.length > 0 ? (
                    <div className="space-y-3">
                        {tasks.map((task) => {
                            return (
                                <div key={task.id} className={cn(
                                    "group flex items-center gap-4 p-3.5 rounded-[1.2rem] border transition-all duration-300",
                                    task.isUrgent ? "bg-rose-500/5 border-rose-500/20 shadow-[0_0_15px_rgba(225,29,72,0.05)]" : "bg-black/[0.02] dark:bg-white/[0.02] border-transparent hover:border-black/5 dark:hover:border-white/10 hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                                )}>
                                    <button 
                                        onClick={() => handleComplete(task.id)}
                                        className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                                    >
                                        <Circle className="h-5 w-5" />
                                    </button>
                                    
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-sm font-medium truncate leading-none">{task.title}</p>
                                            {task.isUrgent && <Zap className="h-3 w-3 text-rose-600 animate-pulse" />}
                                        </div>
                                        
                                        <div className="flex items-center gap-3">
                                            <div className={cn(
                                                "flex items-center gap-1 text-[9px] font-medium tracking-tighter transition-colors",
                                                task.isOverdue ? "text-rose-600" : task.isTodayDue ? "text-orange-600" : "text-muted-foreground opacity-60"
                                            )}>
                                                <Clock className="h-2.5 w-2.5" />
                                                {task.isTodayDue ? 'Today' : task.isOverdue ? 'Overdue' : format(task.dueDateObj, 'MMM d')}
                                            </div>
                                            {task.entityName && (
                                                <span className="text-[9px] font-medium text-muted-foreground opacity-40 truncate">
                                                    {task.entityName}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="shrink-0">
                                        {task.isUrgent ? (
                                            <Badge className="bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border-rose-500/20 shadow-none text-[7px] font-semibold h-4 px-1.5 capitalize">{task.priority}</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-[7px] font-medium h-4 px-1.5 border-black/10 dark:border-white/20 text-muted-foreground capitalize">{task.category}</Badge>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 text-center flex flex-col items-center gap-4 rounded-[1.5rem] bg-gradient-to-b from-emerald-500/5 to-transparent border border-emerald-500/10 shadow-[inset_0_1px_0_rgba(16,185,129,0.1)] relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15),transparent_50%)]" />
                        <div className="relative">
                            <div className="absolute inset-0 bg-emerald-500/20 blur-xl rounded-full animate-pulse" />
                            <CheckCircle2 className="h-10 w-10 text-emerald-500 relative z-10" />
                        </div>
                        <p className="text-[10px] font-medium tracking-[0.05em] leading-none text-emerald-600/80 dark:text-emerald-400/80 relative z-10">All Missions Resolved</p>
                    </div>
                )}

                <Button variant="outline" asChild className="w-full rounded-xl font-medium h-10 border-primary/10 hover:bg-primary/5 hover:text-primary transition-all group mt-2">
                    <Link href="/admin/tasks">
                        Command Hub
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </DashboardCard>
    );
}
