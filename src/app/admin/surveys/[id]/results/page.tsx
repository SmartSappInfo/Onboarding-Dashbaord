
'use client';

import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import type { Survey, SurveyResponse, SurveyQuestion, SurveySummary, UserProfile } from "@/lib/types";
import { doc, collection, query, orderBy, addDoc, onSnapshot } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2, Download, BarChart3, FileText, Brain, Users } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useToast } from "@/hooks/use-toast";
import { generateSurveySummary } from "@/ai/flows/generate-survey-summary-flow";
import { useLiveAiModel } from "@/hooks/use-live-ai-model";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import dynamic from 'next/dynamic';

import ResponsesListView from "./components/responses-list-view";
import AnalyticsView from "./components/analytics-view";
import AISummariesView from "./components/ai-summaries-view";
import { useSetBreadcrumb } from "@/hooks/use-set-breadcrumb";
import { stripHtml } from "@/lib/utils";
import { useWorkspace } from "@/context/WorkspaceContext";
import AiModelSelector from "@/components/ai/AiModelSelector";

// Lazy-load Field Team view since it's behind a conditional tab (bundle-dynamic-imports)
const FieldTeamView = dynamic(() => import('./components/field-team-view'), {
    loading: () => <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>,
});

/**
 * Extracts a human-readable string from a survey answer value.
 * Handles: plain strings/numbers, {option, other} objects, arrays of mixed types.
 */
function formatAnswerForCsv(value: unknown): string {
    if (value === null || value === undefined) return '';

    // Plain primitive
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    // Single object with option/other pattern (e.g. multiple-choice with "Other")
    if (typeof value === 'object') {
        if (Array.isArray(value)) {
            return value.map(item => formatAnswerForCsv(item)).filter(Boolean).join(' | ');
        }
        const valObj = value as Record<string, unknown>;
        if ('option' in valObj) {
            const other = valObj.other ? String(valObj.other).trim() : '';
            const option = valObj.option ? String(valObj.option).trim() : '';
            // If "other" text is filled and meaningful, prefer it; otherwise use the option
            return other.length > 0 ? `${option} (${other})` : option;
        }
        // Generic object fallback — extract values
        const vals = Object.values(valObj).filter(v => v !== '' && v !== null && v !== undefined);
        return vals.length > 0 ? vals.map(String).join(' | ') : '';
    }

    return String(value);
}

