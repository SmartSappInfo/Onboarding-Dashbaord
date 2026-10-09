'use client';

/**
 * TaskFilterChips
 * Removable filter chips bar conforming to UI Spec §507 and Roadmap §29.
 * Surfaces active filters, live matching counts, and a one-click 'Clear all' button.
 * - Min-h-[44px] on mobile dismiss targets for accessibility (.agents/AGENTS.md).
 * - Tactile active:scale-[0.97] feedback.
 * 
 * Caution for future maintainers:
 * - Each chip requires a unique key and value to allow targeted removal without affecting other filter dimensions.
 */

import * as React from 'react';
import { X, Filter, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface FilterChipItem {
    key: string;
    label: string;
    value: string;
}

export interface TaskFilterChipsProps {
    chips: FilterChipItem[];
    totalMatching?: number;
    onRemoveChip: (chip: FilterChipItem) => void;
    onClearAll: () => void;
    className?: string;
}

export function TaskFilterChips({
    chips,
    totalMatching,
    onRemoveChip,
    onClearAll,
    className,
}: TaskFilterChipsProps) {
    if (!chips.length) return null;

    return (
        <div className={cn(
            "flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl bg-muted/20 border border-border/60 text-xs",
            className
        )}>
            <div className="flex items-center gap-1.5 text-muted-foreground font-semibold shrink-0 mr-1">
                <Filter className="h-3.5 w-3.5" />
                <span>Filters:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {chips.map((chip) => (
                    <Badge
                        key={`${chip.key}-${chip.value}`}
                        variant="secondary"
                        className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-lg text-xs font-semibold bg-card border border-border/80 text-foreground shadow-2xs hover:bg-muted/40 transition-colors min-h-[44px] sm:min-h-0"
                    >
                        <span>{chip.label}</span>
                        <button
                            type="button"
                            aria-label={`Remove filter ${chip.label}`}
                            onClick={() => onRemoveChip(chip)}
                            className="min-h-[44px] min-w-[44px] sm:min-h-[24px] sm:min-w-[24px] sm:h-6 sm:w-6 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground active:scale-[0.95] transition-all cursor-pointer"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </Badge>
                ))}
            </div>

            <div className="flex items-center gap-2.5 shrink-0 ml-auto pt-1 sm:pt-0">
                {typeof totalMatching === 'number' && (
                    <span className="text-[11px] font-medium text-muted-foreground">
                        <strong className="text-foreground">{totalMatching}</strong> tasks match
                    </span>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onClearAll}
                    aria-label="Clear all filters"
                    className="h-8 min-h-[44px] sm:min-h-[32px] text-xs font-semibold px-2.5 text-muted-foreground hover:text-destructive active:scale-[0.97] rounded-lg gap-1"
                >
                    <RotateCcw className="h-3 w-3" />
                    <span>Clear all</span>
                </Button>
            </div>
        </div>
    );
}
