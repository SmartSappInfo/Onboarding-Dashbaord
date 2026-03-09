'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, usePathname } from 'next/navigation';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';
import { 
    Check, 
    Loader2, 
    ArrowLeft, 
    ArrowRight, 
    Save, 
    ShieldCheck, 
    Plus,
    Layout,
    Eye,
    Settings2,
    Undo,
    Redo,
    X,
    Sparkles,
    Zap,
    Share2
} from 'lucide-react';
import { type Survey, type SurveyElement, type SurveyQuestion, type SurveyResultPage, type School } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useUndoRedo } from '@/hooks/use-undo-redo';
import { useDebounce } from '@/hooks/use-debounce';
import { AnimatePresence, motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { SmartSappIcon } from '@/components/icons';
import { syncVariableRegistry } from '@/lib/messaging-actions';
import { cn } from '@/lib/utils';

// Extracted Modular Components
import Step1Details from '../components/step-1-details';
import SurveyFormBuilder from '../components/survey-form-builder';
import ResultsStep from '../components/results-step';
import Step4Publish from '../components/step-4-publish';
import LivePreviewPane from '../components/live-preview-pane';
import ValidationErrorModal, { type ValidationError } from '../components/validation-error-modal';
import AiChatEditor from '../components/ai-chat-editor';

const questionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Question title is required.'),
  type: z.enum(['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload', 'email', 'phone']),
  options: z.array(z.string().min(1, 'Option cannot be empty')).optional(),
  allowOther: z.boolean().optional(),
  isRequired: z.boolean(),
  hidden: z.boolean().optional(),
  placeholder: z.string().optional(),
  defaultValue: z.any().optional(),
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  enableScoring: z.boolean().optional(),
  optionScores: z.array(z.number()).optional(),
  yesScore: z.number().optional(),
  noScore: z.number().optional(),
  autoAdvance: z.boolean().optional(),
}).refine(data => {
    if ((data.type === 'multiple-choice' || data.type === 'checkboxes' || data.type === 'dropdown') && (!data.options || data.options.length < 2)) {
        return false;
    }
    return true;
}, {
    message: 'Must have at least two options.',
    path: ['options'],
});

const layoutBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed', 'section']),
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().url().optional(),
  html: z.string().optional(),
  hidden: z.boolean().optional(),
  description: z.string().optional(),
  renderAsPage: z.boolean().optional(),
  validateBeforeNext: z.boolean().optional(),
  stepperTitle: z.string().optional(),
}).refine(data => {
    if (data.type === 'heading' && !data.title) return false;
    if (data.type === 'description' && !data.text) return false;
    if (data.type === 'section' && !data.title) return false;
    return true;
}, {
    message: 'This block requires content.',
    path: ['title']
});

const logicActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('jump'), targetElementId: z.string().min(1, 'Target element is required.') }),
  z.object({ type: z.literal('require'), targetElementIds: z.array(z.string()).min(1, 'At least one target is required.') }),
  z.object({ type: z.literal('show'), targetElementIds: z.array(z.string()).min(1, 'At least one target is required.') }),
  z.object({ type: z.literal('hide'), targetElementIds: z.array(z.string()).min(1, 'At least one target is required.') }),
  z.object({ type: z.literal('disableSubmit') }),
]);