export default function SurveyResultsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { id: surveyId } = params;
    const { toast } = useToast();
    const { user } = useUser();
    const { activeOrganizationId } = useWorkspace();
    const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
    const activeTab = searchParams.get("view") || "responses";

    // Filter states
    const [columnFilters, setColumnFilters] = React.useState<Record<string, string[]>>({});
    const [hideEmptyColumns, setHideEmptyColumns] = React.useState(true);
    const [attributionFilter, setAttributionFilter] = React.useState<string>('all');
    const [deepLinkFilterType, setDeepLinkFilterType] = React.useState<string | null>(null);

    const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();

    React.useEffect(() => {
        const filterUser = searchParams.get('filterUser');
        const filterType = searchParams.get('filterType');
        if (filterUser) {
            setAttributionFilter(filterUser);
            setDeepLinkFilterType(filterType);
        }
    }, [searchParams]);

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return doc(firestore, "surveys", surveyId as string);
    }, [firestore, surveyId]);

    const responsesColRef = useMemoFirebase(() => {
        if (!firestore || !surveyId || typeof surveyId !== 'string') return null;
        return query(collection(firestore, `surveys/${surveyId}/responses`), orderBy("submittedAt", "desc"));
    }, [firestore, surveyId]);

    const { data: survey, isLoading: isSurveyLoading } = useDoc<Survey>(surveyDocRef);
    const { data: responses, isLoading: areResponsesLoading } = useCollection<SurveyResponse>(responsesColRef);

    const summariesColRef = useMemoFirebase(() => {
        if (!firestore || !surveyId || typeof surveyId !== 'string') return null;
        return query(collection(firestore, `surveys/${surveyId}/summaries`), orderBy("createdAt", "desc"));
    }, [firestore, surveyId]);

    const { data: summaries, isLoading: areSummariesLoading } = useCollection<SurveySummary>(summariesColRef);

    // Phase 2: Dynamic Label Resolution - Ensure ID segment is replaced with Name
    useSetBreadcrumb(survey?.internalName || survey?.title, `/admin/surveys/${surveyId}`);

    // Helper to format answers into simple string matches
    const formatAnswerForComparison = React.useCallback((value: any): string => {
        if (value === undefined || value === null) return '';
        if (Array.isArray(value)) {
            return value.map(val => formatAnswerForComparison(val)).join(', ');
        }
        if (typeof value === 'object') {
            if (Array.isArray(value.options)) {
                const parts = [...value.options];
                if (value.other && value.other.trim()) parts.push(value.other.trim());
                return parts.join(', ');
            }
            if (value.option !== undefined) {
                if (value.option === '__other__') {
                    return value.other?.trim() ? value.other.trim() : '';
                }
                const parts = [value.option];
                if (value.other?.trim()) parts.push(value.other.trim());
                return parts.join(', ');
            }
            return Object.values(value).filter(Boolean).map(String).join(', ');
        }
        return String(value);
    }, []);

    // Filter responses by attribution and columns (AND logic)
    const filteredResponses = React.useMemo(() => {
        if (!responses) return [];
        let result = responses;

        // 1. Attribution filter
        if (attributionFilter !== 'all') {
            if (attributionFilter === 'anonymous') {
                result = result.filter(r => !r.assignedUserId);
            } else {
                result = result.filter(r => r.assignedUserId === attributionFilter);
            }
        }

        // 2. Deep-link type filter
        if (deepLinkFilterType === 'leads') {
            result = result.filter(r => r.entityId);
        }

        // 3. Column filters
        Object.entries(columnFilters).forEach(([questionId, selectedValues]) => {
            if (!selectedValues || selectedValues.length === 0) return;
            result = result.filter(response => {
                const answer = response.answers.find(a => a.questionId === questionId)?.value;
                if (answer === undefined || answer === null) return false;

                // For checklist options
                if (Array.isArray(answer)) {
                    const formatted = answer.map(val => formatAnswerForComparison(val).toLowerCase());
                    return selectedValues.some(val => formatted.includes(val.toLowerCase()));
                } else if (typeof answer === 'object') {
                    if (Array.isArray(answer.options)) {
                        const formatted = answer.options.map((val: string) => val.toLowerCase());
                        if (answer.other && answer.other.trim()) {
                            formatted.push(answer.other.trim().toLowerCase());
                        }
                        return selectedValues.some(val => formatted.includes(val.toLowerCase()));
                    }
                    if (answer.option !== undefined) {
                        const formattedOpts: string[] = [];
                        if (answer.option === '__other__') {
                            if (answer.other?.trim()) formattedOpts.push(answer.other.trim().toLowerCase());
                        } else {
                            formattedOpts.push(answer.option.toLowerCase());
                            if (answer.other?.trim()) formattedOpts.push(answer.other.trim().toLowerCase());
                        }
                        return selectedValues.some(val => formattedOpts.includes(val.toLowerCase()));
                    }
                }

                const formatted = formatAnswerForComparison(answer).toLowerCase();
                return selectedValues.some(val => {
                    const cleanVal = val.toLowerCase();
                    return formatted === cleanVal || formatted.includes(cleanVal);
                });
            });
        });

        return result;
    }, [responses, attributionFilter, deepLinkFilterType, columnFilters, formatAnswerForComparison]);

    const handleGenerateSummary = async () => {
        if (!survey || !filteredResponses || !firestore) {
            toast({ variant: 'destructive', title: 'Survey data not loaded yet.' });
            return;
        }
        setIsGeneratingSummary(true);
        try {
            const result = await generateSurveySummary({ 
                survey, 
                responses: filteredResponses,
                organizationId: activeOrganizationId || undefined,
                provider: liveProvider,
                modelId: liveModelId,
            });
            
            const summariesCollection = collection(firestore, `surveys/${surveyId}/summaries`);
            const summaryData = {
                summary: result.summary,
                createdAt: new Date().toISOString(),
                provider: liveProvider,
                modelId: liveModelId,
            };
            
            await addDoc(summariesCollection, summaryData);
            
            toast({
                title: "AI Summary Generated",
                description: "The new summary has been saved under the 'AI Summaries' tab.",
            });
            router.push(`/admin/surveys/${surveyId}/results?view=ai-summaries`);
            
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Summary Failed', description: e.message });
        } finally {
            setIsGeneratingSummary(false);
        }
    };

    const handleExport = () => {
        if (!survey || !filteredResponses) {
            toast({ variant: "destructive", title: "No data to export" });
            return;
        }

        const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);
        const questionIdToTitleMap = new Map(questions.map(q => [q.id, q.title]));
        const questionIds = questions.map(q => q.id);

        const headerRow = ["Submitted At", ...questionIds.map(id => `"${stripHtml(questionIdToTitleMap.get(id) || '').replace(/"/g, '""') ?? id}"`)].join(',');

        const rows = filteredResponses.map(response => {
            const answerMap = new Map(response.answers.map(a => [a.questionId, a.value]));
            const submittedAtCell = `"${format(new Date(response.submittedAt), "yyyy-MM-dd HH:mm:ss")}"`;
            const answerCells = questionIds.map(id => {
                const value = answerMap.get(id);
                let cellValue = '';
                if (value !== undefined && value !== null) {
                    cellValue = formatAnswerForCsv(value);
                }
                return `"${cellValue.replace(/"/g, '""')}"`;
            });
            return [submittedAtCell, ...answerCells].join(',');
        });

        const csvContent = [headerRow, ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', `${survey.slug}-responses.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast({ title: "Export Started", description: "Your CSV file is downloading." });
    };

    if (isSurveyLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center ">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4 ">
                <p className="text-lg font-medium">Survey not found.</p>
            </div>
        );
    }
    
    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => router.push(`/admin/surveys/${surveyId}/results?view=${value}`)}
            className="flex h-full flex-col"
        >
            <div className="shrink-0 border-b bg-card/40 backdrop-blur-md p-4 sm:p-6">
                <div className="flex items-center justify-between">
                    <TabsList className="bg-card/20 border-border/50">
                        <TabsTrigger value="responses" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                            <FileText className="mr-2 h-4 w-4" /> Responses
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                            <BarChart3 className="mr-2 h-4 w-4" /> Analytics
                        </TabsTrigger>
                        <TabsTrigger value="ai-summaries" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                            <Brain className="mr-2 h-4 w-4" /> AI Summaries
                        </TabsTrigger>
                        {survey.assignmentEnabled && (survey.assignedUsers?.length ?? 0) > 0 && (
                            <TabsTrigger value="field-team" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-lg transition-all">
                                <Users className="mr-2 h-4 w-4" /> Field Team
                            </TabsTrigger>
                        )}
                    </TabsList>
                    <div className="flex shrink-0 items-center gap-4">
                        <AiModelSelector hideLabel className="scale-90" />
                        {activeTab === "responses" ? (
                            <Button onClick={handleExport} disabled={!filteredResponses || filteredResponses.length === 0}>
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        ) : (
                            <RainbowButton onClick={handleGenerateSummary} disabled={isGeneratingSummary} className="h-10 px-6 gap-2 font-semibold text-[10px] shadow-xl transition-all active:scale-95 text-white">
                                {isGeneratingSummary ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="h-4 w-4" />
                                )}
                                {isGeneratingSummary ? 'Analyzing...' : 'Generate AI Summary'}
                            </RainbowButton>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-x-auto">
                <TabsContent value="responses" className="m-0 h-full">
                    <ResponsesListView
                        survey={survey}
                        responses={responses || []}
                        filteredResponses={filteredResponses}
                        isLoading={areResponsesLoading}
                        columnFilters={columnFilters}
                        setColumnFilters={setColumnFilters}
                        hideEmptyColumns={hideEmptyColumns}
                        setHideEmptyColumns={setHideEmptyColumns}
                        attributionFilter={attributionFilter}
                        setAttributionFilter={setAttributionFilter}
                        deepLinkFilterType={deepLinkFilterType}
                        setDeepLinkFilterType={setDeepLinkFilterType}
                    />
                </TabsContent>

                <TabsContent value="analytics" className="m-0">
                    <div className="p-4 sm:p-6 lg:p-8">
                        <AnalyticsView 
                            survey={survey} 
                            responses={filteredResponses} 
                            summaries={summaries || []}
                            onGenerateSummary={handleGenerateSummary}
                            isGeneratingSummary={isGeneratingSummary}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="ai-summaries" className="m-0">
                    <div className="p-4 sm:p-6 lg:p-8">
                        {responses ? (
                            <AISummariesView 
                                survey={survey} 
                                responses={filteredResponses} 
                                summaries={summaries || []}
                                areSummariesLoading={areSummariesLoading}
                            />
                        ) : (
                            <div className="flex h-64 items-center justify-center">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        )}
                    </div>
                </TabsContent>

                {survey.assignmentEnabled && (survey.assignedUsers?.length ?? 0) > 0 && (
                    <TabsContent value="field-team" className="m-0">
                        <FieldTeamView survey={survey} responses={filteredResponses} />
                    </TabsContent>
                )}
            </div>
        </Tabs>
    );
}
