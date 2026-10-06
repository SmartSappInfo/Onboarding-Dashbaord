'use client';

import * as React from 'react';
import {
    DndContext,
    PointerSensor,
    useSensor,
    useSensors,
    DragOverlay,
    type DragStartEvent,
    type DragEndEvent,
    type DragOverEvent,
    closestCorners,
} from '@dnd-kit/core';
import type { Task, TaskStatus, UserProfile } from '@/lib/types';
import TaskColumn from './TaskColumn';
import TaskCard from './TaskCard';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { updateTaskAction } from '@/lib/task-server-actions';
import { useToast } from '@/hooks/use-toast';

const TASK_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'review', 'done'];

interface TaskBoardProps {
    tasks: Task[];
    entityLogoMap?: Map<string, string | undefined>;
    onTaskClick: (task: Task) => void;
    userMap?: Map<string, UserProfile>;
}

export default function TaskBoard({ tasks, entityLogoMap, onTaskClick, userMap }: TaskBoardProps) {
    const { toast } = useToast();
    
    const [localTasks, setLocalTasks] = React.useState<Task[]>(tasks);
    const [activeTask, setActiveTask] = React.useState<Task | null>(null);

    React.useEffect(() => {
        setLocalTasks(tasks);
    }, [tasks]);

    const sensors = useSensors(useSensor(PointerSensor, {
        activationConstraint: { distance: 10 }
    }));

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        if (active.data.current?.type === 'TASK') {
            setActiveTask(active.data.current.task);
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        if (!over) return;

        const activeId = active.id as string;
        const _overId = over.id as string;

        const activeData = active.data.current;
        const overData = over.data.current;

        if (!activeData || activeData.type !== 'TASK') return;

        const activeTaskItem = localTasks.find(t => t.id === activeId);
        if (!activeTaskItem) return;

        // Determine destination status
        let targetStatus: TaskStatus | undefined;
        
        if (overData?.type === 'COLUMN') {
            targetStatus = overData.status;
        } else if (overData?.type === 'TASK') {
            targetStatus = overData.task.status;
        }

        if (targetStatus && activeTaskItem.status !== targetStatus) {
            setLocalTasks(prev => {
                return prev.map(t => t.id === activeId ? { ...t, status: targetStatus! } : t);
            });
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveTask(null);

        if (!over) {
            setLocalTasks(tasks);
            return;
        }

        const activeId = active.id as string;
        const activeTaskItem = tasks.find(t => t.id === activeId);
        const currentLocalTask = localTasks.find(t => t.id === activeId);

        if (activeTaskItem && currentLocalTask && activeTaskItem.status !== currentLocalTask.status) {
            const targetStatus = currentLocalTask.status;

            try {
                const result = await updateTaskAction(activeId, { 
                    status: targetStatus 
                });

                if (!result.success) {
                    setLocalTasks(tasks); // Rollback optimistic state
                    toast({ 
                        variant: 'destructive', 
                        title: 'Status Update Failed',
                        description: result.error || 'Failed to update task status in this workspace.',
                        actionConfig: {
                            path: '/admin/settings/permissions',
                            label: 'Review Permissions',
                        },
                    });
                    return;
                }

                if (targetStatus === 'done' && activeTaskItem.relatedParentId) {
                    toast({ 
                        title: 'Status Synchronized', 
                        description: 'Moved task to done phase. Linked contractual obligation fulfilled.' 
                    });
                } else {
                    toast({ 
                        title: 'Status Synchronized', 
                        description: `Moved task to ${targetStatus.replace('_', ' ')} phase.` 
                    });
                }
            } catch (err: unknown) {
                setLocalTasks(tasks); // Rollback optimistic state
                toast({ 
                    variant: 'destructive', 
                    title: 'Sync Failure',
                    description: err instanceof Error ? err.message : 'An unexpected error occurred.',
                    actionConfig: {
                        path: '/admin/settings/permissions',
                        label: 'Review Permissions',
                    },
                });
            }
        }
    };

    const handleStatusChangeDirect = async (taskId: string, targetStatus: TaskStatus) => {
        const activeTaskItem = localTasks.find(t => t.id === taskId);
        if (!activeTaskItem || activeTaskItem.status === targetStatus) return;

        // Optimistic UI update
        setLocalTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: targetStatus } : t));

        try {
            const result = await updateTaskAction(taskId, { 
                status: targetStatus 
            });

            if (!result.success) {
                setLocalTasks(tasks); // Rollback optimistic state
                toast({ 
                    variant: 'destructive', 
                    title: 'Status Update Failed',
                    description: result.error || 'Failed to update task status in this workspace.',
                    actionConfig: {
                        path: '/admin/settings/permissions',
                        label: 'Review Permissions',
                    },
                });
                return;
            }

            if (targetStatus === 'done' && activeTaskItem.relatedParentId) {
                toast({ 
                    title: 'Status Synchronized', 
                    description: 'Moved task to done phase. Linked contractual obligation fulfilled.' 
                });
            } else {
                toast({ 
                    title: 'Status Synchronized', 
                    description: `Moved task to ${targetStatus.replace('_', ' ')} phase.` 
                });
            }
        } catch (err: unknown) {
            setLocalTasks(tasks); // Rollback optimistic state
            toast({ 
                variant: 'destructive', 
                title: 'Sync Failure',
                description: err instanceof Error ? err.message : 'An unexpected error occurred.',
                actionConfig: {
                    path: '/admin/settings/permissions',
                    label: 'Review Permissions',
                },
            });
        }
    };

    const tasksByStatus = React.useMemo(() => {
        const grouped = {} as Record<TaskStatus, Task[]>;
        TASK_STATUSES.forEach(s => grouped[s] = []);
        localTasks.forEach(t => {
            if (grouped[t.status]) grouped[t.status].push(t);
        });
        return grouped;
    }, [localTasks]);

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            collisionDetection={closestCorners}
        >
            <div className="h-full relative overflow-hidden">
                <ScrollArea className="h-full w-full">
                    <div className="flex h-full gap-6 p-1">
                        {TASK_STATUSES.map(status => (
                            <TaskColumn 
                                key={status} 
                                status={status} 
                                tasks={tasksByStatus[status]} 
                                entityLogoMap={entityLogoMap}
                                onTaskClick={onTaskClick}
                                userMap={userMap}
                                onStatusChange={handleStatusChangeDirect}
                            />
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                </ScrollArea>
            </div>

            <DragOverlay dropAnimation={null}>
                {activeTask ? (
                    <div className="w-72 pointer-events-none">
                        <TaskCard 
                            task={activeTask} 
                            entityLogoUrl={activeTask.entityId ? entityLogoMap?.get(activeTask.entityId) : undefined} 
                            isOverlay 
                            userMap={userMap}
                        />
                    </div>
                ) : null}
            </DragOverlay>
        </DndContext>
    );
}
