'use client';

import * as React from 'react';
import { getCampaignStats, getCampaignRecipientBreakdown, getFailedRecipients, getCampaignEngagementTimeline } from '@/lib/campaign-analytics';
import { resendToFailed } from '@/lib/campaign-dispatch';
import { cloneCampaign } from '@/lib/campaign-hooks';
import { useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import type { MessageCampaign } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { selectCampaignWinnerManual, cancelCampaignABTest, resumeCampaignABTest } from '@/lib/campaign-automation-jobs';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
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
import { PageContainer } from '@/components/ui/page-container';

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
    const [freshCampaign, setFreshCampaign] = React.useState<MessageCampaign>(campaign);
    const [recipients, setRecipients] = React.useState<any[]>([]);
    const [timeline, setTimeline] = React.useState<any[]>([]);
    const [isLoading, setIsLoading] = React.useState(true);
    const [isResending, setIsResending] = React.useState(false);
    const [isEvaluating, setIsEvaluating] = React.useState(false);

    const loadData = React.useCallback(async () => {
        setIsLoading(true);
        
        let freshCamp = campaign;
        if (firestore) {
            try {
                const { doc, getDoc } = await import('firebase/firestore');
                const campDoc = await getDoc(doc(firestore, 'message_campaigns', campaign.id));
                if (campDoc.exists()) {
                    freshCamp = { id: campDoc.id, ...campDoc.data() } as MessageCampaign;
                    setFreshCampaign(freshCamp);
                }
            } catch (err) {
                console.error('[loadData] Failed to fetch campaign:', err);
            }
        }

        const [statsResult, recipientResult, timelineResult] = await Promise.all([
            getCampaignStats(campaign.id),
            getCampaignRecipientBreakdown(campaign.id),
            getCampaignEngagementTimeline(campaign.id)
        ]);
        if (statsResult.success) setStats(statsResult.stats);
        if (recipientResult.success) setRecipients(recipientResult.recipients || []);
        if (timelineResult.success) setTimeline(timelineResult.timeline || []);
        setIsLoading(false);
    }, [campaign.id, firestore]);

    React.useEffect(() => { loadData(); }, [loadData]);

    const [pauseDialogOpen, setPauseDialogOpen] = React.useState(false);
    const [isPausing, setIsPausing] = React.useState(false);
    const [isResuming, setIsResuming] = React.useState(false);

    const handlePauseTest = async () => {
        setIsPausing(true);
        try {
            await cancelCampaignABTest(campaign.id);
            toast({ title: 'Test Paused', description: 'The A/B test has been paused. Remainder dispatch is suspended.' });
            await loadData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Pause Failed', description: err.message });
        } finally {
            setIsPausing(false);
            setPauseDialogOpen(false);
        }
    };

    const handleResumeTest = async () => {
        setIsResuming(true);
        try {
            await resumeCampaignABTest(campaign.id);
            toast({ title: 'Test Resumed', description: 'The A/B test has been resumed. A new evaluation job has been scheduled.' });
            await loadData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Resume Failed', description: err.message });
        } finally {
            setIsResuming(false);
        }
    };

    const handleManualEvaluate = async (winnerId: 'A' | 'B') => {
        setIsEvaluating(true);
        try {
            await selectCampaignWinnerManual(campaign.id, winnerId);
            toast({ title: 'Winner Declared', description: `Variant ${winnerId} was declared the winner early.` });
            await loadData();
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Evaluation Failed', description: err.message });
        } finally {
            setIsEvaluating(false);
        }
    };

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
        <PageContainer maxWidth="5xl" className="pb-20">
            <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full hover:bg-accent">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">{campaign.internalName}</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-blue-500/10 text-blue-500 border-blue-500/20">
                                {campaign.channel} Campaign
                            </Badge>
                            <span className="text-[10px] font-bold text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" /> Created {new Date(campaign.createdAt).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={loadData} 
                        className={cn(
                            "rounded-xl font-bold text-xs h-9 gap-1.5 shadow-sm transition-all duration-300",
                            freshCampaign.status === 'testing' 
                                ? "border-violet-500/20 bg-violet-500/10 text-violet-500 backdrop-blur-sm hover:bg-violet-500/25 shadow-violet-500/10" 
                                : "border-border hover:bg-accent"
                        )}
                    >
                        <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} /> Refresh
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleClone} className="rounded-xl font-bold text-xs h-9 gap-1.5 border-border hover:bg-accent shadow-sm">
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                    </Button>
                </div>
            </div>

            {/* A/B Testing Banner for Testing phase */}
            {(freshCampaign.abTestEnabled && freshCampaign.status === 'testing') ? (
                <div className="p-6 rounded-3xl bg-violet-600 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl shadow-violet-200">
                    <div className="flex items-center gap-3">
                        <Clock className="h-6 w-6 text-violet-200 animate-pulse" />
                        <div>
                            <h3 className="text-base font-bold">A/B Testing in Progress</h3>
                            <p className="text-xs text-violet-100 mt-0.5">
                                Evaluating Variant A vs Variant B. The test runs for {freshCampaign.abTestConfig?.testDurationHours} hours before automatic winner selection.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                        <Button
                            onClick={() => handleManualEvaluate('A')}
                            disabled={isEvaluating}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all"
                        >
                            {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Force Variant A Winner
                        </Button>
                        <Button
                            onClick={() => handleManualEvaluate('B')}
                            disabled={isEvaluating}
                            className="bg-white hover:bg-slate-50 text-violet-700 border-none rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all shadow-md"
                        >
                            {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Force Variant B Winner
                        </Button>
                        <AlertDialog open={pauseDialogOpen} onOpenChange={setPauseDialogOpen}>
                            <Button
                                onClick={() => setPauseDialogOpen(true)}
                                disabled={isPausing}
                                className="bg-destructive/20 hover:bg-destructive/30 text-white border border-destructive/30 rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all"
                            >
                                {isPausing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                                Cancel Remainder
                            </Button>
                            <AlertDialogContent className="rounded-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-bold text-base">Cancel Remainder / Pause A/B Test?</AlertDialogTitle>
                                    <AlertDialogDescription className="text-xs font-semibold text-muted-foreground mt-2">
                                        Are you sure you want to pause/cancel this A/B test? This will cancel the scheduled automatic winner evaluation job and prevent the remainder dispatch from sending until you resume it.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-4">
                                    <AlertDialogCancel className="rounded-xl font-bold text-xs">Keep Testing</AlertDialogCancel>
                                    <AlertDialogAction 
                                        onClick={handlePauseTest}
                                        className="bg-destructive hover:bg-destructive/90 text-white rounded-xl font-bold text-xs"
                                    >
                                        Yes, Cancel Remainder
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            ) : null}

            {/* A/B Testing Banner for Paused phase */}
            {(freshCampaign.abTestEnabled && freshCampaign.status === 'paused') ? (
                <div className="p-6 rounded-3xl bg-amber-500 text-white flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl shadow-amber-200 animate-in fade-in">
                    <div className="flex items-center gap-3">
                        <Clock className="h-6 w-6 text-amber-200" />
                        <div>
                            <h3 className="text-base font-bold">A/B Testing Paused</h3>
                            <p className="text-xs text-amber-100 mt-0.5">
                                The automated evaluation and remainder dispatch are suspended. You can resume the test or declare a winner immediately.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap md:flex-nowrap">
                        <Button
                            onClick={() => handleManualEvaluate('A')}
                            disabled={isEvaluating}
                            className="bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all"
                        >
                            {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Force Variant A Winner
                        </Button>
                        <Button
                            onClick={() => handleManualEvaluate('B')}
                            disabled={isEvaluating}
                            className="bg-white hover:bg-slate-50 text-amber-700 border-none rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all shadow-md"
                        >
                            {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Force Variant B Winner
                        </Button>
                        <Button
                            onClick={handleResumeTest}
                            disabled={isResuming}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all shadow-md"
                        >
                            {isResuming ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                            Resume Test
                        </Button>
                    </div>
                </div>
            ) : null}

            {/* A/B Testing Banner for Winner Selected phase */}
            {(freshCampaign.abTestEnabled && freshCampaign.abTestConfig?.winningVariantId) ? (
                <div className="p-6 rounded-3xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30 text-emerald-800 dark:text-emerald-400 flex items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <Zap className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                        <div>
                            <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">Winner Selected: Variant {freshCampaign.abTestConfig.winningVariantId}</h3>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300/80 mt-0.5">
                                Variant {freshCampaign.abTestConfig.winningVariantId} performed best based on {freshCampaign.abTestConfig.winnerMetric?.replace('_', ' ')}. Remaining audience received the winning template.
                            </p>
                        </div>
                    </div>
                    <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400 border-none px-3 py-1 font-bold text-xs">
                        Completed
                    </Badge>
                </div>
            ) : null}

            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map(kpi => (
                    <Card key={kpi.label} className="h-20 rounded-2xl border-none ring-1 ring-border/50 shadow-sm bg-card/60 backdrop-blur-md hover:ring-primary/20 hover:shadow-md transition-all duration-200 flex items-center justify-between p-4 relative overflow-hidden group">
                        <div className="flex items-center gap-3">
                            <div className={cn("p-2.5 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 shrink-0", kpi.bg)}>
                                <kpi.icon className={cn("h-5 w-5", kpi.color)} />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground">{kpi.label}</p>
                                <p className="text-2xl font-extrabold text-foreground tracking-tight mt-0.5">{kpi.value.toLocaleString()}</p>
                            </div>
                        </div>
                        {kpi.rate != null ? (
                            <Badge variant="secondary" className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-2 py-0.5 rounded-lg shrink-0">
                                {kpi.rate}% Rate
                            </Badge>
                        ) : null}
                    </Card>
                ))}
            </div>

            {/* A/B Testing Variant Details side-by-side */}
            {freshCampaign.abTestEnabled ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-500">
                    {['A', 'B'].map((varId) => {
                        const variant = freshCampaign.variants?.find(v => v.id === varId);
                        const varStats = variant?.stats || { totalTargeted: 0, totalSent: 0, totalFailed: 0, totalOpened: 0, totalClicked: 0, totalUnsubscribed: 0 };
                        
                        const openRate = varStats.totalSent > 0 ? (varStats.totalOpened / varStats.totalSent) * 100 : 0;
                        const clickRate = varStats.totalSent > 0 ? (varStats.totalClicked / varStats.totalSent) * 100 : 0;
                        const unsubscribeRate = varStats.totalSent > 0 ? ((varStats.totalUnsubscribed || 0) / varStats.totalSent) * 100 : 0;
                        
                        const isWinner = freshCampaign.abTestConfig?.winningVariantId === varId;
                        
                        return (
                            <Card 
                                key={varId} 
                                className={cn(
                                    "border-none shadow-sm overflow-hidden bg-card/60 backdrop-blur-md rounded-2xl relative",
                                    isWinner && "ring-2 ring-emerald-500 bg-emerald-500/[0.01]"
                                )}
                            >
                                {isWinner ? (
                                    <div className="absolute top-0 right-0 bg-emerald-500 text-white font-bold text-[9px] uppercase px-3 py-1 rounded-bl-xl shadow-sm tracking-wider flex items-center gap-1 z-10">
                                        <Zap className="h-3 w-3" /> Declared Winner
                                    </div>
                                ) : null}
                                <CardHeader className="p-4 pb-2 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                        <span className={cn(
                                            "w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px]",
                                            varId === 'A' ? "bg-blue-500/10 text-blue-500" : "bg-violet-500/10 text-violet-500"
                                        )}>
                                            {varId}
                                        </span>
                                        Variant {varId}
                                    </CardTitle>
                                    {variant?.templateName ? (
                                        <Badge variant="secondary" className="text-[8px] font-bold bg-violet-500/10 text-violet-500 border-violet-500/20 px-2 py-0.5 rounded-md text-right">
                                            {variant.templateName}
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-[8px] font-semibold text-muted-foreground px-2 py-0.5 rounded-md text-right">
                                            Custom overrides
                                        </Badge>
                                    )}
                                </CardHeader>
                                <CardContent className="p-6 space-y-6">
                                    {freshCampaign.channel === 'email' ? (
                                        <div className="space-y-1">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Subject Line</p>
                                            <p className="text-xs font-semibold text-muted-foreground truncate">{variant?.customSubject || '(No subject override)'}</p>
                                        </div>
                                    ) : null}

                                    <div className="grid grid-cols-3 gap-2 text-center">
                                        <div className="bg-muted/30 border border-border/50 p-2.5 rounded-xl">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Targeted</p>
                                            <p className="text-sm font-extrabold text-foreground mt-0.5">{varStats.totalTargeted}</p>
                                        </div>
                                        <div className="bg-muted/30 border border-border/50 p-2.5 rounded-xl">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Sent</p>
                                            <p className="text-sm font-extrabold text-foreground mt-0.5">{varStats.totalSent}</p>
                                        </div>
                                        <div className="bg-muted/30 border border-border/50 p-2.5 rounded-xl">
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Unsubscribes</p>
                                            <p className="text-sm font-extrabold text-foreground mt-0.5">{varStats.totalUnsubscribed || 0}</p>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-muted-foreground">Open Rate</span>
                                                <span className="font-extrabold text-foreground">{openRate.toFixed(1)}% <span className="text-[10px] text-muted-foreground font-semibold">({varStats.totalOpened})</span></span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-violet-500 rounded-full transition-all duration-500" 
                                                    style={{ width: `${Math.min(100, openRate)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-muted-foreground">Click Rate</span>
                                                <span className="font-extrabold text-foreground">{clickRate.toFixed(1)}% <span className="text-[10px] text-muted-foreground font-semibold">({varStats.totalClicked})</span></span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-amber-500 rounded-full transition-all duration-500" 
                                                    style={{ width: `${Math.min(100, clickRate)}%` }}
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-muted-foreground">Unsubscribe Rate</span>
                                                <span className="font-extrabold text-foreground">{unsubscribeRate.toFixed(1)}% <span className="text-[10px] text-muted-foreground font-semibold">({varStats.totalUnsubscribed || 0})</span></span>
                                            </div>
                                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full bg-rose-500 rounded-full transition-all duration-500" 
                                                    style={{ width: `${Math.min(100, unsubscribeRate)}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            ) : null}

            {/* Main Analytics Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Engagement Timeline */}
                <Card className="lg:col-span-2 border-none shadow-sm bg-card/60 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                            <TrendingUp className="h-4 w-4 text-indigo-500" /> Engagement Timeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
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
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
                                    <XAxis 
                                        dataKey="timestamp" 
                                        tickFormatter={formatTimestamp}
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{fontSize: 10, fontWeight: 600, fill: 'var(--muted-foreground)'}}
                                        minTickGap={30}
                                    />
                                    <YAxis 
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{fontSize: 10, fontWeight: 600, fill: 'var(--muted-foreground)'}}
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
                <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md rounded-2xl overflow-hidden">
                    <CardHeader className="p-4 border-b border-border/50 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                            <Users className="h-4 w-4 text-emerald-500" /> Cohort Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 flex flex-col items-center">
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
                                <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-muted/30 border border-border/50">
                                    <div className="flex items-center gap-3">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-xs font-bold text-muted-foreground">{item.name}</span>
                                    </div>
                                    <span className="text-xs font-extrabold text-foreground">{item.value.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Smart Recovery & Automation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Recovery Actions */}
                {(stats?.totalFailed || 0) > 0 ? (
                    <Card className="border-none shadow-sm bg-red-50/50 dark:bg-red-950/20 rounded-2xl overflow-hidden border border-red-100 dark:border-red-900/30">
                        <CardContent className="p-4 flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/10 text-red-500 rounded-xl">
                                    <RefreshCw className="h-5 w-5 animate-in spin-in duration-500" />
                                </div>
                                <h4 className="text-sm font-bold text-red-900 dark:text-red-200">{stats?.totalFailed || 0} Failed Deliveries</h4>
                            </div>
                            <Button
                                onClick={handleResend}
                                disabled={isResending}
                                className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs h-9 px-4 active:scale-95 transition-all shadow-md shrink-0"
                            >
                                {isResending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                                Resend to Failed Recipients
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}

                {/* Automation Summary */}
                {(campaign.automationHooks && campaign.automationHooks.length > 0) ? (
                    <Card className="border-none shadow-sm bg-amber-50/50 dark:bg-amber-950/20 rounded-2xl overflow-hidden border border-amber-100 dark:border-amber-900/30">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-950/50 flex items-center justify-center shrink-0">
                                    <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-amber-900 dark:text-amber-400">Automation Loops</h3>
                                </div>
                                <span className="text-[10px] text-amber-700/70 dark:text-amber-300/60 font-semibold">{campaign.automationHooks.length} active triggers</span>
                            </div>
                            <div className="mt-3 space-y-1.5">
                                {campaign.automationHooks.slice(0, 2).map((hook, i) => (
                                    <div key={i} className="flex items-center justify-between text-[9px] font-bold bg-white/60 dark:bg-background/40 p-2 rounded-lg">
                                        <span className="text-amber-800 dark:text-amber-300 truncate mr-2">{hook.automationName}</span>
                                        <Badge className="bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-none text-[8px] shrink-0">{hook.event.replace('campaign_', '')}</Badge>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ) : null}
            </div>

            {/* Recipient Table */}
            <Card className="border-none shadow-sm bg-card/60 backdrop-blur-md rounded-2xl overflow-hidden">
                <CardHeader className="p-4 border-b border-border/50">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                            <Users className="h-4 w-4 text-muted-foreground" /> Recipient Logs
                        </CardTitle>
                        <Badge variant="outline" className="rounded-lg font-bold text-muted-foreground border-border text-[10px] px-2 py-0.5">
                            Showing last {recipients.length}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                            <thead className="bg-muted/30 border-b border-border/40">
                                <tr>
                                    <th className="text-left p-4 font-bold text-muted-foreground uppercase tracking-wider">Recipient</th>
                                    <th className="text-left p-4 font-bold text-muted-foreground uppercase tracking-wider">Status</th>
                                    <th className="text-left p-4 font-bold text-muted-foreground uppercase tracking-wider">Activity</th>
                                    <th className="text-left p-4 font-bold text-muted-foreground uppercase tracking-wider">Outcome</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {recipients.map((r, i) => (
                                    <tr key={i} className="hover:bg-accent/40 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground group-hover:text-blue-500 transition-colors">{r.displayName}</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">{r.recipient}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <Badge className={cn("text-[10px] font-bold border-none px-2 py-0.5 rounded-md",
                                                r.status === 'opened' || r.status === 'clicked' ? 'bg-indigo-500/10 text-indigo-500' :
                                                r.status === 'sent' || r.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                                                r.status === 'failed' ? 'bg-red-500/10 text-red-500' :
                                                'bg-muted text-muted-foreground'
                                            )}>
                                                {r.status}
                                            </Badge>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-muted-foreground">{r.sentAt ? new Date(r.sentAt).toLocaleDateString() : '—'}</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">{r.sentAt ? new Date(r.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            {r.error ? (
                                                <span className="text-red-500 font-bold max-w-[200px] truncate block">{r.error}</span>
                                            ) : (
                                                <span className="text-muted-foreground font-medium italic">No issues reported</span>
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
        </PageContainer>
    );
}

