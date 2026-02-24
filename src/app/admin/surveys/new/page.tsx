'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc, setDoc, doc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { MediaSelect } from '../../schools/components/media-select';
import SurveyFormBuilder from '../components/survey-form-builder';
import { Check, Loader2, Sparkles, BrainCircuit, ArrowRight, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import SurveyPreviewButton from '../components/survey-preview-button';
import ValidationErrorModal, { type ValidationError } from '../components/validation-error-modal';
import type { SurveyElement, SurveyQuestion } from '@/lib/types';
import ResultsStep from '../components/results-step';

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
  bannerImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']),
  slug: z.string().min(3, 'Slug must be at least 3 characters.').regex(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens.'}),
  scoringEnabled: z.boolean().default(false),
  maxScore: z.number().min(0).default(100),
  resultRules: z.array(z.any()).default([]),
  resultPages: z.array(z.any()).default([]),
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
                                'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                                currentStep > index + 1 ? 'bg-primary border-primary text-primary-foreground' : '',
                                currentStep === index + 1 ? 'border-primary' : 'border-border',
                            )}
                        >
                            {currentStep > index + 1 ? <Check className="w-6 h-6" /> : <span className={cn('text-lg', currentStep === index + 1 ? 'text-primary' : 'text-muted-foreground')}>{index + 1}</span>}
                        </div>
                        <p className={cn('mt-2 text-sm', currentStep >= index + 1 ? 'font-semibold text-primary' : 'text-muted-foreground')}>{step}</p>
                    </div>
                    {index < steps.length - 1 && <div className="flex-1 h-px bg-border mx-4"></div>}
                </React.Fragment>
            ))}
        </div>
    );
};

