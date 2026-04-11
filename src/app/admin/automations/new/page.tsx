'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { saveAutomationAction } from '@/lib/automation-actions';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTerminology } from '@/hooks/use-terminology';

/**
 * @fileOverview Initialization page for new Automations.
 * Automatically binds the new blueprint to the active workspace track.
 */
export default function NewAutomationPage() {
    const router = useRouter();
    const { user } = useUser();
    const { toast } = useToast();
    const { activeWorkspaceId } = useWorkspace();
    const { singular } = useTerminology();

    React.useEffect(() => {
        if (!user || !singular) return;

        const init = async () => {
            const res = await saveAutomationAction(null, {
                name: 'Untitled Workflow',
                trigger: 'SCHOOL_CREATED',
                workspaceIds: [activeWorkspaceId], 
                nodes: [
                    {
                        id: 'trigger',
                        type: 'triggerNode',
                        position: { x: 250, y: 100 },
                        data: { label: `${singular} Created`, trigger: 'SCHOOL_CREATED' }
                    }
                ],
                edges: []
            }, user.uid);

            if (res.success && res.id) {
                router.push(`/admin/automations/${res.id}/edit`);
            } else {
                toast({ variant: 'destructive', title: 'Initialization Failed', description: res.error });
                router.push('/admin/automations');
            }
        };

        init();
    }, [user, router, toast, activeWorkspaceId, singular]);

    return (
        <div className="h-full flex flex-col items-center justify-center gap-4 bg-muted/5">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <div className="text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Architecting Workflow Space...</p>
                <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1">Binding to {singular} track</p>
            </div>
        </div>
    );
}