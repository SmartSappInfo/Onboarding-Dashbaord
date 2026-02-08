
'use client';

import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import type { Survey, SurveyResponse, SurveyQuestion } from "@/lib/types";
import { doc, collection, query, orderBy, addDoc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Loader2, Download, BarChart3, FileText, Brain } from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useToast } from "@/hooks/use-toast";
import { generateSurveySummary } from "@/ai/flows/generate-survey-summary-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

import ResponsesListView from "./components/responses-list-view";
import AnalyticsView from "./components/analytics-view";
import AISummariesView from "./components/ai-summaries-view";

export default function SurveyResultsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { id: surveyId } = params;
    const { toast } = useToast();

    const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
    const activeTab = searchParams.get("view") || "responses";

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return doc(firestore, "surveys", surveyId as string);
    }, [firestore, surveyId]);

    const responsesColRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return query(collection(firestore, `surveys/${surveyId}/responses`), orderBy("submittedAt", "desc"));
    }, [firestore, surveyId]);

    const { data: survey, isLoading: isSurveyLoading } = useDoc<Survey>(surveyDocRef);
    const { data: responses, isLoading: areResponsesLoading } = useCollection<SurveyResponse>(responsesColRef);

    const handleGenerateSummary = async () => {
        if (!survey || !responses || !firestore) {
            toast({ variant: 'destructive', title: 'Survey data not loaded yet.' });
            return;
        }
        setIsGeneratingSummary(true);
        try {
            const result = await generateSurveySummary({ survey, responses });
            
            const summariesCollection = collection(firestore, `surveys/${surveyId}/summaries`);
            const summaryData = {
                summary: result.summary,
                createdAt: new Date().toISOString(),
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
        if (!survey || !responses) {
            toast({ variant: "destructive", title: "No data to export" });
            return;
        }

        const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);
        const questionIdToTitleMap = new Map(questions.map(q => [q.id, q.title]));
        const questionIds = questions.map(q => q.id);

        const headerRow = ["Submitted At", ...questionIds.map(id => `"${questionIdToTitleMap.get(id)?.replace(/"/g, '""') ?? id}"`)].join(',');

        const rows = responses.map(response => {
            const answerMap = new Map(response.answers.map(a => [a.questionId, a.value]));
            const submittedAtCell = `"${format(new Date(response.submittedAt), "yyyy-MM-dd HH:mm:ss")}"`;
            const answerCells = questionIds.map(id => {
                const value = answerMap.get(id);
                let cellValue = '';
                if (value !== undefined && value !== null) {
                    if (Array.isArray(value)) {
                        cellValue = JSON.stringify(value);
                    } else if (typeof value === 'object') {
                        cellValue = JSON.stringify(value);
                    } else {
                        cellValue = String(value);
                    }
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
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!survey) {
        return (
            <div className="flex h-full w-full flex-col items-center justify-center gap-4">
                <p className="text-lg font-medium">Survey not found.</p>
                <Button variant="outline" onClick={() => router.push('/admin/surveys')}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back to All Surveys
                </Button>
            </div>
        );
    }
    
    return (
        <div className="flex h-[calc(100vh_-_6rem)] flex-col bg-muted/30 p-4 sm:p-6 md:p-8">
            {/* Sticky Header */}
            <header className="flex-shrink-0 rounded-t-lg border bg-background shadow-sm">
                <div className="flex items-center justify-between p-4">
                    <div>
                        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => router.push("/admin/surveys")}>
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back
                        </Button>
                        <h1 className="text-2xl font-semibold mt-1">{survey.title}</h1>
                        <p className="text-sm text-muted-foreground">Results & Analytics</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {activeTab === "responses" ? (
                            <Button onClick={handleExport} disabled={!responses || responses.length === 0}>
                                <Download className="mr-2 h-4 w-4" />
                                Export CSV
                            </Button>
                        ) : (
                            <RainbowButton onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
                                {isGeneratingSummary ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Sparkles className="mr-2 h-4 w-4" />
                                )}
                                {isGeneratingSummary ? 'Analyzing...' : 'Generate AI Summary'}
                            </RainbowButton>
                        )}
                    </div>
                </div>

                {/* Sticky Tabs */}
                <Tabs
                    value={activeTab}
                    onValueChange={(value) => router.push(`/admin/surveys/${surveyId}/results?view=${value}`)}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-3 rounded-none border-b border-t bg-background p-0">
                        <TabsTrigger value="responses" className="flex gap-2 rounded-none py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none">
                            <FileText className="h-4 w-4" /> Responses
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex gap-2 rounded-none py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none">
                            <BarChart3 className="h-4 w-4" /> Analytics
                        </TabsTrigger>
                        <TabsTrigger value="ai-summaries" className="flex gap-2 rounded-none py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:text-primary data-[state=active]:shadow-none">
                            <Brain className="h-4 w-4" /> AI Summaries
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </header>

            {/* Single Scrollable Content Area */}
            <main className="flex-1 overflow-y-auto rounded-b-lg border border-t-0 bg-background shadow-sm">
                <Tabs value={activeTab}>
                    <TabsContent value="responses" className="mt-0 h-full">
                        <ResponsesListView
                            survey={survey}
                            responses={responses || []}
                            isLoading={areResponsesLoading}
                        />
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-0 h-full">
                         <div className="p-4 sm:p-6 lg:p-8">
                            <AnalyticsView survey={survey} responses={responses || []} />
                         </div>
                    </TabsContent>

                    <TabsContent value="ai-summaries" className="mt-0 h-full">
                        <div className="p-4 sm:p-6 lg:p-8">
                            {responses ? (
                                <AISummariesView survey={survey} responses={responses} />
                            ) : (
                                <div className="flex h-64 items-center justify-center">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            )}
                        </div>
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
}
