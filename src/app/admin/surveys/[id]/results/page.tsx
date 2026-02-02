'use client';

import { useParams, useRouter } from "next/navigation";
import * as React from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Survey, SurveyResponse, SurveyQuestion } from "@/lib/types";
import { doc, collection, query } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Star } from "lucide-react";
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
            <div className="flex items-center gap-2 mb-4">
                <span className="font-semibold">Average Rating:</span>
                <div className="flex items-center gap-1">
                    <span className="font-bold text-lg">{result.average.toFixed(2)}</span>
                    <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                </div>
            </div>
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


export default function SurveyResultsPage() {
    const params = useParams();
    const router = useRouter();
    const firestore = useFirestore();
    const { id: surveyId } = params;

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return doc(firestore, 'surveys', surveyId as string);
    }, [firestore, surveyId]);

    const responsesColRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return query(collection(firestore, `surveys/${surveyId}/responses`));
    }, [firestore, surveyId]);

    const { data: survey, isLoading: isSurveyLoading } = useDoc<Survey>(surveyDocRef);
    const { data: responses, isLoading: areResponsesLoading } = useCollection<SurveyResponse>(responsesColRef);

    const analyzedResults: AnalyzedResult[] = React.useMemo(() => {
        if (!survey || !responses) return [];

        return survey.questions.map(question => {
            const questionResponses = responses.map(res => res.answers.find(a => a.questionId === question.id)?.value).filter(v => v !== undefined && v !== null);

            if (question.type === 'yes-no' || question.type === 'multiple-choice' || question.type === 'dropdown') {
                const options = question.type === 'yes-no' ? ['Yes', 'No'] : question.options || [];
                const counts = Object.fromEntries(options.map(opt => [opt, 0]));

                questionResponses.forEach(value => {
                    if (typeof value === 'string' && value in counts) {
                        counts[value]++;
                    }
                });

                const total = questionResponses.length;
                const data = Object.entries(counts).map(([name, value]) => ({
                    name,
                    value,
                    percentage: total > 0 ? (value / total) * 100 : 0
                }));
                return { question, type: 'chart', data, total };
            }

            if (question.type === 'checkboxes') {
                const counts = Object.fromEntries((question.options || []).map(opt => [opt, 0]));
                if (question.allowOther) counts['Other'] = 0;
                 
                let otherText: string[] = [];

                questionResponses.forEach((value: any) => {
                    if (Array.isArray(value)) { 
                        value.forEach(v => { if (v in counts) counts[v]++; });
                    } else if (typeof value === 'object' && value !== null) {
                        (value.options || []).forEach((opt: string) => { if (opt in counts) counts[opt]++; });
                        if (value.other && value.other.trim()) {
                            if ('Other' in counts) counts['Other']++;
                            otherText.push(value.other.trim());
                        }
                    }
                });

                const totalRespondents = questionResponses.length;
                const data = Object.entries(counts).map(([name, value]) => ({
                     name,
                     value,
                     percentage: totalRespondents > 0 ? (value / totalRespondents) * 100 : 0
                }));

                return { question, type: 'checkbox', data, otherText, total: totalRespondents };
            }
            
            if (question.type === 'text' || question.type === 'long-text' || question.type === 'date' || question.type === 'time') {
                const textResponses = questionResponses.filter(v => typeof v === 'string' && v.trim().length > 0) as string[];
                return { question, type: 'text', data: textResponses, total: textResponses.length };
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
                const data = Object.entries(counts).map(([name, value]) => ({
                    name: `${name} Star`,
                    value,
                    percentage: total > 0 ? (value / total) * 100 : 0
                }));

                return { question, type: 'rating', data, total, average };
            }

            return { question, type: 'unknown', data: [] };
        });

    }, [survey, responses]);


    if (isSurveyLoading || areResponsesLoading) {
        return (
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-10 w-96 mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Card key={i}><CardHeader><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-1/4" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
                    ))}
                </div>
            </div>
        );
    }
    
    if (!survey) {
        return (
            <div className="text-center py-20">
                <p>Survey not found.</p>
                 <Button variant="outline" onClick={() => router.push('/admin/surveys')} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to Surveys
                </Button>
            </div>
        );
    }

    return (
        <div>
            <Button variant="ghost" onClick={() => router.push('/admin/surveys')} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Surveys
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">{survey.title}</h1>
            <p className="text-muted-foreground mb-2">Results & Analytics</p>
            <Card className="mb-8 w-fit">
                <CardHeader>
                    <CardTitle>Total Responses</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-4xl font-bold">{responses?.length ?? 0}</p>
                </CardContent>
            </Card>

            <div className="space-y-8">
                {analyzedResults.map((result, index) => (
                    <Card key={result.question.id}>
                        <CardHeader>
                            <CardTitle>{index + 1}. {result.question.title}</CardTitle>
                             <CardDescription>
                                {result.total} {result.total === 1 ? 'response' : 'responses'}
                             </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {result.type === 'chart' && <ChartResult result={result} />}
                            {result.type === 'rating' && <RatingResult result={result} />}
                            {result.type === 'checkbox' && <CheckboxResult result={result} />}
                            {result.type === 'text' && <TextResult result={result} />}
                            {result.type === 'unknown' && <p>This question type is not supported for analysis.</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
}
