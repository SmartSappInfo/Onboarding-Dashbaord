'use client';

import * as React from 'react';
import type { VariableDefinition } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PlainTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: VariableDefinition[];
    channel: 'email' | 'sms';
    maxLength?: number;
    placeholder?: string;
}

/**
 * Lightweight plain-text editor with variable insertion and SMS segment counting.
 * Used for SMS templates and plain_text email templates.
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
                        isOverLimit && 'ring-2 ring-destructive/50'
                    )}
                />
            </div>

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
                                className="rounded-full h-6 px-3 text-[10px] font-bold tabular-nums"
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
