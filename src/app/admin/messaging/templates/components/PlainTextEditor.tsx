'use client';

import * as React from 'react';
import type { VariableDefinition, TemplateVariable } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkPicker } from './link-picker';
import { ensureAbsoluteUrl } from '@/lib/utils/url-helpers';
import { SlashTextarea, convertToCleanHtml } from '@/components/messaging/SlashInput';

/** Single SMS segment character limit (GSM-7 standard) */
const SMS_SINGLE_SEGMENT_LIMIT = 160;
/** Multi-part concatenated SMS segment character limit (6 bytes header per segment) */
const SMS_CONCAT_SEGMENT_LIMIT = 153;

interface PlainTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: VariableDefinition[];
    channel: 'email' | 'sms';
    maxLength?: number;
    placeholder?: string;
    registerInsertCallback?: (cb: ((key: string) => void) | null) => void;
    contextLabels?: Record<string, string>;
}

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * PlainTextEditor Component: Renders SMS & Plain Text message templates with interactive
 * variable pills, slash-command (/autocomplete), fallback configuration, and SMS segment analysis.
 *
 * CAUTION:
 * 1. Uses SlashTextarea to convert double-brace variables (e.g. {{entity_name | Your School}}) into visual pills.
 * 2. Token validation MUST extract the clean primary key (split on | or ||) before checking allowedKeySet.
 * 3. Text insertion callbacks (insertVariable, insertLink) support both standard Textarea and SlashTextarea contentEditable refs.
 *
 * TESTABILITY: Tested via vitest in plain-text-editor.test.tsx & visual-block.formatting.test.tsx.
 * RELATED SURFACES: SlashTextarea, template-workshop.tsx, FieldsVariablesService.
 */
