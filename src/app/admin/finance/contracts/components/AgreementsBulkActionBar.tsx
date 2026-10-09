/**
 * AgreementsBulkActionBar.tsx
 *
 * Agreements Hub - Contextual Floating Bulk Action Bar (Phase 4)
 *
 * Conforming strictly to:
 * - docs/agents_mcp/agents_mcp_rules.md (Rules 1-10, 13, 16, 17, 18, 21, 23, 50, 54)
 * - docs/billing/ui_enhancement/agreements_hub_enhancement.md (Section 3 & 4)
 * - docs/billing/ui_enhancement/phase_4_filter_and_bulk_bar_plan.md
 *
 * Architectural Invariants:
 * 1. Safe Viewport Docking (Rule 7): Positioned at bottom-20 on mobile viewports to
 *    prevent overlapping the AgreementsMobileBottomNav (which sits at bottom-0 h-16),
 *    and bottom-8 on desktop viewports.
 * 2. Chunked Execution Safeguard (Rule 23): Visual warning indicator when selection
 *    exceeds the 50-entity client batch processing limit to avoid transaction timeouts.
 * 3. Two-Phase Action Model (Rule 21): Clicking actions opens preview/confirmation
 *    wizards; mutations are never executed silently without human confirmation.
 * 4. Emil Kowalski Tactile Motion: active:scale-[0.97] on all interactive buttons.
 * 5. Zero Any (Rule 4): Strictly typed interfaces without unchecked assertions.
 */

'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    ShieldCheck, 
    Zap, 
    Send, 
    Download, 
    X, 
    AlertTriangle 
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Contracts (Rule 4: Zero any / any[])
// ============================================================================

export interface AgreementsBulkActionBarProps {
    selectedCount: number;
    totalMatchingCount: number;
    onPrepareContracts: () => void;
    onSendBatchReminders: () => void;
    onExportSelection: () => void;
    onClearSelection: () => void;
    canPrepareContracts?: boolean;
    hasPendingSignatures?: boolean;
    isLoading?: boolean;
}

// Client batch safety cap (Rule 23)
const MAX_BATCH_CAP = 50;

// ============================================================================
// Component Implementation
// ============================================================================

export const AgreementsBulkActionBar = React.memo(function AgreementsBulkActionBar({
    selectedCount,
    totalMatchingCount,
    onPrepareContracts,
    onSendBatchReminders,
    onExportSelection,
    onClearSelection,
    canPrepareContracts = true,
    hasPendingSignatures = false,
    isLoading = false
}: AgreementsBulkActionBarProps) {
    const isExceedingBatchCap = selectedCount > MAX_BATCH_CAP;

    return (
        <AnimatePresence>
            {selectedCount > 0 && (
                <motion.div
                    initial={{ y: 80, opacity: 0, scale: 0.96 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: 80, opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:bottom-8 left-3 right-3 sm:left-1/2 sm:right-auto sm:-translate-x-1/2 z-40 sm:z-[100] w-auto max-w-xl mx-auto"
                >
                    <Card className="border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                        <CardContent className="p-2 sm:px-4 sm:py-2.5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 sm:gap-4">
                            {/* Counter & Status Badge */}
                            <div className="flex items-center gap-2.5 pl-2 sm:pl-0">
                                <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                                    <ShieldCheck className="h-4 w-4" />
                                </div>
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs sm:text-sm font-bold tracking-tight text-foreground whitespace-nowrap">
                                            {selectedCount} Selected
                                        </span>
                                        {totalMatchingCount > selectedCount && (
                                            <span className="text-[11px] text-muted-foreground hidden sm:inline">
                                                of {totalMatchingCount}
                                            </span>
                                        )}
                                    </div>
                                    {isExceedingBatchCap && (
                                        <span className="text-[10px] text-amber-600 font-semibold flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            <span>Cap: 50 per run</span>
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap ml-auto">
                                {/* Prepare Contracts CTA */}
                                {canPrepareContracts && (
                                    <Button
                                        size="sm"
                                        onClick={onPrepareContracts}
                                        disabled={isLoading}
                                        className="h-10 min-h-[44px] sm:h-9 px-3.5 sm:px-4 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-[0.97] gap-1.5"
                                    >
                                        <Zap className="h-3.5 w-3.5" />
                                        <span>Prepare ({Math.min(selectedCount, MAX_BATCH_CAP)})</span>
                                    </Button>
                                )}

                                {/* Send Reminders CTA */}
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onSendBatchReminders}
                                    disabled={isLoading || !hasPendingSignatures}
                                    title={!hasPendingSignatures ? "No selected entities are awaiting signature" : undefined}
                                    className={cn(
                                        "h-10 min-h-[44px] sm:h-9 px-3 sm:px-3.5 rounded-xl font-semibold text-xs border-border/80 hover:bg-muted/60 transition-all active:scale-[0.97] gap-1.5",
                                        !hasPendingSignatures && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Send className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Send</span> Reminders
                                </Button>

                                {/* Export Selection to CSV */}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={onExportSelection}
                                    disabled={isLoading}
                                    className="h-10 min-h-[44px] sm:h-9 px-2.5 sm:px-3 rounded-xl font-semibold text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-[0.97] gap-1.5"
                                >
                                    <Download className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Export</span>
                                </Button>

                                {/* Clear Selection Button */}
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={onClearSelection}
                                    disabled={isLoading}
                                    aria-label="Clear all selections"
                                    className="h-10 w-10 min-h-[44px] sm:h-9 sm:w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all active:scale-[0.97]"
                                >
                                    <X className="h-4 w-4" />
                                </Button>

                                <CardInfoTooltip text="Bulk actions apply to the currently checked institutions. Batch preparation processes up to 50 entities at a time to ensure reliable contract generation." />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </AnimatePresence>
    );
});
