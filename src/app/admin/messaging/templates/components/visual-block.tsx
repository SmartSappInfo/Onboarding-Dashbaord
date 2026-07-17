'use client';

import * as React from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
    GripVertical, 
    ArrowUp, 
    ArrowDown, 
    ArrowUpToLine,
    ArrowDownToLine,
    Copy, 
    Trash2, 
    Heading1, 
    Type, 
    Image as ImageIcon, 
    Video, 
    MousePointer2, 
    Quote, 
    Square, 
    List, 
    Trophy,
    Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { MessageBlock, TemplateVariable } from '@/lib/types';
import { resolveVariables } from '@/lib/messaging-utils';
import { useDroppable } from '@dnd-kit/core';
import { blockIcons } from './block-icons';
import { SlashInput, SlashTextarea } from '@/components/messaging/SlashInput';

interface VisualBlockProps {
    block: MessageBlock;
    simulationVars: Record<string, unknown>;
    isEditing?: boolean;
    onContentUpdate?: (props: Partial<MessageBlock>) => void;
    autocompleteVariables?: TemplateVariable[];
    // Sub-block handlers
    selectedSubBlockId?: string | null;
    onSelectSubBlock?: (subBlockId: string) => void;
    onRemoveSubBlock?: (parentBlockId: string, colIdx: number, subBlockId: string) => void;
    onDuplicateSubBlock?: (parentBlockId: string, colIdx: number, subBlockId: string) => void;
    onSwapSubBlocks?: (parentBlockId: string, colIdx: number, a: number, b: number) => void;
    onUpdateSubBlock?: (subBlockId: string, updates: Partial<MessageBlock>) => void;
}

interface SafeHtmlProps {
    html: string;
}

export function SafeHtml({ html }: SafeHtmlProps) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) {
        // Strip HTML tags for clean server-rendered preview
        const stripped = html.replace(/<[^>]*>/g, '');
        
        // Render variable text with normal styling during SSR (no HTML tags)
        const parts = stripped.split(/(\{\{[\w_]+\}\})/g);
        return (
            <span className="whitespace-pre-wrap">
                {parts.map((part, i) => {
                    if (part.startsWith('{{') && part.endsWith('}}')) {
                        return (
                            <span 
                                key={i} 
                                className="inline-flex items-center mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none"
                            >
                                {part.slice(2, -2)}
                            </span>
                        );
                    }
                    return part;
                })}
            </span>
        );
    }

    return <React.Fragment>{renderHtmlWithVariablePills(html)}</React.Fragment>;
}

export function renderHtmlWithVariablePills(html: string): React.ReactNode {
    if (!html) return null;
    if (typeof window === 'undefined') {
        return <span className="whitespace-pre-wrap">{html}</span>;
    }
    
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
        const root = doc.body.firstChild || doc.body;

        const renderNode = (node: Node, key: string): React.ReactNode => {
            if (node.nodeType === Node.TEXT_NODE) {
                const textContent = node.textContent || '';
                const parts = textContent.split(/(\{\{[\w_]+\}\})/g);
                return (
                    <React.Fragment key={key}>
                        {parts.map((part, i) => {
                            if (part.startsWith('{{') && part.endsWith('}}')) {
                                const varName = part.slice(2, -2);
                                return (
                                    <span 
                                        key={i} 
                                        className="inline-flex items-center mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none"
                                    >
                                        {varName}
                                    </span>
                                );
                            }
                            return part;
                        })}
                    </React.Fragment>
                );
            }

                        if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                const tagName = el.tagName.toLowerCase();
                
                const whitelist = ['strong', 'b', 'em', 'i', 'u', 'del', 's', 'strike', 'span', 'font', 'br', 'p', 'div'];
                if (!whitelist.includes(tagName)) {
                    return null;
                }

                const children = Array.from(el.childNodes).map((child, index) => 
                    renderNode(child, `${key}-${index}`)
                );

                const styleObj: Record<string, string> = {};
                const styleAttr = el.getAttribute('style');
                if (styleAttr) {
                    styleAttr.split(';').forEach(s => {
                        const idx = s.indexOf(':');
                        if (idx !== -1) {
                            const prop = s.substring(0, idx).trim();
                            const val = s.substring(idx + 1).trim();
                            if (prop && val) {
                                const jsProp = prop.replace(/-([a-z])/g, g => g[1].toUpperCase());
                                styleObj[jsProp] = val;
                            }
                        }
                    });
                }

                switch (tagName) {
                    case 'strong':
                    case 'b':
                        return <strong key={key} style={styleObj as React.CSSProperties}>{children}</strong>;
                    case 'em':
                    case 'i':
                        return <em key={key} style={styleObj as React.CSSProperties}>{children}</em>;
                    case 'u':
                        return <u key={key} style={styleObj as React.CSSProperties}>{children}</u>;
                    case 'del':
                    case 's':
                    case 'strike':
                        return <del key={key} style={styleObj as React.CSSProperties}>{children}</del>;
                    case 'span':
                        return <span key={key} style={styleObj as React.CSSProperties}>{children}</span>;
                    case 'font':
                        // Handle font tag color overrides inline
                        const fontColor = el.getAttribute('color');
                        if (fontColor) {
                            styleObj.color = fontColor;
                        }
                        return <span key={key} style={styleObj as React.CSSProperties}>{children}</span>;
                    default:
                        return <React.Fragment key={key}>{children}</React.Fragment>;
                }
            }

            return null;
        };

        return Array.from(root.childNodes).map((child, index) => renderNode(child, `r-${index}`));
    } catch (err) {
        console.error('Failed to parse text formatting:', err);
        return <span className="whitespace-pre-wrap">{html}</span>;
    }
}

function renderTextWithVariablePills(text: string): React.ReactNode {
    if (!text) return null;
    const parts = text.split(/(\{\{[^{}]+\}\})/g);
    return (
        <span className="whitespace-pre-wrap">
            {parts.map((part, i) => {
                if (part.startsWith('{{') && part.endsWith('}}')) {
                    const varName = part.slice(2, -2).trim();
                    return (
                        <span 
                            key={i} 
                            className="inline-flex items-center mx-0.5 px-2 py-0.5 rounded bg-blue-100/80 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono text-[90%] font-bold border border-blue-200/50 align-baseline select-none"
                        >
                            {varName}
                        </span>
                    );
                }
                return part;
            })}
        </span>
    );
}

const ensureUnit = (val: string | number | undefined, defaultUnit = 'px'): string => {
    if (val === undefined || val === null || val === '') return '';
    const str = String(val);
    if (str.endsWith('px') || str.endsWith('%') || str.endsWith('pt') || str.endsWith('em') || str.endsWith('rem')) {
        return str;
    }
    return `${str}${defaultUnit}`;
};

