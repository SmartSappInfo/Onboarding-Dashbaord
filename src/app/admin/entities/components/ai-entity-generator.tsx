'use client';

import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
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
    Info,
    Target
} from 'lucide-react';
import { addDoc, collection, query, getDocs, orderBy, limit, where, doc, writeBatch } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { extractSchoolData } from '@/ai/flows/extract-school-data-flow';
import { logActivity } from '@/lib/activity-logger';
import { Button as MovingButton } from '@/components/ui/moving-border';
import type { Module, Zone, OnboardingStage } from '@/lib/types';
import { cn } from '@/lib/utils';

const formSchema = z.object({
  text: z.string().min(50, { message: 'Please provide at least 50 characters of descriptive text.' }),
  track: z.enum(['onboarding', 'prospect']).default('onboarding'),
});

type FormData = z.infer<typeof formSchema>;

export default function AiEntityGenerator() {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeOrganizationId } = useTenant();
  const { activeWorkspaceId } = useWorkspace();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        text: '',
        track: 'onboarding'
    },
  });

  // Fetch contextual mapping data
  const zonesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'zones'), orderBy('name')) : null, [firestore]);
  const modulesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'modules'), orderBy('order')) : null, [firestore]);

  const { data: zones } = useCollection<Zone>(zonesQuery);
  const { data: modules } = useCollection<Module>(modulesQuery);

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

        // 1. Resolve Target Pipeline and Initial Stage
        let targetPipelineId = 'institutional_onboarding';
        if (data.track === 'prospect') {
            const pSnap = await getDocs(query(collection(firestore, 'pipelines'), where('targetTrack', '==', 'prospect'), limit(1)));
            if (!pSnap.empty) targetPipelineId = pSnap.docs[0].id;
        }

        const stagesQuery = query(
            collection(firestore, 'onboardingStages'), 
            where('pipelineId', '==', targetPipelineId),
            orderBy('order', 'asc'), 
            limit(1)
        );
        const stagesSnap = await getDocs(stagesQuery);
        const defaultStage = !stagesSnap.empty 
            ? { id: stagesSnap.docs[0].id, name: stagesSnap.docs[0].data().name, order: stagesSnap.docs[0].data().order, color: stagesSnap.docs[0].data().color }
            : { id: 'welcome', name: 'Welcome', order: 1, color: '#f72585' };

        // 2. Prepare Smart Mapping
        const slug = result.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        const mappedModules = (result.suggestedModuleNames || []).map(name => {
            const match = modules?.find(m => m.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(m.name.toLowerCase()));
            return match ? { id: match.id, name: match.name, abbreviation: match.abbreviation, color: match.color } : null;
        }).filter(Boolean);

        // 3. Construct Global Identity Payload
        const entityId = doc(collection(firestore, 'entities')).id;
        const globalEntityData = {
            id: entityId,
            name: result.name,
            entityType: 'institution' as const,
            institutionData: {
                name: result.name,
                initials: result.initials || result.name.substring(0, 3).toUpperCase(),
                slug,
                slogan: result.slogan || '',
                location: {
                    address: result.location || '',
                    zone: zones?.[0]?.name || 'Unassigned'
                },
                nominalRoll: result.nominalRoll || 0,
                logoUrl: null
            },
            contacts: (result.focalPersons || []).map((p: any) => ({
                name: p.name,
                type: p.role || 'Contact',
                email: p.email || '',
                phone: p.phone || '',
                isSignatory: true
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 4. Construct Workspace Operational Payload
        const workspaceId = data.track === 'prospect' ? 'prospects' : activeWorkspaceId || 'onboarding';
        const workspaceEntityId = `${workspaceId}_${entityId}`;
        const workspaceEntityData = {
            id: workspaceEntityId,
            entityId: entityId,
            workspaceId: workspaceId,
            displayName: result.name,
            status: 'active' as const,
            lifecycleStatus: 'Onboarding' as const,
            pipelineId: targetPipelineId,
            stageId: defaultStage.id,
            currentStageName: defaultStage.name,
            assignedTo: { 
                userId: user.uid, 
                name: user.displayName || 'Architect', 
                email: user.email || '' 
            },
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspaceTags: []
        };

        // 5. Execute Atomic Persistence
        const batch = writeBatch(firestore);
        batch.set(doc(firestore, 'entities', entityId), globalEntityData);
        batch.set(doc(firestore, 'workspace_entities', workspaceEntityId), workspaceEntityData);
        await batch.commit();

        await logActivity({
            organizationId: activeOrganizationId,
            entityId: entityId,
            entityName: result.name,
            entitySlug: slug,
            userId: user.uid,
            workspaceId: workspaceId,
            type: 'school_created',
            source: 'user_action',
            description: `AI architected new ${data.track} record for "${result.name}"`,
            metadata: { track: data.track, aiExplanation: result.explanation }
        });

        toast({ title: 'Institutional Hub Created', description: `AI has successfully architected ${result.name}.` });
        router.push(`/admin/entities/${entityId}`);

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
 <CardTitle className="text-3xl font-semibold tracking-tight ">AI Institutional Architect</CardTitle>
 <CardDescription className="text-base font-medium max-w-md mx-auto mt-2">Paste school profiles or memos. AI will handle the track classification and data entry.</CardDescription>
        </CardHeader>
 <CardContent className="p-8 sm:p-12">
            <Form {...form}>
 <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Track Selector */}
                    <FormField
                        control={form.control}
                        name="track"
                        render={({ field }) => (
 <FormItem className="text-left space-y-4">
 <FormLabel className="text-[10px] font-semibold text-primary ml-1">Target Track</FormLabel>
 <div className="grid grid-cols-2 gap-4">
                                    <button
                                        type="button"
                                        onClick={() => field.onChange('onboarding')}
 className={cn(
                                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                                            field.value === 'onboarding' ? "border-primary bg-primary/5 shadow-md" : "border-transparent bg-muted/20 hover:bg-muted/40"
                                        )}
                                    >
 <div className={cn("p-2.5 rounded-xl shadow-sm", field.value === 'onboarding' ? "bg-primary text-white" : "bg-white text-muted-foreground")}>
 <Building className="h-5 w-5" />
                                        </div>
 <div className="flex flex-col">
 <span className="font-semibold text-xs ">Onboarding</span>
 <span className="text-[9px] font-bold text-muted-foreground opacity-60">Direct Signup</span>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => field.onChange('prospect')}
 className={cn(
                                            "flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left",
                                            field.value === 'prospect' ? "border-emerald-600 bg-emerald-50 shadow-md" : "border-transparent bg-muted/20 hover:bg-muted/40"
                                        )}
                                    >
 <div className={cn("p-2.5 rounded-xl shadow-sm", field.value === 'prospect' ? "bg-emerald-600 text-white" : "bg-white text-muted-foreground")}>
 <Target className="h-5 w-5" />
                                        </div>
 <div className="flex flex-col">
 <span className="font-semibold text-xs ">Prospect</span>
 <span className="text-[9px] font-bold text-muted-foreground opacity-60">Sales Lead</span>
                                        </div>
                                    </button>
                                </div>
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => (
 <FormItem className="text-left">
 <FormLabel className="text-[10px] font-semibold text-primary ml-1">Source Material</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Paste school data here..."
 className="min-h-[250px] rounded-[2rem] bg-muted/20 border-none shadow-inner p-8 text-lg leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/20"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

 <div className="flex items-center justify-between pt-8 border-t border-border/50">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => router.push('/admin/entities')}
                          disabled={isGenerating}
 className="font-semibold text-[10px] h-12 px-8 rounded-xl"
                        >
                            Discard
                        </Button>
                        <MovingButton 
                            type="submit" 
                            disabled={isGenerating || !form.formState.isValid} 
                            containerClassName="h-14 px-12 rounded-2xl"
 className="h-full w-full font-semibold text-lg gap-3 bg-slate-900"
                        >
 {isGenerating ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
                            {isGenerating ? 'Architecting...' : 'Initialize Hub with AI'}
                        </MovingButton>
                    </div>
                </form>
            </Form>
        </CardContent>
 <CardFooter className="bg-muted/30 p-6 border-t flex items-center gap-3">
 <Info className="h-4 w-4 text-muted-foreground opacity-40 shrink-0" />
 <p className="text-[9px] font-bold text-muted-foreground tracking-[0.1em] text-left">
                The architect will automatically map regional zones and managers based on your current institutional settings.
            </p>
        </CardFooter>
    </Card>
  );
}
