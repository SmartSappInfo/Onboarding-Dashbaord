'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface TaskErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    actionConfig?: {
        path: string;
        label: string;
    };
    className?: string;
}

/**
 * TaskErrorState
 * Actionable error state component.
 * Ensures error notifications give clear plain UI English explanations,
 * safe retry paths, and relative navigation links starting with '/' per workspace rules.
 */
export function TaskErrorState({
    title = "Couldn't load tasks",
    message = "An error occurred while communicating with the server. Your current changes are preserved.",
    onRetry,
    actionConfig,
    className,
}: TaskErrorStateProps) {
    return (
        <div className={cn(
            "flex flex-col items-center justify-center p-6 sm:p-8 text-center rounded-2xl border border-destructive/20 bg-destructive/5 max-w-lg mx-auto my-6 select-none",
            className
        )}>
            <div className="h-11 w-11 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-3 text-destructive">
                <AlertTriangle className="h-5 w-5" />
            </div>
            <h4 className="text-sm font-bold text-foreground">
                {title}
            </h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">
                {message}
            </p>
            <div className="flex items-center gap-2 mt-4">
                {onRetry && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onRetry}
                        className="rounded-xl border-border/80 text-xs font-semibold px-3.5 min-h-[44px] sm:min-h-[38px] active:scale-[0.97]"
                    >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                        Try again
                    </Button>
                )}
                {actionConfig && actionConfig.path.startsWith('/') && (
                    <Button
                        type="button"
                        asChild
                        className="rounded-xl text-xs font-semibold px-3.5 min-h-[44px] sm:min-h-[38px] active:scale-[0.97]"
                    >
                        <Link href={actionConfig.path}>
                            {actionConfig.label}
                        </Link>
                    </Button>
                )}
            </div>
        </div>
    );
}
