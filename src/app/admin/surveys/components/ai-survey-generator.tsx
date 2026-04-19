'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addDoc, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import type { Survey, UserProfile } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import AiModelSelector from '@/components/ai/AiModelSelector';
import { Button as MovingButton } from '@/components/ui/moving-border';
import { Loader2, Sparkles, Check, X, RotateCcw, FileText, MessageSquare, Zap, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

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

const formSchema = z.object({
  sourceType: z.enum(['text', 'url', 'file']),
  text: z.string().optional(),
  url: z.string().optional().refine(val => !val || z.string().url().safeParse(val).success, {
      message: "Please enter a valid URL."
  }),
});

type FormData = z.infer<typeof formSchema>;

type PhaseStatus = 'idle' | 'running' | 'complete' | 'failed';
type PhaseId = 'blueprint' | 'questions' | 'logic' | 'saving';

interface PhaseState {
  id: PhaseId;
  label: string;
  description: string;
  status: PhaseStatus;
  error?: string;
  icon: React.ElementType;
}

const INITIAL_PHASES: PhaseState[] = [
  { id: 'blueprint', label: 'Blueprint', description: 'Analyzing content & designing structure', status: 'idle', icon: FileText },
  { id: 'questions', label: 'Questions', description: 'Generating questions & layout blocks', status: 'idle', icon: MessageSquare },
  { id: 'logic', label: 'Logic & Scoring', description: 'Adding scoring, logic & outcome pages', status: 'idle', icon: Zap },
  { id: 'saving', label: 'Saving', description: 'Persisting survey to database', status: 'idle', icon: Save },
];

// Short content threshold — use legacy monolithic flow for very simple inputs
const SIMPLE_CONTENT_THRESHOLD = 500;

export default function AiSurveyGenerator() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeOrganizationId } = useWorkspace();
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [phases, setPhases] = React.useState<PhaseState[]>(INITIAL_PHASES);
  const [showProgress, setShowProgress] = React.useState(false);

  // Cached intermediate results for retry (typed as any — these are opaque server action returns)
  const blueprintRef = React.useRef<any>(null);
  const questionsRef = React.useRef<any>(null);
  const logicRef = React.useRef<any>(null);
  const sourceTextRef = React.useRef<string>('');
  const providerRef = React.useRef<string>('openrouter');
  const modelIdRef = React.useRef<string>('openrouter/free');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceType: 'text',
    },
  });

  const updatePhase = (id: PhaseId, updates: Partial<PhaseState>) => {
    setPhases(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const resetPhases = () => {
    setPhases(INITIAL_PHASES);
    blueprintRef.current = null;
    questionsRef.current = null;
    logicRef.current = null;
  };

  const getFailedPhase = (): PhaseId | null => {
    const failed = phases.find(p => p.status === 'failed');
    return failed?.id || null;
  };

  const resolveModel = async () => {
    let provider = 'openrouter';
    let modelId = 'openrouter/free';
    
    if (user && firestore) {
      const userRef = doc(firestore, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const profile = userSnap.data() as UserProfile;
        provider = profile.preferredAiProvider || 'openrouter';
        modelId = profile.preferredAiModel || 'openrouter/free';
      }
    }

    providerRef.current = provider;
    modelIdRef.current = modelId;
    return { provider, modelId };
  };

  const runChunkedGeneration = async (content: string, sourceType: 'text' | 'url', startFrom?: PhaseId) => {
    const { provider, modelId } = await resolveModel();
    sourceTextRef.current = content;

    // Resolve source text for URL inputs
    let resolvedText = content;
    if (sourceType === 'url') {
      // URL resolution happens server-side in the flow
      resolvedText = content;
    }

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
      } catch (error: any) {
        updatePhase('blueprint', { status: 'failed', error: error.message });
        throw error;
      }
    }

    // Phase 2: Questions
    if (!startFrom || startFrom === 'blueprint' || startFrom === 'questions') {
      if (!blueprintRef.current) throw new Error('Blueprint missing — cannot generate questions');
      
      updatePhase('questions', { status: 'running', error: undefined });
      try {
        questionsRef.current = await generateSurveyQuestions({
          sourceText: sourceType === 'url' ? resolvedText : resolvedText,
          blueprint: blueprintRef.current,
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });
        updatePhase('questions', { status: 'complete' });
      } catch (error: any) {
        updatePhase('questions', { status: 'failed', error: error.message });
        throw error;
      }
    }

    // Phase 3: Logic & Scoring
    if (!startFrom || ['blueprint', 'questions', 'logic'].includes(startFrom)) {
      if (!blueprintRef.current || !questionsRef.current) throw new Error('Previous phases missing');
      
      updatePhase('logic', { status: 'running', error: undefined });
      try {
        logicRef.current = await generateSurveyLogic({
          blueprint: blueprintRef.current,
          elements: questionsRef.current.elements,
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });
        updatePhase('logic', { status: 'complete' });
      } catch (error: any) {
        updatePhase('logic', { status: 'failed', error: error.message });
        throw error;
      }
    }

    // Merge
    if (!blueprintRef.current || !questionsRef.current || !logicRef.current) {
      throw new Error('Cannot merge — incomplete phases');
    }

    return mergeSurveyPhases(blueprintRef.current, questionsRef.current, logicRef.current);
  };

  const saveSurvey = async (generatedData: any) => {
    if (!firestore) throw new Error('Firestore connection not available');

    updatePhase('saving', { status: 'running' });

    const slug = (generatedData.title + '-' + Math.random().toString(36).substring(2, 5))
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const { resultPages, ...mainSurveyData } = generatedData;

    const newSurvey: Omit<Survey, 'id'> = {
      ...mainSurveyData,
      slug,
      status: 'published',
      backgroundPattern: 'none',
      workspaceIds: [],
      internalName: generatedData.title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const surveysCollection = collection(firestore, 'surveys');
    const docRef = await addDoc(surveysCollection, newSurvey);

    if (!docRef.id) throw new Error('Failed to save the generated survey to the database.');

    // Save result pages to subcollection
    if (resultPages && resultPages.length > 0) {
      const pagesCol = collection(firestore, `surveys/${docRef.id}/resultPages`);
      for (const page of resultPages) {
        await setDoc(doc(pagesCol, page.id), page);
      }
    }

    updatePhase('saving', { status: 'complete' });
    return docRef.id;
  };

  const onSubmit = async (data: FormData) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore connection is not available.' });
      return;
    }

    let content = '';
    let sourceType: 'text' | 'url' = 'text';

    if (form.getValues('sourceType') === 'text') {
      if (!data.text || data.text.length < 50) {
        form.setError('text', { message: 'Please provide at least 50 characters of text.' });
        return;
      }
      content = data.text;
      sourceType = 'text';
    } else if (form.getValues('sourceType') === 'url') {
      if (!data.url) {
        form.setError('url', { message: 'Please provide a URL.' });
        return;
      }
      content = data.url;
      sourceType = 'url';
    }

    setIsGenerating(true);
    resetPhases();
    setShowProgress(true);

    try {
      let generatedData: any;

      // Fast-path: use legacy monolithic flow for very short content
      if (sourceType === 'text' && content.length < SIMPLE_CONTENT_THRESHOLD) {
        toast({
          title: 'Quick Generation',
          description: 'Using fast-path for short content...',
        });

        const { provider, modelId } = await resolveModel();
        generatedData = await generateSurvey({
          sourceType,
          content,
          organizationId: activeOrganizationId,
          provider,
          modelId,
        });

        // Mark all AI phases as complete for the stepper
        updatePhase('blueprint', { status: 'complete' });
        updatePhase('questions', { status: 'complete' });
        updatePhase('logic', { status: 'complete' });
      } else {
        // Chunked pipeline for complex content
        generatedData = await runChunkedGeneration(content, sourceType);
      }

      if (!generatedData || !generatedData.title) {
        throw new Error('AI model did not return a valid survey structure.');
      }

      const surveyId = await saveSurvey(generatedData);

      toast({
        title: 'Survey Generated!',
        description: 'The AI has configured questions, scoring, and outcome pages.',
      });

      // Brief pause to show completion state
      await new Promise(r => setTimeout(r, 800));
      router.push(`/admin/surveys/${surveyId}/edit`);

    } catch (error: any) {
      console.error(error);
      const failedPhase = getFailedPhase();
      toast({
        variant: 'destructive',
        title: failedPhase ? `Failed at ${failedPhase}` : 'Generation Failed',
        description: error.message || 'The AI failed to generate the survey. Please try again.',
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

      const surveyId = await saveSurvey(generatedData);

      toast({
        title: 'Survey Generated!',
        description: 'Successfully recovered and generated the survey.',
      });

      await new Promise(r => setTimeout(r, 800));
      router.push(`/admin/surveys/${surveyId}/edit`);

    } catch (error: any) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Retry Failed',
        description: error.message || 'The retry also failed. Please try again with different content.',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const hasFailure = phases.some(p => p.status === 'failed');

  return (
 <Card className="max-w-3xl mx-auto shadow-2xl border bg-card/40 backdrop-blur-md rounded-[2rem] overflow-hidden">
 <CardHeader className="p-8 pb-8 border-b border-border/50 bg-transparent text-left relative">
 <div className="flex items-center justify-between mb-6">
 <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center border border-primary/20 shadow-inner">
 <Sparkles className="h-6 w-6 text-primary" />
            </div>
 <CardTitle className="text-2xl font-semibold tracking-tight">AI Survey Architect</CardTitle>
        </div>
 <CardDescription className="text-sm font-medium text-muted-foreground">Provide your source material and the AI will build a complete, scored assessment flow for you.</CardDescription>
        
 <div className="mt-8 flex flex-col items-start">
 <AiModelSelector className="items-start" />
        </div>
    </CardHeader>
 <CardContent className="p-8 pt-8">
        {/* Progress Stepper */}
        {showProgress && (
 <div className="mb-8 p-6 rounded-2xl bg-muted/30 border border-border/50">
 <div className="grid grid-cols-4 gap-3">
              {phases.map((phase, index) => {
                const Icon = phase.icon;
                const isActive = phase.status === 'running';
                const isComplete = phase.status === 'complete';
                const isFailed = phase.status === 'failed';

                return (
 <div key={phase.id} className="flex flex-col items-center text-center gap-2">
 <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                      isComplete && "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20",
                      isActive && "bg-primary border-primary text-white shadow-lg shadow-primary/30 animate-pulse",
                      isFailed && "bg-destructive border-destructive text-white shadow-lg shadow-destructive/20",
                      !isComplete && !isActive && !isFailed && "bg-muted border-border text-muted-foreground"
                    )}>
                      {isComplete && <Check className="h-4 w-4" />}
                      {isActive && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isFailed && <X className="h-4 w-4" />}
                      {phase.status === 'idle' && <Icon className="h-4 w-4" />}
                    </div>
 <div>
 <p className={cn(
                        "text-[10px] font-bold uppercase tracking-widest",
                        isActive && "text-primary",
                        isComplete && "text-emerald-600",
                        isFailed && "text-destructive",
                        phase.status === 'idle' && "text-muted-foreground"
                      )}>
                        {phase.label}
                      </p>
 <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight hidden sm:block">
                        {isFailed ? phase.error?.substring(0, 40) : phase.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Retry Button */}
            {hasFailure && !isGenerating && (
 <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-center gap-3">
 <p className="text-xs text-muted-foreground font-medium">
                  Previous phases are cached — retry resumes from the failed step.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleRetry}
                  className="rounded-xl font-bold gap-2"
                >
 <RotateCcw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              </div>
            )}
          </div>
        )}

        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Tabs
                    defaultValue="text"
 className="w-full"
                    onValueChange={(value) => form.setValue('sourceType', value as 'text' | 'url' | 'file')}
                >
 <TabsList className="grid w-full grid-cols-3 h-12 bg-background/50 border shadow-inner p-1 rounded-2xl mb-8">
 <TabsTrigger value="text" className="font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">Paste Text</TabsTrigger>
 <TabsTrigger value="url" className="font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">From URL</TabsTrigger>
 <TabsTrigger value="file" disabled className="font-bold rounded-xl opacity-50">Upload File (Soon)</TabsTrigger>
                </TabsList>
 <TabsContent value="text" className="mt-0">
                    <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
 <FormItem className="space-y-4">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Source Material</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Paste a document outline, a list of requirements, or a quiz draft here..."
 className="min-h-[250px] text-sm leading-relaxed p-6 rounded-[2rem] bg-background/30 border-border/50 shadow-inner resize-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                        {...field}
                                    />
                                </FormControl>
 <FormDescription className="text-xs font-medium ml-1">
                                    The AI will identify questions, sections, and logic rules based on your text.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>
 <TabsContent value="url" className="mt-0">
                    <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
 <FormItem className="space-y-4">
 <FormLabel className="text-[10px] font-semibold text-muted-foreground ml-1">Target URL</FormLabel>
                                <FormControl>
 <Input placeholder="https://..." {...field} value={field.value ?? ''} className="h-14 text-base rounded-2xl bg-background/30 border-border/50 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20 px-6" />
                                </FormControl>
 <FormDescription className="text-xs font-medium ml-1">
                                    Link to a public article, Google Doc, or webpage to parse for content.
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </TabsContent>
            </Tabs>
 <div className="flex justify-between items-center mt-12 border-t border-border/50 pt-8">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => router.push('/admin/surveys')}
                      disabled={isGenerating}
 className="font-bold rounded-xl px-6 h-12 text-muted-foreground hover:text-foreground"
                    >
                        Cancel
                    </Button>
                    <MovingButton 
                        type="submit" 
                        disabled={isGenerating} 
                        containerClassName="h-14 px-8 rounded-full"
 className="h-full w-full font-semibold text-sm gap-3 bg-[#0f172a] text-white hover:bg-[#0f172a]/90 border border-slate-700 shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]"
                    >
 {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                        {isGenerating ? 'Building Engine...' : 'Generate Intelligent Survey'}
                    </MovingButton>
                </div>
            </form>
        </Form>
    </CardContent>
</Card>
  );
}