const logicBlockSchema = z.object({
  id: z.string(),
  type: z.literal('logic'),
  rules: z.array(z.object({
    sourceQuestionId: z.string().min(1, 'Source question is required.'),
    operator: z.enum(['isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'startsWith', 'doesNotStartWith', 'endsWith', 'doesNotEndWith', 'isEmpty', 'isNotEmpty', 'isGreaterThan', 'isLessThan']),
    targetValue: z.any().optional(),
    action: logicActionSchema,
  })).min(1, 'Logic block must have at least one rule.'),
});

const elementSchema = z.union([questionSchema, layoutBlockSchema, logicBlockSchema]);

const formSchema = z.object({
  internalName: z.string().min(2, { message: 'Internal name must be at least 2 characters.' }),
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  elements: z.array(elementSchema).min(1, 'Survey must have at least one element.'),
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
  automationMessagingEnabled: z.boolean().default(false),
  schoolId: z.string().optional().nullable(),
  schoolName: z.string().optional().nullable(),
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
                                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
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

export default function NewSurveyPage() {
    const router = useRouter();
    const pathname = usePathname();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { user } = useUser();
    
    // UI State
    const [step, setStep] = React.useState(1);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isErrorModalOpen, setIsErrorModalOpen] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);
    const [mobileMode, setMobileMode] = React.useState<'edit' | 'preview'>('edit');

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'schools'), orderBy('name', 'asc'));
    }, [firestore]);
    const { data: schools } = useCollection<School>(schoolsQuery);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            internalName: '',
            title: '',
            description: '',
            status: 'draft',
            elements: [
                {
                    id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: 'section',
                    title: 'Section 1',
                    description: '',
                    renderAsPage: false,
                    hidden: false,
                } as any,
            ],
            thankYouTitle: 'Thank You!',
            thankYouDescription: 'Your response has been recorded.',
            logoUrl: '',
            bannerImageUrl: '',
            videoUrl: '',
            videoThumbnailUrl: '',
            videoCaption: '',
            backgroundColor: '#F1F5F9',
            backgroundPattern: 'none',
            patternColor: '#3B5FFF',
            slug: '',
            webhookId: '',
            webhookEnabled: false,
            showDebugProcessingModal: false,
            scoringEnabled: false,
            scoreDisplayMode: 'points',
            maxScore: 100,
            resultRules: [],
            resultPages: [],
            startButtonText: 'Let\'s Start',
            showCoverPage: true,
            showSurveyTitles: true,
            adminAlertsEnabled: false,
            adminAlertChannel: 'both',
            adminAlertNotifyManager: false,
            adminAlertSpecificUserIds: [],
        },
    });

    const { getValues, setValue, watch, trigger, reset } = form;

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
        resetHistory(getValues('elements'));
    }, [getValues, resetHistory]);

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
            const surveyRef = await addDoc(collection(firestore!, 'surveys'), {
                ...mainData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            if (resultPages && resultPages.length > 0) {
                const pagesCol = collection(firestore!, `surveys/${surveyRef.id}/resultPages`);
                for (const page of resultPages) {
                    await setDoc(doc(pagesCol, page.id), page);
                }
            }

            toast({ title: 'Survey Created Successfully' });
            if (data.status === 'published') {
                syncVariableRegistry().catch(console.error);
            }
            router.push('/admin/surveys');
        } catch (error) {
            toast({ variant: 'destructive', title: 'Initialization Failed' });
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

        if (step === 1) {
            const title = getValues('title');
            if (title && !getValues('slug')) {
                const slug = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                setValue('slug', slug, { shouldValidate: true });
            }
        }

        setStep(s => s + 1);
    };

    const handleStepChange = async (target: number) => {
        if (target === step) return;
        if (target > step) {
            const isStepValid = await trigger();
            if (!isStepValid) return;
        }
        setStep(target);
    };

    const handleUndo = () => { if (canUndo) { isProgrammaticChange.current = true; undoHistory(); } };
    const handleRedo = () => { if (canRedo) { isProgrammaticChange.current = true; redoHistory(); } };

    return (
        <FormProvider {...form}>
            <div className="h-full flex flex-col bg-muted/30">
                {/* Header Actions */}
                <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b px-8 h-16 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-xl">
                            <SmartSappIcon className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <h1 className="font-black text-sm uppercase tracking-tight leading-none mb-1">
                                New Survey Blueprint
                            </h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[8px] h-4 font-black uppercase border-primary/20 text-primary bg-primary/5">Creation Mode</Badge>
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
                            Initialize Blueprint
                        </Button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
                    <div className="max-w-7xl mx-auto">
                        <Stepper currentStep={step} onStepClick={handleStepChange} />

                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8">
                                    {/* Mobile Mode Switcher */}
                                    <div className="md:hidden flex justify-center mb-6">
                                        <div className="bg-background border shadow-sm p-1 rounded-2xl flex gap-1">
                                            <Button variant={mobileMode === 'edit' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileMode('edit')} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6">Configure</Button>
                                            <Button variant={mobileMode === 'preview' ? 'default' : 'ghost'} size="sm" onClick={() => setMobileMode('preview')} className="rounded-xl font-black uppercase text-[10px] tracking-widest h-10 px-6">Live View</Button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                                        <div className={cn("space-y-8", mobileMode === 'preview' && "hidden md:block")}>
                                            <Step1Details schools={schools || []} />
                                        </div>
                                        <div className={cn("sticky top-0 h-[calc(100vh-250px)]", mobileMode === 'edit' && "hidden md:block")}>
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

                        {/* Sticky Navigation Footer */}
                        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 sm:p-6 bg-background/80 backdrop-blur-lg border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                            <div className="max-w-7xl mx-auto flex items-center justify-between">
                                <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')} className="font-bold text-muted-foreground rounded-xl px-6 h-12">Cancel</Button>
                                <div className="flex items-center gap-4">
                                    {step > 1 && <Button type="button" variant="outline" onClick={() => handleStepChange(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12 gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>}
                                    {step < 4 ? (
                                        <Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-black shadow-xl rounded-xl transition-all active:scale-95 group">
                                            Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </Button>
                                    ) : (
                                        <Button type="submit" disabled={isSaving} onClick={form.handleSubmit(onSubmit)} className="gap-2 px-12 h-14 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg">
                                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <Save className="h-4 w-4" />} 
                                            Finalize & Initialize
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </FormProvider>
    );
}
