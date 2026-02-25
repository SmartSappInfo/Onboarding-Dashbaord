'use client';

import * as React from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc, collection, getDocs, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
    Check, Loader2, Palette, Layout, Eye, X
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { type Survey, type SurveyElement, type SurveyQuestion, type SurveyResultPage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import SurveyFormBuilder from '../../components/survey-form-builder';
import ResultsStep from '../../components/results-step';
import SurveyPreviewButton from '../../components/survey-preview-button';
import ValidationErrorModal, { type ValidationError } from '../../components/validation-error-modal';
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
import { MediaSelect } from '../../../schools/components/media-select';

const questionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Question title is required.'),
  type: z.enum(['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload']),
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
  scoringEnabled: z.boolean().default(false),
  maxScore: z.number().min(0).default(100),
  resultRules: z.array(z.any()).default([]),
  resultPages: z.array(z.any()).default([]),
  startButtonText: z.string().optional(),
  showCoverPage: z.boolean().default(true),
  showSurveyTitles: z.boolean().default(true),
});

type FormData = z.infer<typeof formSchema>;

const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ['Details', 'Builder', 'Results', 'Publish'];

    return (
        <div className="flex justify-center items-center mb-12">
            {steps.map((step, index) => (
                <React.Fragment key={step}>
                    <div className="flex flex-col items-center">
                        <div
                            className={cn(
                                'flex items-center justify-center w-6 h-6 rounded-full border-2 transition-colors',
                                currentStep > index + 1 ? 'bg-primary border-primary text-primary-foreground' : '',
                                currentStep === index + 1 ? 'border-primary' : 'border-border',
                            )}
                        >
                            {currentStep > index + 1 ? <Check className="w-3 h-3" /> : <span className={cn('text-[10px] font-bold', currentStep === index + 1 ? 'text-primary' : 'text-muted-foreground')}>{index + 1}</span>}
                        </div>
                        <p className={cn('mt-2 text-[10px] uppercase tracking-wider', currentStep >= index + 1 ? 'font-bold text-primary' : 'text-muted-foreground font-medium')}>{step}</p>
                    </div>
                    {index < steps.length - 1 && <div className="flex-1 h-[1px] bg-border mx-4"></div>}
                </React.Fragment>
            ))}
        </div>
    );
};

const BackgroundPattern = ({ pattern, color }: { pattern?: FormData['backgroundPattern'], color?: string }) => {
    if (!pattern || pattern === 'none') return null;

    if (pattern === 'gradient') {
        return (
            <div className="absolute inset-0 bg-gradient-to-br from-[#6366f1] via-[#a855f7] to-[#ec4899] opacity-80" />
        );
    }

    const patterns: Record<string, React.ReactNode> = {
        dots: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="dots-preview-edit" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
                        <circle cx="2" cy="2" r="1" fill={color || "currentColor"} opacity="0.3" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dots-preview-edit)" />
            </svg>
        ),
        grid: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="grid-preview-edit" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.2" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-preview-edit)" />
            </svg>
        ),
        circuit: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="circuit-preview-edit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 10h20v10H0zM30 30h40v10H30zM80 50h20v10H80zM10 70h30v10H10zM60 80h20v10H60z" fill="none" stroke={color || "currentColor"} strokeWidth="0.5" opacity="0.2" />
                        <circle cx="20" cy="15" r="2" fill={color || "currentColor"} opacity="0.3" />
                        <circle cx="70" cy="35" r="2" fill={color || "currentColor"} opacity="0.3" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#circuit-preview-edit)" />
            </svg>
        ),
        topography: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="topo-preview-edit" x="0" y="0" width="100" height="100" patternUnits="userSpaceOnUse">
                        <path d="M0 50c20-10 40-10 60 0s40 10 60 0M0 20c20-10 40-10 60 0s40 10 60 0M0 80c20-10 40-10 60 0s40 10 60 0" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.2" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#topo-preview-edit)" />
            </svg>
        ),
        cubes: (
            <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <pattern id="cubes-preview-edit" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
                        <path d="M30 0l30 15v30L30 60 0 45V15z" fill="none" stroke={color || "currentColor"} strokeWidth="1" opacity="0.2" />
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#cubes-preview-edit)" />
            </svg>
        )
    };

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {patterns[pattern]}
        </div>
    );
};

