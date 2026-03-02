
'use client';

import * as React from 'react';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, usePathname } from 'next/navigation';
import { collection, addDoc, setDoc, doc, query, where, orderBy } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase } from '@/firebase';
import { MediaSelect } from '../../schools/components/media-select';
import SurveyFormBuilder from '../components/survey-form-builder';
import { Check, Loader2, Palette, Layout, Eye, ArrowLeft, ArrowRight, Mail, Send, Globe, ShieldCheck, Zap, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import SurveyPreviewButton from '../components/survey-preview-button';
import ValidationErrorModal, { type ValidationError } from '../components/validation-error-modal';
import type { SurveyElement, SurveyQuestion, MessageTemplate, SenderProfile, SurveyResultPage } from '@/lib/types';
import ResultsStep from '../components/results-step';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import WebhookManager from '../components/webhook-manager';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

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
  title: z.string().min(5, { message: 'Public title must be at least 5 characters.' }),
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
  // Admin Notifications
  adminSmsNotificationEnabled: z.boolean().default(false),
  adminSmsTemplateId: z.string().optional(),
  adminSmsSenderProfileId: z.string().optional(),
  adminSmsRecipient: z.string().optional(),
  adminEmailNotificationEnabled: z.boolean().default(false),
  adminEmailTemplateId: z.string().optional(),
  adminEmailSenderProfileId: z.string().optional(),
  adminEmailRecipient: z.string().optional(),
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

export default function NewSurveyPage() {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [step, setStep] = React.useState(1);
    const [isSaving, setIsSaving] = React.useState(false);
    
    const [isErrorModalOpen, setIsErrorModalOpen] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);

    const templatesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'message_templates'), orderBy('name', 'asc'));
    }, [firestore]);
    const { data: templates } = useCollection<MessageTemplate>(templatesQuery);

    const profilesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'sender_profiles'), where('isActive', '==', true));
    }, [firestore]);
    const { data: profiles } = useCollection<SenderProfile>(profilesQuery);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            internalName: '',
            title: '',
            description: '',
            status: 'published',
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
            backgroundColor: '#F1F5F9',
            backgroundPattern: 'none',
            patternColor: '#3B5FFF',
            slug: '',
            webhookUrl: '',
            webhookId: '',
            webhookEnabled: false,
            scoringEnabled: false,
            maxScore: 100,
            resultRules: [],
            resultPages: [],
            startButtonText: 'Let\'s Start',
            showCoverPage: true,
            showSurveyTitles: true,
            adminSmsNotificationEnabled: false,
            adminEmailNotificationEnabled: false,
        },
    });

    const { getValues, watch, setValue } = form;
    const watchedBgColor = watch('backgroundColor');
    const watchedInternalName = watch('internalName');

    React.useEffect(() => {
        const currentTitle = getValues('title');
        if (watchedInternalName && !currentTitle) {
            setValue('title', watchedInternalName, { shouldValidate: true });
        }
    }, [watchedInternalName, getValues, setValue]);

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
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
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
            toast({ variant: 'destructive', title: 'Validation Error', description: 'Please fix the errors before proceeding.' });
            return;
        }

        if (step === 1) {
            const title = form.getValues('title');
            if (title && !form.getValues('slug')) {
                const slug = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                form.setValue('slug', slug, { shouldValidate: true });
            }
        }
        
        setStep(s => s + 1);
    };

    const onSubmit = async (data: FormData) => {
        if (!firestore) return;
        setIsSaving(true);
        
        const { resultPages, ...mainData } = data;
        
        try {
            const surveyRef = await addDoc(collection(firestore, 'surveys'), {
                ...mainData,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });
            
            if (resultPages && resultPages.length > 0) {
                const pagesCol = collection(firestore, `surveys/${surveyRef.id}/resultPages`);
                for (const page of resultPages) {
                    await setDoc(doc(pagesCol, page.id), page);
                }
            }

            toast({ title: 'Survey Initialized' });
            router.push('/admin/surveys');
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Initialization Failed' });
        } finally {
            setIsSaving(false);
        }
    };

    const stepTransition = {
        initial: { opacity: 0, x: 20 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -20 },
        transition: { type: 'spring', damping: 25, stiffness: 200 }
    };
    
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8 bg-muted/5">
            <div className="w-full md:w-[95%] lg:w-[90%] mx-auto max-w-7xl">
                <div className="mb-8">
                    <Button asChild variant="ghost" className="-ml-2 mb-2 text-muted-foreground hover:text-foreground font-bold">
                        <Link href="/admin/surveys">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Directory
                        </Link>
                    </Button>
                    <h1 className="text-3xl font-black tracking-tight text-foreground uppercase">Create New Survey</h1>
                </div>

                <FormProvider {...form}>
                    <Stepper currentStep={step} onStepClick={setStep} />
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pb-32">
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.div key="step1" {...stepTransition}>
                                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                        <Card className="xl:col-span-2 shadow-sm border-none ring-1 ring-border">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><Layout className="h-5 w-5 text-primary" /></div>
                                                    <div><CardTitle className="text-lg font-black uppercase tracking-tight">Survey Identity</CardTitle><CardDescription className="text-xs font-medium">Core naming and classification.</CardDescription></div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-8 bg-background">
                                                <FormField control={form.control} name="internalName" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Internal Name</FormLabel><FormControl><Input placeholder="e.g., Parent Feedback 2024" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="title" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Public Header</FormLabel><FormControl><Input placeholder="e.g., How are we doing?" {...field} className="h-12 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold" /></FormControl><FormMessage /></FormItem>
                                                )} />
                                                <FormField control={form.control} name="description" render={({ field }) => (
                                                    <FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Introduction</FormLabel><FormControl><Textarea placeholder="Share your honest feedback..." {...field} className="min-h-[120px] rounded-xl bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 p-4 leading-relaxed" /></FormControl><FormMessage /></FormItem>
                                                )} />
                                            </CardContent>
                                        </Card>
                                        <Card className="shadow-sm border-none ring-1 ring-border">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-xl"><Palette className="h-5 w-5 text-primary" /></div>
                                                    <div><CardTitle className="text-lg font-black uppercase tracking-tight">Theme</CardTitle></div>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-6">
                                                <FormField control={form.control} name="logoUrl" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Brand Logo</FormLabel><FormControl><MediaSelect {...field} filterType="image" className="rounded-2xl" /></FormControl></FormItem>)} />
                                                <FormField control={form.control} name="bannerImageUrl" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 ml-1">Cover Image</FormLabel><FormControl><MediaSelect {...field} filterType="image" className="rounded-2xl" /></FormControl></FormItem>)} />
                                            </CardContent>
                                        </Card>
                                    </div>
                                </motion.div>
                            )}

                            {step === 2 && <motion.div key="step2" {...stepTransition} className="min-h-[60vh]"><SurveyFormBuilder /></motion.div>}
                            {step === 3 && <motion.div key="step3" {...stepTransition} className="min-h-[60vh]"><ResultsStep /></motion.div>}

                            {step === 4 && (
                                <motion.div key="step4" {...stepTransition}>
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                                        <Card className="shadow-sm border-none ring-1 ring-border overflow-hidden">
                                            <CardHeader className="bg-muted/30 border-b pb-6">
                                                <div className="flex items-center gap-3"><div className="p-2 bg-primary/10 rounded-xl"><Globe className="h-5 w-5 text-primary" /></div><div><CardTitle className="text-lg font-black uppercase tracking-tight">Publish Logic</CardTitle></div></div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-8 bg-background">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                    <FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Initial Visibility</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger className="h-11 rounded-xl bg-muted/20 border-none font-bold"><SelectValue /></SelectTrigger></FormControl><SelectContent className="rounded-xl"><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Published</SelectItem></SelectContent></Select></FormItem>)} />
                                                    <FormField control={form.control} name="slug" render={({ field }) => (<FormItem><FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">URL Extension</FormLabel><div className="flex h-11 border border-border/50 rounded-xl overflow-hidden bg-muted/20 focus-within:ring-1 focus-within:ring-primary/20 shadow-inner"><div className="bg-muted px-3 flex items-center text-[10px] font-black uppercase tracking-tighter text-muted-foreground/60 border-r">/surveys/</div><Input {...field} className="border-none rounded-none shadow-none focus-visible:ring-0 h-full bg-transparent font-bold" /></div></FormItem>)} />
                                                </div>
                                                <Separator />
                                                <WebhookManager />
                                            </CardContent>
                                        </Card>

                                        <Card className="shadow-xl border-2 border-primary/10 bg-primary/5 overflow-hidden">
                                            <CardHeader className="bg-primary/5 border-b border-primary/10 pb-6">
                                                <div className="flex items-center gap-3"><div className="p-2 bg-primary text-white rounded-xl shadow-lg shadow-primary/20"><Send className="h-5 w-5" /></div><div><CardTitle className="text-lg font-black uppercase tracking-tight">Admin Routing</CardTitle><CardDescription className="text-xs font-bold text-primary/60 uppercase">Internal notifications.</CardDescription></div></div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-6">
                                                <div className={cn("p-5 rounded-2xl border-2 transition-all", watch('adminEmailNotificationEnabled') ? "bg-white border-primary/20 shadow-sm" : "bg-muted/20 border-transparent")}>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg", watch('adminEmailNotificationEnabled') ? "bg-blue-500 text-white" : "bg-muted text-muted-foreground")}><Mail className="h-4 w-4" /></div><Label className="text-sm font-black uppercase tracking-tight">Email Notifications</Label></div>
                                                        <Controller name="adminEmailNotificationEnabled" control={form.control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                                                    </div>
                                                    {watch('adminEmailNotificationEnabled') && (
                                                        <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2">
                                                            <Controller name="adminEmailTemplateId" control={form.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || 'none'}><SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Choose template..." /></SelectTrigger><SelectContent>{templates?.filter(t => t.channel === 'email').map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>)} />
                                                            <Controller name="adminEmailRecipient" control={form.control} render={({ field }) => <Input {...field} placeholder="admin@school.edu" className="h-9 rounded-lg" />} />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={cn("p-5 rounded-2xl border-2 transition-all", watch('adminSmsNotificationEnabled') ? "bg-white border-primary/20 shadow-sm" : "bg-muted/20 border-transparent")}>
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3"><div className={cn("p-2 rounded-lg", watch('adminSmsNotificationEnabled') ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}><Smartphone className="h-4 w-4" /></div><Label className="text-sm font-black uppercase tracking-tight">SMS Alerts</Label></div>
                                                        <Controller name="adminSmsNotificationEnabled" control={form.control} render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
                                                    </div>
                                                    {watch('adminSmsNotificationEnabled') && (
                                                        <div className="space-y-4 pt-4 border-t animate-in fade-in slide-in-from-top-2">
                                                            <Controller name="adminSmsTemplateId" control={form.control} render={({ field }) => (<Select onValueChange={field.onChange} value={field.value || 'none'}><SelectTrigger className="h-9 rounded-lg"><SelectValue placeholder="Choose template..." /></SelectTrigger><SelectContent>{templates?.filter(t => t.channel === 'sms').map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>)} />
                                                            <Controller name="adminSmsRecipient" control={form.control} render={({ field }) => <Input {...field} placeholder="024XXXXXXX" className="h-9 rounded-lg" />} />
                                                        </div>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </form>
                </FormProvider>
            </div>

            <div className="fixed bottom-0 left-0 right-0 z-[80] p-4 sm:p-6 bg-background/80 backdrop-blur-lg border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <div className="w-full md:w-[95%] lg:w-[90%] mx-auto max-w-7xl flex items-center justify-between gap-4">
                    <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')} className="font-bold text-muted-foreground hover:bg-muted/50 rounded-xl px-6 h-12">Cancel</Button>
                    <div className="flex items-center gap-4">
                        {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1)} className="font-bold border-border/50 rounded-xl px-6 h-12">Previous</Button>}
                        {step < 4 ? (
                            <Button type="button" onClick={handleNext} className="gap-2 px-10 h-12 font-black shadow-xl rounded-xl transition-all active:scale-95 group">Next Phase <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Button>
                        ) : (
                            <div className="flex items-center gap-4">
                                <SurveyPreviewButton variant="outline" className="h-14 px-8 rounded-xl font-bold border-2" />
                                <Button type="submit" disabled={isSaving} onClick={form.handleSubmit(onSubmit)} className="gap-2 px-12 h-14 font-black shadow-2xl bg-primary text-white hover:bg-primary/90 rounded-[1.25rem] transition-all active:scale-95 text-lg">{isSaving ? <Loader2 className="h-6 w-6 animate-spin" /> : <ShieldCheck className="h-6 w-6" />} Initialize Survey</Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <ValidationErrorModal open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen} errors={validationErrors} onFix={scrollToError} />
        </div>
    );
}
