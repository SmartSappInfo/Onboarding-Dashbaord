'use client';

/**
 * @fileoverview SmartSapp Survey Intelligence 2.0 — AI Survey Architect Container
 *
 * ARCHITECTURAL GUIDELINES (Rule 10 & Strict Zero-Any Invariant):
 * 1. Unified Multi-Modal Experience: Mounts <UnifiedAiArchitectStudio> for composing prompts, documents,
 *    links, and model selection without fragmented tab silos.
 * 2. Synthesis Cockpit: Smoothly transitions into <ArchitectSynthesisCockpit> during generation with zero layout shift.
 * 3. Chunked Architecture & Recovery: Retains intermediate blueprint and question caches to enable instant recovery on retry.
 * 4. Self-Improving Learning Loop: Preserves learning signal creation via `createLearningSignalAction`.
 * 5. Strict Zero-Any Invariant: Completely typed without `any` or `any[]`.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { addDoc, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Survey } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useLiveAiModel } from '@/hooks/use-live-ai-model';
import { FileText, MessageSquare, Zap, Save } from 'lucide-react';

// Chunked AI flow imports (server actions)
import {
  generateSurveyBlueprint,
  generateSurveyQuestions,
  generateSurveyLogic,
} from '@/ai/flows/generate-survey-chunked-flow';

// Pure merge utility (runs client-side)
import { mergeSurveyPhases } from '@/ai/utils/merge-survey-phases';

// Legacy fallback
import { generateSurvey } from '@/ai/flows/generate-survey-flow';

import { createLearningSignalAction } from '@/lib/learning-loop-actions';
import {
  type SystemAiArchitectGovernanceConfig,
  getSystemAiArchitectGovernanceAction,
} from '@/lib/surveys/survey-ai-architect-governance-actions';
import {
  type AttachedSourceFile,
  type AttachedSourceUrl,
  type ArchitectIntentConfig,
} from '@/lib/surveys/survey-source-extractor';
import { UnifiedAiArchitectStudio } from './UnifiedAiArchitectStudio';
import {
  ArchitectSynthesisCockpit,
  type SynthesisPhaseId,
  type SynthesisPhaseState,
} from './ArchitectSynthesisCockpit';

interface GeneratedSurveyData {
  title: string;
  description: string;
  elements: unknown[];
  scoringEnabled: boolean;
  maxScore: number;
  resultRules: unknown[];
  resultPages?: Array<Record<string, unknown> & { id: string }>;
  thankYouTitle: string;
  thankYouDescription: string;
  bannerImageQuery: string;
  aiMetadata?: {
    isAiGenerated: boolean;
    learningSignalId: string;
    isFirstPublishComplete: boolean;
    sourceMode?: string;
  };
}

const INITIAL_PHASES: SynthesisPhaseState[] = [
  { id: 'blueprint', label: 'Blueprint', description: 'Analyzing content & designing structure', status: 'idle', icon: FileText },
  { id: 'questions', label: 'Questions', description: 'Generating questions & layout blocks', status: 'idle', icon: MessageSquare },
  { id: 'logic', label: 'Logic & Scoring', description: 'Adding scoring, logic & outcome pages', status: 'idle', icon: Zap },
  { id: 'saving', label: 'Saving', description: 'Persisting survey to database', status: 'idle', icon: Save },
];

// Short content threshold — use legacy monolithic flow for very simple inputs with no documents
const SIMPLE_CONTENT_THRESHOLD = 500;

export default function AiSurveyGenerator() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeOrganizationId, activeWorkspaceId } = useWorkspace();
  const { provider: liveProvider, modelId: liveModelId } = useLiveAiModel();

  const [isGenerating, setIsGenerating] = React.useState(false);
  const [phases, setPhases] = React.useState<SynthesisPhaseState[]>(INITIAL_PHASES);
  const [showProgress, setShowProgress] = React.useState(false);
  const [governanceConfig, setGovernanceConfig] = React.useState<SystemAiArchitectGovernanceConfig | undefined>(undefined);

  // Cached intermediate results for retry
  const blueprintRef = React.useRef<unknown>(null);
  const questionsRef = React.useRef<{ elements: unknown[] } | null>(null);
  const logicRef = React.useRef<unknown>(null);
  const sourceTextRef = React.useRef<string>('');
  const rawPromptRef = React.useRef<string>('');
  const providerRef = React.useRef<string>('googleai');
  const modelIdRef = React.useRef<string>('gemini-3.5-flash');
  const keyLevelRef = React.useRef<string>('App API');

  // Load governance configuration on mount
  React.useEffect(() => {
    let isMounted = true;
    void getSystemAiArchitectGovernanceAction().then((res) => {
      if (isMounted && res.success && res.config) {
        setGovernanceConfig(res.config);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const updatePhase = (id: SynthesisPhaseId, updates: Partial<SynthesisPhaseState>) => {
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const resetPhases = () => {
    setPhases(INITIAL_PHASES);
    blueprintRef.current = null;
    questionsRef.current = null;
    logicRef.current = null;
  };

  const getFailedPhase = (): SynthesisPhaseId | null => {
    const failed = phases.find((p) => p.status === 'failed');
    return failed?.id || null;
  };

  const resolveModel = async () => {
    const provider = liveProvider;
    const modelId = liveModelId;
    let keyLevel = 'App API';

    if (user && firestore && activeOrganizationId) {
      const orgRef = doc(firestore, 'organizations', activeOrganizationId);
      const orgSnap = await getDoc(orgRef);
      if (orgSnap.exists()) {
        const orgData = orgSnap.data();
        if (provider === 'googleai' && orgData.geminiApiKey) keyLevel = 'Org API';
        else if (provider === 'anthropic' && (orgData.claudeApiKey || orgData.anthropicApiKey)) keyLevel = 'Org API';
        else if (provider === 'openrouter' && orgData.openRouterApiKey) keyLevel = 'Org API';
      }
    }

    providerRef.current = provider;
    modelIdRef.current = modelId;
    keyLevelRef.current = keyLevel;
    return { provider, modelId, keyLevel };
  };

  const runChunkedGeneration = async (content: string, sourceType: 'text' | 'url', startFrom?: SynthesisPhaseId) => {
    const { provider, modelId, keyLevel: _keyLevel } = await resolveModel();
    sourceTextRef.current = content;

    const resolvedText = content;

    // Phase 1: Blueprint
    if (!startFrom || startFrom === 'blueprint') {
      updatePhase('blueprint', { status: 'running', error: undefined });
      try {
        blueprintRef.current = await generateSurveyBlueprint({
          sourceType,
          content: resolvedText,
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });
        updatePhase('blueprint', { status: 'complete' });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        updatePhase('blueprint', { status: 'failed', error: err.message });
        throw err;
      }
    }

    // Phase 2: Questions
    if (!startFrom || startFrom === 'blueprint' || startFrom === 'questions') {
      if (!blueprintRef.current) throw new Error('Blueprint missing — cannot generate questions');

      updatePhase('questions', { status: 'running', error: undefined });
      try {
        const typedBlueprint = blueprintRef.current as {
          title: string;
          description: string;
          sections: Array<{
            id: string;
            title: string;
            stepperTitle: string;
            description?: string;
            estimatedQuestions: number;
          }>;
          scoringEnabled: boolean;
          thankYouTitle: string;
          thankYouDescription: string;
          bannerImageQuery: string;
        };
        questionsRef.current = await generateSurveyQuestions({
          sourceText: resolvedText,
          blueprint: typedBlueprint,
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });
        updatePhase('questions', { status: 'complete' });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        updatePhase('questions', { status: 'failed', error: err.message });
        throw err;
      }
    }

    // Phase 3: Logic & Scoring
    if (!startFrom || ['blueprint', 'questions', 'logic'].includes(startFrom)) {
      if (!blueprintRef.current || !questionsRef.current) throw new Error('Previous phases missing');

      updatePhase('logic', { status: 'running', error: undefined });
      try {
        const typedBlueprint = blueprintRef.current as {
          title: string;
          description: string;
          sections: Array<{
            id: string;
            title: string;
            stepperTitle: string;
            description?: string;
            estimatedQuestions: number;
          }>;
          scoringEnabled: boolean;
          thankYouTitle: string;
          thankYouDescription: string;
          bannerImageQuery: string;
        };
        logicRef.current = await generateSurveyLogic({
          blueprint: typedBlueprint,
          elements: questionsRef.current.elements as Parameters<typeof generateSurveyLogic>[0]['elements'],
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });
        updatePhase('logic', { status: 'complete' });
      } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        updatePhase('logic', { status: 'failed', error: err.message });
        throw err;
      }
    }

    // Merge
    if (!blueprintRef.current || !questionsRef.current || !logicRef.current) {
      throw new Error('Cannot merge — incomplete phases');
    }

    return mergeSurveyPhases(
      blueprintRef.current as Parameters<typeof mergeSurveyPhases>[0],
      questionsRef.current as unknown as Parameters<typeof mergeSurveyPhases>[1],
      logicRef.current as Parameters<typeof mergeSurveyPhases>[2]
    );
  };

  const saveSurvey = async (generatedData: GeneratedSurveyData) => {
    if (!firestore) throw new Error('Firestore connection not available');

    updatePhase('saving', { status: 'running' });

    const slug = (generatedData.title + '-' + Math.random().toString(36).substring(2, 5))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const { resultPages, ...mainSurveyData } = generatedData;

    const newSurvey = {
      ...mainSurveyData,
      slug,
      status: 'draft',
      backgroundPattern: 'none',
      workspaceIds: activeWorkspaceId ? [activeWorkspaceId] : [],
      internalName: generatedData.title,
      autoTags: [],
      autoAutomations: [],
      allowCrossVisibility: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as unknown as Omit<Survey, 'id'>;

    const surveysCollection = collection(firestore, 'surveys');
    const docRef = await addDoc(surveysCollection, newSurvey);

    if (!docRef.id) throw new Error('Failed to save the generated survey to the database.');

    // Save result pages to subcollection
    if (resultPages && resultPages.length > 0) {
      const pagesCol = collection(firestore, `surveys/${docRef.id}/resultPages`);
      for (const page of resultPages) {
        await setDoc(doc(pagesCol, page.id), page as Record<string, unknown>);
      }
    }

    updatePhase('saving', { status: 'complete' });
    return docRef.id;
  };

  const handleStudioSubmit = async (payload: {
    prompt: string;
    finalEnvelope: string;
    attachedFiles: AttachedSourceFile[];
    attachedUrls: AttachedSourceUrl[];
    intent: ArchitectIntentConfig;
  }) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore connection is not available.' });
      return;
    }

    const content = payload.finalEnvelope;
    rawPromptRef.current = payload.prompt;
    sourceTextRef.current = content;

    setIsGenerating(true);
    resetPhases();
    setShowProgress(true);

    try {
      const { provider, modelId, keyLevel } = await resolveModel();

      toast({
        title: 'Architect Synthesis Started',
        description: `Model: ${modelId} | Billing: ${keyLevel}`,
      });

      let generatedData: GeneratedSurveyData | null = null;

      // Fast-path: use legacy monolithic flow for short inputs with zero attached files/URLs
      if (
        payload.attachedFiles.length === 0 &&
        payload.attachedUrls.length === 0 &&
        content.length < SIMPLE_CONTENT_THRESHOLD
      ) {
        toast({
          title: 'Quick Synthesis',
          description: 'Using fast-path for concise prompt...',
        });

        const rawGenerated = await generateSurvey({
          sourceType: 'text',
          content,
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });
        generatedData = rawGenerated as unknown as GeneratedSurveyData;

        // Mark all AI phases as complete for the cockpit
        updatePhase('blueprint', { status: 'complete' });
        updatePhase('questions', { status: 'complete' });
        updatePhase('logic', { status: 'complete' });
      } else {
        // Chunked pipeline for rich multi-modal content
        const rawGenerated = await runChunkedGeneration(content, 'text');
        generatedData = rawGenerated as unknown as GeneratedSurveyData;
      }

      if (!generatedData || !generatedData.title) {
        throw new Error('AI model did not return a valid survey structure.');
      }

      // Create Learning Signal before saving survey
      const signalResult = await createLearningSignalAction({
        prompt: payload.prompt || content,
        modelId,
        provider,
        artifactType: 'survey',
        initialState: generatedData,
        workspaceId: activeWorkspaceId || '',
        organizationId: activeOrganizationId || '',
        userId: user ? user.uid : 'system',
      });

      const surveyId = await saveSurvey({
        ...generatedData,
        aiMetadata: {
          isAiGenerated: true,
          learningSignalId: signalResult.success && signalResult.id ? signalResult.id : 'none',
          isFirstPublishComplete: false,
          sourceMode: payload.attachedFiles.length > 0 ? 'multi_modal' : 'text',
        },
      });

      toast({
        title: 'Survey Engine Constructed!',
        description: 'Questions, sections, and scoring have been persisted.',
      });

      // Brief pause to allow the user to see the completed 100% state
      await new Promise((r) => setTimeout(r, 700));
      router.push(`/admin/surveys/${surveyId}/edit`);
    } catch (error: unknown) {
      console.error('[AiSurveyGenerator] Generation error:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      const failedPhase = getFailedPhase();
      toast({
        variant: 'destructive',
        title: failedPhase ? `Failed at ${failedPhase}` : 'Synthesis Paused',
        description: err.message || 'The AI failed to generate the survey. Please try again.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRetry = async () => {
    const failedPhase = getFailedPhase();
    if (!failedPhase || failedPhase === 'saving') return;

    setIsGenerating(true);

    try {
      const generatedData = await runChunkedGeneration(
        sourceTextRef.current,
        'text',
        failedPhase
      );

      if (!generatedData || !generatedData.title) {
        throw new Error('AI model did not return a valid survey structure after retry.');
      }

      const surveyId = await saveSurvey(generatedData as unknown as GeneratedSurveyData);

      toast({
        title: 'Survey Recovered!',
        description: 'Successfully resumed and persisted survey engine.',
      });

      await new Promise((r) => setTimeout(r, 700));
      router.push(`/admin/surveys/${surveyId}/edit`);
    } catch (error: unknown) {
      console.error('[AiSurveyGenerator] Retry error:', error);
      const err = error instanceof Error ? error : new Error(String(error));
      toast({
        variant: 'destructive',
        title: 'Retry Failed',
        description: err.message || 'The retry also failed. Please try modifying your prompt or sources.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full">
      {showProgress ? (
        <ArchitectSynthesisCockpit
          phases={phases}
          isGenerating={isGenerating}
          onRetry={handleRetry}
          onCancel={() => {
            setShowProgress(false);
            setIsGenerating(false);
          }}
        />
      ) : (
        <UnifiedAiArchitectStudio
          isGenerating={isGenerating}
          onSubmit={handleStudioSubmit}
          onCancel={() => router.push('/admin/surveys')}
          governanceConfig={governanceConfig}
        />
      )}
    </div>
  );
}
