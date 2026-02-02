'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter, useParams } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';

import type { Survey } from '@/lib/types';
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
import { useFirestore, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { Skeleton } from '@/components/ui/skeleton';
import { MediaSelect } from '../../../schools/components/media-select';

const formSchema = z.object({
  title: z.string().min(5, { message: 'Title must be at least 5 characters.' }),
  description: z.string().min(10, { message: 'Description must be at least 10 characters.' }),
  bannerImageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  status: z.enum(['draft', 'published', 'archived']),
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
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardContent className="space-y-8">
                   <Skeleton className="h-10 w-full" />
                   <Skeleton className="h-24 w-full" />
                   <Skeleton className="h-24 w-full" />
                   <Skeleton className="h-10 w-full" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Edit Survey</CardTitle>
                <CardDescription>Update the details for your survey. The question editor will be enabled in a future update.</CardDescription>
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

                        <div className="rounded-lg border bg-muted/50 p-6">
                            <h3 className="text-lg font-semibold mb-2">Questions</h3>
                            <p className="text-sm text-muted-foreground mb-4">The dynamic question editor will be implemented in the next phase and existing questions cannot be modified at this time.</p>
                            {survey?.questions && (
                                <div className="space-y-4">
                                {survey.questions.map((q, i) => (
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
                            )}
                        </div>

                        <div className="flex justify-end gap-4">
                            <Button type="button" variant="outline" onClick={() => router.push('/admin/surveys')}>
                            Cancel
                            </Button>
                            <Button type="submit" disabled={form.formState.isSubmitting}>
                            {form.formState.isSubmitting ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}


export default function EditSurveyPage() {
    const params = useParams();
    const surveyId = params.id as string;

    return (
        <div>
            <h1 className="text-4xl font-bold tracking-tight mb-8">Edit Survey</h1>
            {surveyId ? <EditSurveyForm surveyId={surveyId} /> : <p>Survey ID not found.</p>}
        </div>
    );
}
