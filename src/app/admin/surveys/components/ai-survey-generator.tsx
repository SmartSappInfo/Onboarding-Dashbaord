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
import { addDoc, collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';
import { generateSurvey } from '@/ai/flows/generate-survey-flow';
import type { Survey, UserProfile } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import AiModelSelector from '@/components/ai/AiModelSelector';
import { Button as MovingButton } from '@/components/ui/moving-border';
import { Loader2, Sparkles } from 'lucide-react';


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
  const { user } = useUser();
  const { activeOrganizationId } = useWorkspace();
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

        // Fetch user preferences for model and provider
        let provider = 'openrouter';
        let modelId = 'openrouter/free';
        
        if (user && firestore) {
            const userRef = doc(firestore, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const profile = userSnap.data() as UserProfile;
                provider = profile.preferredAiProvider || 'openrouter';
                modelId = profile.preferredAiModel || 'openrouter/free';
            }
        }

        const generatedData = await generateSurvey({ 
            sourceType, 
            content,
            organizationId: activeOrganizationId,
            provider,
            modelId,
        });

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

        if (docRef.id) {
            // Save result pages to subcollection if they exist
            if (resultPages && resultPages.length > 0) {
                const pagesCol = collection(firestore, `surveys/${docRef.id}/resultPages`);
                for (const page of resultPages) {
                    await setDoc(doc(pagesCol, page.id), page);
                }
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
    <Card className="max-w-3xl mx-auto shadow-2xl border bg-card/40 backdrop-blur-md rounded-[2rem] overflow-hidden">
        <CardHeader className="p-8 pb-8 border-b border-border/50 bg-transparent text-left relative">
            <div className="flex items-center justify-between mb-6">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center border border-primary/20 shadow-inner">
                    <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-black tracking-tight">AI Survey Architect</CardTitle>
            </div>
            <CardDescription className="text-sm font-medium text-muted-foreground">Provide your source material and the AI will build a complete, scored assessment flow for you.</CardDescription>
            
            <div className="mt-8 flex flex-col items-start">
                <AiModelSelector className="items-start" />
            </div>
        </CardHeader>
        <CardContent className="p-8 pt-8">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                    <Tabs
                        defaultValue="text"
                        className="w-full"
                        onValueChange={(value) => form.setValue('sourceType', value as 'text' | 'url' | 'file')}
                    >
                        <TabsList className="grid w-full grid-cols-3 h-12 bg-background/50 border shadow-inner p-1 rounded-2xl mb-8">
                            <TabsTrigger value="text" className="font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">Paste Text</TabsTrigger>
                            <TabsTrigger value="url" className="font-bold rounded-xl data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all">From URL</TabsTrigger>
                            <TabsTrigger value="file" disabled className="font-bold rounded-xl opacity-50">Upload File (Soon)</TabsTrigger>
                        </TabsList>
                        <TabsContent value="text" className="mt-0">
                            <FormField
                                control={form.control}
                                name="text"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Source Material</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Paste a document outline, a list of requirements, or a quiz draft here..."
                                                className="min-h-[250px] text-sm leading-relaxed p-6 rounded-[2rem] bg-background/30 border-border/50 shadow-inner resize-none focus-visible:ring-1 focus-visible:ring-primary/20"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription className="text-xs font-medium ml-1">
                                            The AI will identify questions, sections, and logic rules based on your text.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TabsContent>
                        <TabsContent value="url" className="mt-0">
                            <FormField
                                control={form.control}
                                name="url"
                                render={({ field }) => (
                                    <FormItem className="space-y-4">
                                        <FormLabel className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Target URL</FormLabel>
                                        <FormControl>
                                            <Input placeholder="https://..." {...field} value={field.value ?? ''} className="h-14 text-base rounded-2xl bg-background/30 border-border/50 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/20 px-6" />
                                        </FormControl>
                                        <FormDescription className="text-xs font-medium ml-1">
                                            Link to a public article, Google Doc, or webpage to parse for content.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </TabsContent>
                    </Tabs>
                    <div className="flex justify-between items-center mt-12 border-t border-border/50 pt-8">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => router.push('/admin/surveys')}
                          disabled={isGenerating}
                          className="font-bold rounded-xl px-6 h-12 text-muted-foreground hover:text-foreground"
                        >
                            Cancel
                        </Button>
                        <MovingButton 
                            type="submit" 
                            disabled={isGenerating} 
                            containerClassName="h-14 px-8 rounded-full"
                            className="h-full w-full font-black text-sm gap-3 bg-[#0f172a] text-white hover:bg-[#0f172a]/90 border border-slate-700 shadow-[inset_0px_1px_0px_0px_rgba(255,255,255,0.1)]"
                        >
                            {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
                            {isGenerating ? 'Building Engine...' : 'Generate Intelligent Survey'}
                        </MovingButton>
                    </div>
                </form>
            </Form>
        </CardContent>
    </Card>
  );
}
