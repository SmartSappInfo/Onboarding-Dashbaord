'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, SurveyResponse, SurveySession } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import {
    MousePointerClick,
    PlayCircle,
    CheckCircle2,
    ShieldCheck,
    Users,
    Award,
    Activity,
    Clock,
    TrendingUp,
    User as UserIcon,
    ArrowUpRight,
} from 'lucide-react';

const CHART_COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
    "hsl(var(--chart-5))",
];

// ─── Helper: Resolve user name from ID ───
function UserName({ userId, users }: { userId: string; users: any[] }) {
    const user = React.useMemo(() => users?.find(u => u.id === userId), [users, userId]);
    return (
        <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <span className="text-[11px] font-black text-blue-600 uppercase">
                    {(user?.name || user?.email || '?')[0]}
                </span>
            </div>
            <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-foreground truncate">{user?.name || user?.email || 'Team Member'}</span>
                <span className="text-[9px] text-muted-foreground font-bold tracking-tighter italic truncate">{user?.email || userId}</span>
            </div>
        </div>
    );
}

// ─── Stat Card ───
function StatCard({ icon: Icon, label, value, color, isLoading }: {
    icon: React.ElementType;
    label: string;
    value: number | string;
    color: string;
    isLoading?: boolean;
}) {
    return (
        <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
            <CardContent className="p-5 flex items-center gap-4">
                <div className={cn("p-3 rounded-2xl", color)}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                    {isLoading ? (
                        <Skeleton className="h-7 w-16" />
                    ) : (
                        <p className="text-2xl font-black tracking-tight">{value}</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Types ───
interface RepStats {
    id: string;
    linkOpens: number;
    starts: number;
    completions: number;
    leads: number;
    conversionRate: number;
    avgCompletionTime: number | null; // seconds
}

export default function FieldTeamView({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
    const firestore = useFirestore();
    const router = useRouter();

    // Fetch sessions for this survey
    const sessionsQuery = useMemoFirebase(() => {
        if (!firestore || !survey?.id || typeof survey.id !== 'string') return null;
        return query(collection(firestore, 'survey_sessions'), where('surveyId', '==', survey.id));
    }, [firestore, survey?.id]);
    const { data: sessions, isLoading: sessionsLoading } = useCollection<SurveySession>(sessionsQuery);

    // Fetch team users
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
    }, [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    // ─── Compute per-representative stats ───
    const repStats: RepStats[] = React.useMemo(() => {
        if (!sessions || !responses) return [];

        // Build response map for completion time lookups (O(1))
        const responsesByUser = new Map<string, SurveyResponse[]>();
        responses.forEach(r => {
            if (r.assignedUserId) {
                const list = responsesByUser.get(r.assignedUserId) || [];
                list.push(r);
                responsesByUser.set(r.assignedUserId, list);
            }
        });

        // Build session stats per user  
        const statsMap = new Map<string, {
            linkOpens: number;
            starts: number;
            completions: number;
            completionTimes: number[];
        }>();

        sessions.forEach(session => {
            const uid = session.assignedUserId;
            if (!uid) return;

            if (!statsMap.has(uid)) {
                statsMap.set(uid, { linkOpens: 0, starts: 0, completions: 0, completionTimes: [] });
            }
            const stat = statsMap.get(uid)!;
            stat.linkOpens++;
            if (session.maxStepReached >= 1) stat.starts++;
            if (session.isSubmitted) {
                stat.completions++;
                // Calculate completion time if we have both timestamps
                if (session.startedAt) {
                    const started = new Date(session.startedAt).getTime();
                    const updated = new Date(session.updatedAt).getTime();
                    if (updated > started) {
                        stat.completionTimes.push((updated - started) / 1000);
                    }
                }
            }
        });

        // Merge with response data for leads
        const allUserIds = new Set<string>([
            ...statsMap.keys(),
            ...responsesByUser.keys(),
        ]);

        return Array.from(allUserIds).map(uid => {
            const sessionStat = statsMap.get(uid) || { linkOpens: 0, starts: 0, completions: 0, completionTimes: [] };
            const userResponses = responsesByUser.get(uid) || [];
            const leads = userResponses.filter(r => r.entityId).length;
            const linkOpens = sessionStat.linkOpens || userResponses.length; // fallback

            return {
                id: uid,
                linkOpens,
                starts: sessionStat.starts,
                completions: sessionStat.completions || userResponses.length,
                leads,
                conversionRate: linkOpens > 0 ? Math.round((sessionStat.completions / linkOpens) * 100) : 0,
                avgCompletionTime: sessionStat.completionTimes.length > 0
                    ? Math.round(sessionStat.completionTimes.reduce((a, b) => a + b, 0) / sessionStat.completionTimes.length)
                    : null,
            };
        }).sort((a, b) => b.completions - a.completions);
    }, [sessions, responses]);

    // ─── Aggregate totals ───
    const totals = React.useMemo(() => {
        return repStats.reduce((acc, r) => ({
            linkOpens: acc.linkOpens + r.linkOpens,
            starts: acc.starts + r.starts,
            completions: acc.completions + r.completions,
            leads: acc.leads + r.leads,
        }), { linkOpens: 0, starts: 0, completions: 0, leads: 0 });
    }, [repStats]);

    // ─── Chart data for comparison ───
    const chartData = React.useMemo(() => {
        if (!users) return [];
        return repStats.slice(0, 8).map(rep => {
            const user = users.find(u => u.id === rep.id);
            return {
                name: user?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'User',
                'Link Opens': rep.linkOpens,
                'Starts': rep.starts,
                'Completions': rep.completions,
                'Leads': rep.leads,
            };
        });
    }, [repStats, users]);

    const formatTime = (seconds: number | null): string => {
        if (seconds === null) return '—';
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    };

    const navigateToFiltered = (userId: string, filterType: string) => {
        router.push(`/admin/surveys/${survey.id}/results?view=responses&filterUser=${userId}&filterType=${filterType}`);
    };

    const isLoading = sessionsLoading;

    return (
        <div className="p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Section 1: Team KPI Summary */}
            <div>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-blue-500/10 rounded-xl">
                        <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black tracking-tight">Field Team Intelligence</h3>
                        <p className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">
                            Real-time outreach performance across all assigned representatives
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={MousePointerClick}
                        label="Link Opens"
                        value={totals.linkOpens}
                        color="bg-orange-500/10 text-orange-600"
                        isLoading={isLoading}
                    />
                    <StatCard
                        icon={PlayCircle}
                        label="Process Starts"
                        value={totals.starts}
                        color="bg-blue-500/10 text-blue-600"
                        isLoading={isLoading}
                    />
                    <StatCard
                        icon={CheckCircle2}
                        label="Completions"
                        value={totals.completions}
                        color="bg-emerald-500/10 text-emerald-600"
                        isLoading={isLoading}
                    />
                    <StatCard
                        icon={ShieldCheck}
                        label="Leads Captured"
                        value={totals.leads}
                        color="bg-purple-500/10 text-purple-600"
                        isLoading={isLoading}
                    />
                </div>
            </div>

            {/* Section 2: Representative Leaderboard */}
            <Card className="border-none ring-1 ring-border shadow-sm rounded-2xl overflow-hidden">
                <CardHeader className="bg-muted/10 border-b pb-6 px-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600">
                            <Award className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-semibold tracking-tight">Representative Leaderboard</CardTitle>
                            <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                Click any metric to drill down into filtered responses
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-6 space-y-4">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <Skeleton key={i} className="h-14 w-full" />
                            ))}
                        </div>
                    ) : repStats.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center text-center opacity-30 p-8">
                            <Activity className="h-10 w-10 mb-2" />
                            <p className="text-[10px] font-bold tracking-tight">No Attribution Data Yet</p>
                            <p className="text-[9px] text-muted-foreground mt-1">Share the survey using assigned user links to begin tracking</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                                    <TableHead className="text-[9px] font-black uppercase py-4 pl-6 min-w-[200px]">Representative</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase py-4 text-center cursor-help" title="Total unique link opens">
                                        <div className="flex flex-col items-center gap-1">
                                            <MousePointerClick className="h-3 w-3 text-orange-500" />
                                            Opens
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-[9px] font-black uppercase py-4 text-center cursor-help" title="Sessions reaching step 2+">
                                        <div className="flex flex-col items-center gap-1">
                                            <PlayCircle className="h-3 w-3 text-blue-500" />
                                            Starts
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-[9px] font-black uppercase py-4 text-center cursor-help" title="Fully submitted surveys">
                                        <div className="flex flex-col items-center gap-1">
                                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                            Done
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-[9px] font-black uppercase py-4 text-center cursor-help" title="Submissions that created CRM leads">
                                        <div className="flex flex-col items-center gap-1">
                                            <ShieldCheck className="h-3 w-3 text-purple-500" />
                                            Leads
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-[9px] font-black uppercase py-4 text-center">Conv. Rate</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase py-4 text-right pr-6">
                                        <div className="flex flex-col items-end gap-1">
                                            <Clock className="h-3 w-3 text-muted-foreground" />
                                            Avg. Time
                                        </div>
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {repStats.map((rep, idx) => (
                                    <TableRow key={rep.id} className="group transition-all hover:bg-blue-50/30 dark:hover:bg-blue-950/10">
                                        <TableCell className="py-4 pl-6">
                                            {users ? <UserName userId={rep.id} users={users} /> : <Skeleton className="h-8 w-32" />}
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            <button
                                                type="button"
                                                onClick={() => navigateToFiltered(rep.id, 'opens')}
                                                className="inline-flex items-center gap-1 text-xs font-bold hover:text-orange-600 hover:underline transition-colors cursor-pointer group/btn"
                                            >
                                                {rep.linkOpens}
                                                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            <button
                                                type="button"
                                                onClick={() => navigateToFiltered(rep.id, 'starts')}
                                                className="inline-flex items-center gap-1 text-xs font-bold hover:text-blue-600 hover:underline transition-colors cursor-pointer group/btn"
                                            >
                                                {rep.starts}
                                                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            <button
                                                type="button"
                                                onClick={() => navigateToFiltered(rep.id, 'completions')}
                                                className="inline-flex items-center gap-1 text-xs font-black text-emerald-600 hover:underline transition-colors cursor-pointer group/btn"
                                            >
                                                {rep.completions}
                                                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            <button
                                                type="button"
                                                onClick={() => navigateToFiltered(rep.id, 'leads')}
                                                className="inline-flex items-center gap-1 text-xs font-black text-purple-600 hover:underline transition-colors cursor-pointer group/btn"
                                            >
                                                {rep.leads}
                                                <ArrowUpRight className="h-3 w-3 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                                            </button>
                                        </TableCell>
                                        <TableCell className="text-center py-4">
                                            <div className="flex flex-col items-center gap-1.5">
                                                <span className={cn(
                                                    "text-[10px] font-black px-2 py-0.5 rounded-md",
                                                    rep.conversionRate >= 75 ? "bg-emerald-500 text-white" :
                                                    rep.conversionRate >= 40 ? "bg-blue-500/10 text-blue-600" :
                                                    "bg-orange-500/10 text-orange-600"
                                                )}>
                                                    {rep.conversionRate}%
                                                </span>
                                                <Progress value={rep.conversionRate} className="h-1 w-14" />
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right py-4 pr-6">
                                            <span className="text-[10px] font-bold text-muted-foreground">
                                                {formatTime(rep.avgCompletionTime)}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Section 3: Comparative Bar Chart */}
            {chartData.length > 0 && (
                <Card className="border-none ring-1 ring-border shadow-sm rounded-2xl overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b pb-6 px-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <TrendingUp className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <CardTitle className="text-sm font-semibold tracking-tight">Comparative Performance</CardTitle>
                                <CardDescription className="text-[10px] font-bold text-muted-foreground/60 tracking-tight">
                                    Side-by-side metrics across representatives
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="h-[350px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        fontSize={10}
                                        tick={{ fontWeight: 'bold' }}
                                    />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip
                                        cursor={{ fill: 'hsl(var(--accent))' }}
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                return (
                                                    <div className="bg-background border rounded-xl p-3 shadow-xl text-xs space-y-1">
                                                        <p className="font-black text-foreground">{label}</p>
                                                        {payload.map((p: any, i: number) => (
                                                            <p key={i} style={{ color: p.color }} className="font-bold">
                                                                {p.name}: {p.value}
                                                            </p>
                                                        ))}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Legend
                                        verticalAlign="top"
                                        align="right"
                                        iconType="circle"
                                        wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                    />
                                    <Bar dataKey="Link Opens" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} barSize={16} />
                                    <Bar dataKey="Starts" fill={CHART_COLORS[1]} radius={[4, 4, 0, 0]} barSize={16} />
                                    <Bar dataKey="Completions" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} barSize={16} />
                                    <Bar dataKey="Leads" fill={CHART_COLORS[3]} radius={[4, 4, 0, 0]} barSize={16} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
