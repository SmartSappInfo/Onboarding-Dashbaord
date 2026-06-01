'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import {
    Pencil, Plus, X, Mail, ShieldCheck,
    Globe, Search, RefreshCw, AlertCircle, ChevronRight, ChevronDown, Check,
    Smartphone, MessageSquare, CopyPlus, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { TemplateCategory, RecipientType, MessageChannel, MessageTemplate } from '@/lib/types';
import { fetchTemplatesCached, getTemplatesCachedSync } from './template-cache-manager';
import { useTenant } from '@/context/TenantContext';
import { cn } from '@/lib/utils';
import { plainTextToHtml, renderBlocksToHtml } from '@/lib/messaging-utils';

// Heavy workshop sheet — code-split, loads only when user opens creator
const TemplateWorkshopSheet = dynamic(
    () => import('@/app/admin/messaging/components/TemplateWorkshopSheet').then(m => m.TemplateWorkshopSheet),
    { ssr: false }
);

// UI theme classes are mapped to standard Tailwind semantic tokens (bg-background, bg-card, border-border, bg-primary, etc.)

// ─── Props ─────────────────────────────────────────────────────────────────────
export interface MessagingTemplateSelectorProps {
    category: TemplateCategory | 'all';
    recipientType: RecipientType | 'all';
    channel: MessageChannel;
    templateTypePrefix?: string;
    value?: string;
    onValueChange: (value: string) => void;
    onSelect?: (template: any) => void;
    placeholder?: string;
    className?: string;
    compact?: boolean;
}

const CATEGORIES_LIST = [
    { key: 'general',     label: 'General'     },
    { key: 'surveys',     label: 'Surveys'     },
    { key: 'meetings',    label: 'Meetings'    },
    { key: 'forms',       label: 'Forms'       },
    { key: 'agreements',  label: 'Agreements'  },
    { key: 'campaigns',   label: 'Campaigns'   },
    { key: 'reminders',   label: 'Reminders'   },
    { key: 'tasks',       label: 'Tasks'       },
    { key: 'automations', label: 'Automations' },
    { key: 'qr_codes',    label: 'QR Codes'    },
    { key: 'users',       label: 'Users'       },
];

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const CardSkeleton = React.memo(function CardSkeleton() {
    return (
        <div className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
            <div className="h-[200px] bg-muted/40" />
            <div className="p-4 space-y-2.5">
                <div className="h-2.5 bg-muted rounded-md w-3/4" />
                <div className="h-2 bg-muted/60 rounded-md w-1/2" />
                <div className="flex gap-1.5 mt-1">
                    <div className="h-4 w-12 bg-muted/60 rounded" />
                    <div className="h-4 w-10 bg-muted/60 rounded" />
                </div>
            </div>
        </div>
    );
});

