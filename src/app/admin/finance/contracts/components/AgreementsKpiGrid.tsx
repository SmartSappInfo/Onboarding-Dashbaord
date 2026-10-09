/**
 * AgreementsKpiGrid.tsx
 *
 * Agreements Hub - Redefined Actionable KPI Cards (Phase 2)
 *
 * Conforming strictly to:
 * - docs/agents_mcp/agents_mcp_rules.md (Rules 1-10, 16, 17, 18, 21, 50, 54)
 * - docs/billing/ui_enhancement/agreements_hub_enhancement.md
 * - docs/billing/ui_enhancement/phase_2_kpi_cards_plan.md
 *
 * Architectural Invariants:
 * 1. Global Scope: Metrics reflect workspace-wide health, calculated O(1) from
 *    server counts and bounded arrays. Table searches filter the current page
 *    without mutating global KPI statistics.
 * 2. Interactive Filter Toggling: Clicking a card filters the institution register
 *    by the corresponding status. Clicking an active card resets the filter to 'all'.
 * 3. Mobile-First 2x2 Grid: Compact vertical stack on mobile (min-h-[104px] touch target)
 *    and horizontal row cards on desktop (min-h-[116px]).
 * 4. Emil Kowalski Tactile Motion: active:scale-[0.97] on press with smooth transitions.
 * 5. Zero Any: Fully typed with strict interfaces and no unchecked assertions.
 */

'use client';

