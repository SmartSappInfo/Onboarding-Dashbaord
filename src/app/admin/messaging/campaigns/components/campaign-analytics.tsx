'use client';

import * as React from 'react';
import { getCampaignStats, getCampaignRecipientBreakdown, getFailedRecipients } from '@/lib/campaign-analytics';
import { resendToFailed } from '@/lib/campaign-dispatch';
import { cloneCampaign } from '@/lib/campaign-hooks';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { MessageCampaign } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    ArrowLeft, Users, Send, XCircle, Eye, MousePointer,
    RefreshCw, Copy, BarChart3, Loader2, TrendingUp, Tag, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CampaignAnalyticsProps {
    campaign: MessageCampaign;
    onBack: () => void;
}

export function CampaignAnalytics({ campaign, onBack }: CampaignAnalyticsProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();

    const [stats, setStats] = React.useState<any>(null);
    const [recipients, setRecipients] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isResending, setIsResending] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        const [statsResult, recipientResult] = await Promise.all([
            getCampaignStats(campaign.id),
            getCampaignRecipientBreakdown(campaign.id),
        ]);
        if (statsResult.success) setStats(statsResult.stats);
        if (recipientResult.success) setRecipients(recipientResult.recipients || []);
        setIsLoading(false);
    }, [campaign.id]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const handleResend = async () => {
        setIsResending(true);
        try {
            const result = await resendToFailed(campaign.id);
            if (result.success) {
                toast({ title: 'Resend Started', description: `Job ${result.jobId} created for failed recipients.` });
                await loadData();
            } else {
                toast({ variant: 'destructive', title: 'Resend Failed', description: result.error });
            }
        } finally {
            setIsResending(false);
        }
    };

    const handleClone = async () => {
        if (!firestore || !user) return;
        try {
            await cloneCampaign(firestore, campaign, user.uid);
            toast({ title: 'Campaign Cloned' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Clone Failed', description: e.message });
        }
    };

    if (isLoading) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <Skeleton className="h-64 rounded-2xl" />
            </div>
        );
    }

    const kpis = [
        { label: 'Targeted', value: stats?.totalTargeted || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10' },
        { label: 'Delivered', value: stats?.totalSent || 0, icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-500/10', rate: stats?.deliveryRate },
        { label: 'Opened', value: stats?.totalOpened || 0, icon: Eye, color: 'text-violet-600', bg: 'bg-violet-500/10' },
        { label: 'Failed', value: stats?.totalFailed || 0, icon: XCircle, color: 'text-red-600', bg: 'bg-red-500/10', rate: stats?.failureRate },
    ];

    const failedCount = stats?.totalFailed || 0;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-xs font-bold rounded-xl">
                        <ArrowLeft className="h-4 w-4" /> Back
                    </Button>
                    <div>
                        <h2 className="text-lg font-semibold">{campaign.internalName}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1.5">
                            <BarChart3 className="h-3 w-3" /> Campaign Analytics
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl font-bold text-xs gap-1.5">
                        <RefreshCw className="h-3 w-3" /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClone} className="rounded-xl font-bold text-xs gap-1.5">
                        <Copy className="h-3 w-3" /> Clone
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                    <Card key={kpi.label} className="rounded-2xl border-border/50 overflow-hidden">
                        <CardContent className="p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", kpi.bg)}>
                                    <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                                </div>
                                {kpi.rate != null && (
                                    <Badge variant="outline" className="text-[8px] font-bold h-5 px-1.5 rounded-lg">
                                        {kpi.rate}%
                                    </Badge>
                                )}
                            </div>
                            <p className="text-2xl font-bold tabular-nums">{kpi.value.toLocaleString()}</p>
                            <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">{kpi.label}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Delivery Funnel */}
            {stats && stats.totalTargeted > 0 && (
                <Card className="rounded-2xl border-border/50">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Delivery Funnel
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 space-y-3">
                        {[
                            { label: 'Targeted', value: stats.totalTargeted, color: 'bg-blue-500' },
                            { label: 'Delivered', value: stats.totalSent, color: 'bg-emerald-500' },
                            { label: 'Opened', value: stats.totalOpened, color: 'bg-violet-500' },
                            { label: 'Clicked', value: stats.totalClicked, color: 'bg-amber-500' },
                        ].map(bar => (
                            <div key={bar.label} className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold">{bar.label}</span>
                                    <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                                        {bar.value.toLocaleString()} ({stats.totalTargeted > 0 ? Math.round((bar.value / stats.totalTargeted) * 100) : 0}%)
                                    </span>
                                </div>
                                <div className="h-2.5 rounded-full bg-muted/30 overflow-hidden">
                                    <div
                                        className={cn("h-full rounded-full transition-all duration-700", bar.color)}
                                        style={{ width: `${stats.totalTargeted > 0 ? Math.round((bar.value / stats.totalTargeted) * 100) : 0}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Recovery Actions */}
            {failedCount > 0 && (
                <Card className="rounded-2xl border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-900/10">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                                {failedCount} recipient{failedCount !== 1 ? 's' : ''} failed
                            </p>
                            <p className="text-[9px] font-bold text-red-600/70 dark:text-red-400/70 mt-0.5">
                                Retry sending to failed recipients
                            </p>
                        </div>
                        <Button onClick={handleResend} disabled={isResending} size="sm" className="rounded-xl font-bold text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white">
                            {isResending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                            Resend to Failed
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Post-Send Tag Rules (Phase 6 Story 4) */}
            {campaign.postSendTagRules && campaign.postSendTagRules.length > 0 && (
                <Card className="rounded-2xl border-border/50">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Tag className="h-4 w-4 text-violet-500" /> Post-Send Tag Rules ({campaign.postSendTagRules.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 space-y-2">
                        {campaign.postSendTagRules.map((rule, i) => (
                            <div key={`${rule.tagId}-${i}`} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/5">
                                <Tag className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold">{rule.tagName}</p>
                                    <p className="text-[8px] font-semibold text-muted-foreground">
                                        Cohort: <span className="text-primary">{rule.appliesTo.replace('_', ' ')}</span>
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[8px] font-bold h-5 px-1.5 rounded-lg bg-emerald-50 text-emerald-700 border-emerald-200">
                                    {campaign.status === 'sent' ? 'Applied' : 'Pending'}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Automation Hooks (Phase 6 Story 4) */}
            {campaign.automationHooks && campaign.automationHooks.length > 0 && (
                <Card className="rounded-2xl border-border/50">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                            <Zap className="h-4 w-4 text-amber-500" /> Automation Hooks ({campaign.automationHooks.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-5 pb-5 space-y-2">
                        {campaign.automationHooks.map((hook, i) => (
                            <div key={`${hook.automationId}-${i}`} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/5">
                                <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-bold">{hook.automationName}</p>
                                    <p className="text-[8px] font-semibold text-muted-foreground">
                                        Trigger: <span className="text-primary">{hook.event.replace('campaign_', '').replace('_', ' ')}</span>
                                        {hook.delayMinutes ? ` (after ${hook.delayMinutes}min)` : ''}
                                    </p>
                                </div>
                                <Badge variant="outline" className="text-[8px] font-bold h-5 px-1.5 rounded-lg bg-amber-50 text-amber-700 border-amber-200">
                                    {campaign.status === 'sent' ? 'Triggered' : 'Queued'}
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Recipient Table */}
            {recipients.length > 0 && (
                <Card className="rounded-2xl border-border/50 overflow-hidden">
                    <CardHeader className="p-5 pb-3">
                        <CardTitle className="text-sm font-semibold">Recipients ({recipients.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-muted/20 border-b">
                                    <tr>
                                        <th className="text-left p-3 font-bold text-muted-foreground text-[10px]">Recipient</th>
                                        <th className="text-left p-3 font-bold text-muted-foreground text-[10px]">Status</th>
                                        <th className="text-left p-3 font-bold text-muted-foreground text-[10px]">Sent</th>
                                        <th className="text-left p-3 font-bold text-muted-foreground text-[10px]">Error</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recipients.map((r, i) => (
                                        <tr key={i} className="border-b last:border-none hover:bg-muted/10 transition-colors">
                                            <td className="p-3 font-semibold">{r.displayName}</td>
                                            <td className="p-3">
                                                <Badge className={cn("text-[8px] font-bold border-none",
                                                    r.status === 'sent' ? 'bg-emerald-100 text-emerald-700' :
                                                    r.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                    'bg-slate-100 text-slate-600'
                                                )}>
                                                    {r.status}
                                                </Badge>
                                            </td>
                                            <td className="p-3 text-muted-foreground">{r.sentAt ? new Date(r.sentAt).toLocaleString() : '—'}</td>
                                            <td className="p-3 text-red-500 truncate max-w-[200px]">{r.error || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
