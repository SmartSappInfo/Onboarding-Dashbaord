
'use client';

import * as React from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CampaignSession } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    Tooltip, 
    ResponsiveContainer, 
    Cell, 
    PieChart, 
    Pie, 
    Legend 
} from 'recharts';
import { 
    Users, 
    Target, 
    Clock, 
    TrendingUp, 
    Building2, 
    GraduationCap, 
    Zap,
    MousePointer2,
    Activity,
    Globe
} from 'lucide-react';
import { formatDistanceToNow, differenceInSeconds } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import LightRays from '@/components/LightRays';
import { SmartSappLogo } from '@/components/icons';

const CHART_COLORS = ['#3B5FFF', '#F97316', '#CBD5E1'];

export default function CampaignStatisticsPage() {
    const firestore = useFirestore();

    const sessionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'campaign_sessions'),
            where('campaignId', '==', 'school-comparison'),
            orderBy('updatedAt', 'desc')
        );
    }, [firestore]);

    const { data: sessions, isLoading } = useCollection<CampaignSession>(sessionsQuery);

    const stats = React.useMemo(() => {
        if (!sessions) return null;

        const totalVisits = sessions.length;
        const schoolClicks = sessions.filter(s => s.selectedOption === 'school').length;
        const parentClicks = sessions.filter(s => s.selectedOption === 'parent').length;
        const totalConversions = schoolClicks + parentClicks;
        const conversionRate = totalVisits > 0 ? (totalConversions / totalVisits) * 100 : 0;

        // Duration Math
        let totalDuration = 0;
        let activeSessionsCount = 0;
        sessions.forEach(s => {
            if (s.createdAt && s.updatedAt) {
                const duration = differenceInSeconds(new Date(s.updatedAt), new Date(s.createdAt));
                if (duration > 0) {
                    totalDuration += duration;
                    activeSessionsCount++;
                }
            }
        });
        const avgDuration = activeSessionsCount > 0 ? Math.round(totalDuration / activeSessionsCount) : 0;

        const distributionData = [
            { name: 'Institutional', value: schoolClicks, color: CHART_COLORS[0], icon: Building2 },
            { name: 'Families', value: parentClicks, color: CHART_COLORS[1], icon: Users },
            { name: 'Undecided', value: totalVisits - totalConversions, color: CHART_COLORS[2], icon: MousePointer2 },
        ];

        return {
            totalVisits,
            schoolClicks,
            parentClicks,
            totalConversions,
            conversionRate,
            avgDuration,
            distributionData
        };
    }, [sessions]);

    if (isLoading) {
        return (
            <div className="p-8 space-y-8 bg-muted/5 min-h-screen">
                <div className="max-w-5xl mx-auto space-y-8 pt-20">
                    <Skeleton className="h-12 w-64 rounded-xl" />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Skeleton className="h-32 rounded-3xl" />
                        <Skeleton className="h-32 rounded-3xl" />
                        <Skeleton className="h-32 rounded-3xl" />
                    </div>
                    <Skeleton className="h-[400px] rounded-[3rem]" />
                </div>
            </div>
        );
    }

    if (!stats) return null;

    return (
        <div className="min-h-screen bg-slate-50 relative overflow-hidden flex flex-col text-left">
            <div className="absolute inset-0 z-0 opacity-20">
                <LightRays
                    raysOrigin="top-center"
                    raysColor="#3B5FFF"
                    raysSpeed={0.5}
                    lightSpread={0.8}
                    rayLength={3}
                    pulsating
                    fadeDistance={1}
                    saturation={1}
                    className="!absolute inset-0"
                />
            </div>

            <header className="relative z-10 p-6 sm:p-8 flex items-center justify-between border-b bg-white/80 backdrop-blur-md shrink-0">
                <div className="flex items-center gap-4">
                    <SmartSappLogo className="h-8" />
                    <div className="h-6 w-px bg-border hidden sm:block" />
                    <div className="hidden sm:block">
                        <h1 className="text-sm font-black uppercase tracking-tight text-foreground">Campaign Audit Hub</h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">School Comparison Performance</p>
                    </div>
                </div>
                <Badge variant="outline" className="rounded-full bg-emerald-50 text-emerald-600 border-emerald-200 font-black text-[10px] px-4 h-8 uppercase tracking-widest gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Monitoring
                </Badge>
            </header>

            <main className="relative z-10 flex-grow p-4 sm:p-10">
                <div className="max-w-6xl mx-auto space-y-10">
                    
                    {/* Hero Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <StatCard label="Public Reach" value={stats.totalVisits} sub="Unique Visitors" icon={Globe} color="text-primary" bg="bg-primary/10" />
                        <StatCard label="Persona Pull" value={`${stats.conversionRate.toFixed(1)}%`} sub="Click-through Rate" icon={Target} color="text-emerald-600" bg="bg-emerald-50" />
                        <StatCard label="Engagement" value={`${stats.avgDuration}s`} sub="Avg. Time on Page" icon={Clock} color="text-blue-600" bg="bg-blue-50" />
                        <StatCard label="Total Intent" value={stats.totalConversions} sub="Persona Selections" icon={Zap} color="text-orange-600" bg="bg-orange-50" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Sentiment / Persona Distribution */}
                        <Card className="lg:col-span-2 rounded-[2.5rem] border-none ring-1 ring-border shadow-2xl overflow-hidden bg-white">
                            <CardHeader className="p-8 border-b bg-muted/10">
                                <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                                    <Activity className="h-5 w-5 text-primary" /> Audience Distribution
                                </CardTitle>
                                <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Institutional vs. Family interest levels.</CardDescription>
                            </CardHeader>
                            <CardContent className="p-8 h-[350px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={stats.distributionData} layout="vertical" margin={{ left: 40 }}>
                                        <XAxis type="number" hide />
                                        <YAxis 
                                            dataKey="name" 
                                            type="category" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            fontSize={10} 
                                            width={100} 
                                            tick={{ fontWeight: 'black', fill: 'hsl(var(--muted-foreground))' }} 
                                        />
                                        <Tooltip 
                                            cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                                        />
                                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={40}>
                                            {stats.distributionData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>

                        {/* Summary Insights */}
                        <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-2xl bg-slate-900 text-white overflow-hidden flex flex-col h-full">
                            <CardHeader className="p-8 border-b border-white/5 bg-white/5">
                                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Strategic Snapshot</CardTitle>
                            </CardHeader>
                            <CardContent className="p-8 space-y-10 flex-1">
                                <InsightRow 
                                    label="Primary Persona" 
                                    value={stats.schoolClicks >= stats.parentClicks ? 'Institutional' : 'Families'} 
                                    icon={stats.schoolClicks >= stats.parentClicks ? Building2 : Users} 
                                />
                                <InsightRow 
                                    label="Retention Health" 
                                    value={stats.avgDuration > 30 ? 'High' : stats.avgDuration > 10 ? 'Medium' : 'Friction'} 
                                    icon={TrendingUp} 
                                />
                                <InsightRow 
                                    label="Undecided Ratio" 
                                    value={`${((stats.totalVisits - stats.totalConversions) / stats.totalVisits * 100).toFixed(0)}%`} 
                                    icon={MousePointer2} 
                                />
                            </CardContent>
                            <CardFooter className="p-8 pt-0 mt-auto">
                                <p className="text-[9px] font-bold text-white/30 leading-relaxed uppercase tracking-widest">
                                    All data points are collected anonymously via real-time session heartbeats.
                                </p>
                            </CardFooter>
                        </Card>
                    </div>
                </div>
            </main>

            <footer className="relative z-10 py-12 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-40">
                &copy; {new Date().getFullYear()} SmartSapp Intelligence · Authorized Access Only
            </footer>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-3xl font-black tabular-nums tracking-tighter">{value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function InsightRow({ label, value, icon: Icon }: { label: string, value: string, icon: any }) {
    return (
        <div className="flex gap-5 group">
            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 shrink-0 group-hover:bg-primary group-hover:border-primary transition-all duration-500 shadow-xl">
                <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
                <p className="text-2xl font-black uppercase tracking-tight">{value}</p>
            </div>
        </div>
    );
}
