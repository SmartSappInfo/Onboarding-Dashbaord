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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
    Loader2, 
    Sparkles, 
    Info, 
    AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, doc, writeBatch, where } from 'firebase/firestore';
import { useFirestore, useUser, useCollection, useMemoFirebase } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';
import { extractSchoolData } from '@/ai/flows/extract-school-data-flow';
import { logActivity } from '@/lib/activity-logger';
import { withEntitySearchFields } from '@/lib/entities/entity-cache-domain';
import { RainbowButton } from '@/components/ui/rainbow-button';
import type { Module, Zone } from '@/lib/types';
import { 
    Select, 
    SelectContent, 
    SelectGroup, 
    SelectItem, 
    SelectLabel, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { AI_PROVIDERS } from '@/components/ai/AiModelSelector';
import { getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

type ModuleOption = Pick<Module, 'id' | 'name' | 'abbreviation' | 'color'>;

const formSchema = z.object({
  text: z.string().min(50, { message: 'Please provide at least 50 characters of descriptive text.' }),
  provider: z.string().default('anthropic'),
  modelId: z.string().default('claude-sonnet-4-6'),
});

type FormData = z.infer<typeof formSchema>;

interface AiEntityGeneratorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AiEntityGenerator({ open, onOpenChange }: AiEntityGeneratorProps) {
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeOrganizationId, activeOrganization } = useTenant();
  const { activeWorkspace, activeWorkspaceId } = useWorkspace();
  const terms = useTerminology();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { 
        text: '',
        provider: 'anthropic',
        modelId: 'claude-sonnet-4-6'
    },
  });

  const contactScope = activeWorkspace?.contactScope || 'institution';
  const [isGenerating, setIsGenerating] = React.useState(false);

  // Fetch contextual mapping data
  const zonesQuery = useMemoFirebase(() => firestore && activeOrganizationId ? query(collection(firestore, 'zones'), where('organizationId', '==', activeOrganizationId), orderBy('name')) : null, [firestore, activeOrganizationId]);
  const modulesQuery = useMemoFirebase(() => firestore && activeOrganizationId ? query(collection(firestore, 'modules'), where('organizationId', '==', activeOrganizationId), orderBy('order')) : null, [firestore, activeOrganizationId]);

  const { data: zones } = useCollection<Zone>(zonesQuery);
  const { data: modules } = useCollection<Module>(modulesQuery);

  // Fetch user preference on mount to set initial model
  React.useEffect(() => {
    if (user && firestore && open) {
      const userDoc = doc(firestore, 'users', user.uid);
      getDoc(userDoc).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          let provider = data.preferredAiProvider;
          let modelId = data.preferredAiModel;
          if (provider === 'openai') {
            provider = 'anthropic';
            modelId = 'claude-sonnet-4-6';
          }
          if (provider) {
            form.setValue('provider', provider);
          }
          if (modelId) {
            form.setValue('modelId', modelId);
          }
        }
      });
    }
  }, [user, firestore, open, form]);

  const availableProviders = React.useMemo(() => {
    if (!activeOrganization) return AI_PROVIDERS;

    const mode = activeOrganization.aiKeyMode || 'platform';
    if (mode === 'platform') return AI_PROVIDERS;

    return AI_PROVIDERS.filter(provider => {
        if (provider.id === 'googleai') return !!activeOrganization.geminiApiKey;
        if (provider.id === 'anthropic') return !!activeOrganization.claudeApiKey;
        if (provider.id === 'openrouter') return !!activeOrganization.openRouterApiKey;
        return false;
    });
  }, [activeOrganization]);

  const onSubmit = async (data: FormData) => {
    if (!firestore || !user || !activeWorkspaceId) return;

    setIsGenerating(true);
    toast({
        title: `Architecting ${terms.singular} Record...`,
        description: 'AI is extracting identities and mapping stakeholders.',
    });

    try {
        const result = await extractSchoolData({
            text: data.text,
            organizationId: activeOrganizationId,
            provider: data.provider,
            modelId: data.modelId,
        });

        if (!result || !result.name) {
            throw new Error(`AI failed to identify the ${terms.singular.toLowerCase()} name.`);
        }

        // 1. Prepare Smart Mapping
        const slug = result.name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        
        const aiModules = (result.suggestedModuleNames || []).map(name => {
            const match = modules?.find(m => m.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(m.name.toLowerCase()));
            return match ? { id: match.id, name: match.name, abbreviation: match.abbreviation, color: match.color } : null;
        }).filter(Boolean) as ModuleOption[];

        const finalModules = aiModules;

        // 3. Construct Global Identity Payload (new schema)
        const entityId = doc(collection(firestore, 'entities')).id;
        const globalEntityData = {
            id: entityId,
            name: result.name,
            entityType: (contactScope === 'person' || contactScope === 'family') ? contactScope : 'institution',
            // Root identity fields (new schema)
            initials: result.initials || result.name.substring(0, 3).toUpperCase(),
            slug,
            slogan: result.slogan || '',
            logoUrl: null as string | null,
            location: {
                locationString: result.location || '',
                zone: zones?.[0] ? { id: zones[0].id, name: zones[0].name } : undefined,
            },
            interests: finalModules,
            entityContacts: (result.contacts || []).map((p: any, index: number) => {
                const typeLabel = p.role || 'Contact';
                const typeKey = typeLabel.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '_');
                const ec: any = {
                    id: `ec_ai_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 5)}`,
                    name: p.name || '',
                    typeKey,
                    typeLabel,
                    isPrimary: index === 0,
                    isSignatory: true,
                    order: index,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                if (p.email) ec.email = p.email;
                if (p.phone) ec.phone = p.phone;
                return ec;
            }),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        // 4. Construct Workspace Operational Payload
        const workspaceId = activeWorkspaceId;
        const workspaceEntityId = `${workspaceId}_${entityId}`;
        const workspaceEntityData = withEntitySearchFields({
            id: workspaceEntityId,
            entityId: entityId,
            workspaceId: workspaceId,
            displayName: result.name,
            status: 'active' as const,
            assignedTo: {
                userId: user.uid,
                name: user.displayName || 'Architect',
                email: user.email || ''
            },
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            workspaceTags: []
        });

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
            type: 'entity_created',
            source: 'user_action',
            description: `AI architected new record for "${result.name}" in workspace ${workspaceId}`,
            metadata: { workspaceId, aiExplanation: result.explanation }
        });

        toast({ title: `${terms.singular} Hub Created`, description: `AI has successfully architected ${result.name}.` });
        onOpenChange(false);
        router.push(`/admin/entities/${entityId}`);

    } catch (error: any) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Onboarding Failed', description: error.message });
    } finally {
        setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-2xl border border-border bg-card p-0 overflow-hidden shadow-2xl">
        {/* Compact Aligned Dialog Header */}
        <DialogHeader className="p-6 text-left border-b bg-muted/10 flex flex-row items-center gap-4 shrink-0 rounded-t-2xl relative">
            <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center shadow-md shadow-primary/5 shrink-0">
                <Sparkles className="h-6 w-6 text-primary animate-pulse" />
            </div>
            <div className="min-w-0 pr-8">
                <DialogTitle className="text-xl font-bold tracking-tight">AI {terms.singular} Architect</DialogTitle>
                <DialogDescription className="text-xs font-medium mt-1">
                    Paste {terms.singular.toLowerCase()} profiles or memos. AI will extract identity, contacts, and auto-map modules using the selected AI model.
                </DialogDescription>
            </div>
        </DialogHeader>
        <div className="p-6 sm:p-8 max-h-[70vh] overflow-y-auto">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* AI Model Selector */}
                    <FormField
                        control={form.control}
                        name="modelId"
                        render={({ field }) => {
                            const selectedModel = field.value;
                            const allModels = availableProviders.flatMap(p => p.models);
                            const found = allModels.find(m => m.id === selectedModel);
                            const currentProvider = availableProviders.find(p => p.models.some(m => m.id === selectedModel)) || availableProviders[0];

                            const handleModelChange = (val: string) => {
                                const provider = availableProviders.find(p => p.models.some(m => m.id === val));
                                if (provider) {
                                    form.setValue('provider', provider.id);
                                }
                                field.onChange(val);
                            };

                            return (
                                <FormItem className="text-left space-y-1.5">
                                    <FormLabel className="text-[10px] font-semibold text-primary ml-1">AI Processing Model</FormLabel>
                                    <FormControl>
                                        <Select value={selectedModel} onValueChange={handleModelChange}>
                                            <SelectTrigger className="w-full h-12 rounded-xl bg-background border border-border shadow-inner focus:ring-1 focus:ring-primary/20 transition-all font-bold group">
                                                <div className="flex items-center gap-2.5">
                                                    {currentProvider && (
                                                        <div className={cn("p-1.5 rounded-lg transition-colors shrink-0", currentProvider.bgColor)}>
                                                            <currentProvider.icon className={cn("h-4 w-4", currentProvider.color)} />
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col items-start min-w-0">
                                                        <span className="text-sm font-bold text-foreground leading-tight truncate">
                                                            {found?.name || 'Select Model'}
                                                        </span>
                                                        {found?.description && (
                                                            <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                                                                {found.description}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </SelectTrigger>
                                            <SelectContent 
                                                className="rounded-xl border border-border shadow-2xl p-2 bg-background/95 backdrop-blur-xl"
                                                style={{ zIndex: 100000 }}
                                            >
                                                {availableProviders.map((provider) => (
                                                    <SelectGroup key={provider.id}>
                                                        <SelectLabel className="flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
                                                            <provider.icon className={cn("h-3 w-3", provider.color)} />
                                                            {provider.name}
                                                        </SelectLabel>
                                                        {provider.models.map((model) => (
                                                            <SelectItem 
                                                                key={model.id} 
                                                                value={model.id}
                                                                className="rounded-xl py-3 px-3 focus:bg-primary/5 cursor-pointer"
                                                            >
                                                                <div className="flex flex-col gap-0.5">
                                                                    <span className="font-bold text-sm tracking-tight">{model.name}</span>
                                                                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{model.description}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectGroup>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            );
                        }}
                    />

                    {/* Source Material Textarea */}
                    <FormField
                        control={form.control}
                        name="text"
                        render={({ field }) => {
                            const textVal = field.value || '';
                            const remaining = 50 - textVal.trim().length;
                            return (
                                <FormItem className="text-left">
                                    <FormLabel className="text-[10px] font-semibold text-primary ml-1">Source Material</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder={`Paste ${terms.singular.toLowerCase()} data here...`}
                                            className="min-h-[200px] rounded-xl bg-background/50 border border-border/80 shadow-inner p-6 text-sm leading-relaxed focus-visible:ring-1 focus-visible:ring-primary/20 resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                    {textVal.trim() && remaining > 0 && (
                                        <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-500/5 p-3.5 rounded-xl border border-amber-500/20 mt-2 animate-in fade-in duration-200">
                                            <AlertCircle size={14} className="shrink-0" />
                                            Provide at least {remaining} more characters to enable extraction.
                                        </div>
                                    )}
                                </FormItem>
                            );
                        }}
                    />

                    <div className="flex items-center justify-between pt-6 border-t border-border/50">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onOpenChange(false)}
                          disabled={isGenerating}
                          className="font-semibold text-[10px] h-11 px-6 rounded-xl border border-border/80 hover:bg-muted animate-none"
                        >
                            Discard
                        </Button>
                        <RainbowButton 
                            type="submit" 
                            disabled={isGenerating || !form.formState.isValid} 
                            className="h-11 px-8 gap-2 font-bold text-xs shadow-xl transition-all active:scale-95 text-white rounded-xl"
                        >
                            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary animate-pulse" />}
                            {isGenerating ? 'Architecting...' : `Create ${terms.singular}`}
                        </RainbowButton>
                    </div>
                </form>
            </Form>
        </div>
        <div className="bg-muted/30 p-4 border-t flex items-center gap-3">
            <Info className="h-4 w-4 text-muted-foreground opacity-40 shrink-0" />
            <p className="text-[9px] font-bold text-muted-foreground tracking-[0.1em] text-left">
                The architect will automatically map regional zones and managers based on your current {terms.singular.toLowerCase()} settings.
            </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
