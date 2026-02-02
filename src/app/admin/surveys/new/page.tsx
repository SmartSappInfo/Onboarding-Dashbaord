'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { collection, addDoc } from 'firebase/firestore';

import { Button } from '@/components/ui/button';
import {
  Form,
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
import type { SurveyQuestion } from '@/lib/types';


const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  bannerImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']),
});

type FormData = z.infer<typeof formSchema>;

// This is the hardcoded question set based on the seed survey.
const seedQuestions: SurveyQuestion[] = [
    {
      id: 'q1-pickup-duty',
      title: 'Do you personally pick up your ward at school closing time?',
      type: 'yes-no',
      isRequired: true,
    },
    {
      id: 'q2-process-effective',
      title: 'If yes, is the current pickup process at your ward’s school effective and convenient for you?',
      type: 'yes-no',
      isRequired: false, // This depends on the answer to q1
    },
    {
      id: 'q3-challenges',
      title: 'If no, what challenges do you experience? (Select all that apply)',
      type: 'checkboxes',
      options: [
        'My child takes a long time to come out',
        'My child is still doing classwork at closing time',
        'Long queues or delays',
        'Poor communication from the school',
      ],
      allowOther: true,
      isRequired: false, // This depends on the answer to q2
    },
    {
      id: 'q4-express-pickup',
      title: 'If an express pickup service were available—guaranteeing that your child is brought out with 3mins of arriving at the school without you getting of your car—would you use it?',
      type: 'yes-no',
      isRequired: true,
    },
];

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
        },
    });

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
            questions: seedQuestions, // Using the hardcoded questions for now
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
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle>Survey Details</CardTitle>
                    <CardDescription>Fill in the details for your new survey. The question builder will be enabled in a future update.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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

                             <div className="rounded-lg border bg-muted/50 p-6">
                                <h3 className="text-lg font-semibold mb-2">Questions</h3>
                                <p className="text-sm text-muted-foreground mb-4">The dynamic question editor will be implemented in the next phase. For now, creating a survey will use a default set of questions.</p>
                                <div className="space-y-4">
                                {seedQuestions.map((q, i) => (
                                    <div key={q.id} className="p-4 border rounded-md bg-background/50">
                                        <p className="font-medium">
                                            {i + 1}. {q.title}
                                        </p>
                                        <p className="text-xs text-muted-foreground capitalize mt-1">
                                            Type: {q.type.replace('-', ' ')}
                                            {q.isRequired && ' (Required)'}
                                        </p>
                                    </div>
                                ))}
                                </div>
                            </div>

                            <div className="flex justify-end gap-4">
                                <Button type="button" variant="outline" onClick={() => router.push('/admin/surveys')}>
                                Cancel
                                </Button>
                                <Button type="submit" disabled={form.formState.isSubmitting}>
                                {form.formState.isSubmitting ? 'Saving...' : 'Save Survey'}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}
