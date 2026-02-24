'use client';

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement, SurveyResultRule } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList, PieChart, Pie, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { Trophy, Users, BarChart3, Target } from 'lucide-react';

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

const generateInsight = (result: Omit<AnalyzedResult, 'insight'>): string => {
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
    return (
        <Card className="flex flex-col transition-shadow hover:shadow-md">
            <CardHeader className="p-4 md:p-6 pb-2">
                <div className="flex items-start justify-between gap-4">
                    <CardTitle className="text-base font-semibold flex-1">
                        {index + 1}. {result.question.title}
                    </CardTitle>
                </div>
                <CardDescription className="text-xs">{result.total} {result.total === 1 ? 'response' : 'responses'}</CardDescription>
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
                    <div className="flex justify-between text-[10px] uppercase font-bold text-muted-foreground mb-1">
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

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

export default function AnalyticsView({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
    
    // 1. Scoring Analytics
    const scoringMetrics = React.useMemo(() => {
        if (!survey.scoringEnabled || responses.length === 0) return null;
        
        const scores = responses.map(r => r.score || 0);
        const total = scores.reduce((a, b) => a + b, 0);
        const avg = total / responses.length;
        
        // Outcome breakdown
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

    // 2. Question-by-Question Analytics
    const analyzedResults: AnalyzedResult[] = React.useMemo(() => {
        if (!survey || !responses) return [];
        const questions = survey.elements.filter(isQuestion);
        return questions.map(question => {
            const questionResponses = responses.map(res => res.answers.find(a => a.questionId === question.id)?.value).filter(v => v !== undefined && v !== null && v !== '');
            let scoreData: { totalScore?: number, averageScore?: number } = {};
            
            let tempResult: Omit<AnalyzedResult, 'insight'>;

            if (question.type === 'yes-no' || question.type === 'multiple-choice' || question.type === 'dropdown') {
                const options = question.type === 'yes-no' ? ['Yes', 'No'] : question.options || [];
                const counts = Object.fromEntries(options.map(opt => [opt, 0]));
                questionResponses.forEach(value => { if (typeof value === 'string' && value in counts) counts[value]++; });
                const total = questionResponses.length;
                const data = Object.entries(counts).map(([name, value]) => ({ name, value, percentage: total > 0 ? (value / total) * 100 : 0 }));
                tempResult = { question, type: 'chart', data, total, ...scoreData };
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
                tempResult = { question, type: 'checkbox', data, otherText, total: totalRespondents, ...scoreData };
            } else if (question.type === 'text' || question.type === 'long-text' || question.type === 'date' || question.type === 'time') {
                const textResponses = questionResponses.filter(v => typeof v === 'string' && v.trim().length > 0) as string[];
                tempResult = { question, type: 'text', data: textResponses, total: textResponses.length, ...scoreData };
            } else if (question.type === 'rating') {
                const ratingResponses = questionResponses.filter(v => typeof v === 'number' && v >= 1 && v <= 5) as number[];
                const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
                let totalScore = 0;
                ratingResponses.forEach(rating => {
                    if (rating >= 1 && rating <= 5) {
                        counts[rating as keyof typeof counts]++;
                        totalScore += rating;
                    }
                });
                const total = ratingResponses.length;
                const average = total > 0 ? totalScore / total : 0;
                const data = Object.entries(counts).map(([name, value]) => ({ name: `${name} ★`, value, percentage: total > 0 ? (value / total) * 100 : 0 }));
                tempResult = { question, type: 'rating', data, total, average, ...scoreData };
            } else {
                 tempResult = { question, type: 'unknown', data: [], ...scoreData };
            }

            const insight = generateInsight(tempResult);
            return { ...tempResult, insight };
        });
    }, [survey, responses]);

    return (
        <div className="space-y-8">
            
            {/* Top Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-card shadow-sm">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="bg-primary/10 p-2.5 rounded-xl"><Users className="h-5 w-5 text-primary" /></div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Responses</p>
                            <p className="text-2xl font-black">{responses.length}</p>
                        </div>
                    </CardContent>
                </Card>
                {survey.scoringEnabled && scoringMetrics && (
                    <>
                        <Card className="bg-card shadow-sm">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="bg-green-500/10 p-2.5 rounded-xl"><Trophy className="h-5 w-5 text-green-600" /></div>
                                <div>
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Avg. Score</p>
                                    <p className="text-2xl font-black">{scoringMetrics.avg.toFixed(1)} <span className="text-xs text-muted-foreground font-normal">/ {survey.maxScore}</span></p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="bg-card shadow-sm md:col-span-2">
                            <CardContent className="p-4 flex items-center gap-4">
                                <div className="bg-purple-500/10 p-2.5 rounded-xl"><Target className="h-5 w-5 text-purple-600" /></div>
                                <div className="flex-grow">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Performance Efficiency</p>
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 flex-grow bg-secondary rounded-full overflow-hidden">
                                            <div className="h-full bg-purple-600" style={{ width: `${(scoringMetrics.avg / (survey.maxScore || 100)) * 100}%` }} />
                                        </div>
                                        <span className="text-sm font-bold">{((scoringMetrics.avg / (survey.maxScore || 100)) * 100).toFixed(0)}%</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* Score & Outcome Visualizations */}
            {survey.scoringEnabled && scoringMetrics && scoringMetrics.outcomeData && scoringMetrics.outcomeData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
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
                                                        <p className="font-black">{payload[0].payload.name}</p>
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
                            <CardTitle className="text-sm font-black uppercase tracking-widest">Share of Outcomes</CardTitle>
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
                                <span className="text-2xl font-black">{responses.length}</span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase">Total</span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Question by Question Breakdown */}
            <div className="space-y-4">
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
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
