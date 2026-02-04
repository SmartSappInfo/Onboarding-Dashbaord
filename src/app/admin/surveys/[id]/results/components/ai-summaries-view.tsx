
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Survey, SurveyResponse, SurveySummary } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { querySurveyData } from '@/ai/flows/query-survey-data-flow';
import { format } from 'date-fns';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Sparkles, BrainCircuit } from 'lucide-react';
import { RainbowButton } from '@/components/ui/rainbow-button';

const formSchema = z.object({
  prompt: z.string().min(10, { message: 'Please enter a query of at least 10 characters.' }),
});

type FormData = z.infer<typeof formSchema>;

export default function AISummariesView({ survey, responses }: { survey: Survey, responses: SurveyResponse[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isQuerying, setIsQuerying] = React.useState(false);
    const [lastQueryResult, setLastQueryResult] = React.useState<string | null>(null);
    const [lastQuery, setLastQuery] = React.useState<string | null>(null);

    const summariesCol = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, `surveys/${survey.id}/summaries`), orderBy('createdAt', 'desc'));
    }, [firestore, survey.id]);

    const { data: summaries, isLoading } = useCollection<SurveySummary>(summariesCol);

    const form = useForm<FormData>({
        resolver: zodResolver(formSchema),
        defaultValues: { prompt: '' },
    });

    const onSubmit = async (data: FormData) => {
        setIsQuerying(true);
        setLastQueryResult(null);
        setLastQuery(data.prompt);
        try {
            const result = await querySurveyData({
                survey,
                responses,
                query: data.prompt,
            });
            setLastQueryResult(result.answer);
            form.reset();
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Query Failed', description: e.message });
        } finally {
            setIsQuerying(false);
        }
    };
    
    return (
        <div className="mt-6 space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BrainCircuit /> Interactive AI Analysis</CardTitle>
                    <CardDescription>Ask a specific question about the survey responses.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="prompt"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Your Question</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="e.g., 'How many people mentioned pricing?' or 'Summarize the feedback from dissatisfied users.'"
                                                className="min-h-[100px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                                <RainbowButton type="submit" disabled={isQuerying}>
                                    {isQuerying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                    {isQuerying ? 'Thinking...' : 'Ask AI'}
                                </RainbowButton>
                            </div>
                        </form>
                    </Form>

                    {isQuerying && (
                        <div className="mt-6 space-y-4">
                            <Skeleton className="h-6 w-1/3" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    )}

                    {lastQueryResult && (
                        <Card className="mt-6">
                             <CardHeader>
                                <CardTitle className="text-lg">AI Response</CardTitle>
                                <CardDescription>For your query: "{lastQuery}"</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div
                                    className="prose prose-sm dark:prose-invert max-w-none"
                                    dangerouslySetInnerHTML={{ __html: lastQueryResult }}
                                />
                            </CardContent>
                        </Card>
                    )}
                </CardContent>
            </Card>
            
            <div className="space-y-4">
                <h3 className="text-xl font-semibold">Generated Summary History</h3>
                {isLoading && (
                    <div className="space-y-4">
                        <Skeleton className="h-14 w-full" />
                        <Skeleton className="h-14 w-full" />
                    </div>
                )}
                {!isLoading && (!summaries || summaries.length === 0) && (
                    <p className="text-muted-foreground text-center py-8">No AI summaries have been generated for this survey yet.</p>
                )}
                {summaries && summaries.length > 0 && (
                    <Accordion type="single" collapsible className="w-full">
                        {summaries.map(summary => (
                             <AccordionItem key={summary.id} value={summary.id}>
                                <AccordionTrigger>
                                    Summary from {format(new Date(summary.createdAt), "PPP 'at' p")}
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div
                                        className="prose prose-sm dark:prose-invert max-w-none p-4"
                                        dangerouslySetInnerHTML={{ __html: summary.summary }}
                                    />
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                )}
            </div>
        </div>
    );
}

