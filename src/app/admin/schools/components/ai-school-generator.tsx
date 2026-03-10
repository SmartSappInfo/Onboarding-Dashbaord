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
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { 
    Loader2, 
    Sparkles, 
    Building, 
    Zap, 
    ArrowRight, 
    X,
    ShieldCheck,
    CheckCircle2,
    Info
} from 'lucide-react';
import { addDoc, collection, query, getDocs, orderBy, limit } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { extractSchoolData } from '@/ai/flows/extract-school-data-flow';
import { logActivity } from '@/lib/activity-logger';
import { RainbowButton } from '@/components/ui/rainbow-button';
import type { Module, Zone, OnboardingStage } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  text: z.string().min(50, { message: 'Please provide at least 50 characters of descriptive text.' }),
});

type FormData = z.infer<typeof formSchema>;

export default function AiSchoolGenerator() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { text: '' },
  });

  // Fetch contextual mapping data
  const zonesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones'), orderBy('name')) : null, [firestore]);
  const modulesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'modules'), orderBy('order')) : null, [firestore]);
  const stagesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'onboardingStages'), orderBy('order'), limit(1)) : null, [firestore]);

  const { data: zones } = useCollection<Zone>(zonesQuery);
  const { data: modules } = useCollection<Module>(modulesQuery);
  const { data: stages } = useCollection<OnboardingStage>(stagesQuery);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !user) return;

    setIsGenerating(true);
    toast({
        title: 'Architecting School Record...',
        description: 'AI is extracting identities and mapping stakeholders.',
    });

    try {
        const result = await extractSchoolData({ text: data.text });

        if (!result || !result.name) {
            throw new Error('AI failed to identify the school name.');
        }

        // 1. Prepare Smart Mapping
        const slug = result.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const defaultStage = stages?.[0] || { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585' };
        
        // 2. Map Suggested Modules
        const mappedModules = (result.suggestedModuleNames || []).map(name => {
            const match = modules?.find(m => m.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(m.name.toLowerCase()));
            return match ? { id: match.id, name: match.name, abbreviation: match.abbreviation, color: match.color } : null;
        }).filter(Boolean);

        // 3. Construct Final Payload
        const schoolData = {
            name: result.name,
            initials: result.initials || result.name.substring(0, 3).toUpperCase(),
            slug,
            slogan: result.slogan || '',
            location: result.location || '',
            nominalRoll: result.nominalRoll || 0,
            status: 'Active' as const,
            focalPersons: result.focalPersons || [],
            modules: mappedModules,
            stage: { id: defaultStage.id, name: defaultStage.name, order: defaultStage.order, color: defaultStage.color },
            assignedTo: { userId: user.uid, name: user.displayName || 'Architect', email: user.email || '' },
            createdAt: new Date().toISOString(),
            zone: zones?.[0] || { id: 'unassigned', name: 'Unassigned' }
        };

        const docRef = await addDoc(collection(firestore, 'schools'), schoolData);

        await logActivity({
            schoolId: docRef.id,
            schoolName: result.name,
            schoolSlug: slug,
            userId: user.uid,
            type: 'school_created',
            source: 'user_action',
            description: `AI architected new school record for "${result.name}"`,
            metadata: { aiExplanation: result.explanation }
        });

        toast({ title: 'Institutional Hub Created', description: `AI has successfully onboarded ${result.name}.` });
        router.push(`/admin/schools/${docRef.id}/edit`);

    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Onboarding Failed', description: error.message });
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto shadow-2xl border-none ring-1 ring-border rounded-[2.5rem] overflow-hidden bg-white">
        <CardHeader className="text-center pb-10 pt-12 border-b bg-muted/30 relative">
            <div className="mx-auto bg-primary/10 w-16 h-16 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-xl shadow-primary/5">
                <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight uppercase">AI Institutional Architect</CardTitle>
            <CardDescription className="text-base font-medium max-w-md mx-auto mt-2">Paste school profiles, emails, or memos. AI will handle the data entry and stakeholder mapping.</CardDescription>
        </CardHeader>
        <CardContent className="p-8 sm:p-12">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
                            <FormItem className="text-left">
                                <FormLabel className="text-[10px] font-black uppercase tracking-[0.2em] text-primary ml-1">Raw Intelligence Source</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="e.g. Ghana International School (GIS) located in Accra. We have 1200 students and need help with billing. The principal is Dr. Mary Ashun (principal@gis.edu.gh)..."
                                        className="min-h-[300px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-8 text-lg leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/20 transition-all placeholder:italic"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4">
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm text-left">
                            <CheckCircle2 className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-blue-900 uppercase">Automatic Mapping</p>
                                <p className="text-[10px] text-blue-700 leading-relaxed font-bold uppercase tracking-tighter opacity-70">
                                    Identifies stakeholders, contact details, and student roll directly from context.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4 p-5 rounded-2xl bg-purple-50 border border-purple-100 shadow-sm text-left">
                            <Zap className="h-5 w-5 text-purple-600 shrink-0 mt-0.5" />
                            <div className="space-y-1">
                                <p className="text-xs font-black text-purple-900 uppercase">Pipeline Initialization</p>
                                <p className="text-[10px] text-purple-700 leading-relaxed font-bold uppercase tracking-tighter opacity-70">
                                    Generates institutional slug and assigns record to the 'Welcome' workflow stage.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-8 border-t border-border/50">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => router.push('/admin/schools')}
                          disabled={isGenerating}
                          className="font-black uppercase tracking-widest text-[10px] h-12 px-8 rounded-xl"
                        >
                            Discard
                        </Button>
                        <RainbowButton type="submit" disabled={isGenerating || !form.formState.isValid} className="h-14 px-12 font-black text-lg gap-3 shadow-2xl active:scale-95 transition-all">
                            {isGenerating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                            {isGenerating ? 'Analyzing Logic...' : 'Initialize Hub with AI'}
                        </RainbowButton>
                    </div>
                </form>
            </Form>
        </CardContent>
        <CardFooter className="bg-muted/30 p-6 border-t flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground opacity-40 shrink-0" />
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.1em] text-left">
                Architect results are pre-filled for your final review. You can adjust all institutional settings in the next step.
            </p>
        </CardFooter>
    </Card>
  );
}
