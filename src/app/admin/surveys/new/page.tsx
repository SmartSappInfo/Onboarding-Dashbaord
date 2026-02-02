
'use client';

import * as React from 'react';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';

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
import { useFirestore, errorEmitter, FirestorePermissionError } from '@/firebase';
import { MediaSelect } from '../../schools/components/media-select';
import QuestionEditor from '../components/question-editor';

const questionSchema = z.object({
  id: z.string(),
  title: z.string().min(1, 'Question title is required.'),
  type: z.enum(['text', 'long-text', 'yes-no', 'multiple-choice', 'checkboxes', 'dropdown', 'rating', 'date', 'time', 'file-upload']),
  options: z.array(z.string().min(1, 'Option cannot be empty')).optional(),
  allowOther: z.boolean().optional(),
  isRequired: z.boolean(),
  hidden: z.boolean().optional(),
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
  type: z.enum(['heading', 'description', 'divider', 'image', 'video', 'audio', 'document', 'embed']),
  title: z.string().optional(),
  text: z.string().optional(),
  url: z.string().url().optional().or(z.literal('')),
  html: z.string().optional(),
  hidden: z.boolean().optional(),
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

export default function NewSurveyPage() {
    const { toast } = useToast();
    const router = useRouter();
    const firestore = useFirestore();

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            bannerImageUrl: '',
            status: 'draft',
            elements: [],
        },
    });
    
    React.useEffect(() => {
        // Seed with a default survey for demonstration
        form.reset({
            title: 'Parents perspective on Express Pickup',
            description: 'We are redesigning the SmartsAPP pickup feature in the app and would love to learn more about your preferences.',
            status: 'draft',
            elements: [
                { id: 'q1', title: 'Do you personally pick up your ward at school closing time?', type: 'yes-no', isRequired: true },
                {
                    id: 'q2',
                    title: 'Is the current pickup process at your ward’s school effective and convenient for you?',
                    type: 'yes-no',
                    isRequired: true,
                },
                {
                    id: 'q3',
                    title: 'What challenges do you experience? (Select all that apply)',
                    type: 'checkboxes',
                    isRequired: true,
                    options: ['My child takes a long time to come out', 'My child is still doing classwork at closing time', 'Long queues or delays', 'Poor communication from the school'],
                    allowOther: true,
                },
                {
                    id: 'q4',
                    title: 'If an express pickup service were available—guaranteeing that your child is brought out with 3mins of arriving at the school without you getting of your car—would you use it?',
                    type: 'yes-no',
                    isRequired: true,
                }
            ]
        })
    }, [form]);

    const onSubmit = (data: FormData) => {
        if (!firestore) {
            toast({
                variant: "destructive",
                title: "Firestore not available",
            });
            return;
        }

        const slug = data.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const surveyData = {
            ...data,
            slug,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const surveysCollection = collection(firestore, 'surveys');
        form.control.disabled = true;

        addDoc(surveysCollection, surveyData)
            .then(() => {
                toast({
                    title: 'Survey Created',
                    description: `The survey "${data.title}" has been saved.`,
                });
                router.push('/admin/surveys');
            })
            .catch((error) => {
                const permissionError = new FirestorePermissionError({
                    path: surveysCollection.path,
                    operation: 'create',
                    requestResourceData: surveyData,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({
                    variant: 'destructive',
                    title: 'Uh oh! Something went wrong.',
                    description: 'There was a problem saving the survey.',
                });
            }).finally(() => {
                form.control.disabled = false;
            });
    };

    return (
        <div>
            <h1 className="text-4xl font-bold tracking-tight mb-8">Create New Survey</h1>
            <FormProvider {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                     <Card>
                        <CardHeader>
                            <CardTitle>Survey Details</CardTitle>
                            <CardDescription>Fill in the details for your new survey.</CardDescription>
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
                                            <MediaSelect {...field} />
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
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                    
                    <Card>
                        <CardHeader>
                            <CardTitle>Form Builder</CardTitle>
                            <CardDescription>Build your survey using the editor below.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <QuestionEditor />
                        </CardContent>
                    </Card>


                    <div className="flex justify-end gap-4">
                        <Button type="button" variant="outline" onClick={() => router.push('/admin/surveys')}>
                        Cancel
                        </Button>
                        <Button type="submit" disabled={form.formState.isSubmitting}>
                        {form.formState.isSubmitting ? 'Saving...' : 'Save Survey'}
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </div>
    );
}
