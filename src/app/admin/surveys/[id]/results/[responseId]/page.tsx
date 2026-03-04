'use client';

import * as React from 'react';
import { useParams, useRouter } from "next/navigation";
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import type { Survey, SurveyResponse, SurveyElement, SurveyQuestion, SurveyResultRule } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, FileText, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Trophy, Target, Info } from "lucide-react";
import { format, parseISO } from "date-fns";
import SurveyPreviewRenderer from '../../../components/survey-preview-renderer';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

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

    // Logic to calculate points for each question
    const getPointsForAnswer = (question: SurveyQuestion, value: any): number => {
        if (!question.enableScoring || value === undefined || value === null) return 0;
        
        if (question.type === 'yes-no') {
            if (value === 'Yes') return question.yesScore || 0;
            if (value === 'No') return question.noScore || 0;
        } else if (question.type === 'multiple-choice' || question.type === 'dropdown') {
            const optIndex = question.options?.indexOf(value);
            if (optIndex !== undefined && optIndex !== -1) {
                return (question.optionScores?.[optIndex] || 0);
            }
        } else if (question.type === 'checkboxes') {
            const selected = question.allowOther ? value.options : value;
            if (Array.isArray(selected)) {
                return selected.reduce((total, val) => {
                    const optIndex = question.options?.indexOf(val);
                    if (optIndex !== undefined && optIndex !== -1) {
                        return total + (question.optionScores?.[optIndex] || 0);
                    }
                    return total;
                }, 0);
            }
        }
        return 0;
    }

    const matchedRule = React.useMemo(() => {
        if (!survey || !response || response.score === undefined) return null;
        const score = response.score;
        return [...(survey.resultRules || [])]
            .sort((a, b) => a.priority - b.priority)
            .find(rule => score >= rule.minScore && score <= rule.maxScore);
    }, [survey, response]);


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
        <div className="w-full max-w-3xl mx-auto px-4 pb-20">
            <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-3 mb-4 border-b">
                <div className="flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/admin/surveys/${surveyId}/results?view=responses`)}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">All Responses</span>
                        <span className="sm:hidden">Back</span>
                    </Button>

                    {allResponses && totalResponses > 0 && currentIndex !== -1 && (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateToResponse(0)} disabled={!canGoBack} aria-label="First">
                                <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateToResponse(currentIndex - 1)} disabled={!canGoBack}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Back</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <span className="text-xs font-bold text-muted-foreground tabular-nums w-16 text-center">
                                {currentIndex + 1} / {totalResponses}
                            </span>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateToResponse(currentIndex + 1)} disabled={!canGoForward} aria-label="Next">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigateToResponse(totalResponses - 1)} disabled={!canGoForward} aria-label="Last">
                                <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scoring Summary Header */}
            {survey.scoringEnabled && (
                <Card className="mb-8 bg-primary/5 border-primary/20 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Trophy size={120} />
                    </div>
                    <CardHeader className="pb-4">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
                                    <Target className="h-4 w-4" /> Performance Result
                                </CardTitle>
                                <CardDescription className="text-xs font-medium">Calculation based on participant answers.</CardDescription>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black text-primary tabular-nums leading-none">{response.score || 0}</p>
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">/ {survey.maxScore} Points</p>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                        {matchedRule ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-background border border-primary/20 shadow-sm">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <Trophy className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground leading-none mb-1">Resolved Outcome</p>
                                    <p className="text-base font-black text-foreground">{matchedRule.label}</p>
                                </div>
                                <Badge className="ml-auto bg-primary text-primary-foreground">Active Match</Badge>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed bg-muted/30">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs font-medium text-muted-foreground italic">No score range matched. User saw default page.</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
            
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl font-bold">Questionnaire Detail</CardTitle>
                    <CardDescription>
                        Submitted on {format(new Date(response.submittedAt), "PPP 'at' p")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-10">
                    {survey.elements.map(element => {
                        if (isQuestion(element)) {
                            const answerValue = answersMap.get(element.id);
                            const points = getPointsForAnswer(element, answerValue);
                            
                            return (
                                <div key={element.id} className="space-y-3 pb-6 border-b last:border-b-0 last:pb-0">
                                    <div className="flex justify-between items-start gap-4">
                                        <Label className="text-lg font-bold leading-tight flex-1">{element.title}</Label>
                                        {survey.scoringEnabled && element.enableScoring && (
                                            <Badge variant={points > 0 ? "default" : "secondary"} className={cn("shrink-0 h-6 font-black tabular-nums", points > 0 ? "bg-green-600" : "")}>
                                                +{points} Pts
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="p-5 bg-muted/30 rounded-xl border-2 border-dashed">
                                        <AnswerDisplay question={element} answerValue={answerValue} />
                                    </div>
                                </div>
                            );
                        }
                        // Render non-question elements for context
                        return (
                            <div key={element.id} className="opacity-60 grayscale scale-95 origin-left">
                                <SurveyPreviewRenderer element={element} />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
        </div>
    );
}
