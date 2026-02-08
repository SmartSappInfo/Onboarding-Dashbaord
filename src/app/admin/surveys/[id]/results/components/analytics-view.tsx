

'use client';

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { cn } from '@/lib/utils';

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
        if (mostPopular.percentage > 50) return `Most respondents selected "${mostPopular.name}".`;
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
            y={y + 16} // Center align with bar (height is approx 32)
            fill={isInside ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"} 
            textAnchor={isInside ? "end" : "start"} 
            className="text-xs font-semibold"
        >
            {`${percentage.toFixed(0)}% (${value})`}
        </text>
    );
};

function ChartResult({ result }: { result: Extract<AnalyzedResult, { type: 'chart' | 'rating' }> }) {
    if (result.total === 0) return <p className="text-sm text-muted-foreground text-center py-8">No responses for this question yet.</p>;
    
    return (
        <div className="h-48 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.data} layout="vertical" margin={{ top: 5, right: 50, left: 10, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={100} tick={{ fontSize: 12 }} dx={-5} />
                    <Tooltip
                        cursor={{ fill: 'hsl(var(--accent))' }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                return (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <p className="text-sm font-medium">{label}</p>
                                    <p className="text-sm text-muted-foreground">{`Count: ${payload[0].value}`}</p>
                                </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="value" barSize={32} radius={[0, 4, 4, 0]}>
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
    if (result.total === 0) return <p className="text-sm text-muted-foreground text-center py-8">No responses for this question yet.</p>;

    return (
        <div className="space-y-4">
            {result.data.map((item, index) => (
                <div key={index}>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{item.name}</span>
                        <span className="text-muted-foreground">{item.value} ({item.percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="relative h-6 w-full overflow-hidden rounded-full bg-secondary">
                        <div 
                            className="h-full flex-1 bg-primary transition-all flex items-center justify-end px-2 text-primary-foreground text-xs font-bold"
                            style={{ width: `${item.percentage}%` }}
                        >
                           {item.percentage > 15 && `${item.percentage.toFixed(0)}%`}
                        </div>
                    </div>
                </div>
            ))}
            {result.otherText.length > 0 && (
                <div className="pt-4">
                    <h4 className="font-semibold text-sm mb-2">"Other" responses:</h4>
                    <ScrollArea className="h-40 rounded-md border p-3">
                        <ul className="list-disc list-inside space-y-2">
                            {result.otherText.map((text, i) => <li key={i} className="text-sm">{text}</li>)}
                        </ul>
                    </ScrollArea>
                </div>
            )}
        </div>
    )
}

function TextResult({ result }: { result: Extract<AnalyzedResult, { type: 'text' }> }) {
    return (
        <ScrollArea className="h-60 rounded-md border p-4">
            {result.data.length > 0 ? (
                <ul className="space-y-4">
                    {result.data.map((text, index) => (
                        <li key={index} className="text-sm border-b pb-2">{text}</li>
                    ))}
                </ul>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No text responses submitted for this question.</p>
            )}
        </ScrollArea>
    );
}

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

export default function AnalyticsView({ survey, responses }: { survey: Survey; responses: SurveyResponse[] }) {
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
                    const selectedOptions = (value as any)?.options || value;
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
        <div className="space-y-6">
            <Card className="w-fit">
                <CardHeader className="p-4">
                    <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                    <p className="text-3xl font-bold">{responses?.length ?? 0}</p>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {analyzedResults.map((result, index) => (
                    <Card key={result.question.id} className="flex flex-col transition-shadow hover:shadow-md">
                        <CardHeader className="p-4 md:p-6 pb-2">
                           <div className="flex items-start justify-between gap-4">
                                <CardTitle className="text-base font-semibold flex-1">
                                    {index + 1}. {result.question.title}
                                </CardTitle>
                                {result.question.enableScoring && result.averageScore !== undefined && (
                                     <div className="text-right">
                                        <div className="text-xs text-muted-foreground">Avg. Score</div>
                                        <div className="text-lg font-bold text-primary">{result.averageScore.toFixed(2)}</div>
                                    </div>
                                )}
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
                            {result.type === 'unknown' && <p className="text-center text-muted-foreground py-4">This question type is not supported for analysis.</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}

