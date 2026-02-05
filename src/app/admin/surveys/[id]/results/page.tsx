'use client';

import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from "@/firebase";
import type { Survey, SurveyResponse, SurveyQuestion, SurveyElement, SurveySummary } from "@/lib/types";
import { doc, collection, query, orderBy, addDoc } from 'firebase/firestore';
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, Loader2, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useToast } from "@/hooks/use-toast";
import { generateSurveySummary } from "@/ai/flows/generate-survey-summary-flow";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import ResponsesListView from "./components/responses-list-view";
import AISummariesView from "./components/ai-summaries-view";
import AnalyticsView from "./components/analytics-view";
import { ScrollArea } from "@/components/ui/scroll-area";


// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================
export default function SurveyResultsPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { id: surveyId } = params;
    const { toast } = useToast();

    const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
    
    const activeTab = searchParams.get('view') || 'responses';

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return doc(firestore, 'surveys', surveyId as string);
    }, [firestore, surveyId]);

    const responsesColRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return query(collection(firestore, `surveys/${surveyId}/responses`), orderBy('submittedAt', 'desc'));
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
            <div>
                <Skeleton className="h-8 w-48 mb-2" />
                <Skeleton className="h-10 w-96 mb-8" />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i}><Skeleton className="h-6 w-3/4 mb-2" /><Skeleton className="h-4 w-1/4" /><Skeleton className="h-48 w-full" /></div>
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
        <div className="flex h-full w-full flex-col">
            {/* Header */}
            <div className="flex-shrink-0">
                <div className="flex flex-wrap gap-4 justify-between items-center mb-4">
                    <Button variant="ghost" onClick={() => router.push('/admin/surveys')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Surveys
                    </Button>
                </div>
                <h1 className="text-3xl font-bold tracking-tight mb-2">{survey.title}</h1>
                <p className="text-muted-foreground mb-4">Results & Analytics</p>
            </div>

            <Tabs value={activeTab} onValueChange={(value) => router.push(`/admin/surveys/${surveyId}/results?view=${value}`)} className="w-full flex-grow flex flex-col">
                <div className="flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <TabsList>
                            <TabsTrigger value="responses">All Responses</TabsTrigger>
                            <TabsTrigger value="analytics">Analytics</TabsTrigger>
                            <TabsTrigger value="ai-summaries">AI Summaries</TabsTrigger>
                        </TabsList>
                        {activeTab === 'responses' ? (
                            <Button onClick={handleExport} disabled={!responses || responses.length === 0}>
                                <Download className="mr-2 h-4 w-4" />
                                Export as CSV
                            </Button>
                        ) : (
                             <RainbowButton onClick={handleGenerateSummary} disabled={isGeneratingSummary}>
                                {isGeneratingSummary ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                {isGeneratingSummary ? 'Analyzing...' : 'Generate New AI Summary'}
                            </RainbowButton>
                        )}
                    </div>
                </div>

                <TabsContent value="responses" className="mt-4 flex-grow relative">
                    <div className="absolute inset-0">
                        <ResponsesListView survey={survey} responses={responses || []} isLoading={areResponsesLoading} />
                    </div>
                </TabsContent>
                <TabsContent value="analytics" className="mt-4 flex-grow relative">
                     <div className="absolute inset-0">
                        <ScrollArea className="h-full pr-4">
                            <AnalyticsView survey={survey} responses={responses || []} />
                        </ScrollArea>
                     </div>
                </TabsContent>
                 <TabsContent value="ai-summaries" className="mt-4 flex-grow relative">
                    <div className="absolute inset-0">
                        <ScrollArea className="h-full pr-4">
                        {responses ? (
                            <AISummariesView survey={survey} responses={responses} />
                        ) : (
                            <div className="text-center py-20 text-muted-foreground">Loading responses...</div>
                        )}
                        </ScrollArea>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
