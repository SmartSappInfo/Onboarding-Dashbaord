'use client';

import * as React from 'react';
import type { TaskStatus } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskStatusBadgeProps {
    status: TaskStatus;
    interactive?: boolean;
    onStatusChange?: (newStatus: TaskStatus) => void;
    className?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; dotColor: string; badgeClass: string }> = {
    todo: {
        label: 'Backlog',
        dotColor: 'bg-slate-400',
        badgeClass: 'bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60',
    },
    in_progress: {
        label: 'In Progress',
        dotColor: 'bg-blue-500',
        badgeClass: 'bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60 hover:bg-blue-100/80',
    },
    waiting: {
        label: 'Waiting',
        dotColor: 'bg-amber-500',
        badgeClass: 'bg-amber-50/80 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200/80 dark:border-amber-800/60 hover:bg-amber-100/80',
    },
    review: {
        label: 'Review',
        dotColor: 'bg-purple-500',
        badgeClass: 'bg-purple-50/80 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200/80 dark:border-purple-800/60 hover:bg-purple-100/80',
    },
    done: {
        label: 'Done',
        dotColor: 'bg-emerald-500',
        badgeClass: 'bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 hover:bg-emerald-100/80',
    },
};

const ALL_STATUSES: TaskStatus[] = ['todo', 'in_progress', 'waiting', 'review', 'done'];

/**
 * TaskStatusBadge
 * Standardized status badge meeting WCAG AA contrast.
 * Never communicates meaning by color alone — always includes clear plain-text label.
 * Supports keyboard/touch interactive dropdown mode for non-drag status mutations.
 */
export function TaskStatusBadge({
    status,
    interactive = false,
    onStatusChange,
    className,
}: TaskStatusBadgeProps) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.todo;

    if (interactive && onStatusChange) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        role="button"
                        aria-label="Change status"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all select-none min-h-[44px] sm:min-h-[32px] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                            config.badgeClass,
                            className
                        )}
                    >
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotColor)} />
                        <span>{config.label}</span>
                        <ChevronDown className="h-3 w-3 opacity-60 ml-0.5 shrink-0" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[130px] z-[10050]" onClick={(e) => e.stopPropagation()}>
                    {ALL_STATUSES.map((st) => {
                        const opt = STATUS_CONFIG[st];
                        const isCurrent = st === status;
                        return (
                            <DropdownMenuItem
                                key={st}
                                disabled={isCurrent}
                                onSelect={(e) => {
                                    e.stopPropagation();
                                    onStatusChange(st);
                                }}
                                className={cn(
                                    "flex items-center gap-2 text-xs font-medium cursor-pointer min-h-[44px] sm:min-h-[36px]",
                                    isCurrent && "font-bold text-primary bg-primary/10"
                                )}
                            >
                                <span className={cn("h-2 w-2 rounded-full shrink-0", opt.dotColor)} />
                                <span>{opt.label}</span>
                            </DropdownMenuItem>
                        );
                    })}
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return (
        <Badge
            variant="outline"
            className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border transition-colors",
                config.badgeClass,
                className
            )}
        >
            <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotColor)} />
            <span>{config.label}</span>
        </Badge>
    );
}
