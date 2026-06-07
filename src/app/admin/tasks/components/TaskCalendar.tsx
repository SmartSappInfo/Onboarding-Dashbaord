'use client';

import * as React from 'react';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    isToday,
    isPast,
    addWeeks,
    subWeeks,
    addDays,
    subDays
} from 'date-fns';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Clock, 
    ShieldAlert, 
    AlertTriangle,
    Building,
    Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { Task, TaskPriority, UserProfile } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { computeTimelineLayout, formatMinutesToTime, type LayoutItem } from '../utils/timelineLayout';

const PRIORITY_ICONS: Record<TaskPriority, any> = {
    urgent: ShieldAlert,
    high: AlertTriangle,
    medium: Clock,
    low: null
};

const PRIORITY_COLORS: Record<TaskPriority, string> = {
    urgent: 'bg-rose-500',
    high: 'bg-orange-500',
    medium: 'bg-blue-500',
    low: 'bg-slate-400'
};

const getInitials = (name?: string | null) =>
  name ? name.split(' ').map((n) => n[0]).join('').toUpperCase() : '?';

interface TaskCalendarProps {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
    userMap: Map<string, UserProfile>;
    onTaskUpdate: (taskId: string, updatedFields: Partial<Task>) => Promise<boolean>;
    onDateClick?: (date: Date) => void;
}

type DropTarget = 
  | { type: 'day'; date: Date }
  | { type: 'hour'; date: Date; hour: number; minutes: number }
  | { type: 'all-day'; date: Date };

function calculate15MinSlot(clientY: number, rectTop: number, rectHeight: number): number {
    const relativeY = clientY - rectTop;
    const ratio = Math.max(0, Math.min(0.99, relativeY / rectHeight));
    if (ratio < 0.25) return 0;
    if (ratio < 0.50) return 15;
    if (ratio < 0.75) return 30;
    return 45;
}

const SEGMENT_TOP_CLASS: Record<number, string> = {
    0: 'top-0',
    15: 'top-1/4',
    30: 'top-1/2',
    45: 'top-3/4'
};

interface TaskCalendarCardProps {
    task: Task;
    onTaskClick: (task: Task) => void;
    userMap: Map<string, UserProfile>;
    onDragStart: (e: React.DragEvent, task: Task) => void;
    onDragEnd: () => void;
}

