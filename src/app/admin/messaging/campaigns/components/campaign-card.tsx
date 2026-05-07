'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Mail, Smartphone, Users, MoreHorizontal, Copy, Archive,
    Trash2, Pencil, BarChart3, Calendar, Clock,
} from 'lucide-react';
import {
    DropdownMenu, DropdownMenuContent, DropdownMenuItem,
    DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { MessageCampaign, CampaignStatus } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';

// ─── Status Badge Config (crm-builder skill: color-coded badges) ──────────────

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    sending: { label: 'Sending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse' },
    sent: { label: 'Sent', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
};

interface CampaignCardProps {
    campaign: MessageCampaign;
    onEdit?: (campaign: MessageCampaign) => void;
    onClone?: (campaign: MessageCampaign) => void;
    onArchive?: (campaign: MessageCampaign) => void;
    onDelete?: (campaign: MessageCampaign) => void;
    onViewStats?: (campaign: MessageCampaign) => void;
}

/**
 * Campaign card for list view. Memoized per rerender-memo (Vercel best practice).
 * Follows crm-builder skill patterns for status color-coding and action menus.
 */
export const CampaignCard = React.memo(function CampaignCard({
    campaign,
    onEdit,
    onClone,
    onArchive,
    onDelete,
    onViewStats,
}: CampaignCardProps) {
    const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
    const isDraft = campaign.status === 'draft';
    const isSent = campaign.status === 'sent';
    const isArchived = campaign.status === 'archived';

    const channelIcon = campaign.channel === 'sms'
        ? <Smartphone className="h-3.5 w-3.5" />
        : <Mail className="h-3.5 w-3.5" />;

    const timeLabel = campaign.sentAt
        ? `Sent ${formatDistanceToNow(new Date(campaign.sentAt), { addSuffix: true })}`
        : campaign.scheduledAt
            ? `Scheduled ${formatDistanceToNow(new Date(campaign.scheduledAt), { addSuffix: true })}`
            : `Edited ${formatDistanceToNow(new Date(campaign.updatedAt), { addSuffix: true })}`;

    const timeIcon = campaign.sentAt
        ? <Clock className="h-3 w-3" />
        : campaign.scheduledAt
            ? <Calendar className="h-3 w-3" />
            : <Clock className="h-3 w-3" />;

    return (
        <Card className={cn(
            "group relative overflow-hidden border transition-all duration-300 rounded-2xl bg-card",
            "hover:shadow-xl hover:-translate-y-0.5 hover:border-primary/20",
            isArchived && "opacity-60"
        )}>
            <CardHeader className="p-5 pb-3 space-y-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className={cn(
                            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                            campaign.channel === 'sms'
                                ? "bg-violet-500/10 text-violet-600"
                                : "bg-blue-500/10 text-blue-600"
                        )}>
                            {channelIcon}
                        </div>
                        <div className="min-w-0">
                            <CardTitle className="text-sm font-semibold truncate pr-2 group-hover:text-primary transition-colors">
                                {campaign.internalName}
                            </CardTitle>
                            <CardDescription className="text-[9px] font-bold mt-0.5 flex items-center gap-1">
                                {timeIcon} {timeLabel}
                            </CardDescription>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl w-44">
                            {isDraft && onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(campaign)} className="gap-2 text-xs font-semibold">
                                    <Pencil className="h-3.5 w-3.5" /> Edit Draft
                                </DropdownMenuItem>
                            )}
                            {isSent && onViewStats && (
                                <DropdownMenuItem onClick={() => onViewStats(campaign)} className="gap-2 text-xs font-semibold">
                                    <BarChart3 className="h-3.5 w-3.5" /> View Stats
                                </DropdownMenuItem>
                            )}
                            {onClone && (
                                <DropdownMenuItem onClick={() => onClone(campaign)} className="gap-2 text-xs font-semibold">
                                    <Copy className="h-3.5 w-3.5" /> Clone Campaign
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {!isArchived && onArchive && (
                                <DropdownMenuItem onClick={() => onArchive(campaign)} className="gap-2 text-xs font-semibold text-amber-600">
                                    <Archive className="h-3.5 w-3.5" /> Archive
                                </DropdownMenuItem>
                            )}
                            {isDraft && onDelete && (
                                <DropdownMenuItem onClick={() => onDelete(campaign)} className="gap-2 text-xs font-semibold text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Status + Target badges */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Badge className={cn("border-none text-[9px] font-bold uppercase h-5 px-2", status.className)}>
                        {status.label}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 capitalize">
                        {campaign.channel}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-bold h-5 px-2">
                        {campaign.target === 'internal_team' ? 'Team' : 'Client'}
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="px-5 pb-5 pt-0">
                {/* Stats row — only for sent campaigns */}
                {isSent && campaign.stats && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <div className="text-center p-2 rounded-xl bg-muted/30">
                            <p className="text-lg font-bold tabular-nums">{campaign.stats.totalSent}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">Sent</p>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-muted/30">
                            <p className="text-lg font-bold tabular-nums text-emerald-600">{campaign.stats.totalOpened}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">Opened</p>
                        </div>
                        <div className="text-center p-2 rounded-xl bg-muted/30">
                            <p className="text-lg font-bold tabular-nums text-red-500">{campaign.stats.totalFailed}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">Failed</p>
                        </div>
                    </div>
                )}

                {/* Audience summary for drafts */}
                {isDraft && (
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-semibold text-muted-foreground">
                        <Users className="h-3.5 w-3.5" />
                        <span>
                            {campaign.estimatedRecipientCount != null
                                ? `~${campaign.estimatedRecipientCount.toLocaleString()} recipients`
                                : campaign.audienceDefinition?.mode === 'all'
                                    ? 'All workspace entities'
                                    : campaign.audienceDefinition?.mode === 'tags'
                                        ? `${campaign.audienceDefinition.tagIds?.length || 0} tag(s) selected`
                                        : campaign.audienceDefinition?.mode === 'manual'
                                            ? `${campaign.audienceDefinition.entityIds?.length || 0} selected`
                                            : 'No audience configured'}
                        </span>
                    </div>
                )}

                {/* Template reference */}
                {campaign.templateName && (
                    <p className="text-[9px] font-bold text-primary/60 mt-2 truncate">
                        Template: {campaign.templateName}
                    </p>
                )}
            </CardContent>

            {/* Bottom accent bar */}
            <div className={cn(
                "absolute bottom-0 left-0 h-0.5 w-full transition-colors",
                campaign.status === 'sent' ? "bg-emerald-500/30" :
                campaign.status === 'sending' ? "bg-amber-500/30" :
                campaign.status === 'failed' ? "bg-red-500/30" :
                "bg-transparent group-hover:bg-primary/20"
            )} />
        </Card>
    );
});
