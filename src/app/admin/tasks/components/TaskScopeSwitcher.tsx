'use client';

/**
 * TaskScopeSwitcher
 * Segmented scope control conforming to Roadmap §27 and UI Spec §444-462:
 * - Contributors default to My Tasks.
 * - Team leads can switch to Team Tasks.
 * - All Tasks is permission-controlled with tooltip and disabled state.
 * - Tactile active:scale-[0.97] feedback and min-h-[44px] touch targets per .agents/AGENTS.md.
 * 
 * Caution for future maintainers:
 * - Do not remove disabled state on 'all' scope as standard users must be prevented from seeing workspace-wide tasks.
 * - Do not remove min-h-[44px] classes as mobile touch target accessibility requires it.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { User, Users, Globe, Lock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export type TaskScope = 'my' | 'team' | 'all';

export interface TaskScopeSwitcherProps {
    currentScope: TaskScope;
    onScopeChange: (scope: TaskScope) => void;
    canViewAllTasks?: boolean;
    counts?: {
        my?: number;
        team?: number;
        all?: number;
    };
    className?: string;
}

export function TaskScopeSwitcher({
    currentScope,
    onScopeChange,
    canViewAllTasks = true,
    counts,
    className,
}: TaskScopeSwitcherProps) {
    const scopes: Array<{ id: TaskScope; label: string; icon: React.ComponentType<{ className?: string }>; disabled?: boolean; tooltip?: string }> = [
        { id: 'my', label: 'My Tasks', icon: User },
        { id: 'team', label: 'Team Tasks', icon: Users },
        { 
            id: 'all', 
            label: 'All Tasks', 
            icon: canViewAllTasks ? Globe : Lock, 
            disabled: !canViewAllTasks,
            tooltip: !canViewAllTasks ? 'Requires admin or manager permissions to view all tasks.' : undefined,
        },
    ];

    return (
        <TooltipProvider>
            <div className={cn("inline-flex items-center p-1 bg-muted/40 rounded-xl border border-border/80 shadow-xs", className)}>
                {scopes.map(s => {
                    const Icon = s.icon;
                    const isSelected = currentScope === s.id;
                    const count = counts?.[s.id];

                    const buttonElement = (
                        <button
                            key={s.id}
                            type="button"
                            disabled={s.disabled}
                            onClick={() => !s.disabled && onScopeChange(s.id)}
                            aria-label={s.label}
                            aria-pressed={isSelected}
                            className={cn(
                                "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all select-none min-h-[44px] sm:min-h-[36px] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                                isSelected
                                    ? "bg-card text-foreground shadow-sm font-bold border border-border/60"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30",
                                s.disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground"
                            )}
                        >
                            <Icon className={cn("h-4 w-4 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                            <span>{s.label}</span>
                            {typeof count === 'number' && (
                                <span className={cn(
                                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-0.5",
                                    isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                                )}>
                                    {count}
                                </span>
                            )}
                        </button>
                    );

                    if (s.tooltip) {
                        return (
                            <Tooltip key={s.id}>
                                <TooltipTrigger asChild>
                                    <span>{buttonElement}</span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs max-w-xs">{s.tooltip}</TooltipContent>
                            </Tooltip>
                        );
                    }

                    return buttonElement;
                })}
            </div>
        </TooltipProvider>
    );
}