// ─── ResizeObserver iframe preview (identical quality to template-gallery) ─────
interface ResponsiveIframePreviewProps {
    srcDoc: string;
    title?: string;
    className?: string;
}
const ResponsiveIframePreview = React.memo(function ResponsiveIframePreview({
    srcDoc, title = 'Preview', className,
}: ResponsiveIframePreviewProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(0.25);
    const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
    const [isMeasured, setIsMeasured] = React.useState(false);
    const [inView, setInView] = React.useState(false);

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setInView(true); },
            { threshold: 0.05 }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    React.useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver((entries) => {
            const entry = entries[0];
            if (!entry) return;
            const { width, height } = entry.contentRect;
            if (width <= 0 || height <= 0) return;
            const vw = 800;
            const newScale = width / vw;
            setScale(newScale);
            setDimensions({ width: vw, height: height / newScale });
            setIsMeasured(true);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    return (
        <div ref={containerRef} className={cn('w-full h-full overflow-hidden relative bg-slate-50', className)}>
            {inView && (
                <iframe
                    srcDoc={srcDoc}
                    sandbox="allow-same-origin"
                    style={{
                        width: `${dimensions.width}px`,
                        height: `${dimensions.height}px`,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        border: 'none',
                    }}
                    className={cn('pointer-events-none transition-opacity duration-300', isMeasured ? 'opacity-100' : 'opacity-0')}
                    title={title}
                    loading="lazy"
                />
            )}
            {(!inView || !isMeasured) && (
                <div className="absolute inset-0 flex items-center justify-center bg-card">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary/30" />
                </div>
            )}
        </div>
    );
});

// ─── SMS simulator bubble ─────────────────────────────────────────────────────
const SmsBubble = React.memo(function SmsBubble({ body }: { body: string }) {
    return (
        <div className="w-full h-full flex flex-col justify-end p-4 bg-background relative overflow-hidden">
            {/* Decorative grid */}
            <div className="absolute inset-0 opacity-[0.03]"
                style={{ backgroundImage: 'radial-gradient(var(--primary) 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            <div className="relative z-10 bg-primary/10 border border-primary/20 rounded-2xl rounded-bl-sm px-4 py-3 overflow-hidden shadow-lg shadow-primary/5">
                <p className="text-[10px] text-foreground/80 leading-relaxed font-sans whitespace-pre-wrap line-clamp-6">
                    {body}
                </p>
            </div>
            {/* status bar hint */}
            <div className="relative z-10 flex items-center gap-1.5 mt-2.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                <span className="text-[8px] text-muted-foreground/40 font-medium">Delivered</span>
            </div>
            <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-background to-transparent pointer-events-none z-20" />
        </div>
    );
});

// ─── Picker thumbnail card ─────────────────────────────────────────────────────
interface PickerCardProps {
    tmpl: MessageTemplate;
    isSelected: boolean;
    isPreviewed: boolean;
    onClick: (tmpl: MessageTemplate) => void;
    onUse: (tmpl: MessageTemplate) => void;
    onCloneAndEdit: (tmpl: MessageTemplate) => void;
}
const isHtmlContent = (body: string) => body.trimStart().startsWith('<');

const PickerCard = React.memo(function PickerCard({
    tmpl, isSelected, isPreviewed, onClick, onUse, onCloneAndEdit,
}: PickerCardProps) {
    const isEmail = tmpl.channel === 'email';
    const hasHtml = isEmail && (
        (tmpl.contentMode === 'rich_builder' || !!tmpl.blocks?.length) ||
        (tmpl.body && isHtmlContent(tmpl.body))
    );
    const textSnippet = React.useMemo(() => {
        if (!isEmail) return tmpl.body || '';
        if (tmpl.contentMode === 'rich_builder' || tmpl.blocks?.length) {
            const textParts: string[] = [];
            tmpl.blocks?.forEach((b: any) => {
                if (b.type === 'text' && b.content) textParts.push(b.content);
                if (b.type === 'paragraph' && b.content) textParts.push(b.content);
                if (b.type === 'heading' && b.content) textParts.push(b.content);
                if (b.type === 'section' && b.blocks) {
                    b.blocks.forEach((subB: any) => {
                        if (subB.content) textParts.push(subB.content);
                    });
                }
            });
            return textParts.join(' ').replace(/<[^>]*>/g, '') || 'Rich Builder Template';
        }
        return (tmpl.body || '').replace(/<[^>]*>/g, '');
    }, [tmpl, isEmail]);

    return (
        <div
            onClick={() => onClick(tmpl)}
            onDoubleClick={() => onUse(tmpl)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onClick(tmpl); if (e.key === ' ') { e.preventDefault(); onUse(tmpl); } }}
            className={cn(
                'group relative rounded-2xl border cursor-pointer transition-all duration-200 overflow-hidden flex flex-col select-none',
                isSelected || isPreviewed
                    ? 'border-primary/60 ring-1 ring-primary/25 bg-primary/[0.04]'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-muted/10'
            )}
        >
            {/* Selected badge */}
            {isSelected && (
                <div className="absolute top-2.5 right-2.5 z-30 h-5 w-5 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
                    <Check className="h-3 w-3 text-white" />
                </div>
            )}

            {/* Preview area */}
            <div className="h-[200px] relative overflow-hidden rounded-t-2xl flex items-start justify-center">
                {isEmail ? (
                    hasHtml ? (
                        <div className="w-full h-full bg-slate-50/50 dark:bg-zinc-950/10 p-4 overflow-hidden text-left flex flex-col gap-2 relative">
                            <div className="flex flex-col gap-1 shrink-0">
                                <div className="h-2 bg-foreground/10 rounded w-1/3" />
                                <div className="h-1.5 bg-foreground/5 rounded w-2/3" />
                            </div>
                            <div className="h-px bg-border/40 shrink-0" />
                            <p className="text-[9.5px] text-foreground/50 leading-relaxed font-sans whitespace-pre-wrap line-clamp-6 flex-1">
                                {textSnippet}
                            </p>
                            <span className="absolute bottom-3 right-3 text-[8px] font-bold uppercase tracking-wider text-muted-foreground/30 px-1.5 py-0.5 bg-muted/30 border border-border rounded">
                                HTML Layout
                            </span>
                        </div>
                    ) : (
                        <div className="w-full h-full bg-muted/10 p-4 overflow-hidden">
                            <p className="text-[9.5px] text-foreground/40 leading-relaxed font-sans whitespace-pre-wrap line-clamp-9">
                                {tmpl.body}
                            </p>
                        </div>
                    )
                ) : (
                    <SmsBubble body={tmpl.body} />
                )}

                {/* Hover / active overlay with CTAs */}
                <div className={cn(
                    'absolute inset-0 flex flex-col items-center justify-center gap-3 transition-all duration-200 z-20',
                    isPreviewed
                        ? 'opacity-100 bg-background/50 backdrop-blur-[2px]'
                        : 'opacity-0 group-hover:opacity-100 bg-background/40 backdrop-blur-[1px]'
                )}>
                    <Button
                        type="button"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onUse(tmpl); }}
                        className="h-8 px-5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-lg shadow-primary/30 gap-1.5 transition-transform duration-150 hover:scale-105"
                    >
                        <Check className="h-3 w-3" />
                        Use this template
                    </Button>
                    <Button
                        type="button"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onCloneAndEdit(tmpl); }}
                        className="h-8 px-4 rounded-xl border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white hover:border-zinc-600 text-xs font-semibold gap-1.5 transition-transform duration-150 hover:scale-105"
                    >
                        <CopyPlus className="h-3 w-3" />
                        Clone &amp; Edit
                    </Button>
                </div>

                {/* Bottom fade */}
                <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none z-10" />
            </div>

            {/* Card metadata */}
            <div className="px-3.5 pt-3 pb-3.5 space-y-1.5 flex-1">
                <h4 className={cn(
                    'text-[11px] font-bold leading-snug truncate transition-colors',
                    isPreviewed ? 'text-primary' : isSelected ? 'text-primary' : 'text-foreground/90 group-hover:text-foreground'
                )}>
                    {tmpl.name}
                </h4>

                <div className="flex items-center gap-1.5 flex-wrap">
                    {tmpl.scope === 'organization' ? (
                        <span className="inline-flex items-center gap-0.5 text-[7px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1.5 py-0.5">
                            <ShieldCheck className="h-2 w-2" /> Custom
                        </span>
                    ) : (
                        <span className="inline-flex items-center gap-0.5 text-[7px] font-bold uppercase tracking-wider bg-primary/8 text-primary/60 border border-primary/15 rounded px-1.5 py-0.5">
                            <Globe className="h-2 w-2" /> Global
                        </span>
                    )}
                    {tmpl.category && (
                        <span className="inline-flex items-center text-[7px] font-bold uppercase tracking-wider bg-muted/40 text-muted-foreground border border-border rounded px-1.5 py-0.5 capitalize">
                            {tmpl.category.replace('_', ' ')}
                        </span>
                    )}
                </div>

                {tmpl.subject && (
                    <p className="text-[9px] text-foreground/35 font-medium truncate">
                        <span className="text-foreground/20 uppercase text-[7px] tracking-widest font-bold mr-1">Subject:</span>
                        {tmpl.subject}
                    </p>
                )}
            </div>
        </div>
    );
});

