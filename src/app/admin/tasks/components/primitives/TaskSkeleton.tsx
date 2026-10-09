'use client';

import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface TaskSkeletonProps {
    variant?: 'list' | 'board' | 'card';
    count?: number;
    className?: string;
}

/**
 * TaskSkeleton
 * Skeletons matching actual task layout density and structure.
 * Prevents full-screen spinners or layout shift during initial load or filtering.
 */
export function TaskSkeleton({
    variant = 'list',
    count = 5,
    className,
}: TaskSkeletonProps) {
    if (variant === 'board') {
        return (
            <div className={cn("grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 w-full select-none", className)}>
                {Array.from({ length: 5 }).map((_, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-3 rounded-2xl border border-border/40 bg-muted/10 p-3">
                        <div className="flex items-center justify-between">
                            <Skeleton className="h-4 w-20 rounded-md" />
                            <Skeleton className="h-4 w-6 rounded-full" />
                        </div>
                        {Array.from({ length: 3 }).map((_, cardIdx) => (
                            <div key={cardIdx} className="p-3 rounded-xl border border-border/60 bg-card flex flex-col gap-2">
                                <Skeleton className="h-4 w-3/4 rounded-md" />
                                <div className="flex items-center justify-between pt-1">
                                    <Skeleton className="h-3.5 w-16 rounded-full" />
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={cn("p-3.5 rounded-xl border border-border/60 bg-card flex flex-col gap-2.5 animate-pulse", className)}>
                <Skeleton className="h-4 w-4/5 rounded-md" />
                <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-3.5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-2 w-full", className)}>
            {Array.from({ length: count }).map((_, idx) => (
                <div
                    key={idx}
                    className="flex items-center justify-between p-3 sm:p-3.5 rounded-xl border border-border/50 bg-card/60 gap-3"
                >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Skeleton className="h-4 w-4 rounded shrink-0" />
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <Skeleton className="h-4 w-2/5 rounded-md" />
                            <div className="flex items-center gap-2">
                                <Skeleton className="h-3 w-16 rounded-md" />
                                <Skeleton className="h-3 w-24 rounded-md" />
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <Skeleton className="h-6 w-16 rounded-full" />
                        <Skeleton className="h-5 w-5 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}
