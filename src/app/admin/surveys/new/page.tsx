
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
import SurveyPreviewButton from '../components/survey-preview-button';

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
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;

        // Seed with a default survey for demonstration
        form.reset({
            title: 'Comprehensive Feedback Survey (All Elements)',
            description: 'This survey includes all available question types and layout blocks for testing and demonstration purposes. Please review and interact with each element.',
            status: 'draft',
            elements: [
                // Questions
                { id: 'q_text', title: 'What is your full name?', type: 'text', isRequired: true, placeholder: 'e.g., Jane Doe' },
                { id: 'q_yesno', title: 'Do you personally pick up your child from school?', type: 'yes-no', isRequired: true },
                { 
                    id: 'q_multiplechoice', 
                    title: 'How often do you use the SmartSapp app?', 
                    type: 'multiple-choice', 
                    isRequired: true, 
                    options: ['Daily', 'Weekly', 'Monthly', 'Rarely'] 
                },
                { 
                    id: 'q_checkboxes', 
                    title: 'What features do you find most useful? (Select all that apply)', 
                    type: 'checkboxes', 
                    isRequired: true, 
                    options: ['Express Pickup', 'Billing & Payments', 'School Announcements', 'Academic Reports'],
                    allowOther: true,
                },
                 { 
                    id: 'q_dropdown', 
                    title: 'What is your primary relationship to the student?', 
                    type: 'dropdown', 
                    isRequired: true, 
                    options: ['Parent', 'Guardian', 'Driver', 'Family Member', 'Other'],
                    hidden: true, // Hidden by default, shown by logic
                },
                { 
                    id: 'q_rating', 
                    title: 'On a scale of 1-5, how would you rate the school\'s communication?', 
                    type: 'rating', 
                    isRequired: true,
                    defaultValue: 4,
                },
                { id: 'q_date', title: 'What date would be best for a parent-teacher conference this term?', type: 'date', isRequired: false, defaultValue: now },
                { id: 'q_time', title: 'What time do you usually arrive for pickup?', type: 'time', isRequired: false, defaultValue: timeString },
                {
                    id: 'q_longtext',
                    title: 'Do you have any additional comments or suggestions for us?',
                    type: 'long-text',
                    isRequired: false,
                    placeholder: 'Share your thoughts on how we can improve...'
                },
                { id: 'q_fileupload', title: 'Please upload a copy of your child\'s last report card.', type: 'file-upload', isRequired: false },

                // Layout Blocks
                { id: 'layout_heading', type: 'heading', title: 'Additional Media Section' },
                { id: 'layout_description', type: 'description', text: 'This section contains various media and layout elements for demonstration.' },
                { id: 'layout_divider', type: 'divider' },
                { id: 'layout_image', type: 'image', url: 'https://picsum.photos/seed/survey-image/600/400' },
                { id: 'layout_video', type: 'video', url: 'https://youtu.be/M6MUlDkfZOg' },
                { id: 'layout_audio', type: 'audio', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
                { id: 'layout_document', type: 'document', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' },
                { id: 'layout_embed', type: 'embed', html: '<blockquote class="twitter-tweet"><p lang="en" dir="ltr">Hello world!</p>&mdash; Studio (@Firebase) <a href="https://twitter.com/Firebase/status/1580224096059375616">October 12, 2022</a></blockquote> <script async src="https://platform.twitter.com/widgets.js" charset="utf-8"></script>' },
                
                // Logic Block
                {
                    id: 'logic_1',
                    type: 'logic',
                    rules: [
                        {
                            sourceQuestionId: 'q_yesno',
                            operator: 'isEqualTo',
                            targetValue: 'No',
                            action: {
                                type: 'show',
                                targetElementIds: ['q_dropdown']
                            }
                        }
                    ]
                },
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
                    
                    <Card className="bg-muted/30">
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
                        {form.formState.isSubmitting ? 'Saving...' : 'Save Survey'}
                        </Button>
                    </div>
                </form>
            </FormProvider>
        </div>
    );
}
