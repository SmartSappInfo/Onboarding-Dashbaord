'use client';

import * as React from 'react';
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

const STATUS_CONFIG: Record<CampaignStatus, { label: string; className: string }> = {
    draft: { label: 'Draft', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    scheduled: { label: 'Scheduled', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
    sending: { label: 'Sending', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse' },
    testing: { label: 'Testing', className: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
    paused: { label: 'Paused', className: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200' },
    sent: { label: 'Sent', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
    failed: { label: 'Failed', className: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
    archived: { label: 'Archived', className: 'bg-muted text-muted-foreground' },
    dispatching: { label: 'Dispatching', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 animate-pulse' },
};

interface CampaignListRowProps {
    campaign: MessageCampaign;
    onEdit?: (campaign: MessageCampaign) => void;
    onClone?: (campaign: MessageCampaign) => void;
    onArchive?: (campaign: MessageCampaign) => void;
    onDelete?: (campaign: MessageCampaign) => void;
    onViewStats?: (campaign: MessageCampaign) => void;
}

/**
 * High-density list row for campaigns.
 * Optimized for scannability and quick actions.
 */
export const CampaignListRow = React.memo(function CampaignListRow({
    campaign,
    onEdit,
    onClone,
    onArchive,
    onDelete,
    onViewStats,
}: CampaignListRowProps) {
    const status = STATUS_CONFIG[campaign.status] || STATUS_CONFIG.draft;
    const isDraft = campaign.status === 'draft';
    const isSent = campaign.status === 'sent' || campaign.status === 'testing';
    const isArchived = campaign.status === 'archived';

    const channelIcon = campaign.channel === 'sms'
        ? <Smartphone className="h-3.5 w-3.5" />
        : <Mail className="h-3.5 w-3.5" />;

    const timeLabel = campaign.sentAt
        ? `Sent ${formatDistanceToNow(new Date(campaign.sentAt), { addSuffix: true })}`
        : campaign.scheduledAt
            ? `Scheduled ${formatDistanceToNow(new Date(campaign.scheduledAt), { addSuffix: true })}`
            : `Edited ${formatDistanceToNow(new Date(campaign.updatedAt), { addSuffix: true })}`;

    return (
        <div className={cn(
            "group flex items-center gap-4 p-4 transition-all duration-200 border-b border-border/40 hover:bg-muted/30 last:border-0",
            isArchived && "opacity-60"
        )}>
            {/* Channel Icon */}
            <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border",
                campaign.channel === 'sms'
                    ? "bg-violet-500/10 text-violet-600 border-violet-200/20"
                    : "bg-blue-500/10 text-blue-600 border-blue-200/20"
            )}>
                {channelIcon}
            </div>

            {/* Campaign Identity */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                    <h4 className="text-sm font-bold truncate group-hover:text-primary transition-colors">
                        {campaign.internalName}
                    </h4>
                    <Badge className={cn("border-none text-[8px] font-black uppercase h-4 px-1.5", status.className)}>
                        {status.label}
                    </Badge>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                    <span className="flex items-center gap-1">
                        {campaign.target === 'internal_team' ? 'Team' : 'Client'}
                    </span>
                    <span className="opacity-20">•</span>
                    <span>{timeLabel}</span>
                    {campaign.templateName && (
                        <>
                            <span className="opacity-20">•</span>
                            <span className="text-primary/60 truncate max-w-[150px]">{campaign.templateName}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Stats (Inline) */}
            {isSent && campaign.stats && (
                <div className="hidden md:flex items-center gap-6 px-4">
                    <div className="text-center">
                        <p className="text-sm font-black tabular-nums">{campaign.stats.totalSent}</p>
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Sent</p>
                    </div>
                    <div className="text-center border-l border-border/50 pl-6">
                        <p className="text-sm font-black tabular-nums text-emerald-600">{campaign.stats.totalOpened}</p>
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Open</p>
                    </div>
                    <div className="text-center border-l border-border/50 pl-6">
                        <p className="text-sm font-black tabular-nums text-red-500">{campaign.stats.totalFailed}</p>
                        <p className="text-[8px] font-black text-muted-foreground uppercase">Fail</p>
                    </div>
                </div>
            )}

            {/* Audience summary for drafts */}
            {isDraft && (
                <div className="hidden lg:flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase bg-muted/40 px-3 py-1.5 rounded-xl border border-border/50">
                    <Users className="h-3 w-3" />
                    <span>
                        {campaign.estimatedRecipientCount != null
                            ? `${campaign.estimatedRecipientCount.toLocaleString()} Recipients`
                            : 'Unconfigured'}
                    </span>
                </div>
            )}

            {/* Actions Menu */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-primary/5 hover:text-primary transition-all shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-2xl w-48 p-2 shadow-2xl border-border/50 bg-card">
                    {isDraft && onEdit && (
                        <DropdownMenuItem onClick={() => onEdit(campaign)} className="gap-2.5 text-xs font-bold rounded-xl py-2.5">
                            <Pencil className="h-3.5 w-3.5 text-primary" /> Edit Draft
                        </DropdownMenuItem>
                    )}
                    {(isSent || campaign.status === 'failed') && onViewStats && (
                        <DropdownMenuItem onClick={() => onViewStats(campaign)} className="gap-2.5 text-xs font-bold rounded-xl py-2.5">
                            <BarChart3 className="h-3.5 w-3.5 text-primary" /> View Analytics
                        </DropdownMenuItem>
                    )}
                    {onClone && (
                        <DropdownMenuItem onClick={() => onClone(campaign)} className="gap-2.5 text-xs font-bold rounded-xl py-2.5">
                            <Copy className="h-3.5 w-3.5 text-violet-600" /> Clone Campaign
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="my-1.5 opacity-50" />
                    {!isArchived && onArchive && (
                        <DropdownMenuItem onClick={() => onArchive(campaign)} className="gap-2.5 text-xs font-bold rounded-xl py-2.5 text-amber-600 focus:bg-amber-50">
                            <Archive className="h-3.5 w-3.5" /> Archive
                        </DropdownMenuItem>
                    )}
                    {isDraft && onDelete && (
                        <DropdownMenuItem onClick={() => onDelete(campaign)} className="gap-2.5 text-xs font-bold rounded-xl py-2.5 text-red-600 focus:bg-red-50">
                            <Trash2 className="h-3.5 w-3.5" /> Delete Permanently
                        </DropdownMenuItem>
                    )}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
});
