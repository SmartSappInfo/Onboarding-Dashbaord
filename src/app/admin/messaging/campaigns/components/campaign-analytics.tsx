'use client';

import * as React from 'react';
import { getCampaignStats, getCampaignRecipientBreakdown, getFailedRecipients, getCampaignEngagementTimeline } from '@/lib/campaign-analytics';
import { resendToFailed } from '@/lib/campaign-dispatch';
import { cloneCampaign } from '@/lib/campaign-hooks';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { MessageCampaign } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';
import {
    ArrowLeft, Users, Send, XCircle, Eye, MousePointer,
    RefreshCw, Copy, BarChart3, Loader2, TrendingUp, Tag, Zap,
    Clock, Smartphone, Layout
} from 'lucide-react';
import { cn } from '@/lib/utils';

const CHART_COLORS = {
    sent: '#10b981',    // Emerald 500
    opened: '#8b5cf6',  // Violet 500
    clicked: '#f59e0b', // Amber 500
    failed: '#ef4444',  // Red 500
    targeted: '#3b82f6' // Blue 500
};

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
    const [timeline, setTimeline] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isResending, setIsResending] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        const [statsResult, recipientResult, timelineResult] = await Promise.all([
            getCampaignStats(campaign.id),
            getCampaignRecipientBreakdown(campaign.id),
            getCampaignEngagementTimeline(campaign.id)
        ]);
        if (statsResult.success) setStats(statsResult.stats);
        if (recipientResult.success) setRecipients(recipientResult.recipients || []);
        if (timelineResult.success) setTimeline(timelineResult.timeline || []);
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
            <div className="max-w-5xl mx-auto space-y-6">
                <Skeleton className="h-10 w-48 rounded-xl" />
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Skeleton className="h-80 md:col-span-2 rounded-2xl" />
                    <Skeleton className="h-80 rounded-2xl" />
                </div>
            </div>
        );
    }

    const kpis = [
        { label: 'Targeted', value: stats?.totalTargeted || 0, icon: Users, color: 'text-blue-600', bg: 'bg-blue-500/10' },
        { label: 'Delivered', value: stats?.totalSent || 0, icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-500/10', rate: stats?.deliveryRate },
        { label: 'Opened', value: stats?.totalOpened || 0, icon: Eye, color: 'text-violet-600', bg: 'bg-violet-500/10' },
        { label: 'Clicked', value: stats?.totalClicked || 0, icon: MousePointer, color: 'text-amber-600', bg: 'bg-amber-500/10' },
    ];

    const cohortData = [
        { name: 'Opened', value: stats?.totalOpened || 0, color: CHART_COLORS.opened },
        { name: 'Unopened', value: (stats?.totalSent || 0) - (stats?.totalOpened || 0), color: '#e2e8f0' },
        { name: 'Failed', value: stats?.totalFailed || 0, color: CHART_COLORS.failed },
    ].filter(d => d.value > 0);

    const formatTimestamp = (ts: string) => {
        const date = new Date(ts);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-20 px-4 md:px-0">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-slate-100">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{campaign.internalName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-50 text-blue-700 border-blue-100">
                                {campaign.channel} Campaign
                            </Badge>
                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Created {new Date(campaign.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={loadData} className="rounded-xl font-bold text-xs h-9 gap-1.5 border-slate-200 hover:bg-slate-50 shadow-sm">
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClone} className="rounded-xl font-bold text-xs h-9 gap-1.5 border-slate-200 hover:bg-slate-50 shadow-sm">
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                    <Card key={kpi.label} className="border-none shadow-sm bg-white overflow-hidden group hover:shadow-md transition-all duration-300">
                        <CardContent className="p-6">
                            <div className="flex items-start justify-between">
                                <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110", kpi.bg)}>
                                    <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                                </div>
                                {kpi.rate != null && (
                                    <div className="flex flex-col items-end">
                                        <Badge variant="secondary" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-100">
                                            {kpi.rate}% Rate
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <div className="mt-4">
                                <h4 className="text-3xl font-extrabold tabular-nums tracking-tight text-slate-900">{kpi.value.toLocaleString()}</h4>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{kpi.label}</p>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Analytics Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Engagement Timeline */}
                <Card className="lg:col-span-2 border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="p-8">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="text-lg font-bold flex items-center gap-2">
                                    <TrendingUp className="h-5 w-5 text-indigo-500" /> Engagement Timeline
                                </CardTitle>
                                <CardDescription className="text-xs mt-1">Real-time interaction trends over the last 24 hours</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-8">
                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={timeline}>
                                    <defs>
                                        <linearGradient id="colorSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.sent} stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor={CHART_COLORS.sent} stopOpacity={0}/>
                                        </linearGradient>
                                        <linearGradient id="colorOpened" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={CHART_COLORS.opened} stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor={CHART_COLORS.opened} stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis 
                                        dataKey="timestamp" 
                                        tickFormatter={formatTimestamp}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}}
                                        minTickGap={30}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{fontSize: 10, fontWeight: 600, fill: '#94a3b8'}}
                                    />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                                        labelFormatter={formatTimestamp}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="sent" 
                                        stroke={CHART_COLORS.sent} 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorSent)" 
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="opened" 
                                        stroke={CHART_COLORS.opened} 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorOpened)" 
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Cohort Breakdown */}
                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                    <CardHeader className="p-8">
                        <CardTitle className="text-lg font-bold flex items-center gap-2">
                            <Users className="h-5 w-5 text-emerald-500" /> Cohort Status
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">Recipient distribution by engagement</CardDescription>
                    </CardHeader>
                    <CardContent className="px-4 pb-8 flex flex-col items-center">
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={cohortData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {cohortData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="w-full space-y-3 mt-6">
                            {cohortData.map((item, i) => (
                                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs font-bold text-slate-700">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-extrabold text-slate-900">{item.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Smart Recovery & Automation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recovery Actions */}
                {(stats?.totalFailed || 0) > 0 && (
                    <Card className="border-none shadow-sm bg-red-50/50 rounded-3xl overflow-hidden border border-red-100">
                        <CardContent className="p-8 flex items-center justify-between">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
                                    <RefreshCw className="h-6 w-6 text-red-600" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-red-900">{stats.totalFailed} Failed Deliveries</h3>
                                    <p className="text-xs text-red-700/70 mt-1 font-medium">Automatic retry available for temporary provider errors.</p>
                                    <Button 
                                        onClick={handleResend} 
                                        disabled={isResending} 
                                        className="mt-4 rounded-xl font-bold text-xs h-10 gap-2 bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-200 active:scale-95 transition-all"
                                    >
                                        {isResending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                        Resend to Failed Recipients
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Automation Summary */}
                {campaign.automationHooks && campaign.automationHooks.length > 0 && (
                    <Card className="border-none shadow-sm bg-amber-50/50 rounded-3xl overflow-hidden border border-amber-100">
                        <CardContent className="p-8">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center">
                                    <Zap className="h-6 w-6 text-amber-600" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-lg font-bold text-amber-900">Automation Loops</h3>
                                    <p className="text-xs text-amber-700/70 mt-1 font-medium">{campaign.automationHooks.length} active triggers monitoring this campaign.</p>
                                    <div className="mt-4 space-y-2">
                                        {campaign.automationHooks.slice(0, 2).map((hook, i) => (
                                            <div key={i} className="flex items-center justify-between text-[10px] font-bold bg-white/60 p-2 rounded-lg">
                                                <span className="text-amber-800">{hook.automationName}</span>
                                                <Badge className="bg-amber-100 text-amber-700 border-none text-[8px]">{hook.event.replace('campaign_', '')}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Recipient Table */}
            <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                <CardHeader className="p-8 border-b border-slate-50">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-lg font-bold flex items-center gap-2">
                                <Users className="h-5 w-5 text-slate-500" /> Recipient Logs
                            </CardTitle>
                            <CardDescription className="text-xs mt-1">Detailed delivery and engagement history for individual contacts</CardDescription>
                        </div>
                        <Badge variant="outline" className="rounded-lg font-bold text-slate-500 border-slate-200">
                            Showing last {recipients.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50/50 border-b border-slate-100">
                                <tr>
                                    <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-wider">Recipient</th>
                                    <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-wider">Activity</th>
                                    <th className="text-left p-4 font-bold text-slate-500 uppercase tracking-wider">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {recipients.map((r, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{r.displayName}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{r.recipient}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge className={cn("text-[10px] font-bold border-none px-2 py-0.5 rounded-md",
                                                r.status === 'opened' || r.status === 'clicked' ? 'bg-indigo-100 text-indigo-700' :
                                                r.status === 'sent' || r.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                                                r.status === 'failed' ? 'bg-red-100 text-red-700' :
                                                'bg-slate-100 text-slate-600'
                                            )}>
                                                {r.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-700">{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}</span>
                                                <span className="text-[10px] text-slate-400 font-medium">{r.sentAt ? new Date(r.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {r.error ? (
                                                <span className="text-red-500 font-bold max-w-[200px] truncate block">{r.error}</span>
                                            ) : (
                                                <span className="text-slate-400 font-medium italic">No issues reported</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