// ─── Category sidebar button ───────────────────────────────────────────────────
const CategoryButton = React.memo(function CategoryButton({
    label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'w-full text-left px-3 py-2 rounded-xl flex items-center justify-between text-[11px] font-semibold transition-all duration-150 active:scale-[0.98]',
                active
                    ? 'bg-primary/15 text-primary border border-primary/30 font-bold'
                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground border border-transparent'
            )}
        >
            <span className="truncate">{label}</span>
            <span className={cn(
                'text-[8px] font-bold px-1.5 py-0.5 rounded min-w-[20px] text-center tabular-nums',
                active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
            )}>
                {count}
            </span>
        </button>
    );
});

// ─── Live preview pane (right panel) ─────────────────────────────────────────
const LivePreviewPane = React.memo(function LivePreviewPane({ tmpl }: { tmpl: MessageTemplate | null }) {
    const isEmail = tmpl?.channel === 'email';
    const emailSrcDoc = React.useMemo(() => {
        if (!tmpl || !isEmail) return '';
        if (tmpl.contentMode === 'rich_builder' || tmpl.blocks?.length) {
            return renderBlocksToHtml(tmpl.blocks || [], {});
        }
        return tmpl.contentMode === 'plain_text' ? plainTextToHtml(tmpl.body) : tmpl.body;
    }, [tmpl, isEmail]);

    if (!tmpl) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 p-6">
                <div className="h-12 w-12 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                    <Eye className="h-5 w-5 text-primary/30" />
                </div>
                <div>
                    <p className="text-[11px] font-semibold text-foreground/30">Click a template</p>
                    <p className="text-[9px] text-foreground/20 mt-0.5 leading-relaxed max-w-[160px]">to see a full preview here</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Preview header */}
            <div className="px-4 py-3 border-b border-border shrink-0 space-y-1.5">
                <h3 className="text-xs font-bold text-foreground/90 truncate leading-tight">{tmpl.name}</h3>
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={cn(
                        'inline-flex items-center gap-0.5 text-[7px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5 border',
                        isEmail ? 'bg-primary/10 text-primary border-primary/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    )}>
                        {isEmail ? <Mail className="h-2 w-2" /> : <Smartphone className="h-2 w-2" />}
                        {isEmail ? 'Email' : 'SMS'}
                    </span>
                    {tmpl.category && (
                        <span className="text-[7px] text-foreground/30 font-bold uppercase tracking-wider capitalize">
                            {tmpl.category.replace('_', ' ')}
                        </span>
                    )}
                </div>
                {tmpl.subject && (
                    <p className="text-[9px] text-foreground/40 truncate">
                        <span className="text-foreground/20 uppercase text-[7px] tracking-widest font-bold mr-1">Subject:</span>
                        {tmpl.subject}
                    </p>
                )}
            </div>

            {/* Preview body */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
                {isEmail ? (
                    emailSrcDoc ? (
                        <ResponsiveIframePreview srcDoc={emailSrcDoc} title={tmpl.name} className="absolute inset-0" />
                    ) : (
                        <div className="h-full p-4 overflow-y-auto">
                            <p className="text-[10px] text-foreground/50 leading-relaxed whitespace-pre-wrap font-sans">
                                {tmpl.body}
                            </p>
                        </div>
                    )
                ) : (
                    <SmsBubble body={tmpl.body} />
                )}
            </div>
        </div>
    );
});

// ─── Inline selected card (shown when template is chosen in parent UI) ─────────
const InlineSelectedCard = React.memo(function InlineSelectedCard({
    template, channelIcon, onEditClick, onOpenPicker, onClear, isLoading,
}: {
    template: MessageTemplate;
    channelIcon: React.ReactNode;
    onEditClick: () => void;
    onOpenPicker: () => void;
    onClear: () => void;
    isLoading: boolean;
}) {
    const isEmail = template.channel === 'email';
    const emailSrcDoc = React.useMemo(() => {
        if (!isEmail) return '';
        if (template.contentMode === 'rich_builder' || template.blocks?.length) {
            return renderBlocksToHtml(template.blocks || [], {});
        }
        return template.contentMode === 'plain_text' ? plainTextToHtml(template.body) : template.body;
    }, [isEmail, template.contentMode, template.body, template.blocks]);

    return (
        <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm ring-1 ring-primary/10">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        {channelIcon}
                    </div>
                    <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate max-w-[220px]">
                            {isLoading ? 'Loading Blueprint…' : template.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <Badge className={cn(
                                'border-none text-[8px] font-bold h-4 px-1.5 gap-0.5',
                                template.scope === 'organization'
                                    ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/10'
                                    : 'bg-primary/10 text-primary hover:bg-primary/10'
                            )}>
                                {template.scope === 'organization'
                                    ? <><ShieldCheck className="h-2 w-2" /> Org</>
                                    : <><Globe className="h-2 w-2" /> Global</>}
                            </Badge>
                            {template.category && (
                                <Badge variant="outline" className="text-[7px] uppercase font-bold border-border/60 text-muted-foreground h-4 px-1.5">
                                    {template.category}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={onEditClick} title="Edit blueprint">
                        <Pencil className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        onClick={onOpenPicker} title="Change template">
                        <RefreshCw className="h-3 w-3" />
                    </Button>
                    <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={onClear} title="Clear selection">
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            </div>

            {/* Subject */}
            {isEmail && template.subject && (
                <div className="flex items-center gap-1.5 px-4 py-2 bg-primary/5 border-b border-primary/10 text-[10px] font-semibold text-foreground/80">
                    <span className="text-primary/50 uppercase text-[7px] tracking-wider font-bold">Subject:</span>
                    <span className="truncate">{template.subject}</span>
                </div>
            )}

            {/* Live thumbnail */}
            <div className="h-[200px] relative overflow-hidden">
                {isEmail ? (
                    emailSrcDoc && (template.contentMode === 'rich_builder' || template.blocks?.length || isHtmlContent(emailSrcDoc)) ? (
                        <ResponsiveIframePreview srcDoc={emailSrcDoc} title={template.name} className="absolute inset-0" />
                    ) : (
                        <div className="h-full p-4 overflow-y-auto bg-muted/10">
                            <p className="text-[10.5px] leading-relaxed text-muted-foreground whitespace-pre-wrap font-sans">
                                {template.body}
                            </p>
                        </div>
                    )
                ) : (
                    <SmsBubble body={template.body} />
                )}
                <div className="absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-card to-transparent pointer-events-none z-10" />
            </div>
        </div>
    );
});

// ─── Main component ────────────────────────────────────────────────────────────
export function MessagingTemplateSelector({
    category, recipientType, channel, templateTypePrefix,
    value, onValueChange, onSelect,
    placeholder = 'Choose blueprint…',
    className, compact = false,
}: MessagingTemplateSelectorProps) {
    const { activeWorkspaceId, activeOrganizationId } = useTenant();

    const [pickerOpen, setPickerOpen] = React.useState(false);
    const [creatorOpen, setCreatorOpen] = React.useState(false);
    const [editingTemplateId, setEditingTemplateId] = React.useState<string | undefined>();

    // Synchronous initial cache hit resolve to eliminate initial load skeleton flickers
    const initialCached = React.useMemo(() => {
        return getTemplatesCachedSync(
            channel,
            activeWorkspaceId || undefined,
            activeOrganizationId || undefined
        );
    }, [channel, activeWorkspaceId, activeOrganizationId]);

    const [templates, setTemplates] = React.useState<MessageTemplate[]>(() => initialCached || []);
    const [isLoading, setIsLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [selectedCategory, setSelectedCategory] = React.useState('all');
    const [hasFetched, setHasFetched] = React.useState(() => !!initialCached);
    // Click-to-preview state (no hover)
    const [previewedTemplate, setPreviewedTemplate] = React.useState<MessageTemplate | null>(null);

    const fetchTemplates = React.useCallback(async (force = false) => {
        setIsLoading(true);
        try {
            const result = await fetchTemplatesCached(
                channel,
                activeWorkspaceId || undefined,
                activeOrganizationId || undefined,
                force
            );
            setTemplates(result);
            setHasFetched(true);
        } catch (err) {
            console.error('[MessagingTemplateSelector] failed to load:', err);
        } finally {
            setIsLoading(false);
        }
    }, [channel, activeWorkspaceId, activeOrganizationId]);

    React.useEffect(() => {
        if (pickerOpen && !hasFetched) fetchTemplates();
    }, [pickerOpen, hasFetched, fetchTemplates]);

    React.useEffect(() => {
        if (value && !isLoading && !hasFetched && !templates.some(t => t.id === value)) fetchTemplates();
    }, [value, templates, isLoading, hasFetched, fetchTemplates]);

    // Handle synchronous state transition when tenant context resolves or changes
    React.useEffect(() => {
        const cached = getTemplatesCachedSync(
            channel,
            activeWorkspaceId || undefined,
            activeOrganizationId || undefined
        );
        if (cached) {
            setTemplates(cached);
            setHasFetched(true);
        } else {
            setTemplates([]);
            setHasFetched(false);
        }
    }, [channel, activeWorkspaceId, activeOrganizationId]);

    const selectedTemplate = React.useMemo(() => templates.find(t => t.id === value), [templates, value]);

    // Use template — actual selection
    const handleUseTemplate = React.useCallback((tmpl: MessageTemplate) => {
        onValueChange(tmpl.id);
        if (onSelect) onSelect(tmpl);
        setPickerOpen(false);
        setPreviewedTemplate(null);
    }, [onValueChange, onSelect]);

    // Click — preview only, does NOT select
    const handleCardClick = React.useCallback((tmpl: MessageTemplate) => {
        setPreviewedTemplate(prev => prev?.id === tmpl.id ? null : tmpl);
    }, []);

    const handleCreateNewClick = React.useCallback(() => {
        setEditingTemplateId(undefined);
        setPickerOpen(false);
        setTimeout(() => setCreatorOpen(true), 150);
    }, []);

    const handleEditClick = React.useCallback(() => {
        if (value) { setEditingTemplateId(value); setCreatorOpen(true); }
    }, [value]);

    const handleCloneAndEdit = React.useCallback((tmpl: MessageTemplate) => {
        // Open creator pre-populated with a clone context
        setEditingTemplateId(undefined);
        setPickerOpen(false);
        setTimeout(() => setCreatorOpen(true), 150);
    }, []);

    const handleClear = React.useCallback(() => {
        onValueChange('');
        if (onSelect) onSelect(null);
    }, [onValueChange, onSelect]);

    const handleTemplateCreated = React.useCallback((newTmpl: MessageTemplate) => {
        setHasFetched(false);
        fetchTemplates(true);
        onValueChange(newTmpl.id);
        if (onSelect) onSelect(newTmpl);
        setCreatorOpen(false);
    }, [fetchTemplates, onValueChange, onSelect]);

    const channelIcon = channel === 'email'
        ? <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
        : <MessageSquare className="h-3.5 w-3.5 text-primary shrink-0" />;

    const baseTemplates = React.useMemo(() => {
        return templates.filter(t => {
            const matchesRecipient = recipientType === 'all' || t.recipientType === recipientType;
            const matchesPrefix = !templateTypePrefix || t.templateType?.startsWith(templateTypePrefix);
            return matchesRecipient && matchesPrefix;
        });
    }, [templates, recipientType, templateTypePrefix]);

    const filteredTemplates = React.useMemo(() => {
        const q = searchQuery.toLowerCase();
        return baseTemplates.filter(t => {
            const matchSearch = !q
                || t.name.toLowerCase().includes(q)
                || (t.subject || '').toLowerCase().includes(q)
                || (t.body || '').toLowerCase().includes(q);
            return matchSearch && (selectedCategory === 'all' || t.category === selectedCategory);
        });
    }, [baseTemplates, searchQuery, selectedCategory]);

    // Reset preview when picker closes
    const handlePickerOpenChange = React.useCallback((open: boolean) => {
        setPickerOpen(open);
        if (!open) setPreviewedTemplate(null);
    }, []);

    // ── Compact trigger ────────────────────────────────────────────────────────
    const compactView = (
        <div className={cn('w-full space-y-1.5', className)}>
            <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all duration-200 text-left group',
                    value && selectedTemplate
                        ? 'border-primary/30 bg-primary/5 hover:border-primary/50'
                        : 'border-border/70 bg-card hover:border-border hover:bg-muted/20'
                )}
            >
                {channelIcon}
                <span className={cn(
                    'flex-1 min-w-0 text-xs font-semibold truncate',
                    value && selectedTemplate ? 'text-foreground' : 'text-muted-foreground'
                )}>
                    {isLoading && value ? 'Loading…' : value && selectedTemplate ? selectedTemplate.name : placeholder}
                </span>
                {value && selectedTemplate ? (
                    <span className="flex items-center gap-0.5 shrink-0">
                        <span role="button" tabIndex={0}
                            onClick={e => { e.stopPropagation(); handleEditClick(); }}
                            onKeyDown={e => e.key === 'Enter' && handleEditClick()}
                            className="h-5 w-5 flex items-center justify-center rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="h-2.5 w-2.5" />
                        </span>
                        <span role="button" tabIndex={0}
                            onClick={e => { e.stopPropagation(); handleClear(); }}
                            onKeyDown={e => e.key === 'Enter' && handleClear()}
                            className="h-5 w-5 flex items-center justify-center rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <X className="h-2.5 w-2.5" />
                        </span>
                    </span>
                ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
                )}
            </button>
        </div>
    );

    // ── Full card view ─────────────────────────────────────────────────────
    // NOTE: className from callers may contain legacy h-* constraints (e.g. h-12)
    // that were meant for the old <select>-style trigger. We force !h-auto so the
    // card always expands to its natural height regardless of what className contains.
    const fullCardView = (
        <div className={cn('w-full !h-auto space-y-3', className)}>
            {!value ? (
                <div
                    onClick={() => setPickerOpen(true)}
                    className="flex flex-col items-center justify-center py-8 px-6 rounded-2xl border-2 border-dashed border-border/60 bg-card/40 text-center cursor-pointer transition-all duration-300 hover:border-primary/40 hover:bg-primary/5 group"
                >
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                        {channel === 'email' ? <Mail className="h-5 w-5 text-primary" /> : <MessageSquare className="h-5 w-5 text-primary" />}
                    </div>
                    <h4 className="text-sm font-bold text-foreground">No template selected</h4>
                    <p className="text-[10px] text-muted-foreground leading-normal max-w-[240px] mt-1.5 mb-5">
                        Pick a messaging blueprint or create a custom one.
                    </p>
                    <Button type="button" size="sm"
                        className="rounded-xl px-6 text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 h-9">
                        <ChevronRight className="h-3.5 w-3.5 mr-1" /> Browse Templates
                    </Button>
                </div>
            ) : selectedTemplate ? (
                <InlineSelectedCard
                    template={selectedTemplate}
                    channelIcon={channelIcon}
                    onEditClick={handleEditClick}
                    onOpenPicker={() => setPickerOpen(true)}
                    onClear={handleClear}
                    isLoading={isLoading}
                />
            ) : (
                // Loading skeleton — min-height matches the empty state card
                <div className="border border-border bg-card rounded-2xl overflow-hidden animate-pulse">
                    <div className="flex items-center gap-2.5 p-4">
                        <div className="h-7 w-7 rounded-lg bg-muted" />
                        <div className="space-y-1.5 flex-1">
                            <div className="h-2.5 bg-muted rounded w-2/3" />
                            <div className="h-2 bg-muted/60 rounded w-1/3" />
                        </div>
                    </div>
                    <div className="h-[200px] bg-muted/40" />
                </div>
            )}
        </div>
    );

    return (
        <>
            {fullCardView}

            {/* ── Picker dialog ── */}
            <Dialog open={pickerOpen} onOpenChange={handlePickerOpenChange}>
                <DialogContent
                    className={cn(
                        'w-[96vw] max-w-[1440px] h-[90vh] p-0 overflow-hidden flex flex-col rounded-3xl shadow-2xl shadow-black/70 z-[100]',
                        'border border-border bg-background',
                        '[&>button]:right-5 [&>button]:top-5 [&>button]:text-foreground/30 [&>button]:hover:text-foreground/70'
                    )}
                >
                    {/* ── Modal header ── */}
                    <div className={cn(
                        'px-6 py-5 border-b border-border shrink-0 flex items-center justify-between pr-14',
                        'bg-background'
                    )}>
                        <div className="flex items-center gap-2.5">
                            <div className="h-7 w-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                                {channel === 'email' ? <Mail className="h-4 w-4 text-primary" /> : <Smartphone className="h-4 w-4 text-primary" />}
                            </div>
                            <div>
                                <DialogTitle className="text-base font-bold text-foreground tracking-tight">
                                    Select {channel === 'email' ? 'Email' : 'SMS'} Template
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    Browse and select a template for your message.
                                </DialogDescription>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl border border-border bg-muted/20 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                onClick={() => fetchTemplates(true)}
                                disabled={isLoading}
                                title="Refresh templates"
                            >
                                <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                            </Button>
                            <div className="relative w-64">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                                <Input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    placeholder="Search blueprints…"
                                    className={cn(
                                        'h-9 pl-9 rounded-xl text-xs font-semibold',
                                        'border border-border bg-muted/20',
                                        'text-foreground placeholder:text-muted-foreground/50',
                                        'focus:border-primary/40 focus:bg-muted/30 transition-colors'
                                    )}
                                />
                            </div>
                        </div>
                    </div>

                    {/* ── Modal body: categories | grid | preview ── */}
                    <div className="flex-1 min-h-0 flex overflow-hidden">

                        {/* LEFT — Category sidebar */}
                        <div className={cn(
                            'w-44 border-r border-border p-3 space-y-0.5 overflow-y-auto shrink-0 select-none',
                            'bg-background'
                        )}>
                            <p className="text-[8px] font-bold uppercase tracking-widest text-foreground/20 px-2 pt-1 pb-2">Categories</p>
                            <CategoryButton label="All Types" count={baseTemplates.length} active={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')} />
                            {CATEGORIES_LIST.map(cat => (
                                <CategoryButton
                                    key={cat.key}
                                    label={cat.label}
                                    count={baseTemplates.filter(t => t.category === cat.key).length}
                                    active={selectedCategory === cat.key}
                                    onClick={() => setSelectedCategory(cat.key)}
                                />
                            ))}
                        </div>

                        {/* CENTRE — Template grid */}
                        <div className="flex-1 px-5 py-5 overflow-y-auto">
                            {isLoading ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
                                </div>
                            ) : filteredTemplates.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-center p-8 gap-4">
                                    <div className="h-14 w-14 rounded-2xl bg-primary/8 border border-primary/15 flex items-center justify-center">
                                        <AlertCircle className="h-6 w-6 text-primary/25" />
                                    </div>
                                    <div>
                                        <h4 className="text-xs font-bold text-foreground/40">No Blueprints Found</h4>
                                        <p className="text-[10px] text-foreground/20 leading-normal mt-1 max-w-[200px]">
                                            No templates match your search or selected category.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredTemplates.map(tmpl => (
                                        <PickerCard
                                            key={tmpl.id}
                                            tmpl={tmpl}
                                            isSelected={tmpl.id === value}
                                            isPreviewed={previewedTemplate?.id === tmpl.id}
                                            onClick={handleCardClick}
                                            onUse={handleUseTemplate}
                                            onCloneAndEdit={handleCloneAndEdit}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* RIGHT — Live preview pane (wider: 320px) */}
                        <div className={cn(
                            'w-[480px] border-l border-border shrink-0 overflow-hidden flex flex-col',
                            'bg-background'
                        )}>
                            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center gap-2 bg-muted/10">
                                <Eye className="h-3.5 w-3.5 text-primary" />
                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Live Preview</p>
                                {previewedTemplate && (
                                    <button
                                        type="button"
                                        onClick={() => setPreviewedTemplate(null)}
                                        className="ml-auto text-muted-foreground/45 hover:text-foreground transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                            <div className="flex-1 min-h-0 bg-background">
                                <LivePreviewPane tmpl={previewedTemplate} />
                            </div>
                            {/* Use button in preview pane */}
                            {previewedTemplate && (
                                <div className="p-4 border-t border-border bg-background shrink-0 space-y-2">
                                    <Button
                                        type="button"
                                        className="w-full h-9 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold gap-2 shadow-md shadow-primary/20"
                                        onClick={() => handleUseTemplate(previewedTemplate)}
                                    >
                                        <Check className="h-3.5 w-3.5" /> Use this template
                                    </Button>
                                    <Button
                                        type="button"
                                        className="w-full h-8 rounded-xl border border-zinc-700 bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white hover:border-zinc-600 text-xs font-semibold gap-2 transition-transform duration-150 active:scale-[0.98]"
                                        onClick={() => handleCloneAndEdit(previewedTemplate)}
                                    >
                                        <CopyPlus className="h-3.5 w-3.5" /> Clone &amp; Edit
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Modal footer ── */}
                    <div className={cn(
                        'px-6 py-4 border-t border-border shrink-0 flex items-center justify-between',
                        'bg-background'
                    )}>
                        <span className="text-[10px] text-foreground/25 font-medium">
                            {filteredTemplates.length} blueprint{filteredTemplates.length !== 1 ? 's' : ''} available
                            {previewedTemplate && (
                                <span className="ml-2 text-primary/50">· Previewing: <span className="font-semibold">{previewedTemplate.name}</span></span>
                            )}
                        </span>
                        <Button
                            type="button"
                            onClick={handleCreateNewClick}
                            className="rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20 gap-1.5 px-5"
                        >
                            <Plus className="h-3.5 w-3.5" /> Create Custom Template
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── Creator / editor sheet ── */}
            {creatorOpen && (
                <TemplateWorkshopSheet
                    open={creatorOpen}
                    onOpenChange={setCreatorOpen}
                    onCreated={handleTemplateCreated}
                    templateId={editingTemplateId}
                    initialContext={{
                        category: category === 'all' ? undefined : category,
                        channel,
                        recipientType: recipientType === 'all' ? undefined : recipientType,
                        templateType: editingTemplateId
                            ? undefined
                            : templateTypePrefix ? `${templateTypePrefix}_${Date.now()}` : undefined,
                    }}
                />
            )}
        </>
    );
}
