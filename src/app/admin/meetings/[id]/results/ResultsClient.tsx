'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { collection, query, orderBy, doc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import type { Meeting, Attendee, School } from '@/lib/types';
import {
    Users,
    Baby,
    Clock,
    ArrowLeft,
    Download,
    ShieldCheck,
    TrendingUp,
    LayoutList,
    Building,
    Calendar,
    Target,
    BarChart3,
    CheckCircle2,
    CalendarCheck,
    Contact,
    ChevronRight,
    FileSpreadsheet,
    Zap,
    RotateCcw,
    Settings2,
    Loader2,
    ArrowRight,
    AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ChartTooltip,
    ResponsiveContainer,
    Cell,
    LineChart,
    Line
} from 'recharts';

/**
 * @fileOverview Meeting Intelligence Portal.
 * Visualizes session attendance, family reach, and child census.
 */
export default function ResultsClient({ meetingId: meetingIdProp }: { meetingId?: string }) {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const firestore = useFirestore();
    const meetingId = meetingIdProp || (params.id as string);

    const [isExporting, setIsExporting] = React.useState(false);

    // Data Subscriptions
    const meetingRef = useMemoFirebase(() =>
        firestore ? doc(firestore, 'meetings', meetingId) : null,
        [firestore, meetingId]);

    const attendeesQuery = useMemoFirebase(() =>
        firestore ? query(collection(firestore, `meetings/${meetingId}/attendees`), orderBy('joinedAt', 'desc')) : null,
        [firestore, meetingId]);

    const { data: meeting, isLoading: isLoadingMeeting, error: meetingError } = useDoc<Meeting>(meetingRef);
    const { data: attendees, isLoading: isLoadingAttendees, error: attendeesError } = useCollection<Attendee>(attendeesQuery);

    const metrics = React.useMemo(() => {
        if (!attendees) return { families: 0, children: 0, avgChildren: 0 };
        const families = attendees.length;
        const children = attendees.reduce((acc, curr) => acc + (curr.childrenNames?.length || 0), 0);
        const avgChildren = families > 0 ? (children / families).toFixed(1) : 0;
        return { families, children, avgChildren };
    }, [attendees]);

    const timelineData = React.useMemo(() => {
        if (!attendees) return [];
        // Group by 10-minute intervals
        const groups: Record<string, number> = {};
        attendees.forEach(a => {
            const time = format(new Date(a.joinedAt), 'HH:mm');
            groups[time] = (groups[time] || 0) + 1;
        });
        return Object.entries(groups).map(([time, count]) => ({ time, count })).reverse();
    }, [attendees]);

    const handleExport = () => {
        if (!attendees || attendees.length === 0) return;
        setIsExporting(true);
        try {
            const headers = ["Parent Name", "Children", "Joined At"];
            const rows = attendees.map(a => [
                `"${a.parentName}"`,
                `"${a.childrenNames?.join(', ') || ''}"`,
                `"${format(new Date(a.joinedAt), 'yyyy-MM-dd HH:mm:ss')}"`
            ]);

            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `Attendance_${meeting?.schoolName || 'Session'}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast({ title: 'Report Exported', description: 'Attendance ledger is ready.' });
        } catch (e) {
            toast({ variant: 'destructive', title: 'Export Failed' });
        } finally {
            setIsExporting(false);
        }
    };

    if (isLoadingMeeting) {
        return (
            <div className="p-8 space-y-8 animate-pulse">
                <div className="h-12 w-64 bg-muted rounded-xl" />
                <div className="grid grid-cols-3 gap-6">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
                </div>
                <Skeleton className="h-[400px] rounded-[2.5rem]" />
            </div>
        );
    }

    if (meetingError || attendeesError) {
        const error = meetingError || attendeesError;
        return (
            <div className="p-8 max-w-7xl mx-auto">
                <Alert variant="destructive" className="rounded-2xl border-none ring-1 ring-destructive/20 bg-destructive/5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="font-black uppercase tracking-widest text-[10px]">Intelligence Error</AlertTitle>
                    <AlertDescription className="text-sm font-medium mt-1">
                        {error?.message || 'Access Denied or Connection Failure. Please verify your permissions.'}
                    </AlertDescription>
                    <Button variant="outline" size="sm" className="mt-4 font-bold rounded-xl" onClick={() => window.location.reload()}>
                        Refresh Intelligence
                    </Button>
                </Alert>
            </div>
        );
    }

    if (!meeting) return <div className="p-20 text-center font-black uppercase tracking-widest opacity-20">Session Not Found</div>;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-slate-50 text-left">
            <div className="max-w-7xl mx-auto space-y-10 pb-32">

                {/* Executive Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-12 w-12 rounded-2xl bg-white shadow-sm border border-border/50">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div className="text-left">
                            <div className="flex items-center gap-3 mb-1">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[9px] uppercase tracking-widest px-2.5 h-5">{meeting.type.name}</Badge>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40">Session Intelligence</span>
                            </div>
                            <h1 className="text-3xl font-black uppercase tracking-tight text-foreground leading-none">{meeting.schoolName}</h1>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" onClick={() => router.push(`/admin/meetings/${meetingId}/edit`)} className="rounded-xl font-bold h-11 border-primary/20 text-primary bg-white shadow-sm">
                            <Settings2 className="mr-2 h-4 w-4" /> Edit Architecture
                        </Button>
                        {meeting.registrationEnabled && (
                            <Button variant="outline" onClick={() => router.push(`/admin/meetings/${meetingId}/registrants`)} className="rounded-xl font-bold h-11 border-violet-500/20 text-violet-600 bg-violet-500/5 shadow-sm">
                                <Users className="mr-2 h-4 w-4" /> View Registrants
                            </Button>
                        )}
                        <Button onClick={handleExport} disabled={isExporting || !attendees?.length} className="rounded-xl font-black shadow-xl shadow-primary/20 h-11 px-8 uppercase tracking-widest text-[10px] gap-2">
                            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                            Export Attendance
                        </Button>
                    </div>
                </div>

                {/* KPI Tier */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Families Joined" value={metrics.families} sub="Individual parent log-ins" icon={Users} color="text-primary" bg="bg-primary/10" />
                    <StatCard label="Children Represented" value={metrics.children} sub="Total campus enrollment reach" icon={Baby} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard label="Capture Density" value={metrics.avgChildren} sub="Mean children per parent" icon={Target} color="text-blue-600" bg="bg-blue-50" />
                    <StatCard label="Protocol Status" value={attendees?.length ? 'SUCCESS' : 'PENDING'} sub={attendees?.length ? "Engagement detected" : "Awaiting session start"} icon={CheckCircle2} color="text-purple-600" bg="bg-purple-50" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Attendance Velocity Chart */}
                    <Card className="lg:col-span-2 rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white rounded-xl shadow-sm"><Zap className="h-4 w-4 text-primary" /></div>
                                    <CardTitle className="text-sm font-black uppercase tracking-tight">Login Velocity</CardTitle>
                                </div>
                                <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-[10px] h-6 px-3">Real-time Pulse</Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 h-[350px]">
                            {timelineData.length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={timelineData}>
                                        <CartesianGrid vertical={false} strokeDasharray="3 3" strokeOpacity={0.1} />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} fontSize={10} tick={{ fontWeight: 'black' }} />
                                        <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                        <ChartTooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="count"
                                            stroke="hsl(var(--primary))"
                                            strokeWidth={4}
                                            dot={{ fill: 'hsl(var(--primary))', strokeWidth: 2, r: 4 }}
                                            activeDot={{ r: 8, strokeWidth: 0 }}
                                            name="Family Joins"
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-20 gap-3">
                                    <BarChart3 className="h-12 w-12" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Collecting Engagement Data...</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Operational Details */}
                    <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-muted/10 border-b pb-6 px-8 pt-8">
                            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                                <CalendarCheck className="h-4 w-4" /> Session Blueprint
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-8 space-y-8">
                            <DetailRow label="Scheduled Implementation" value={format(new Date(meeting.meetingTime), 'PPPP')} sub={format(new Date(meeting.meetingTime), 'p')} icon={Clock} />
                            <DetailRow label="Institutional Binding" value={meeting.schoolName || 'N/A'} sub="Active Campus Context" icon={Building} />
                            <Separator />
                            <div className="pt-2">
                                <Button asChild variant="outline" className="w-full rounded-xl font-black h-12 uppercase text-[10px] tracking-widest border-primary/20 text-primary gap-2">
                                    <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer">
                                        Join Active Room <ArrowRight className="h-3.5 w-3.5" />
                                    </a>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Attendee Registry */}
                <Card className="rounded-[2.5rem] border-none ring-1 ring-border shadow-sm overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 p-8 border-b border-primary/10">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Contact className="h-5 w-5" /></div>
                                <div>
                                    <CardTitle className="text-xl font-black uppercase tracking-tight">Family Attendance Ledger</CardTitle>
                                    <CardDescription className="text-xs font-bold uppercase tracking-widest text-primary/60">Verified institutional log of session participants.</CardDescription>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader className="bg-muted/30">
                                <TableRow>
                                    <TableHead className="pl-8 py-5 text-[10px] font-black uppercase tracking-widest">Parent / Guardian Identity</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Enrolled Children</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Session Ingress</TableHead>
                                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase tracking-widest">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingAttendees ? (
                                    Array.from({ length: 3 }).map((_, i) => (
                                        <TableRow key={i}>
                                            <TableCell className="pl-8"><Skeleton className="h-4 w-40" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-64" /></TableCell>
                                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                                            <TableCell className="text-right pr-8"><Skeleton className="h-6 w-12 ml-auto rounded-full" /></TableCell>
                                        </TableRow>
                                    ))
                                ) : attendees && attendees.length > 0 ? (
                                    attendees.map((a) => (
                                        <TableRow key={a.id} className="group hover:bg-muted/30 transition-colors">
                                            <TableCell className="pl-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center font-black text-primary border shadow-sm group-hover:bg-primary group-hover:text-white transition-colors">{a.parentName.substring(0, 2).toUpperCase()}</div>
                                                    <span className="font-black text-sm uppercase tracking-tight text-foreground">{a.parentName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {a.childrenNames?.map((child, idx) => (
                                                        <Badge key={idx} variant="secondary" className="bg-muted/50 border-none font-bold text-[9px] uppercase tracking-tighter text-foreground/70 h-5">
                                                            {child}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-[10px] font-black text-muted-foreground uppercase tabular-nums">
                                                {format(new Date(a.joinedAt), 'MMM d, HH:mm:ss')}
                                            </TableCell>
                                            <TableCell className="text-right pr-8">
                                                <Badge className="bg-emerald-500 text-white border-none text-[8px] h-5 uppercase px-2 font-black gap-1 shadow-sm"><CheckCircle2 size={10} /> Verified</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-64 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 opacity-20">
                                                <Users className="h-12 w-12" />
                                                <p className="text-xs font-black uppercase tracking-widest text-foreground">Waiting for participants...</p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

function StatCard({ label, value, sub, icon: Icon, color, bg }: { label: string, value: string | number, sub: string, icon: any, color: string, bg: string }) {
    return (
        <Card className="rounded-[2rem] border-none ring-1 ring-border shadow-sm bg-white overflow-hidden group hover:ring-primary/20 transition-all text-left">
            <CardContent className="p-6 flex items-center gap-5">
                <div className={cn("p-4 rounded-2xl shrink-0 transition-transform group-hover:scale-110 shadow-inner", bg, color)}>
                    <Icon className="h-7 w-7" />
                </div>
                <div className="text-left">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1.5">{label}</p>
                    <p className="text-2xl font-black tabular-nums tracking-tighter leading-none">{value}</p>
                    <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter mt-1">{sub}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function DetailRow({ label, value, sub, icon: Icon }: { label: string, value: string, sub: string, icon: any }) {
    return (
        <div className="flex gap-4 group text-left">
            <div className="p-2.5 bg-muted rounded-xl transition-transform group-hover:scale-110 shrink-0 h-fit mt-1"><Icon className="h-4 w-4 text-muted-foreground" /></div>
            <div className="space-y-0.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 leading-none">{label}</p>
                <p className="text-sm font-black uppercase tracking-tight text-foreground leading-tight">{value}</p>
                <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">{sub}</p>
            </div>
        </div>
    );
}
