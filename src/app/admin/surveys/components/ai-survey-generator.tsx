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

import { addDoc, collection } from 'firebase/firestore';
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
        description: 'The AI is building your survey. This may take a moment.',
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
        
        const slug = generatedData.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const newSurvey: Omit<Survey, 'id'> = {
            ...generatedData,
            slug,
            status: 'draft',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const surveysCollection = collection(firestore, 'surveys');
        const docRef = await addDoc(surveysCollection, newSurvey);

        if (docRef.id) {
            toast({
                title: 'Survey Generated!',
                description: 'Redirecting you to the survey editor...',
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
    <Card className="max-w-3xl mx-auto">
        <CardHeader>
            <CardTitle>AI Survey Builder</CardTitle>
            <CardDescription>Provide content for your survey, and let AI do the heavy lifting.</CardDescription>
        </CardHeader>
        <CardContent>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Tabs
                        defaultValue="text"
                        className="w-full"
                        onValueChange={(value) => form.setValue('sourceType', value as 'text' | 'url' | 'file')}
                    >
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="text">Paste Text</TabsTrigger>
                            <TabsTrigger value="url">From URL</TabsTrigger>
                            <TabsTrigger value="file" disabled>Upload File (Soon)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="text" className="pt-4">
                            <FormField
                                control={form.control}
                                name="text"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Paste your survey content</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Paste a list of questions, a meeting transcript, or a document outline here..."
                                                className="min-h-[200px]"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The AI will analyze this text to create questions, suggest types, and structure your survey.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TabsContent>
                        <TabsContent value="url" className="pt-4">
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>URL to a public document or webpage</FormLabel>
                                        <FormControl>
                                            <Input placeholder="https://..." {...field} value={field.value ?? ''} />
                                        </FormControl>
                                        <FormDescription>
                                            e.g., a link to a Google Doc (published to web), a blog post, or a webpage.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TabsContent>
                        <TabsContent value="file" className="pt-4">
                            <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg text-center bg-muted/50">
                                <UploadCloud className="w-10 h-10 text-muted-foreground" />
                                <p className="mt-4 font-semibold">File upload is coming soon!</p>
                                <p className="text-sm text-muted-foreground">You'll be able to upload .pdf, .docx, and .txt files.</p>
                            </div>
                        </TabsContent>
                    </Tabs>
                    <div className="flex justify-end mt-8">
                        <Button type="submit" disabled={isGenerating} size="lg">
                            {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                             <Sparkles className="mr-2 h-4 w-4" />
                            {isGenerating ? 'Generating...' : 'Generate Survey'}
                        </Button>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
