'use client';

import * as React from 'react';
import type { TaskPriority } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowUp, ArrowRight, ArrowDown, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskPriorityBadgeProps {
    priority: TaskPriority;
    showIcon?: boolean;
    className?: string;
}

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; icon: LucideIcon; badgeClass: string; iconClass: string }> = {
    urgent: {
        label: 'Urgent',
        icon: AlertCircle,
        badgeClass: 'bg-rose-50/80 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200/80 dark:border-rose-800/60',
        iconClass: 'text-rose-600 dark:text-rose-400',
    },
    high: {
        label: 'High',
        icon: ArrowUp,
        badgeClass: 'bg-orange-50/80 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300 border-orange-200/80 dark:border-orange-800/60',
        iconClass: 'text-orange-600 dark:text-orange-400',
    },
    medium: {
        label: 'Medium',
        icon: ArrowRight,
        badgeClass: 'bg-blue-50/80 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200/80 dark:border-blue-800/60',
        iconClass: 'text-blue-600 dark:text-blue-400',
    },
    low: {
        label: 'Low',
        icon: ArrowDown,
        badgeClass: 'bg-muted/40 text-muted-foreground border-border/60',
        iconClass: 'text-muted-foreground',
    },
};

/**
 * TaskPriorityBadge
 * Accessible priority indicator subordinate to title and status.
 * Never conveys priority by color alone — always includes text and Lucide directional/alert icon.
 */
export function TaskPriorityBadge({
    priority,
    showIcon = true,
    className,
}: TaskPriorityBadgeProps) {
    const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.low;
    const Icon = config.icon;

    return (
        <Badge
            variant="outline"
            className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border transition-colors select-none",
                config.badgeClass,
                className
            )}
        >
            {showIcon && <Icon className={cn("h-3 w-3 shrink-0", config.iconClass)} />}
            <span>{config.label}</span>
        </Badge>
    );
}
