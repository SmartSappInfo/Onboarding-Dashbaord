'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';

import type { Survey, SurveyElement, SurveyQuestion, SurveyLayoutBlock } from '@/lib/types';
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
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaSelect } from '../../../schools/components/media-select';
import SurveyFormBuilder from '../../components/survey-form-builder';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import SurveyPreviewButton from '../../components/survey-preview-button';


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
    return true;
}, {
    message: 'This block requires content.',
    path: ['title']
});

const logicActionSchema = z.object({
  type: z.enum(['jump', 'require', 'show', 'hide', 'disableSubmit']),
  targetElementId: z.string().optional(),
  targetElementIds: z.array(z.string()).optional(),
});

const logicBlockSchema = z.object({
  id: z.string(),
  type: z.enum(['logic']),
  rules: z.array(z.object({
    sourceQuestionId: z.string(),
    operator: z.enum(['isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'startsWith', 'doesNotStartWith', 'endsWith', 'doesNotEndWith', 'isEmpty', 'isNotEmpty', 'isGreaterThan', 'isLessThan']),
    targetValue: z.any().optional(),
    action: logicActionSchema,
  })),
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
});

type FormData = z.infer<typeof formSchema>;


const Stepper = ({ currentStep }: { currentStep: number }) => {
    const steps = ['Details', 'Builder', 'Thank You', 'Publish'];

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


function EditSurveyForm({ surveyId }: { surveyId: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();
    const [step, setStep] = React.useState(1);

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
            bannerImageUrl: "",
            status: "draft",
            slug: "",
        }
    });

    const { getValues } = form;

    React.useEffect(() => {
        if (survey && !form.formState.isDirty) {
            form.reset({
                title: survey.title,
                description: survey.description,
                elements: survey.elements || [],
                thankYouTitle: survey.thankYouTitle || 'Thank You!',
                thankYouDescription: survey.thankYouDescription || 'Your response has been recorded.',
                bannerImageUrl: survey.bannerImageUrl || '',
                status: survey.status,
                slug: survey.slug,
            });
        }
    }, [survey, form]);

    const scrollToFirstError = (errors: any) => {
        if (errors.elements) {
            const firstErrorIndex = errors.elements.findIndex((e: any) => !!e);
            if (firstErrorIndex !== -1) {
                const elementId = getValues(`elements.${firstErrorIndex}.id`);
                setTimeout(() => {
                    const el = document.getElementById(elementId);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        }
    };

    const onSubmit = (data: FormData) => {
        if (!firestore || !surveyId) return;

        const surveyData = {
          ...data,
          updatedAt: new Date().toISOString(),
        };

        const cleanedData = JSON.parse(JSON.stringify(surveyData, (key, value) => 
            value === undefined ? null : value
        ));

        const docRef = doc(firestore, 'surveys', surveyId);
        form.control.disabled = true;
        
        updateDoc(docRef, cleanedData)
            .then(() => {
                toast({
                    title: 'Survey Updated',
                    description: `The survey "${data.title}" has been updated.`,
                });
                router.push('/admin/surveys');
            })
            .catch((error) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'update',
                    requestResourceData: cleanedData,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({
                    variant: 'destructive',
                    title: 'Uh oh! Something went wrong.',
                    description: 'There was a problem updating the survey.',
                });
            }).finally(() => {
                form.control.disabled = false;
            });
    };

    const onInvalid = (errors: any) => {
        console.error("Survey Edit Validation Failed:", errors);
        
        let targetStep = 4;
        if (errors.title || errors.description) targetStep = 1;
        else if (errors.elements) targetStep = 2;
        else if (errors.thankYouTitle || errors.thankYouDescription) targetStep = 3;
        
        setStep(targetStep);

        toast({
            variant: 'destructive',
            title: 'Form Incomplete',
            description: 'Please fix the errors before saving.',
        });

        if (targetStep === 2) {
            scrollToFirstError(errors);
        }
    };
    
    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (step === 1) fieldsToValidate = ['title', 'description'];
        if (step === 2) fieldsToValidate = ['elements'];
        if (step === 3) fieldsToValidate = ['thankYouTitle', 'thankYouDescription'];
        
        const isStepValid = await form.trigger(fieldsToValidate);
        
        if (!isStepValid) {
            toast({
                variant: 'destructive',
                title: 'Validation Error',
                description: 'Please fix the errors before proceeding.',
            });
            if (step === 2) {
                scrollToFirstError(form.formState.errors);
            }
            return;
        }
        setStep(s => s + 1);
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-8 mt-6">
                   <Skeleton className="h-10 w-full" />
                   <Skeleton className="h-24 w-full" />
                   <Skeleton className="h-24 w-full" />
                   <Skeleton className="h-10 w-full" />
                   <div className="mt-8">
                        <Skeleton className="h-40 w-full" />
                   </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <FormProvider {...form}>
            <Stepper currentStep={step} />
            <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-8">
                
                {/* Step 1: Details */}
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
                
                {/* Step 2: Builder */}
                <div className={cn(step !== 2 && 'hidden')}>
                    <SurveyFormBuilder />
                </div>
                
                {/* Step 3: Thank You Page */}
                <Card className={cn(step !== 3 && 'hidden')}>
                    <CardHeader>
                        <CardTitle>Thank You Page</CardTitle>
                        <CardDescription>Customize the message users see after they complete the survey.</CardDescription>
                    </CardHeader>
                    <CardContent>
                         <div className="space-y-8">
                            <FormField
                                control={form.control}
                                name="thankYouTitle"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Thank You Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Thank You!" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="thankYouDescription"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Thank You Message</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Your response has been recorded." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Step 4: Publish */}
                <Card className={cn(step !== 4 && 'hidden')}>
                    <CardHeader>
                        <CardTitle>Publish</CardTitle>
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
                                    {form.formState.isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </form>
        </FormProvider>
    );
}


export default function EditSurveyPage() {
    const params = useParams();
    const surveyId = params.id as string;

    return (
        <div className="h-full overflow-y-auto p-4 sm:p-6 md:p-8">
            <div className="w-full md:w-[70%] mx-auto">
                {surveyId ? <EditSurveyForm surveyId={surveyId} /> : <p>Survey ID not found.</p>}
            </div>
        </div>
    );
}
