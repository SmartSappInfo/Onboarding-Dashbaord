'use client';

import * as React from 'react';
import { 
    X, 
    Pencil, 
    Monitor, 
    Smartphone, 
    ArrowLeft, 
    Info, 
    MoreHorizontal, 
    Phone,
    Video,
    Sparkles,
    MessageCircle
} from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { renderBlocksToHtml, resolveVariables, plainTextToHtml } from '@/lib/messaging-utils';
import { parseMarkdownLinksToHtml } from '@/lib/utils/markdown-link-parser';
import { resolveBrandingPreview } from '@/lib/utils/resolve-branding-preview';
import type { MessageTemplate, MessageStyle } from '@/lib/types';
import type { WhatsAppDisplayTemplate } from '../lib/unified-template';
import { renderPreview } from './whatsapp/shared';

// Premium high-fidelity mock variables for rendering exact state without unresolved curly braces
const MOCK_VARIABLES: Record<string, string> = {
    recipient_name: 'Alex Rivera',
    contact_name: 'Alex Rivera',
    user_name: 'Alex Rivera',
    workspace_name: 'Acme Corporation',
    organization_name: 'Acme Corporation',
    sender_name: 'Onboarding Team',
    meeting_link: 'https://smartsapp.com/meeting/join',
    survey_link: 'https://smartsapp.com/survey/feedback',
    form_link: 'https://smartsapp.com/form/submit',
    agreement_link: 'https://smartsapp.com/agreement/sign',
    meeting_time: 'Monday, Oct 24 at 10:00 AM',
    org_logo_url: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/SmartSapp%20Logo%20short.png?alt=media&token=046f95a8-b331-4129-a4ef-43ae7837eadd',
    org_name: 'Acme Academy',
    org_email: 'support@acme.edu',
    org_phone: '+1 (555) 019-2834',
    org_address: '123 Innovation Way, Suite 400',
    current_year: new Date().getFullYear().toString(),
    score: '92',
    max_score: '100'
};

interface TemplatePreviewModalProps {
    template: MessageTemplate | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit?: (tmpl: MessageTemplate) => void;
    styles?: MessageStyle[];
}

