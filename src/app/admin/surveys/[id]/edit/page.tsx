
'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { doc, collection, getDocs, updateDoc, setDoc, query, orderBy, where } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { 
    Check, 
    Loader2, 
    ArrowLeft, 
    ArrowRight, 
    Save, 
    Undo,
    Redo,
    X,
    Sparkles,
    Zap,
    Share2,
    Settings2,
    Layout,
    Eye
} from 'lucide-react';
import { type Survey, type SurveyElement, type SurveyQuestion, type SurveyResultPage, type School, type WorkspaceEntity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { useSetBreadcrumb } from '@/hooks/use-set-breadcrumb';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { SmartSappIcon } from '@/components/icons';
import { syncVariableRegistry } from '@/lib/messaging-actions';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// Extracted Modular Components
import Step1Details from '../../components/step-1-details';
import SurveyFormBuilder from '../../components/survey-form-builder';
import ResultsStep from '../../components/results-step';
import Step4Publish from '../../components/step-4-publish';
import LivePreviewPane from '../../components/live-preview-pane';
import ValidationErrorModal, { type ValidationError } from '../../components/validation-error-modal';
import AiChatEditor from '../../components/ai-chat-editor';

const formSchema = z.object({
  internalName: z.string().min(2, { message: 'Internal name must be at least 2 characters.' }),
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  elements: z.array(z.any()).min(1, 'Survey must have at least one element.'),
  thankYouTitle: z.string().optional(),
  thankYouDescription: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  bannerImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  videoUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  videoThumbnailUrl: z.string().url().optional().or(z.literal('')),
  videoCaption: z.string().optional(),
  backgroundColor: z.string().optional(),
  backgroundPattern: z.enum(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient']).default('none'),
  patternColor: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  slug: z.string().min(3, 'Slug must be at least 3 characters.').regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  webhookId: z.string().optional(),
  webhookEnabled: z.boolean().default(false),
  showDebugProcessingModal: z.boolean().default(false),
  scoringEnabled: z.boolean().default(false),
  scoreDisplayMode: z.enum(['points', 'percentage']).default('points'),
  maxScore: z.number().min(0).default(100),
  resultRules: z.array(z.any()).default([]),
  resultPages: z.array(z.any()).default([]),
  startButtonText: z.string().optional(),
  showCoverPage: z.boolean().default(true),
  showSurveyTitles: z.boolean().default(true),
  adminAlertsEnabled: z.boolean().default(false),
  adminAlertChannel: z.enum(['email', 'sms', 'both']).default('both'),
  adminAlertNotifyManager: z.boolean().default(false),
  adminAlertSpecificUserIds: z.array(z.string()).default([]),
  adminAlertEmailTemplateId: z.string().optional(),
  adminAlertSmsTemplateId: z.string().optional(),
  schoolId: z.string().optional().nullable(),
  schoolName: z.string().optional().nullable(),
  workspaceIds: z.array(z.string()).min(1, 'At least one workspace required.'),
});

type FormData = z.infer<typeof formSchema>;

const Stepper = ({ currentStep, onStepClick }: { currentStep: number, onStepClick: (step: number) => void }) => {
    const steps = [
        { n: 1, label: 'Details', icon: Settings2 },
        { n: 2, label: 'Builder', icon: Layout },
        { n: 3, label: 'Results', icon: Zap },
        { n: 4, label: 'Publish', icon: Share2 }
    ];

    return (
        <div className="flex justify-center items-center mb-12 max-w-2xl mx-auto px-4">
            {steps.map((step, index) => {
                const isActive = currentStep === step.n;
                const isCompleted = currentStep > step.n;
                const Icon = step.icon;

                return (
                    <React.Fragment key={step.label}>
                        <button 
                            type="button"
                            onClick={() => onStepClick(step.n)}
                            className="flex flex-col items-center group outline-none"
                        >
                            <div
                                className={cn(
                                    'flex items-center justify-center w-9 h-9 rounded-2xl border-2 transition-all duration-300 shadow-sm',
                                    isCompleted ? 'bg-primary border-primary text-white' : 
                                    isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground',
                                )}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-5 h-5" />}
                            </div>
                            <p className={cn(
                                'mt-3 text-[10px] font-black uppercase tracking-widest transition-colors', 
                                isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
                            )}>
                                {step.label}
                            </p>
                        </button>
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-4 h-[2px] bg-muted rounded-full overflow-hidden relative">
                                <motion.div 
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    className="absolute inset-0 bg-primary"
                                />
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
};

export default function EditSurveyPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const firestore = useFirestore();
    const surveyId = params.id as string;
    const { toast } = useToast();
    const { activeWorkspaceId } = useWorkspace();
    
    // UI State
    const [step, setStep] = React.useState(1);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isErrorModalOpen, setIsErrorModalOpen] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);
    const [hasInitialized, setHasInitialized] = React.useState(false);
    const [mobileMode, setMobileMode] = React.useState<'edit' | 'preview'>('edit');

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return doc(firestore, 'surveys', surveyId as string);
    }, [firestore, surveyId]);

    const { data: survey, isLoading } = useDoc<Survey>(surveyDocRef);
    
    useSetBreadcrumb(survey?.internalName || survey?.title, `/admin/surveys/${surveyId}`);

    const institutionsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId) return null;
        return query(collection(firestore, 'workspace_entities'), where('workspaceId', '==', activeWorkspaceId), where('entityType', '==', 'institution'), orderBy('displayName', 'asc'));
    }, [firestore, activeWorkspaceId]);
    const { data: institutions } = useCollection<WorkspaceEntity>(institutionsQuery);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            elements: [],
            status: 'draft',
            backgroundPattern: 'none',
            scoringEnabled: false,
            adminAlertsEnabled: false,
            workspaceIds: [activeWorkspaceId],
        }
    });

    const { getValues, setValue, watch, reset, trigger } = form;

    const {
        state: historyState,
        set: setHistory,
        undo: undoHistory,
        redo: redoHistory,
        canUndo,
        canRedo,
        reset: resetHistory
    } = useUndoRedo<any>([]);

    const isProgrammaticChange = React.useRef(false);
    const debouncedFields = useDebounce(watch('elements'), 800);

    React.useEffect(() => {
        if (survey && !hasInitialized) {
            const initialData = {
                ...survey,
                internalName: survey.internalName || survey.title,
                elements: survey.elements || [],
                resultRules: survey.resultRules || [],
                workspaceIds: survey.workspaceIds || [activeWorkspaceId],
                resultPages: [], 
            };

            reset(initialData as any);
            resetHistory(initialData.elements);

            if (firestore) {
                const pagesCol = collection(firestore, `surveys/${surveyId}/resultPages`);
                getDocs(pagesCol).then(snap => {
                    const pages = snap.docs.map(d => ({ ...d.data(), id: d.id } as SurveyResultPage));
                    setValue('resultPages', pages);
                });
            }
            setHasInitialized(true);
        }
    }, [survey, reset, resetHistory, firestore, surveyId, setValue, hasInitialized, activeWorkspaceId]);

    React.useEffect(() => {
        const urlStep = searchParams.get('step');
        if (urlStep) {
            const parsed = parseInt(urlStep, 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) setStep(parsed);
        }
    }, [searchParams]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) return;
        setHistory(debouncedFields);
    }, [debouncedFields, setHistory]);

    React.useEffect(() => {
        if (isProgrammaticChange.current) {
            setValue('elements', historyState, { shouldDirty: true });
            isProgrammaticChange.current = false;
        }
    }, [historyState, setValue]);

    const onSubmit = async (data: FormData) => {
        setIsSaving(true);
        const { resultPages, ...mainData } = data;
        
        try {
            const docRef = doc(firestore!, 'surveys', surveyId);
            await updateDoc(docRef, JSON.parse(JSON.stringify({ ...mainData, updatedAt: new Date().toISOString() })));
            
            const pagesCol = collection(firestore!, `surveys/${surveyId}/resultPages`);
            for (const page of resultPages) {
                await setDoc(doc(pagesCol, page.id), page);
            }

            toast({ title: 'Survey Saved Successfully' });
            if (data.status === 'published') {
                syncVariableRegistry().catch(console.error);
            }
            router.push('/admin/surveys');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Save Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (step === 1) fieldsToValidate = ['internalName', 'title', 'description', 'videoUrl', 'videoCaption', 'logoUrl', 'bannerImageUrl'];
        if (step === 2) fieldsToValidate = ['elements'];
        if (step === 3) fieldsToValidate = ['resultRules', 'resultPages'];
        
        const isStepValid = await trigger(fieldsToValidate);
        if (!isStepValid) {
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the errors in this step before proceeding.' });
            return;
        }

        const nextStep = step + 1;
        setStep(nextStep);
        router.push(`${pathname}?step=${nextStep}`, { scroll: false });
    };

    const handleStepChange = async (target: number) => {
        if (target === step) return;
        if (target > step) {
            const isStepValid = await trigger();
            if (!isStepValid) return;
        }
        setStep(target);
        router.push(`${target === 1 ? pathname : `${pathname}?step=${target}`}`, { scroll: false });
    };

    const handleUndo = () => { if (canUndo) { isProgrammaticChange.current = true; undoHistory(); } };
    const handleRedo = () => { if (canRedo) { isProgrammaticChange.current = true; redoHistory(); } };

    if (isLoading || !hasInitialized) return <div className="flex h-full items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

    return (
        <FormProvider {...form}>
            <div className="h-full flex flex-col bg-muted/30">
                <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4 text-left">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <SmartSappIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-black text-sm uppercase tracking-tight leading-none mb-1 truncate max-w-[200px]">
                                {survey?.internalName || 'Survey Studio'}
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] h-4 font-black uppercase border-primary/20 text-primary bg-primary/5">Studio</Badge>
                                <span className="text-[10px] text-muted-foreground font-medium italic">Drafting...</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <div className="flex items-center gap-1 mr-4 bg-muted/30 p-1 rounded-xl border">
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleUndo} disabled={!canUndo}><Undo className="h-4 w-4" /></Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Undo</TooltipContent>
                                    </Tooltip>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={handleRedo} disabled={!canRedo}><Redo className="h-4 w-4" /></Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Redo</TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>
                        )}
                        <AiChatEditor className="h-9" />
                        <Button 
                            type="submit" 
                            disabled={isSaving} 
                            onClick={form.handleSubmit(onSubmit)}
                            className="rounded-xl font-black shadow-lg gap-2 px-6 h-10 uppercase text-[10px] tracking-widest active:scale-95 transition-all"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Commit Changes
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <Stepper currentStep={step} onStepClick={handleStepChange} />

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        <div className={cn("space-y-8")}>
                                            <Step1Details institutions={institutions || []} />
                                        </div>
                                        <div className={cn("sticky top-0 h-[calc(100vh-250px)]")}>
                                            <LivePreviewPane />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <SurveyFormBuilder />
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                                    <ResultsStep />
                                </motion.div>
                            )}

                            {step === 4 && (
                                <motion.div key="step4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                                    <Step4Publish />
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-8 p-4 sm:p-6 bg-background border-t">
                            <div className="max-w-7xl mx-auto flex items-center justify-between text-left">
                                <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')} className="font-bold text-muted-foreground rounded-xl px-6 h-12">Cancel</Button>
                                <div className="flex items-center gap-4 text-left">
                                    {step > 1 && <Button type="button" variant="outline" onClick={() => handleStepChange(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12 gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>}
                                    {step < 4 ? (
                                        <Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-black shadow-xl rounded-xl transition-all active:scale-95 group">
                                            Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    ) : (
                                        <Button type="submit" disabled={isSaving} onClick={form.handleSubmit(onSubmit)} className="gap-2 px-12 h-14 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg">
                                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-4 w-4" />} 
                                            Finalize & Save
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <ValidationErrorModal open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen} errors={validationErrors} onFix={(id) => { setIsErrorModalOpen(false); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100); }} />
            </div>
        </FormProvider>
    );
}
