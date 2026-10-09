/**
 * AgreementsAiAssistantBanner.tsx
 *
 * Agreements Hub - Contextual AI Contract Assistant Action Layer (Phase 3)
 *
 * Conforming strictly to:
 * - docs/agents_mcp/agents_mcp_rules.md (Rules 1-10, 13, 16, 17, 18, 21, 22, 26, 30, 50, 54)
 * - docs/billing/ui_enhancement/agreements_hub_enhancement.md
 * - docs/billing/ui_enhancement/phase_3_ai_assistant_plan.md
 *
 * Architectural Invariants:
 * 1. Two-Phase Action Model (Rule 21): AI chips execute strictly as the Preview Phase
 *    (filtering records or opening interactive configuration drawers). They NEVER execute
 *    mutations or dispatch binding agreements autonomously.
 * 2. Trust Boundary (Rule 13): Text and recommendations are treated as untrusted data
 *    and rendered safely via standard React text nodes (no dangerouslySetInnerHTML).
 * 3. Mobile-First Responsiveness (Rule 7): Desktop renders the full hero banner with
 *    contextual action chips; mobile viewports render a compact card with right chevron
 *    triggering the AgreementsAiActionSheet bottom drawer (min-h-[44px] touch targets).
 * 4. Emil Kowalski Tactile Motion: active:scale-[0.97] on all interactive chips and buttons.
 * 5. Strict Typing (Rule 4): Fully typed interfaces with zero any / any[].
 */

'use client';

