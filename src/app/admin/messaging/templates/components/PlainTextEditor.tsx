'use client';

import * as React from 'react';
import type { VariableDefinition } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface PlainTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: VariableDefinition[];
    channel: 'email' | 'sms';
    maxLength?: number;
    placeholder?: string;
}

/**
 * Lightweight plain-text editor with variable insertion, SMS segment counting,
 * and live token syntax validation.
 *
 * Performance notes (Vercel React Best Practices):
 * - Token validation uses a memoized Set for O(1) lookups
 * - Invalid tokens are derived via useMemo — no effect loops
 * - Debouncing is unnecessary because Set.has() is sub-microsecond
 */
export const PlainTextEditor = React.memo(function PlainTextEditor({
    value,
    onChange,
    variables,
    channel,
    maxLength,
    placeholder = 'Write your message…'
}: PlainTextEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const insertVariable = React.useCallback((key: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const tag = `{{${key}}}`;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newValue = before + tag + after;

        onChange(newValue);

        // Restore cursor position after the inserted tag
        requestAnimationFrame(() => {
            const newPos = start + tag.length;
            textarea.setSelectionRange(newPos, newPos);
            textarea.focus();
        });
    }, [value, onChange]);

    // O(1) lookup set for allowed variable keys — rebuilt only when variables change
    const allowedKeySet = React.useMemo(
        () => new Set(variables.map(v => v.key)),
        [variables]
    );

    // Live Token Syntax Validation:
    // Single-pass regex extracts all {{token}} instances, then validates against
    // the allowedKeySet. Invalid tokens are surfaced in a warning banner.
    const invalidTokens = React.useMemo(() => {
        if (!value) return [];
        const matches = value.match(/\{\{([^{}]+?)\}\}/g);
        if (!matches) return [];
        const tokens = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
        return tokens.filter(token => !allowedKeySet.has(token));
    }, [value, allowedKeySet]);

    // SMS segment calculation
    const smsSegments = React.useMemo(() => {
        if (channel !== 'sms') return null;
        const len = value.length;
        if (len <= 160) return { count: 1, remaining: 160 - len, charCount: len };
        return {
            count: Math.ceil(len / 153),
            remaining: (Math.ceil(len / 153) * 153) - len,
            charCount: len
        };
    }, [value, channel]);

    const charCount = value.length;
    const isOverLimit = maxLength ? charCount > maxLength : false;

    return (
        <div className="space-y-3">
            <div className="relative">
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={e => onChange(e.target.value)}
                    placeholder={placeholder}
                    aria-label={channel === 'sms' ? 'SMS message body' : 'Email body content'}
                    className={cn(
                        'min-h-[300px] rounded-2xl bg-muted/20 border-none shadow-inner p-6',
                        'text-base leading-relaxed font-medium',
                        'focus-visible:ring-2 focus-visible:ring-primary/30',
                        'transition-shadow duration-200',
                        isOverLimit && 'ring-2 ring-destructive/50',
                        invalidTokens.length > 0 && 'ring-2 ring-amber-500/40'
                    )}
                />
            </div>

            {/* Live Token Syntax Warning Banner */}
            {invalidTokens.length > 0 && (
                <div
                    className="animate-in slide-in-from-top-2 duration-300 bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
                    role="alert"
                    aria-live="polite"
                >
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 min-w-0">
                        <p className="text-[11px] font-bold text-amber-700 dark:text-amber-300">
                            {invalidTokens.length} unsupported variable{invalidTokens.length > 1 ? 's' : ''} detected
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                            {invalidTokens.map(token => (
                                <code
                                    key={token}
                                    className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-mono font-bold border border-amber-500/20"
                                >
                                    {`{{${token}}}`}
                                </code>
                            ))}
                        </div>
                        <p className="text-[9px] text-amber-600/70 dark:text-amber-400/70 font-medium leading-relaxed">
                            These tokens are not in the contextual registry for this category. They will render as raw text in sent messages.
                        </p>
                    </div>
                </div>
            )}

            {/* Status bar */}
            <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                    {channel === 'sms' && smsSegments ? (
                        <>
                            <Badge variant="outline" className="rounded-full h-6 px-3 text-[10px] font-bold tabular-nums">
                                {smsSegments.charCount} chars
                            </Badge>
                            <Badge
                                variant={smsSegments.count > 1 ? 'secondary' : 'outline'}
                                className={cn(
                                    "rounded-full h-6 px-3 text-[10px] font-bold tabular-nums",
                                    smsSegments.count > 1 && "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                )}
                            >
                                {smsSegments.count} {smsSegments.count === 1 ? 'segment' : 'segments'}
                            </Badge>
                            <span className="text-[9px] font-semibold text-muted-foreground tabular-nums">
                                {smsSegments.remaining} chars remaining in segment
                            </span>
                        </>
                    ) : (
                        <Badge
                            variant={isOverLimit ? 'destructive' : 'outline'}
                            className="rounded-full h-6 px-3 text-[10px] font-bold tabular-nums"
                        >
                            {charCount}{maxLength ? ` / ${maxLength}` : ''} characters
                        </Badge>
                    )}
                </div>
            </div>

            {/* Variable quick-insert row */}
            {variables.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                        Quick Insert Variables
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {variables.slice(0, 20).map(v => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => insertVariable(v.key)}
                                aria-label={`Insert variable ${v.label}`}
                                className={cn(
                                    'px-2.5 py-1 rounded-lg text-[9px] font-bold',
                                    'bg-primary/5 text-primary border border-primary/10',
                                    'hover:bg-primary/10 hover:border-primary/20',
                                    'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:outline-none',
                                    'transition-colors duration-150'
                                )}
                            >
                                {'{{'}
                                {v.key}
                                {'}}'}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});
