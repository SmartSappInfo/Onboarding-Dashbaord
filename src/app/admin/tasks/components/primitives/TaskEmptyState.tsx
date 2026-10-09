'use client';

import * as React from 'react';
import { CheckSquare, FilterX, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface TaskEmptyStateProps {
    isFiltered?: boolean;
    onCreateTask?: () => void;
    onClearFilters?: () => void;
    title?: string;
    description?: string;
    className?: string;
}

/**
 * TaskEmptyState
 * Standardized empty state component conforming to Section 8 of the Roadmap and UI Spec.
 * Differentiates between initial empty state ("No tasks yet") and filtered empty state ("No tasks match these filters").
 */
export function TaskEmptyState({
    isFiltered = false,
    onCreateTask,
    onClearFilters,
    title,
    description,
    className,
}: TaskEmptyStateProps) {
    if (isFiltered) {
        return (
            <div className={cn(
                "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 max-w-lg mx-auto my-6 select-none",
                className
            )}>
                <div className="h-12 w-12 rounded-2xl bg-muted/40 border border-border/60 flex items-center justify-center mb-4 text-muted-foreground">
                    <FilterX className="h-6 w-6 stroke-[1.5]" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                    {title || "No tasks match these filters"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
                    {description || "Try adjusting your date range, status, priority, or search term to see more results."}
                </p>
                {onClearFilters && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClearFilters}
                        className="mt-5 rounded-xl border-border/80 text-xs font-semibold px-4 min-h-[40px] sm:min-h-[36px] active:scale-[0.97]"
                    >
                        Clear filters
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-2xl border border-dashed border-border/80 bg-muted/10 max-w-lg mx-auto my-6 select-none",
            className
        )}>
            <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 text-primary">
                <CheckSquare className="h-6 w-6 stroke-[1.5]" />
            </div>
            <h3 className="text-base font-bold text-foreground">
                {title || "No tasks yet"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
                {description || "Create your first task to start tracking work across your workspace."}
            </p>
            {onCreateTask && (
                <Button
                    type="button"
                    onClick={onCreateTask}
                    className="mt-5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold px-4 min-h-[44px] active:scale-[0.97] shadow-sm hover:shadow"
                >
                    <Plus className="h-4 w-4 mr-1.5 shrink-0" />
                    Create task
                </Button>
            )}
        </div>
    );
}
