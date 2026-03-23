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
    AlertCircle,
    CheckCircle2,
    Clock,
    UserCheck,
    Gauge,
    ArrowRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where } from 'firebase/firestore';
import type { School, Task, UserProfile, Zone, MessageLog, TaskCategory } from '@/lib/types';
import { format, subDays, startOfMonth, endOfMonth, isWithinInterval, differenceInDays } from 'date-fns';
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
    
    // Subscriptions
    const schoolsCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'schools')) : null, [firestore]);
    const tasksCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'tasks')) : null, [firestore]);
    const zonesCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones')) : null, [firestore]);
    const logsCol = useMemoFirebase(() => firestore ? query(collection(firestore, 'message_logs'), orderBy('sentAt', 'desc'), limit(500)) : null, [firestore]);

    const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
    const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksCol);
    const { data: zones, isLoading: isLoadingZones } = useCollection<Zone>(zonesCol);
    const { data: logs, isLoading: isLoadingLogs } = useCollection<MessageLog>(logsCol);

    const isLoading = isLoadingSchools || isLoadingTasks || isLoadingZones || isLoadingLogs;

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
        if (!tasks) return { total: 0, completed: 0, overdue: 0, efficiency: 0, avgResolutionDays: 0 };
        const total = tasks.length;
        const completedTasks = tasks.filter(t => t.status === 'done');
        const completedCount = completedTasks.length;
        const overdue = tasks.filter(t => t.status !== 'done' && new Date(t.dueDate) < new Date()).length;
        const efficiency = total > 0 ? Math.round((completedCount / total) * 100) : 100;
        
        let totalDays = 0;
        completedTasks.forEach(t => {
            if (t.completedAt && t.createdAt) {
                totalDays += Math.max(0, differenceInDays(new Date(t.completedAt), new Date(t.createdAt)));
            }
        });
        const avgResolutionDays = completedCount > 0 ? Math.round(totalDays / completedCount) : 0;

        return { total, completed: completedCount, overdue, efficiency, avgResolutionDays };
    }, [tasks]);

    // 4. Lead-Time per Category (CRM Analysis)
    const categoryMetrics = React.useMemo(() => {
        if (!tasks) return [];
        const categories: TaskCategory[] = ['call', 'visit', 'document', 'training', 'general'];
        return categories.map(cat => {
            const completedInCat = tasks.filter(t => t.category === cat && t.status === 'done');
            let totalDays = 0;
            completedInCat.forEach(t => {
                if (t.completedAt && t.createdAt) {
                    totalDays += Math.max(0, differenceInDays(new Date(t.completedAt), new Date(t.createdAt)));
                }
            });
            return {
                name: cat.charAt(0).toUpperCase() + cat.slice(1),
                avgDays: completedInCat.length > 0 ? Math.round(totalDays / completedInCat.length) : 0,
                count: completedInCat.length
            };
        }).filter(c => c.count > 0).sort((a, b) => b.avgDays - a.avgDays);
    }, [tasks]);

    // 5. Task Resolution Trend (Last 7 Days)
    const taskVelocityData = React.useMemo(() => {
        if (!tasks) return [];
        const daily = Array.from({ length: 7 }).map((_, i) => {
            const date = subDays(new Date(), i);
            return {
                day: format(date, 'EEE'),
                fullDate: date,
                resolved: 0,
                created: 0
            };
        }).reverse();

        tasks.forEach(task => {
            const createdDate = new Date(task.createdAt);
            const completedDate = task.completedAt ? new Date(task.completedAt) : null;
            
            daily.forEach(d => {
                if (createdDate.toDateString() === d.fullDate.toDateString()) d.created++;
                if (completedDate && completedDate.toDateString() === d.fullDate.toDateString()) d.resolved++;
            });
        });

        return daily;
    }, [tasks]);

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
                            Intelligence Hub
                        </h1>
                        <p className="text-muted-foreground font-medium text-lg mt-1">Cross-regional institutional health and operational CRM performance.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" className="rounded-xl font-bold h-11 gap-2 border-primary/20 text-primary hover:bg-primary/5 shadow-sm">
                            <FileText className="h-4 w-4" /> System Audit
                        </Button>
                        <Button className="rounded-xl font-black h-11 px-8 shadow-xl shadow-primary/20 uppercase tracking-widest text-xs">
                            Executive Export
                        </Button>
                    </div>
                </div>

                {/* KPI Tier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <StatCard label="Network Growth" value={`+${velocityData[velocityData.length-1].count}`} sub="New Signups (30D)" icon={TrendingUp} color="text-primary" bg="bg-primary/10" />
                    <StatCard label="Force Multiplier" value={`${taskMetrics.efficiency}%`} sub="Task Closure Velocity" icon={Target} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Lead-Time Avg" value={`${taskMetrics.avgResolutionDays}d`} sub="Days to Task Closure" icon={Clock} color="text-blue-600" bg="bg-blue-50" />
                    <StatCard label="Network Density" value={zoneHealth.reduce((a,c) => a + c.students, 0).toLocaleString()} sub="Total Active Roll" icon={Users} color="text-purple-600" bg="bg-purple-50" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* CRM Resolution Trend */}
                    <Card className="lg:col-span-2 rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <Gauge className="h-4 w-4" /> CRM Resolution velocity (7D)
                            </CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Intervention creation vs. successful closure.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={taskVelocityData}>
                                    <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                                    <XAxis dataKey="day" axisLine={false} tickLine={false} fontSize={10} tick={{ fontWeight: 'bold' }} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip 
                                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '9px', fontBlack: true, textTransform: 'uppercase', paddingTop: '20px' }} />
                                    <Bar dataKey="created" fill="hsl(var(--muted-foreground)/0.2)" radius={[4, 4, 0, 0]} name="Protocol Opened" />
                                    <Bar dataKey="resolved" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Protocol Resolved" />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Regional Performance */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <MapPin className="h-4 w-4" /> Regional Strategic Density
                            </CardTitle>
                            <CardDescription className="text-xs font-bold uppercase tracking-widest mt-1">Campus distribution by geographic zone.</CardDescription>
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Functional Lead-Time Analysis */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Lead-Time Analysis</CardTitle>
                            <CardDescription className="text-xs font-bold text-primary/60 uppercase tracking-widest">Average days to resolution per task category.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            {categoryMetrics.length > 0 ? categoryMetrics.map((cat, i) => (
                                <div key={cat.name} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-muted rounded-xl transition-transform group-hover:scale-110">
                                            {cat.name.includes('Doc') ? <FileText className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-tight">{cat.name}</p>
                                            <p className="text-[9px] font-bold text-muted-foreground uppercase">{cat.count} Tasks Resolved</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xl font-black text-primary tabular-nums">{cat.avgDays}d</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">Mean Duration</p>
                                    </div>
                                </div>
                            )) : (
                                <div className="py-20 text-center opacity-20 italic text-sm">Insufficent historical data for analysis.</div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Operational Insights */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b p-8">
                            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-3">
                                <Zap className="h-5 w-5 text-primary" /> Executive Snapshot
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <InsightRow icon={Target} title="Top Zone Efficiency" value={zoneHealth[0]?.name || 'N/A'} desc="Highest regional onboarding density and task speed." />
                            <InsightRow icon={CheckCircle2} title="Service Level Compliance" value={`${taskMetrics.efficiency}%`} desc="Percentage of protocols resolved within institutional targets." />
                            <InsightRow icon={AlertCircle} title="Bottleneck Alert" value={`${taskMetrics.overdue} High Priority`} desc="Tasks requiring immediate cross-regional manager intervention." />
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
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-3xl font-black tabular-nums tracking-tighter leading-none">{value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function InsightRow({ icon: Icon, title, value, desc }: { icon: any, title: string, value: string, desc: string }) {
    return (
        <div className="flex gap-4 group text-left">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary shrink-0 h-fit mt-1 shadow-inner group-hover:scale-110 transition-transform"><Icon className="h-4 w-4" /></div>
            <div className="space-y-0.5 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 leading-none">{title}</p>
                <p className="text-base font-black uppercase tracking-tight text-foreground truncate">{value}</p>
                <p className="text-[10px] font-medium text-muted-foreground leading-relaxed line-clamp-2">{desc}</p>
            </div>
        </div>
    );
}
