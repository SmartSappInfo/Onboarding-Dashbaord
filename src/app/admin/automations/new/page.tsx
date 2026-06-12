'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { saveAutomationAction } from '@/lib/automation-actions';
import { Loader2 } from 'lucide-react';

/**
 * @fileOverview Initialization page for new Automations.
 * Instantly creates a draft blueprint in Firestore and routes to the editor.
 */
export default function NewAutomationPage() {
    const router = useRouter();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    const [error, setError] = React.useState<string | null>(null);

    const creationStarted = React.useRef(false);
    const isMounted = React.useRef(true);

    React.useEffect(() => {
        isMounted.current = true;
        return () => {
            isMounted.current = false;
        };
    }, []);

    React.useEffect(() => {
        if (!user?.uid || !activeWorkspaceId) return;
        if (creationStarted.current) return;
        creationStarted.current = true;

        const userId = user.uid;

        async function createDraft() {
            try {
                const defaultNewAutomation = {
                    name: 'Untitled Workflow',
                    description: '',
                    isActive: false,
                    triggers: [],
                    triggerTypes: [],
                    workspaceIds: [activeWorkspaceId],
                    nodes: [
                        {
                            id: 'trigger',
                            type: 'triggerNode',
                            position: { x: 250, y: 100 },
                            data: { label: 'Event Trigger' }
                        }
                    ],
                    edges: [],
                };

                const res = await saveAutomationAction(null, defaultNewAutomation, userId);
                if (isMounted.current) {
                    if (res.success && res.id) {
                        router.replace(`/admin/automations/${res.id}/edit`);
                    } else {
                        setError(res.error || 'Failed to create automation blueprint.');
                    }
                }
            } catch (err: any) {
                if (isMounted.current) {
                    setError(err.message || 'An unexpected error occurred.');
                }
            }
        }

        createDraft();
    }, [user, activeWorkspaceId, router]);

    if (error) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-2 text-destructive p-4">
                <span className="font-bold">Error Initializing Blueprint</span>
                <span className="text-xs text-muted-foreground">{error}</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500 opacity-80" />
            <span className="text-xs text-muted-foreground font-semibold">Initializing new workflow blueprint...</span>
        </div>
    );
}