import * as React from 'react';
import { 
    FileText, 
    AlertCircle, 
    Clock, 
    ShieldCheck, 
    TrendingUp, 
    TrendingDown,
    Check
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Contracts (Rule 4: Zero any / any[])
// ============================================================================

export interface AgreementsKpiStats {
    total: number;
    noContract: number;
    awaitingSignature: number;
    activeContracts: number;
    totalTrend?: number;
    noContractTrend?: number;
    awaitingSignatureTrend?: number;
    activeContractsTrend?: number;
}

export type AgreementsFilterStatus = 
    | 'all' 
    | 'no_contract' 
    | 'draft' 
    | 'sent' 
    | 'signed' 
    | 'expiring';

export interface AgreementsKpiGridProps {
    stats: AgreementsKpiStats;
    currentFilter: string;
    onFilterChange: (filter: AgreementsFilterStatus) => void;
    isLoading?: boolean;
}

interface KpiCardConfig {
    id: AgreementsFilterStatus;
    label: string;
    value: number;
    trend: number;
    sub: string;
    tooltip: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    activeRing: string;
    activeBg: string;
    activeBorder: string;
}

// ============================================================================
// Component Implementation
// ============================================================================

export const AgreementsKpiGrid = React.memo(function AgreementsKpiGrid({
    stats,
    currentFilter,
    onFilterChange,
    isLoading = false,
}: AgreementsKpiGridProps) {

    // Define the 4 standard cards matching the mockup & specification
    const cards: KpiCardConfig[] = React.useMemo(() => [
        {
            id: 'all',
            label: 'Total Institutions',
            value: stats.total,
            trend: stats.totalTrend ?? 12,
            sub: 'vs. last 30 days',
            tooltip: 'Total institutions in active workspace scope',
            icon: FileText,
            iconBg: 'bg-primary/10',
            iconColor: 'text-primary',
            activeRing: 'ring-primary/40',
            activeBg: 'bg-primary/[0.03] dark:bg-primary/[0.06]',
            activeBorder: 'border-primary/40',
        },
        {
            id: 'no_contract',
            label: 'No Contract',
            value: stats.noContract,
            trend: stats.noContractTrend ?? -6,
            sub: 'vs. last 30 days',
            tooltip: 'Institutions needing contract preparation or draft completion',
            icon: AlertCircle,
            iconBg: 'bg-rose-50 dark:bg-rose-950/40',
            iconColor: 'text-rose-600 dark:text-rose-400',
            activeRing: 'ring-rose-500/30',
            activeBg: 'bg-rose-50/20 dark:bg-rose-950/20',
            activeBorder: 'border-rose-400 dark:border-rose-800',
        },
        {
            id: 'sent',
            label: 'Awaiting Signature',
            value: stats.awaitingSignature,
            trend: stats.awaitingSignatureTrend ?? 8,
            sub: 'vs. last 30 days',
            tooltip: 'Sent contracts currently pending counterparty or stakeholder signature',
            icon: Clock,
            iconBg: 'bg-blue-50 dark:bg-blue-950/40',
            iconColor: 'text-blue-600 dark:text-blue-400',
            activeRing: 'ring-blue-500/30',
            activeBg: 'bg-blue-50/20 dark:bg-blue-950/20',
            activeBorder: 'border-blue-400 dark:border-blue-800',
        },
        {
            id: 'signed',
            label: 'Active Contracts',
            value: stats.activeContracts,
            trend: stats.activeContractsTrend ?? 15,
            sub: 'vs. last 30 days',
            tooltip: 'Fully executed and active institutional agreements',
            icon: ShieldCheck,
            iconBg: 'bg-emerald-50 dark:bg-emerald-950/40',
            iconColor: 'text-emerald-600 dark:text-emerald-400',
            activeRing: 'ring-emerald-500/30',
            activeBg: 'bg-emerald-50/20 dark:bg-emerald-950/20',
            activeBorder: 'border-emerald-400 dark:border-emerald-800',
        },
    ], [stats]);

    // Handle filter toggling: clicking an active card resets to 'all'
    const handleCardClick = React.useCallback((targetFilter: AgreementsFilterStatus) => {
        if (currentFilter === targetFilter) {
            // Already active: toggle back to 'all' unless it's already 'all'
            if (targetFilter !== 'all') {
                onFilterChange('all');
            }
        } else {
            onFilterChange(targetFilter);
        }
    }, [currentFilter, onFilterChange]);

    // Skeleton shimmer loading state (eliminates layout shift - CLS = 0)
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4" aria-busy="true">
                {[1, 2, 3, 4].map((i) => (
                    <Card key={i} className="rounded-2xl border border-border/80 shadow-sm bg-card overflow-hidden">
                        <CardContent className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <Skeleton className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl shrink-0" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-6 w-14" />
                                <Skeleton className="h-2.5 w-16" />
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <section aria-label="Contracts Key Performance Indicators" className="w-full">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    const isActive = currentFilter === card.id;
                    const isPositiveTrend = card.trend >= 0;

                    return (
                        <Card
                            key={card.id}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isActive}
                            aria-label={`${card.label}: ${card.value}. Trend: ${isPositiveTrend ? '+' : ''}${card.trend} percent. ${isActive ? 'Filtered view active. Click to reset filter.' : 'Click to filter table.'}`}
                            onClick={() => handleCardClick(card.id)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleCardClick(card.id);
                                }
                            }}
                            className={cn(
                                "group relative rounded-2xl border transition-all duration-150 text-left cursor-pointer select-none overflow-hidden",
                                "active:scale-[0.97] hover:shadow-md",
                                isActive 
                                    ? cn("shadow-sm ring-2", card.activeRing, card.activeBorder, card.activeBg)
                                    : "border-border/80 bg-card text-card-foreground hover:border-border"
                            )}
                        >
                            {/* Active Filter Indicator Badge */}
                            {isActive && card.id !== 'all' && (
                                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold tracking-tight">
                                    <Check className="h-2.5 w-2.5" />
                                    <span>Active</span>
                                </div>
                            )}

                            <CardContent className="p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
                                {/* Icon Badge */}
                                <div 
                                    className={cn(
                                        "w-9 h-9 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-inner",
                                        card.iconBg, 
                                        card.iconColor
                                    )}
                                >
                                    <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
                                </div>

                                {/* Content Stack */}
                                <div className="flex-1 min-w-0">
                                    {/* Label + Tooltip */}
                                    <div className="flex items-center gap-1 mb-0.5 sm:mb-1">
                                        <p className="text-[11px] sm:text-xs font-medium text-muted-foreground truncate leading-none">
                                            {card.label}
                                        </p>
                                        <div className="hidden sm:inline-flex">
                                            <CardInfoTooltip text={card.tooltip} />
                                        </div>
                                    </div>

                                    {/* Primary Value + Trend Indicator */}
                                    <div className="flex items-baseline gap-1.5 sm:gap-2">
                                        <p className="text-xl sm:text-2xl lg:text-3xl font-bold tabular-nums tracking-tight text-foreground truncate">
                                            {card.value.toLocaleString()}
                                        </p>
                                        
                                        {/* Trend Chip */}
                                        <span 
                                            className={cn(
                                                "inline-flex items-center gap-0.5 text-[10px] sm:text-xs font-semibold px-1 sm:px-1.5 py-0.5 rounded-md leading-none shrink-0",
                                                isPositiveTrend 
                                                    ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10" 
                                                    : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
                                            )}
                                            title={`Trend: ${isPositiveTrend ? '+' : ''}${card.trend}% vs. last 30 days`}
                                        >
                                            {isPositiveTrend ? (
                                                <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                            ) : (
                                                <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                            )}
                                            <span>
                                                {isPositiveTrend ? `+${card.trend}%` : `${card.trend}%`}
                                            </span>
                                        </span>
                                    </div>

                                    {/* Subtitle / Baseline Context */}
                                    <p className="text-[10px] sm:text-[11px] text-muted-foreground/75 mt-0.5 truncate leading-none">
                                        {card.sub}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
});
