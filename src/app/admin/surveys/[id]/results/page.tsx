'use client';

/**
 * @fileOverview SmartSapp Survey Intelligence 2.0 — Analytics 2.0 Results Control Plane
 * 
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Multi-Tab Unified Analytics Control Plane:
 *    - Responses List, Overview Trends, Question Intelligence, 2D Cross-Tabs, Funnel Drop-off, Data Quality, and AI Summaries.
 * 2. Enterprise Export Engine:
 *    - Powered by ExportSurveyDataDialog with OWASP formula protection and streaming CSV/JSON downloads.
 * 3. Mobile-First Ergonomics & Accessibility (WCAG 2.1 AA):
 *    - Touch targets min-h-[44px], active:scale-[0.97] tactile press compression.
 * 4. Strict Zero-Any Invariant.
 */

import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from 'react';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import type { Survey, SurveyResponse, SurveyQuestion, SurveySummary } from "@/lib/types";
import { doc, collection, query, orderBy, addDoc } from 'firebase/firestore';
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Sparkles,
  Loader2,
  Download,
  BarChart3,
  FileText,
  Brain,
  Users,
  Table as TableIcon,
  Filter,
  ShieldCheck,
  ListOrdered,
} from "lucide-react";
import { RainbowButton } from "@/components/ui/rainbow-button";
import { useToast } from "@/hooks/use-toast";
import { generateSurveySummary } from "@/ai/flows/generate-survey-summary-flow";
import { useLiveAiModel } from "@/hooks/use-live-ai-model";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from '@/components/ui/skeleton';
import dynamic from 'next/dynamic';

import ResponsesListView from "./components/responses-list-view";
import AnalyticsView from "./components/analytics-view";
import AISummariesView from "./components/ai-summaries-view";
import { QuestionAnalyticsTab } from "./components/QuestionAnalyticsTab";
import { CrossTabsTab } from "./components/CrossTabsTab";
import { FunnelDropoffTab } from "./components/FunnelDropoffTab";
import { ResponseQualityTab } from "./components/ResponseQualityTab";
import { ExportSurveyDataDialog } from "./components/ExportSurveyDataDialog";
import { useSetBreadcrumb } from "@/hooks/use-set-breadcrumb";
import { useWorkspace } from "@/context/WorkspaceContext";
import AiModelSelector from "@/components/ai/AiModelSelector";

