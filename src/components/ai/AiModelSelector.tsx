'use client';

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { doc, getDoc } from 'firebase/firestore';
import { 
    Select, 
    SelectContent, 
    SelectGroup, 
    SelectItem, 
    SelectLabel, 
    SelectTrigger, 
    SelectValue 
} from '@/components/ui/select';
import { Sparkles, Brain, Zap, Shield, Cpu, ExternalLink } from 'lucide-react';
import { updateUserAiPreferencesAction } from '@/lib/user-preferences-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/lib/types';

export const AI_PROVIDERS = [
    {
        id: 'anthropic',
        name: 'Anthropic Claude',
        icon: Zap,
        color: 'text-orange-500',
        bgColor: 'bg-orange-500/10',
        models: [
            { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Most intelligent & capable Claude model' },
            { id: 'claude-3-5-haiku', name: 'Claude 3.5 Haiku', description: 'Fastest Claude model for low-latency tasks' },
        ]
    },
    {
        id: 'googleai',
        name: 'Google Gemini',
        icon: Sparkles,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        models: [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Frontier performance for high-volume tasks' },
            { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', description: 'High-frequency, simple tasks' },
            { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Advanced reasoning & multimodal' },
            { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Balanced performance & low-latency' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Legacy balanced multimodal model' },
        ]
    },
    {
        id: 'openrouter',
        name: 'OpenRouter (Free Tier)',
        icon: Brain,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        models: [
            { id: 'openrouter/owl-alpha', name: 'Owl Alpha', description: '284B token model optimized for agentic workloads' },
            { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B', description: 'Strong vision & tool-use (262K context)' },
            { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super', description: '120B parameter model from NVIDIA' },
            { id: 'qwen/qwen3-coder:free', name: 'Qwen 3 Coder', description: 'Optimized coding model from Qwen' },
            { id: 'poolside/poolside-laguna-m1:free', name: 'Poolside Laguna M1', description: '185B parameter specialized coding agent' },
            { id: 'mistral/devstral-2-2512:free', name: 'Devstral 2', description: 'Versatile math & coding model' },
            { id: 'xiaomi/mimo-v2-flash:free', name: 'Mimo V2 Flash', description: '309B parameter reasoning & coding model' },
            { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout', description: 'Efficient MoE designed for long-context' },
        ]
    }
];

export default function AiModelSelector({ className, hideLabel = false }: { className?: string; hideLabel?: boolean }) {
    const { user } = useUser();
    const { activeOrganization } = useTenant();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedProvider, setSelectedProvider] = React.useState<string>('anthropic');
    const [selectedModel, setSelectedModel] = React.useState<string>('claude-3-5-sonnet');
    const [isLoading, setIsLoading] = React.useState(true);

    const availableProviders = React.useMemo(() => {
        if (!activeOrganization) return [];

        const mode = activeOrganization.aiKeyMode || 'platform';
        // If organization uses platform defaults (fallback DB/env keys), hide selector
        if (mode === 'platform') return [];

        // Return only providers that have organization-configured API keys
        return AI_PROVIDERS.filter(provider => {
            if (provider.id === 'googleai') return !!activeOrganization.geminiApiKey;
            if (provider.id === 'anthropic') return !!activeOrganization.claudeApiKey;
            if (provider.id === 'openrouter') return !!activeOrganization.openRouterApiKey;
            return false;
        });
    }, [activeOrganization]);

    // Initial load of user preferences
    React.useEffect(() => {
        if (user && firestore) {
            const userDoc = doc(firestore, 'users', user.uid);
            getDoc(userDoc).then((docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as UserProfile;
                    
                    let provider = data.preferredAiProvider;
                    let model = data.preferredAiModel;

                    // Automatically migrate legacy 'openai' to 'anthropic'
                    if (provider === 'openai') {
                        provider = 'anthropic';
                        model = 'claude-3-5-sonnet';
                    }
                    
                    // Only apply if the preferred model is still available under the active organization's rules
                    const isAvailable = availableProviders.some(p => p.id === provider);
                    if (isAvailable && provider && model) {
                        setSelectedProvider(provider);
                        setSelectedModel(model);
                    } else if (availableProviders.length > 0) {
                        // Fallback to first available provider
                        setSelectedProvider(availableProviders[0].id);
                        setSelectedModel(availableProviders[0].models[0].id);
                    }
                }
                setIsLoading(false);
            });
        } else {
            setIsLoading(false);
        }
    }, [user, firestore, availableProviders]);

    const handleModelChange = async (value: string) => {
        if (!user) return;
        
        // Find provider for this model
        const provider = AI_PROVIDERS.find(p => p.models.some(m => m.id === value));
        if (!provider) return;

        setSelectedProvider(provider.id);
        setSelectedModel(value);

        const result = await updateUserAiPreferencesAction(user.uid, {
            preferredAiProvider: provider.id,
            preferredAiModel: value
        });

        if (result.success) {
            toast({
                title: 'AI Model Updated',
                description: `Successfully switched to ${value}`,
            });
        } else {
            toast({
                variant: 'destructive',
                title: 'Update Failed',
                description: result.error,
            });
        }
    };

    if (isLoading) {
        return <div className="h-10 w-[240px] bg-muted animate-pulse rounded-xl" />;
    }

    // Return the clean read-only badge indicating system default if no custom keys are configured
    if (availableProviders.length === 0) {
        return (
            <div className={cn("flex flex-col gap-1.5", className)}>
                {!hideLabel && (
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                        AI Architect Model
                    </label>
                )}
                <div className="flex items-center gap-2.5 p-3 bg-orange-500/5 border border-orange-500/10 text-orange-600 rounded-[1.25rem] text-sm font-bold w-[280px]">
                    <Zap className="w-4 h-4 shrink-0 text-orange-500" />
                    <span>System Default: Claude 3.5 Sonnet</span>
                </div>
            </div>
        );
    }

    const currentProvider = availableProviders.find(p => p.id === selectedProvider) || availableProviders[0];

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            {!hideLabel && (
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                    AI Architect Model
                </label>
            )}
            <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-[280px] h-12 rounded-[1.25rem] bg-background border-none shadow-xl ring-1 ring-border/50 hover:ring-primary/20 transition-all font-bold group">
                    <div className="flex items-center gap-2.5">
                        <div className={cn("p-1.5 rounded-lg transition-colors shrink-0", currentProvider.bgColor)}>
                            <currentProvider.icon className={cn("h-4 w-4", currentProvider.color)} />
                        </div>
                        <div className="flex items-center min-w-0">
                            {(() => {
                                const allModels = availableProviders.flatMap(p => p.models);
                                const found = allModels.find(m => m.id === selectedModel);
                                return (
                                    <span className="text-sm font-bold text-foreground truncate">
                                        {found?.name || 'Select Model'}
                                    </span>
                                );
                            })()}
                        </div>
                    </div>
                </SelectTrigger>
                <SelectContent 
                    className="rounded-[1.5rem] border-none shadow-2xl p-2 bg-background/95 backdrop-blur-xl"
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
                                    className="rounded-xl py-2 px-3 focus:bg-primary/5 cursor-pointer"
                                >
                                    <span className="font-bold text-sm tracking-tight">{model.name}</span>
                                </SelectItem>
                            ))}
                        </SelectGroup>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
