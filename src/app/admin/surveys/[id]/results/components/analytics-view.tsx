
'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, SurveyResponse, SurveySession } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend, LineChart, Line, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { Target, MousePointer2, AlertCircle, TrendingDown, UserMinus, ShieldCheck, User as UserIcon, Award, Activity, Users, Trophy, BarChart3, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from "@/components/ui/progress";
import { motion, type Variants } from 'framer-motion';

import {
    CHART_COLORS,
    type AnalyzedResult,
    type FunnelStep,
    type DropoffInsight,
    type AttributionRow,
    computeFunnelData,
    computeDropoffInsights,
    computeScoringMetrics,
    analyzeQuestions,
    computeAttribution,
} from '@/lib/survey-analytics-utils';

// ─── Animation Variants ────────────────────────────────────────────────────────

const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 12 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.06, duration: 0.4, ease: 'easeOut' as const },
    }),
};

// ─── Time Granularity Types ────────────────────────────────────────────────────

type TimeGranularity = 'hour' | 'day' | 'month';

function computeResponseTrend(responses: SurveyResponse[], granularity: TimeGranularity): { label: string; count: number }[] {
    if (!responses || responses.length === 0) return [];

    const bucketMap = new Map<string, number>();

    responses.forEach(res => {
        const date = new Date(res.submittedAt);
        let key: string;
        switch (granularity) {
            case 'hour':
                key = format(date, 'MMM d, ha');
                break;
            case 'day':
                key = format(date, 'MMM d');
                break;
            case 'month':
                key = format(date, 'MMM yyyy');
                break;
        }
        bucketMap.set(key, (bucketMap.get(key) || 0) + 1);
    });

    return Array.from(bucketMap.entries()).map(([label, count]) => ({ label, count }));
}

// ─── Response Trend Chart ──────────────────────────────────────────────────────

