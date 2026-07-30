'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import type { VariableDefinition, TemplateVariable } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AlertTriangle, Link as LinkIcon } from 'lucide-react';
import { useSlashAutocomplete } from '@/hooks/use-slash-autocomplete';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkPicker } from './link-picker';
import { ensureAbsoluteUrl } from '@/lib/utils/url-helpers';

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
    placeholder = 'Write your message…',
    registerInsertCallback,
    contextLabels
}: PlainTextEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [showLinkPicker, setShowLinkPicker] = React.useState(false);
    const [trackVisitor, setTrackVisitor] = React.useState(false);

    const dropdownRef = React.useRef<HTMLDivElement>(null);

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

    const insertLink = React.useCallback((url: string, track: boolean) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        let finalUrl = url.startsWith('/') ? ensureAbsoluteUrl(url) : url;
        if (track) {
            const joiner = finalUrl.includes('?') ? '&' : '?';
            finalUrl = `${finalUrl}${joiner}ref={{encrypted_recipient_token}}`;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        const newValue = before + finalUrl + after;

        onChange(newValue);

        // Restore cursor position after the inserted URL
        requestAnimationFrame(() => {
            const newPos = start + finalUrl.length;
            textarea.setSelectionRange(newPos, newPos);
            textarea.focus();
        });
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
     * TemplateVariable schema required by useSlashAutocomplete.
     *
     * CAUTION: Must preserve FieldsVariablesService SSOT categories and keys without custom string splitting.
     * TESTABILITY: Autocomplete options reflect exact variable definitions from FieldsVariablesService.
     * RELATED SURFACES: FieldsVariablesService, useSlashAutocomplete.
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

    const {
        showAutocomplete,
        autocompleteCoords,
        autocompleteIndex,
        filteredVars,
        handleKeyDown,
        handleInputChange,
        handleSelectChange,
        selectAndInsert,
    } = useSlashAutocomplete({
        variables: templateVars,
        value,
        onChange,
    });

    const containerRef = React.useRef<HTMLDivElement>(null);
    const [coords, setCoords] = React.useState({ top: 0, left: 0 });

    const updateCoords = React.useCallback(() => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setCoords({
                top: rect.top + autocompleteCoords.top + window.scrollY,
                left: rect.left + autocompleteCoords.left + window.scrollX,
            });
        }
    }, [autocompleteCoords]);

    React.useEffect(() => {
        if (showAutocomplete) {
            updateCoords();
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
        }
        return () => {
            window.removeEventListener('scroll', updateCoords, true);
            window.removeEventListener('resize', updateCoords);
        };
    }, [showAutocomplete, updateCoords]);

    // Auto-scroll selected autocomplete item into view
    React.useEffect(() => {
        if (!dropdownRef.current) return;
        const activeEl = dropdownRef.current.querySelector('[data-active="true"]');
        if (activeEl) {
            activeEl.scrollIntoView({ block: 'nearest' });
        }
    }, [autocompleteIndex, showAutocomplete]);

    const handleTextAreaChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        handleInputChange(e);
    }, [onChange, handleInputChange]);

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
            <div ref={containerRef} className="relative">
                <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={handleTextAreaChange}
                    onKeyDown={handleKeyDown}
                    onSelect={handleSelectChange}
                    placeholder={placeholder}
                    className="min-h-[160px] font-mono text-sm resize-y rounded-2xl border-border/80 focus:border-primary focus:ring-1 focus:ring-primary/20 p-4 leading-relaxed"
                />

                {/* Autocomplete Dropdown */}
                {showAutocomplete && filteredVars.length > 0 && createPortal(
                    <div
                        ref={dropdownRef}
                        style={{
                            top: `${coords.top}px`,
                            left: `${coords.left}px`,
                        }}
                        className="fixed z-50 w-72 max-h-56 overflow-y-auto bg-popover/95 backdrop-blur-md border border-border shadow-xl rounded-xl p-1.5 space-y-0.5 animate-in fade-in-50 zoom-in-95 duration-100"
                    >
                        {filteredVars.map((v, index) => {
                            const isSelected = index === autocompleteIndex;
                            const ctx = v.context || 'common';
                            const labelText = contextLabels && contextLabels[ctx]
                                ? contextLabels[ctx]
                                : ctx.replace(/_/g, ' ');
                            
                            return (
                                <button
                                    key={v.id}
                                    type="button"
                                    data-active={isSelected ? 'true' : 'false'}
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        if (textareaRef.current) {
                                            selectAndInsert(v.name, textareaRef.current);
                                        }
                                    }}
                                    onTouchStart={(e) => {
                                        e.preventDefault();
                                        if (textareaRef.current) {
                                            selectAndInsert(v.name, textareaRef.current);
                                        }
                                    }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none min-h-[44px] justify-center touch-manipulation",
                                        isSelected
                                            ? "bg-primary text-primary-foreground"
                                            : "text-foreground hover:bg-muted"
                                    )}
                                >
                                    <span className="truncate w-full">{v.label}</span>
                                    <span className={cn("text-[9px] font-mono truncate w-full", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                                        {`{{${v.name}}}`} • {labelText}
                                    </span>
                                </button>
                            );
                        })}
                    </div>,
                    document.body
                )}
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

            {/* Variable insertion via VariablePicker removed as we now use Slash commands autocomplete */}
        </div>
    );
});
