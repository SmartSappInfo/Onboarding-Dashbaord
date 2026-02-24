'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Trophy } from 'lucide-react';

function ResponsesListView({ survey, responses, isLoading }: { survey: Survey, responses: SurveyResponse[], isLoading: boolean }) {
    const router = useRouter();

    const questions = React.useMemo(() => survey ? survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el) : [], [survey]);

    const getAnswerForQuestion = (response: SurveyResponse, questionId: string) => {
        return response.answers.find(a => a.questionId === questionId)?.value;
    }

    const formatAnswer = (value: any): string => {
        if (value === undefined || value === null) return '-';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'object') {
            if (value.options) {
                let text = value.options.join(', ');
                if (value.other) text += `, Other: ${value.other}`;
                return text;
            }
            return JSON.stringify(value);
        }
        return String(value);
    }
    
    if (!survey) {
        return (
             <div className="p-4">
                <Skeleton className="h-12 w-full mb-2" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }
    
    return (
        <div className="relative">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50 border-b border-border/50">
                        <TableHead className="sticky left-0 bg-muted z-20 w-[200px] whitespace-nowrap text-[10px] font-bold uppercase tracking-widest py-4">Submitted At</TableHead>
                        {survey.scoringEnabled && (
                            <TableHead className="w-[100px] text-center text-[10px] font-bold uppercase tracking-widest py-4">Score</TableHead>
                        )}
                        {questions.map(q => (
                            <TableHead key={q.id} className="min-w-[200px] text-[10px] font-bold uppercase tracking-widest py-4">{q.title}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell className="sticky left-0 bg-card"><Skeleton className="h-5 w-3/4" /></TableCell>
                        {survey.scoringEnabled && <TableCell><Skeleton className="h-5 w-10 mx-auto" /></TableCell>}
                        {questions.map(q => (
                            <TableCell key={q.id}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                    </TableRow>
                    ))
                ) : responses && responses.length > 0 ? (
                    responses.map((response) => (
                    <TableRow key={response.id} className="cursor-pointer group hover:bg-muted/30 transition-colors" onClick={() => router.push(`/admin/surveys/${survey.id}/results/${response.id}`)}>
                        <TableCell className="sticky left-0 bg-background group-hover:bg-muted/30 font-medium whitespace-nowrap border-r shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                            <span className="text-xs">{format(new Date(response.submittedAt), "MMM d, yyyy · p")}</span>
                        </TableCell>
                        {survey.scoringEnabled && (
                            <TableCell className="text-center font-bold">
                                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 flex items-center gap-1 w-fit mx-auto">
                                    <Trophy className="h-3 w-3" />
                                    {response.score || 0}
                                </Badge>
                            </TableCell>
                        )}
                        {questions.map(q => {
                            const answer = getAnswerForQuestion(response, q.id);
                            const formattedAnswer = formatAnswer(answer);
                            return (
                                <TableCell key={q.id} title={formattedAnswer} className="max-w-[250px] truncate text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                                    {formattedAnswer}
                                </TableCell>
                            )
                        })}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={questions.length + 2} className="h-48 text-center text-muted-foreground italic">
                        No responses received for this survey yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
    )
}

export default ResponsesListView;