function ResponseTrendChart({ responses }: { responses: SurveyResponse[] }) {
    const [granularity, setGranularity] = React.useState<TimeGranularity>('day');
    const trendData = React.useMemo(() => computeResponseTrend(responses, granularity), [responses, granularity]);

    const granularityOptions: { value: TimeGranularity; label: string }[] = [
        { value: 'hour', label: 'Per Hour' },
        { value: 'day', label: 'Per Day' },
        { value: 'month', label: 'Per Month' },
    ];

    return (
        <Card className="bg-card/60 backdrop-blur-md border-border/40">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" /> Response Trend
                    </CardTitle>
                    <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
                        {granularityOptions.map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setGranularity(opt.value)}
                                className={cn(
                                    "px-2.5 py-1 text-[10px] font-bold rounded-md transition-all",
                                    granularity === opt.value
                                        ? "bg-primary text-primary-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="h-[250px] pt-2">
                {trendData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs italic">No data yet.</div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                            <YAxis axisLine={false} tickLine={false} fontSize={9} tick={{ fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                            <Tooltip
                                cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-background border rounded-lg p-2.5 shadow-xl text-xs">
                                                <p className="font-semibold">{label}</p>
                                                <p className="text-primary font-bold">{payload[0].value} Responses</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Line
                                type="monotone"
                                dataKey="count"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2.5}
                                dot={{ r: 3, fill: 'hsl(var(--primary))', strokeWidth: 0 }}
                                activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </CardContent>
        </Card>
    );
}

const CustomizedBarLabel = (props: any) => {
    const { x, y, width, value, percentage } = props;
    const isInside = width > 80;
    
    return (
        <text 
            x={isInside ? x + width - 5 : x + width + 5} 
            y={y + 16} 
            fill={isInside ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"} 
            textAnchor={isInside ? "end" : "start"} 
 className="text-[10px] font-bold"
        >
            {`${percentage.toFixed(0)}% (${value})`}
        </text>
    );
};

function QuestionResult({ result, index }: { result: AnalyzedResult, index: number }) {
    const total = result.type !== 'unknown' ? result.total : 0;
    
    return (
 <Card className="flex flex-col transition-shadow hover:shadow-md">
 <CardHeader className="p-4 md:p-6 pb-2">
 <div className="flex items-start justify-between gap-4">
 <CardTitle className="text-base font-semibold flex-1">
                        {index + 1}. {result.question.title}
                    </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">{total} {total === 1 ? 'response' : 'responses'}</p>
                {result.insight && (
 <p className="text-sm text-muted-foreground pt-2 italic">
                        &ldquo;{result.insight}&rdquo;
                    </p>
                )}
            </CardHeader>
 <CardContent className="p-4 md:p-6 pt-2 flex-grow flex flex-col justify-center">
                {result.type === 'chart' && <ChartResult result={result} />}
                {result.type === 'rating' && <ChartResult result={result} />}
                {result.type === 'checkbox' && <CheckboxResult result={result} />}
                {result.type === 'text' && <TextResult result={result} />}
 {result.type === 'unknown' && <p className="text-center text-muted-foreground py-4 text-xs italic">Unsupported question type.</p>}
            </CardContent>
        </Card>
    );
}

function ChartResult({ result }: { result: Extract<AnalyzedResult, { type: 'chart' | 'rating' }> }) {
 if (result.total === 0) return <p className="text-xs text-muted-foreground text-center py-8 italic">No data.</p>;
    
    return (
 <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.data} layout="vertical" margin={{ top: 5, right: 50, left: -20, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--accent))' }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
 <div className="rounded-lg border bg-background p-2 shadow-sm text-xs">
 <p className="font-bold">{label}</p>
 <p className="text-muted-foreground">{`Count: ${payload[0].value}`}</p>
                                </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="value" barSize={24} radius={[0, 4, 4, 0]}>
                       <LabelList dataKey="value" content={(props) => <CustomizedBarLabel {...props} percentage={result.data[props.index as number].percentage} />} />
                       {result.data.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                       ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function CheckboxResult({ result }: { result: Extract<AnalyzedResult, { type: 'checkbox' }> }) {
 if (result.total === 0) return <p className="text-xs text-muted-foreground text-center py-8 italic">No data.</p>;

    return (
 <div className="space-y-3">
            {result.data.map((item, index) => (
                <div key={index}>
 <div className="flex justify-between text-[10px] font-bold text-muted-foreground mb-1">
 <span className="truncate max-w-[150px]">{item.name}</span>
                        <span>{item.value} ({item.percentage.toFixed(0)}%)</span>
                    </div>
 <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <div 
 className="h-full bg-primary transition-all"
                            style={{ width: `${item.percentage}%` }}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

function TextResult({ result }: { result: Extract<AnalyzedResult, { type: 'text' }> }) {
    return (
 <ScrollArea className="h-40 rounded-md border p-3 bg-muted/30">
            {result.data.length > 0 ? (
 <ul className="space-y-3">
                    {result.data.map((text, index) => (
 <li key={index} className="text-xs p-2 bg-background rounded-md shadow-sm border">{text}</li>
                    ))}
                </ul>
            ) : (
 <p className="text-xs text-muted-foreground text-center py-8 italic">No text responses.</p>
            )}
        </ScrollArea>
    );
}

/**
 * Component to display the representative performance leaderboard
 */
function RepresentativeLeaderboard({ data }: { data: any[] }) {
    return (
        <Card className="flex flex-col h-full border-none ring-1 ring-border shadow-sm">
            <CardHeader className="bg-muted/10 border-b pb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600">
                        <Award className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-semibold tracking-tight">Representative Performance</CardTitle>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto max-h-[400px]">
                {data.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-center opacity-30 p-8 grayscale">
                        <Activity className="h-10 w-10 mb-2" />
                        <p className="text-[10px] font-bold tracking-tight">No Attribution Data Yet</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                                <TableHead className="text-[9px] font-black uppercase py-4 pl-6">Representative</TableHead>
                                <TableHead className="text-[9px] font-black uppercase py-4 text-center">Responses</TableHead>
                                <TableHead className="text-[9px] font-black uppercase py-4 text-center">CRM Leads</TableHead>
                                <TableHead className="text-[9px] font-black uppercase py-4 text-right pr-6">Yield Rate</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.map((row, idx) => (
                                <TableRow key={idx} className="group transition-all hover:bg-blue-50/30">
                                    <TableCell className="py-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                                                <UserIcon className="h-4 w-4 text-blue-600" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-foreground">{row.name}</span>
                                                <span className="text-[9px] text-muted-foreground font-bold tracking-tighter italic">Unique Link Source</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        <span className="text-xs font-bold">{row.responses}</span>
                                    </TableCell>
                                    <TableCell className="text-center py-4">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <ShieldCheck className="h-3 w-3 text-emerald-500" />
                                            <span className="text-xs font-black text-emerald-600">{row.leads}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-4 pr-6">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className={cn(
                                                "text-[10px] font-black px-2 py-0.5 rounded-md",
                                                row.yield === 100 ? "bg-emerald-500 text-white" : "bg-blue-500/10 text-blue-600"
                                            )}>
                                                {row.yield}%
                                            </span>
                                            <Progress value={row.yield} className="h-1 w-16" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

// ─── Reusable Stat Card (React.memo for re-render optimization) ────────────

type StatCardProps = {
    label: string;
    value: string | number;
    icon: React.ElementType;
    iconClassName: string;
    index?: number;
};

const StatCard = React.memo(function StatCard({ label, value, icon: Icon, iconClassName, index = 0 }: StatCardProps) {
    return (
        <motion.div custom={index} variants={fadeInUp} initial="hidden" animate="visible">
            <Card className="bg-card/60 backdrop-blur-md border-border/40 shadow-sm hover:shadow-lg transition-shadow">
                <CardContent className="p-4 flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl", iconClassName)}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">{label}</p>
                        <p className="text-2xl font-semibold">{value}</p>
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
});

export default function AnalyticsView({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
    const firestore = useFirestore();

    // Fetch Team for resolution
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
    }, [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    // Fetch Sessions for Drop-off Analytics
    const sessionsQuery = useMemoFirebase(() => {
        if (!firestore || !survey?.id || typeof survey.id !== 'string') return null;
        return query(collection(firestore, 'survey_sessions'), where('surveyId', '==', survey.id));
    }, [firestore, survey?.id]);
    const { data: sessions } = useCollection<SurveySession>(sessionsQuery);

    // Delegated computations (extracted for testability & performance)
    const funnelData = React.useMemo(() => sessions ? computeFunnelData(survey, sessions) : [], [sessions, survey]);
    const dropoffInsights = React.useMemo(() => computeDropoffInsights(funnelData), [funnelData]);
    const scoringMetrics = React.useMemo(() => computeScoringMetrics(survey, responses), [survey, responses]);
    const analyzedResults = React.useMemo(() => analyzeQuestions(survey, responses), [survey, responses]);
    const attributionData = React.useMemo(() => computeAttribution(responses, users), [responses, users]);
    const totalLeads = React.useMemo(() => responses.filter(r => r.entityId).length, [responses]);

    return (
 <div className="space-y-8">
            
            {/* Top Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard index={0} label="Submissions" value={responses.length} icon={Users} iconClassName="bg-primary/10 text-primary" />
                <StatCard index={1} label="CRM Leads Gen." value={totalLeads} icon={ShieldCheck} iconClassName="bg-emerald-500/10 text-emerald-600" />
                <StatCard index={2} label="Total Visits" value={sessions?.length || 0} icon={MousePointer2} iconClassName="bg-orange-500/10 text-orange-600" />
                {survey.scoringEnabled && scoringMetrics && (
                    <>
                        <StatCard index={3} label="Avg. Score" value={scoringMetrics.avg.toFixed(1)} icon={Trophy} iconClassName="bg-green-500/10 text-green-600" />
                        <motion.div custom={4} variants={fadeInUp} initial="hidden" animate="visible">
                            <Card className="bg-card/60 backdrop-blur-md border-border/40 shadow-sm hover:shadow-lg transition-shadow">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-600"><Target className="h-5 w-5" /></div>
                                    <div className="flex-grow">
                                        <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Lead Yield Rate</p>
                                        <div className="flex items-center gap-3">
                                            <div className="h-2 flex-grow bg-secondary rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-600 transition-all duration-1000" style={{ width: `${responses.length > 0 ? (totalLeads / responses.length) * 100 : 0}%` }} />
                                            </div>
                                            <span className="text-sm font-bold">{responses.length > 0 ? ((totalLeads / responses.length) * 100).toFixed(0) : 0}%</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    </>
                )}
            </div>

            {/* Response Trend Over Time */}
            <ResponseTrendChart responses={responses} />

            {/* DROP-OFF ANALYTICS FUNNEL */}
            {funnelData.length > 1 && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <Card className="lg:col-span-2">
                        <CardHeader>
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 <TrendingDown className="h-4 w-4 text-orange-500" /> Progression Funnel
                            </CardTitle>

                        </CardHeader>
 <CardContent className="h-[300px] p-8">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={funnelData} layout="vertical" margin={{ top: 0, right: 100, left: 20, bottom: 0 }}>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="label" type="category" axisLine={false} tickLine={false} fontSize={10} width={100} tick={{ fontWeight: 'bold' }} />
                                    <Tooltip 
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                const d = payload[0].payload;
                                                return (
 <div className="bg-background border rounded-lg p-3 shadow-2xl text-xs space-y-1">
 <p className="font-semibold ">{d.label}</p>
 <p className="text-primary font-bold">{d.count} Sessions Reached</p>
 <p className="text-muted-foreground">{d.percentage.toFixed(1)}% of total traffic</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={32}>
                                        {funnelData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} fillOpacity={0.8} />
                                        ))}
                                        <LabelList 
                                            dataKey="count" 
                                            position="right" 
                                            content={(props: any) => {
                                                const { x, y, width, height, value, index } = props;
                                                const pct = funnelData[index].percentage;
                                                return (
 <text x={x + width + 10} y={y + height / 2 + 4} className="text-[10px] font-semibold tracking-tighter text-muted-foreground">
                                                        {value} ({pct.toFixed(0)}%)
                                                    </text>
                                                );
                                            }}
                                        />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

 <Card className="flex flex-col">
                        <CardHeader>
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 <AlertCircle className="h-4 w-4 text-rose-500" /> High Drop-off Audit
                            </CardTitle>

                        </CardHeader>
 <CardContent className="flex-1 overflow-hidden">
                            {dropoffInsights.length > 0 ? (
                                <Table>
                                    <TableHeader>
 <TableRow className="hover:bg-transparent bg-muted/30">
 <TableHead className="text-[9px] font-semibold ">Transition</TableHead>
 <TableHead className="text-right text-[9px] font-semibold ">Loss %</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {dropoffInsights.slice(0, 5).map((insight, idx) => (
 <TableRow key={idx} className="group transition-colors">
 <TableCell className="py-3">
 <p className="text-[10px] font-bold text-foreground leading-tight">{insight.from} → {insight.to}</p>
 <p className="text-[9px] text-muted-foreground mt-0.5">{insight.lost} Users Lost</p>
                                                </TableCell>
 <TableCell className="text-right py-3">
                                                    <Badge variant="outline" className={cn(
                                                        "h-5 text-[9px] font-semibold uppercase border-none",
                                                        insight.lossPercentage > 30 ? "bg-rose-50 text-rose-600" : "bg-orange-50 text-orange-600"
                                                    )}>
                                                        {insight.lossPercentage.toFixed(0)}%
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
 <div className="h-full flex flex-col items-center justify-center text-center opacity-30 p-8">
 <UserMinus className="h-10 w-10 mb-2" />
 <p className="text-[10px] font-semibold ">Optimal Retention</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Score & Outcome Visualizations */}
            {survey.scoringEnabled && scoringMetrics && scoringMetrics.outcomeData && scoringMetrics.outcomeData.length > 0 && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <Card className="lg:col-span-2">
                        <CardHeader>
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 <BarChart3 className="h-4 w-4" /> Outcome Distribution
                            </CardTitle>

                        </CardHeader>
 <CardContent className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={scoringMetrics.outcomeData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={10} interval={0} />
                                    <YAxis axisLine={false} tickLine={false} fontSize={10} />
                                    <Tooltip 
                                        cursor={{ fill: 'transparent' }}
                                        content={({ active, payload }) => {
                                            if (active && payload && payload.length) {
                                                return (
 <div className="bg-background border rounded-lg p-2 shadow-xl text-xs">
 <p className="font-semibold">{payload[0].payload.name}</p>
 <p className="text-primary">{payload[0].value} Respondents</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={40}>
                                        {scoringMetrics.outcomeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                        <LabelList dataKey="value" position="top" style={{ fontSize: '10px', fontWeight: 'bold' }} />
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                    
                    <Card>
                        <CardHeader>
 <CardTitle className="text-sm font-semibold ">Share of Outcomes</CardTitle>
                        </CardHeader>
 <CardContent className="h-64 relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={scoringMetrics.outcomeData}
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {scoringMetrics.outcomeData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend verticalAlign="bottom" align="center" iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                                </PieChart>
                            </ResponsiveContainer>
 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-[-20px]">
 <span className="text-2xl font-semibold">{responses.length}</span>
 <span className="text-[8px] font-bold text-muted-foreground ">Total</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Phase 4: Attribution Leaderboard */}
            <div className="grid grid-cols-1 gap-6">
                <RepresentativeLeaderboard data={attributionData} />
            </div>

            {/* Question by Question Breakdown */}
 <div className="space-y-4">
 <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
 <BarChart3 className="h-5 w-5 text-primary" /> Detailed Question Analysis
                </h3>
 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {analyzedResults.map((result, index) => (
                        <QuestionResult key={result.question.id} result={result} index={index} />
                    ))}
                </div>
            </div>
        </div>
    );
}
