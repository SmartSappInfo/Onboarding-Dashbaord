/**
 * AgreementsFilterBar.tsx
 *
 * Agreements Hub - Unified Filter Bar (Phase 4)
 *
 * Conforming strictly to:
 * - docs/agents_mcp/agents_mcp_rules.md (Rules 1-10, 13, 16, 17, 18, 21, 50, 54)
 * - docs/billing/ui_enhancement/agreements_hub_enhancement.md (Section 4 Filter Bar)
 * - docs/billing/ui_enhancement/phase_4_filter_and_bulk_bar_plan.md
 *
 * Architectural Invariants:
 * 1. Debounced Search (Rule 54): Local controlled input with 250ms debounce
 *    preventing excessive re-renders and costly filtering operations on every keystroke.
 * 2. Mobile-First & Touch Target Compliance (Rule 7): All controls maintain min-h-[44px]
 *    touch targets with responsive wrapping across mobile, tablet, and desktop.
 * 3. Emil Kowalski Tactile Motion: Buttons utilize active:scale-[0.97] on press.
 * 4. Zero Any (Rule 4): Strictly typed interfaces for all props, states, and callbacks.
 * 5. Minimalistic Blue-and-White Theme: Fully bound to shadcn tokens (bg-card, text-primary,
 *    border-border/80) without hardcoded slate/dark classes.
 */

'use client';

