'use client';

import * as React from 'react';
import { Bot, Zap, Cpu, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface TaskSourceBadgeProps {
    source?: 'manual' | 'automation' | 'system' | 'ai' | string;
    className?: string;
}

/**
 * TaskSourceBadge
 * Attribution badge clearly identifying whether work originated from manual user entry,
 * automated workflow protocols, background system jobs, or AI agent drafts.
 */
export function TaskSourceBadge({
    source = 'manual',
    className,
}: TaskSourceBadgeProps) {
    switch (source?.toLowerCase()) {
        case 'automation':
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-50/80 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border-indigo-200/80 dark:border-indigo-800/60 select-none",
                        className
                    )}
                >
                    <Zap className="h-2.5 w-2.5 shrink-0" />
                    <span>Automation</span>
                </Badge>
            );
        case 'ai':
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50/80 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200/80 dark:border-emerald-800/60 select-none",
                        className
                    )}
                >
                    <Bot className="h-2.5 w-2.5 shrink-0" />
                    <span>AI</span>
                </Badge>
            );
        case 'system':
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted/40 text-muted-foreground border-border/60 select-none",
                        className
                    )}
                >
                    <Cpu className="h-2.5 w-2.5 shrink-0" />
                    <span>System</span>
                </Badge>
            );
        default:
            return (
                <Badge
                    variant="outline"
                    className={cn(
                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted/20 text-muted-foreground border-border/40 select-none",
                        className
                    )}
                >
                    <User className="h-2.5 w-2.5 shrink-0 opacity-60" />
                    <span>Manual</span>
                </Badge>
            );
    }
}
