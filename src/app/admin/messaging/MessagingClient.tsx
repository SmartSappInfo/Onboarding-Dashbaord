'use client';

import * as React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    Fingerprint, 
    Palette, 
    FileType, 
    Send, 
    ArrowRight,
    Mail,
    Smartphone,
    History,
    Activity,
    RefreshCw,
    Wallet,
    CalendarClock,
    BarChart3,
    TrendingUp,
    CheckCircle2,
    XCircle,
    Info,
    Layers,
    Target,
    ShieldCheck,
    Zap,
    Database
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';
import { fetchSmsBalanceAction, fetchSmsReportsAction } from '@/lib/mnotify-actions';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Cell } from 'recharts';
import { subDays, format, isValid } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import MessageJobsView from './jobs/page';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { MessageLog } from '@/lib/types';

const chartConfig = {
  sent: {
    label: "Sent",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export default function MessagingClient() {
    const firestore = useFirestore();
    const [balance, setBalance] = React.useState<number | null>(null);
    const [isLoadingBalance, setIsLoadingBalance] = React.useState(false);
    const [reportData, setReportData] = React.useState<any[]>([]);
    const [isLoadingReport, setIsLoadingReport] = React.useState(false);
    const { singular } = useTerminology();

    // Fetch logs for analytics
    const logsCol = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_logs'));
    }, [firestore]);
    const { data: logs } = useCollection<MessageLog>(logsCol);

    const emailStats = React.useMemo(() => {
        if (!logs) return { total: 0, sent: 0, failed: 0, scheduled: 0 };
        const emails = logs.filter(l => l.channel === 'email');
        return {
            total: emails.length,
            sent: emails.filter(e => e.status === 'sent').length,
            failed: emails.filter(e => e.status === 'failed').length,
            scheduled: emails.filter(e => e.status === 'scheduled').length
        };
    }, [logs]);

    const loadBalance = React.useCallback(async () => {
        setIsLoadingBalance(true);
        const result = await fetchSmsBalanceAction();
        if (result.success) {
            setBalance(result.balance ?? 0);
        }
        setIsLoadingBalance(false);
    }, []);

    const loadReports = React.useCallback(async () => {
        setIsLoadingReport(true);
        const to = format(new Date(), 'yyyy-MM-dd');
        const from = format(subDays(new Date(), 30), 'yyyy-MM-dd');
        const result = await fetchSmsReportsAction(from, to);
        if (result.success && result.report) {
            setReportData(result.report.slice(0, 7).reverse());
        }
        setIsLoadingReport(false);
    }, []);

    React.useEffect(() => {
        loadBalance();
        loadReports();
    }, [loadBalance, loadReports]);

    const operations = [
        {
            title: 'Message Composer',
            description: 'Manually send one-off or bulk messages using your saved templates.',
            icon: Send,
            href: '/admin/messaging/composer',
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            border: 'hover:border-emerald-500/50'
        },
        {
            title: 'Scheduled Queue',
            description: 'Review and manage communications queued for future delivery.',
            icon: CalendarClock,
            href: '/admin/messaging/scheduled',
            color: 'text-blue-600',
            bg: 'bg-blue-600/10',
            border: 'hover:border-blue-600/50'
        },
        {
            title: 'Message Logs',
            description: 'Audit trail of all sent communications, status tracking, and error reports.',
            icon: History,
            href: '/admin/messaging/logs',
            color: 'text-slate-500',
            bg: 'bg-muted/100/10',
            border: 'hover:border-slate-500/50'
        }
    ];

    const infrastructure = [
        {
            title: 'Fields & Variables',
            description: `Manage ${singular}, Meeting, and Survey fields globally.`,
            icon: Database,
            href: '/admin/settings/fields',
            color: 'text-primary',
            bg: 'bg-primary/10',
            border: 'hover:border-primary/50'
        },
        {
            title: 'Message Templates',
            description: 'Define reusable message content with dynamic placeholders for automation.',
            icon: FileType,
            href: '/admin/messaging/templates',
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            border: 'hover:border-orange-500/50'
        },
        {
            title: 'Visual Styles',
            description: 'Design HTML wrappers and branded layouts for your email communications.',
            icon: Palette,
            href: '/admin/messaging/styles',
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            border: 'hover:border-purple-500/50'
        },
        {
            title: 'Sender Profiles',
            description: 'Manage authorized SMS Sender IDs and verified Email identities.',
            icon: Fingerprint,
            href: '/admin/messaging/profiles',
            color: 'text-blue-600',
            bg: 'bg-blue-600/10',
            border: 'hover:border-blue-600/50'
        }
    ];

    const ModuleCard = ({ mod }: { mod: any }) => (
 <Link href={mod.href} className="group block h-full outline-none">
 <Card className={cn(
                "h-full transition-all duration-300 border-border/50 group-hover:shadow-xl group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-primary relative overflow-hidden rounded-[1.5rem]",
                mod.border
            )}>
 <CardHeader className="p-6 space-y-4">
 <div className="flex items-center gap-4">
 <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 shrink-0 shadow-sm border", mod.bg)}>
 <mod.icon className={cn("h-6 w-6", mod.color)} />
                        </div>
 <CardTitle className="text-xl font-semibold tracking-tight flex items-center justify-between flex-1 ">
                            {mod.title}
 <ArrowRight className="h-5 w-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 text-primary" />
                        </CardTitle>
                    </div>
 <CardDescription className="text-xs leading-relaxed font-bold text-muted-foreground opacity-70">
                        {mod.description}
                    </CardDescription>
                </CardHeader>
 <div className={cn("absolute bottom-0 left-0 h-1 bg-transparent group-hover:bg-primary/20 w-full transition-colors")} />
            </Card>
        </Link>
    );

    const deliveryEfficiency = React.useMemo(() => {
        if (!logs || logs.length === 0) return 0;
        const total = emailStats.total + reportData.reduce((a,c) => a + (c.sent || 0), 0);
        if (total === 0) return 0;
        const success = emailStats.sent + reportData.reduce((a,c) => a + (c.delivered || 0), 0);
        return Math.round((success / total) * 100);
    }, [logs, emailStats, reportData]);

    return (
 <div className="h-full overflow-y-auto  bg-background">
 <div className=" space-y-12">
 <Tabs defaultValue="overview" className="space-y-12">
 <TabsList className="bg-card/50 backdrop-blur-md border shadow-sm h-12 p-1 rounded-xl">
 <TabsTrigger value="overview" className="rounded-lg font-semibold text-[10px] px-6">Hub Overview</TabsTrigger>
 <TabsTrigger value="jobs" className="rounded-lg font-semibold text-[10px] px-6 gap-2">
 <Layers className="h-4 w-4" /> Bulk Jobs
                        </TabsTrigger>
 <TabsTrigger value="analytics" className="rounded-lg font-semibold text-[10px] px-6 gap-2">
 <BarChart3 className="h-4 w-4" /> Performance
                        </TabsTrigger>
                    </TabsList>

 <TabsContent value="overview" className="space-y-16 animate-in fade-in slide-in-from-bottom-2">
                        {/* Operational Intelligence Row */}
 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
 <Card className="rounded-3xl glass-card overflow-hidden">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="p-4 bg-primary/10 rounded-2xl text-primary shrink-0 shadow-inner border border-primary/20">
 <Target className="h-7 w-7" />
                                    </div>
                                    <div>
 <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1.5">Delivery Efficiency</p>
 <div className="flex items-baseline gap-2">
 <p className="text-4xl font-semibold tabular-nums tracking-tighter">{deliveryEfficiency}%</p>
                                            <Badge variant="outline" className="text-[8px] font-semibold uppercase bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Optimal</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

 <Card className="rounded-3xl glass-card overflow-hidden">
 <CardContent className="p-6 flex items-center gap-5">
 <div className={cn(
                                        "p-4 rounded-2xl shrink-0 shadow-inner border",
                                        balance !== null && balance < 50 ? "bg-red-500/10 text-red-500 border-red-500/20" : "bg-orange-500/10 text-orange-500 border-orange-500/20"
                                    )}>
 <Wallet className="h-7 w-7" />
                                    </div>
 <div className="flex-1 min-w-0">
 <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1.5">SMS Unit Balance</p>
 <div className="flex items-center justify-between">
 <p className={cn(
                                                "text-4xl font-semibold tabular-nums tracking-tighter",
                                                balance !== null && balance < 50 && "text-red-500"
                                            )}>
                                                {isLoadingBalance ? '...' : balance !== null ? balance.toLocaleString() : 'N/A'}
                                            </p>
 <button onClick={loadBalance} disabled={isLoadingBalance} className="text-muted-foreground hover:text-primary transition-colors disabled:opacity-50">
 <RefreshCw className={cn("h-4 w-4", isLoadingBalance && "animate-spin")} />
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                                {balance !== null && balance < 50 && (
 <div className="bg-red-500 text-white text-[8px] font-semibold py-1 text-center animate-pulse">Low Units Warning</div>
 ) || <div className="h-1 bg-transparent" />}
                            </Card>

 <Card className="rounded-3xl glass-card overflow-hidden">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="p-4 bg-emerald-500/10 rounded-2xl text-emerald-500 shrink-0 shadow-inner border border-emerald-500/20">
 <ShieldCheck className="h-7 w-7" />
                                    </div>
                                    <div>
 <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1.5">Gateway Trust</p>
 <div className="flex items-baseline gap-2">
 <p className="text-4xl font-semibold tabular-nums tracking-tighter">100%</p>
 <span className="text-[10px] font-bold text-emerald-500 tracking-tighter">Verified</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <section>
 <div className="flex items-center gap-3 mb-8">
                                <Badge variant="outline" className="bg-background font-semibold text-[10px] uppercase  px-3 py-1 border-primary/20 text-primary">Messaging Tasks</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-primary/20 to-transparent" />
                            </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {operations.map((mod) => (
                                    <ModuleCard key={mod.title} mod={mod} />
                                ))}
                            </div>
                        </section>

                        <section>
 <div className="flex items-center gap-3 mb-8">
                                <Badge variant="outline" className="bg-background font-semibold text-[10px] uppercase  px-3 py-1 border-border text-muted-foreground">Messaging Setup</Badge>
 <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                            </div>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {infrastructure.map((mod) => (
                                    <ModuleCard key={mod.title} mod={mod} />
                                ))}
                            </div>
                        </section>

 <section className="pt-8">
 <Card className="bg-primary/5 border-primary/20 shadow-none rounded-[2.5rem] overflow-hidden">
 <CardHeader className="p-8 pb-4">
 <CardTitle className="text-[10px] font-semibold text-primary flex items-center gap-2">
 <Activity className="h-4 w-4" /> Provider Connectivity Audit
                                    </CardTitle>
                                </CardHeader>
 <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-8 pt-0">
 <div className="flex items-center gap-5 p-6 rounded-3xl bg-background border border-border/50 shadow-sm transition-all hover:shadow-md">
 <div className="p-4 bg-blue-500/10 rounded-2xl text-blue-500 shrink-0 shadow-sm border border-blue-100">
 <Mail className="h-6 w-6" />
                                        </div>
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm text-foreground tracking-tight">Email Port (Resend)</p>
 <p className="text-[9px] text-muted-foreground font-semibold tracking-tight mt-1 opacity-60">Status: High Throughput Enabled</p>
                                        </div>
 <div className="flex items-center gap-2 shrink-0">
 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <Badge className="bg-emerald-500 text-white border-none text-[8px] font-semibold uppercase  px-2.5 h-5">Live</Badge>
                                        </div>
                                    </div>
                                    
 <div className="flex items-center gap-5 p-6 rounded-3xl bg-background border border-border/50 shadow-sm transition-all hover:shadow-md">
 <div className="p-4 bg-orange-500/10 rounded-2xl text-orange-500 shrink-0 shadow-sm border border-orange-100">
 <Smartphone className="h-6 w-6" />
                                        </div>
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm text-foreground tracking-tight">SMS Uplink (mNotify)</p>
 <p className="text-[9px] text-muted-foreground font-semibold tracking-tight mt-1 opacity-60">Status: Gateway Authorized</p>
                                        </div>
 <div className="flex items-center gap-2 shrink-0">
 <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                            <Badge className="bg-emerald-500 text-white border-none text-[8px] font-semibold uppercase  px-2.5 h-5">Live</Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </section>
                    </TabsContent>

 <TabsContent value="jobs" className="animate-in fade-in slide-in-from-bottom-2">
                        <MessageJobsView />
                    </TabsContent>

 <TabsContent value="analytics" className="animate-in fade-in slide-in-from-bottom-2">
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
 <Card className="lg:col-span-2 rounded-[2rem] overflow-hidden border-none ring-1 ring-border shadow-sm">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <CardTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
 <TrendingUp className="h-5 w-5 text-primary" /> Delivery Trends (30D)
                                    </CardTitle>
 <CardDescription className="text-xs font-bold ">Global SMS throughput and handset verification.</CardDescription>
                                </CardHeader>
 <CardContent className="h-[350px] p-8">
                                    {isLoadingReport ? (
 <Skeleton className="w-full h-full rounded-xl" />
                                    ) : reportData.length > 0 ? (
 <ChartContainer config={chartConfig} className="h-full w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={reportData}>
                                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                                                    <XAxis 
                                                        dataKey="date" 
                                                        tickLine={false} 
                                                        axisLine={false} 
                                                        fontSize={10} 
                                                        tickFormatter={(val) => {
                                                            const date = new Date(val);
                                                            return isValid(date) ? format(date, 'MMM d') : val;
                                                        }}
                                                        tick={{ fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }}
                                                    />
                                                    <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
                                                    <ChartTooltip content={<ChartTooltipContent />} />
                                                    <Bar dataKey="sent" fill="var(--color-sent)" radius={4}>
                                                        {reportData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={`hsl(var(--primary) / ${0.4 + (index / reportData.length) * 0.6})`} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </ChartContainer>
                                    ) : (
 <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground border-2 border-dashed rounded-2xl bg-background p-8">
 <Info className="h-10 w-10 mb-4 opacity-20" />
 <p className="font-semibold text-xs">No throughput data recorded</p>
 <p className="text-[10px] tracking-tighter mt-1 opacity-60">Campaign metrics will appear here after dispatch</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

 <div className="space-y-6">
                                {/* SMS Summary */}
 <Card className="bg-emerald-500/10 border-emerald-500/20 rounded-[1.5rem] shadow-sm">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20">
 <Smartphone className="h-6 w-6" />
                                        </div>
                                        <div>
 <p className="text-[10px] font-semibold text-emerald-500 leading-none mb-1.5">SMS Delivered (Total)</p>
 <p className="text-4xl font-semibold text-emerald-500 tabular-nums leading-none">
                                                {reportData.reduce((acc, curr) => acc + (curr.delivered || 0), 0)}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Email Summary */}
 <Card className="bg-blue-500/10 border-blue-500/20 rounded-[1.5rem] shadow-sm">
 <CardContent className="p-6 flex items-center gap-5">
 <div className="p-4 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20">
 <Mail className="h-6 w-6" />
                                        </div>
                                        <div>
 <p className="text-[10px] font-semibold text-blue-500 leading-none mb-1.5">Email Sent (Resolved)</p>
 <p className="text-4xl font-semibold text-blue-500 tabular-nums leading-none">
                                                {emailStats.sent}
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>

                                {/* Failure Analytics */}
 <Card className="bg-rose-500/10 border-rose-500/20 rounded-[1.5rem] shadow-sm">
 <CardHeader className="p-6 pb-2">
 <CardTitle className="text-[10px] font-semibold text-rose-500 flex items-center gap-2">
 <XCircle className="h-3.5 w-3.5" /> Termination Report
                                        </CardTitle>
                                    </CardHeader>
 <CardContent className="p-6 pt-0 space-y-4">
 <div className="flex justify-between items-end border-b border-rose-500/10 pb-3">
 <span className="text-[10px] font-bold text-rose-500 opacity-60 ">SMS Failures</span>
 <span className="text-2xl font-semibold text-rose-500 tabular-nums">{reportData.reduce((acc, curr) => acc + (curr.failed || 0), 0)}</span>
                                        </div>
 <div className="flex justify-between items-end">
 <span className="text-[10px] font-bold text-rose-500 opacity-60 ">Email Bounces</span>
 <span className="text-2xl font-semibold text-rose-500 tabular-nums">{emailStats.failed}</span>
                                        </div>
                                    </CardContent>
                                </Card>

 <Card className="bg-primary/5 border-primary/10 rounded-[1.5rem] shadow-none border-dashed border-2">
 <CardContent className="p-6 flex items-center gap-4 text-center justify-center h-24">
 <div className="space-y-1">
 <p className="text-[9px] font-semibold text-primary flex items-center gap-2 justify-center">
 <Target className="h-3 w-3" /> Delivery Efficiency
                                            </p>
 <p className="text-2xl font-semibold text-foreground">
                                                {deliveryEfficiency}%
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
