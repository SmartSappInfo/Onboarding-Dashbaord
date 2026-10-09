'use client';

/**
 * @fileOverview TaskChecklistProgress Primitive
 *
 * Renders a compact, accessible fractional progress indicator for checklist completion.
 * Designed for embedding directly into TaskListRow and TaskCard metadata lines.
 *
 * Conformance:
 * - Roadmap §42 & UI Spec §577-588: "3 of 5 complete" fractional badge with subtle progress indicator.
 * - AGENTS.md: Strict typing (zero `any`), accessible labels, no raw CSS leakage.
 * - Rules 7 & 10: Clear visual cues, screen-reader friendly aria-label.
 */

import * as React from 'react';
import { CheckSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TaskChecklistProgressProps {
    completedCount: number;
    totalCount: number;
    className?: string;
}

export function TaskChecklistProgress({
    completedCount,
    totalCount,
    className,
}: TaskChecklistProgressProps) {
    if (totalCount === 0) {
        return null;
    }

    const isAllDone = completedCount >= totalCount;
    const percentage = Math.round((completedCount / totalCount) * 100);

    return (
        <Badge
            variant="outline"
            aria-label={`Checklist progress: ${completedCount} of ${totalCount} items completed (${percentage}%)`}
            className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-semibold border transition-colors select-none",
                isAllDone
                    ? "bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60"
                    : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60",
                className
            )}
        >
            <CheckSquare className={cn("h-3 w-3 shrink-0", isAllDone ? "text-emerald-600 dark:text-emerald-400" : "opacity-70")} />
            <span className="tabular-nums">{completedCount}/{totalCount}</span>
        </Badge>
    );
}

export default TaskChecklistProgress;
