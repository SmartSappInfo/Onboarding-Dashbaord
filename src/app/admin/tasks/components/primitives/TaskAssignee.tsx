'use client';

import * as React from 'react';
import type { UserProfile } from '@/lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TaskAssigneeProps {
    assignees?: UserProfile[];
    maxDisplay?: number;
    size?: 'sm' | 'md';
    className?: string;
}

function getInitials(name?: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * TaskAssignee
 * Accessible avatar cluster displaying task assignees with fallback initials and tooltips.
 * Adheres to WCAG contrast and provides plain-text fallback when unassigned.
 */
export function TaskAssignee({
    assignees = [],
    maxDisplay = 3,
    size = 'sm',
    className,
}: TaskAssigneeProps) {
    if (!assignees || assignees.length === 0) {
        return (
            <div className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground/80 select-none", className)}>
                <User className="h-3.5 w-3.5 opacity-60" />
                <span>Unassigned</span>
            </div>
        );
    }

    const visibleUsers = assignees.slice(0, maxDisplay);
    const overflowCount = assignees.length - maxDisplay;

    const avatarSizeClass = size === 'md' ? 'h-6 w-6 text-[10px]' : 'h-5 w-5 text-[9px]';

    return (
        <TooltipProvider delayDuration={200}>
            <div className={cn("inline-flex items-center -space-x-1.5 overflow-hidden py-0.5", className)}>
                {visibleUsers.map((user, idx) => (
                    <Tooltip key={user.id || idx}>
                        <TooltipTrigger asChild>
                            <Avatar className={cn("ring-1 ring-background shrink-0 select-none", avatarSizeClass)}>
                                <AvatarImage src={user.photoURL || undefined} alt={user.name || 'User'} />
                                <AvatarFallback className="font-bold bg-muted text-muted-foreground">
                                    {getInitials(user.name)}
                                </AvatarFallback>
                            </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs font-medium z-[10050]">
                            {user.name || user.email || 'Assignee'}
                        </TooltipContent>
                    </Tooltip>
                ))}

                {overflowCount > 0 && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className={cn(
                                "flex items-center justify-center rounded-full bg-muted font-bold text-muted-foreground ring-1 ring-background shrink-0 select-none",
                                avatarSizeClass
                            )}>
                                +{overflowCount}
                            </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs font-medium z-[10050]">
                            {assignees.slice(maxDisplay).map(u => u.name || u.email).join(', ')}
                        </TooltipContent>
                    </Tooltip>
                )}
            </div>
        </TooltipProvider>
    );
}