export const PlainTextEditor = React.memo(function PlainTextEditor({
    value,
    onChange,
    variables,
    channel,
    maxLength,
    placeholder = 'Write your message…',
    registerInsertCallback,
    contextLabels
}: PlainTextEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [showLinkPicker, setShowLinkPicker] = React.useState(false);
    const [trackVisitor, setTrackVisitor] = React.useState(true);

    const insertVariable = React.useCallback((key: string) => {
        const textarea = textareaRef.current;
        const tag = `{{${key}}}`;

        if (!textarea) {
            onChange(value ? `${value} ${tag}` : tag);
            return;
        }

        const isStandardInput = 'selectionStart' in textarea && typeof textarea.selectionStart === 'number';
        if (isStandardInput) {
            const start = (textarea as unknown as HTMLTextAreaElement).selectionStart;
            const end = (textarea as unknown as HTMLTextAreaElement).selectionEnd;
            const before = value.slice(0, start);
            const after = value.slice(end);
            const newValue = before + tag + after;
            onChange(newValue);

            requestAnimationFrame(() => {
                const newPos = start + tag.length;
                (textarea as unknown as HTMLTextAreaElement).setSelectionRange(newPos, newPos);
                (textarea as unknown as HTMLTextAreaElement).focus();
            });
        } else {
            // ContentEditable SlashTextarea DOM element
            const el = textarea as unknown as HTMLElement;
            el.focus();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const node = document.createTextNode(tag);
                range.insertNode(node);
                range.setStartAfter(node);
                range.setEndAfter(node);
                selection.removeAllRanges();
                selection.addRange(range);
                const cleanVal = convertToCleanHtml(el, false);
                onChange(cleanVal);
            } else {
                onChange(value ? `${value} ${tag}` : tag);
            }
        }
    }, [value, onChange]);

    const insertLink = React.useCallback((url: string, track: boolean) => {
        const textarea = textareaRef.current;

        let finalUrl = url.startsWith('/') ? ensureAbsoluteUrl(url) : url;
        if (track) {
            const joiner = finalUrl.includes('?') ? '&' : '?';
            finalUrl = `${finalUrl}${joiner}ref={{encrypted_recipient_token}}`;
        }

        if (!textarea) {
            onChange(value ? `${value}${finalUrl}` : finalUrl);
            return;
        }

        const isStandardInput = 'selectionStart' in textarea && typeof textarea.selectionStart === 'number';
        if (isStandardInput) {
            const start = (textarea as unknown as HTMLTextAreaElement).selectionStart;
            const end = (textarea as unknown as HTMLTextAreaElement).selectionEnd;
            const before = value.slice(0, start);
            const after = value.slice(end);
            const newValue = before + finalUrl + after;

            onChange(newValue);

            requestAnimationFrame(() => {
                const newPos = start + finalUrl.length;
                (textarea as unknown as HTMLTextAreaElement).setSelectionRange(newPos, newPos);
                (textarea as unknown as HTMLTextAreaElement).focus();
            });
        } else {
            // ContentEditable SlashTextarea DOM element
            const el = textarea as unknown as HTMLElement;
            el.focus();
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0 && el.contains(selection.anchorNode)) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const node = document.createTextNode(finalUrl);
                range.insertNode(node);
                range.setStartAfter(node);
                range.setEndAfter(node);
                selection.removeAllRanges();
                selection.addRange(range);
                const cleanVal = convertToCleanHtml(el, false);
                onChange(cleanVal);
            } else {
                onChange(value ? `${value}${finalUrl}` : finalUrl);
            }
        }
    }, [value, onChange]);

    React.useEffect(() => {
        if (registerInsertCallback) {
            registerInsertCallback(insertVariable);
        }
        return () => {
            if (registerInsertCallback) registerInsertCallback(null);
        };
    }, [insertVariable, registerInsertCallback]);

    // O(1) lookup set for allowed variable keys — rebuilt only when variables change.
    // Includes system tracking variables like 'encrypted_recipient_token' to prevent false-positive warnings.
    const allowedKeySet = React.useMemo(() => {
        const set = new Set(variables.map(v => v.key));
        set.add('encrypted_recipient_token');
        return set;
    }, [variables]);

    /**
     * PURPOSE: Maps VariableDefinition items provided by FieldsVariablesService to
     * TemplateVariable schema required by useSlashAutocomplete and SlashTextarea.
     *
     * CAUTION: Must preserve FieldsVariablesService SSOT categories and keys without custom string splitting.
     * TESTABILITY: Autocomplete options reflect exact variable definitions from FieldsVariablesService.
     * RELATED SURFACES: FieldsVariablesService, SlashTextarea, useSlashAutocomplete.
     */
    const templateVars = React.useMemo<TemplateVariable[]>(() => {
        return variables.map(v => ({
            id: v.id || v.key,
            name: v.key,
            label: v.label,
            description: `${v.label} (Source: ${v.source || 'system'})`,
            dataType: (v.type === 'number' ? 'number' : v.type === 'date' ? 'date' : 'string') as any,
            context: (v.source || v.category || 'common') as any,
            exampleValue: v.constantValue || `{{${v.key}}}`,
            isDynamic: v.source !== 'system',
            isComputed: false
        }));
    }, [variables]);

    /**
     * Live Token Syntax Validation:
     * Single-pass regex extracts all {{token}} instances.
     *
     * CAUTION: Splits tokens on | or || to extract the primary variable key (e.g. 'entity_name' from 'entity_name | Your School')
     * before checking allowedKeySet. This prevents false-positive warnings when fallback text is configured.
     */
    const invalidTokens = React.useMemo(() => {
        if (!value) return [];
        const matches = value.match(/\{\{([^{}]+?)\}\}/g);
        if (!matches) return [];
        const rawTokens = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))];
        return rawTokens.filter(rawToken => {
            const keyOnly = rawToken.split(/\|\||\|/)[0].trim();
            return !allowedKeySet.has(keyOnly);
        });
    }, [value, allowedKeySet]);

    // SMS segment calculation using named constants
    const smsSegments = React.useMemo(() => {
        if (channel !== 'sms') return null;
        const len = value.length;
        if (len <= SMS_SINGLE_SEGMENT_LIMIT) {
            return { count: 1, remaining: SMS_SINGLE_SEGMENT_LIMIT - len, charCount: len };
        }
        const count = Math.ceil(len / SMS_CONCAT_SEGMENT_LIMIT);
        return {
            count,
            remaining: (count * SMS_CONCAT_SEGMENT_LIMIT) - len,
            charCount: len
        };
    }, [value, channel]);

    const charCount = value.length;
    const isOverLimit = maxLength ? charCount > maxLength : false;

    return (
        <div className="space-y-3">
            <div className="relative">
                <SlashTextarea
                    ref={textareaRef}
                    value={value}
                    onChange={onChange}
                    variables={templateVars}
                    enableFormatting={false}
                    placeholder={placeholder}
                    className="min-h-[160px] font-mono text-sm rounded-2xl border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 p-4 leading-relaxed bg-background text-foreground shadow-sm"
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2">
                <div className="flex flex-wrap items-center gap-2">
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

            {/* Link Picker section */}
            <div className="border border-border/80 rounded-2xl p-3 sm:p-4 bg-muted/5 space-y-4 text-left mt-4 transition-all duration-200">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                        <LinkIcon className="h-3.5 w-3.5 text-primary" /> Insert Link with Tracking
                    </span>
                    <button
                        type="button"
                        onClick={() => setShowLinkPicker(prev => !prev)}
                        className={cn(
                            "flex items-center justify-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-full border transition-all active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 min-h-[44px] sm:min-h-0 w-full sm:w-auto",
                            showLinkPicker
                                ? "text-white bg-primary border-primary/20 hover:bg-primary/95"
                                : "text-primary bg-primary/[0.04] border-primary/10 hover:bg-primary/[0.08]"
                        )}
                    >
                        {showLinkPicker ? 'Hide Link Picker' : 'Choose Link Target'}
                    </button>
                </div>

                {showLinkPicker && (
                    <div className="space-y-4 p-4 bg-background border border-border rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-center space-x-2 px-1">
                            <Checkbox
                                id="sms-track-visitor"
                                checked={trackVisitor}
                                onCheckedChange={(checked) => setTrackVisitor(Boolean(checked))}
                                className="rounded-md"
                            />
                            <label
                                htmlFor="sms-track-visitor"
                                className="text-[10px] font-semibold text-muted-foreground cursor-pointer select-none leading-none"
                            >
                                Track Visitor Identity (Encrypt Recipient Details)
                            </label>
                        </div>
                        <LinkPicker
                            onSelect={(url) => {
                                insertLink(url, trackVisitor);
                                setShowLinkPicker(false);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});
