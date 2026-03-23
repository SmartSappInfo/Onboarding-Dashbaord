'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, UploadCloud, Sparkles } from 'lucide-react';

import { addDoc, collection, doc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { generateSurvey } from '@/ai/flows/generate-survey-flow';
import type { Survey } from '@/lib/types';


const formSchema = z.object({
  sourceType: z.enum(['text', 'url', 'file']),
  text: z.string().optional(),
  url: z.string().optional().refine(val => !val || z.string().url().safeParse(val).success, {
      message: "Please enter a valid URL."
  }),
});

type FormData = z.infer<typeof formSchema>;

export default function AiSurveyGenerator() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      sourceType: 'text',
    },
  });

  const onSubmit = async (data: FormData) => {
    if (!firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'Firestore connection is not available.' });
      return;
    }

    setIsGenerating(true);
    toast({
        title: 'Generating Survey...',
        description: 'The AI is building your survey and outcome logic. This may take a moment.',
    });

    try {
        let content = '';
        let sourceType: 'text' | 'url' = 'text';

        if (form.getValues('sourceType') === 'text') {
            if (!data.text || data.text.length < 50) {
                form.setError('text', { message: 'Please provide at least 50 characters of text.' });
                setIsGenerating(false);
                return;
            }
            content = data.text;
            sourceType = 'text';
        } else if (form.getValues('sourceType') === 'url') {
             if (!data.url) {
                form.setError('url', { message: 'Please provide a URL.' });
                setIsGenerating(false);
                return;
            }
            content = data.url;
            sourceType = 'url';
        }

        const generatedData = await generateSurvey({ sourceType, content });

        if (!generatedData || !generatedData.title) {
            throw new Error('AI model did not return a valid survey structure.');
        }
        
        const slug = (generatedData.title + '-' + Math.random().toString(36).substring(2, 5))
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');

        const { resultPages, ...mainSurveyData } = generatedData;

        const newSurvey: Omit<Survey, 'id'> = {
            ...mainSurveyData,
            slug,
            status: 'published',
            backgroundPattern: 'none', // Set strictly to 'none' by default
            workspaceIds: [],
            internalName: generatedData.title,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const surveysCollection = collection(firestore, 'surveys');
        const docRef = await addDoc(surveysCollection, newSurvey);

        if (docRef.id && resultPages) {
            // Save result pages to subcollection
            const pagesCol = collection(firestore, `surveys/${docRef.id}/resultPages`);
            for (const page of resultPages) {
                await setDoc(doc(pagesCol, page.id), page);
            }

            toast({
                title: 'Survey Generated!',
                description: 'The AI has configured questions, scoring, and outcome pages.',
            });
            router.push(`/admin/surveys/${docRef.id}/edit`);
        } else {
            throw new Error('Failed to save the generated survey to the database.');
        }

    } catch (error: any) {
        console.error(error);
        toast({
            variant: 'destructive',
            title: 'An Error Occurred',
            description: error.message || 'The AI failed to generate the survey. Please try again.',
        });
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-2xl">
        <CardHeader className="text-center pb-8 border-b bg-muted/30">
            <div className="mx-auto bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-black">AI Survey Architect</CardTitle>
            <CardDescription className="text-base">Provide your source material and the AI will build a complete, scored assessment flow for you.</CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Tabs
                        defaultValue="text"
                        className="w-full"
                        onValueChange={(value) => form.setValue('sourceType', value as 'text' | 'url' | 'file')}
                    >
                        <TabsList className="grid w-full grid-cols-3 h-12 bg-muted p-1">
                            <TabsTrigger value="text" className="font-bold">Paste Text</TabsTrigger>
                            <TabsTrigger value="url" className="font-bold">From URL</TabsTrigger>
                            <TabsTrigger value="file" disabled className="font-bold">Upload File (Soon)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="text" className="pt-6">
                            <FormField
                                control={form.control}
                                name="text"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Source Material</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Paste a document outline, a list of requirements, or a quiz draft here..."
                                                className="min-h-[250px] text-base leading-relaxed p-4"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The AI will identify questions, sections, and logic rules based on your text.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TabsContent>
                        <TabsContent value="url" className="pt-6">
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-xs font-black uppercase tracking-widest text-muted-foreground">Target URL</FormLabel>
                                        <FormControl>
                                            <Input placeholder="https://..." {...field} value={field.value ?? ''} className="h-12 text-lg" />
                                        </FormControl>
                                        <FormDescription>
                                            Link to a public article, Google Doc, or webpage to parse for content.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TabsContent>
                    </Tabs>
                    <div className="flex justify-between items-center mt-12 border-t pt-8">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => router.push('/admin/surveys')}
                          disabled={isGenerating}
                          className="font-bold"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isGenerating} size="lg" className="h-14 px-8 font-black text-lg gap-3">
                            {isGenerating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                            {isGenerating ? 'Building Engine...' : 'Generate Intelligent Survey'}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
