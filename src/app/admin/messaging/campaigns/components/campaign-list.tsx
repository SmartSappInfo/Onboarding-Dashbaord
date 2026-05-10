'use client';

import * as React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Megaphone, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MessageCampaign, CampaignStatus } from '@/lib/types';
import { CampaignListRow } from './campaign-list-row';

interface CampaignListProps {
    campaigns: MessageCampaign[];
    isLoading: boolean;
    onEdit?: (campaign: MessageCampaign) => void;
    onClone?: (campaign: MessageCampaign) => void;
    onArchive?: (campaign: MessageCampaign) => void;
    onDelete?: (campaign: MessageCampaign) => void;
    onViewStats?: (campaign: MessageCampaign) => void;
    onViewAnalytics?: (campaign: MessageCampaign) => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'All Statuses' },
    { value: 'draft', label: 'Drafts' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'sending', label: 'Sending' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
    { value: 'archived', label: 'Archived' },
];

const CHANNEL_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'All Channels' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
];

const TARGET_OPTIONS: { value: string; label: string }[] = [
    { value: 'all', label: 'All Targets' },
    { value: 'external_client', label: 'Client' },
    { value: 'internal_team', label: 'Team' },
];

/**
 * Campaign list with multi-axis filtering.
 * Follows crm-builder list/detail pattern and template-gallery filter conventions.
 */
export function CampaignList({
    campaigns,
    isLoading,
    onEdit,
    onClone,
    onArchive,
    onDelete,
    onViewStats,
    onViewAnalytics,
}: CampaignListProps) {
    const [searchQuery, setSearchQuery] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [channelFilter, setChannelFilter] = React.useState('all');
    const [targetFilter, setTargetFilter] = React.useState('all');

    // js-combine-iterations: single pass filter (Vercel best practice)
    const filteredCampaigns = React.useMemo(() => {
        const query = searchQuery.toLowerCase();
        const result: MessageCampaign[] = [];
        for (const c of campaigns) {
            if (statusFilter !== 'all' && c.status !== statusFilter) continue;
            if (channelFilter !== 'all' && c.channel !== channelFilter) continue;
            if (targetFilter !== 'all' && c.target !== targetFilter) continue;
            if (query && !c.internalName.toLowerCase().includes(query)) continue;
            result.push(c);
        }
        return result;
    }, [campaigns, searchQuery, statusFilter, channelFilter, targetFilter]);

    // Status counts for filter badges
    const statusCounts = React.useMemo(() => {
        const counts: Record<string, number> = {};
        for (const c of campaigns) {
            counts[c.status] = (counts[c.status] || 0) + 1;
        }
        return counts;
    }, [campaigns]);

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                    <Skeleton className="h-10 w-48 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                    <Skeleton className="h-10 w-32 rounded-xl" />
                </div>
                <div className="space-y-3">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 rounded-2xl w-full" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filter bar */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search campaigns..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 rounded-xl border-border/50 bg-card font-semibold text-xs"
                    />
                </div>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px] h-10 rounded-xl font-bold text-xs border-border/50 bg-card">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {STATUS_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">
                                {opt.label}
                                {opt.value !== 'all' && statusCounts[opt.value] ? (
                                    <Badge variant="outline" className="ml-2 h-4 px-1.5 text-[8px] font-bold">
                                        {statusCounts[opt.value]}
                                    </Badge>
                                ) : null}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={channelFilter} onValueChange={setChannelFilter}>
                    <SelectTrigger className="w-[130px] h-10 rounded-xl font-bold text-xs border-border/50 bg-card">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {CHANNEL_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold capitalize">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={targetFilter} onValueChange={setTargetFilter}>
                    <SelectTrigger className="w-[130px] h-10 rounded-xl font-bold text-xs border-border/50 bg-card">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {TARGET_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value} className="text-xs font-semibold">
                                {opt.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* Active filter count */}
                {(statusFilter !== 'all' || channelFilter !== 'all' || targetFilter !== 'all' || searchQuery) && (
                    <Badge variant="outline" className="h-8 px-3 text-[10px] font-bold rounded-xl">
                        {filteredCampaigns.length} of {campaigns.length}
                    </Badge>
                )}
            </div>

            {/* Campaign list */}
            {filteredCampaigns.length > 0 ? (
                <div className="bg-card border border-border/50 rounded-3xl overflow-hidden shadow-sm mb-20">
                    <div className="divide-y divide-border/40">
                        {filteredCampaigns.map(campaign => (
                            <CampaignListRow
                                key={campaign.id}
                                campaign={campaign}
                                onEdit={onEdit}
                                onClone={onClone}
                                onArchive={onArchive}
                                onDelete={onDelete}
                                onViewStats={onViewAnalytics || onViewStats}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                /* crm-builder pattern: Empty state with action CTA */
                <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                        {campaigns.length === 0
                            ? <Megaphone className="h-8 w-8 text-primary/40" />
                            : <Inbox className="h-8 w-8 text-muted-foreground/40" />}
                    </div>
                    <p className="text-lg font-semibold text-foreground/80">
                        {campaigns.length === 0 ? 'No campaigns yet' : 'No campaigns match your filters'}
                    </p>
                    <p className="text-xs font-semibold text-muted-foreground mt-1 max-w-sm">
                        {campaigns.length === 0
                            ? 'Create your first campaign to start reaching your audience with targeted messages.'
                            : 'Try adjusting your filters or search query to find what you\'re looking for.'}
                    </p>
                </div>
            )}
        </div>
    );
}
