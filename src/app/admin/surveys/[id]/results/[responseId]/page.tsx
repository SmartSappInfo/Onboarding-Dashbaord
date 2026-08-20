
'use client';

import * as React from 'react';
import { useParams, useRouter } from "next/navigation";
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import type { Survey, SurveyResponse, SurveyElement, SurveyQuestion, ResolvedContact } from '@/lib/types';
import { doc, collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, Trophy, Target, Info, Building2, User as UserIcon, Phone, Mail, Copy, Check, ShieldCheck, ExternalLink, FileText } from "lucide-react";
import { format, parseISO } from "date-fns";
import SurveyPreviewRenderer from '../../../components/survey-preview-renderer';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { resolveContact } from '@/lib/contact-adapter';
import { extractResponseContactDetails } from '@/lib/survey-actions';

/**
 * ARCHITECTURAL NOTE (Rule 10 Maintainer Guidance):
 * Component to display resolved CRM Entity and Primary Contact Information
 * on the survey response detail page, with interactive Click-to-Call and Click-to-Email.
 */
function ResponseContactCard({ response }: { response: SurveyResponse }) {
    const { activeWorkspaceId } = useWorkspace();
    const { toast } = useToast();
    const [contact, setContact] = React.useState<ResolvedContact | null>(null);
    const [isLoading, setIsLoading] = React.useState(true);
    const [copiedField, setCopiedField] = React.useState<'phone' | 'email' | null>(null);

    React.useEffect(() => {
        let active = true;
        async function load() {
            if (!response.entityId) {
                if (active) setIsLoading(false);
                return;
            }
            try {
                const resolved = await resolveContact(response.entityId, activeWorkspaceId);
                if (active) setContact(resolved);
            } catch (err) {
                console.error("Failed to load contact in response detail:", err);
            } finally {
                if (active) setIsLoading(false);
            }
        }
        load();
        return () => { active = false; };
    }, [response.entityId, activeWorkspaceId]);

    const details = React.useMemo(() => {
        return extractResponseContactDetails(response, contact);
    }, [response, contact]);

    const handleCopy = (text: string, type: 'phone' | 'email') => {
        if (!text) return;
        try {
            navigator.clipboard.writeText(text);
            setCopiedField(type);
            toast({
                title: type === 'phone' ? "Phone Copied" : "Email Copied",
                description: `${text} copied to clipboard.`,
            });
            setTimeout(() => setCopiedField(null), 2000);
        } catch {
            toast({ variant: "destructive", title: "Copy Failed", description: "Could not access clipboard." });
        }
    };

    if (isLoading) {
        return <Skeleton className="h-32 w-full mb-8 rounded-[2rem]" />;
    }

    const hasAnyContact = Boolean(
        details.entityName || 
        details.primaryContactName || 
        details.primaryContactPhone || 
        details.primaryContactEmail
    );

    if (!hasAnyContact) return null;

    return (
        <Card className="mb-8 border-none shadow-sm ring-1 ring-border rounded-[2rem] overflow-hidden bg-card/60 backdrop-blur-sm">
            <CardHeader className="bg-muted/30 border-b pb-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <div>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                {details.entityId ? (
                                    <a
                                        href={`/admin/entities/${details.entityId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="hover:underline hover:text-primary transition-colors flex items-center gap-1.5"
                                    >
                                        {details.entityName || 'Entity Contact Details'}
                                        <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                                    </a>
                                ) : (
                                    details.entityName || 'Respondent Contact Details'
                                )}
                            </CardTitle>
                            {(details.zoneName || details.locationString) && (
                                <CardDescription className="text-xs font-medium">
                                    {[details.zoneName, details.locationString].filter(Boolean).join(' · ')}
                                </CardDescription>
                            )}
                        </div>
                    </div>
                    {details.isLiveCrm && (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold text-[10px] gap-1 py-1 px-2.5">
                            <ShieldCheck className="h-3.5 w-3.5" /> Live CRM Entity
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {/* Primary Contact */}
                    {details.primaryContactName && (
                        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/20 border border-border/50">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Primary Contact</span>
                            <div className="flex items-center gap-2">
                                <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-bold text-foreground truncate">{details.primaryContactName}</span>
                                {details.roleOrTitle && (
                                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 shrink-0">
                                        {details.roleOrTitle}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Phone / Click-to-Call */}
                    {details.primaryContactPhone && (
                        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/20 border border-border/50">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Phone Number</span>
                            <div className="flex items-center justify-between gap-2">
                                <a
                                    href={`tel:${details.primaryContactPhone}`}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-emerald-600 hover:text-emerald-700 hover:underline transition-colors truncate active:scale-[0.97]"
                                    title="Click to call"
                                >
                                    <Phone className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{details.primaryContactPhone}</span>
                                </a>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                                    onClick={() => handleCopy(details.primaryContactPhone, 'phone')}
                                    title="Copy phone"
                                >
                                    {copiedField === 'phone' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Email / Click-to-Email */}
                    {details.primaryContactEmail && (
                        <div className="flex flex-col gap-1 p-3 rounded-xl bg-muted/20 border border-border/50">
                            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Email Address</span>
                            <div className="flex items-center justify-between gap-2">
                                <a
                                    href={`mailto:${details.primaryContactEmail}`}
                                    className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-700 hover:underline transition-colors truncate active:scale-[0.97]"
                                    title="Click to send email"
                                >
                                    <Mail className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{details.primaryContactEmail}</span>
                                </a>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground active:scale-[0.97]"
                                    onClick={() => handleCopy(details.primaryContactEmail, 'email')}
                                    title="Copy email"
                                >
                                    {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-blue-600" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

const isQuestion = (element: SurveyElement): element is SurveyQuestion => 'isRequired' in element;

function AnswerDisplay({ question, answerValue }: { question: SurveyQuestion, answerValue: unknown }) {
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
        const valObj = answerValue as Record<string, unknown>;
        return (
            <ul className="list-disc list-inside">
                {Array.isArray(valObj?.options) && (valObj.options as string[]).map((opt: string) => <li key={opt}>{opt}</li>)}
                {typeof valObj?.other === 'string' && valObj.other.trim() && <li key="other"><strong>Other:</strong> {valObj.other}</li>}
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

    return <p className="text-base font-medium whitespace-pre-wrap">{String(answerValue)}</p>;
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

    // Phase 2: Dynamic Label Resolution - Ensure ID segment is replaced with Name
    useSetBreadcrumb(survey?.internalName || survey?.title, `/admin/surveys/${surveyId}`);

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

    const getPointsForAnswer = (question: SurveyQuestion, value: unknown): number => {
        if (!question.enableScoring || value === undefined || value === null) return 0;
        
        if (question.type === 'yes-no') {
            if (value === 'Yes') return question.yesScore || 0;
            if (value === 'No') return question.noScore || 0;
        } else if (question.type === 'multiple-choice' || question.type === 'dropdown') {
            const optIndex = question.options?.indexOf(String(value));
            if (optIndex !== undefined && optIndex !== -1) {
                return (question.optionScores?.[optIndex] || 0);
            }
        } else if (question.type === 'checkboxes') {
            const valObj = value as Record<string, unknown>;
            const selected = question.allowOther && valObj ? valObj.options : value;
            if (Array.isArray(selected)) {
                return selected.reduce((total: number, val) => {
                    const optIndex = question.options?.indexOf(String(val));
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
 <div className="space-y-6 pt-12">
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
 <p className="font-medium text-muted-foreground">Response record could not be resolved.</p>
            </div>
        );
    }
    
    const answersMap = new Map(response.answers.map(a => [a.questionId, a.value]));

    return (
        <div className="h-full overflow-y-auto">
            <div className="max-w-5xl mx-auto space-y-8 pb-20">
                <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-3 mb-8">
 <div className="flex justify-end items-center">
                    {allResponses && totalResponses > 0 && currentIndex !== -1 && (
 <div className="flex items-center gap-2">
 <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigateToResponse(0)} disabled={!canGoBack} aria-label="First">
 <ChevronsLeft className="h-4 w-4" />
                            </Button>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
 <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigateToResponse(currentIndex - 1)} disabled={!canGoBack}>
 <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Previous Submission</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
 <span className="text-[10px] font-semibold text-primary tabular-nums w-20 text-center bg-primary/5 border border-primary/10 rounded-md py-1">
                                {currentIndex + 1} OF {totalResponses}
                            </span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
 <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigateToResponse(currentIndex + 1)} disabled={!canGoForward}>
 <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">Next Submission</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
 <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => navigateToResponse(totalResponses - 1)} disabled={!canGoForward} aria-label="Last">
 <ChevronsRight className="h-4 w-4" />
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* Entity & Contact Information Card */}
            <ResponseContactCard response={response} />

            {/* Scoring Summary Header */}
            {survey.scoringEnabled && (
 <Card className="mb-8 bg-primary/5 border-primary/20 overflow-hidden relative">
 <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Trophy size={120} />
                    </div>
 <CardHeader className="pb-4">
 <div className="flex items-center justify-between">
 <div className="space-y-1">
 <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
 <Target className="h-4 w-4" /> Performance Result
                                </CardTitle>
 <CardDescription className="text-xs font-medium">Calculation based on participant answers.</CardDescription>
                            </div>
 <div className="text-right">
 <p className="text-3xl font-semibold text-primary tabular-nums leading-none">{response.score || 0}</p>
 <p className="text-[10px] font-bold text-muted-foreground tracking-wider mt-1">/ {survey.maxScore} Points</p>
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
 <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1">Resolved Outcome</p>
 <p className="text-base font-semibold text-foreground">{matchedRule.label}</p>
                                </div>
                                <Badge className="ml-auto bg-primary text-primary-foreground text-[10px] font-semibold uppercase">Active Match</Badge>
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
            
 <Card className="border-none shadow-sm ring-1 ring-border rounded-[2rem] overflow-hidden">
 <CardHeader className="bg-muted/30 border-b pb-6">
 <CardTitle className="text-lg font-semibold tracking-tight">Questionnaire Detail</CardTitle>
 <CardDescription className="text-xs font-medium">
                        Submitted on {format(new Date(response.submittedAt), "PPP 'at' p")}
                    </CardDescription>
                </CardHeader>
 <CardContent className="p-8 space-y-10">
                    {survey.elements.map(element => {
                        if (isQuestion(element)) {
                            const answerValue = answersMap.get(element.id);
                            const points = getPointsForAnswer(element, answerValue);
                            
                            return (
 <div key={element.id} className="space-y-3 pb-6 border-b border-border/50 last:border-b-0 last:pb-0 group">
 <div className="flex justify-between items-start gap-4">
 <Label className="text-lg font-bold leading-tight flex-1 text-foreground group-hover:text-primary transition-colors whitespace-pre-wrap">{element.title}</Label>
                                        {survey.scoringEnabled && element.enableScoring && (
                                            <Badge variant={points > 0 ? "default" : "secondary"} className={cn("shrink-0 h-6 font-semibold tabular-nums border-none", points > 0 ? "bg-emerald-500 text-white" : "opacity-40")}>
                                                {points > 0 ? `+${points}` : '0'} PTS
                                            </Badge>
                                        )}
                                    </div>
 <div className="p-5 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 shadow-inner">
                                        <AnswerDisplay question={element} answerValue={answerValue} />
                                    </div>
                                </div>
                            );
                        }
                        // Render non-question elements for context
                        return (
 <div key={element.id} className="opacity-40 grayscale scale-95 origin-left pointer-events-none">
                                <SurveyPreviewRenderer element={element} />
                            </div>
                        );
                    })}
                </CardContent>
            </Card>
            </div>
        </div>
    );
}
