
'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { Automation } from '@/lib/types';
import { Loader2, ArrowLeft, Save, Play, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import AutomationBuilder from '../../components/AutomationBuilder';
import { saveAutomationAction } from '@/lib/automation-actions';

/**
 * @fileOverview High-fidelity Automation Blueprint Editor.
 * Optimized with memoized state handlers to prevent infinite re-render loops.
 */
export default function EditAutomationPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();
    const automationId = params.id as string;

    const [isSaving, setIsSaving] = React.useState(false);
    const [currentData, setCurrentData] = React.useState<Partial<Automation>>({});

    const docRef = useMemoFirebase(() => 
        firestore ? doc(firestore, 'automations', automationId) : null, 
    [firestore, automationId]);

    const { data: automation, isLoading } = useDoc<Automation>(docRef);

    /**
     * STABILIZED STATE HANDLER: Memoized to prevent infinite update depth error
     * when passed to the visual builder's synchronization engine.
     */
    const handleStateChange = React.useCallback((nodes: any[], edges: any[]) => {
        setCurrentData(prev => {
            // Only update if nodes or edges have actually changed
            if (JSON.stringify(prev.nodes) === JSON.stringify(nodes) && 
                JSON.stringify(prev.edges) === JSON.stringify(edges)) {
                return prev;
            }
            return { ...prev, nodes, edges };
        });
    }, []);

    const handleSave = async () => {
        if (!user) return;
        setIsSaving(true);
        const res = await saveAutomationAction(automationId, currentData, user.uid);
        if (res.success) {
            toast({ title: 'Logic Synchronized', description: 'Automation blueprint updated.' });
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
        }
        setIsSaving(false);
    };

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            </div>
        );
    }

    if (!automation) {
        return (
            <div className="p-20 text-center">
                <p className="text-muted-foreground font-black uppercase tracking-widest">Blueprint not found.</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col overflow-hidden bg-muted/10">
            {/* Executive Canvas Header */}
            <header className="h-16 shrink-0 bg-background border-b px-6 flex items-center justify-between z-30 shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/admin/automations')} className="rounded-xl h-10 w-10">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="min-w-0 text-left">
                        <h1 className="text-sm font-black uppercase tracking-tight truncate pr-4">{automation.name}</h1>
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mt-0.5">Editing Workflow Blueprint</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Button variant="outline" className="rounded-xl font-bold h-10 gap-2 border-primary/20 text-primary">
                        <Play className="h-4 w-4" /> Test Flow
                    </Button>
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl font-black h-10 px-8 shadow-xl shadow-primary/20 gap-2 uppercase tracking-widest text-[10px]">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Commit Logic
                    </Button>
                </div>
            </header>

            {/* Workspace scope warning (Requirement 10.5) */}
            {(!automation.workspaceIds || automation.workspaceIds.length === 0) && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-3 z-20">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs font-bold text-amber-900">
                        <span className="font-black uppercase">Warning:</span> This automation has no workspace constraint and will trigger across all workspaces. Consider adding workspace scope for better isolation.
                    </p>
                </div>
            )}

            <div className="flex-1 relative overflow-hidden">
                <AutomationBuilder 
                    initialNodes={automation.nodes} 
                    initialEdges={automation.edges} 
                    onStateChange={handleStateChange}
                />
            </div>
        </div>
    );
}
