
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import type { Survey, SurveyResponse, SurveySummary } from '@/lib/types';
import { collection, query, orderBy, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { querySurveyData } from '@/ai/flows/query-survey-data-flow';
import { format } from 'date-fns';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Sparkles, BrainCircuit, MoreVertical, Copy, Trash2, MessageSquareQuote } from 'lucide-react';
import { RainbowButton } from '@/components/ui/rainbow-button';

const formSchema = z.object({
  prompt: z.string().min(10, { message: 'Please enter a query of at least 10 characters.' }),
});

type FormData = z.infer<typeof formSchema>;

export default function AISummariesView({ survey, responses }: { survey: Survey, responses: SurveyResponse[] }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [isQuerying, setIsQuerying] = React.useState(false);
    const [summaryToDelete, setSummaryToDelete] = React.useState<SurveySummary | null>(null);

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
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Firestore not available' });
            return;
        }
        setIsQuerying(true);
        try {
            const result = await querySurveyData({
                survey,
                responses,
                query: data.prompt,
            });

            const summaryData: Omit<SurveySummary, 'id'> = {
                summary: result.answer,
                createdAt: new Date().toISOString(),
                prompt: data.prompt,
            };

            const summariesCollection = collection(firestore, `surveys/${survey.id}/summaries`);
            await addDoc(summariesCollection, summaryData);
            
            toast({ title: "AI Response Saved", description: "Your query and its response have been saved to the history." });
            form.reset();

        } catch (e: any) {
            toast({ variant: 'destructive', title: 'AI Query Failed', description: e.message });
        } finally {
            setIsQuerying(false);
        }
    };

    const handleUseAsContext = (summary: SurveySummary) => {
        const contextText = summary.summary.replace(/<[^>]*>?/gm, ''); // strip html
        form.setValue('prompt', `Based on the previous analysis ("${summary.prompt || 'summary'}"):\n\n"${contextText.substring(0, 150)}..."\n\nMy new question is: `);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCopy = (summary: SurveySummary) => {
        const textToCopy = summary.summary.replace(/<[^>]*>?/gm, '');
        navigator.clipboard.writeText(textToCopy);
        toast({ title: 'Copied to clipboard!' });
    };

    const handleDelete = () => {
        if (!firestore || !summaryToDelete) return;
        const docRef = doc(firestore, `surveys/${survey.id}/summaries`, summaryToDelete.id);
        
        deleteDoc(docRef)
            .then(() => {
                toast({ title: 'Summary Deleted', description: 'The selected summary has been removed from history.' });
            })
            .catch((e) => {
                const permissionError = new FirestorePermissionError({
                    path: docRef.path,
                    operation: 'delete',
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete summary.' });
            })
            .finally(() => {
                setSummaryToDelete(null);
            });
    };
    
    return (
        <AlertDialog open={!!summaryToDelete} onOpenChange={(open) => !open && setSummaryToDelete(null)}>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start p-1">
                {/* Left Pane (AI Query Form) */}
                <div className="lg:col-span-2 lg:sticky top-6">
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
                                                        className="min-h-[120px]"
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
                        </CardContent>
                    </Card>
                </div>

                {/* Right Pane (Summary History) */}
                <div className="lg:col-span-3">
                    <div className="space-y-4">
                        <h3 className="text-xl font-semibold">Generated Summary History</h3>
                        {isLoading && (
                            <div className="space-y-4">
                                <Skeleton className="h-40 w-full" />
                                <Skeleton className="h-40 w-full" />
                            </div>
                        )}
                        {!isLoading && (!summaries || summaries.length === 0) && (
                            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                                <p className="text-muted-foreground">No AI summaries have been generated yet.</p>
                                <p className="text-sm text-muted-foreground mt-1">Ask a question to get started.</p>
                            </div>
                        )}
                        {summaries && summaries.length > 0 && (
                            <div className="space-y-6">
                                {isQuerying && (
                                     <Card>
                                        <CardHeader>
                                            <CardTitle><Skeleton className="h-5 w-3/4" /></CardTitle>
                                            <CardDescription><Skeleton className="h-4 w-1/4" /></CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-full" />
                                            <Skeleton className="h-4 w-5/6" />
                                        </CardContent>
                                    </Card>
                                )}
                                {summaries.map(summary => (
                                    <Card key={summary.id} className="shadow-sm">
                                        <CardHeader>
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <CardTitle className="text-base font-semibold leading-snug">
                                                        {summary.prompt || 'AI Generated Summary'}
                                                    </CardTitle>
                                                    <CardDescription className="text-xs mt-1">
                                                        {format(new Date(summary.createdAt), "MMM d, yyyy 'at' p")}
                                                    </CardDescription>
                                                </div>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleCopy(summary)}>
                                                            <Copy className="mr-2 h-4 w-4" />
                                                            <span>Copy Text</span>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onSelect={() => setSummaryToDelete(summary)} className="text-destructive">
                                                            <Trash2 className="mr-2 h-4 w-4" />
                                                            <span>Delete</span>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardHeader>
                                        <CardContent 
                                            className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-3 [&>ul]:pl-4"
                                            dangerouslySetInnerHTML={{ __html: summary.summary }}
                                        />
                                        <CardFooter>
                                             <Button variant="outline" size="sm" onClick={() => handleUseAsContext(summary)}>
                                                <MessageSquareQuote className="mr-2 h-4 w-4" />
                                                Use as Context for Next Question
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete this AI-generated summary from your history.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
      

  