export function TemplatePreviewModal({
    template,
    isOpen,
    onClose,
    onEdit,
    styles = []
}: TemplatePreviewModalProps) {
    const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');

    // Auto-reset viewMode to mobile if it's SMS, since SMS only exists on mobile
    React.useEffect(() => {
        if (template?.channel === 'sms') {
            setViewMode('mobile');
        } else {
            setViewMode('desktop');
        }
    }, [template]);

    // Parse and resolve body & blocks using mock variables
    const resolvedContent = React.useMemo(() => {
        if (!template) return '';

        let activeStyle: MessageStyle | null = null;
        if (template.styleId !== 'none') {
            const styleIdToUse = template.styleId;
            if (!styleIdToUse || styleIdToUse === 'default') {
                activeStyle = styles.find(s => s.isDefault) || null;
            } else {
                activeStyle = styles.find(s => s.id === styleIdToUse) || null;
            }
        }

        const channel = template.channel;
        const contentMode = template.contentMode;

        // Auto-detect variable tokens from the template content and inject default mocks
        const contentForScan = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
        const matches = contentForScan.match(/\{\{([^{}]+?)\}\}/g);
        const detectedVars = matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        const mergedMocks = { ...MOCK_VARIABLES };
        detectedVars.forEach(v => {
            if (!(v in mergedMocks)) {
                mergedMocks[v] = `[${v.replace(/_/g, ' ')}]`;
            }
        });

        let styleWrapper = '';
        if (activeStyle) {
            if (template.target === 'internal_team') {
                styleWrapper = activeStyle.htmlWrapperInternal || activeStyle.htmlWrapper || '';
            } else {
                styleWrapper = activeStyle.htmlWrapperExternal || activeStyle.htmlWrapper || '';
            }

            const brandingData = {
                name: mergedMocks.org_name ?? 'Acme Academy',
                logoUrl: mergedMocks.org_logo_url ?? '',
                email: mergedMocks.org_email ?? 'support@acme.edu',
                phone: mergedMocks.org_phone ?? '+1 (555) 019-2834',
                address: mergedMocks.org_address ?? '123 Innovation Way, Suite 400',
                website: mergedMocks.org_website ?? 'https://smartsapp.com',
                footerHtml: activeStyle.footerHtml,
                footerEnabled: activeStyle.footerEnabled !== false
            };
            const styleOverrides = {
                primaryColor: activeStyle.primaryColor,
                secondaryColor: activeStyle.secondaryColor,
                fontFamily: activeStyle.fontFamily,
                backgroundColor: activeStyle.backgroundColor,
                textColor: activeStyle.textColor,
                cardBackgroundColor: activeStyle.cardBackgroundColor,
                borderRadius: activeStyle.borderRadius,
                footerHtml: activeStyle.footerHtml,
                footerEnabled: activeStyle.footerEnabled !== false
            };
            styleWrapper = resolveBrandingPreview(styleWrapper, brandingData, styleOverrides);
        }

        if (channel === 'sms') {
            return resolveVariables(template.body, mergedMocks);
        }

        if (contentMode === 'rich_builder') {
            return renderBlocksToHtml(template.blocks || [], mergedMocks, {
                wrapper: styleWrapper || undefined,
                style: activeStyle || undefined
            });
        }

        let resolved = resolveVariables(template.body, mergedMocks);
        if (styleWrapper && styleWrapper.includes('{{content}}')) {
            let contentHtml = resolved;
            if (contentMode === 'plain_text' || !contentMode) {
                const escaped = contentHtml
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                const withLinks = parseMarkdownLinksToHtml(escaped);
                contentHtml = withLinks.replace(/\n/g, '<br>\n');
            }
            resolved = resolveVariables(styleWrapper, mergedMocks).replace('{{content}}', contentHtml);
        } else if (contentMode === 'plain_text' || !contentMode) {
            resolved = plainTextToHtml(resolved);
        }
        return resolved;
    }, [template, styles]);

    // Character cost & segment analysis for SMS
    const smsAnalysis = React.useMemo(() => {
        if (!template || template.channel !== 'sms') return null;
        const length = resolvedContent.length;
        const segments = length <= 160 ? 1 : Math.ceil(length / 153);
        return {
            length,
            segments,
            isMultiSegment: segments > 1
        };
    }, [template, resolvedContent]);

    if (!template) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-4xl w-[92vw] h-[85vh] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl flex flex-col bg-background [&>button]:hidden">
                {/* Screen Reader Accessible Titles & Descriptions */}
                <DialogTitle className="sr-only">
                    Previewing {template.name} ({template.channel})
                </DialogTitle>
                <DialogDescription className="sr-only">
                    High fidelity simulated preview of the messaging blueprint.
                </DialogDescription>

                {/* Minimalist Top Nav Header */}
                <div className="h-auto md:h-16 py-3 md:py-0 shrink-0 border-b border-border/60 px-4 md:px-6 flex flex-col md:flex-row gap-3 md:gap-0 md:items-center md:justify-between bg-card/40 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            "p-2 rounded-xl border font-semibold",
                            template.channel === 'sms' 
                                ? "bg-orange-500/10 text-orange-500 border-orange-200/50 dark:border-orange-950" 
                                : "bg-blue-500/10 text-blue-500 border-blue-200/50 dark:border-blue-950"
                        )}>
                            {template.channel === 'sms' ? <Smartphone className="h-4 w-4" /> : <Monitor className="h-4 w-4" />}
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground tracking-tight line-clamp-1">{template.name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{template.channel} Preview</p>
                        </div>
                    </div>

                    {/* View Controls & Toggles */}
                    <div className="flex items-center gap-2 md:gap-4 justify-between md:justify-end flex-wrap">
                        {template.channel === 'email' && (
                            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border shadow-inner">
                                <Button 
                                    variant={viewMode === 'desktop' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="h-8 gap-2 rounded-lg font-semibold text-[10px] px-2.5 md:px-3 transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
                                    onClick={() => setViewMode('desktop')}
                                >
                                    <Monitor className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Desktop</span>
                                </Button>
                                <Button 
                                    variant={viewMode === 'mobile' ? 'secondary' : 'ghost'} 
                                    size="sm" 
                                    className="h-8 gap-2 rounded-lg font-semibold text-[10px] px-2.5 md:px-3 transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
                                    onClick={() => setViewMode('mobile')}
                                >
                                    <Smartphone className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Mobile</span>
                                </Button>
                            </div>
                        )}

                        <div className="hidden sm:block h-5 w-px bg-border/60" />

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 ml-auto sm:ml-0">
                            {onEdit && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-9 gap-2 rounded-xl font-bold text-xs bg-background hover:bg-muted border shadow-sm transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97]"
                                    onClick={() => {
                                        onEdit?.(template);
                                        onClose();
                                    }}
                                >
                                    <Pencil className="h-3.5 w-3.5" /> Edit Template
                                </Button>
                            )}
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 rounded-xl border hover:bg-muted transition-all duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] text-muted-foreground hover:text-foreground"
                                onClick={onClose}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Main simulation container */}
                <div className="flex-1 overflow-auto bg-muted/20 flex items-center justify-center p-8 transition-all duration-500">
                    
                    {/* SMS Mobile Mockup */}
                    {template.channel === 'sms' && (
                        <div className="relative w-[340px] h-[620px] rounded-[3rem] border-8 border-slate-900 bg-black dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-500">
                            {/* Camera Notch / Dynamic Island */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full ml-auto mr-4" />
                            </div>

                            {/* SMS Simulator Interface */}
                            <div className="flex-1 bg-[#F4F4F7] dark:bg-zinc-950 flex flex-col pt-8 pb-4 px-4 overflow-hidden relative">
                                
                                {/* Status bar mockup */}
                                <div className="h-6 flex items-center justify-between px-4 text-xs font-semibold text-zinc-900 dark:text-zinc-100 z-10 shrink-0">
                                    <span>9:41</span>
                                    <div className="flex items-center gap-1">
                                        <span>5G</span>
                                        <div className="w-5 h-2.5 border border-current rounded-sm p-0.5 flex items-center"><div className="bg-current w-3 h-full rounded-2xs" /></div>
                                    </div>
                                </div>

                                {/* Chat header */}
                                <div className="h-14 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 pb-2 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <ArrowLeft className="h-4 w-4 text-blue-600 dark:text-blue-400 cursor-pointer" />
                                        <div className="w-8 h-8 rounded-full bg-zinc-300 dark:bg-zinc-800 flex items-center justify-center font-bold text-xs text-zinc-600 dark:text-zinc-400">
                                            {template.name.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 leading-tight">{template.name}</p>
                                            <p className="text-[8px] text-green-500 font-semibold uppercase tracking-wider">SMS Gateway Active</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2.5 text-blue-600 dark:text-blue-400 pr-1">
                                        <Phone className="h-3.5 w-3.5" />
                                        <Video className="h-3.5 w-3.5" />
                                    </div>
                                </div>

                                {/* Message bubble area */}
                                <div className="flex-1 overflow-y-auto py-6 flex flex-col justify-end gap-4 min-h-0">
                                    {/* System info badge */}
                                    <div className="text-center">
                                        <span className="text-[8px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800/50 px-2.5 py-1 rounded-full">
                                            Today 9:41 AM
                                        </span>
                                    </div>

                                    {/* Incoming text message bubble */}
                                    <div className="flex items-start gap-2 max-w-[85%] self-start animate-in slide-in-from-left duration-300">
                                        <div className="p-3.5 bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-2xl rounded-tl-none shadow-sm text-xs leading-relaxed font-medium break-words">
                                            <p className="whitespace-pre-wrap">{resolvedContent}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Cost cost analyzer bar */}
                                <div className="mt-2 pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col gap-1.5 items-center text-center shrink-0">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500">
                                        <Info className="h-3 w-3" />
                                        <span>{smsAnalysis?.length} Characters &bull; {smsAnalysis?.segments} SMS segment{smsAnalysis?.segments !== 1 ? 's' : ''}</span>
                                    </div>
                                    {smsAnalysis?.isMultiSegment && (
                                        <div className="px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-[8px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wide rounded-lg flex items-center gap-1">
                                            <Sparkles className="h-2.5 w-2.5 animate-pulse" /> Carrier Segment Limits Exceeded (Charges Apply)
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Email Browser Preview */}
                    {template.channel === 'email' && viewMode === 'desktop' && (
                        <div className="w-full max-w-4xl h-[70vh] rounded-2xl bg-card border border-border shadow-xl flex flex-col overflow-hidden animate-in fade-in duration-500">
                            
                            {/* Browser Header / Address Bar Mock */}
                            <div className="h-12 border-b border-border/80 bg-muted/30 px-4 flex items-center gap-2 shrink-0">
                                <div className="flex gap-1.5 items-center mr-4">
                                    <div className="w-3 h-3 rounded-full bg-red-400/80" />
                                    <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                                    <div className="w-3 h-3 rounded-full bg-green-400/80" />
                                </div>
                                <div className="flex-1 max-w-xl h-7 bg-background border rounded-lg px-3 flex items-center justify-between text-[10px] text-muted-foreground shadow-inner">
                                    <span className="truncate select-none">https://mail.smartsapp.com/u/0/inbox/preview</span>
                                </div>
                            </div>

                            {/* Email metadata header */}
                            <div className="p-5 border-b border-border/80 space-y-1.5 shrink-0 bg-card">
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                                    <span>Subject:</span>
                                </div>
                                <h4 className="text-sm font-semibold text-foreground tracking-tight leading-none">
                                    {template.subject ? resolveVariables(template.subject, MOCK_VARIABLES) : '(No Subject Specified)'}
                                </h4>
                            </div>

                            {/* Frame container */}
                            <div className="flex-1 bg-muted/10 relative overflow-hidden">
                                <iframe 
                                    srcDoc={resolvedContent} 
                                    className="w-full h-full border-none bg-card" 
                                    title="Email Widescreen Browser Mockup" 
                                />
                            </div>
                        </div>
                    )}

                    {/* Email Mobile Frame Preview */}
                    {template.channel === 'email' && viewMode === 'mobile' && (
                        <div className="relative w-[340px] h-[620px] rounded-[3rem] border-8 border-slate-900 bg-black dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in fade-in duration-500">
                            
                            {/* Camera Notch / Dynamic Island */}
                            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-28 h-5 bg-black rounded-full z-30 flex items-center justify-center">
                                <div className="w-2.5 h-2.5 bg-zinc-900 rounded-full ml-auto mr-4" />
                            </div>

                            {/* Mobile Email UI */}
                            <div className="flex-1 bg-[#F8FAFC] dark:bg-zinc-950 flex flex-col pt-8 overflow-hidden relative">
                                
                                {/* Status bar mockup */}
                                <div className="h-6 flex items-center justify-between px-6 text-xs font-semibold text-zinc-900 dark:text-zinc-100 z-10 shrink-0">
                                    <span>9:41</span>
                                    <div className="flex items-center gap-1">
                                        <span>5G</span>
                                        <div className="w-5 h-2.5 border border-current rounded-sm p-0.5 flex items-center"><div className="bg-current w-3 h-full rounded-2xs" /></div>
                                    </div>
                                </div>

                                {/* Inbox back button and details */}
                                <div className="h-12 flex items-center gap-3 border-b border-zinc-200/80 dark:border-zinc-800/80 px-4 shrink-0 bg-white dark:bg-zinc-900">
                                    <ArrowLeft className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    <div className="truncate">
                                        <span className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 block truncate leading-tight">Inbox</span>
                                        <span className="text-[8px] text-zinc-400 font-semibold uppercase tracking-wider block leading-none">SmartSapp Mailer</span>
                                    </div>
                                </div>

                                {/* Email Subject */}
                                <div className="p-4 bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
                                    <h4 className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight leading-normal">
                                        {template.subject ? resolveVariables(template.subject, MOCK_VARIABLES) : '(No Subject)'}
                                    </h4>
                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 flex items-center justify-center font-bold text-[8px]">
                                                SS
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-zinc-800 dark:text-zinc-200 leading-tight">SmartSapp Intelligence</p>
                                                <p className="text-[7px] text-zinc-400 font-medium leading-none">To: {MOCK_VARIABLES.recipient_name}</p>
                                            </div>
                                        </div>
                                        <span className="text-[7px] text-zinc-400 font-semibold">9:41 AM</span>
                                    </div>
                                </div>

                                {/* scaled iframe container */}
                                <div className="flex-1 bg-white dark:bg-zinc-900 relative">
                                    <iframe 
                                        srcDoc={resolvedContent} 
                                        className="w-full h-full border-none bg-card" 
                                        title="Email Mobile Phone Simulator" 
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </DialogContent>
        </Dialog>
    );
}

interface WhatsAppPreviewModalProps {
    template: WhatsAppDisplayTemplate | null;
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Read-only WhatsApp preview — Meta templates are immutable, so there is no Edit
 * action. Renders the body in a WhatsApp chat bubble with sample params resolved.
 */
export function WhatsAppPreviewModal({ template, isOpen, onClose }: WhatsAppPreviewModalProps) {
    const exampleParams = template?.raw.exampleParams ?? [];
    const previewBody = template ? renderPreview(template.body, exampleParams) : '';

    if (!template) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md w-[92vw] rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl bg-background">
                <DialogTitle className="sr-only">Previewing {template.name} (WhatsApp)</DialogTitle>
                <DialogDescription className="sr-only">Read-only WhatsApp template preview.</DialogDescription>

                <div className="h-16 shrink-0 border-b border-border/60 px-6 flex items-center justify-between bg-card/40 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl border font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-200/50 dark:border-emerald-950">
                            <MessageCircle className="h-4 w-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-foreground tracking-tight line-clamp-1">{template.name}</h3>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                {template.language} · {template.waCategory} · WhatsApp Preview
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 rounded-xl border hover:bg-muted transition-all duration-300 text-muted-foreground hover:text-foreground"
                        onClick={onClose}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="bg-[#e5ddd5] dark:bg-zinc-900 p-6 min-h-[280px] flex items-start justify-center">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white dark:bg-emerald-950/40 ring-1 ring-black/5 shadow p-3 text-sm">
                        <p className="whitespace-pre-wrap text-slate-900 dark:text-slate-100">{previewBody}</p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
