

'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Survey, SurveyResponse, SurveyQuestion } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

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
        <div className="relative h-full">
            <Table>
                <TableHeader className="sticky top-0 z-10 shadow-sm">
                    <TableRow>
                        <TableHead className="sticky left-0 bg-primary z-20 w-[200px] whitespace-nowrap">Submitted</TableHead>
                        {questions.map(q => (
                            <TableHead key={q.id} className="min-w-[200px]">{q.title}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                {isLoading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell className="sticky left-0 bg-card"><Skeleton className="h-5 w-3/4" /></TableCell>
                        {questions.map(q => (
                            <TableCell key={q.id}><Skeleton className="h-5 w-full" /></TableCell>
                        ))}
                    </TableRow>
                    ))
                ) : responses && responses.length > 0 ? (
                    responses.map((response) => (
                    <TableRow key={response.id} className="cursor-pointer" onClick={() => router.push(`/admin/surveys/${survey.id}/results/${response.id}`)}>
                        <TableCell className="sticky left-0 bg-card font-medium whitespace-nowrap">
                            {format(new Date(response.submittedAt), "PPP p")}
                        </TableCell>
                        {questions.map(q => {
                            const answer = getAnswerForQuestion(response, q.id);
                            const formattedAnswer = formatAnswer(answer);
                            return (
                                <TableCell key={q.id} title={formattedAnswer} className="max-w-[250px] truncate">
                                    {formattedAnswer}
                                </TableCell>
                            )
                        })}
                    </TableRow>
                    ))
                ) : (
                    <TableRow>
                    <TableCell colSpan={questions.length + 1} className="h-48 text-center">
                        No responses yet.
                    </TableCell>
                    </TableRow>
                )}
                </TableBody>
            </Table>
        </div>
    )
}

export default ResponsesListView;