export function VisualBlock({ 
    block, 
    simulationVars, 
    isEditing, 
    onContentUpdate,
    autocompleteVariables,
    selectedSubBlockId,
    onSelectSubBlock,
    onRemoveSubBlock,
    onDuplicateSubBlock,
    onSwapSubBlocks,
    onUpdateSubBlock
}: VisualBlockProps) {
    const s = block.style || {};
    const align = s.textAlign || 'left';
    
    const resolvedTitle = resolveVariables(block.title || '', simulationVars);
    const resolvedContent = resolveVariables(block.content || '', simulationVars);
    const resolvedUrl = resolveVariables(block.url || '', simulationVars);

    const alignmentClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : align === 'justify' ? 'text-justify' : 'text-left';
    const alignFlexClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
    
    // Detailed Spacing
    const paddingTop = ensureUnit(s.paddingTop);
    const paddingBottom = ensureUnit(s.paddingBottom);
    const paddingLeft = ensureUnit(s.paddingLeft);
    const paddingRight = ensureUnit(s.paddingRight);

    const spacingStyle = {
        paddingTop: paddingTop || undefined,
        paddingBottom: paddingBottom || undefined,
        paddingLeft: paddingLeft || undefined,
        paddingRight: paddingRight || undefined,
        marginTop: s.marginTop ? ensureUnit(s.marginTop) : undefined,
        marginBottom: s.marginBottom ? ensureUnit(s.marginBottom) : undefined,
    };

    // Border and Corner radius
    const borderStyle = {
        borderWidth: s.borderWidth ? ensureUnit(s.borderWidth) : undefined,
        borderStyle: s.borderStyle || undefined,
        borderColor: s.borderColor || undefined,
        borderRadius: s.borderRadius ? ensureUnit(s.borderRadius) : undefined,
    };

    // Typography
    const typographyStyle = {
        fontSize: s.fontSize ? ensureUnit(s.fontSize) : (s.width ? ensureUnit(s.width) : undefined),
        fontFamily: s.fontFamily || undefined,
        color: s.color || undefined,
        fontWeight: s.fontWeight || undefined,
        lineHeight: s.lineHeight || undefined,
        textAlign: align as any,
    };

    const combinedStyle = {
        ...spacingStyle,
        ...borderStyle,
        ...typographyStyle,
        backgroundColor: s.backgroundColor || undefined,
    };

    switch (block.type) {
        case 'heading': {
            const Tag = block.variant || 'h2';
            const variant = s.variant || 'standard';
            const sizeClass = Tag === 'h1' ? "text-3xl font-extrabold" : Tag === 'h2' ? "text-2xl font-bold" : "text-lg font-semibold";
            const pillTextVal = block.pillText || '';
            const contentVal = block.content || '';

            const isLeftAccent = variant === 'left_accent';
            const isDarkSlate = variant === 'dark_slate';
            const isEnvelopeBadge = variant === 'envelope_badge';
            const isNestedCard = variant === 'nested_card';
            const isSimpleWide = variant === 'simple_wide';

            const align = s.textAlign || (isDarkSlate || isEnvelopeBadge || isSimpleWide ? 'center' : 'left');
            const customAlignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
            const customFlexAlignClass = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';

            const outerStyle: React.CSSProperties = {
                ...spacingStyle,
                ...borderStyle,
                backgroundColor: s.backgroundColor || undefined,
                backgroundImage: s.backgroundImage || undefined,
                backgroundSize: s.backgroundSize || undefined,
                borderLeft: isLeftAccent ? '4px solid #2563eb' : undefined,
            };

            const headingStyle: React.CSSProperties = {
                ...typographyStyle,
                margin: 0,
                padding: 0,
                border: 'none',
                backgroundColor: 'transparent',
                color: isDarkSlate ? '#ffffff' : (s.color || '#0f172a'),
            };

            return (
                <div 
                    className={cn("w-full transition-all duration-200 select-text", customAlignClass)} 
                    style={outerStyle}
                >
                    {/* Badge/Pill */}
                    {block.pillText !== undefined && (
                        <div className={cn("mb-2.5 flex", customFlexAlignClass)}>
                            {isDarkSlate ? (
                                isEditing ? (
                                    <SlashInput
                                        value={pillTextVal}
                                        onChange={(val) => onContentUpdate?.({ pillText: val })}
                                        variables={autocompleteVariables}
                                        className="bg-transparent border-none outline-none font-black tracking-wider text-blue-300 uppercase p-0 m-0 w-auto text-center focus:ring-0 focus:outline-none h-auto"
                                        placeholder="Date / Label"
                                        style={{ width: `${Math.max(pillTextVal.length || 12, 4)}ch`, fontSize: '11px' }}
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="font-black tracking-wider text-blue-300 uppercase text-[11px] select-text">
                                        {renderTextWithVariablePills(pillTextVal)}
                                    </span>
                                )
                            ) : (
                                <span className="inline-flex items-center bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-xs font-semibold select-text border border-blue-100/50">
                                    {block.url === 'envelope' && (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 shrink-0 mr-1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                                    )}
                                    {isEditing ? (
                                        <SlashInput
                                            value={pillTextVal}
                                            onChange={(val) => onContentUpdate?.({ pillText: val })}
                                            variables={autocompleteVariables}
                                            className="bg-transparent border-none outline-none font-semibold text-blue-600 p-0 m-0 w-full text-xs text-center focus:ring-0 focus:outline-none h-auto"
                                            placeholder="Badge Text"
                                            style={{ color: '#2563eb', width: `${Math.max(pillTextVal.length || 8, 4)}ch` }}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span style={{ color: '#2563eb' }} className="text-xs text-center select-text">
                                            {renderTextWithVariablePills(pillTextVal)}
                                        </span>
                                    )}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Heading Title */}
                    {isEditing ? (
                        <SlashTextarea
                            value={block.title || ''}
                            onChange={(val) => onContentUpdate?.({ title: val })}
                            variables={autocompleteVariables}
                            enableFormatting={true}
                            className={cn("tracking-tight leading-tight m-0 bg-transparent border-none outline-none resize-none w-full p-0 font-extrabold focus:ring-0 focus:outline-none focus:border-transparent select-text", sizeClass, customAlignClass)}
                            style={headingStyle}
                            placeholder="New Heading"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') e.preventDefault();
                                e.stopPropagation();
                            }}
                        />
                    ) : (
                        <Tag 
                            className={cn("tracking-tight leading-tight m-0 bg-transparent border-none outline-none p-0 font-extrabold select-text w-full break-words", sizeClass, customAlignClass)}
                            style={headingStyle}
                        >
                            <SafeHtml html={block.title || ''} />
                        </Tag>
                    )}

                    {/* Subtext Description with optional Icon/Avatar */}
                    {block.content !== undefined && !isSimpleWide && (
                        <div className={cn(
                            isNestedCard 
                                ? "mt-4 p-4 bg-slate-50/90 border border-slate-200/80 rounded-2xl shadow-sm text-left w-full"
                                : "mt-2.5 flex items-center gap-2 text-sm font-medium",
                            isNestedCard ? "" : customFlexAlignClass
                        )}>
                            {!isNestedCard && block.url === 'calendar' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400 shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            )}
                            {!isNestedCard && block.url && block.url.startsWith('http') && (
                                <img src={block.url} alt="avatar" className="w-5 h-5 rounded-full object-cover shrink-0" />
                            )}
                            {isEditing ? (
                                <SlashTextarea
                                    value={contentVal}
                                    onChange={(val) => onContentUpdate?.({ content: val })}
                                    variables={autocompleteVariables}
                                    enableFormatting={true}
                                    className={cn("bg-transparent border-none outline-none p-0 m-0 w-full focus:ring-0 focus:outline-none resize-none select-text", isNestedCard ? "text-slate-650 font-medium text-[13px] leading-relaxed" : cn(isDarkSlate ? "text-slate-300 font-medium" : "text-slate-500 font-medium", customAlignClass))}
                                    placeholder="Subtext description..."
                                    rows={isNestedCard ? 2 : 1}
                                    onKeyDown={(e) => e.stopPropagation()}
                                />
                            ) : (
                                <div className={cn("w-full break-words select-text", isNestedCard ? "text-slate-600 font-medium text-[13px] leading-relaxed" : cn(isDarkSlate ? "text-slate-300 font-medium" : "text-slate-500 font-medium", customAlignClass))}>
                                    <SafeHtml html={contentVal} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Left Accent Details Footer */}
                    {isLeftAccent && block.rsvpDate !== undefined && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2.5 text-slate-700 text-sm font-bold text-left">
                            {block.url === 'clock' && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            )}
                            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                                {isEditing ? (
                                    <SlashInput
                                        value={block.rsvpDate || ''}
                                        onChange={(val) => onContentUpdate?.({ rsvpDate: val })}
                                        variables={autocompleteVariables}
                                        className="bg-transparent border-none outline-none p-0 m-0 w-full font-extrabold text-slate-800 focus:ring-0 focus:outline-none text-xs h-auto"
                                        placeholder="Date (e.g. Thursday, Oct 26)"
                                        onKeyDown={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <span className="font-extrabold text-slate-800 text-xs select-text">
                                        {renderTextWithVariablePills(block.rsvpDate || '')}
                                    </span>
                                )}
                                {block.rsvpTime !== undefined && (
                                    isEditing ? (
                                        <SlashInput
                                            value={block.rsvpTime || ''}
                                            onChange={(val) => onContentUpdate?.({ rsvpTime: val })}
                                            variables={autocompleteVariables}
                                            className="bg-transparent border-none outline-none p-0 m-0 w-full font-medium text-slate-500 focus:ring-0 focus:outline-none text-[10px] h-auto"
                                            placeholder="Time (e.g. 10:00 AM - 11:30 AM)"
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="font-medium text-slate-500 text-[10px] select-text">
                                            {renderTextWithVariablePills(block.rsvpTime || '')}
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }
        case 'text':
            return (
                <div className={cn("w-full select-text whitespace-pre-wrap", alignmentClass)} style={{ backgroundColor: s.backgroundColor }}>
                    {isEditing ? (
                        <SlashTextarea
                            value={block.content || ''}
                            onChange={(val) => onContentUpdate?.({ content: val })}
                            variables={autocompleteVariables}
                            enableFormatting={true}
                            className={cn("leading-relaxed m-0 bg-transparent border-none outline-none resize-none w-full p-0 font-medium focus:ring-0 focus:outline-none focus:border-transparent select-text", alignmentClass)}
                            style={{ ...combinedStyle, fontSize: combinedStyle.fontSize || '16px' }}
                            placeholder="New paragraph content..."
                            rows={1}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div 
                            className={cn("leading-relaxed m-0 p-0 font-medium select-text w-full break-words whitespace-pre-wrap", alignmentClass)}
                            style={{ ...combinedStyle, fontSize: combinedStyle.fontSize || '16px' }}
                        >
                            <SafeHtml html={block.content || ''} />
                        </div>
                    )}
                </div>
            );
        case 'button': {
            const variant = s.variant || 'default';
            
            let btnBg = s.backgroundColor;
            let btnColor = s.color;
            let btnBorderWidth = s.borderWidth ? `${s.borderWidth}px` : undefined;
            let btnBorderStyle = s.borderStyle || undefined;
            let btnBorderColor = s.borderColor || undefined;
            let btnShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)';
            let btnTextDecoration = 'none';

            if (variant === 'default') {
                btnBg = btnBg || 'var(--org-primary, rgb(37 99 235))';
                btnColor = btnColor || '#ffffff';
            } else if (variant === 'outline') {
                btnBg = btnBg || 'transparent';
                btnColor = btnColor || 'var(--org-primary, rgb(37 99 235))';
                btnBorderWidth = btnBorderWidth || '2px';
                btnBorderStyle = btnBorderStyle || 'solid';
                btnBorderColor = btnBorderColor || 'var(--org-primary, rgb(37 99 235))';
            } else if (variant === 'secondary') {
                btnBg = btnBg || '#f3f4f6';
                btnColor = btnColor || '#1f2937';
            } else if (variant === 'destructive') {
                btnBg = btnBg || '#dc2626';
                btnColor = btnColor || '#ffffff';
            } else if (variant === 'ghost') {
                btnBg = btnBg || 'transparent';
                btnColor = btnColor || '#4b5563';
                btnShadow = 'none';
            } else if (variant === 'link') {
                btnBg = btnBg || 'transparent';
                btnColor = btnColor || 'var(--org-primary, rgb(37 99 235))';
                btnShadow = 'none';
                btnTextDecoration = 'underline';
            }

            const btnRadius = s.borderRadius ? ensureUnit(s.borderRadius) : '12px';
            const btnPadding = `${s.paddingTop || 14}px ${s.paddingRight || 28}px ${s.paddingBottom || 14}px ${s.paddingLeft || 28}px`;
            
            return (
                <div className={cn("w-full py-4 flex", alignFlexClass)}>
                    <div 
                        className="inline-block transition-transform duration-200 active:scale-95 text-center"
                        style={{
                            backgroundColor: btnBg,
                            color: btnColor,
                            borderRadius: btnRadius,
                            padding: btnPadding,
                            fontWeight: s.fontWeight || 'bold',
                            fontFamily: s.fontFamily || undefined,
                            fontSize: s.fontSize ? ensureUnit(s.fontSize) : '16px',
                            borderWidth: btnBorderWidth,
                            borderStyle: btnBorderStyle,
                            borderColor: btnBorderColor,
                            boxShadow: btnShadow,
                            textDecoration: btnTextDecoration,
                        }}
                    >
                        {isEditing ? (
                            <SlashInput
                                value={block.title || ''}
                                onChange={(val) => onContentUpdate?.({ title: val })}
                                variables={autocompleteVariables}
                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-auto font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text h-auto"
                                style={{ color: btnColor, font: 'inherit', width: `${Math.max((block.title || '').length || 8, 4)}ch` }}
                                placeholder="Click Me"
                                onKeyDown={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span 
                                className="font-bold select-text text-center inline-block"
                                style={{ color: btnColor, font: 'inherit' }}
                            >
                                {renderTextWithVariablePills(block.title || '')}
                            </span>
                        )}
                    </div>
                </div>
            );
        }
        case 'image':
            return (
                <div className={cn("w-full py-2", alignmentClass)}>
                    {resolvedUrl ? (
                        <div 
                            className="relative overflow-hidden inline-block"
                            style={{
                                borderRadius: s.borderRadius ? `${s.borderRadius}px` : '16px',
                                borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
                                borderStyle: s.borderStyle || undefined,
                                borderColor: s.borderColor || undefined,
                                ...spacingStyle
                            }}
                        >
                            <img src={resolvedUrl} alt="block" className="max-w-full h-auto object-cover display-block" />
                        </div>
                    ) : (
                        <div className="aspect-video w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-2">
                            <ImageIcon className="h-8 w-8 opacity-20" />
                            <span className="text-[10px] font-semibold ">Image Area</span>
                        </div>
                    )}
                </div>
            );
        case 'video': {
            const hasPoster = !!(resolvedUrl || block.videoThumbnailUrl);
            return (
                <div className={cn("w-full py-2", alignmentClass)}>
                    {hasPoster ? (
                        <div 
                            className="relative overflow-hidden w-full aspect-video border rounded-2xl group flex items-center justify-center cursor-pointer shadow-sm animate-in fade-in duration-200"
                            style={{
                                borderRadius: s.borderRadius ? `${s.borderRadius}px` : '20px',
                                borderWidth: s.borderWidth ? `${s.borderWidth}px` : '1px',
                                borderStyle: s.borderStyle || 'solid',
                                borderColor: s.borderColor || '#e2e8f0',
                                backgroundColor: s.backgroundColor || '#000000',
                                ...spacingStyle
                            }}
                        >
                            {/* Thumbnail Poster */}
                            {block.videoThumbnailUrl ? (
                                <img 
                                    src={block.videoThumbnailUrl} 
                                    alt="Video Poster" 
                                    className="absolute inset-0 w-full h-full object-cover opacity-80"
                                />
                            ) : (
                                <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center text-slate-400 gap-2">
                                    <Video className="h-8 w-8 opacity-40" />
                                    <span className="text-[10px] font-bold">Mock Video Poster</span>
                                </div>
                            )}

                            {/* Play Button Overlay */}
                            <div 
                                className="w-16 h-16 rounded-full flex items-center justify-center text-white shrink-0 shadow-lg cursor-pointer bg-white/20 backdrop-blur-md group-hover:scale-110 active:scale-95 duration-200 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)]"
                            >
                                <span className="text-xl ml-1">▶</span>
                            </div>

                            {/* Video metadata overlay bottom bar */}
                            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 to-transparent text-left flex justify-between items-center text-white">
                                <span className="text-[10px] font-bold tracking-tight truncate max-w-[70%]">
                                    {block.videoAction === 'download' ? 'Download Action' : block.videoAction === 'redirect' ? 'Tracking Redirect' : 'Inline Player'}
                                </span>
                                <span className="text-[9px] font-semibold bg-white/10 px-2 py-0.5 rounded backdrop-blur">
                                    Video Card
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div className="aspect-video w-full rounded-2xl border-2 border-dashed flex flex-col items-center justify-center bg-muted/20 text-muted-foreground gap-2">
                            <Video className="h-8 w-8 opacity-20" />
                            <span className="text-[10px] font-semibold">Video Block (Configure Source or Thumbnail)</span>
                        </div>
                    )}
                </div>
            );
        }
        case 'audio':
            return (
                <div className={cn("w-full py-2", alignmentClass)}>
                    <div 
                        className="w-full border p-4 shadow-sm flex items-center gap-4 transition-all"
                        style={{
                            borderRadius: s.borderRadius ? `${s.borderRadius}px` : '16px',
                            borderWidth: s.borderWidth ? `${s.borderWidth}px` : '1px',
                            borderStyle: s.borderStyle || 'solid',
                            borderColor: s.borderColor || '#e2e8f0',
                            backgroundColor: s.backgroundColor || '#ffffff',
                            ...spacingStyle
                        }}
                    >
                        {/* Circular Play Button Mock */}
                        <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm active:scale-95 duration-100 cursor-pointer"
                            style={{ backgroundColor: 'var(--org-primary, rgb(37 99 235))' }}
                        >
                            <span className="text-xs">▶</span>
                        </div>

                        {/* Title and metadata */}
                        <div className="flex-1 min-w-0 text-left">
                            <h4 className="text-sm font-semibold truncate text-foreground leading-snug">
                                {block.audioTitle || 'Untitled Audio'}
                            </h4>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider leading-none mt-1">
                                {block.audioDuration || '0:00'} &bull; {block.audioAction === 'download' ? 'Download' : block.audioAction === 'redirect' ? 'Web Link' : 'Inline Player'}
                            </p>
                        </div>

                        {/* Simulated Waveform Bars */}
                        <div className="hidden sm:flex items-center gap-0.5 h-6 shrink-0 opacity-40">
                            <div className="w-0.5 h-3 bg-foreground/60 rounded" />
                            <div className="w-0.5 h-5 bg-foreground/60 rounded" />
                            <div className="w-0.5 h-4 bg-foreground/60 rounded" />
                            <div className="w-0.5 h-6 bg-foreground/60 rounded" />
                            <div className="w-0.5 h-3 bg-foreground/60 rounded" />
                            <div className="w-0.5 h-5 bg-foreground/60 rounded" />
                            <div className="w-0.5 h-2 bg-foreground/60 rounded" />
                        </div>
                    </div>
                </div>
            );
        case 'quote':
            return (
                <div 
                    className={cn("w-full my-4 border-l-4 italic leading-relaxed select-text", alignmentClass)}
                    style={{
                        borderLeftColor: s.borderColor || '#3b5fff',
                        backgroundColor: s.backgroundColor || 'rgba(241, 245, 249, 0.5)',
                        ...spacingStyle,
                        ...borderStyle,
                        borderLeftWidth: '4px',
                        borderRadius: `0 ${s.borderRadius || 16}px ${s.borderRadius || 16}px 0`
                    }}
                >
                    {isEditing ? (
                        <SlashTextarea
                            value={block.content || ''}
                            onChange={(val) => onContentUpdate?.({ content: val })}
                            variables={autocompleteVariables}
                            enableFormatting={true}
                            className={cn("bg-transparent border-none outline-none resize-none w-full font-medium italic focus:ring-0 focus:outline-none focus:border-transparent select-text p-4", alignmentClass)}
                            style={{ ...typographyStyle, display: 'block', border: 'none' }}
                            placeholder="Quote content..."
                            rows={1}
                            onKeyDown={(e) => e.stopPropagation()}
                        />
                    ) : (
                        <div 
                            className={cn("font-medium italic select-text p-4 w-full break-words whitespace-pre-wrap", alignmentClass)}
                            style={{ ...typographyStyle, display: 'block', border: 'none' }}
                        >
                            <SafeHtml html={block.content || ''} />
                        </div>
                    )}
                </div>
            );
        case 'list': {
            const items = block.items || ['New point...'];
            return (
                <div className={cn("w-full", alignmentClass)} style={{ backgroundColor: s.backgroundColor }}>
                    <ul 
                        className="leading-relaxed m-0 space-y-2 text-left list-none" 
                        style={combinedStyle}
                    >
                        {items.map((item, i) => {
                            let prefix = null;
                            if (block.listStyle === 'ordered') {
                                prefix = <span className="text-muted-foreground/80 font-mono text-sm shrink-0 min-w-[20px] text-right mr-1.5 select-none">{i + 1}.</span>;
                            } else if (block.listStyle === 'roman') {
                                const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV'];
                                prefix = <span className="text-muted-foreground/80 font-mono text-sm shrink-0 min-w-[20px] text-right mr-1.5 select-none">{romanNumerals[i] || (i + 1)}.</span>;
                            } else if (block.listStyle === 'checkmark') {
                                prefix = <span className="text-emerald-500 shrink-0 font-bold select-none mr-1.5">✓</span>;
                            } else if (block.listStyle === 'arrow') {
                                prefix = <span className="text-blue-500 shrink-0 font-bold select-none mr-1.5">→</span>;
                            } else {
                                prefix = <span className="text-muted-foreground/60 shrink-0 flex items-center justify-center w-1.5 h-1.5 rounded-full bg-current mr-2 ml-1 select-none" />;
                            }

                             return (
                                <li key={i} className="relative group/list-item flex items-center w-full select-text min-h-6">
                                    {prefix}
                                    {isEditing ? (
                                        <SlashInput
                                            value={item}
                                            onChange={(val) => {
                                                const newItems = [...items];
                                                newItems[i] = val;
                                                onContentUpdate?.({ items: newItems });
                                            }}
                                            variables={autocompleteVariables}
                                            enableFormatting={true}
                                            className="bg-transparent border-none outline-none p-0 m-0 font-medium flex-1 focus:ring-0 focus:outline-none focus:border-transparent select-text h-auto"
                                            style={{ color: combinedStyle.color || 'inherit', font: 'inherit' }}
                                            placeholder="List item..."
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    const newItems = [...items];
                                                    newItems.splice(i + 1, 0, '');
                                                    onContentUpdate?.({ items: newItems });
                                                }
                                                e.stopPropagation();
                                            }}
                                        />
                                    ) : (
                                        <span 
                                            className="flex-1 font-medium select-text break-words"
                                            style={{ color: combinedStyle.color || 'inherit', font: 'inherit' }}
                                        >
                                            <SafeHtml html={item} />
                                        </span>
                                    )}
                                    {isEditing && items.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const newItems = items.filter((_, idx) => idx !== i);
                                                onContentUpdate?.({ items: newItems });
                                            }}
                                            className="opacity-0 group-hover/list-item:opacity-100 text-red-500 hover:text-red-700 text-sm font-bold transition-opacity px-1 pointer-events-auto"
                                        >
                                            &times;
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                    {isEditing && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="mt-2 h-7 rounded-lg text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50/50 p-1 px-2 pointer-events-auto"
                            onClick={(e) => {
                                e.stopPropagation();
                                onContentUpdate?.({ items: [...items, ''] });
                            }}
                        >
                            + Add Item
                        </Button>
                    )}
                </div>
            );
        }
        case 'divider':
            return <hr className="w-full my-6 border-slate-200" />;
        case 'score-card': {
            const pillTextVal = block.pillText || 'Assessment Result';
            const subtitleVal = block.content || 'Total Points Recorded';
            return (
                <div className="w-full py-6">
                    <Card 
                        className={cn(
                            "text-white border-none shadow-2xl rounded-[2rem] p-8 flex flex-col items-center text-center",
                            !s.backgroundColor && "bg-blue-600"
                        )}
                        style={{
                            backgroundColor: s.backgroundColor || undefined,
                            borderRadius: s.borderRadius ? ensureUnit(s.borderRadius) : undefined,
                            borderWidth: s.borderWidth ? ensureUnit(s.borderWidth) : undefined,
                            borderStyle: s.borderStyle || undefined,
                            borderColor: s.borderColor || undefined,
                        }}
                    >
                        {isEditing ? (
                            <div className="mb-4">
                                <SlashInput
                                    value={block.pillText || ''}
                                    onChange={(val) => onContentUpdate?.({ pillText: val })}
                                    variables={autocompleteVariables}
                                    className="bg-white/10 text-white border-white/20 border rounded-full px-3 py-1 text-[8px] font-semibold uppercase text-center w-auto focus:ring-0 focus:outline-none h-auto"
                                    placeholder="Assessment Result"
                                    style={{ width: `${Math.max(pillTextVal.length || 18, 4)}ch` }}
                                    onKeyDown={(e) => e.stopPropagation()}
                                />
                            </div>
                        ) : (
                            <Badge variant="outline" className="mb-4 bg-card/10 text-white border-white/20 px-3 py-1 text-[8px] font-semibold uppercase">
                                {renderTextWithVariablePills(pillTextVal)}
                            </Badge>
                        )}
                        <span className="text-6xl font-semibold tabular-nums tracking-tighter" style={{ fontFamily: s.fontFamily, color: s.color }}>{(simulationVars.score as string | number) || 0}</span>
                        {isEditing ? (
                            <div className="mt-1 w-full">
                                <SlashInput
                                    value={block.content || ''}
                                    onChange={(val) => onContentUpdate?.({ content: val })}
                                    variables={autocompleteVariables}
                                    className="bg-transparent border-none outline-none font-bold text-[10px] text-white opacity-60 text-center w-full focus:ring-0 focus:outline-none h-auto"
                                    placeholder="Total Points Recorded"
                                    onKeyDown={(e) => e.stopPropagation()}
                                />
                            </div>
                        ) : (
                            <span className="text-[10px] font-bold opacity-60 mt-1">
                                {renderTextWithVariablePills(subtitleVal)}
                            </span>
                        )}
                    </Card>
                </div>
            );
        }
        case 'logo': {
            const logoUrl = resolveVariables(block.url || '{{org_logo_url}}', simulationVars);
            return (
                <div className={cn("w-full py-4", alignmentClass)}>
                    {logoUrl && !logoUrl.includes('{{') ? (
                        <img src={logoUrl} alt="Organization Logo" style={{ height: '48px', width: 'auto', display: 'block', ...(align === 'center' ? { margin: '0 auto' } : align === 'right' ? { marginLeft: 'auto' } : {}) }} width={120} height={48} />
                    ) : (
                        <div className={cn("inline-flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-blue-100 bg-blue-50", align === 'center' ? 'mx-auto' : '')}>
                            <ImageIcon className="h-5 w-5 text-blue-600/40" />
                            <span className="text-[10px] font-bold text-blue-600/60">{'{{org_logo_url}}'}</span>
                        </div>
                    )}
                </div>
            );
        }
        case 'header': {
            const headerLogo = resolveVariables(block.url || '{{org_logo_url}}', simulationVars);
            const orgName = resolveVariables('{{org_name}}', simulationVars);
            return (
                <div className="w-full py-6 border-b border-border/30">
                    <div className="flex items-center gap-4">
                        {headerLogo && !headerLogo.includes('{{') ? (
                            <img src={headerLogo} alt="Logo" style={{ height: '40px', width: 'auto' }} width={100} height={40} />
                        ) : (
                            <div className="p-2 rounded-lg border border-dashed border-blue-100 bg-blue-50">
                                <ImageIcon className="h-5 w-5 text-blue-600/40" />
                            </div>
                        )}
                        <span className="text-lg font-bold text-foreground/80">{orgName.includes('{{') ? 'Organization Name' : orgName}</span>
                    </div>
                </div>
            );
        }
        case 'footer': {
            const fName = resolveVariables('{{org_name}}', simulationVars);
            const fEmail = resolveVariables('{{org_email}}', simulationVars);
            const fPhone = resolveVariables('{{org_phone}}', simulationVars);
            const fAddr = resolveVariables('{{org_address}}', simulationVars);
            return (
                <div className="w-full pt-6 mt-6 border-t border-border/30 text-center space-y-1.5">
                    <p className="text-xs font-bold text-muted-foreground/80">{fName.includes('{{') ? 'Organization Name' : fName}</p>
                    <p className="text-[10px] text-muted-foreground/60">{fEmail.includes('{{') ? 'email@org.com' : fEmail} | {fPhone.includes('{{') ? '+1 234 567 890' : fPhone}</p>
                    <p className="text-[9px] text-muted-foreground/40">&copy; {new Date().getFullYear()} {fName.includes('{{') ? 'Organization' : fName}</p>
                </div>
            );
        }
        case 'rsvp': {
            const title = block.title || 'Will you attend this meeting?';
            const going = block.goingLabel || 'Going';
            const declined = block.declinedLabel || 'Not Going';
            const later = block.laterLabel || 'Later';
            
            const rsvpStyle = block.rsvpStyle || 'standard';
            const rsvpDate = block.rsvpDate || 'Tuesday, Sep 24';
            const rsvpTime = block.rsvpTime || '10:00 - 11:00 AM';
            const rsvpLocation = block.rsvpLocation || 'Google Meet';
            const isEventStyle = ['event_full_bento', 'event_full_inline', 'event_compact_bento', 'event_compact_inline'].includes(rsvpStyle);
            if (isEventStyle) {
                const hasPillDesc = ['event_full_bento', 'event_full_inline'].includes(rsvpStyle);
                const isBento = ['event_full_bento', 'event_compact_bento'].includes(rsvpStyle);
                
                const pillTextVal = block.pillText || 'Invitation';
                const eventDescVal = block.content || 'Reviewing the quarterly brand evolution and digital style guidance for the upcoming luxury client launch.';
                
                const rsvpDateLabelVal = block.rsvpDateLabel || 'DATE';
                const rsvpTimeLabelVal = block.rsvpTimeLabel || 'TIME';
                const rsvpLocationLabelVal = block.rsvpLocationLabel || 'TYPE';
                
                return (
                    <div 
                        className={cn("w-full text-left select-text transition-all duration-300 p-4 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)]", alignmentClass)} 
                        style={{
                            backgroundColor: s.backgroundColor || '#ffffff',
                            ...spacingStyle,
                            ...borderStyle,
                            borderRadius: s.borderRadius || '16px',
                            borderWidth: s.borderWidth || '1px',
                            borderStyle: s.borderStyle || 'solid',
                            borderColor: s.borderColor || '#cbd5e1',
                        }}
                    >
                        {hasPillDesc && (
                            <>
                                {/* Pill Badge */}
                                <div className="mb-3">
                                    <span className="inline-flex bg-blue-50 text-blue-600 rounded-full px-3 py-1 text-xs font-semibold select-text">
                                        {isEditing ? (
                                            <SlashInput
                                                value={pillTextVal}
                                                onChange={(val) => onContentUpdate?.({ pillText: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none font-semibold text-blue-600 p-0 m-0 w-full text-xs text-center h-auto"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span style={{ color: '#2563eb' }} className="text-xs text-center select-text">
                                                {renderTextWithVariablePills(pillTextVal)}
                                            </span>
                                        )}
                                    </span>
                                </div>
                                
                                {/* Event Title */}
                                <div className="mb-2">
                                    {isEditing ? (
                                        <SlashTextarea
                                            value={title}
                                            onChange={(val) => onContentUpdate?.({ title: val })}
                                            variables={autocompleteVariables}
                                            className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight bg-transparent border-none outline-none resize-none w-full p-0 focus:ring-0 select-text leading-tight break-words"
                                            placeholder="Event Title"
                                            rows={1}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') e.preventDefault();
                                                e.stopPropagation();
                                            }}
                                        />
                                    ) : (
                                        <div className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight select-text leading-tight break-words">
                                            {renderTextWithVariablePills(title)}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Event Description */}
                                <div className="mb-5">
                                    {isEditing ? (
                                        <SlashTextarea
                                            value={eventDescVal}
                                            onChange={(val) => onContentUpdate?.({ content: val })}
                                            variables={autocompleteVariables}
                                            className="text-xs sm:text-sm text-slate-500 bg-transparent border-none outline-none resize-none w-full p-0 focus:ring-0 select-text leading-relaxed break-words"
                                            placeholder="Event Description"
                                            rows={2}
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <div className="text-xs sm:text-sm text-slate-500 select-text leading-relaxed break-words">
                                            {renderTextWithVariablePills(eventDescVal)}
                                        </div>
                                    )}
                                </div>
                                
                                {/* Horizontal Divider */}
                                <div className="border-t border-slate-100/80 my-4" />
                            </>
                        )}

                        {/* Metadata Columns */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-1">
                            {/* Column 1: Date */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="bg-blue-50/80 text-blue-600 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                </div>
                                <div className="flex-1 min-w-0 leading-tight">
                                    {isEditing ? (
                                        <>
                                            <SlashInput
                                                value={rsvpDateLabelVal}
                                                onChange={(val) => onContentUpdate?.({ rsvpDateLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-400 uppercase tracking-widest p-0 m-0 w-full h-auto"
                                                placeholder="DATE"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                            <SlashInput
                                                value={rsvpDate}
                                                onChange={(val) => onContentUpdate?.({ rsvpDate: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-sm font-bold text-slate-800 p-0 mt-0.5 w-full break-all h-auto"
                                                placeholder="Dec 15, 2024"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-text block">
                                                {renderTextWithVariablePills(rsvpDateLabelVal)}
                                            </span>
                                            <span className="text-sm font-bold text-slate-800 mt-0.5 select-text block break-all">
                                                {renderTextWithVariablePills(rsvpDate)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Vertical Divider 1 */}
                            <div className="hidden sm:block h-9 w-px bg-slate-100 shrink-0 self-center" />

                            {/* Column 2: Time */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="bg-blue-50/80 text-blue-600 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <div className="flex-1 min-w-0 leading-tight">
                                    {isEditing ? (
                                        <>
                                            <SlashInput
                                                value={rsvpTimeLabelVal}
                                                onChange={(val) => onContentUpdate?.({ rsvpTimeLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-400 uppercase tracking-widest p-0 m-0 w-full h-auto"
                                                placeholder="TIME"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                            <SlashInput
                                                value={rsvpTime}
                                                onChange={(val) => onContentUpdate?.({ rsvpTime: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-sm font-bold text-slate-800 p-0 mt-0.5 w-full break-all h-auto"
                                                placeholder="2:00 PM"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-text block">
                                                {renderTextWithVariablePills(rsvpTimeLabelVal)}
                                            </span>
                                            <span className="text-sm font-bold text-slate-800 mt-0.5 select-text block break-all">
                                                {renderTextWithVariablePills(rsvpTime)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Vertical Divider 2 */}
                            <div className="hidden sm:block h-9 w-px bg-slate-100 shrink-0 self-center" />

                            {/* Column 3: Type */}
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="bg-blue-50/80 text-blue-600 p-2.5 rounded-xl flex items-center justify-center shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                                </div>
                                <div className="flex-1 min-w-0 leading-tight">
                                    {isEditing ? (
                                        <>
                                            <SlashInput
                                                value={rsvpLocationLabelVal}
                                                onChange={(val) => onContentUpdate?.({ rsvpLocationLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-400 uppercase tracking-widest p-0 m-0 w-full h-auto"
                                                placeholder="TYPE"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                            <SlashInput
                                                value={rsvpLocation}
                                                onChange={(val) => onContentUpdate?.({ rsvpLocation: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-sm font-bold text-slate-800 p-0 mt-0.5 w-full break-all h-auto"
                                                placeholder="Virtual Meeting"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest select-text block">
                                                {renderTextWithVariablePills(rsvpLocationLabelVal)}
                                            </span>
                                            <span className="text-sm font-bold text-slate-800 mt-0.5 select-text block break-all">
                                                {renderTextWithVariablePills(rsvpLocation)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Horizontal Divider */}
                        <div className="border-t border-slate-100/80 my-4" />

                        {/* Buttons Grid */}
                        <div>
                            {isBento ? (
                                <div className="space-y-3">
                                    {/* Going (Full Width) */}
                                    <div className="w-full bg-[#0052cc] text-white rounded-xl py-3 px-4 text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:bg-[#0047b3] transition-all min-w-0">
                                        {isEditing ? (
                                            <SlashInput
                                                value={going}
                                                onChange={(val) => onContentUpdate?.({ goingLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text text-white h-auto"
                                                style={{ color: '#ffffff', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-white flex-1 break-words">
                                                {renderTextWithVariablePills(going)}
                                            </span>
                                        )}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                    </div>
                                    {/* Split Secondary Buttons */}
                                    <div className="grid grid-cols-1 min-[370px]:grid-cols-2 gap-3">
                                        {/* Later */}
                                        <div className="bg-white border border-slate-200 text-slate-700 rounded-xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-all min-w-0">
                                            {isEditing ? (
                                                <SlashInput
                                                    value={later}
                                                    onChange={(val) => onContentUpdate?.({ laterLabel: val })}
                                                    variables={autocompleteVariables}
                                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-transparent select-text text-slate-700 h-auto"
                                                    style={{ color: '#334155', font: 'inherit' }}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className="font-bold select-text text-center text-slate-700 flex-1 break-words">
                                                    {renderTextWithVariablePills(later)}
                                                </span>
                                            )}
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                        </div>
                                        {/* Not Going */}
                                        <div className="bg-white border border-slate-200 text-slate-700 rounded-xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-50 transition-all min-w-0">
                                            {isEditing ? (
                                                <SlashInput
                                                    value={declined}
                                                    onChange={(val) => onContentUpdate?.({ declinedLabel: val })}
                                                    variables={autocompleteVariables}
                                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-transparent select-text text-slate-700 h-auto"
                                                    style={{ color: '#334155', font: 'inherit' }}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className="font-bold select-text text-center text-slate-700 flex-1 break-words">
                                                    {renderTextWithVariablePills(declined)}
                                                </span>
                                            )}
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 min-[370px]:grid-cols-2 sm:grid-cols-3 gap-3">
                                    {/* Going */}
                                    <div className="col-span-full min-[370px]:col-span-2 sm:col-span-1 bg-[#0052cc] text-white rounded-xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer hover:bg-[#0047b3] transition-all min-w-0">
                                        {isEditing ? (
                                            <SlashInput
                                                value={going}
                                                onChange={(val) => onContentUpdate?.({ goingLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text text-white h-auto"
                                                style={{ color: '#ffffff', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-white flex-1 break-words">
                                                {renderTextWithVariablePills(going)}
                                            </span>
                                        )}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                                    </div>
                                    {/* Later */}
                                    <div className="col-span-full min-[370px]:col-span-1 bg-white border border-slate-200 text-slate-700 rounded-xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-all min-w-0">
                                        {isEditing ? (
                                            <SlashInput
                                                value={later}
                                                onChange={(val) => onContentUpdate?.({ laterLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-transparent select-text text-slate-700 h-auto"
                                                style={{ color: '#334155', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-slate-700 flex-1 break-words">
                                                {renderTextWithVariablePills(later)}
                                            </span>
                                        )}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    </div>
                                    {/* Not Going */}
                                    <div className="col-span-full min-[370px]:col-span-1 bg-white border border-slate-200 text-slate-700 rounded-xl py-3 px-4 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-50 transition-all min-w-0">
                                        {isEditing ? (
                                            <SlashInput
                                                value={declined}
                                                onChange={(val) => onContentUpdate?.({ declinedLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-transparent select-text text-slate-700 h-auto"
                                                style={{ color: '#334155', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-slate-700 flex-1 break-words">
                                                {renderTextWithVariablePills(declined)}
                                            </span>
                                        )}
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            const isDetailedCard = rsvpStyle === 'card_bento' || rsvpStyle === 'card_inline';

            if (isDetailedCard) {
                return (
                    <div 
                        className={cn("w-full text-left p-4 sm:p-6 select-text transition-all duration-300", alignmentClass)} 
                        style={{
                            backgroundColor: s.backgroundColor || '#ffffff',
                            ...spacingStyle,
                            ...borderStyle,
                            borderRadius: s.borderRadius || '16px',
                            borderWidth: s.borderWidth || '1px',
                            borderStyle: s.borderStyle || 'solid',
                            borderColor: s.borderColor || '#cbd5e1',
                        }}
                    >
                        {/* Optional Title */}
                        {block.title && (
                            <div className="mb-4">
                                {isEditing ? (
                                    <SlashTextarea
                                        value={title}
                                        onChange={(val) => onContentUpdate?.({ title: val })}
                                        variables={autocompleteVariables}
                                        className="tracking-tight bg-transparent border-none outline-none resize-none w-full p-0 font-extrabold focus:ring-0 focus:outline-none focus:border-transparent select-text"
                                        style={{ 
                                            font: 'inherit',
                                            color: s.color || '#0f172a',
                                            fontSize: '18px',
                                            fontWeight: 'bold',
                                        }}
                                        placeholder="Confirm Attendance"
                                        rows={1}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') e.preventDefault();
                                            e.stopPropagation();
                                        }}
                                    />
                                ) : (
                                    <div 
                                        className="font-bold select-text"
                                        style={{ color: s.color || '#0f172a', fontSize: '18px' }}
                                    >
                                        {renderTextWithVariablePills(title)}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="space-y-4">
                            {/* Date & Time Row */}
                            <div className="flex items-start gap-3">
                                <div className="text-blue-600 mt-1 shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0062cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    {isEditing ? (
                                        <>
                                            <SlashInput
                                                value={rsvpDate}
                                                onChange={(val) => onContentUpdate?.({ rsvpDate: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none p-0 m-0 font-extrabold text-slate-900 focus:ring-0 focus:outline-none focus:border-transparent select-text w-full text-left h-auto"
                                                style={{ fontSize: '18px', color: '#0f172a', fontWeight: 800 }}
                                                placeholder="Tuesday, Sep 24"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                            <SlashInput
                                                value={rsvpTime}
                                                onChange={(val) => onContentUpdate?.({ rsvpTime: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none p-0 m-0 font-medium text-slate-500 focus:ring-0 focus:outline-none focus:border-transparent select-text w-full text-left h-auto"
                                                style={{ fontSize: '14px', color: '#64748b' }}
                                                placeholder="10:00 - 11:00 AM"
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-extrabold text-slate-900 select-text block break-all" style={{ fontSize: '18px', color: '#0f172a', fontWeight: 800 }}>
                                                {renderTextWithVariablePills(rsvpDate)}
                                            </span>
                                            <span className="font-medium text-slate-500 select-text block break-all" style={{ fontSize: '14px', color: '#64748b' }}>
                                                {renderTextWithVariablePills(rsvpTime)}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Location Row */}
                            <div className="flex items-start gap-3">
                                <div className="text-blue-600 mt-1 shrink-0">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0062cc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2" ry="2"/></svg>
                                </div>
                                <div className="flex-1 min-w-0">
                                    {isEditing ? (
                                        <SlashInput
                                            value={rsvpLocation}
                                            onChange={(val) => onContentUpdate?.({ rsvpLocation: val })}
                                            variables={autocompleteVariables}
                                            className="bg-transparent border-none outline-none p-0 m-0 font-bold text-slate-900 focus:ring-0 focus:outline-none focus:border-transparent select-text w-full text-left h-auto"
                                            style={{ fontSize: '16px', color: '#0f172a', fontWeight: 700 }}
                                            placeholder="Google Meet"
                                            onKeyDown={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <span className="font-bold text-slate-900 select-text block break-all" style={{ fontSize: '16px', color: '#0f172a', fontWeight: 700 }}>
                                            {renderTextWithVariablePills(rsvpLocation)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Buttons Grid */}
                        <div className="mt-6 animate-in fade-in duration-200">
                            {rsvpStyle === 'card_bento' ? (
                                <div className="space-y-3">
                                    {/* Going (full width) */}
                                    <div className="w-full bg-[#0062cc] text-white rounded-full py-3.5 px-4 text-sm font-bold flex items-center justify-center gap-2 shadow-sm cursor-pointer min-w-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                                        {isEditing ? (
                                            <SlashInput
                                                value={going}
                                                onChange={(val) => onContentUpdate?.({ goingLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-black placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text text-white h-auto"
                                                style={{ color: '#ffffff', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-white flex-1 break-words">
                                                {renderTextWithVariablePills(going)}
                                            </span>
                                        )}
                                    </div>
                                    {/* Secondary split */}
                                    <div className="grid grid-cols-1 min-[370px]:grid-cols-2 gap-3">
                                        {/* Not Going */}
                                        <div className="bg-white border-2 border-slate-200 text-[#0062cc] rounded-full py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer min-w-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            {isEditing ? (
                                                <SlashInput
                                                    value={declined}
                                                    onChange={(val) => onContentUpdate?.({ declinedLabel: val })}
                                                    variables={autocompleteVariables}
                                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-black placeholder:text-slate-450 focus:ring-0 focus:outline-none focus:border-transparent select-text text-[#0062cc] h-auto"
                                                    style={{ color: '#0062cc', font: 'inherit' }}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className="font-bold select-text text-center text-[#0062cc] flex-1 break-words">
                                                    {renderTextWithVariablePills(declined)}
                                                </span>
                                            )}
                                        </div>
                                        {/* Later */}
                                        <div className="bg-white border-2 border-slate-200 text-[#0062cc] rounded-full py-3 px-4 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer min-w-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 13"/></svg>
                                            {isEditing ? (
                                                <SlashInput
                                                    value={later}
                                                    onChange={(val) => onContentUpdate?.({ laterLabel: val })}
                                                    variables={autocompleteVariables}
                                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-black placeholder:text-slate-450 focus:ring-0 focus:outline-none focus:border-transparent select-text text-[#0062cc] h-auto"
                                                    style={{ color: '#0062cc', font: 'inherit' }}
                                                    onKeyDown={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <span className="font-bold select-text text-center text-[#0062cc] flex-1 break-words">
                                                    {renderTextWithVariablePills(later)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 min-[370px]:grid-cols-2 sm:grid-cols-3 gap-3">
                                    {/* Going */}
                                    <div className="col-span-full min-[370px]:col-span-2 sm:col-span-1 bg-[#0062cc] text-white rounded-full py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer min-w-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                                        {isEditing ? (
                                            <SlashInput
                                                value={going}
                                                onChange={(val) => onContentUpdate?.({ goingLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text text-white h-auto"
                                                style={{ color: '#ffffff', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-white flex-1 break-words">
                                                {renderTextWithVariablePills(going)}
                                            </span>
                                        )}
                                    </div>
                                    {/* Not Going */}
                                    <div className="col-span-full min-[370px]:col-span-1 bg-white border-2 border-slate-200 text-[#0062cc] rounded-full py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer min-w-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        {isEditing ? (
                                            <SlashInput
                                                value={declined}
                                                onChange={(val) => onContentUpdate?.({ declinedLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-transparent select-text text-[#0062cc] h-auto"
                                                style={{ color: '#0062cc', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-[#0062cc] flex-1 break-words">
                                                {renderTextWithVariablePills(declined)}
                                            </span>
                                        )}
                                    </div>
                                    {/* Later */}
                                    <div className="col-span-full min-[370px]:col-span-1 bg-white border-2 border-slate-200 text-[#0062cc] rounded-full py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer min-w-0">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 15 13"/></svg>
                                        {isEditing ? (
                                            <SlashInput
                                                value={later}
                                                onChange={(val) => onContentUpdate?.({ laterLabel: val })}
                                                variables={autocompleteVariables}
                                                className="bg-transparent border-none outline-none text-center p-0 m-0 w-full font-bold placeholder:text-slate-400 focus:ring-0 focus:outline-none focus:border-transparent select-text text-[#0062cc] h-auto"
                                                style={{ color: '#0062cc', font: 'inherit' }}
                                                onKeyDown={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="font-bold select-text text-center text-[#0062cc] flex-1 break-words">
                                                {renderTextWithVariablePills(later)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            }

            return (
                <div 
                    className={cn("w-full py-4 text-center select-text", alignmentClass)} 
                    style={{
                        backgroundColor: s.backgroundColor || undefined,
                        ...spacingStyle,
                        ...borderStyle,
                    }}
                >
                    <div className="mb-4">
                        {isEditing ? (
                            <SlashTextarea
                                value={title}
                                onChange={(val) => onContentUpdate?.({ title: val })}
                                variables={autocompleteVariables}
                                className={cn("tracking-tight bg-transparent border-none outline-none resize-none w-full p-0 font-extrabold focus:ring-0 focus:outline-none focus:border-transparent select-text", alignmentClass)}
                                style={{ 
                                    font: 'inherit',
                                    color: s.color || undefined,
                                    fontSize: s.fontSize ? ensureUnit(s.fontSize) : '18px',
                                    fontWeight: s.fontWeight || 'bold',
                                    fontFamily: s.fontFamily || undefined,
                                }}
                                placeholder="Will you attend this meeting?"
                                rows={1}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.preventDefault();
                                    e.stopPropagation();
                                }}
                            />
                        ) : (
                            <div 
                                className="font-bold select-text"
                                style={{ 
                                    color: s.color || undefined,
                                    fontSize: s.fontSize ? ensureUnit(s.fontSize) : '18px',
                                    fontWeight: s.fontWeight || 'bold',
                                    fontFamily: s.fontFamily || undefined,
                                }}
                            >
                                {renderTextWithVariablePills(title)}
                            </div>
                        )}
                    </div>
                    
                    <div className={cn("flex flex-wrap gap-3", alignFlexClass)}>
                        {/* Going Button */}
                        <div className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-all flex items-center justify-center animate-in fade-in duration-200">
                            {isEditing ? (
                                <SlashInput
                                    value={going}
                                    onChange={(val) => onContentUpdate?.({ goingLabel: val })}
                                    variables={autocompleteVariables}
                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-auto font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text"
                                    style={{ color: '#ffffff', font: 'inherit', width: `${Math.max(going.length || 5, 3)}ch` }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                />
                            ) : (
                                <span className="font-bold select-text text-center text-white inline-block">
                                    {renderTextWithVariablePills(going)}
                                </span>
                            )}
                        </div>
                        {/* Later Button */}
                        <div className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-all flex items-center justify-center animate-in fade-in duration-200">
                            {isEditing ? (
                                <SlashInput
                                    value={later}
                                    onChange={(val) => onContentUpdate?.({ laterLabel: val })}
                                    variables={autocompleteVariables}
                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-auto font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text"
                                    style={{ color: '#ffffff', font: 'inherit', width: `${Math.max(later.length || 5, 3)}ch` }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                />
                            ) : (
                                <span className="font-bold select-text text-center text-white inline-block">
                                    {renderTextWithVariablePills(later)}
                                </span>
                            )}
                        </div>
                        {/* Declined Button */}
                        <div className="bg-rose-500 hover:bg-rose-600 text-white rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-all flex items-center justify-center animate-in fade-in duration-200">
                            {isEditing ? (
                                <SlashInput
                                    value={declined}
                                    onChange={(val) => onContentUpdate?.({ declinedLabel: val })}
                                    variables={autocompleteVariables}
                                    className="bg-transparent border-none outline-none text-center p-0 m-0 w-auto font-bold placeholder:text-white/50 focus:ring-0 focus:outline-none focus:border-transparent select-text"
                                    style={{ color: '#ffffff', font: 'inherit', width: `${Math.max(declined.length || 9, 3)}ch` }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') e.preventDefault();
                                        e.stopPropagation();
                                    }}
                                />
                            ) : (
                                <span className="font-bold select-text text-center text-white inline-block">
                                    {renderTextWithVariablePills(declined)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            );
        }         case 'columns': {
            const cols = block.columns || [];
            const colWidths = cols.map(c => c.width || `${Math.floor(100 / cols.length)}%`);
            return (
                <div 
                    className="w-full grid gap-4 transition-all duration-300"
                    style={{ 
                        gridTemplateColumns: `repeat(${cols.length || 2}, minmax(0, 1fr))`,
                        ...spacingStyle,
                        ...borderStyle
                    }}
                >
                    {cols.map((col, colIdx) => (
                        <SortableContext 
                            key={colIdx} 
                            items={col.blocks.map(b => b.id)} 
                            strategy={verticalListSortingStrategy}
                        >
                            <ColumnCell
                                block={block}
                                colIdx={colIdx}
                                col={col}
                                colWidth={colWidths[colIdx]}
                                simulationVars={simulationVars}
                                autocompleteVariables={autocompleteVariables}
                                selectedSubBlockId={selectedSubBlockId}
                                onSelectSubBlock={onSelectSubBlock}
                                onRemoveSubBlock={onRemoveSubBlock}
                                onDuplicateSubBlock={onDuplicateSubBlock}
                                onSwapSubBlocks={onSwapSubBlocks}
                                onUpdateSubBlock={onUpdateSubBlock}
                            />
                        </SortableContext>
                    ))}
                </div>
            );
        }
        default:
            return <div className="p-4 border border-dashed rounded text-[10px] text-muted-foreground text-center">{block.type} Block Content</div>;
    }
}

function ColumnCell({
    block,
    colIdx,
    col,
    colWidth,
    simulationVars,
    autocompleteVariables,
    selectedSubBlockId,
    onSelectSubBlock,
    onRemoveSubBlock,
    onDuplicateSubBlock,
    onSwapSubBlocks,
    onUpdateSubBlock
}: {
    block: MessageBlock;
    colIdx: number;
    col: any;
    colWidth: string;
    simulationVars: Record<string, any>;
    autocompleteVariables?: TemplateVariable[];
    selectedSubBlockId?: string | null;
    onSelectSubBlock?: (subBlockId: string) => void;
    onRemoveSubBlock?: (parentBlockId: string, colIdx: number, subBlockId: string) => void;
    onDuplicateSubBlock?: (parentBlockId: string, colIdx: number, subBlockId: string) => void;
    onSwapSubBlocks?: (parentBlockId: string, colIdx: number, a: number, b: number) => void;
    onUpdateSubBlock?: (subBlockId: string, updates: Partial<MessageBlock>) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({
        id: `col-cell-${block.id}-${colIdx}`
    });

    return (
        <div 
            ref={setNodeRef} 
            className={cn(
                "relative flex flex-col gap-3 rounded-2xl p-3 min-h-[120px] transition-all border border-dashed",
                isOver ? "bg-blue-500/10 border-blue-500/50 shadow-inner" : "bg-muted/5 border-muted-foreground/10 hover:border-blue-500/20"
            )}
            onClick={(e) => {
                e.stopPropagation();
                onSelectSubBlock?.(block.id);
            }}
        >
            <div className="absolute top-1 left-2 text-[8px] font-bold text-muted-foreground/30 uppercase tracking-widest pointer-events-none">
                Col {colIdx + 1} ({colWidth})
            </div>
            
            {col.blocks.map((subBlock: any, subIdx: number) => (
                <SortableBlockItem
                    key={subBlock.id}
                    id={subBlock.id}
                    index={subIdx}
                    block={subBlock}
                    isSelected={selectedSubBlockId === subBlock.id}
                    simulationVars={simulationVars}
                    autocompleteVariables={autocompleteVariables}
                    onSelect={() => onSelectSubBlock?.(subBlock.id)}
                    onRemove={() => onRemoveSubBlock?.(block.id, colIdx, subBlock.id)}
                    onDuplicate={() => onDuplicateSubBlock?.(block.id, colIdx, subBlock.id)}
                    onSwap={(a, b) => onSwapSubBlocks?.(block.id, colIdx, a, b)}
                    totalCount={col.blocks.length}
                    onUpdate={(u) => onUpdateSubBlock?.(subBlock.id, u)}
                    selectedSubBlockId={selectedSubBlockId}
                    onSelectSubBlock={onSelectSubBlock}
                    onRemoveSubBlock={onRemoveSubBlock}
                    onDuplicateSubBlock={onDuplicateSubBlock}
                    onSwapSubBlocks={onSwapSubBlocks}
                    onUpdateSubBlock={onUpdateSubBlock}
                />
            ))}
            
            {col.blocks.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-[9px] font-semibold text-muted-foreground/20 pointer-events-none">
                    Empty Drop Zone
                </div>
            )}
        </div>
    );
}

interface SortableBlockItemProps {
    id: string;
    index: number;
    block: MessageBlock;
    isSelected: boolean;
    simulationVars: Record<string, any>;
    autocompleteVariables?: TemplateVariable[];
    onSelect: () => void;
    onRemove: () => void;
    onDuplicate: () => void;
    onSwap: (a: number, b: number) => void;
    totalCount: number;
    onUpdate: (u: Partial<MessageBlock>) => void;
    // Propagate nested handlers down to nested visual block renderer
    selectedSubBlockId?: string | null;
    onSelectSubBlock?: (subBlockId: string) => void;
    onRemoveSubBlock?: (parentBlockId: string, colIdx: number, subBlockId: string) => void;
    onDuplicateSubBlock?: (parentBlockId: string, colIdx: number, subBlockId: string) => void;
    onSwapSubBlocks?: (parentBlockId: string, colIdx: number, a: number, b: number) => void;
    onUpdateSubBlock?: (subBlockId: string, updates: Partial<MessageBlock>) => void;
    isMultiSelected?: boolean;
    onToggleSelect?: () => void;
    onMoveToTop?: () => void;
    onMoveToBottom?: () => void;
}

export function SortableBlockItem({ 
    id, index, block, isSelected, simulationVars, autocompleteVariables, onSelect, onRemove, onDuplicate, onSwap, totalCount, onUpdate,
    selectedSubBlockId, onSelectSubBlock, onRemoveSubBlock, onDuplicateSubBlock, onSwapSubBlocks, onUpdateSubBlock,
    isMultiSelected, onToggleSelect, onMoveToTop, onMoveToBottom
}: SortableBlockItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
    };

    return (
        <div 
            ref={setNodeRef} 
            style={style} 
            className={cn(
                "relative group/block transition-all duration-300",
                isSelected && "z-10"
            )}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            onFocusCapture={() => onSelect()}
            onMouseDownCapture={() => onSelect()}
        >
            <div className={cn(
                "absolute inset-0 border-2 pointer-events-none transition-all duration-300 z-10",
                isSelected ? "border-blue-600 bg-blue-500/[0.01] shadow-xl" : "border-transparent group-hover/block:border-blue-400/40"
            )} />

            <div className={cn(
                "absolute -top-[27px] left-0 right-0 z-20 flex items-center justify-between pointer-events-none opacity-0 group-hover/block:opacity-100 transition-opacity duration-200",
                (isSelected || isMultiSelected) && "opacity-100"
            )}>
                <div className="pointer-events-auto bg-blue-600 text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-t-lg flex items-center gap-1.5 shadow-md">
                    <input 
                        type="checkbox" 
                        checked={isMultiSelected || false}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleSelect?.();
                        }}
                        className="h-3 w-3 rounded border-white/30 text-blue-600 focus:ring-blue-500 cursor-pointer bg-white/20 accent-blue-600 mr-0.5"
                    />
                    {React.createElement(blockIcons[block.type] || Type, { className: "h-3 w-3" })}
                    {block.type}
                </div>
                <div className="pointer-events-auto flex items-center gap-0.5 bg-blue-600 text-white rounded-t-lg p-0.5 shadow-md">
                    <div {...attributes} {...listeners} className="cursor-grab p-1 hover:bg-white/20 rounded transition-colors text-white" title="Drag to reorder">
                        <GripVertical className="h-3 w-3" />
                    </div>
                    <button 
                        type="button" 
                        className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none" 
                        onClick={(e) => { e.stopPropagation(); onMoveToTop?.(); }} 
                        disabled={index === 0}
                        title="Move to Top"
                    >
                        <ArrowUpToLine className="h-3 w-3" />
                    </button>
                    <button 
                        type="button" 
                        className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none" 
                        onClick={(e) => { e.stopPropagation(); onSwap(index, index - 1); }} 
                        disabled={index === 0}
                        title="Move Up"
                    >
                        <ArrowUp className="h-3 w-3" />
                    </button>
                    <button 
                        type="button" 
                        className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none" 
                        onClick={(e) => { e.stopPropagation(); onSwap(index, index + 1); }} 
                        disabled={index === totalCount - 1}
                        title="Move Down"
                    >
                        <ArrowDown className="h-3 w-3" />
                    </button>
                    <button 
                        type="button" 
                        className="p-1 hover:bg-white/20 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none" 
                        onClick={(e) => { e.stopPropagation(); onMoveToBottom?.(); }} 
                        disabled={index === totalCount - 1}
                        title="Move to Bottom"
                    >
                        <ArrowDownToLine className="h-3 w-3" />
                    </button>
                    <button 
                        type="button" 
                        className="p-1 hover:bg-white/20 rounded transition-colors" 
                        onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
                        title="Clone Block"
                    >
                        <Copy className="h-3 w-3" />
                    </button>
                    <button 
                        type="button" 
                        className="p-1 hover:bg-red-500 rounded transition-colors text-red-200 hover:text-white" 
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        title="Delete Block"
                    >
                        <Trash2 className="h-3 w-3" />
                    </button>
                </div>
            </div>
            
            <div className="relative">
                <VisualBlock 
                    block={block} 
                    simulationVars={simulationVars} 
                    isEditing={isSelected}
                    onContentUpdate={onUpdate}
                    autocompleteVariables={autocompleteVariables}
                    selectedSubBlockId={selectedSubBlockId}
                    onSelectSubBlock={onSelectSubBlock}
                    onRemoveSubBlock={onRemoveSubBlock}
                    onDuplicateSubBlock={onDuplicateSubBlock}
                    onSwapSubBlocks={onSwapSubBlocks}
                    onUpdateSubBlock={onUpdateSubBlock}
                />
            </div>
        </div>
    );
}