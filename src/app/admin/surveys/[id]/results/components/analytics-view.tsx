'use client';

import * as React from 'react';
import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const CHART_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

type AnalyzedResult = {
    question: SurveyQuestion;
    totalScore?: number;
    averageScore?: number;
} & (
    | { type: 'chart'; data: { name: string; value: number; percentage: number }[]; total: number }
    | { type: 'rating'; data: { name: string; value: number; percentage: number }[]; total: number, average: number }
    | { type: 'checkbox'; data: { name: string; value: number; percentage: number }[]; otherText: string[]; total: number }
    | { type: 'text'; data: string[]; total: number }
    | { type: 'unknown'; data: any[] }
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <p className="text-sm font-medium">{`${label}`}</p>
        <p className="text-sm text-muted-foreground">{`Count: ${data.value} (${data.percentage.toFixed(1)}%)`}</p>
      </div>
    );
  }
  return null;
};

function ChartResult({ result }: { result: Extract<AnalyzedResult, { type: 'chart' }> }) {
    if (result.total === 0) return <p className="text-sm text-muted-foreground text-center py-8">No responses for this question yet.</p>;
    
    return (
        <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.data} layout="vertical" margin={{ left: 20, right: 30 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))' }}/>
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {result.data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

function RatingResult({ result }: { result: Extract<AnalyzedResult, { type: 'rating' }> }) {
    if (result.total === 0) return <p className="text-sm text-muted-foreground text-center py-8">No responses for this question yet.</p>;
    
    return (
        <div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.data} layout="vertical" margin={{ left: 20, right: 30 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={80} tick={{ fontSize: 12 }} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent))' }}/>
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                            {result.data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
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
                        <span className="text-muted-foreground">{item.value} response(s) ({item.percentage.toFixed(1)}%)</span>
                    </div>
                    <Progress value={item.percentage} />
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
            const questionResponses = responses.map(res => res.answers.find(a => a.questionId === question.id)?.value).filter(v => v !== undefined && v !== null);
            let scoreData: { totalScore?: number, averageScore?: number } = {};
            if (question.enableScoring || question.type === 'rating') {
                let totalScore = 0;
                let scoredResponses = 0;
                questionResponses.forEach(value => {
                    let responseScore = 0;
                    let hasScore = false;
                    if (question.type === 'yes-no' && question.enableScoring) {
                        if (value === 'Yes') { responseScore = question.yesScore ?? 0; hasScore = true; }
                        if (value === 'No') { responseScore = question.noScore ?? 0; hasScore = true; }
                    } else if ((question.type === 'multiple-choice' || question.type === 'dropdown') && question.enableScoring) {
                        if (question.options && question.optionScores) {
                            const optionIndex = question.options.indexOf(value as string);
                            if (optionIndex > -1 && question.optionScores[optionIndex] !== undefined) {
                                responseScore = question.optionScores[optionIndex];
                                hasScore = true;
                            }
                        }
                    } else if (question.type === 'checkboxes' && question.enableScoring) {
                        const selectedOptions = (value as any)?.options || value as string[];
                        if (Array.isArray(selectedOptions)) {
                            hasScore = true;
                            selectedOptions.forEach(optionLabel => {
                                const optionIndex = (question.options || []).indexOf(optionLabel);
                                if (optionIndex > -1 && question.optionScores && question.optionScores[optionIndex] !== undefined) {
                                    responseScore += question.optionScores[optionIndex];
                                }
                            });
                        }
                    } else if (question.type === 'rating' && typeof value === 'number') {
                         responseScore = value;
                         hasScore = true;
                    }
    
                    if (hasScore) {
                        totalScore += responseScore;
                        scoredResponses++;
                    }
                });
                scoreData.totalScore = totalScore;
                scoreData.averageScore = scoredResponses > 0 ? totalScore / scoredResponses : 0;
            }
    
            if (question.type === 'yes-no' || question.type === 'multiple-choice' || question.type === 'dropdown') {
                const options = question.type === 'yes-no' ? ['Yes', 'No'] : question.options || [];
                const counts = Object.fromEntries(options.map(opt => [opt, 0]));
                questionResponses.forEach(value => { if (typeof value === 'string' && value in counts) counts[value]++; });
                const total = questionResponses.length;
                const data = Object.entries(counts).map(([name, value]) => ({ name, value, percentage: total > 0 ? (value / total) * 100 : 0 }));
                return { question, type: 'chart', data, total, ...scoreData };
            }
    
            if (question.type === 'checkboxes') {
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
                return { question, type: 'checkbox', data, otherText, total: totalRespondents, ...scoreData };
            }
            
            if (question.type === 'text' || question.type === 'long-text' || question.type === 'date' || question.type === 'time') {
                const textResponses = questionResponses.filter(v => typeof v === 'string' && v.trim().length > 0) as string[];
                return { question, type: 'text', data: textResponses, total: textResponses.length, ...scoreData };
            }
    
            if (question.type === 'rating') {
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
                const data = Object.entries(counts).map(([name, value]) => ({ name: `${name} Star`, value, percentage: total > 0 ? (value / total) * 100 : 0 }));
                return { question, type: 'rating', data, total, average, ...scoreData };
            }
    
            return { question, type: 'unknown', data: [], ...scoreData };
        });
    }, [survey, responses]);

    return (
        <div className="space-y-10">
            <Card className="w-fit rounded-xl shadow-md">
                <CardHeader className="p-5">
                    <CardTitle className="text-base">Total Responses</CardTitle>
                </CardHeader>
                <CardContent className="p-5 pt-0">
                    <p className="text-4xl font-bold">{responses?.length ?? 0}</p>
                </CardContent>
            </Card>
            {analyzedResults.map((result) => (
                <Card key={result.question.id} className="rounded-xl shadow-md overflow-hidden">
                    <CardHeader className="pb-4">
                        <CardTitle>{survey.elements.filter(isQuestion).findIndex(q => q.id === result.question.id) + 1}. {result.question.title}</CardTitle>
                        <CardDescription>{result.total} {result.total === 1 ? 'response' : 'responses'}</CardDescription>
                    </CardHeader>
                    {(result.question.enableScoring || result.question.type === 'rating') && result.averageScore !== undefined && (
                        <CardContent className="border-t pt-4">
                            <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Score Summary</h4>
                            <div className="flex gap-8">
                                <div><p className="text-sm text-muted-foreground">Total Score</p><p className="text-2xl font-bold">{result.totalScore}</p></div>
                                <div><p className="text-sm text-muted-foreground">Average Score</p><p className="text-2xl font-bold">{result.averageScore.toFixed(2)}</p></div>
                            </div>
                        </CardContent>
                    )}
                    <CardContent className="pt-2">
                        {result.type === 'chart' && <ChartResult result={result} />}
                        {result.type === 'rating' && <RatingResult result={result} />}
                        {result.type === 'checkbox' && <CheckboxResult result={result} />}
                        {result.type === 'text' && <TextResult result={result} />}
                        {result.type === 'unknown' && <p>This question type is not supported for analysis.</p>}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
