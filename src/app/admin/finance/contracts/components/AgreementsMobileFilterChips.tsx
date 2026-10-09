/**
 * AgreementsMobileFilterChips.tsx
 *
 * Agreements Hub - Mobile Horizontal Filter Chips (Phase 4)
 *
 * Conforming strictly to:
 * - docs/agents_mcp/agents_mcp_rules.md (Rules 1-10, 13, 16, 17, 21, 50, 54)
 * - docs/billing/ui_enhancement/agreements_hub_enhancement.md (Section 4 Mobile View)
 * - docs/billing/ui_enhancement/phase_4_filter_and_bulk_bar_plan.md
 *
 * Architectural Invariants:
 * 1. Mobile-First Optimization (Rule 7): Exclusively rendered on small viewports (< 640px)
 *    to provide quick, single-thumb filter switching without navigating complex selects.
 * 2. Touch Target Compliance (Rule 7): Every chip maintains a min-h-[44px] hit area.
 * 3. Emil Kowalski Tactile Motion: active:scale-95 on press with smooth transitions.
 * 4. Zero Any (Rule 4): Fully typed with strict interfaces.
 */

'use client';

import * as React from 'react';
import { 
    Building2, 
    AlertCircle, 
    Clock, 
    CheckCircle2, 
    FileText, 
    SlidersHorizontal 
} from 'lucide-react';
import type { AgreementsFilterStatus } from './AgreementsKpiGrid';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Contracts (Rule 4: Zero any / any[])
// ============================================================================

export interface MobileFilterChipCounts {
    total: number;
    noContract: number;
    awaitingSignature: number;
    activeContracts: number;
    draft?: number;
    expiring?: number;
}

export interface AgreementsMobileFilterChipsProps {
    currentStatus: AgreementsFilterStatus;
    onStatusChange: (status: AgreementsFilterStatus) => void;
    counts: MobileFilterChipCounts;
    onOpenAdvancedFilters?: () => void;
    hasActiveAdvancedFilters?: boolean;
    isLoading?: boolean;
}

interface FilterChipDefinition {
    key: AgreementsFilterStatus;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count: number;
}

// ============================================================================
// Component Implementation
// ============================================================================

export const AgreementsMobileFilterChips = React.memo(function AgreementsMobileFilterChips({
    currentStatus,
    onStatusChange,
    counts,
    onOpenAdvancedFilters,
    hasActiveAdvancedFilters = false,
    isLoading = false
}: AgreementsMobileFilterChipsProps) {
    const chips: FilterChipDefinition[] = React.useMemo(() => [
        {
            key: 'all',
            label: 'All',
            icon: Building2,
            count: counts.total,
        },
        {
            key: 'no_contract',
            label: 'No Contract',
            icon: AlertCircle,
            count: counts.noContract,
        },
        {
            key: 'sent',
            label: 'Awaiting Signature',
            icon: Clock,
            count: counts.awaitingSignature,
        },
        {
            key: 'signed',
            label: 'Active',
            icon: CheckCircle2,
            count: counts.activeContracts,
        },
        {
            key: 'draft',
            label: 'Drafts',
            icon: FileText,
            count: counts.draft ?? 0,
        },
        {
            key: 'expiring',
            label: 'Expiring',
            icon: Clock,
            count: counts.expiring ?? 0,
        },
    ], [counts]);

    return (
        <div 
            className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-0.5 scroll-smooth sm:hidden -mx-1"
            role="toolbar"
            aria-label="Filter institutions by status"
        >
            {chips.map((chip) => {
                const Icon = chip.icon;
                const isActive = currentStatus === chip.key;

                return (
                    <button
                        key={chip.key}
                        type="button"
                        onClick={() => onStatusChange(isActive && chip.key !== 'all' ? 'all' : chip.key)}
                        disabled={isLoading}
                        aria-pressed={isActive}
                        className={cn(
                            "flex items-center gap-1.5 h-10 min-h-[44px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 border",
                            isActive
                                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                                : "bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/80"
                        )}
                    >
                        <Icon className={cn("h-3.5 w-3.5", isActive ? "text-primary-foreground" : "text-muted-foreground")} />
                        <span>{chip.label}</span>
                        <span 
                            className={cn(
                                "text-[10px] font-bold px-1.5 py-0.2 rounded-full",
                                isActive 
                                    ? "bg-primary-foreground/20 text-primary-foreground" 
                                    : "bg-muted text-muted-foreground"
                            )}
                        >
                            {chip.count}
                        </span>
                    </button>
                );
            })}

            {onOpenAdvancedFilters && (
                <button
                    type="button"
                    onClick={onOpenAdvancedFilters}
                    disabled={isLoading}
                    aria-label="Open advanced secondary filters"
                    className={cn(
                        "flex items-center gap-1.5 h-10 min-h-[44px] px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 active:scale-95 border",
                        hasActiveAdvancedFilters
                            ? "bg-primary/10 text-primary border-primary/40 font-bold"
                            : "bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground border-border/80"
                    )}
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>More Filters</span>
                </button>
            )}
        </div>
    );
});
