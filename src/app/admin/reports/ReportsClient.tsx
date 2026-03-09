'use client';

import * as React from 'react';
import { 
    BarChart, 
    Bar, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    ResponsiveContainer, 
    Cell,
    PieChart,
    Pie,
    Legend,
    LineChart,
    Line,
    AreaChart,
    Area
} from 'recharts';
import { 
    BarChart3, 
    TrendingUp, 
    Users, 
    Building, 
    ShieldCheck, 
    Target, 
    Zap, 
    MapPin, 
    Download, 
    FileText, 
    Loader2, 
    Info,
    Calendar,
    Trophy,
    MousePointer2,
    PieChart as PieChartIcon,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { School, Task, UserProfile, Zone, MessageLog } from '@/lib/types';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export default function ReportsClient() {
    const firestore = useFirestore();
    const { user } = useUser();
    
    // Subscriptions
    const schoolsCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools')) : null, [firestore]);
    const tasksCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'tasks')) : null, [firestore]);
    const zonesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones')) : null, [firestore]);
    const logsCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'message_logs'), orderBy('sentAt', 'desc'), limit(500)) : null, [firestore]);

    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
    const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksCol);
    const { data: zones } = useCollection<Zone>(zonesCol);
    const { data: logs } = useCollection<MessageLog>(logsCol);

    const isLoading = isLoadingSchools || isLoadingTasks;

    // 1. Onboarding Velocity (Last 6 Months)
    const velocityData = React.useMemo(() => {
        if (!schools) return [];
        const months = Array.from({ length: 6 }).map((_, i) => {
            const date = subDays(new Date(), i * 30);
            return {
                name: format(date, 'MMM'),
                start: startOfMonth(date),
                end: endOfMonth(date),
                count: 0
            };
        }).reverse();

        schools.forEach(school => {
            const createdDate = new Date(school.createdAt);
            months.forEach(m => {
                if (isWithinInterval(createdDate, { start: m.start, end: m.end })) {
                    m.count++;
                }
            });
        });

        return months;
    }, [schools]);

    // 2. Zone Health Breakdown
    const zoneHealth = React.useMemo(() => {
        if (!zones || !schools) return [];
        return zones.map(zone => {
            const zoneSchools = schools.filter(s => s.zone?.id === zone.id);
            return {
                name: zone.name,
                schools: zoneSchools.length,
                students: zoneSchools.reduce((sum, s) => sum + (s.nominalRoll || 0), 0),
                avgStage: Math.round(zoneSchools.reduce((sum, s) => sum + (s.stage?.order || 1), 0) / (zoneSchools.length || 1))
            };
        }).sort((a, b) => b.schools - a.schools);
    }, [zones, schools]);

    // 3. Operational Effectiveness (Tasks)
    const taskMetrics = React.useMemo(() => {
        if (!tasks) return { total: 0, completed: 0, overdue: 0, efficiency: 0 };
        const total = tasks.length;
        const completed = tasks.filter(t => t.status === 'completed').length;
        const overdue = tasks.filter(t => t.status !== 'completed' && new Date(t.dueDate) < new Date()).length;
        const efficiency = total > 0 ? Math.round((completed / total) * 100) : 100;
        
        return { total, completed, overdue, efficiency };
    }, [tasks]);

    // 4. Messaging Throughput
    const messagingData = React.useMemo(() => {
        if (!logs) return [];
        const daily = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), i);
            return {
                day: format(date, 'EEE'),
                fullDate: date,
                sent: 0,
                failed: 0
            };
        }).reverse();

        logs.forEach(log => {
            const logDate = new Date(log.sentAt);
            daily.forEach(d => {
                if (logDate.toDateString() === d.fullDate.toDateString()) {
                    if (log.status === 'sent') d.sent++;
                    else if (log.status === 'failed') d.failed++;
                }
            });
        });

        return daily;
    }, [logs]);

    if (isLoading) {
        return (
            <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <Skeleton className="h-[400px] rounded-[2.5rem]" />
                    <Skeleton className="h-[400px] rounded-[2.5rem]" />
                </div>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5 text-left">
            <div className="max-w-7xl mx-auto space-y-12 pb-32">
                
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-black tracking-tighter flex items-center gap-4 text-foreground uppercase">
                            <BarChart3 className="h-10 w-10 text-primary" />
                            Network Intelligence
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">Cross-regional performance audit and organizational health analytics.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="rounded-xl font-bold h-11 gap-2 border-primary/20 text-primary hover:bg-primary/5 shadow-sm">
                            <FileText className="h-4 w-4" />
                            PDF Export
                        </Button>
                        <Button className="rounded-xl font-black h-11 px-8 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs">
                            Generate Audit
                        </Button>
                    </div>
                </div>

                {/* Key Performance Indicators */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Growth Velocity" value={`+${velocityData[velocityData.length-1].count}`} sub="New Schools (30D)" icon={TrendingUp} color="text-primary" bg="bg-primary/10" />
                    <StatCard label="Force Efficiency" value={`${taskMetrics.efficiency}%`} sub="Task Completion" icon={Target} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Overdue Items" value={taskMetrics.overdue} sub="Interventions Required" icon={AlertCircle} color="text-rose-600" bg="bg-rose-50" />
                    <StatCard label="Student Impact" value={zoneHealth.reduce((a,c) => a + c.students, 0).toLocaleString()} sub="Total Active Roll" icon={Users} color="text-blue-600" bg="bg-blue-50" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Growth Chart */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <Zap className="h-4 w-4" /> Network Expansion Velocity
                            </CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">New institutional signups per month.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={velocityData}>
                                    <defs>
                                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} tick={{ fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} tick={{ fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ fontWeight: 'black', textTransform: 'uppercase', fontSize: '10px' }}
                                    />
                                    <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={4} fillOpacity={1} fill="url(#colorCount)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Regional Performance */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <MapPin className="h-4 w-4" /> Regional Health Audit
                            </CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Operational density across geographic zones.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={zoneHealth} layout="vertical" margin={{ left: 40 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} fontSize={10} width={100} tick={{ fontWeight: 'bold', fill: 'hsl(var(--muted-foreground))' }} />
                                    <Tooltip 
                                        cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="schools" radius={[0, 4, 4, 0]} barSize={20}>
                                        {zoneHealth.map((_, i) => <Cell key={`cell-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Messaging Integrity */}
                    <Card className="lg:col-span-2 rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="p-8 pb-4">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4" /> Provider Throughput (7D)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 pt-0 h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={messagingData}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={10} tick={{ fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase' }} />
                                    <Line type="stepAfter" dataKey="sent" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'white' }} />
                                    <Line type="stepAfter" dataKey="failed" stroke="hsl(var(--destructive))" strokeWidth={2} strokeDasharray="5 5" dot={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Operational Insights */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Strategy Insights</CardTitle>
                            <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">AI-driven network optimization.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <InsightRow icon={Target} title="Priority Zone" value={zoneHealth[0]?.name || 'N/A'} desc="Highest signup volume this quarter." />
                            <InsightRow icon={Trophy} title="Top Performer" value={taskMetrics.efficiency > 80 ? 'Optimal' : 'Standard'} desc="Based on intervention completion velocity." />
                            <InsightRow icon={Info} title="Protocol Alert" value={`${taskMetrics.overdue} Blockers`} desc="High-risk delays in current pipeline." />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110", bg, color)}>
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

function InsightRow({ icon: Icon, title, value, desc }: { icon: any, title: string, value: string, desc: string }) {
    return (
        <div className="flex gap-4">
            <div className="p-2 bg-primary/10 rounded-xl text-primary shrink-0 h-fit mt-1"><Icon className="h-4 w-4" /></div>
            <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 leading-none">{title}</p>
                <p className="text-base font-black uppercase tracking-tight">{value}</p>
                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed">{desc}</p>
            </div>
        </div>
    );
}
