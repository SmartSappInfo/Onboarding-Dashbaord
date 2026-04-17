
'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement, SurveyResultRule, SurveySession } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { Target, MousePointer2, AlertCircle, TrendingDown, UserMinus, ShieldCheck, User as UserIcon, Award, Activity, Users, Trophy } from 'lucide-react';
import { BarChart3 } from 'lucide-react';
import { ChartConfig, ChartContainer, ChartTooltip } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from "@/components/ui/progress";

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type AnalyzedResult = {
    question: SurveyQuestion;
    insight: string;
    totalScore?: number;
    averageScore?: number;
} & (
    | { type: 'chart'; data: { name: string; value: number; percentage: number }[]; total: number }
    | { type: 'rating'; data: { name: string; value: number; percentage: number }[]; total: number, average: number }
    | { type: 'checkbox'; data: { name: string; value: number; percentage: number }[]; otherText: string[]; total: number }
    | { type: 'text'; data: string[]; total: number }
    | { type: 'unknown'; data: any[] }
);

const generateInsight = (result: AnalyzedResult): string => {
    if (result.type === 'chart' && result.data.length > 0) {
        const sorted = [...result.data].sort((a, b) => b.value - a.value);
        const mostPopular = sorted[0];
        if (mostPopular.value === result.total && result.total > 0) return `All respondents selected "${mostPopular.name}".`;
        if (result.total > 0) return `The most common answer was "${mostPopular.name}".`;
    }
    if (result.type === 'rating' && result.total > 0) {
        if (result.average > 4) return `The average rating of ${result.average.toFixed(1)} stars indicates a highly positive response.`;
        if (result.average > 2.5) return `The average rating was ${result.average.toFixed(1)} stars.`;
        return `The average rating of ${result.average.toFixed(1)} stars indicates room for improvement.`;
    }
    if (result.type === 'checkbox' && result.data.length > 0) {
        const sorted = [...result.data].sort((a, b) => b.value - a.value);
        const mostPopular = sorted[0];
        if (mostPopular.percentage > 50) return `"${mostPopular.name}" was the most frequently selected option.`;
    }
    if (result.type === 'text' && result.total > 0) {
        return `Received ${result.total} text ${result.total === 1 ? 'response' : 'responses'}.`;
    }
    return '';
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
 <CardDescription className="text-xs">{total} {total === 1 ? 'response' : 'responses'}</CardDescription>
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
                        <CardDescription className="text-[10px] font-bold text-muted-foreground/60 uppercase">Attribution & Outreach Metrics</CardDescription>
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

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

export default function AnalyticsView({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
    const firestore = useFirestore();

    // Fetch Team for resolution
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), where('isAuthorized', '==', true));
    }, [firestore]);
    const { data: users } = useCollection<any>(usersQuery);

    // 1. Fetch Sessions for Drop-off Analytics
    const sessionsQuery = useMemoFirebase(() => {
        if (!firestore || !survey.id) return null;
        return query(collection(firestore, 'survey_sessions'), where('surveyId', '==', survey.id));
    }, [firestore, survey.id]);

    const { data: sessions } = useCollection<SurveySession>(sessionsQuery);

    // 2. Funnel Aggregation
    const funnelData = React.useMemo(() => {
        if (!sessions || sessions.length === 0) return [];

        const pagesCount = [];
        let pageElements: SurveyElement[][] = [];
        let currentPage: SurveyElement[] = [];
        
        if (survey.showCoverPage && survey.showSurveyTitles !== false) pageElements.push([]); 
        survey.elements.forEach(element => {
            if (element.type === 'section' && (element as any).renderAsPage && currentPage.length > 0) {
                pageElements.push(currentPage);
                currentPage = [element];
            } else currentPage.push(element);
        });
        if (currentPage.length > 0) pageElements.push(currentPage);

        return pageElements.map((page, index) => {
            const section = page[0] as any;
            const label = index === 0 && survey.showCoverPage ? 'Cover Page' : (section?.stepperTitle || section?.title || `Step ${index + 1}`);
            
            // Total sessions that reached AT LEAST this step
            const count = sessions.filter(s => s.maxStepReached >= index).length;
            
            return {
                index,
                label,
                count,
                percentage: (count / sessions.length) * 100,
                color: CHART_COLORS[index % CHART_COLORS.length]
            };
        });
    }, [sessions, survey]);

    const dropoffInsights = React.useMemo(() => {
        if (funnelData.length < 2) return [];
        const insights = [];
        for (let i = 0; i < funnelData.length - 1; i++) {
            const current = funnelData[i];
            const next = funnelData[i+1];
            const lost = current.count - next.count;
            const lossPercentage = current.count > 0 ? (lost / current.count) * 100 : 0;
            if (lossPercentage > 0) {
                insights.push({
                    from: current.label,
                    to: next.label,
                    lost,
                    lossPercentage
                });
            }
        }
        return insights.sort((a, b) => b.lossPercentage - a.lossPercentage);
    }, [funnelData]);

    // 3. Scoring Analytics
    const scoringMetrics = React.useMemo(() => {
        if (!survey.scoringEnabled || responses.length === 0) return null;
        
        const scores = responses.map(r => r.score || 0);
        const total = scores.reduce((a, b) => a + b, 0);
        const avg = total / responses.length;
        
        const ruleCounts: Record<string, number> = {};
        survey.resultRules?.forEach(rule => { ruleCounts[rule.id] = 0; });
        
        responses.forEach(res => {
            const score = res.score || 0;
            const matchedRule = survey.resultRules
                ?.sort((a, b) => a.priority - b.priority)
                .find(rule => score >= rule.minScore && score <= rule.maxScore);
            if (matchedRule) {
                ruleCounts[matchedRule.id]++;
            }
        });

        const outcomeData = survey.resultRules?.map((rule, idx) => ({
            name: rule.label,
            value: ruleCounts[rule.id],
            color: CHART_COLORS[idx % CHART_COLORS.length]
        })).filter(d => d.value > 0);

        return { avg, total, outcomeData };
    }, [survey, responses]);

    // 4. Question-by-Question Analytics
    const analyzedResults: AnalyzedResult[] = React.useMemo(() => {
        if (!survey || !responses) return [];
        const questions = survey.elements.filter(isQuestion);
        return questions.map(question => {
            const questionResponses = responses.map(res => res.answers.find(a => a.questionId === question.id)?.value).filter(v => v !== undefined && v !== null && v !== '');
            let scoreData: { totalScore?: number, averageScore?: number } = {};
            
            let result: AnalyzedResult;

            if (question.type === 'yes-no' || question.type === 'multiple-choice' || question.type === 'dropdown') {
                const options = question.type === 'yes-no' ? ['Yes', 'No'] : question.options || [];
                const counts = Object.fromEntries(options.map(opt => [opt, 0]));
                questionResponses.forEach(value => { if (typeof value === 'string' && value in counts) counts[value]++; });
                const total = questionResponses.length;
                const data = Object.entries(counts).map(([name, value]) => ({ name, value, percentage: total > 0 ? (value / total) * 100 : 0 }));
                result = { question, type: 'chart' as const, data, total, insight: '', ...scoreData };
            } else if (question.type === 'checkboxes') {
                const counts = Object.fromEntries((question.options || []).map(opt => [opt, 0]));
                if (question.allowOther) counts['Other'] = 0;
                let otherText: string[] = [];
                questionResponses.forEach((value: any) => {
                    const selectedOptions = (value as any)?.options || (Array.isArray(value) ? value : []);
                    if (Array.isArray(selectedOptions)) { selectedOptions.forEach(v => { if (v in counts) counts[v]++; }); }
                    if (value.other && value.other.trim()) {
                        if ('Other' in counts) counts['Other']++;
                        otherText.push(value.other.trim());
                    }
                });
                const totalRespondents = questionResponses.length;
                const data = Object.entries(counts).map(([name, value]) => ({ name, value, percentage: totalRespondents > 0 ? (value / totalRespondents) * 100 : 0 }));
                result = { question, type: 'checkbox' as const, data, otherText, total: totalRespondents, insight: '', ...scoreData };
            } else if (question.type === 'text' || question.type === 'long-text' || question.type === 'date' || question.type === 'time') {
                const textResponses = questionResponses.filter(v => typeof v === 'string' && v.trim().length > 0) as string[];
                result = { question, type: 'text' as const, data: textResponses, total: textResponses.length, insight: '', ...scoreData };
            } else if (question.type === 'rating') {
                const ratingResponses = questionResponses.filter(v => typeof v === 'number' && v >= 1 && v <= 5) as number[];
                const counts: Record<string, number> = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
                let totalScore = 0;
                ratingResponses.forEach(rating => {
                    if (rating >= 1 && rating <= 5) {
                        const key = String(rating);
                        counts[key]++;
                        totalScore += rating;
                    }
                });
                const total = ratingResponses.length;
                const average = total > 0 ? totalScore / total : 0;
                const data = Object.entries(counts).map(([name, value]) => ({ name: `${name} ★`, value, percentage: total > 0 ? (value / total) * 100 : 0 }));
                result = { question, type: 'rating' as const, data, total, average, insight: '', ...scoreData };
            } else {
                 result = { question, type: 'unknown' as const, data: [], insight: '', ...scoreData };
            }

            const insight = generateInsight(result);
            return { ...result, insight };
        });
    }, [survey, responses]);

    // 5. Attribution & Outreach Analytics (Phase 4)
    const attributionData = React.useMemo(() => {
        if (!responses || !users) return [];
        
        const statsMap: Record<string, { responses: number; leads: number }> = {};
        
        responses.forEach(res => {
            if (res.assignedUserId) {
                if (!statsMap[res.assignedUserId]) {
                    statsMap[res.assignedUserId] = { responses: 0, leads: 0 };
                }
                statsMap[res.assignedUserId].responses++;
                if (res.entityId) {
                    statsMap[res.assignedUserId].leads++;
                }
            }
        });

        return Object.entries(statsMap).map(([uid, stats]) => {
            const user = users.find(u => u.id === uid);
            return {
                id: uid,
                name: user?.name || user?.email || 'Team Member',
                responses: stats.responses,
                leads: stats.leads,
                yield: stats.responses > 0 ? Math.round((stats.leads / stats.responses) * 100) : 0
            };
        }).sort((a, b) => b.responses - a.responses);
    }, [responses, users]);

    const totalLeads = React.useMemo(() => responses.filter(r => r.entityId).length, [responses]);

    return (
 <div className="space-y-8">
            
            {/* Top Stats Overview */}
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
 <Card className="bg-card shadow-sm">
 <CardContent className="p-4 flex items-center gap-4">
 <div className="bg-primary/10 p-2.5 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                        <div>
 <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Submissions</p>
 <p className="text-2xl font-semibold">{responses.length}</p>
                        </div>
                    </CardContent>
                </Card>
 <Card className="bg-card shadow-sm">
  <CardContent className="p-4 flex items-center gap-4">
  <div className="bg-emerald-500/10 p-2.5 rounded-xl"><ShieldCheck className="h-5 w-5 text-emerald-600" /></div>
                        <div>
  <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">CRM Leads Gen.</p>
  <p className="text-2xl font-semibold">{totalLeads}</p>
                        </div>
                    </CardContent>
                </Card>
  <Card className="bg-card shadow-sm">
  <CardContent className="p-4 flex items-center gap-4">
  <div className="bg-orange-100 p-2.5 rounded-xl text-orange-600"><MousePointer2 className="h-5 w-5" /></div>
                        <div>
  <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Total Visits</p>
  <p className="text-2xl font-semibold">{sessions?.length || 0}</p>
                        </div>
                    </CardContent>
                </Card>
                {survey.scoringEnabled && scoringMetrics && (
                    <>
  <Card className="bg-card shadow-sm">
  <CardContent className="p-4 flex items-center gap-4">
  <div className="bg-green-500/10 p-2.5 rounded-xl"><Trophy className="h-5 w-5 text-green-600" /></div>
                                <div>
  <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Avg. Score</p>
  <p className="text-2xl font-semibold">{scoringMetrics.avg.toFixed(1)}</p>
                                </div>
                            </CardContent>
                        </Card>
  <Card className="bg-card shadow-sm">
  <CardContent className="p-4 flex items-center gap-4">
  <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-600"><Target className="h-5 w-5" /></div>
                        <div className="flex-grow">
  <p className="text-[10px] font-bold text-muted-foreground tracking-wider mb-1">Lead Yield Rate</p>
  <div className="flex items-center gap-3">
  <div className="h-2 flex-grow bg-secondary rounded-full overflow-hidden">
                                            <div 
  className="h-full bg-blue-600 transition-all duration-1000" 
                                                style={{ width: `${responses.length > 0 ? (totalLeads / responses.length) * 100 : 0}%` }} 
                                            />
                                        </div>
  <span className="text-sm font-bold">{responses.length > 0 ? ((totalLeads / responses.length) * 100).toFixed(0) : 0}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* DROP-OFF ANALYTICS FUNNEL */}
            {funnelData.length > 1 && (
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 <Card className="lg:col-span-2">
                        <CardHeader>
 <CardTitle className="text-sm font-semibold flex items-center gap-2">
 <TrendingDown className="h-4 w-4 text-orange-500" /> Progression Funnel
                            </CardTitle>
                            <CardDescription>Visualizing step-by-step participant retention.</CardDescription>
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
                            <CardDescription>Identifying critical friction points.</CardDescription>
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
                            <CardDescription>Breakdown of respondents by logic result buckets.</CardDescription>
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
