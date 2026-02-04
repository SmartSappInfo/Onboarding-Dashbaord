
'use client';

import * as React from 'react';
import { useParams, useRouter } from "next/navigation";
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { Survey, SurveyResponse, SurveyElement, SurveyQuestion } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, FileText, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from "lucide-react";
import { format, parseISO } from "date-fns";
import SurveyPreviewRenderer from '../../../components/survey-preview-renderer';
import { Label } from '@/components/ui/label';

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

function AnswerDisplay({ question, answerValue }: { question: SurveyQuestion, answerValue: any }) {
    if (answerValue === undefined || answerValue === null || answerValue === '') {
        return <p className="text-sm text-muted-foreground italic">No answer provided.</p>
    }
    
    if (question.type === 'file-upload' && typeof answerValue === 'string') {
        const fileName = answerValue.split('/').pop()?.split('?')[0];
        const decodedFileName = decodeURIComponent(fileName || '');
        
        return (
            <Button variant="outline" asChild size="sm">
                <a href={answerValue} target="_blank" rel="noopener noreferrer">
                    <FileText className="mr-2 h-4 w-4" />
                    {decodedFileName.substring(decodedFileName.indexOf('-') + 1)}
                </a>
            </Button>
        );
    }

    if (question.type === 'checkboxes' && question.allowOther) {
        return (
            <ul className="list-disc list-inside">
                {answerValue.options?.map((opt: string) => <li key={opt}>{opt}</li>)}
                {answerValue.other && <li key="other"><strong>Other:</strong> {answerValue.other}</li>}
            </ul>
        )
    }

    if (Array.isArray(answerValue)) {
        return <p>{answerValue.join(', ')}</p>;
    }
    
    if (question.type === 'date' && typeof answerValue === 'string') {
        try {
            return <p>{format(parseISO(answerValue), 'PPP')}</p>;
        } catch {
            return <p>{answerValue}</p>
        }
    }

    return <p className="text-base font-medium">{String(answerValue)}</p>;
}


export default function ResponseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { id: surveyId, responseId } = params;
    const firestore = useFirestore();
    const { user, isUserLoading: isAuthLoading } = useUser();

    const surveyDocRef = useMemoFirebase(() => firestore && surveyId && user ? doc(firestore, 'surveys', surveyId as string) : null, [firestore, surveyId, user]);
    const responseDocRef = useMemoFirebase(() => firestore && surveyId && responseId && user ? doc(firestore, `surveys/${surveyId}/responses`, responseId as string) : null, [firestore, surveyId, responseId, user]);
    const responsesColRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return query(collection(firestore, `surveys/${surveyId}/responses`), orderBy('submittedAt', 'asc'));
    }, [firestore, surveyId]);

    const { data: survey, isLoading: isSurveyLoading } = useDoc<Survey>(surveyDocRef);
    const { data: response, isLoading: isResponseLoading } = useDoc<SurveyResponse>(responseDocRef);
    const { data: allResponses, isLoading: areAllResponsesLoading } = useCollection<SurveyResponse>(responsesColRef);

    const isLoading = isAuthLoading || isSurveyLoading || isResponseLoading || areAllResponsesLoading;

    const currentIndex = React.useMemo(() => {
        if (!allResponses || !responseId) return -1;
        return allResponses.findIndex(r => r.id === responseId);
    }, [allResponses, responseId]);

    const navigateToResponse = (index: number) => {
        if (allResponses && index >= 0 && index < allResponses.length) {
            const newResponseId = allResponses[index].id;
            router.push(`/admin/surveys/${surveyId}/results/${newResponseId}`);
        }
    };
    
    const totalResponses = allResponses?.length ?? 0;
    const canGoBack = currentIndex > 0;
    const canGoForward = totalResponses > 0 && currentIndex < totalResponses - 1;


    if (isLoading) {
        return (
            <div className="w-full max-w-3xl mx-auto p-4 md:p-6 lg:p-8">
                <Skeleton className="h-10 w-full mb-6" />
                <Skeleton className="h-10 w-3/4 mb-2" />
                <Skeleton className="h-5 w-1/2 mb-8" />
                <div className="space-y-6">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-24 w-full" />
                </div>
            </div>
        );
    }
    
    if (!survey || !response) {
        return (
            <div className="text-center py-20">
                <p>Response or survey not found.</p>
                 <Button variant="outline" onClick={() => router.back()} className="mt-4">
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>
            </div>
        );
    }
    
    const answersMap = new Map(response.answers.map(a => [a.questionId, a.value]));

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-3 mb-4 border-b">
                <div className="flex justify-between items-center">
                    <Button variant="ghost" onClick={() => router.push(`/admin/surveys/${surveyId}/results?view=responses`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to All Responses
                    </Button>

                    {allResponses && totalResponses > 0 && currentIndex !== -1 && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={() => navigateToResponse(0)} disabled={!canGoBack} aria-label="Go to first response">
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => navigateToResponse(currentIndex - 1)} disabled={!canGoBack} aria-label="Go to previous response">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-medium text-muted-foreground tabular-nums w-20 text-center">
                                {currentIndex + 1} / {totalResponses}
                            </span>
                            <Button variant="outline" size="icon" onClick={() => navigateToResponse(currentIndex + 1)} disabled={!canGoForward} aria-label="Go to next response">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={() => navigateToResponse(totalResponses - 1)} disabled={!canGoForward} aria-label="Go to last response">
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Survey Response</CardTitle>
                    <CardDescription>
                        Submitted on {format(new Date(response.submittedAt), "PPP 'at' p")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {survey.elements.map(element => {
                        if (isQuestion(element)) {
                            const answerValue = answersMap.get(element.id);
                            return (
                                <div key={element.id} className="space-y-2 pb-4 border-b last:border-b-0">
                                    <Label className="text-base font-semibold">{element.title}</Label>
                                    <div className="p-4 bg-muted/50 rounded-md">
                                        <AnswerDisplay question={element} answerValue={answerValue} />
                                    </div>
                                </div>
                            );
                        }
                        // Render non-question elements for context
                        return <SurveyPreviewRenderer key={element.id} element={element} />;
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
