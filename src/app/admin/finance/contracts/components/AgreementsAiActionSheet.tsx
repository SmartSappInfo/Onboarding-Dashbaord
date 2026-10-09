/**
 * AgreementsAiActionSheet.tsx
 *
 * Agreements Hub - Contextual AI Contract Assistant Mobile Action Sheet (Phase 3)
 *
 * Conforming strictly to:
 * - docs/agents_mcp/agents_mcp_rules.md (Rules 1-10, 13, 16, 17, 18, 21, 26, 30, 54)
 * - .agents/AGENTS.md (Modal & Dialog System Single Source of Truth)
 * - docs/billing/ui_enhancement/phase_3_ai_assistant_plan.md
 *
 * Architectural Invariants:
 * 1. Two-Phase Action Model (Rule 21): Quick actions execute as the Preview Phase
 *    (filtering records or opening settings drawers). They NEVER execute mutations
 *    or dispatch messages autonomously.
 * 2. Mobile-First Ergonomics (Rule 7): Optimized for one-thumb mobile interaction
 *    with min-h-[56px] tactile touch targets and Emil Kowalski active:scale-[0.97].
 * 3. Human-in-the-Loop Review: Legal and financial changes require explicit human
 *    confirmation prior to dispatch.
 */

'use client';

import * as React from 'react';
import { 
    Bot, 
    AlertCircle, 
    Clock, 
    Bell, 
    ArrowRight, 
    CheckCircle2
} from 'lucide-react';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { cn } from '@/lib/utils';

// ============================================================================
// Types & Contracts (Rule 4: Zero any / any[])
// ============================================================================

export type AiAssistantActionKey = 
    | 'find_missing' 
    | 'overdue_signatures' 
    | 'draft_reminder'
    | 'open_analysis';

export interface AgreementsAiActionSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    missingCount: number;
    pendingCount: number;
    onAction: (action: AiAssistantActionKey) => void;
}

// ============================================================================
// Component Implementation
// ============================================================================

export const AgreementsAiActionSheet = React.memo(function AgreementsAiActionSheet({
    open,
    onOpenChange,
    missingCount,
    pendingCount,
    onAction,
}: AgreementsAiActionSheetProps) {

    const handleSelectAction = React.useCallback((action: AiAssistantActionKey) => {
        onOpenChange(false);
        onAction(action);
    }, [onOpenChange, onAction]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent 
                side="bottom" 
                className="rounded-t-2xl sm:rounded-2xl border-t border-border/80 bg-card p-0 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
                {/* Demarcated Sheet Header */}
                <SheetHeader className="min-h-[56px] border-b border-border/80 bg-muted/20 px-6 py-4 flex flex-row items-center justify-between text-left">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                            <Bot className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5">
                                <SheetTitle className="text-base font-bold text-foreground">
                                    AI Contract Assistant
                                </SheetTitle>
                                <CardInfoTooltip text="AI Assistant surfaces contract coverage gaps, overdue signatures, and drafts follow-up reminders. Human review is required before executing changes." />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Smart workflow suggestions for your institutional agreements
                            </p>
                            <SheetDescription className="sr-only">
                                AI Contract Assistant mobile action drawer presenting recommendations and quick actions.
                            </SheetDescription>
                        </div>
                    </div>
                </SheetHeader>

                {/* Sheet Body with Action Cards */}
                <div className="p-6 space-y-4">
                    {/* Action Card 1: Find Missing Contracts */}
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectAction('find_missing')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectAction('find_missing'); } }}
                        className={cn(
                            "w-full rounded-2xl border border-border/80 bg-background/50 hover:bg-muted/30 p-4 transition-all duration-150 text-left cursor-pointer",
                            "active:scale-[0.97] shadow-2xs hover:shadow-sm flex items-center justify-between gap-4 group"
                        )}
                        aria-label={`Find Missing Contracts: ${missingCount} institutions need contracts. Tap to filter register.`}
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-inner">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-foreground truncate">
                                        Find Missing Contracts
                                    </h4>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                                        {missingCount} needed
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    Filter register to institutions without prepared agreements
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>

                    {/* Action Card 2: Prioritize Overdue Signatures */}
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectAction('overdue_signatures')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectAction('overdue_signatures'); } }}
                        className={cn(
                            "w-full rounded-2xl border border-border/80 bg-background/50 hover:bg-muted/30 p-4 transition-all duration-150 text-left cursor-pointer",
                            "active:scale-[0.97] shadow-2xs hover:shadow-sm flex items-center justify-between gap-4 group"
                        )}
                        aria-label={`Prioritize Overdue Signatures: ${pendingCount} agreements awaiting signature. Tap to view.`}
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-inner">
                                <Clock className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-foreground truncate">
                                        Prioritize Overdue Signatures
                                    </h4>
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                        {pendingCount} pending
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    Focus on sent agreements awaiting counterparty signature
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>

                    {/* Action Card 3: Draft a Reminder */}
                    <div 
                        role="button"
                        tabIndex={0}
                        onClick={() => handleSelectAction('draft_reminder')}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelectAction('draft_reminder'); } }}
                        className={cn(
                            "w-full rounded-2xl border border-border/80 bg-background/50 hover:bg-muted/30 p-4 transition-all duration-150 text-left cursor-pointer",
                            "active:scale-[0.97] shadow-2xs hover:shadow-sm flex items-center justify-between gap-4 group"
                        )}
                        aria-label="Draft a Reminder: Open reminder settings and notification rules. Tap to configure."
                    >
                        <div className="flex items-center gap-3.5 min-w-0">
                            <div className="w-11 h-11 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 shadow-inner">
                                <Bell className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-bold text-foreground truncate">
                                        Draft Follow-Up Reminders
                                    </h4>
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                    Review and customize automated reminder rules and templates
                                </p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                    </div>

                    {/* Human-in-the-Loop & Trust Boundary Disclosure (Rule 13 & 21) */}
                    <div className="rounded-xl border border-border/60 bg-muted/20 p-3.5 flex items-start gap-2.5 text-left">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                            <strong className="text-foreground font-semibold">Human Review Guarantee:</strong> All AI suggestions apply search filters or open preview drawers. No legal agreements or messages are ever dispatched without explicit human confirmation.
                        </p>
                    </div>
                </div>

                {/* Demarcated Sheet Footer */}
                <div className="px-6 py-4 border-t border-border/80 bg-muted/15 flex items-center justify-end">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl font-bold text-xs h-9 px-4 active:scale-[0.97] min-h-[44px] sm:min-h-0"
                    >
                        Close
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
});
