'use client';

import * as React from 'react';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    ArrowRightLeft, 
    Zap, 
    Building, 
    Check, 
    Loader2, 
    ShieldCheck,
    Info,
    Workflow,
    ArrowRight
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { School, Pipeline } from '@/lib/types';
import { convertToOnboardingAction } from '@/lib/school-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ConvertLeadModalProps {
    school: School;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * @fileOverview Lead Conversion Console.
 * Orchestrates the transition of a Prospect to the Onboarding track.
 */
export default function ConvertLeadModal({ school, open, onOpenChange }: ConvertLeadModalProps) {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    
    const [targetPipelineId, setTargetPipelineId] = React.useState<string | null>(null);
    const [isConverting, setIsConverting] = React.useState(false);

    // Fetch only Onboarding Pipelines using shared array logic
    const pipelinesQuery = useMemoFirebase(() => 
        firestore ? query(
            collection(firestore, 'pipelines'), 
            where('workspaceIds', 'array-contains', 'onboarding'),
            orderBy('name', 'asc')
        ) : null, 
    [firestore]);

    const { data: pipelines, isLoading } = useCollection<Pipeline>(pipelinesQuery);

    const handleConvert = async () => {
        if (!targetPipelineId || !user || isConverting) return;
        
        setIsConverting(true);
        const res = await convertToOnboardingAction(school.id, targetPipelineId, user.uid);
        
        if (res.success) {
            toast({ 
                title: 'Institutional Conversion Successful', 
                description: `"${school.name}" is now in the Onboarding track.` 
            });
            onOpenChange(false);
        } else {
            toast({ variant: 'destructive', title: 'Conversion Failed', description: res.error });
        }
        setIsConverting(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-8 bg-emerald-50 border-b border-emerald-100 shrink-0 text-left">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-200">
                            <Zap className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                            <DialogTitle className="text-xl font-black uppercase tracking-tight text-emerald-950">Lead Conversion</DialogTitle>
                            <DialogDescription className="text-xs font-bold uppercase tracking-widest text-emerald-700 opacity-70">Elevate {school.name} to Onboarding</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="p-8 space-y-8 bg-background text-left">
                    <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border shadow-inner">
                        <div className="p-2 bg-white rounded-xl shadow-sm shrink-0 text-primary">
                            <Building className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Target Institution</p>
                            <p className="text-base font-black uppercase text-foreground truncate">{school.name}</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                            <Workflow className="h-3 w-3" /> Select Integration Pipeline
                        </Label>
                        
                        <div className="space-y-2">
                            {isLoading ? (
                                <Skeleton className="h-12 w-full rounded-xl" />
                            ) : pipelines?.map(p => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setTargetPipelineId(p.id)}
                                    className={cn(
                                        "w-full flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left",
                                        targetPipelineId === p.id ? "bg-primary/5 border-primary shadow-md" : "bg-muted/10 border-transparent hover:bg-muted/30"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full mb-1">
                                        <span className={cn("font-black uppercase text-xs", targetPipelineId === p.id ? "text-primary" : "text-foreground")}>{p.name}</span>
                                        {targetPipelineId === p.id && <Check className="h-4 w-4 text-primary animate-in zoom-in" />}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground font-medium line-clamp-1">{p.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-blue-50 border border-blue-100 flex items-start gap-4 shadow-inner">
                        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <p className="text-xs font-black text-blue-900 uppercase">Track Synchronisation</p>
                            <p className="text-[9px] font-bold text-blue-800/60 leading-relaxed uppercase tracking-tighter">
                                This action permanently transitions the school. Implementation tasks and training protocols will be initialized upon completion.
                            </p>
                        </div>
                    </div>
                </div>

                <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isConverting} className="rounded-xl font-bold h-12 px-8">Discard</Button>
                    <Button 
                        onClick={handleConvert} 
                        disabled={isConverting || !targetPipelineId}
                        className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white gap-3 uppercase tracking-widest text-xs transition-all active:scale-95"
                    >
                        {isConverting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                        Execute Conversion
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
