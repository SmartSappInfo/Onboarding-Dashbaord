'use client';

import * as React from 'react';
import { safeParseDate, formatTaskDueDate } from '@/lib/utils/date-utils';
import { isToday, isPast, differenceInCalendarDays } from 'date-fns';
import { Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskDueDateProps {
    dueDate?: string | null;
    isDone?: boolean;
    showIcon?: boolean;
    className?: string;
}

/**
 * TaskDueDate
 * Defensive date badge powered by safeParseDate.
 * Renders plain-text relative indicator ("Overdue", "Today", "Tomorrow") so overdue status is never communicated by color alone.
 * Avoids throwing RangeError on malformed dates.
 */
export function TaskDueDate({
    dueDate,
    isDone = false,
    showIcon = true,
    className,
}: TaskDueDateProps) {
    const parsedDate = React.useMemo(() => safeParseDate(dueDate), [dueDate]);

    if (!parsedDate) {
        return (
            <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground/60 select-none", className)}>
                {showIcon && <Clock className="h-3 w-3 opacity-40 shrink-0" />}
                <span>No due date</span>
            </span>
        );
    }

    const formatted = formatTaskDueDate(parsedDate);
    const isDueToday = isToday(parsedDate);
    const isOverdue = !isDone && isPast(parsedDate) && !isDueToday;
    const daysLeft = differenceInCalendarDays(parsedDate, new Date());

    let label = formatted;
    if (isDueToday) {
        label = 'Today';
    } else if (daysLeft === 1) {
        label = 'Tomorrow';
    } else if (isOverdue) {
        const daysOver = Math.abs(daysLeft);
        label = daysOver === 1 ? '1d overdue' : `${daysOver}d overdue`;
    }

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-xs font-medium select-none transition-colors",
                isOverdue
                    ? "text-rose-600 dark:text-rose-400 font-bold"
                    : isDueToday
                    ? "text-amber-600 dark:text-amber-400 font-semibold"
                    : "text-muted-foreground",
                isDone && "line-through opacity-70 text-muted-foreground font-normal",
                className
            )}
        >
            {showIcon && (
                isOverdue ? (
                    <AlertTriangle className="h-3 w-3 shrink-0 text-rose-500 animate-pulse" />
                ) : (
                    <Clock className="h-3 w-3 shrink-0 opacity-60" />
                )
            )}
            <span>{label}</span>
        </span>
    );
}
