'use client';

import * as React from 'react';
import type { MessageTemplate, TemplateStatus, TemplateTarget, MessageStyle } from '@/lib/types';
import type { WhatsAppTemplateStatus } from '@/lib/whatsapp/whatsapp-types';
import { plainTextToHtml, renderBlocksToHtml } from '@/lib/messaging-utils';
import {
    isWhatsAppDisplay,
    type GalleryTemplate,
    type WhatsAppDisplayTemplate,
} from '../lib/unified-template';
import { channelMeta } from '../lib/channel-meta';
import {
    Search,
    FileType,
    Eye,
    Pencil,
    CopyPlus,
    Trash2,
    Zap,
    Share2,
    LayoutGrid,
    List,
    MessageCircle,
    Send,
    Plus,
    CheckCircle2,
    Clock,
    XCircle,
    Megaphone
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { SmartSappIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// WhatsApp (Meta) approval status badges — mirrors the former panel.
const WA_STATUS_META: Record<WhatsAppTemplateStatus, { label: string; cls: string; Icon: React.ElementType }> = {
    APPROVED: { label: 'Approved', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', Icon: CheckCircle2 },
    PENDING: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20', Icon: Clock },
    REJECTED: { label: 'Rejected', cls: 'bg-red-500/10 text-red-600 border-red-500/20', Icon: XCircle },
    PAUSED: { label: 'Paused', cls: 'bg-muted text-muted-foreground border-border', Icon: Clock },
    DISABLED: { label: 'Disabled', cls: 'bg-muted text-muted-foreground border-border', Icon: XCircle },
};

interface TemplateCardProps {
    template: MessageTemplate;
    styles: MessageStyle[];
    cloningId: string | null;
    onPreview: () => void;
    onEdit: () => void;
    onClone: () => void;
    onDelete: () => void;
    onUpdateStatus: (status: TemplateStatus) => void;
    onWhatsAppPushSkeleton?: (template: MessageTemplate) => void;
}

function TemplateCard({ template, styles, cloningId, onPreview, onEdit, onClone, onDelete, onUpdateStatus, onWhatsAppPushSkeleton }: TemplateCardProps) {
    const router = useRouter();
    const emailSrcDoc = React.useMemo(() => {
        if (template.channel !== 'email') return '';

        let activeStyle: MessageStyle | null = null;
        if (template.styleId !== 'none') {
            const styleIdToUse = template.styleId;
            if (!styleIdToUse || styleIdToUse === 'default') {
                activeStyle = styles.find(s => s.isDefault) || null;
            } else {
                activeStyle = styles.find(s => s.id === styleIdToUse) || null;
            }
        }

        let styleWrapper = '';
        if (activeStyle) {
            if (template.target === 'internal_team') {
                styleWrapper = activeStyle.htmlWrapperInternal || activeStyle.htmlWrapper || '';
            } else {
                styleWrapper = activeStyle.htmlWrapperExternal || activeStyle.htmlWrapper || '';
            }
        }

        const contentMode = template.contentMode;

        // Auto-detect variable tokens from the template content and inject default mocks
        const contentForScan = `${template.subject || ''} ${template.previewText || ''} ${template.body || ''} ${JSON.stringify(template.blocks || [])}`;
        const matches = contentForScan.match(/\{\{([^{}]+?)\}\}/g);
        const detectedVars = matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '').trim()))] : [];

        // Hardcode a basic subset of MOCK_VARIABLES just for thumbnail gallery rendering
        const mergedMocks: Record<string, string> = {
            recipient_name: 'Recipient Name',
            contact_name: 'Recipient Name',
            org_name: 'Your Organization',
            org_logo_url: 'https://firebasestorage.googleapis.com/v0/b/studio-9220106300-f74cb.firebasestorage.app/o/SmartSapp%20Logo%20short.png?alt=media&token=046f95a8-b331-4129-a4ef-43ae7837eadd',
            org_email: 'support@smartsapp.com',
            org_phone: '+1 (555) 019-2834',
            org_address: '123 Organization Way',
            current_year: new Date().getFullYear().toString(),
            unsubscribe_copy: 'You are receiving this email because you subscribed to our services. Click here to unsubscribe.',
            unsubscribe_link: '#'
        };

        detectedVars.forEach(v => {
            if (!(v in mergedMocks)) {
                mergedMocks[v] = `[${v.replace(/_/g, ' ')}]`;
            }
        });

        // Add helper functions needed for resolving variables/blocks
        const resolveVars = (str: string, vars: Record<string, any>) => {
            if (!str) return '';
            return str.replace(/\{\{([^{}]+?)\}\}/g, (match, key) => {
                const trimmedKey = key.trim();
                return vars[trimmedKey] !== undefined ? String(vars[trimmedKey]) : match;
            });
        };

        if (contentMode === 'rich_builder') {
            return renderBlocksToHtml(template.blocks || [], mergedMocks, {
                wrapper: styleWrapper || undefined,
                style: activeStyle || undefined
            });
        }

        let resolved = resolveVars(template.body || '', mergedMocks);
        if (styleWrapper && styleWrapper.includes('{{content}}')) {
            let contentHtml = resolved;
            if (contentMode === 'plain_text' || !contentMode) {
                const escaped = contentHtml
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                // Simple link parsing for gallery preview
                const withLinks = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #3b82f6; text-decoration: underline;">$1</a>');
                contentHtml = withLinks.replace(/\n/g, '<br>\n');
            }
            resolved = resolveVars(styleWrapper, mergedMocks).replace('{{content}}', contentHtml);
        } else if (contentMode === 'plain_text' || !contentMode) {
            resolved = plainTextToHtml(resolved);
        }
        return resolved;
    }, [template, styles]);

    return (
        <Card className={cn("group relative border-2 transition-all duration-500 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50 flex flex-col h-[420px]", cloningId === template.id ? "opacity-50 scale-[0.98] grayscale" : "")}>
            <div className="h-12 shrink-0 border-b flex items-center justify-between px-4 bg-background group-hover:bg-background transition-colors duration-500">
                <div className="flex items-center gap-1.5">
                    {(() => {
                        const meta = channelMeta(template.channel);
                        const Icon = meta.Icon;
                        return (
                            <div className={cn("p-1.5 rounded-lg border", meta.iconWrap)}>
                                <Icon className="h-3 w-3" />
                            </div>
                        );
                    })()}
                    <span className="text-[8px] font-semibold text-muted-foreground opacity-60">{template.channel} Template</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    {template.channel === 'whatsapp' && !template.whatsappTemplateName ? (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onWhatsAppPushSkeleton?.(template)}
                            className="rounded-xl font-bold h-8 text-[10px] text-primary border-primary/20 hover:bg-primary/5 mr-2"
                        >
                            Push to Meta
                        </Button>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="Use Template">
                                    <Send className="h-4 w-4 text-primary" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl w-44">
                                <DropdownMenuItem onClick={() => router.push(`/admin/messaging/composer?templateId=${template.id}`)} className="font-semibold gap-2 cursor-pointer text-xs">
                                    <Send className="h-3.5 w-3.5 text-blue-500" /> Send as Message
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => router.push(`/admin/messaging/campaigns?templateId=${template.id}`)} className="font-semibold gap-2 cursor-pointer text-xs">
                                    <Megaphone className="h-3.5 w-3.5 text-purple-500" /> Send as Campaign
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onPreview}><Eye className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg", cloningId === template.id ? "animate-spin" : "")} onClick={onClone} disabled={!!cloningId}><CopyPlus className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onDelete}><Trash2 className="h-4 w-4" /></Button>
                </div>
            </div>
            
            <div className="flex-1 overflow-hidden relative bg-card flex flex-col items-center justify-center p-1.5">
                {template.channel === 'email' ? (
                    <div className="w-full h-full relative overflow-hidden bg-muted/10 border rounded-xl shadow-inner flex items-start justify-center">
                        <ResponsiveIframePreview 
                            srcDoc={emailSrcDoc}
                            className="pointer-events-none border-none bg-card rounded-2xl shadow-2xl"
                            title="preview"
                        />
                    </div>
                ) : (
                    <div className="w-full h-full bg-card rounded-xl p-6 flex flex-col justify-center gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 border border-slate-100 dark:border-slate-800/80 shadow-inner">
                        <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-blue-600"><Zap size={120} /></div>
                        <div className="p-4 bg-card border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl backdrop-blur-sm">
                            <p className="text-[9px] font-bold text-slate-900 dark:text-slate-100 leading-relaxed line-clamp-[8] italic whitespace-pre-wrap">&ldquo;{template.body}&rdquo;</p>
                        </div>
                        <div className="flex items-center justify-between opacity-20 border-t border-slate-200 dark:border-slate-800/80 pt-3">
                            <SmartSappIcon className="h-3.5 w-3.5" variant="primary" />
                            <span className="text-[7px] font-semibold text-slate-900 dark:text-slate-100">Handset Simulator</span>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-transparent z-10" />
            </div>

            <CardHeader className="p-5 shrink-0 bg-background border-t">
                <div className="min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="text-sm font-semibold truncate text-foreground group-hover:text-blue-600 transition-colors leading-tight tracking-tight cursor-default max-w-[190px]">{template.name}</div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[10px] font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md max-w-xs break-words">
                                    {template.name}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        {template.workspaceIds && template.workspaceIds.length > 1 ? (
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="p-1 rounded-md bg-blue-50 text-blue-600 border border-blue-100 shrink-0 cursor-help">
                                            <Share2 className="h-3 w-3" />
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-[8px] font-bold p-2">
                                        Shared with {template.workspaceIds.length} hubs
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        ) : null}
                    </div>
                    <p className="text-[8px] font-bold text-muted-foreground opacity-60">{template.category?.replace('_', ' ')}</p>
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                        <Select 
                            value={template.status || 'draft'} 
                            onValueChange={(v: any) => onUpdateStatus(v)}
                        >
                            <SelectTrigger className={cn(
                                "h-5 rounded-full px-2 py-0 border-none shadow-none focus:ring-0 focus:ring-offset-0 text-[7px] w-20 font-bold",
                                template.status === 'active' ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : 
                                template.status === 'archived' ? "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20" : 
                                "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                            )}>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl min-w-[100px]">
                                <SelectItem value="active" className="text-[10px] font-semibold">Active</SelectItem>
                                <SelectItem value="draft" className="text-[10px] font-semibold">Draft</SelectItem>
                                <SelectItem value="archived" className="text-[10px] font-semibold">Archived</SelectItem>
                            </SelectContent>
                        </Select>
                        <Badge variant="outline" className="rounded-full h-4 px-1.5 text-[7px] font-bold">{template.contentMode === 'html_code' ? 'HTML' : template.contentMode === 'rich_builder' ? 'Builder' : 'Text'}</Badge>
                        <Badge variant="outline" className="rounded-full h-4 px-1.5 text-[7px] font-bold">{template.target === 'internal_team' ? 'Team' : 'Client'}</Badge>
                        {template.channel === 'whatsapp' && !template.whatsappTemplateName && (
                            <Badge variant="outline" className="rounded-full h-4 px-1.5 text-[7px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">Skeleton (Draft)</Badge>
                        )}
                    </div>
                </div>
            </CardHeader>
        </Card>
    );
}

interface TemplateRowProps {
    template: MessageTemplate;
    cloningId: string | null;
    onPreview: () => void;
    onEdit: () => void;
    onClone: () => void;
    onDelete: () => void;
    onUpdateStatus: (status: TemplateStatus) => void;
    onWhatsAppPushSkeleton?: (template: MessageTemplate) => void;
}

function TemplateRow({ template, cloningId, onPreview, onEdit, onClone, onDelete, onUpdateStatus, onWhatsAppPushSkeleton }: TemplateRowProps) {
    const router = useRouter();
    const previewTitle = React.useMemo(() => {
        if (template.channel === 'email') {
            return template.subject || template.previewText || 'No Subject';
        }
        return template.body;
    }, [template.channel, template.subject, template.previewText, template.body]);

    return (
        <div className={cn(
            "flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 hover:shadow-md transition-all duration-300 gap-4 border-border/50",
            cloningId === template.id ? "opacity-50 scale-[0.98] grayscale" : ""
        )}>
            {/* Title and Subtitle Info */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="font-semibold text-sm text-foreground truncate cursor-default max-w-[250px]">{template.name}</span>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md max-w-xs break-words">
                                {template.name}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {template.workspaceIds && template.workspaceIds.length > 1 && (
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="p-0.5 rounded bg-blue-50 text-blue-600 border border-blue-100 shrink-0 cursor-help">
                                        <Share2 className="h-2.5 w-2.5" />
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent className="text-[8px] font-bold p-2">
                                    Shared with {template.workspaceIds.length} hubs
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
                <div className="text-xs text-muted-foreground truncate opacity-80 max-w-xl">
                    {template.channel === 'email' ? (
                        <span className="italic">Subject: {previewTitle}</span>
                    ) : (
                        <span className="italic">Body: &ldquo;{previewTitle}&rdquo;</span>
                    )}
                </div>
            </div>

            {/* Badges / Metadata info */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
                {/* Channel */}
                {(() => {
                    const meta = channelMeta(template.channel);
                    const Icon = meta.Icon;
                    return (
                        <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[8px] font-bold gap-1", meta.chip)}>
                            <Icon className="h-2.5 w-2.5" />
                            <span className="capitalize">{template.channel}</span>
                        </Badge>
                    );
                })()}

                {/* Category */}
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-muted/10 capitalize">
                    {template.category?.replace('_', ' ')}
                </Badge>

                {/* Target */}
                <Badge variant="outline" className={cn(
                    "rounded-full px-2 py-0.5 text-[8px] font-bold",
                    template.target === 'internal_team' ? "bg-indigo-500/5 text-indigo-500 border-indigo-200" : "bg-teal-500/5 text-teal-500 border-teal-200"
                )}>
                    {template.target === 'internal_team' ? 'Staff' : 'Client'}
                </Badge>

                {/* Status */}
                <Select 
                    value={template.status || 'draft'} 
                    onValueChange={(v: any) => onUpdateStatus(v)}
                >
                    <SelectTrigger className={cn(
                        "h-6 rounded-full px-2 py-0.5 text-[8px] font-bold border-none shadow-none focus:ring-0 focus:ring-offset-0 w-24 shrink-0",
                        template.status === 'active' ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20" : 
                        template.status === 'archived' ? "bg-slate-500/10 text-slate-600 hover:bg-slate-500/20" : 
                        "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20"
                    )}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl min-w-[100px]">
                        <SelectItem value="active" className="text-[10px] font-semibold">Active</SelectItem>
                        <SelectItem value="draft" className="text-[10px] font-semibold">Draft</SelectItem>
                        <SelectItem value="archived" className="text-[10px] font-semibold">Archived</SelectItem>
                    </SelectContent>
                </Select>

                {/* Mode Type */}
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold">
                    {template.contentMode === 'html_code' ? 'HTML' : template.contentMode === 'rich_builder' ? 'Builder' : 'Text'}
                </Badge>
                {template.channel === 'whatsapp' && !template.whatsappTemplateName && (
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">Skeleton (Draft)</Badge>
                )}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-1.5 shrink-0 border-t pt-3 md:border-none md:pt-0">
                {template.channel === 'whatsapp' && !template.whatsappTemplateName ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onWhatsAppPushSkeleton?.(template)}
                        className="rounded-xl font-bold h-8 text-[10px] text-primary border-primary/20 hover:bg-primary/5 mr-2"
                    >
                        Push to Meta
                    </Button>
                ) : (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" title="Use Template">
                                <Send className="h-4 w-4 text-primary" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                            <DropdownMenuItem onClick={() => router.push(`/admin/messaging/composer?templateId=${template.id}`)} className="font-semibold gap-2 cursor-pointer text-xs">
                                <Send className="h-3.5 w-3.5 text-blue-500" /> Send as Message
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => router.push(`/admin/messaging/campaigns?templateId=${template.id}`)} className="font-semibold gap-2 cursor-pointer text-xs">
                                <Megaphone className="h-3.5 w-3.5 text-purple-500" /> Send as Campaign
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onPreview} title="Preview">
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onEdit} title="Edit">
                    <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className={cn("h-8 w-8 rounded-lg hover:bg-muted", cloningId === template.id ? "animate-spin" : "")} onClick={onClone} disabled={!!cloningId} title="Clone">
                    <CopyPlus className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={onDelete} title="Delete">
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

interface WhatsAppCardProps {
    template: WhatsAppDisplayTemplate;
    onPreview: () => void;
    onSendTest: () => void;
    onAdopt: () => void;
}

/** Read-only WhatsApp card (Meta templates are immutable) with channel-specific actions. */
function WhatsAppTemplateCard({ template, onPreview, onSendTest, onAdopt }: WhatsAppCardProps) {
    const status = WA_STATUS_META[template.waStatus];
    const StatusIcon = status.Icon;
    const isApproved = template.waStatus === 'APPROVED';
    return (
        <Card className="group relative border-2 transition-all duration-500 rounded-2xl overflow-hidden bg-card shadow-sm hover:shadow-2xl border-border/50 flex flex-col h-[420px]">
            <div className="h-12 shrink-0 border-b flex items-center justify-between px-4 bg-background">
                <div className="flex items-center gap-1.5">
                    <div className="p-1.5 rounded-lg border bg-emerald-500/10 text-emerald-600 border-emerald-100">
                        <MessageCircle className="h-3 w-3" />
                    </div>
                    <span className="text-[8px] font-semibold text-muted-foreground opacity-60">WhatsApp Template</span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-all" onClick={onPreview} title="Preview">
                    <Eye className="h-4 w-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-hidden relative bg-card flex flex-col items-center justify-center p-1.5">
                <div className="w-full h-full bg-card rounded-xl p-6 flex flex-col justify-center gap-4 relative overflow-hidden group-hover:scale-[1.02] transition-transform duration-500 border border-emerald-100 dark:border-emerald-900/40 shadow-inner">
                    <div className="absolute -right-4 -top-4 opacity-5 rotate-12 text-emerald-600"><MessageCircle size={120} /></div>
                    <div className="p-4 bg-emerald-500/5 border border-emerald-200/60 dark:border-emerald-900/40 rounded-2xl rounded-tl-sm shadow-xl">
                        <p className="text-[9px] font-bold text-slate-900 dark:text-slate-100 leading-relaxed line-clamp-[8] whitespace-pre-wrap">{template.body}</p>
                    </div>
                    <div className="flex items-center justify-between opacity-30 border-t border-emerald-200/60 dark:border-emerald-900/40 pt-3">
                        <span className="text-[7px] font-semibold text-slate-900 dark:text-slate-100 uppercase">{template.language} · {template.waCategory} · {template.paramCount} param(s)</span>
                    </div>
                </div>
            </div>

            <CardHeader className="p-5 shrink-0 bg-background border-t">
                <div className="min-w-0 space-y-1.5">
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="text-sm font-semibold truncate text-foreground leading-tight tracking-tight cursor-default max-w-[190px]">{template.name}</div>
                            </TooltipTrigger>
                            <TooltipContent className="text-[10px] font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md max-w-xs break-words">
                                {template.name}
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                    {template.waStatus === 'REJECTED' && template.rejectedReason ? (
                        <p className="text-[8px] font-semibold text-red-600 line-clamp-1">Reason: {template.rejectedReason}</p>
                    ) : null}
                    <div className="flex items-center gap-1 flex-wrap">
                        <Badge variant="outline" className={cn("rounded-full h-5 px-2 text-[8px] font-bold gap-1", status.cls)}>
                            <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                        </Badge>
                        {isApproved && template.hasRuntimeNeeds ? (
                            <Badge variant="outline" className="rounded-full h-5 px-2 text-[8px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                                Test-send only
                            </Badge>
                        ) : null}
                    </div>
                    {isApproved ? (
                        <div className="flex items-center gap-1 pt-0.5 flex-wrap">
                            {!template.hasRuntimeNeeds ? (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={onAdopt}
                                    disabled={template.isAdopted}
                                    className="rounded-lg font-bold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/5 h-7 text-[10px] disabled:opacity-60"
                                >
                                    {template.isAdopted ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Enabled</> : <><Plus className="h-3 w-3 mr-1" /> Enable for campaigns</>}
                                </Button>
                            ) : null}
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={onSendTest}
                                className="rounded-lg font-bold text-muted-foreground hover:text-foreground hover:bg-muted/40 h-7 text-[10px]"
                            >
                                <Send className="h-3 w-3 mr-1" /> Send test
                            </Button>
                        </div>
                    ) : null}
                </div>
            </CardHeader>
        </Card>
    );
}

/** Read-only WhatsApp list row. */
function WhatsAppTemplateRow({ template, onPreview, onSendTest, onAdopt }: WhatsAppCardProps) {
    const status = WA_STATUS_META[template.waStatus];
    const StatusIcon = status.Icon;
    const isApproved = template.waStatus === 'APPROVED';
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border rounded-xl bg-card hover:bg-muted/10 hover:shadow-md transition-all duration-300 gap-4 border-border/50">
            <div className="flex-1 min-w-0 space-y-1">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="font-semibold text-sm text-foreground truncate cursor-default max-w-[250px]">{template.name}</span>
                        </TooltipTrigger>
                        <TooltipContent className="text-[10px] font-bold p-2 bg-popover text-popover-foreground border border-border shadow-md max-w-xs break-words">
                            {template.name}
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
                <div className="text-xs text-muted-foreground truncate opacity-80 max-w-xl">
                    <span className="italic">Body: &ldquo;{template.body}&rdquo;</span>
                </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold gap-1 bg-emerald-500/5 text-emerald-600 border-emerald-200">
                    <MessageCircle className="h-2.5 w-2.5" /> <span>WhatsApp</span>
                </Badge>
                <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-muted/10 uppercase">{template.waCategory}</Badge>
                <Badge variant="outline" className={cn("rounded-full px-2 py-0.5 text-[8px] font-bold gap-1", status.cls)}>
                    <StatusIcon className="h-2.5 w-2.5" /> {status.label}
                </Badge>
                {isApproved && template.hasRuntimeNeeds ? (
                    <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[8px] font-bold bg-amber-500/10 text-amber-600 border-amber-500/20">Test-send only</Badge>
                ) : null}
            </div>
            <div className="flex items-center justify-end gap-1.5 shrink-0 border-t pt-3 md:border-none md:pt-0">
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onPreview} title="Preview">
                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                </Button>
                {isApproved && !template.hasRuntimeNeeds ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted disabled:opacity-60" onClick={onAdopt} disabled={template.isAdopted} title={template.isAdopted ? 'Enabled for campaigns' : 'Enable for campaigns'}>
                        {template.isAdopted ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Plus className="h-4 w-4 text-emerald-600" />}
                    </Button>
                ) : null}
                {isApproved ? (
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onSendTest} title="Send test">
                        <Send className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

interface TemplateGalleryProps {
    templates: GalleryTemplate[];
    styles?: MessageStyle[];
    isLoading: boolean;
    cloningId: string | null;
    onEdit: (tmpl: MessageTemplate) => void;
    onClone: (tmpl: MessageTemplate) => void;
    onDelete: (tmpl: MessageTemplate) => void;
    onPreview: (tmpl: GalleryTemplate) => void;
    onUpdateStatus: (tmpl: MessageTemplate, status: TemplateStatus) => void;
    onWhatsAppSendTest?: (tmpl: WhatsAppDisplayTemplate) => void;
    onWhatsAppAdopt?: (tmpl: WhatsAppDisplayTemplate) => void;
    onWhatsAppPushSkeleton?: (template: MessageTemplate) => void;
}

export function TemplateGallery({
    templates,
    styles = [],
    isLoading,
    cloningId,
    onEdit,
    onClone,
    onDelete,
    onPreview,
    onUpdateStatus,
    onWhatsAppSendTest,
    onWhatsAppAdopt,
    onWhatsAppPushSkeleton
}: TemplateGalleryProps) {
    // 1. Initial State Definition with Requested Default Configurations
    const [searchTerm, setSearchTerm] = React.useState('');
    const [channelFilter, setChannelFilter] = React.useState('all');
    const [categoryFilter, setCategoryFilter] = React.useState('all'); // defaulted to show all types
    const [statusFilter, setStatusFilter] = React.useState<TemplateStatus | 'all'>('all'); // defaulted to show all status
    const [targetFilter, setTargetFilter] = React.useState<TemplateTarget | 'all'>('all'); // defaulted to show all targets
    const [groupBy, setGroupBy] = React.useState<'none' | 'channel' | 'category'>('category'); // defaulted to group by category
    const [viewMode, setViewMode] = React.useState<'grid' | 'list'>('grid');

    // 2. Load User Caching Filters from LocalStorage on mount safely
    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedSearch = localStorage.getItem('smartsapp_template_searchTerm');
            const storedChannel = localStorage.getItem('smartsapp_template_channelFilter');
            const storedCategory = localStorage.getItem('smartsapp_template_categoryFilter');
            const storedStatus = localStorage.getItem('smartsapp_template_statusFilter');
            const storedTarget = localStorage.getItem('smartsapp_template_targetFilter');
            const storedGroupBy = localStorage.getItem('smartsapp_template_groupBy');
            const storedViewMode = localStorage.getItem('smartsapp_template_viewMode');

            if (storedSearch !== null) setSearchTerm(storedSearch);
            if (storedChannel !== null) setChannelFilter(storedChannel);
            if (storedCategory !== null) setCategoryFilter(storedCategory);
            if (storedStatus !== null) setStatusFilter(storedStatus as any);
            if (storedTarget !== null) setTargetFilter(storedTarget as any);
            if (storedGroupBy !== null) setGroupBy(storedGroupBy as any);
            if (storedViewMode !== null) setViewMode(storedViewMode as any);
        }
    }, []);

    // 3. Save User Selection to LocalStorage when changed
    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_searchTerm', searchTerm);
    }, [searchTerm]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_channelFilter', channelFilter);
    }, [channelFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_categoryFilter', categoryFilter);
    }, [categoryFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_statusFilter', statusFilter);
    }, [statusFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_targetFilter', targetFilter);
    }, [targetFilter]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_groupBy', groupBy);
    }, [groupBy]);

    React.useEffect(() => {
        localStorage.setItem('smartsapp_template_viewMode', viewMode);
    }, [viewMode]);

    const filteredTemplates = React.useMemo(() => {
        const term = searchTerm.toLowerCase();
        return templates.filter(t =>
            (channelFilter === 'all' || t.channel === channelFilter) &&
            (categoryFilter === 'all' || t.category === categoryFilter) &&
            (statusFilter === 'all' || t.status === statusFilter) &&
            (targetFilter === 'all' || t.target === targetFilter) &&
            ((t.name || '').toLowerCase().includes(term) || (t.body || '').toLowerCase().includes(term))
        );
    }, [templates, searchTerm, channelFilter, categoryFilter, statusFilter, targetFilter]);

    const groupedTemplates = React.useMemo(() => {
        if (groupBy === 'none') return { 'All Templates': filteredTemplates };

        return filteredTemplates.reduce((acc, template) => {
            const key = groupBy === 'channel'
                ? channelMeta(template.channel).group
                : (template.category ? (template.category.charAt(0).toUpperCase() + template.category.slice(1).replace('_', ' ') + ' Templates') : 'General Templates');

            if (!acc[key]) acc[key] = [];
            acc[key].push(template);
            return acc;
        }, {} as Record<string, GalleryTemplate[]>);
    }, [filteredTemplates, groupBy]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 text-left">
            <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search templates..." 
                        className="pl-9 rounded-xl border-border bg-background h-10 w-full" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                </div>
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <Select value={channelFilter} onValueChange={setChannelFilter}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Channel" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Channels</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="sms">SMS</SelectItem>
                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Category" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Types</SelectItem>
                            {['general', 'surveys', 'meetings', 'forms', 'agreements', 'campaigns', 'reminders', 'tasks', 'automations', 'qr_codes', 'users'].map(c => <SelectItem key={c} value={c} className="capitalize">{c.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={targetFilter} onValueChange={(v: any) => setTargetFilter(v)}>
                        <SelectTrigger className="w-full sm:w-40 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Target" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="all">All Targets</SelectItem>
                            <SelectItem value="external_client">External Client</SelectItem>
                            <SelectItem value="internal_team">Team / Staff</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                        <SelectTrigger className="w-full sm:w-36 rounded-xl border-border bg-background h-10">
                            <SelectValue placeholder="Group By" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="none">Flat List</SelectItem>
                            <SelectItem value="channel">By Channel</SelectItem>
                            <SelectItem value="category">By Category</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Grid / List View Mode Toggle Button */}
                    <div className="flex items-center border rounded-xl p-0.5 bg-muted/20 shrink-0 h-10">
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className={cn(
                                "h-8 w-8 rounded-lg transition-all",
                                viewMode === 'grid' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setViewMode('grid')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            type="button"
                            className={cn(
                                "h-8 w-8 rounded-lg transition-all",
                                viewMode === 'list' ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className={cn(
                    viewMode === 'grid' 
                        ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" 
                        : "flex flex-col gap-3"
                )}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton 
                            key={i} 
                            className={cn(
                                viewMode === 'grid' ? "h-[420px]" : "h-20", 
                                "rounded-2xl shadow-sm"
                            )} 
                        />
                    ))}
                </div>
            ) : (
                <div className="space-y-16 pb-32">
                    {Object.entries(groupedTemplates).map(([groupName, groupItems]) => (
                        <section key={groupName} className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {groupBy !== 'none' ? (
                                <div className="flex items-center gap-4">
                                    <h2 className="text-xl font-semibold tracking-tight text-foreground/80">{groupName}</h2>
                                    <Badge variant="secondary" className="rounded-full h-6 px-3 font-semibold tabular-nums">{groupItems.length}</Badge>
                                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                                </div>
                            ) : null}

                            {viewMode === 'grid' ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                                    {groupItems.map(template => (
                                        isWhatsAppDisplay(template) ? (
                                            <WhatsAppTemplateCard
                                                key={template.id}
                                                template={template}
                                                onPreview={() => onPreview(template)}
                                                onSendTest={() => onWhatsAppSendTest?.(template)}
                                                onAdopt={() => onWhatsAppAdopt?.(template)}
                                            />
                                        ) : (
                                            <TemplateCard
                                                key={template.id}
                                                template={template}
                                                styles={styles}
                                                cloningId={cloningId}
                                                onPreview={() => onPreview(template)}
                                                onEdit={() => onEdit(template)}
                                                onClone={() => onClone(template)}
                                                onDelete={() => onDelete(template)}
                                                onUpdateStatus={(status) => onUpdateStatus(template, status)}
                                                onWhatsAppPushSkeleton={onWhatsAppPushSkeleton}
                                            />
                                        )
                                    ))}
                                </div>
                            ) : (
                                <div className="flex flex-col gap-3">
                                    {groupItems.map(template => (
                                        isWhatsAppDisplay(template) ? (
                                            <WhatsAppTemplateRow
                                                key={template.id}
                                                template={template}
                                                onPreview={() => onPreview(template)}
                                                onSendTest={() => onWhatsAppSendTest?.(template)}
                                                onAdopt={() => onWhatsAppAdopt?.(template)}
                                            />
                                        ) : (
                                            <TemplateRow
                                                key={template.id}
                                                template={template}
                                                cloningId={cloningId}
                                                onPreview={() => onPreview(template)}
                                                onEdit={() => onEdit(template)}
                                                onClone={() => onClone(template)}
                                                onDelete={() => onDelete(template)}
                                                onUpdateStatus={(status) => onUpdateStatus(template, status)}
                                                onWhatsAppPushSkeleton={onWhatsAppPushSkeleton}
                                            />
                                        )
                                    ))}
                                </div>
                            )}
                        </section>
                    ))}
                    
                    {filteredTemplates.length === 0 ? (
                        <div className="col-span-full py-32 text-center border-4 border-dashed rounded-[4rem] bg-background flex flex-col items-center justify-center gap-4 opacity-30">
                            <FileType className="h-16 w-16 text-muted-foreground" />
                            <p className="font-semibold text-sm">No templates found.</p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}

interface ResponsiveIframePreviewProps {
    srcDoc: string;
    className?: string;
    title?: string;
}

function ResponsiveIframePreview({ 
    srcDoc, 
    className, 
    title = "Preview" 
}: ResponsiveIframePreviewProps) {
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [scale, setScale] = React.useState(0.25);
    const [dimensions, setDimensions] = React.useState({ width: 800, height: 600 });
    const [isMeasured, setIsMeasured] = React.useState(false);

    React.useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        
        const observer = new ResizeObserver((entries) => {
            if (!entries || entries.length === 0) return;
            const entry = entries[0];
            const { width, height } = entry.contentRect;
            if (width <= 0 || height <= 0) return;
            
            const virtualWidth = 800;
            const newScale = width / virtualWidth;
            setScale(newScale);
            setDimensions({ width: virtualWidth, height: height / newScale });
            setIsMeasured(true);
        });
        
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    return (
        <div ref={containerRef} className="w-full h-full overflow-hidden relative bg-slate-50 flex items-center justify-center">
            <iframe 
                srcDoc={srcDoc}
                style={{
                    width: `${dimensions.width}px`,
                    height: `${dimensions.height}px`,
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                }}
                className={cn(
                    "pointer-events-none border-none transition-opacity duration-300",
                    isMeasured ? "opacity-100" : "opacity-0",
                    className
                )}
                title={title}
                loading="lazy"
            />
        </div>
    );
}

