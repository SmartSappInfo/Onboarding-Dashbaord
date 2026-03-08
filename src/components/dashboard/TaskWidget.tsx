'use client';

import * as React from 'react';
import DashboardCard from "./DashboardCard";
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Task } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isToday, isPast } from 'date-fns';
import { CheckCircle2, Circle, Clock, ArrowRight, ShieldAlert, AlertTriangle } from 'lucide-react';
import { completeTaskNonBlocking } from '@/lib/task-actions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export function TaskWidget() {
    const firestore = useFirestore();
    const { user } = useUser();

    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'tasks'),
            where('assignedTo', '==', user.uid),
            where('status', '!=', 'completed'),
            orderBy('status'),
            orderBy('dueDate', 'asc'),
            limit(5)
        );
    }, [firestore, user]);

    const { data: tasks, isLoading } = useCollection<Task>(tasksQuery);

    const handleComplete = (id: string) => {
        if (firestore) completeTaskNonBlocking(firestore, id);
    };

    return (
        <DashboardCard title="Personal Action Items" description="Your high-priority interventions due today.">
            <div className="space-y-4">
                {isLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-16 w-full bg-muted animate-pulse rounded-xl" />
                    ))
                ) : tasks && tasks.length > 0 ? (
                    <div className="space-y-3">
                        {tasks.map((task) => (
                            <div key={task.id} className="group flex items-center gap-4 p-3 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white transition-all shadow-sm">
                                <button 
                                    onClick={() => handleComplete(task.id)}
                                    className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                                >
                                    <Circle className="h-5 w-5" />
                                </button>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-black uppercase tracking-tight truncate leading-none mb-1.5">{task.title}</p>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "flex items-center gap-1 text-[9px] font-black uppercase tracking-tighter",
                                            isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) ? "text-rose-600" : "text-muted-foreground opacity-60"
                                        )}>
                                            <Clock className="h-2.5 w-2.5" />
                                            {isToday(new Date(task.dueDate)) ? 'Today' : format(new Date(task.dueDate), 'MMM d')}
                                        </div>
                                        {task.schoolName && (
                                            <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 truncate">
                                                {task.schoolName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="shrink-0">
                                    {task.priority === 'critical' || task.priority === 'high' ? (
                                        <ShieldAlert className="h-4 w-4 text-rose-500 animate-pulse" />
                                    ) : null}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-12 text-center flex flex-col items-center gap-3 opacity-30">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                        <p className="text-xs font-black uppercase tracking-widest">Clear for landing</p>
                    </div>
                )}

                <Button variant="outline" asChild className="w-full rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5 hover:text-primary transition-all group mt-2">
                    <Link href="/admin/tasks">
                        Open Task Hub
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </DashboardCard>
    );
}