function LogicSimulator({ form }: { form: any }) {
    const [testScore, setTestScore] = React.useState<number>(0);
    const rules = form.watch('resultRules') || [];
    const pages = form.watch('resultPages') || [];
    const scoringEnabled = form.watch('scoringEnabled');

    if (!scoringEnabled) return null;

    const matchedRule = rules
        .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
        .find((r: any) => testScore >= (r.minScore || 0) && testScore <= (r.maxScore || 0));
    
    const matchedPage = pages.find((p: any) => p.id === matchedRule?.pageId);

    return (
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4" /> Outcome Simulator
                </CardTitle>
                <CardDescription>Test your scoring logic by entering a dummy score.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                    <div className="flex-grow">
                        <Label className="text-[10px] font-bold uppercase mb-1 block">Test Score</Label>
                        <Input 
                            type="number" 
                            value={testScore} 
                            onChange={(e) => setTestScore(Number(e.target.value))} 
                            className="bg-background font-bold text-lg h-12"
                        />
                    </div>
                    <div className="shrink-0 pt-5">
                        <ArrowRight className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-grow">
                        <Label className="text-[10px] font-bold uppercase mb-1 block">Result Outcome</Label>
                        <div className="h-12 flex items-center px-4 rounded-md border bg-background font-bold text-primary">
                            {matchedRule ? (
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-4 w-4" />
                                    <span>{matchedRule.label}</span>
                                    <span className="text-[10px] text-muted-foreground font-normal ml-2">→ {matchedPage?.name || 'Untitled Page'}</span>
                                </div>
                            ) : (
                                <span className="text-muted-foreground font-normal italic">Default Fallback</span>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export default function NewSurveyPage() {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [step, setStep] = React.useState(1);
    
    const [isErrorModalOpen, setIsErrorModalOpen] = React.useState(false);
    const [validationErrors, setValidationErrors] = React.useState<ValidationError[]>([]);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
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
            bannerImageUrl: '',
            slug: '',
            scoringEnabled: false,
            maxScore: 100,
            resultRules: [],
            resultPages: [],
        },
    });

    const { getValues } = form;

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
            description: 'Please check all steps for missing or incorrect information.',
        });
    };
    
    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (step === 1) fieldsToValidate = ['title', 'description'];
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

        if (step === 1) {
            const title = form.getValues('title');
            const currentSlug = form.getValues('slug');
            if (title && !currentSlug) {
                const slug = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
                form.setValue('slug', slug, { shouldValidate: true });
            }
        }
        setStep(s => s + 1);
    };

    const onSubmit = async (data: FormData) => {
        if (!firestore) return;
        
        const surveyData = { 
            ...data, 
            createdAt: new Date().toISOString(), 
            updatedAt: new Date().toISOString() 
        };
        
        const { resultPages, ...mainData } = surveyData;
        
        try {
            const surveyRef = await addDoc(collection(firestore, 'surveys'), mainData);
            
            if (resultPages && resultPages.length > 0) {
                const pagesCol = collection(firestore, `surveys/${surveyRef.id}/resultPages`);
                for (const page of resultPages) {
                    await setDoc(doc(pagesCol, page.id), page);
                }
            }

            // Success: Purge Local Auto-save Cache
            localStorage.removeItem('survey-autosave-new-survey');

            toast({ title: 'Survey Created' });
            router.push('/admin/surveys');
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Save Failed' });
        }
    };
    
    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="w-full md:w-[70%] mx-auto">
                <FormProvider {...form}>
                    <Stepper currentStep={step} />
                    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                        
                        <Card className={cn(step !== 1 && 'hidden')}>
                            <CardHeader>
                                <CardTitle>Survey Details</CardTitle>
                                <CardDescription>Give your survey a title and a description to guide your users.</CardDescription>
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
                                </div>
                            </CardContent>
                        </Card>
                        
                        <div className={cn(step !== 2 && 'hidden')}>
                            <SurveyFormBuilder />
                        </div>
                        
                        <div className={cn(step !== 3 && 'hidden')}>
                            <ResultsStep />
                        </div>

                        <div className={cn(step !== 4 && 'hidden')} className="space-y-8">
                            <LogicSimulator form={form} />

                            <Card>
                                <CardHeader>
                                    <CardTitle>Final Settings</CardTitle>
                                    <CardDescription>Configure the final settings and publish your survey.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-8">
                                        <FormField
                                            control={form.control}
                                            name="bannerImageUrl"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Banner Image</FormLabel>
                                                    <FormControl>
                                                        <MediaSelect {...field} filterType="image" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
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
                                                <div className="flex flex-col sm:flex-row">
                                                    <span className="flex h-10 items-center justify-center whitespace-nowrap rounded-t-md border border-b-0 bg-muted px-3 text-sm text-muted-foreground sm:w-auto sm:justify-start sm:rounded-l-md sm:rounded-t-none sm:border-b sm:border-r-0">
                                                        {typeof window !== 'undefined' ? `${window.location.origin}/surveys/` : '/surveys/'}
                                                    </span>
                                                    <FormControl>
                                                        <Input {...field} className="rounded-b-md rounded-t-none sm:rounded-l-none sm:rounded-b-none" />
                                                    </FormControl>
                                                </div>
                                                <FormDescription>This is the unique last part of your survey URL.</FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                            )}
                                        />
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="flex justify-between items-center mt-12">
                            <Button type="button" variant="ghost" onClick={() => router.push('/admin/surveys')}>Cancel</Button>
                            <div className="flex items-center gap-4">
                                {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(s => s - 1)}>Previous</Button>}
                                {step < 4 ? (
                                    <Button type="button" onClick={handleNext}>Next</Button>
                                ) : (
                                    <div className="flex items-center gap-4">
                                        <SurveyPreviewButton />
                                        <Button type="submit" disabled={form.formState.isSubmitting}>
                                            {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Survey'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </form>
                </FormProvider>
            </div>

            <ValidationErrorModal
                open={isErrorModalOpen}
                onOpenChange={setIsErrorModalOpen}
                errors={validationErrors}
                onFix={scrollToError}
            />
        </div>
    );
}
