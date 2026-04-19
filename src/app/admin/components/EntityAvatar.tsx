'use client';

import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface EntityAvatarProps {
    /** The logo URL associated with the institution */
    src?: string | null;
    /** The display name of the institution for fallback and alt text */
    name?: string;
    /** Explicit initials if available in the model */
    initials?: string;
    /** Additional styling for the Avatar container */
    className?: string;
    /** Additional styling for the Fallback container */
    fallbackClassName?: string;
}

/**
 * Standardized Avatar component for Entities (Institutions).
 * Adheres to the Backoffice Standard: 
 * - uniformly circular (rounded-full) for all entities.
 * - proportional object-cover image scaling to match fallback size
 */
export function EntityAvatar({ 
    src, 
    name, 
    initials, 
    className,
    fallbackClassName
}: EntityAvatarProps) {
    const displayInitials = React.useMemo(() => {
        if (initials) return initials;
        if (!name) return '?';
        return name
            .split(' ')
            .filter(Boolean)
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }, [initials, name]);
    
    return (
        <Avatar className={cn(
            "h-10 w-10 shadow-sm transition-transform duration-500 group-hover:scale-105 ring-2 ring-background shrink-0 rounded-full",
            className
        )}>
            {src && (
                <AvatarImage 
                    src={src} 
                    alt={name || 'Entity logo'} 
                    className="object-cover h-full w-full bg-white/5" 
                />
            )}
            <AvatarFallback className={cn(
                "text-[10px] font-bold bg-primary/5 text-primary uppercase",
                fallbackClassName
            )}>
                {displayInitials}
            </AvatarFallback>
        </Avatar>
    );
}
