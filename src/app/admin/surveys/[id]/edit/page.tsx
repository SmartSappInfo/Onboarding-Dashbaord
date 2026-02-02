
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';

import type { Survey } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaSelect } from '../../../schools/components/media-select';
import QuestionEditor from '../../components/question-editor';
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
  url: z.string().url().optional().or(z.literal('')),
  html: z.string().optional(),
  hidden: z.boolean().optional(),
}).refine(data => {
    if (data.type === 'heading' && !data.title) return false;
    if (data.type === 'description' && !data.text) return false;
    if (data.type === 'section' && !data.title) return false;
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
  type: z.literal('logic'),
  rules: z.array(z.object({
    sourceQuestionId: z.string().min(1, 'A source question must be selected.'),
    operator: z.enum(['isEqualTo', 'isNotEqualTo', 'contains', 'doesNotContain', 'startsWith', 'doesNotStartWith', 'endsWith', 'doesNotEndWith', 'isEmpty', 'isNotEmpty', 'isGreaterThan', 'isLessThan']),
    targetValue: z.any().optional(),
    action: logicActionSchema,
  })).min(1, 'Logic block must have at least one rule.'),
});

const elementSchema = z.union([questionSchema, layoutBlockSchema, logicBlockSchema]);

const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  bannerImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']),
  elements: z.array(elementSchema).min(1, 'Survey must have at least one element.'),
});

type FormData = z.infer<typeof formSchema>;


function EditSurveyForm({ surveyId }: { surveyId: string }) {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();

    const surveyDocRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return doc(firestore, 'surveys', surveyId);
    }, [firestore, surveyId]);

    const { data: survey, isLoading } = useDoc<Survey>(surveyDocRef);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
    });

    React.useEffect(() => {
        if (survey) {
            form.reset({
                title: survey.title,
                description: survey.description,
                bannerImageUrl: survey.bannerImageUrl || '',
                status: survey.status,
                elements: survey.elements || [],
            });
        }
    }, [survey, form]);

    const onSubmit = (data: FormData) => {
        if (!firestore || !surveyId) return;

        const slug = data.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const surveyData = {
          ...data,
          slug,
          updatedAt: new Date().toISOString(),
        };

        const docRef = doc(firestore, 'surveys', surveyId);
        form.control.disabled = true;
        
        updateDoc(docRef, surveyData)
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
                    requestResourceData: surveyData,
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
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Edit Survey</CardTitle>
                        <CardDescription>Update the details and questions for your survey.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-8">
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
                    </CardContent>
                </Card>
                
                <Card className="bg-muted">
                    <CardHeader>
                        <CardTitle>Form Builder</CardTitle>
                        <CardDescription>Build your survey using the editor below.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <QuestionEditor />
                    </CardContent>
                </Card>

                <div className="flex justify-end items-center gap-4">
                    <Button type="button" variant="outline" onClick={() => router.push('/admin/surveys')}>
                    Cancel
                    </Button>
                    <SurveyPreviewButton />
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </form>
        </FormProvider>
    );
}


export default function EditSurveyPage() {
    const params = useParams();
    const surveyId = params.id as string;

    return (
        <div>
            {surveyId ? <EditSurveyForm surveyId={surveyId} /> : <p>Survey ID not found.</p>}
        </div>
    );
}
