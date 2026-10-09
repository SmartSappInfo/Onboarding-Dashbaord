'use client';

import * as React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { AlertTriangle, HelpCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ConfirmDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    tooltipText?: string;
    isLoading?: boolean;
    children?: React.ReactNode;
}

/**
 * ConfirmDialog
 * Standardized confirmation modal strictly conforming to theme.md Section 8 and .agents/AGENTS.md.
 * - Surface: border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl
 * - Header: <DialogHeader demarcated> with <CardInfoTooltip text="..." /> alongside title
 * - Accessibility: <DialogDescription className="sr-only">
 * - Footer: px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5
 * - Buttons: rounded-xl active:scale-[0.97] min-h-[40px]
 */
export function ConfirmDialog({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant = 'default',
    tooltipText,
    isLoading = false,
    children,
}: ConfirmDialogProps) {
    const isDestructive = variant === 'destructive';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-md flex flex-col p-0 overflow-hidden border border-border/80 bg-card text-card-foreground shadow-2xl sm:rounded-2xl font-figtree">
                <DialogHeader demarcated>
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-xl shrink-0",
                            isDestructive ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"
                        )}>
                            {isDestructive ? <AlertTriangle className="h-5 w-5" /> : <HelpCircle className="h-5 w-5" />}
                        </div>
                        <div className="flex items-center gap-2 min-w-0">
                            <DialogTitle className="text-base font-bold text-foreground truncate">{title}</DialogTitle>
                            <CardInfoTooltip text={tooltipText || description} />
                        </div>
                    </div>
                    <DialogDescription className="sr-only">{description}</DialogDescription>
                </DialogHeader>

                <div className="p-6 text-sm text-muted-foreground leading-relaxed">
                    <p>{description}</p>
                    {children && <div className="mt-4">{children}</div>}
                </div>

                <DialogFooter className="px-6 py-3.5 border-t border-border/80 bg-muted/15 flex flex-row items-center justify-end gap-2.5">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isLoading}
                        onClick={onClose}
                        className="rounded-xl border-border/80 text-xs font-semibold px-4 min-h-[40px] sm:min-h-[36px] active:scale-[0.97]"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        type="button"
                        variant={isDestructive ? 'destructive' : 'default'}
                        disabled={isLoading}
                        onClick={onConfirm}
                        className="rounded-xl text-xs font-semibold px-4 min-h-[40px] sm:min-h-[36px] active:scale-[0.97] shadow-sm"
                    >
                        {isLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                        {confirmText}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
