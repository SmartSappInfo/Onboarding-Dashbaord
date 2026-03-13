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
    isPast
} from 'date-fns';
import { 
    ChevronLeft, 
    ChevronRight, 
    Calendar as CalendarIcon, 
    Clock, 
    ShieldAlert, 
    AlertTriangle,
    Building
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Task, TaskPriority } from '@/lib/types';
import { Badge } from '@/components/ui/badge';

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

interface TaskCalendarProps {
    tasks: Task[];
    onTaskClick: (task: Task) => void;
}

export default function TaskCalendar({ tasks, onTaskClick }: TaskCalendarProps) {
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    const days = React.useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth));
        const end = endOfWeek(endOfMonth(currentMonth));
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const handleToday = () => setCurrentMonth(new Date());

    return (
        <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-black/5">
            <div className="flex items-center justify-between p-6 border-b bg-muted/10">
                <div className="flex items-center gap-4">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary shadow-sm">
                        <CalendarIcon className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black uppercase tracking-tight leading-none mb-1">
                            {format(currentMonth, 'MMMM yyyy')}
                        </h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Temporal Workflow Map</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleToday} className="h-9 px-4 rounded-xl font-bold border-primary/20 text-primary">Today</Button>
                    <div className="flex gap-1 bg-muted/30 p-1 rounded-xl border">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handlePrevMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleNextMonth}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-7 border-b bg-muted/5">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-60">
                        {day}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-[1fr] min-h-[600px]">
                {days.map((day, idx) => {
                    const dayTasks = tasks.filter(t => isSameDay(new Date(t.dueDate), day));
                    const isSelectedMonth = isSameMonth(day, currentMonth);
                    const isTodayDate = isToday(day);

                    return (
                        <div 
                            key={day.toString()} 
                            className={cn(
                                "min-h-[120px] border-r border-b p-2 transition-colors flex flex-col gap-2 group",
                                !isSelectedMonth && "bg-muted/10 grayscale-[0.5] opacity-30",
                                isTodayDate && "bg-primary/[0.02] ring-1 ring-inset ring-primary/10",
                                idx % 7 === 6 && "border-r-0"
                            )}
                        >
                            <div className="flex justify-between items-center px-1">
                                <span className={cn(
                                    "text-xs font-black tabular-nums transition-all",
                                    isTodayDate ? "bg-primary text-white w-6 h-6 flex items-center justify-center rounded-lg shadow-lg scale-110" : "text-muted-foreground opacity-40 group-hover:opacity-100"
                                )}>
                                    {format(day, 'd')}
                                </span>
                                {dayTasks.length > 0 && (
                                    <Badge variant="outline" className="h-4 text-[8px] font-black px-1 border-none bg-muted/50">
                                        {dayTasks.length}
                                    </Badge>
                                )}
                            </div>

                            <div className="flex-1 space-y-1 overflow-y-auto no-scrollbar scroll-smooth">
                                {dayTasks.map(task => {
                                    const P = PRIORITY_ICONS[task.priority];
                                    const isDone = task.status === 'done';
                                    
                                    return (
                                        <button
                                            key={task.id}
                                            onClick={() => onTaskClick(task)}
                                            className={cn(
                                                "w-full text-left p-1.5 rounded-lg border shadow-sm transition-all hover:scale-[1.02] active:scale-95 group/task",
                                                isDone ? "bg-emerald-50 border-emerald-100 opacity-40" : "bg-white border-border/50 hover:border-primary/30"
                                            )}
                                        >
                                            <div className="flex items-start gap-1.5">
                                                {P && <P className={cn("h-2.5 w-2.5 shrink-0 mt-0.5", isDone ? "text-emerald-600" : "text-primary")} />}
                                                <div className="min-w-0 flex-1">
                                                    <p className={cn(
                                                        "text-[9px] font-black uppercase tracking-tight truncate leading-none",
                                                        isDone && "line-through"
                                                    )}>
                                                        {task.title}
                                                    </p>
                                                    {task.schoolName && (
                                                        <p className="text-[7px] font-bold text-muted-foreground uppercase tracking-tighter truncate mt-0.5 opacity-60">
                                                            {task.schoolName}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "h-0.5 w-full mt-1.5 rounded-full",
                                                isDone ? "bg-emerald-500" : PRIORITY_COLORS[task.priority]
                                            )} />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