// Lazy-load Field Team view since it's behind a conditional tab
const FieldTeamView = dynamic(() => import('./components/field-team-view'), {
  loading: () => (
    <div className="flex h-64 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

function SurveyResultsPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const { id: surveyIdParam } = params;
  const surveyId = String(surveyIdParam);
  const { toast } = useToast();
  const { user } = useUser();
  const { activeOrganizationId, activeWorkspaceId } = useWorkspace();
  const [isGeneratingSummary, setIsGeneratingSummary] = React.useState(false);
  const [showExportDialog, setShowExportDialog] = React.useState(false);
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
    return doc(firestore, 'surveys', surveyId);
  }, [firestore, surveyId]);

  const { data: survey, isLoading: isSurveyLoading } = useDoc<Survey>(surveyDocRef);

  useSetBreadcrumb(
    survey?.internalName || survey?.title ? String(survey.internalName || survey.title) + ' — Analytics' : 'Survey Analytics',
    '/admin/surveys/' + surveyId + '/results'
  );

  const responsesColRef = useMemoFirebase(() => {
    if (!firestore || !surveyId) return null;
    return query(collection(firestore, 'surveys', surveyId, 'responses'), orderBy("submittedAt", "desc"));
  }, [firestore, surveyId]);

  const { data: responses, isLoading: areResponsesLoading } = useCollection<SurveyResponse>(responsesColRef);

  const summariesColRef = useMemoFirebase(() => {
    if (!firestore || !surveyId) return null;
    return query(collection(firestore, 'surveys', surveyId, 'summaries'), orderBy("createdAt", "desc"));
  }, [firestore, surveyId]);

  const { data: summaries, isLoading: areSummariesLoading } = useCollection<SurveySummary>(summariesColRef);

  const filteredResponses = React.useMemo(() => {
    if (!responses) return [];
    return responses.filter(response => {
      // 1. Column filters
      for (const [columnId, allowedValues] of Object.entries(columnFilters)) {
        if (!allowedValues || allowedValues.length === 0) continue;
        const ansObj = response.answers?.find((a) => a.questionId === columnId);
        const answer = ansObj ? ansObj.value : undefined;
        const stringVal = answer !== undefined && answer !== null ? String(answer) : "";
        if (!allowedValues.includes(stringVal)) {
          return false;
        }
      }

      // 2. Field Team Attribution filter
      if (attributionFilter !== 'all') {
        if (attributionFilter === 'unassigned') {
          if (response.assignedUserId) return false;
        } else {
          if (response.assignedUserId !== attributionFilter) return false;
        }
      }

      return true;
    });
  }, [responses, columnFilters, attributionFilter]);

  const handleGenerateSummary = async () => {
    if (!survey || !filteredResponses || filteredResponses.length === 0 || !firestore) {
      toast({
        variant: "destructive",
        title: "Cannot Generate Summary",
        description: "No responses available to analyze."
      });
      return;
    }

    setIsGeneratingSummary(true);
    try {
      const summaryResult = await generateSurveySummary({
        survey: survey as unknown as Record<string, unknown>,
        responses: filteredResponses as unknown as Record<string, unknown>[],
        organizationId: activeOrganizationId || undefined,
        provider: liveProvider,
        modelId: liveModelId,
      });

      await addDoc(collection(firestore, 'surveys', surveyId, 'summaries'), {
        ...summaryResult,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || 'anonymous',
        responseCount: filteredResponses.length
      });

      toast({
        title: "AI Summary Generated",
        description: "Survey insights have been synthesized successfully."
      });
    } catch (err: unknown) {
      console.error("AI Summary generation failed:", err);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: err instanceof Error ? err.message : "Failed to generate AI summary."
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  if (isSurveyLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!survey) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-12">
        <p className="text-lg font-medium text-muted-foreground">Survey not found.</p>
        <Button onClick={() => router.push('/admin/surveys')}>Back to Surveys</Button>
      </div>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => router.push('/admin/surveys/' + surveyId + '/results?view=' + value)}
      className="flex h-full flex-col"
    >
      <div className="shrink-0 border-b border-border/70 bg-card/40 backdrop-blur-md p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <TabsList className="bg-muted/60 p-1 rounded-2xl h-auto flex flex-wrap gap-1 border border-border/50">
            <TabsTrigger
              value="responses"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <FileText className="mr-1.5 h-3.5 w-3.5" /> Responses
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Overview
            </TabsTrigger>
            <TabsTrigger
              value="questions"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <ListOrdered className="mr-1.5 h-3.5 w-3.5" /> Questions
            </TabsTrigger>
            <TabsTrigger
              value="crosstabs"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <TableIcon className="mr-1.5 h-3.5 w-3.5" /> Cross-Tabs
            </TabsTrigger>
            <TabsTrigger
              value="funnel"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" /> Funnel
            </TabsTrigger>
            <TabsTrigger
              value="quality"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Data Quality
            </TabsTrigger>
            <TabsTrigger
              value="ai-summaries"
              className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
            >
              <Brain className="mr-1.5 h-3.5 w-3.5" /> AI Summaries
            </TabsTrigger>
            {survey.assignmentEnabled && (survey.assignedUsers?.length ?? 0) > 0 && (
              <TabsTrigger
                value="field-team"
                className="rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-background data-[state=active]:text-primary transition-all active:scale-[0.97]"
              >
                <Users className="mr-1.5 h-3.5 w-3.5" /> Field Team
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex shrink-0 items-center gap-3 flex-wrap">
            <AiModelSelector hideLabel className="scale-90" />
            <Button
              variant="outline"
              onClick={() => setShowExportDialog(true)}
              className="h-10 px-4 rounded-xl text-xs font-semibold hover:bg-muted active:scale-[0.97]"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export Data
            </Button>
            <RainbowButton
              onClick={handleGenerateSummary}
              disabled={isGeneratingSummary}
              className="h-10 px-5 gap-2 font-semibold text-xs shadow-md active:scale-95 text-white"
            >
              {isGeneratingSummary ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isGeneratingSummary ? 'Analyzing...' : 'AI Summary'}
            </RainbowButton>
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

        <TabsContent value="questions" className="m-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <QuestionAnalyticsTab
              survey={survey}
              responses={filteredResponses}
            />
          </div>
        </TabsContent>

        <TabsContent value="crosstabs" className="m-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <CrossTabsTab
              survey={survey}
              responses={filteredResponses}
            />
          </div>
        </TabsContent>

        <TabsContent value="funnel" className="m-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <FunnelDropoffTab
              survey={survey}
              responses={filteredResponses}
            />
          </div>
        </TabsContent>

        <TabsContent value="quality" className="m-0">
          <div className="p-4 sm:p-6 lg:p-8">
            <ResponseQualityTab
              survey={survey}
              responses={filteredResponses}
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

      {/* Enterprise Export Dialog */}
      <ExportSurveyDataDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        surveyId={surveyId}
        workspaceId={activeWorkspaceId || ''}
      />
    </Tabs>
  );
}

export default function SurveyResultsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-full w-full items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SurveyResultsPageContent />
    </React.Suspense>
  );
}
