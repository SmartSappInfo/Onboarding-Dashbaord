'use client';

import * as React from 'react';
import type { VariableDefinition } from '@/lib/types';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HtmlCodeEditorProps {
    value: string;
    onChange: (value: string) => void;
    variables: VariableDefinition[];
    placeholder?: string;
}

/**
 * Split-pane HTML code editor with live iframe preview.
 * Loaded via next/dynamic({ ssr: false }) from the workshop.
 */
const HtmlCodeEditor = React.memo(function HtmlCodeEditor({
    value,
    onChange,
    variables,
    placeholder = '<!-- Write your HTML email here… -->'
}: HtmlCodeEditorProps) {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const [validationWarnings, setValidationWarnings] = React.useState<string[]>([]);

    // Debounced preview value to avoid thrashing the iframe
    const deferredValue = React.useDeferredValue(value);

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
                    <div className="flex-1 rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700">
                        <Textarea
                            ref={textareaRef}
                            value={value}
                            onChange={e => onChange(e.target.value)}
                            placeholder={placeholder}
                            aria-label="HTML source code"
                            spellCheck={false}
                            className={cn(
                                'h-full min-h-[550px] rounded-2xl border-none shadow-none',
                                'font-mono text-sm leading-relaxed p-6',
                                'bg-slate-900 text-blue-400',
                                'placeholder:text-slate-600',
                                'focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset',
                                'resize-none'
                            )}
                        />
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

            {/* Variable quick-insert row */}
            {variables.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border/30">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-1">
                        Insert Variables
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {variables.slice(0, 20).map(v => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => insertVariable(v.key)}
                                aria-label={`Insert variable ${v.label}`}
                                className={cn(
                                    'px-2.5 py-1 rounded-lg text-[9px] font-bold font-mono',
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

export default HtmlCodeEditor;
