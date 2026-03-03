'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser, useCollection } from '@/firebase';
import { doc, collection, getDocs, updateDoc, deleteDoc, setDoc, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Check, Loader2, Palette, Layout, Eye, X, ArrowLeft, ArrowRight, Save, Globe, ShieldCheck, Zap, Settings2, Share2, Sparkles, Building
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { type Survey, type SurveyElement, type SurveyQuestion, type SurveyResultPage, type School } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FormProvider, useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import SurveyFormBuilder from '../../components/survey-form-builder';
import ResultsStep from '../../components/results-step';
import SurveyPreviewButton from '../../components/survey-preview-button';
import ValidationErrorModal, { type ValidationError } from '../../components/validation-error-modal';
import InternalNotificationConfig from '@/app/admin/components/internal-notification-config';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { MediaSelect } from '@/app/admin/schools/components/media-select';
import WebhookManager from '@/app/admin/surveys/components/webhook-manager';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { SmartSappIcon } from '@/components/icons';
import AiChatEditor from '../../components/ai-chat-editor';
import { syncVariableRegistry } from '@/lib/messaging-actions';

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
  backgroundColor: z.string().optional(),
  backgroundPattern: z.enum(['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient']).default('none'),
  patternColor: z.string().optional(),
  status: z.enum(['draft', 'published', 'archived']),
  slug: z.string().min(3, 'Slug must be at least 3 characters.').regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  webhookUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  webhookId: z.string().optional(),
  webhookEnabled: z.boolean().default(false),
  scoringEnabled: z.boolean().default(false),
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
    const steps = ['Details', 'Builder', 'Results', 'Publish'];

    return (
        <div className="flex justify-center items-center mb-12 max-w-2xl mx-auto px-4">
            {steps.map((step, index) => {
                const stepNum = index + 1;
                const isCompleted = currentStep > stepNum;
                const isActive = currentStep === stepNum;

                return (
                    <React.Fragment key={step}>
                        <button 
                            type="button"
                            onClick={() => onStepClick(stepNum)}
                            className="flex flex-col items-center group outline-none"
                        >
                            <div
                                className={cn(
                                    'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all group-hover:scale-110',
                                    isCompleted ? 'bg-primary border-primary text-primary-foreground' : 
                                    isActive ? 'bg-primary/10 border-primary text-primary shadow-lg shadow-primary/10' : 'bg-background border-border text-muted-foreground',
                                )}
                            >
                                {isCompleted ? <Check className="w-4 h-4" /> : <span className="text-[10px] font-black">{stepNum}</span>}
                            </div>
                            <p className={cn(
                                'mt-2 text-[10px] font-black uppercase tracking-widest transition-colors', 
                                isActive || isCompleted ? 'text-primary' : 'text-muted-foreground opacity-60 group-hover:opacity-100'
                            )}>
                                {step}
                            </p>
                        </button>
                        {index < steps.length - 1 && (
                            <div className="flex-1 mx-4 h-[1px] bg-border relative overflow-hidden">
                                <motion.div 
                                    initial={false}
                                    animate={{ width: isCompleted ? '100%' : '0%' }}
                                    className="absolute left-0 top-0 h-full bg-primary"
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
    const [step, setStep] = React.useState(1);
    const [isSaving, setIsSaving] = React.useState(false);
    const [isErrorModalOpen, setIsErrorModalOpen] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore || !surveyId) return null;
        return doc(firestore, 'surveys', surveyId as string);
    }, [firestore, surveyId]);

    const { data: survey, isLoading } = useDoc<Survey>(surveyDocRef);

    const schoolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'schools'), orderBy('name', 'asc'));
    }, [firestore]);
    const { data: schools } = useCollection<School>(schoolsQuery);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            internalName: "",
            title: "",
            description: "",
            elements: [],
            thankYouTitle: "Thank You!",
            thankYouDescription: "Your response has been recorded.",
            logoUrl: "",
            bannerImageUrl: "",
            backgroundColor: "#F1F5F9",
            backgroundPattern: "none",
            patternColor: "#3B5FFF",
            status: "published",
            slug: "",
            webhookUrl: "",
            webhookId: "",
            webhookEnabled: false,
            scoringEnabled: false,
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
            automationMessagingEnabled: false,
            schoolId: null,
            schoolName: null,
        }
    });

    const { getValues, setValue, watch, reset } = form;

    const watchedBgColor = watch('backgroundColor');
    const watchedPattern = watch('backgroundPattern');
    const watchedPatternColor = watch('patternColor');

    React.useEffect(() => {
        if (survey && !form.formState.isDirty) {
            const VALID_PATTERNS = ['none', 'dots', 'grid', 'circuit', 'topography', 'cubes', 'gradient'];
            const pattern = survey.backgroundPattern && VALID_PATTERNS.includes(survey.backgroundPattern) 
                ? survey.backgroundPattern 
                : 'none';

            reset({
                internalName: survey.internalName || survey.title,
                title: survey.title,
                description: survey.description,
                elements: survey.elements || [],
                thankYouTitle: survey.thankYouTitle || 'Thank You!',
                thankYouDescription: survey.thankYouDescription || 'Your response has been recorded.',
                logoUrl: survey.logoUrl || '',
                bannerImageUrl: survey.bannerImageUrl || '',
                backgroundColor: survey.backgroundColor || '#F1F5F9',
                backgroundPattern: pattern as any,
                patternColor: survey.patternColor || '#3B5FFF',
                status: survey.status || 'published',
                slug: survey.slug,
                webhookUrl: survey.webhookUrl || '',
                webhookId: survey.webhookId || '',
                webhookEnabled: survey.webhookEnabled || false,
                scoringEnabled: survey.scoringEnabled || false,
                maxScore: survey.maxScore || 100,
                resultRules: survey.resultRules || [],
                resultPages: [],
                startButtonText: survey.startButtonText || 'Let\'s Start',
                showCoverPage: survey.showCoverPage ?? true,
                showSurveyTitles: survey.showSurveyTitles ?? true,
                adminAlertsEnabled: survey.adminAlertsEnabled || false,
                adminAlertChannel: survey.adminAlertChannel || 'both',
                adminAlertNotifyManager: survey.adminAlertNotifyManager || false,
                adminAlertSpecificUserIds: survey.adminAlertSpecificUserIds || [],
                adminAlertEmailTemplateId: survey.adminAlertEmailTemplateId || '',
                adminAlertSmsTemplateId: survey.adminAlertSmsTemplateId || '',
                automationMessagingEnabled: survey.automationMessagingEnabled || false,
                schoolId: survey.schoolId || null,
                schoolName: survey.schoolName || null,
            });

            if (firestore) {
                const pagesCol = collection(firestore, `surveys/${surveyId}/resultPages`);
                getDocs(pagesCol).then(snap => {
                    const pages = snap.docs.map(d => ({ ...d.data(), id: d.id } as SurveyResultPage));
                    setValue('resultPages', pages);
                });
            }
        }
    }, [survey, reset, firestore, surveyId, setValue]);

    const parseValidationErrors = (errors: any, elements: SurveyElement[]): ValidationError[] => {
        const parsed: ValidationError[] = [];
        if (!errors.elements || !Array.isArray(errors.elements)) return parsed;

        errors.elements.forEach((err: any, index: number) => {
            if (!err) return;
            const element = elements[index];
            const blockType = element.type.charAt(0).toUpperCase() + element.type.slice(1);
            
            let blockTitle = `Block #${index + 1} (${blockType})`;
            if ('title' in element && element.title) {
                blockTitle = `Block #${index + 1}: "${element.title}"`;
            } else if ('isRequired' in element && (element as SurveyQuestion).title) {
                blockTitle = `Question #${index + 1}: "${(element as SurveyQuestion).title}"`;
            }

            Object.keys(err).forEach(field => {
                const fieldName = field.charAt(0).toUpperCase() + field.slice(1);
                parsed.push({
                    elementId: element.id,
                    blockTitle,
                    field: fieldName,
                    message: err[field]?.message || 'Invalid value',
                });
            });
        });

        return parsed;
    };

    const scrollToError = (elementId: string) => {
        setIsErrorModalOpen(false);
        setTimeout(() => {
            const el = document.getElementById(elementId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 300);
    };

    const saveData = async (data: FormData) => {
        if (!firestore || !surveyId) return false;

        const { resultPages, ...mainData } = data;
        
        const surveyData = {
          ...mainData,
          updatedAt: new Date().toISOString(),
        };

        const docRef = doc(firestore, 'surveys', surveyId);
        
        try {
            await updateDoc(docRef, JSON.parse(JSON.stringify(surveyData)));
            
            const pagesCol = collection(firestore, `surveys/${surveyId}/resultPages`);
            const existingPagesSnap = await getDocs(pagesCol);
            const existingIds = new Set(existingPagesSnap.docs.map(d => d.id));
            const newIds = new Set(resultPages.map(p => p.id));

            for (const oldId of existingIds) {
                if (!newIds.has(oldId)) {
                    await deleteDoc(doc(pagesCol, oldId));
                }
            }

            for (const page of resultPages) {
                await setDoc(doc(pagesCol, page.id), page);
            }

            // Trigger Variable Registry sync if published
            if (data.status === 'published') {
                syncVariableRegistry().catch(e => console.error("Registry Sync failed:", e));
            }

            localStorage.removeItem(`survey-autosave-${surveyId}`);
            return true;
        } catch (error) {
            console.error("Save Error:", error);
            return false;
        }
    };

    const onSubmit = async (data: FormData) => {
        setIsSaving(true);
        const success = await saveData(data);
        if (success) {
            toast({ title: 'Survey Updated' });
            router.push('/admin/surveys');
        } else {
            toast({ variant: 'destructive', title: 'Save Failed' });
        }
        setIsSaving(false);
    };

    const onInvalid = (errors: any) => {
        const elements = getValues('elements');
        const elementErrors = parseValidationErrors(errors, elements);

        if (elementErrors.length > 0) {
            setValidationErrors(elementErrors);
            setIsErrorModalOpen(true);
            setStep(2); 
            return;
        }

        let targetStep = 4;
        if (errors.internalName || errors.title || errors.description) targetStep = 1;
        else if (errors.thankYouTitle || errors.thankYouDescription) targetStep = 3;
        
        setStep(targetStep);

        toast({
            variant: 'destructive',
            title: 'Form Incomplete',
            description: 'Please fix the errors before saving.',
        });
    };
    
    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (step === 1) fieldsToValidate = ['internalName', 'title', 'description', 'startButtonText', 'showCoverPage', 'showSurveyTitles', 'logoUrl', 'bannerImageUrl', 'backgroundColor', 'backgroundPattern', 'patternColor'];
        if (step === 2) fieldsToValidate = ['elements'];
        if (step === 3) fieldsToValidate = ['resultRules', 'resultPages'];
        
        const isStepValid = await form.trigger(fieldsToValidate);
        
        if (!isStepValid) {
            if (step === 2) {
                const elements = getValues('elements');
                const elementErrors = parseValidationErrors(form.formState.errors, elements);
                if (elementErrors.length > 0) {
                    setValidationErrors(elementErrors);
                    setIsErrorModalOpen(true);
                    return;
                }
            }

            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Please fix the errors before proceeding.',
            });
            return;
        }

        const nextStep = step + 1;
        setStep(nextStep);
        router.push(`${pathname}?step=${nextStep}`, { scroll: false });
    };

    const handlePrev = () => {
        const prevStep = step - 1;
        setStep(prevStep);
        router.push(`${prevStep === 1 ? pathname : `${pathname}?step=${prevStep}`}`, { scroll: false });
    };

    const handleStepChange = async (targetStep: number) => {
        if (targetStep === step) return;
        if (targetStep > step) {
            let fieldsToValidate: any[] = [];
            if (step === 1) fieldsToValidate = ['internalName', 'title', 'description', 'startButtonText', 'showCoverPage', 'showSurveyTitles', 'logoUrl', 'bannerImageUrl', 'backgroundColor', 'backgroundPattern', 'patternColor'];
            if (step === 2) fieldsToValidate = ['elements'];
            if (step === 3) fieldsToValidate = ['resultRules', 'resultPages'];
            
            const isStepValid = await form.trigger(fieldsToValidate);
            if (!isStepValid) {
                toast({ variant: 'destructive', title: 'Validation Required', description: 'Please resolve errors in the current section before moving ahead.' });
                return;
            }
        }
        setStep(targetStep);
        router.push(`${targetStep === 1 ? pathname : `${pathname}?step=${targetStep}`}`, { scroll: false });
    }

    if (isLoading) return <div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    };

    const renderFooter = () => (
        <div className="flex items-center justify-between mt-12 pt-8 border-t border-border/50">
            <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')} className="font-bold text-muted-foreground hover:bg-muted/50 rounded-xl px-6 h-12">
                Cancel
            </Button>
            <div className="flex items-center gap-4">
                {step > 1 && (
                    <Button type="button" variant="outline" onClick={handlePrev} className="font-bold border-border/50 rounded-xl px-6 h-12">
                        Previous
                    </Button>
                )}
                {step < 4 ? (
                    <Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-black shadow-xl rounded-xl transition-all active:scale-95 group">
                        Next Phase 
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                ) : (
                    <div className="flex items-center gap-4">
                        <SurveyPreviewButton variant="outline" className="h-14 px-8 rounded-xl font-bold border-2" />
                        <Button 
                            type="submit" 
                            disabled={isSaving} 
                            onClick={form.handleSubmit(onSubmit, onInvalid)}
                            className="gap-2 px-12 h-14 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg"
                        >
                            {isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />} 
                            Finalize & Save
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <FormProvider {...form}>
            <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
                <div className="w-full md:w-[95%] lg:w-[90%] mx-auto max-w-7xl">
                    <div className="mb-8 flex justify-between items-end">
                        <div>
                            <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-bold">
                                <Link href="/admin/surveys">
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Directory
                                </Link>
                            </Button>
                            <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Configure Survey</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <AiChatEditor className="h-9" />
                        </div>
                    </div>

                    <Stepper currentStep={step} onStepClick={handleStepChange} />

                    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8 pb-32">
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" {...stepTransition}>
                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                        <Card className="lg:col-span-2 shadow-sm border-none ring-1 ring-border">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl"><Layout className="h-5 w-5 text-primary" /></div>
                                                        <div><CardTitle className="text-lg font-black uppercase tracking-tight">Survey Details</CardTitle></div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-8 bg-background">
                                                <FormField control={form.control} name="internalName" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Internal Name (Administrative)</FormLabel><FormControl><Input placeholder="e.g., Parent Feedback 2024" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="title" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Public Survey Title</FormLabel><FormControl><Input placeholder="e.g., How are we doing?" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="description" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Description / Instructions</FormLabel><FormControl><Textarea placeholder="Share your honest feedback..." {...field} className="min-h-[150px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed" /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <div className="pt-6 border-t border-border/50">
                                                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-8">
                                                        <FormField control={form.control} name="startButtonText" render={({ field }) => (
                                                            <FormItem className="flex-grow max-w-sm"><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Start Button Text</FormLabel><FormControl><Input {...field} className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl></FormItem>
                                                        )} />
                                                        <div className="flex flex-col gap-4 min-w-[200px] bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                                            <FormField control={form.control} name="showCoverPage" render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center justify-between space-y-0 gap-4">
                                                                    <div className="flex items-center gap-2"><Layout className="h-3.5 w-3.5 text-primary"/><FormLabel className="text-[10px] font-black uppercase tracking-widest leading-none">Use Cover Page</FormLabel></div>
                                                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                </FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="showSurveyTitles" render={({ field }) => (
                                                                <FormItem className="flex flex-row items-center justify-between space-y-0 gap-4">
                                                                    <div className="flex items-center gap-2"><Eye className="h-3.5 w-3.5 text-primary"/><FormLabel className="text-[10px] font-black uppercase tracking-widest leading-none">Show Survey Titles</FormLabel></div>
                                                                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                                                </FormItem>
                                                            )} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <div className="space-y-8">
                                            <Card className="shadow-sm border-none ring-1 ring-border">
                                                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl"><Building className="h-5 w-5 text-primary" /></div>
                                                        <CardTitle className="text-lg font-black uppercase tracking-tight">Organization</CardTitle>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-6 space-y-6">
                                                    <FormField control={form.control} name="schoolId" render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target School</FormLabel>
                                                            <Select 
                                                                onValueChange={(val) => {
                                                                    const school = schools?.find(s => s.id === val);
                                                                    field.onChange(val);
                                                                    setValue('schoolName', school ? school.name : null);
                                                                }} 
                                                                value={field.value || 'none'}
                                                            >
                                                                <SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 transition-all font-bold">
                                                                    <SelectValue placeholder="Link to a school..." />
                                                                </SelectTrigger>
                                                                <SelectContent className="rounded-xl">
                                                                    <SelectItem value="none">General (Global Survey)</SelectItem>
                                                                    {schools?.map(school => (
                                                                        <SelectItem key={school.id} value={school.id}>{school.name}</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <FormDescription className="text-[9px] uppercase tracking-tighter mt-1">Links this survey to a specific school context for better variable resolution.</FormDescription>
                                                        </FormItem>
                                                    )} />
                                                </CardContent>
                                            </Card>
                                            <Card className="shadow-sm border-none ring-1 ring-border">
                                                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl"><Palette className="h-5 w-5 text-primary" /></div>
                                                        <CardTitle className="text-lg font-black uppercase tracking-tight">Branding</CardTitle>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-6 space-y-6">
                                                    <FormField control={form.control} name="logoUrl" render={({ field }) => (
                                                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Brand Logo</FormLabel><FormControl><MediaSelect {...field} filterType="image" className="rounded-xl border-none shadow-none bg-muted/20" /></FormControl></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name="bannerImageUrl" render={({ field }) => (
                                                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cover / Banner Image</FormLabel><FormControl><MediaSelect {...field} filterType="image" className="rounded-xl border-none shadow-none bg-muted/20" /></FormControl></FormItem>
                                                    )} />
                                                </CardContent>
                                            </Card>
                                            <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
                                                <CardHeader className="bg-muted/30 border-b pb-6 px-6">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-primary/10 rounded-xl"><Palette className="h-5 w-5 text-primary" /></div>
                                                        <CardTitle className="text-lg font-black uppercase tracking-tight">Appearance</CardTitle>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="p-6">
                                                    <div className="space-y-6">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <FormField control={form.control} name="backgroundColor" render={({ field }) => (
                                                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">BG Color</FormLabel><div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/30 border focus-within:ring-1 focus-within:ring-primary/20"><Input type="color" {...field} className="w-10 h-10 p-0 border-none bg-transparent rounded-lg cursor-pointer" /><Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] uppercase p-0" /></div></FormItem>
                                                            )} />
                                                            <FormField control={form.control} name="patternColor" render={({ field }) => (
                                                                <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pattern Color</FormLabel><div className="flex items-center gap-2 p-1.5 rounded-xl bg-muted/30 border focus-within:ring-1 focus-within:ring-primary/20"><Input type="color" {...field} className="w-10 h-10 p-0 border-none bg-transparent rounded-lg cursor-pointer" /><Input value={field.value} onChange={e => field.onChange(e.target.value)} className="h-8 border-none bg-transparent shadow-none font-mono text-[10px] uppercase p-0" /></div></FormItem>
                                                            )} />
                                                        </div>
                                                        <FormField control={form.control} name="backgroundPattern" render={({ field }) => (
                                                            <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Pattern Style</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl"><SelectItem value="none">None</SelectItem><SelectItem value="dots">Dots</SelectItem><SelectItem value="grid">Grid</SelectItem><SelectItem value="circuit">Circuit</SelectItem><SelectItem value="topography">Topography</SelectItem><SelectItem value="cubes">Cubes</SelectItem><SelectItem value="gradient">Gradient</SelectItem></SelectContent></Select></FormItem>
                                                        )} />
                                                        <div className="space-y-2">
                                                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Design Preview</Label>
                                                            <div className="w-full h-40 rounded-2xl border shadow-inner relative flex items-center justify-center bg-slate-50 overflow-hidden" style={{ backgroundColor: watchedBgColor }}>
                                                                <div className="absolute inset-0 opacity-20 flex items-center justify-center pointer-events-none">
                                                                    {watchedPattern === 'none' && <div className="text-[10px] font-black text-muted-foreground/30 uppercase">Solid Preview</div>}
                                                                    {watchedPattern === 'dots' && <div className="grid grid-cols-10 gap-4">{Array.from({length: 40}).map((_,i) => <div key={i} className="w-1 h-1 rounded-full" style={{backgroundColor: watchedPatternColor}} />)}</div>}
                                                                    {watchedPattern === 'grid' && <div className="w-full h-full border border-dashed" style={{borderColor: watchedPatternColor, opacity: 0.1}} />}
                                                                    {watchedPattern === 'gradient' && <div className="w-full h-full bg-gradient-to-br from-primary/20 to-transparent" />}
                                                                    {(watchedPattern !== 'none' && watchedPattern !== 'dots' && watchedPattern !== 'grid' && watchedPattern !== 'gradient') && <div className="text-[10px] font-black text-primary/40 uppercase">{watchedPattern} active</div>}
                                                                </div>
                                                                <div className="relative z-10 p-4 rounded-xl bg-white/80 backdrop-blur-md border shadow-sm flex items-center gap-2">
                                                                    <SmartSappIcon className="h-4 w-4 text-primary" />
                                                                    <span className="text-[8px] font-black uppercase tracking-widest text-foreground/60">Live Preview Area</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                    {renderFooter()}
                                </motion.div>
                            )}

                            {step === 2 && (
                                <motion.div key="step2" {...stepTransition} className="min-h-[60vh]">
                                    <SurveyFormBuilder />
                                    {renderFooter()}
                                </motion.div>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" {...stepTransition} className="min-h-[60vh]">
                                    <ResultsStep />
                                    {renderFooter()}
                                </motion.div>
                            )}

                            {step === 4 && (
                                <motion.div key="step4" {...stepTransition}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                        <Card className="shadow-sm overflow-hidden border-none ring-1 ring-border">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-5 w-5 text-primary" /></div>
                                                    <CardTitle className="text-lg font-black uppercase tracking-tight">Publish Settings</CardTitle>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-8 bg-background">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <FormField control={form.control} name="status" render={({ field }) => (
                                                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Status</FormLabel><Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl"><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem><SelectItem value="archived">Archived</SelectItem></SelectContent></Select></FormItem>
                                                    )} />
                                                    <FormField control={form.control} name="slug" render={({ field }) => (
                                                        <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL Identifier</FormLabel><div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner"><div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 border-r">/surveys/</div><Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-bold" /></div></FormItem>
                                                    )} />
                                                </div>
                                                <Separator />
                                                <WebhookManager />
                                            </CardContent>
                                        </Card>
                                        <div className="space-y-8">
                                            <InternalNotificationConfig prefix="adminAlert" />
                                        </div>
                                    </div>
                                    {renderFooter()}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </div>
            </div>

            <ValidationErrorModal open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen} errors={validationErrors} onFix={scrollToError} />
        </FormProvider>
    );
}