import * as React from 'react';
import { 
    Bot, 
    ArrowRight, 
    ChevronRight,
    Sparkles,
    AlertCircle,
    Clock,
    Bell
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { AgreementsAiActionSheet, type AiAssistantActionKey } from './AgreementsAiActionSheet';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Contracts (Rule 4: Zero any / any[])
// ============================================================================

export interface AgreementsAiAssistantBannerProps {
    missingCount: number;
    pendingCount: number;
    onAction: (action: AiAssistantActionKey) => void;
    isLoading?: boolean;
}

// ============================================================================
// Component Implementation
// ============================================================================

export const AgreementsAiAssistantBanner = React.memo(function AgreementsAiAssistantBanner({
    missingCount,
    pendingCount,
    onAction,
    isLoading = false,
}: AgreementsAiAssistantBannerProps) {
    const [isSheetOpen, setIsSheetOpen] = React.useState(false);

    const handleActionClick = React.useCallback((action: AiAssistantActionKey) => {
        onAction(action);
    }, [onAction]);

    const handleOpenSheet = React.useCallback(() => {
        setIsSheetOpen(true);
    }, []);

    // Skeleton shimmer loading state (CLS = 0)
    if (isLoading) {
        return (
            <div className="w-full rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-2xs" aria-busy="true">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                        <Skeleton className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl shrink-0" />
                        <div className="space-y-1.5">
                            <Skeleton className="h-4 w-36" />
                            <Skeleton className="h-3 w-64" />
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Skeleton className="h-9 w-32 rounded-xl" />
                        <Skeleton className="h-9 w-36 rounded-xl" />
                        <Skeleton className="h-9 w-28 rounded-xl" />
                        <Skeleton className="h-9 w-9 rounded-full" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section aria-label="AI Contract Assistant" className="w-full">
            {/* Desktop Hero Banner (hidden on mobile, flex on sm+) */}
            <div className={cn(
                "hidden sm:flex items-center justify-between gap-4 w-full rounded-2xl border p-4 sm:p-5 shadow-2xs transition-all duration-150",
                "border-blue-100/90 dark:border-blue-900/40",
                "bg-gradient-to-r from-blue-50/70 via-sky-50/40 to-indigo-50/50 dark:from-blue-950/25 dark:via-sky-950/15 dark:to-indigo-950/20"
            )}>
                {/* Left Side: Avatar, Title & Subtitle */}
                <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-blue-100/90 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                        <Bot className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                                AI Contract Assistant
                            </h3>
                            <CardInfoTooltip text="AI Contract Assistant analyzes institutional contract states, surfaces missing agreements, prioritizes overdue signatures, and helps draft reminders with human-in-the-loop review." />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Find gaps, prioritize follow-ups or prepare a draft from an approved template.
                        </p>
                    </div>
                </div>

                {/* Right Side: Quick Action Chips + Circular Action Button */}
                <div className="flex items-center gap-2 shrink-0">
                    {/* Chip 1: Find Missing Contracts */}
                    <button
                        type="button"
                        onClick={() => handleActionClick('find_missing')}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 select-none",
                            "border border-border/80 bg-card hover:bg-muted/40 text-foreground shadow-2xs hover:shadow-xs",
                            "active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                            "min-h-[44px] sm:min-h-[36px]"
                        )}
                        aria-label={`Find missing contracts (${missingCount} institutions need contracts). Click to filter register.`}
                    >
                        <AlertCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        <span>Find missing contracts</span>
                        {missingCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                {missingCount}
                            </span>
                        )}
                    </button>

                    {/* Chip 2: Prioritize Overdue Signatures */}
                    <button
                        type="button"
                        onClick={() => handleActionClick('overdue_signatures')}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 select-none",
                            "border border-border/80 bg-card hover:bg-muted/40 text-foreground shadow-2xs hover:shadow-xs",
                            "active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                            "min-h-[44px] sm:min-h-[36px]"
                        )}
                        aria-label={`Prioritize overdue signatures (${pendingCount} pending signature). Click to view.`}
                    >
                        <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                        <span>Prioritize overdue signatures</span>
                        {pendingCount > 0 && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                {pendingCount}
                            </span>
                        )}
                    </button>

                    {/* Chip 3: Draft a Reminder */}
                    <button
                        type="button"
                        onClick={() => handleActionClick('draft_reminder')}
                        className={cn(
                            "inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150 select-none",
                            "border border-border/80 bg-card hover:bg-muted/40 text-foreground shadow-2xs hover:shadow-xs",
                            "active:scale-[0.97] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                            "min-h-[44px] sm:min-h-[36px]"
                        )}
                        aria-label="Draft a reminder. Opens reminder settings drawer for human review."
                    >
                        <Bell className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>Draft a reminder</span>
                    </button>

                    {/* Circular Action Button */}
                    <button
                        type="button"
                        onClick={handleOpenSheet}
                        className={cn(
                            "w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary text-white flex items-center justify-center shrink-0 shadow-sm",
                            "hover:bg-primary/90 active:scale-95 transition-all duration-150 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/50"
                        )}
                        title="Open AI Contract Assistant Details"
                        aria-label="Open AI Contract Assistant Details & Recommendations"
                    >
                        <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Mobile Compact Card (sm:hidden) */}
            <div
                role="button"
                tabIndex={0}
                onClick={handleOpenSheet}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenSheet();
                    }
                }}
                className={cn(
                    "sm:hidden w-full rounded-2xl border p-3.5 flex items-center justify-between gap-3 shadow-2xs cursor-pointer select-none transition-all duration-150",
                    "border-blue-100/90 dark:border-blue-900/40",
                    "bg-gradient-to-r from-blue-50/70 to-indigo-50/50 dark:from-blue-950/25 dark:to-indigo-950/20",
                    "active:scale-[0.97] hover:shadow-xs text-left"
                )}
                aria-label="AI Contract Assistant: Find gaps, prioritize follow-ups or prepare a draft. Tap to view smart actions."
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-100/90 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                        <Bot className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-foreground leading-tight">
                                AI Contract Assistant
                            </h3>
                            <Sparkles className="h-3 w-3 text-primary animate-pulse shrink-0" />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate leading-normal mt-0.5">
                            Find gaps, prioritize follow-ups or prepare a draft...
                        </p>
                    </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground/70 shrink-0" />
            </div>

            {/* Mobile Actions Bottom Sheet */}
            <AgreementsAiActionSheet
                open={isSheetOpen}
                onOpenChange={setIsSheetOpen}
                missingCount={missingCount}
                pendingCount={pendingCount}
                onAction={handleActionClick}
            />
        </section>
    );
});