function EditSurveyContent() {
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
        return doc(firestore, 'surveys', surveyId);
    }, [firestore, surveyId]);

    const { data: survey, isLoading } = useDoc<Survey>(surveyDocRef);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
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
            scoringEnabled: false,
            maxScore: 100,
            resultRules: [],
            resultPages: [],
            startButtonText: 'Let\'s Start',
            showCoverPage: true,
            showSurveyTitles: true,
        }
    });

    const { getValues, setValue, watch, reset } = form;
    const watchedBgColor = watch('backgroundColor');
    const watchedPattern = watch('backgroundPattern');
    const watchedPatternColor = watch('patternColor');

    React.useEffect(() => {
        const urlStep = searchParams.get('step');
        if (urlStep) {
            const parsed = parseInt(urlStep, 10);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 4) {
                setStep(parsed);
            }
        }
    }, [searchParams]);

    React.useEffect(() => {
        if (survey && !form.formState.isDirty) {
            reset({
                title: survey.title,
                description: survey.description,
                elements: survey.elements || [],
                thankYouTitle: survey.thankYouTitle || 'Thank You!',
                thankYouDescription: survey.thankYouDescription || 'Your response has been recorded.',
                logoUrl: survey.logoUrl || '',
                bannerImageUrl: survey.bannerImageUrl || '',
                backgroundColor: survey.backgroundColor || '#F1F5F9',
                backgroundPattern: survey.backgroundPattern || 'none',
                patternColor: survey.patternColor || '#3B5FFF',
                status: survey.status || 'published',
                slug: survey.slug,
                scoringEnabled: survey.scoringEnabled || false,
                maxScore: survey.maxScore || 100,
                resultRules: survey.resultRules || [],
                resultPages: [],
                startButtonText: survey.startButtonText || 'Let\'s Start',
                showCoverPage: survey.showCoverPage ?? true,
                showSurveyTitles: survey.showSurveyTitles ?? true,
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
        if (errors.title || errors.description) targetStep = 1;
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
        if (step === 1) fieldsToValidate = ['title', 'description', 'startButtonText', 'showCoverPage', 'showSurveyTitles', 'logoUrl', 'bannerImageUrl', 'backgroundColor', 'backgroundPattern', 'patternColor'];
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
        router.push(`${pathname}?step=${prevStep}`, { scroll: false });
    };

    if (isLoading) {
        return (
            <div className="flex h-full w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <FormProvider {...form}>
            <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
                <div className="w-full md:w-[90%] mx-auto">
                    <Stepper currentStep={step} />
                    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                        
                        <div className={cn(step !== 1 && 'hidden')}>
                            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                                <Card className="xl:col-span-2">
                                    <CardHeader>
                                        <CardTitle>Survey Details</CardTitle>
                                        <CardDescription>Basic information and structural settings.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-8">
                                            <FormField
                                                control={form.control}
                                                name="title"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Survey Title</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="e.g., Parents Feedback on School Events" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="description"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Description / Instructions</FormLabel>
                                                        <FormControl>
                                                            <Textarea placeholder="Please provide your honest feedback..." {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <Separator />
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                <FormField
                                                    control={form.control}
                                                    name="startButtonText"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Start Button Text</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="e.g., Let's Start" {...field} />
                                                            </FormControl>
                                                            <FormDescription>The label for the button on the cover page.</FormDescription>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <div className="space-y-4 pt-2">
                                                    <FormField
                                                        control={form.control}
                                                        name="showCoverPage"
                                                        render={({ field }) => (
                                                            <div className="flex items-center gap-3">
                                                                <Switch 
                                                                    id="show-cover-page-edit" 
                                                                    checked={field.value} 
                                                                    onCheckedChange={field.onChange} 
                                                                />
                                                                <Label htmlFor="show-cover-page-edit" className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                                    <Layout className="h-3 w-3 text-primary" /> Use Cover Page
                                                                </Label>
                                                            </div>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="showSurveyTitles"
                                                        render={({ field }) => (
                                                            <div className="flex items-center gap-3">
                                                                <Switch 
                                                                    id="show-survey-titles-edit" 
                                                                    checked={field.value} 
                                                                    onCheckedChange={field.onChange} 
                                                                />
                                                                <Label htmlFor="show-survey-titles-edit" className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                                                    <Eye className="h-3 w-3 text-primary" /> Show Survey Titles
                                                                </Label>
                                                            </div>
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <div className="space-y-8">
                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Branding</CardTitle>
                                            <CardDescription>Logo and hero imagery.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <FormField
                                                control={form.control}
                                                name="logoUrl"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Brand Logo</FormLabel>
                                                        <FormControl>
                                                            <MediaSelect {...field} filterType="image" />
                                                        </FormControl>
                                                        <FormDescription>Leave empty to use SmartSapp default logo.</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="bannerImageUrl"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Cover / Banner Image</FormLabel>
                                                        <FormControl>
                                                            <MediaSelect {...field} filterType="image" />
                                                        </FormControl>
                                                        <FormDescription>High-fidelity banner for the introduction.</FormDescription>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </CardContent>
                                    </Card>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle className="flex items-center gap-2"><Layout className="h-5 w-5" /> Appearance</CardTitle>
                                            <CardDescription>Colors and background patterns.</CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                                                <div className="space-y-6">
                                                    <FormField
                                                        control={form.control}
                                                        name="backgroundColor"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Background Color</FormLabel>
                                                                <div className="flex items-center gap-2">
                                                                    <FormControl>
                                                                        <Input type="color" {...field} value={field.value || "#F1F5F9"} className="w-12 h-10 p-1 cursor-pointer" />
                                                                    </FormControl>
                                                                    <Input 
                                                                        value={field.value} 
                                                                        onChange={e => field.onChange(e.target.value)} 
                                                                        className="flex-1 font-mono uppercase" 
                                                                    />
                                                                </div>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="patternColor"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Pattern Color</FormLabel>
                                                                <div className="flex items-center gap-2">
                                                                    <FormControl>
                                                                        <Input type="color" {...field} value={field.value || "#3B5FFF"} className="w-12 h-10 p-1 cursor-pointer" />
                                                                    </FormControl>
                                                                    <Input 
                                                                        value={field.value} 
                                                                        onChange={e => field.onChange(e.target.value)} 
                                                                        className="flex-1 font-mono uppercase" 
                                                                    />
                                                                </div>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={form.control}
                                                        name="backgroundPattern"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel>Background Style</FormLabel>
                                                                <Select onValueChange={field.onChange} value={field.value || 'none'}>
                                                                    <FormControl>
                                                                        <SelectTrigger>
                                                                            <SelectValue placeholder="Select a style" />
                                                                        </SelectTrigger>
                                                                    </FormControl>
                                                                    <SelectContent>
                                                                        <SelectItem value="none">None (Solid)</SelectItem>
                                                                        <SelectItem value="gradient">Linear Gradient</SelectItem>
                                                                        <SelectItem value="dots">Dots</SelectItem>
                                                                        <SelectItem value="grid">Grid</SelectItem>
                                                                        <SelectItem value="circuit">Circuit</SelectItem>
                                                                        <SelectItem value="topography">Topography</SelectItem>
                                                                        <SelectItem value="cubes">Cubes</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label className="text-xs uppercase tracking-widest font-bold text-muted-foreground">Design Preview</Label>
                                                    <div 
                                                        className="aspect-square w-full rounded-xl border-2 border-dashed flex items-center justify-center relative overflow-hidden"
                                                        style={{ backgroundColor: watchedBgColor || "#F1F5F9" }}
                                                    >
                                                        <BackgroundPattern pattern={watchedPattern} color={watchedPatternColor} />
                                                        <span className="relative z-10 text-[10px] font-bold uppercase tracking-tighter opacity-20">Live Preview Area</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            </div>
                        </div>
                        
                        <div className={cn(step !== 2 && 'hidden')}>
                            <SurveyFormBuilder />
                        </div>
                        
                        <div className={cn(step !== 3 && 'hidden')}>
                            <ResultsStep />
                        </div>

                        <div className={cn("space-y-8", step !== 4 && 'hidden')}>
                            <div className="space-y-8">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Publish</CardTitle>
                                        <CardDescription>Configure the final settings and publish your survey.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-8">
                                            <FormField
                                                control={form.control}
                                                name="status"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Status</FormLabel>
                                                    <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                        <SelectValue placeholder="Select survey status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="draft">Draft</SelectItem>
                                                        <SelectItem value="published">Published</SelectItem>
                                                        <SelectItem value="archived">Archived</SelectItem>
                                                    </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="slug"
                                                render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Survey URL</FormLabel>
                                                    <div className="flex flex-col sm:flex-row group transition-all">
                                                        <div 
                                                            className="flex h-10 items-center bg-muted px-3 border border-b-0 sm:border-b sm:border-r-0 rounded-t-md sm:rounded-l-md sm:rounded-tr-none text-[10px] font-mono text-muted-foreground overflow-hidden shrink-0"
                                                            title={typeof window !== 'undefined' ? `${window.location.origin}/surveys/` : '/surveys/'}
                                                        >
                                                            <span className="truncate max-w-[200px]">
                                                                {typeof window !== 'undefined' ? `${window.location.origin}/surveys/` : '/surveys/'}
                                                            </span>
                                                        </div>
                                                        <FormControl>
                                                            <Input 
                                                                {...field} 
                                                                className="rounded-t-none sm:rounded-l-none rounded-b-md sm:rounded-r-md focus-visible:ring-1 focus-visible:ring-primary h-10" 
                                                            />
                                                        </FormControl>
                                                    </div>
                                                    <FormDescription className="text-[10px] mt-1">This is the unique last part of your survey URL.</FormDescription>
                                                    <FormMessage className="text-xs font-bold" />
                                                </FormItem>
                                                )}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>

                        <div className="flex justify-between items-center mt-12">
                            <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')}>Cancel</Button>
                            <div className="flex items-center gap-4">
                                {step > 1 && <Button type="button" variant="outline" onClick={handlePrev}>Previous</Button>}
                                {step < 4 ? (
                                    <Button type="button" onClick={handleNext}>
                                        Next
                                    </Button>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <SurveyPreviewButton />
                                        <Button type="submit" disabled={isSaving}>
                                            {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>

                    <ValidationErrorModal
                        open={isErrorModalOpen}
                        onOpenChange={setIsErrorModalOpen}
                        errors={validationErrors}
                        onFix={scrollToError}
                    />
                </div>
            </div>
        </FormProvider>
    );
}

export default function EditSurveyPage() {
    return (
        <React.Suspense fallback={<div className="flex h-full w-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
            <EditSurveyContent />
        </React.Suspense>
    );
}
