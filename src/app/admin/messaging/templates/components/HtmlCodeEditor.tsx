'use client';

import * as React from 'react';
import type { VariableDefinition, TemplateVariable } from '@/lib/types';
import { VariablePicker } from '@/components/messaging/VariablePicker';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSlashAutocomplete } from '@/hooks/use-slash-autocomplete';

interface HtmlCodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: VariableDefinition[];
    placeholder?: string;
    registerInsertCallback?: (cb: ((key: string) => void) | null) => void;
    contextLabels?: Record<string, string>;
}

/**
 * Split-pane HTML code editor with live iframe preview.
 * Loaded via next/dynamic({ ssr: false }) from the workshop.
 */
const HtmlCodeEditor = React.memo(function HtmlCodeEditor({
    value,
    onChange,
    variables,
    placeholder = '<!-- Write your HTML email here… -->',
    registerInsertCallback,
    contextLabels
}: HtmlCodeEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [validationWarnings, setValidationWarnings] = React.useState<string[]>([]);

    // Debounced preview value to avoid thrashing the iframe
    const deferredValue = React.useDeferredValue(value);

    // Map VariableDefinition to TemplateVariable format for useSlashAutocomplete
    const templateVars = React.useMemo<TemplateVariable[]>(() => {
        return variables.map(v => {
            let ctx = v.category;
            if (v.id.startsWith('survey_')) {
                const parts = v.id.split('_');
                ctx = `survey_${parts[1]}`;
            } else if (v.id.startsWith('pdf_')) {
                const parts = v.id.split('_');
                ctx = `pdf_${parts[1]}`;
            }

            return {
                id: v.id || v.key,
                name: v.key,
                label: v.label,
                description: `${v.label} (Source: ${v.source || 'system'})`,
                dataType: (v.type === 'number' ? 'number' : v.type === 'date' ? 'date' : 'string') as any,
                context: ctx as any,
                exampleValue: v.constantValue || `{{${v.key}}}`,
                isDynamic: v.source !== 'system',
                isComputed: false
            };
        });
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

    // Basic HTML validation
    React.useEffect(() => {
        if (!deferredValue) {
            setValidationWarnings([]);
            return;
        }
        const warnings: string[] = [];

        // Check for unclosed common tags
        const tagPairs = ['div', 'p', 'span', 'table', 'tr', 'td', 'a', 'h1', 'h2', 'h3', 'ul', 'ol', 'li'];
        for (const tag of tagPairs) {
            const openRegex = new RegExp(`<${tag}[\\s>]`, 'gi');
            const closeRegex = new RegExp(`</${tag}>`, 'gi');
            const openCount = (deferredValue.match(openRegex) || []).length;
            const closeCount = (deferredValue.match(closeRegex) || []).length;
            if (openCount > closeCount) {
                warnings.push(`Possible unclosed <${tag}> tag (${openCount} open, ${closeCount} closed)`);
            }
        }

        // Check for images without alt attributes
        const imgWithoutAlt = deferredValue.match(/<img(?![^>]*alt=)[^>]*>/gi);
        if (imgWithoutAlt?.length) {
            warnings.push(`${imgWithoutAlt.length} <img> tag(s) missing alt attribute`);
        }

        setValidationWarnings(warnings);
    }, [deferredValue]);

    const insertVariable = React.useCallback((key: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const tag = `{{${key}}}`;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const before = value.slice(0, start);
        const after = value.slice(end);
        onChange(before + tag + after);

        requestAnimationFrame(() => {
            const newPos = start + tag.length;
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

    return (
        <div className="space-y-3">
            {/* Validation warnings */}
            {validationWarnings.length > 0 && (
                <div
                    role="status"
                    aria-live="polite"
                    className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300"
                >
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <div className="space-y-0.5">
                        {validationWarnings.map((w, i) => (
                            <p key={i} className="text-[10px] font-semibold leading-relaxed">{w}</p>
                        ))}
                    </div>
                </div>
            )}

            {/* Split pane editor */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[600px]">
                {/* Left: Code editor */}
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            HTML Source
                        </span>
                        <Badge variant="outline" className="rounded-full h-5 px-2 text-[9px] font-bold tabular-nums">
                            {value.length} chars
                        </Badge>
                    </div>
                    <div className="relative flex-1 rounded-2xl shadow-2xl bg-slate-900 border border-slate-700">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={handleTextAreaChange}
                            onKeyDown={handleKeyDown}
                            onSelect={handleSelectChange}
                            placeholder={placeholder}
                            aria-label="HTML source code"
                            spellCheck={false}
                            className={cn(
                                'h-full min-h-[550px] rounded-2xl border-none shadow-none',
                                'font-mono text-sm leading-relaxed p-6',
                                'bg-slate-900 text-blue-400',
                                'placeholder:text-slate-600',
                                'focus-visible:ring-2 focus-visible:ring-blue-500/20 focus-visible:ring-inset',
                                'resize-none'
                            )}
                        />

                        {/* Floating Autocomplete Dropdown Popover */}
                        {showAutocomplete && filteredVars.length > 0 && (
                            <div
                                ref={dropdownRef}
                                style={{
                                    position: 'absolute',
                                    top: autocompleteCoords.top,
                                    left: autocompleteCoords.left,
                                    zIndex: 1000,
                                }}
                                className="w-64 max-h-60 overflow-y-auto rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-left text-popover-foreground scrollbar-thin scrollbar-thumb-muted"
                            >
                                {filteredVars.map((v, idx) => {
                                    const labelText = contextLabels && contextLabels[v.context]
                                        ? contextLabels[v.context]
                                        : String(v.context);
                                    
                                    const isSelected = idx === autocompleteIndex;
                                    
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
                                                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex flex-col gap-0.5 outline-none",
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
                            </div>
                        )}
                    </div>
                </div>

                {/* Right: Live preview */}
                <div className="flex flex-col space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
                            Live Preview
                        </span>
                        <Badge variant="secondary" className="rounded-full h-5 px-2 text-[9px] font-bold">
                            Sandboxed
                        </Badge>
                    </div>
                    <div className="flex-1 rounded-2xl overflow-hidden border bg-white dark:bg-slate-950 shadow-inner">
                        <iframe
                            srcDoc={deferredValue || '<p style="color: #999; font-family: sans-serif; padding: 20px;">Preview will appear here…</p>'}
                            sandbox="allow-same-origin"
                            title="Email preview"
                            width="100%"
                            height="550"
                            className="w-full h-full min-h-[550px] border-none bg-white"
                        />
                    </div>
                </div>
            </div>

            {/* Variable insertion via VariablePicker removed as we now use Slash commands autocomplete */}
        </div>
    );
});

export default HtmlCodeEditor;