import * as React from 'react';
import { 
    Search, 
    X, 
    SlidersHorizontal, 
    RotateCcw, 
    Plus, 
    Users, 
    Lock, 
    MapPin,
    Building2,
    Clock,
    FileText,
    CheckCircle2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
    Select, 
    SelectContent, 
    SelectItem, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import type { AgreementsFilterStatus } from './AgreementsKpiGrid';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Contracts (Rule 4: Zero any / any[])
// ============================================================================

export interface RepresentativeOption {
    id: string;
    name: string;
}

export interface AdvancedFilterState {
    legalHold: 'all' | 'on_hold' | 'not_on_hold';
    zone: string;
}

export interface AgreementsFilterBarProps {
    search: string;
    onSearchChange: (value: string) => void;
    status: AgreementsFilterStatus;
    onStatusChange: (status: AgreementsFilterStatus) => void;
    assignee: string;
    onAssigneeChange: (assigneeId: string) => void;
    assignees: RepresentativeOption[];
    advancedFilters: AdvancedFilterState;
    onAdvancedFiltersChange: (filters: AdvancedFilterState) => void;
    availableZones?: string[];
    hasActiveFilters: boolean;
    onResetFilters: () => void;
    onNewContract: () => void;
    canCreateContract?: boolean;
    isLoading?: boolean;
}

// ============================================================================
// Component Implementation
// ============================================================================

export const AgreementsFilterBar = React.memo(function AgreementsFilterBar({
    search,
    onSearchChange,
    status,
    onStatusChange,
    assignee,
    onAssigneeChange,
    assignees,
    advancedFilters,
    onAdvancedFiltersChange,
    availableZones = [],
    hasActiveFilters,
    onResetFilters,
    onNewContract,
    canCreateContract = true,
    isLoading = false
}: AgreementsFilterBarProps) {
    // Local search state for immediate keyboard responsiveness (Rule 54)
    const [localSearch, setLocalSearch] = React.useState(search);
    const [isAdvancedOpen, setIsAdvancedOpen] = React.useState(false);

    // Synchronize local search if parent resets or clears
    React.useEffect(() => {
        setLocalSearch(search);
    }, [search]);

    // 250ms debounce timeout ref
    const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    const handleSearchInput = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalSearch(val);

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
            onSearchChange(val);
        }, 250);
    }, [onSearchChange]);

    const handleClearSearch = React.useCallback(() => {
        setLocalSearch('');
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        onSearchChange('');
    }, [onSearchChange]);

    // Cleanup timer on unmount
    React.useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    // Count of active advanced secondary filters
    const activeAdvancedCount = React.useMemo(() => {
        let count = 0;
        if (advancedFilters.legalHold !== 'all') count++;
        if (advancedFilters.zone && advancedFilters.zone !== 'all') count++;
        return count;
    }, [advancedFilters]);

    return (
        <Card className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card transition-all">
            <CardContent className="p-3.5 sm:p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search & Main Selectors */}
                <div className="flex flex-1 flex-wrap items-center gap-2.5 sm:gap-3">
                    {/* Unified Search Input with Debounce */}
                    <div className="flex-1 min-w-[220px] sm:min-w-[260px] relative">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60 pointer-events-none" />
                        <Input
                            placeholder="Search institutions by name..."
                            value={localSearch}
                            onChange={handleSearchInput}
                            disabled={isLoading}
                            className="pl-10 pr-9 h-11 min-h-[44px] rounded-xl bg-muted/20 border-border/60 hover:border-border focus:border-primary/40 focus:ring-1 focus:ring-primary/20 text-xs sm:text-sm font-medium transition-all"
                        />
                        {localSearch && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleClearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                                aria-label="Clear search query"
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    {/* Status Select Dropdown (Desktop/Tablet; on mobile handled by AgreementsMobileFilterChips) */}
                    <div className="hidden sm:block w-full sm:w-[190px]">
                        <Select
                            value={status}
                            onValueChange={(val) => onStatusChange(val as AgreementsFilterStatus)}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="w-full h-11 min-h-[44px] rounded-xl bg-muted/20 border-border/60 hover:border-border font-semibold text-xs transition-all">
                                <SelectValue placeholder="All Status" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/80 shadow-xl">
                                <SelectItem value="all">
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>All Institutions</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="signed">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                        <span>Active Contracts</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="sent">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-3.5 w-3.5 text-blue-600" />
                                        <span>Awaiting Signature</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="draft">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-3.5 w-3.5 text-purple-600" />
                                        <span>Draft Contracts</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="no_contract">
                                    <div className="flex items-center gap-2">
                                        <X className="h-3.5 w-3.5 text-amber-600" />
                                        <span>No Contract</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="expiring">
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-3.5 w-3.5 text-orange-600" />
                                        <span>Expiring Soon</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Assigned Representative Dropdown */}
                    <div className="w-full sm:w-[190px]">
                        <Select
                            value={assignee || 'all'}
                            onValueChange={(val) => onAssigneeChange(val === 'all' ? '' : val)}
                            disabled={isLoading}
                        >
                            <SelectTrigger className="w-full h-11 min-h-[44px] rounded-xl bg-muted/20 border-border/60 hover:border-border font-semibold text-xs transition-all">
                                <SelectValue placeholder="Representative" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl border-border/80 shadow-xl max-h-60">
                                <SelectItem value="all">
                                    <div className="flex items-center gap-2">
                                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                                        <span>All Representatives</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="unassigned">
                                    <span className="text-muted-foreground italic">Unassigned</span>
                                </SelectItem>
                                {assignees.map((rep) => (
                                    <SelectItem key={rep.id} value={rep.id}>
                                        <span className="truncate">{rep.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Secondary Advanced Filters Popover */}
                    <Popover open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "h-11 min-h-[44px] px-3.5 rounded-xl font-semibold text-xs border-border/60 hover:bg-muted/40 transition-all active:scale-[0.97] gap-2",
                                    activeAdvancedCount > 0 && "border-primary/40 bg-primary/5 text-primary"
                                )}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                <span>Filters</span>
                                {activeAdvancedCount > 0 && (
                                    <Badge className="h-5 px-1.5 rounded-md text-[10px] bg-primary text-primary-foreground font-bold">
                                        {activeAdvancedCount}
                                    </Badge>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="start" className="w-72 p-4 rounded-2xl border-border/80 bg-card shadow-2xl space-y-3.5">
                            <div className="flex items-center justify-between pb-2 border-b border-border/60">
                                <div className="flex items-center gap-1.5">
                                    <SlidersHorizontal className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-bold">Secondary Filters</span>
                                </div>
                                <CardInfoTooltip text="Filter the institution register by geographical zone or legal hold status." />
                            </div>

                            {/* Zone / Region Filter */}
                            {availableZones.length > 0 && (
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                        <MapPin className="h-3 w-3" />
                                        <span>Geographical Zone</span>
                                    </label>
                                    <Select
                                        value={advancedFilters.zone || 'all'}
                                        onValueChange={(val) => onAdvancedFiltersChange({
                                            ...advancedFilters,
                                            zone: val === 'all' ? '' : val
                                        })}
                                    >
                                        <SelectTrigger className="w-full h-9 rounded-xl bg-muted/20 border-border/60 text-xs">
                                            <SelectValue placeholder="All Zones" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Zones</SelectItem>
                                            {availableZones.map((zone) => (
                                                <SelectItem key={zone} value={zone}>
                                                    {zone}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {/* Legal Hold Filter */}
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                                    <Lock className="h-3 w-3" />
                                    <span>Legal Hold Status</span>
                                </label>
                                <Select
                                    value={advancedFilters.legalHold}
                                    onValueChange={(val) => onAdvancedFiltersChange({
                                        ...advancedFilters,
                                        legalHold: val as AdvancedFilterState['legalHold']
                                    })}
                                >
                                    <SelectTrigger className="w-full h-9 rounded-xl bg-muted/20 border-border/60 text-xs">
                                        <SelectValue placeholder="All Records" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                        <SelectItem value="all">All Records</SelectItem>
                                        <SelectItem value="on_hold">Under Legal Hold</SelectItem>
                                        <SelectItem value="not_on_hold">Normal / Unlocked</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Reset Secondary Filters */}
                            {activeAdvancedCount > 0 && (
                                <div className="pt-2 border-t border-border/60">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => onAdvancedFiltersChange({ legalHold: 'all', zone: '' })}
                                        className="w-full h-8 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground"
                                    >
                                        Clear Secondary Filters
                                    </Button>
                                </div>
                            )}
                        </PopoverContent>
                    </Popover>

                    {/* Reset All Filters Button */}
                    {hasActiveFilters && (
                        <Button 
                            variant="ghost" 
                            onClick={onResetFilters} 
                            disabled={isLoading}
                            className="rounded-xl font-bold h-11 min-h-[44px] px-3 gap-1.5 text-xs text-muted-foreground hover:text-primary transition-all active:scale-[0.97]"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset</span>
                        </Button>
                    )}
                </div>

                {/* Primary CTA Button: + New Contract */}
                <div className="flex items-center gap-2 pt-1 md:pt-0">
                    {canCreateContract && (
                        <Button
                            onClick={onNewContract}
                            disabled={isLoading}
                            className="w-full md:w-auto h-11 min-h-[44px] px-5 rounded-xl font-bold text-xs sm:text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-[0.97] gap-2"
                        >
                            <Plus className="h-4 w-4" />
                            <span>New Contract</span>
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
});
