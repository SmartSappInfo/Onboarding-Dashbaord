'use client';

import * as React from 'react';
import { useUser, useFirestore } from '@/firebase';
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

const AI_PROVIDERS = [
    {
        id: 'googleai',
        name: 'Google Gemini',
        icon: Sparkles,
        color: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        models: [
            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', description: 'Fastest Native Model' },
            { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Extremely Fast & Efficient' },
            { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Complex Reasoning' },
        ]
    },
    {
        id: 'openrouter',
        name: 'OpenRouter (Free Tier)',
        icon: Brain,
        color: 'text-purple-500',
        bgColor: 'bg-purple-500/10',
        models: [
            { id: 'openrouter/free', name: 'Auto Free Model', description: 'Auto-selects best available free model' },
            { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B', description: 'Best Open Source Logic' },
            { id: 'google/gemini-2.0-flash-lite-preview-02-05:free', name: 'Gemini 2.0 Flash Lite', description: 'Google Free Tier' },
            { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B', description: 'Excellent Reasoning' },
            { id: 'nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 120B', description: 'NVIDIA Optimization' },
            { id: 'deepseek/deepseek-r1-distill-llama-70b:free', name: 'DeepSeek R1', description: 'Advanced Distillation' },
        ]
    },
    {
        id: 'openai',
        name: 'OpenAI Direct',
        icon: Zap,
        color: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        models: [
            { id: 'gpt-4o', name: 'GPT-4o', description: 'Smartest Model' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast, Budget-Friendly' },
        ]
    }
];

export default function AiModelSelector({ className }: { className?: string }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedProvider, setSelectedProvider] = React.useState<string>('openrouter');
    const [selectedModel, setSelectedModel] = React.useState<string>('meta-llama/llama-3.3-70b-instruct:free');
    const [isLoading, setIsLoading] = React.useState(true);

    // Initial load of user preferences
    React.useEffect(() => {
        if (user && firestore) {
            const userDoc = doc(firestore, 'users', user.uid);
            getDoc(userDoc).then((docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data() as UserProfile;
                    if (data.preferredAiProvider) setSelectedProvider(data.preferredAiProvider);
                    if (data.preferredAiModel) setSelectedModel(data.preferredAiModel);
                }
                setIsLoading(false);
            });
        }
    }, [user, firestore]);

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

    const currentProvider = AI_PROVIDERS.find(p => p.id === selectedProvider) || AI_PROVIDERS[0];

    return (
        <div className={cn("flex flex-col gap-1.5", className)}>
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                AI Architect Model
            </label>
            <Select value={selectedModel} onValueChange={handleModelChange}>
                <SelectTrigger className="w-[280px] h-12 rounded-[1.25rem] bg-background border-none shadow-xl ring-1 ring-border/50 hover:ring-primary/20 transition-all font-bold group">
                    <div className="flex items-center gap-2.5">
                        <div className={cn("p-1.5 rounded-lg transition-colors shrink-0", currentProvider.bgColor)}>
                            <currentProvider.icon className={cn("h-4 w-4", currentProvider.color)} />
                        </div>
                        <div className="flex flex-col items-start min-w-0">
                            {(() => {
                                const allModels = AI_PROVIDERS.flatMap(p => p.models);
                                const found = allModels.find(m => m.id === selectedModel);
                                return (
                                    <>
                                        <span className="text-sm font-bold text-foreground leading-tight truncate">
                                            {found?.name || 'Select Model'}
                                        </span>
                                        {found?.description && (
                                            <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                                                {found.description}
                                            </span>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </SelectTrigger>
                <SelectContent 
                    className="rounded-[1.5rem] border-none shadow-2xl p-2 bg-background/95 backdrop-blur-xl"
                    style={{ zIndex: 100000 }}
                >
                    {AI_PROVIDERS.map((provider) => (
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
        </div>
    );
}
