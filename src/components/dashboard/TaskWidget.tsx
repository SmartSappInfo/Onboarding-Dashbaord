'use client';

/**
 * @fileOverview Remodeled Task Widget: "Critical Focus".
 * Standardized with canonical CompactTaskCard, limit(10) bound,
 * and downstream contract obligation recovery affordances (Roadmap §77, §78).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import * as React from 'react';
import DashboardCard from "./DashboardCard";
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Task, UserProfile } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { updateTaskAction, retryTaskObligationSyncAction } from '@/lib/task-server-actions';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTenant } from '@/context/TenantContext';
import { CompactTaskCard } from '@/app/admin/tasks/components/CompactTaskCard';

export function TaskWidget({ 
    initialTasks,
    terminology = { singular: 'Entity', plural: 'Entities' } 
}: { 
    initialTasks?: Task[],
    terminology?: { singular: string, plural: string } 
}) {
    const firestore = useFirestore();
    const router = useRouter();
    const { activeWorkspaceId } = useTenant();
    const { toast } = useToast();

    // Query for unresolved tasks strictly within this workspace (Roadmap §77: limit 10)
    const tasksQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || initialTasks) return null;
        try {
            return query(
                collection(firestore, 'tasks'),
                where('workspaceId', '==', activeWorkspaceId),
                where('status', '!=', 'done'),
                orderBy('status'), 
                orderBy('dueDate', 'asc'),
                limit(10)
            );
        } catch {
            return null;
        }
    }, [firestore, activeWorkspaceId, initialTasks]);

    // Users query to resolve assignees for CompactTaskCard
    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        try {
            return query(
                collection(firestore, 'users'),
                where('workspaceId', '==', activeWorkspaceId)
            );
        } catch {
            return null;
        }
    }, [firestore, activeWorkspaceId]);

    const { data: fetchedTasks, isLoading: isFetching } = useCollection<Task>(tasksQuery);
    const { data: fetchedUsers } = useCollection<UserProfile>(usersQuery);

    const userMap = React.useMemo(() => {
        const map = new Map<string, UserProfile>();
        fetchedUsers?.forEach((u) => map.set(u.id, u));
        return map;
    }, [fetchedUsers]);
    
    const rawTasks = initialTasks || fetchedTasks;
    const isLoading = initialTasks ? false : isFetching;

    // Track optimistic updates
    const [optimisticOverrides, setOptimisticOverrides] = React.useState<Record<string, Partial<Task>>>({});
    const [pendingIds, setPendingIds] = React.useState<Set<string>>(new Set());
    const [retryingSyncIds, setRetryingSyncIds] = React.useState<Set<string>>(new Set());

    const tasks = React.useMemo(() => {
        if (!rawTasks) return null;
        return rawTasks
            .map((task) => {
                const override = optimisticOverrides[task.id];
                return override ? { ...task, ...override } : task;
            })
            .filter((task) => task.status !== 'done');
    }, [rawTasks, optimisticOverrides]);

    const handleToggleComplete = async (task: Task) => {
        const nextStatus = task.status === 'done' ? 'todo' : 'done';
        
        // Apply optimistic update immediately
        setOptimisticOverrides((prev) => ({
            ...prev,
            [task.id]: { status: nextStatus },
        }));
        setPendingIds((prev) => new Set(prev).add(task.id));

        try {
            const res = await updateTaskAction(task.id, { status: nextStatus });
            if (res.success) {
                toast({
                    title: nextStatus === 'done' ? 'Task Completed' : 'Task Reopened',
                    description: nextStatus === 'done' ? 'Task marked as resolved.' : 'Task marked as unresolved.',
                });
            } else {
                // Revert optimistic override on server failure
                setOptimisticOverrides((prev) => {
                    const next = { ...prev };
                    delete next[task.id];
                    return next;
                });
                toast({
                    variant: 'destructive',
                    title: 'Update Failed',
                    description: res.error || 'Failed to complete task in this workspace.',
                    actionConfig: {
                        path: '/admin/settings/permissions',
                        label: 'Check Permissions',
                    },
                });
            }
        } catch (err: unknown) {
            setOptimisticOverrides((prev) => {
                const next = { ...prev };
                delete next[task.id];
                return next;
            });
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: err instanceof Error ? err.message : 'An unexpected error occurred.',
            });
        } finally {
            setPendingIds((prev) => {
                const next = new Set(prev);
                next.delete(task.id);
                return next;
            });
        }
    };

    const handleRetrySync = async (taskId: string) => {
        if (!activeWorkspaceId) return;
        const targetTask = rawTasks?.find((t) => t.id === taskId);
        setRetryingSyncIds((prev) => new Set(prev).add(taskId));
        try {
            const res = await retryTaskObligationSyncAction(activeWorkspaceId, taskId, targetTask?.updatedAt);
            if (res.success) {
                // Optimistically clear failed status
                setOptimisticOverrides((prev) => ({
                    ...prev,
                    [taskId]: { obligationSyncStatus: 'synced', obligationSyncError: undefined },
                }));
                toast({
                    title: 'Sync Succeeded',
                    description: res.message || 'Downstream contract obligation synchronized successfully.',
                });
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Sync Failed',
                    description: res.error || 'Could not synchronize obligation.',
                    actionConfig: {
                        path: '/admin/finance/agreements',
                        label: 'View Agreements',
                    },
                });
            }
        } catch (err: unknown) {
            toast({
                variant: 'destructive',
                title: 'Sync Failed',
                description: err instanceof Error ? err.message : 'An unexpected error occurred during sync retry.',
            });
        } finally {
            setRetryingSyncIds((prev) => {
                const next = new Set(prev);
                next.delete(taskId);
                return next;
            });
        }
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
                    <div className="space-y-2.5">
                        {tasks.map((task) => (
                            <CompactTaskCard
                                key={task.id}
                                task={task}
                                userMap={userMap}
                                isPending={pendingIds.has(task.id)}
                                isRetryingSync={retryingSyncIds.has(task.id)}
                                onToggleComplete={handleToggleComplete}
                                onRetrySync={handleRetrySync}
                                onClick={() => router.push('/admin/tasks')}
                            />
                        ))}
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

                <Button variant="outline" asChild className="w-full rounded-xl font-medium h-10 border-primary/10 hover:bg-primary/5 hover:text-primary transition-all group mt-2 active:scale-[0.97]">
                    <Link href="/admin/tasks">
                        Command Hub
                        <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </div>
        </DashboardCard>
    );
}

export default TaskWidget;