function TaskCalendarCard({ task, onTaskClick, userMap, onDragStart, onDragEnd }: TaskCalendarCardProps) {
    const isDone = task.status === 'done';
    const P = PRIORITY_ICONS[task.priority];
    const pColor = PRIORITY_COLORS[task.priority];
    
    // Parse assignees
    const assignees = React.useMemo(() => {
        const raw = task.assignedTo;
        if (!raw) return [];
        const ids = Array.isArray(raw) ? raw : [raw];
        return ids.map(id => userMap.get(id)).filter(Boolean) as UserProfile[];
    }, [task.assignedTo, userMap]);

    const taskTime = React.useMemo(() => {
        try {
            const date = new Date(task.dueDate);
            // Check if it's midnight (untimed)
            if (date.getHours() === 0 && date.getMinutes() === 0) {
                return null;
            }
            return format(date, 'h:mm a');
        } catch {
            return null;
        }
    }, [task.dueDate]);

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={(e) => {
                e.stopPropagation();
                onTaskClick(task);
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    e.preventDefault();
                    onTaskClick(task);
                }
            }}
            draggable={true}
            onDragStart={(e) => onDragStart(e, task)}
            onDragEnd={onDragEnd}
            className={cn(
                "w-full text-left p-2 rounded-xl border shadow-sm transition-all hover:scale-[1.01] active:scale-99 hover:shadow-md bg-card/60 hover:bg-card flex flex-col gap-1 group/card border-border/50 hover:border-primary/20 cursor-pointer select-none",
                isDone && "opacity-60 bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/20"
            )}
        >
            <div className="flex items-start justify-between gap-2 w-full">
                <div className="min-w-0 flex-1">
                    <p className={cn(
                        "text-xs font-bold text-foreground leading-snug break-words group-hover/card:text-primary transition-colors",
                        isDone && "line-through text-muted-foreground"
                    )}>
                        {task.title}
                    </p>
                    {task.entityName && (
                        <p className="text-[9px] font-bold text-muted-foreground/60 truncate mt-0.5">
                            {task.entityName}
                        </p>
                    )}
                </div>
                {taskTime && (
                    <span className="text-[9px] font-bold text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded-md shrink-0">
                        {taskTime}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5 w-full border-t border-border/20 pt-1.5">
                <div className="flex items-center gap-1">
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isDone ? "bg-emerald-500" : pColor)} />
                    <span className="text-[9px] font-bold text-muted-foreground capitalize">
                        {task.priority}
                    </span>
                </div>

                {assignees.length > 0 && (
                    <div className="flex -space-x-1.5 overflow-hidden">
                        {assignees.slice(0, 3).map((u, i) => (
                            <Avatar key={u.id} className="h-4 w-4 ring-1 ring-card border-none shrink-0 transition-transform group-hover/card:scale-105" style={{ zIndex: 3 - i }}>
                                <AvatarImage src={u.photoURL || undefined} />
                                <AvatarFallback className="text-[7px] font-black bg-muted text-muted-foreground">
                                    {getInitials(u.name)}
                                </AvatarFallback>
                            </Avatar>
                        ))}
                        {assignees.length > 3 && (
                            <div className="h-4 w-4 rounded-full bg-muted/80 ring-1 ring-card flex items-center justify-center text-[7px] font-black text-muted-foreground shrink-0 z-0">
                                +{assignees.length - 3}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function TaskCalendar({ tasks, onTaskClick, userMap, onTaskUpdate, onDateClick }: TaskCalendarProps) {
    const [view, setView] = React.useState<'month' | 'week' | 'day'>('month');
    const [currentDate, setCurrentDate] = React.useState(new Date());
    const [mounted, setMounted] = React.useState(false);

    // DND States
    const [draggedTask, setDraggedTask] = React.useState<Task | null>(null);
    const [activeDropTarget, setActiveDropTarget] = React.useState<DropTarget | null>(null);
    const [resizingTaskId, setResizingTaskId] = React.useState<string | null>(null);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const isTargetDay = (day: Date) => {
        return activeDropTarget?.type === 'day' && isSameDay(activeDropTarget.date, day);
    };

    const isTargetHour = (hour: number) => {
        return activeDropTarget?.type === 'hour' && activeDropTarget.hour === hour;
    };

    const isTargetAllDay = () => {
        return activeDropTarget?.type === 'all-day';
    };

    const getIntellisenseLabel = (target: DropTarget) => {
        if (target.type === 'day') {
            return `Schedule: ${format(target.date, 'MMM d')}`;
        } else if (target.type === 'hour') {
            const h = target.hour;
            const m = target.minutes;
            const displayHour = h === 0 ? '12' : h > 12 ? `${h - 12}` : `${h}`;
            const displayMinutes = m === 0 ? '00' : `${m}`;
            const ampm = h >= 12 ? 'PM' : 'AM';
            return `Reschedule to ${displayHour}:${displayMinutes} ${ampm}`;
        } else {
            return "Move to All Day";
        }
    };

    const handleDragStart = (e: React.DragEvent, task: Task) => {
        setDraggedTask(task);
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragEnd = () => {
        setDraggedTask(null);
        setActiveDropTarget(null);
    };

    const handleResizeStart = (
        e: React.PointerEvent<HTMLDivElement>,
        item: LayoutItem,
        type: 'start' | 'end'
    ) => {
        e.stopPropagation();
        e.preventDefault();
        const handle = e.currentTarget;
        const cardEl = handle.closest('[data-card-id]') as HTMLDivElement;
        if (!cardEl) return;

        setResizingTaskId(item.task.id);
        handle.setPointerCapture(e.pointerId);

        const initialY = e.clientY;
        const initialTop = parseFloat(cardEl.style.top || '0');
        const initialHeight = parseFloat(cardEl.style.height || '0');
        const bottom = initialTop + initialHeight;

        // Hour height is 96px, 1 minute is 1.6px
        const hourHeight = 96;
        const minHeight = 24; // 15 mins min

        const onPointerMove = (moveEvent: PointerEvent) => {
            const deltaY = moveEvent.clientY - initialY;
            const deltaSnapped = Math.round(deltaY / 24) * 24;

            if (type === 'end') {
                const computedHeight = Math.max(minHeight, initialHeight + deltaSnapped);
                cardEl.style.height = `${computedHeight}px`;

                const previewEl = cardEl.querySelector('[data-time-preview]');
                if (previewEl) {
                    const endMinutes = (initialTop + computedHeight) / 1.6;
                    previewEl.textContent = formatMinutesToTime(endMinutes);
                }
            } else {
                const computedTop = Math.min(bottom - minHeight, Math.max(0, initialTop + deltaSnapped));
                const computedHeight = bottom - computedTop;
                cardEl.style.top = `${computedTop}px`;
                cardEl.style.height = `${computedHeight}px`;

                const previewEl = cardEl.querySelector('[data-time-preview]');
                if (previewEl) {
                    const startMinutes = computedTop / 1.6;
                    previewEl.textContent = formatMinutesToTime(startMinutes);
                }
            }
        };

        const onPointerUp = async (upEvent: PointerEvent) => {
            try {
                handle.releasePointerCapture(upEvent.pointerId);
            } catch (err) {}
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerCancel);

            setResizingTaskId(null);

            const finalTop = parseFloat(cardEl.style.top || '0');
            const finalHeight = parseFloat(cardEl.style.height || '0');

            const startMinutes = (finalTop / hourHeight) * 60;
            const durationMinutes = (finalHeight / hourHeight) * 60;

            const newStart = new Date(currentDate);
            newStart.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);

            const newDue = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

            const origStart = item.task.startDate ? new Date(item.task.startDate) : new Date(new Date(item.task.dueDate).getTime() - 60 * 60 * 1000);
            const origDue = new Date(item.task.dueDate);

            const isStartSame = origStart.getHours() === newStart.getHours() && origStart.getMinutes() === newStart.getMinutes();
            const isDueSame = origDue.getHours() === newDue.getHours() && origDue.getMinutes() === newDue.getMinutes();

            if (isStartSame && isDueSame) {
                return;
            }

            await onTaskUpdate(item.task.id, {
                startDate: newStart.toISOString(),
                dueDate: newDue.toISOString()
            });
        };

        const onPointerCancel = (cancelEvent: PointerEvent) => {
            try {
                handle.releasePointerCapture(cancelEvent.pointerId);
            } catch (err) {}
            handle.removeEventListener('pointermove', onPointerMove);
            handle.removeEventListener('pointerup', onPointerUp);
            handle.removeEventListener('pointercancel', onPointerCancel);

            setResizingTaskId(null);
            cardEl.style.top = `${initialTop}px`;
            cardEl.style.height = `${initialHeight}px`;

            const previewEl = cardEl.querySelector('[data-time-preview]');
            if (previewEl) {
                const initialTimeMinutes = (type === 'start' ? initialTop : (initialTop + initialHeight)) / 1.6;
                previewEl.textContent = formatMinutesToTime(initialTimeMinutes);
            }
        };

        handle.addEventListener('pointermove', onPointerMove);
        handle.addEventListener('pointerup', onPointerUp);
        handle.addEventListener('pointercancel', onPointerCancel);
    };

    const handleDragOverHour = (e: React.DragEvent, hour: number) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const minutes = calculate15MinSlot(e.clientY, rect.top, rect.height);

        setActiveDropTarget(prev => {
            if (prev?.type === 'hour' && prev.hour === hour && prev.minutes === minutes) {
                return prev;
            }
            return { type: 'hour', date: currentDate, hour, minutes };
        });
    };

    const handleDrop = async (e: React.DragEvent, target: DropTarget) => {
        e.preventDefault();
        if (!draggedTask) return;

        const origDue = new Date(draggedTask.dueDate);
        const origStart = draggedTask.startDate 
            ? new Date(draggedTask.startDate) 
            : new Date(origDue.getTime() - 60 * 60 * 1000);

        let newStart: Date;
        let newDue: Date;

        if (target.type === 'day') {
            newStart = new Date(target.date);
            newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0);

            newDue = new Date(target.date);
            newDue.setHours(origDue.getHours(), origDue.getMinutes(), 0, 0);
        } else if (target.type === 'hour') {
            newStart = new Date(target.date);
            newStart.setHours(target.hour, target.minutes, 0, 0);

            const durationMs = origDue.getTime() - origStart.getTime();
            newDue = new Date(newStart.getTime() + durationMs);
        } else {
            newStart = new Date(target.date);
            newStart.setHours(0, 0, 0, 0);

            newDue = new Date(target.date);
            newDue.setHours(0, 0, 0, 0);
        }

        setDraggedTask(null);
        setActiveDropTarget(null);

        const newStartISO = newStart.toISOString();
        const newDueISO = newDue.toISOString();

        // Redundancy guard
        const isStartSame = draggedTask.startDate === newStartISO;
        const isDueSame = draggedTask.dueDate === newDueISO;
        if (isStartSame && isDueSame) {
            return;
        }

        await onTaskUpdate(draggedTask.id, { 
            startDate: newStartISO,
            dueDate: newDueISO 
        });
    };

    const handlePrev = () => {
        if (view === 'month') {
            setCurrentDate(prev => subMonths(prev, 1));
        } else if (view === 'week') {
            setCurrentDate(prev => subWeeks(prev, 1));
        } else {
            setCurrentDate(prev => subDays(prev, 1));
        }
    };

    const handleNext = () => {
        if (view === 'month') {
            setCurrentDate(prev => addMonths(prev, 1));
        } else if (view === 'week') {
            setCurrentDate(prev => addWeeks(prev, 1));
        } else {
            setCurrentDate(prev => addDays(prev, 1));
        }
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const titleLabel = React.useMemo(() => {
        if (view === 'month') {
            return format(currentDate, 'MMMM yyyy');
        } else if (view === 'week') {
            const start = startOfWeek(currentDate, { weekStartsOn: 0 });
            const end = endOfWeek(currentDate, { weekStartsOn: 0 });
            if (start.getMonth() === end.getMonth()) {
                return `${format(start, 'MMMM d')} - ${format(end, 'd, yyyy')}`;
            } else if (start.getFullYear() === end.getFullYear()) {
                return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
            } else {
                return `${format(start, 'MMM d, yyyy')} - ${format(end, 'MMM d, yyyy')}`;
            }
        } else {
            return format(currentDate, 'EEEE, MMMM d, yyyy');
        }
    }, [view, currentDate]);



    const renderMonthView = () => {
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 0 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 0 });
        const days = eachDayOfInterval({ start, end });

        return (
            <div className="flex flex-col w-full">
                <div className="grid grid-cols-7 border-b bg-background">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                        <div key={day} className="py-3 text-center text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 auto-rows-[1fr] min-h-[600px] divide-x divide-y divide-border/40 border-b border-border/40">
                    {days.map((day, idx) => {
                        const dayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), day));
                        const isSelectedMonth = isSameMonth(day, currentDate);
                        const isTodayDate = isToday(day);

                        return (
                            <div 
                                key={day.toString()} 
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnter={(e) => { e.preventDefault(); setActiveDropTarget({ type: 'day', date: day }); }}
                                onDrop={(e) => handleDrop(e, { type: 'day', date: day })}
                                onClick={() => {
                                    if (isSelectedMonth) {
                                        onDateClick?.(day);
                                    }
                                }}
                                className={cn(
                                    "min-h-[120px] p-2 transition-colors flex flex-col gap-2 group border-border/40 relative",
                                    !isSelectedMonth && "bg-muted/10 opacity-30",
                                    isSelectedMonth && "cursor-pointer hover:bg-muted/[0.02]",
                                    isTodayDate && "bg-primary/[0.01] ring-1 ring-inset ring-primary/5",
                                    idx % 7 === 6 && "border-r-0"
                                )}
                            >
                                {isTargetDay(day) && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-primary/[0.04] border-2 border-dashed border-primary rounded-xl p-2 select-none pointer-events-none animate-pulse">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-wider text-center">
                                            {getIntellisenseLabel({ type: 'day', date: day })}
                                        </p>
                                    </div>
                                )}

                                <div className="flex justify-between items-center px-1">
                                    <span className={cn(
                                        "text-xs font-bold tabular-nums transition-all",
                                        isTodayDate ? "bg-primary text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-lg scale-110" : "text-muted-foreground/60 group-hover:text-foreground"
                                    )}>
                                        {format(day, 'd')}
                                    </span>
                                    {dayTasks.length > 0 && (
                                        <Badge variant="outline" className="h-4 text-[8px] font-bold px-1.5 border-none bg-primary/10 text-primary">
                                            {dayTasks.length}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar scroll-smooth">
                                    {dayTasks.map(task => {
                                        const P = PRIORITY_ICONS[task.priority];
                                        const isDone = task.status === 'done';
                                        
                                        return (
                                            <div
                                                key={task.id}
                                                role="button"
                                                tabIndex={0}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onTaskClick(task);
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' || e.key === ' ') {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        onTaskClick(task);
                                                    }
                                                }}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, task)}
                                                onDragEnd={handleDragEnd}
                                                className={cn(
                                                    "w-full text-left p-1.5 rounded-lg border shadow-sm transition-all hover:scale-[1.02] active:scale-95 group/task flex flex-col gap-1 border-border/50 hover:border-primary/30 cursor-pointer select-none",
                                                    isDone ? "bg-emerald-500/[0.02] border-emerald-500/10 opacity-40" : "bg-card border-border/50 hover:border-primary/30"
                                                )}
                                            >
                                                <div className="flex items-start gap-1.5">
                                                    {P && <P className={cn("h-2.5 w-2.5 shrink-0 mt-0.5", isDone ? "text-emerald-500" : "text-primary")} />}
                                                    <div className="min-w-0 flex-1">
                                                        <p className={cn(
                                                            "text-[9px] font-bold uppercase tracking-tight truncate leading-none text-foreground",
                                                            isDone && "line-through text-muted-foreground"
                                                        )}>
                                                            {task.title}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className={cn(
                                                    "h-0.5 w-full rounded-full",
                                                    isDone ? "bg-emerald-500" : PRIORITY_COLORS[task.priority]
                                                )} />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderWeekView = () => {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Sunday start
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

        return (
            <div className="flex flex-col w-full">
                {/* Week Days Headers */}
                <div className="grid grid-cols-7 border-b bg-background divide-x divide-border/40">
                    {weekDays.map(day => {
                        const isTodayDate = isToday(day);
                        return (
                            <div key={day.toString()} className="py-4 text-center flex flex-col items-center justify-center gap-1">
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">{format(day, 'EEE')}</span>
                                <span className={cn(
                                    "text-sm font-black h-8 w-8 flex items-center justify-center rounded-xl transition-all",
                                    isTodayDate ? "bg-primary text-white shadow-lg scale-105" : "text-foreground"
                                )}>
                                    {format(day, 'd')}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Week Columns Content */}
                <div className="grid grid-cols-7 divide-x divide-border/40 min-h-[500px] border-b border-border/40 bg-background/20">
                    {weekDays.map(day => {
                        const dayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), day));
                        
                        return (
                            <div 
                                key={day.toString()} 
                                onDragOver={(e) => e.preventDefault()}
                                onDragEnter={(e) => { e.preventDefault(); setActiveDropTarget({ type: 'day', date: day }); }}
                                onDrop={(e) => handleDrop(e, { type: 'day', date: day })}
                                onClick={() => onDateClick?.(day)}
                                className={cn(
                                    "p-3 flex flex-col gap-2 min-h-[450px] relative cursor-pointer hover:bg-muted/[0.02] transition-colors",
                                    isToday(day) && "bg-primary/[0.005]"
                                )}
                            >
                                {isTargetDay(day) && (
                                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-primary/[0.04] border-2 border-dashed border-primary rounded-xl p-3 select-none pointer-events-none animate-pulse">
                                        <p className="text-xs font-black text-primary uppercase tracking-widest text-center">
                                            {getIntellisenseLabel({ type: 'day', date: day })}
                                        </p>
                                    </div>
                                )}
                                <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                                    {dayTasks.map(task => (
                                        <TaskCalendarCard 
                                            key={task.id} 
                                            task={task} 
                                            onTaskClick={onTaskClick} 
                                            userMap={userMap} 
                                            onDragStart={handleDragStart}
                                            onDragEnd={handleDragEnd}
                                        />
                                    ))}
                                    {dayTasks.length === 0 && (
                                        <div className="h-full flex items-center justify-center py-24 text-center opacity-30 select-none">
                                            <p className="text-[9px] font-bold text-muted-foreground tracking-tight">No tasks due</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderDayView = () => {
        // Group tasks into all day and hourly
        const allDayTasks: Task[] = [];
        tasks.forEach(task => {
            const d = new Date(task.dueDate);
            if (isSameDay(d, currentDate)) {
                if (d.getHours() === 0 && d.getMinutes() === 0) {
                    allDayTasks.push(task);
                }
            }
        });

        const hours = Array.from({ length: 24 }, (_, i) => i);
        const positionedItems = computeTimelineLayout(tasks, currentDate, 96);

        return (
            <div className="flex flex-col w-full bg-background/10">
                {/* All Day / Untimed tasks row */}
                {(allDayTasks.length > 0 || draggedTask !== null) && (
                    <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDragEnter={(e) => { e.preventDefault(); setActiveDropTarget({ type: 'all-day', date: currentDate }); }}
                        onDrop={(e) => handleDrop(e, { type: 'all-day', date: currentDate })}
                        className="flex border-b border-border/40 p-4 bg-muted/10 items-center gap-4 relative"
                    >
                        {isTargetAllDay() && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/[0.04] border-2 border-dashed border-primary pointer-events-none select-none animate-pulse">
                                <span className="text-xs font-black text-primary uppercase tracking-widest">
                                    {getIntellisenseLabel({ type: 'all-day', date: currentDate })}
                                </span>
                            </div>
                        )}
                        <div className="w-20 text-right shrink-0">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded-md">
                                All Day
                            </span>
                        </div>
                        <div className="flex-1 flex flex-wrap gap-2">
                            {allDayTasks.map(task => (
                                <div key={task.id} className="w-[260px]">
                                    <TaskCalendarCard 
                                        task={task} 
                                        onTaskClick={onTaskClick} 
                                        userMap={userMap} 
                                        onDragStart={handleDragStart}
                                        onDragEnd={handleDragEnd}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Hourly timeline */}
                <div className="max-h-[600px] overflow-y-auto no-scrollbar relative border border-border/20 rounded-2xl bg-card/10">
                    <div className="relative w-full h-[2304px]">
                        {/* Background hours grid lines */}
                        <div className="absolute inset-0 flex flex-col divide-y divide-border/20 py-2">
                            {hours.map(hour => {
                                const displayHour = hour === 0 ? '12:00 AM' : hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
                                
                                return (
                                    <div key={hour} className="flex h-24 group/row hover:bg-muted/[0.02] transition-all relative">
                                        {/* Hour indicator */}
                                        <div className="w-24 pr-4 py-3 text-right text-[10px] font-black text-muted-foreground/50 tabular-nums select-none shrink-0 self-start">
                                            {displayHour}
                                        </div>

                                        {/* Task container for this hour slot (background DND target) */}
                                        <div 
                                            onDragOver={(e) => handleDragOverHour(e, hour)}
                                            onDrop={(e) => handleDrop(e, { type: 'hour', date: currentDate, hour, minutes: (activeDropTarget?.type === 'hour' ? activeDropTarget.minutes : 0) })}
                                            onClick={(e) => {
                                                const rect = e.currentTarget.getBoundingClientRect();
                                                const minutes = calculate15MinSlot(e.clientY, rect.top, rect.height);
                                                const targetDate = new Date(currentDate);
                                                targetDate.setHours(hour, minutes, 0, 0);
                                                onDateClick?.(targetDate);
                                            }}
                                            className="flex-1 border-l border-border/40 relative cursor-pointer hover:bg-primary/[0.01] transition-colors"
                                        >
                                            {isTargetHour(hour) && activeDropTarget?.type === 'hour' && (
                                                <div className={cn(
                                                    "absolute inset-x-0 z-10 flex items-center pl-6 bg-primary/[0.05] border-y border-dashed border-primary pointer-events-none select-none animate-pulse transition-all duration-100 ease-out h-1/4",
                                                    SEGMENT_TOP_CLASS[activeDropTarget.minutes]
                                                )}>
                                                    <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                                                        {getIntellisenseLabel(activeDropTarget)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Absolutely positioned task cards overlay */}
                        <div className="absolute top-2 left-24 right-6 bottom-2 pointer-events-none">
                            <div className="relative w-full h-[2304px]">
                                {/* Drag & Drop Ghost Card Preview */}
                                {draggedTask !== null && activeDropTarget?.type === 'hour' && (() => {
                                    const oDue = new Date(draggedTask.dueDate);
                                    const oStart = draggedTask.startDate 
                                        ? new Date(draggedTask.startDate) 
                                        : new Date(oDue.getTime() - 60 * 60 * 1000);
                                    const durationMinutes = Math.max(15, (oDue.getTime() - oStart.getTime()) / (1000 * 60));
                                    const heightPx = durationMinutes * 1.6;
                                    const topPx = (activeDropTarget.hour * 60 + activeDropTarget.minutes) * 1.6;
                                    
                                    return (
                                        <div
                                            style={{
                                                top: `${topPx}px`,
                                                height: `${heightPx}px`,
                                                left: 0,
                                                width: '280px',
                                                zIndex: 40
                                            }}
                                            className="absolute p-1 pointer-events-none select-none z-30 animate-pulse"
                                        >
                                            <div className="w-full h-full border-2 border-dashed border-primary bg-primary/[0.04] rounded-xl flex items-center pl-6">
                                                <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">
                                                    {getIntellisenseLabel(activeDropTarget)}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {positionedItems.map(item => {
                                    const isDone = item.task.status === 'done';
                                    const P = PRIORITY_ICONS[item.task.priority];
                                    const pColor = PRIORITY_COLORS[item.task.priority];
                                    const isResizingThis = resizingTaskId === item.task.id;

                                    // Parse assignees
                                    const assignees = Array.isArray(item.task.assignedTo)
                                        ? item.task.assignedTo.map(id => userMap.get(id)).filter(Boolean) as UserProfile[]
                                        : (item.task.assignedTo ? [userMap.get(item.task.assignedTo)].filter(Boolean) as UserProfile[] : []);

                                    const durationHours = item.endHour - item.startHour;
                                    const showExtendedDetails = durationHours >= 0.75; // show metadata only if height >= 72px (45 min)
                                    
                                    return (
                                        <div
                                            key={item.task.id}
                                            data-card-id={item.task.id}
                                            style={{
                                                top: `${item.top}px`,
                                                height: `${item.height}px`,
                                                left: `${item.left}px`,
                                                zIndex: item.colIndex + 10,
                                            }}
                                            className={cn(
                                                "absolute p-1 pointer-events-auto select-none w-[285px]",
                                                draggedTask !== null && "pointer-events-none opacity-40",
                                                resizingTaskId !== null && !isResizingThis && "pointer-events-none opacity-40"
                                            )}
                                        >
                                            <div
                                                className={cn(
                                                    "w-full h-full relative text-left p-2.5 pl-4 rounded-xl border shadow-md transition-all bg-card/90 backdrop-blur-md border-border/60 flex flex-col justify-between group/card hover:border-primary/30 overflow-hidden hover:shadow-lg",
                                                    isDone && "opacity-60 bg-emerald-500/[0.02] border-emerald-500/10 hover:border-emerald-500/20",
                                                    isResizingThis && "ring-2 ring-primary border-primary bg-card"
                                                )}
                                            >
                                                {/* Left priority stripe accent */}
                                                <div className={cn("absolute left-0 top-0 bottom-0 w-1", isDone ? "bg-emerald-500" : pColor)} />

                                                {/* Resize top handle */}
                                                {!isDone && (
                                                    <div
                                                        onPointerDown={(e) => handleResizeStart(e, item, 'start')}
                                                        className="absolute top-0 inset-x-0 h-2 cursor-ns-resize z-20 group/handle flex items-center justify-center pointer-events-auto"
                                                    >
                                                        <div className="w-8 h-1 rounded-full bg-muted-foreground/20 group-hover/handle:bg-primary/60 transition-colors" />
                                                    </div>
                                                )}

                                                <div 
                                                    onClick={() => onTaskClick(item.task)}
                                                    className="flex-1 flex flex-col gap-1 min-h-0 cursor-pointer pointer-events-auto"
                                                >
                                                    <div className="flex items-start justify-between gap-1.5 w-full">
                                                        <p className={cn(
                                                            "text-[10px] font-black text-foreground leading-snug break-words group-hover/card:text-primary transition-colors pr-2",
                                                            isDone && "line-through text-muted-foreground"
                                                        )}>
                                                            {item.task.title}
                                                        </p>
                                                        
                                                        {/* Time preview */}
                                                        <span 
                                                            data-time-preview="true" 
                                                            className="text-[8px] font-black text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded-md shrink-0 tabular-nums self-start"
                                                        >
                                                            {formatMinutesToTime(item.startHour * 60)}
                                                        </span>
                                                    </div>
                                                    
                                                    {showExtendedDetails && item.task.entityName && (
                                                        <p className="text-[8px] font-bold text-muted-foreground/60 truncate">
                                                            {item.task.entityName}
                                                        </p>
                                                    )}
                                                </div>

                                                {showExtendedDetails && (
                                                    <div className="flex items-center justify-between gap-2 mt-2 border-t border-border/10 pt-2">
                                                        <div className="flex items-center gap-1.5">
                                                            {P && <P className={cn("h-3 w-3 shrink-0", isDone ? "text-emerald-500" : "text-muted-foreground/60")} />}
                                                            <span className="text-[8px] font-extrabold text-muted-foreground/60 capitalize leading-none">
                                                                {item.task.priority}
                                                            </span>
                                                        </div>

                                                        {assignees.length > 0 && (
                                                            <div className="flex -space-x-1 overflow-hidden shrink-0">
                                                                {assignees.slice(0, 2).map((u, i) => (
                                                                    <Avatar key={u.id} className="h-3.5 w-3.5 ring-1 ring-card border-none shrink-0" style={{ zIndex: 2 - i }}>
                                                                        <AvatarImage src={u.photoURL || undefined} />
                                                                        <AvatarFallback className="text-[6px] font-black bg-muted text-muted-foreground">
                                                                            {getInitials(u.name)}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Resize bottom handle */}
                                                {!isDone && (
                                                    <div
                                                        onPointerDown={(e) => handleResizeStart(e, item, 'end')}
                                                        className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize z-20 group/handle flex items-center justify-center pointer-events-auto"
                                                    >
                                                        <div className="w-8 h-1 rounded-full bg-muted-foreground/20 group-hover/handle:bg-primary/60 transition-colors" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (!mounted) {
        return (
            <Card className="border-none shadow-2xl rounded-2xl overflow-hidden bg-card ring-1 ring-black/5 p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-xs font-bold text-muted-foreground/60 animate-pulse">Initializing Temporal Map...</p>
            </Card>
        );
    }

    return (
        <Card className="border-none shadow-2xl rounded-2xl overflow-hidden bg-card ring-1 ring-black/5">
            <div className="flex flex-col md:flex-row md:items-center justify-between p-6 gap-4 border-b bg-background">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm">
                        <CalendarIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-semibold tracking-tight leading-none mb-1">
                            {titleLabel}
                        </h2>
                        <p className="text-[10px] font-bold text-muted-foreground ">Temporal Workflow Map</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* View Switcher Segments */}
                    <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border shrink-0">
                        <Button 
                            variant={view === 'day' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 px-4 rounded-lg text-[10px] font-bold cursor-pointer"
                            onClick={() => setView('day')}
                        >
                            Day
                        </Button>
                        <Button 
                            variant={view === 'week' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 px-4 rounded-lg text-[10px] font-bold cursor-pointer"
                            onClick={() => setView('week')}
                        >
                            Week
                        </Button>
                        <Button 
                            variant={view === 'month' ? 'secondary' : 'ghost'} 
                            size="sm" 
                            className="h-8 px-4 rounded-lg text-[10px] font-bold cursor-pointer"
                            onClick={() => setView('month')}
                        >
                            Month
                        </Button>
                    </div>

                    <Button variant="outline" size="sm" onClick={handleToday} className="h-9 px-4 rounded-xl font-bold border-primary/20 text-primary cursor-pointer">
                        Today
                    </Button>

                    <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer" onClick={handlePrev}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg cursor-pointer" onClick={handleNext}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {view === 'month' && renderMonthView()}
            {view === 'week' && renderWeekView()}
            {view === 'day' && renderDayView()}
        </Card>
    );
}
