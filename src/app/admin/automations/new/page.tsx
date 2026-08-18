'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { saveAutomationAction } from '@/lib/automation-actions';
import { Loader2 } from 'lucide-react';

/**
 * ARCHITECTURAL POINTER (New Automation Initialization Boundary):
 * Instantly creates a draft blueprint in Firestore and routes to the editor.
 * If triggered from a pipeline stage ("Add automation to this stage"), parses URL search params
 * (`pipelineId`, `stageId`, `pipelineName`, `stageName`) and auto-configures the blueprint with:
 * - Label: {{pipeline_name}} - {{stage_name}}
 * - Trigger Type: DEAL_STAGE_CHANGED
 * - Trigger Config: { pipelineId, stageId }
 *
 * CAUTION FOR MAINTAINERS:
 * Always wrap URL parameters in decodeURIComponent to prevent malformed text.
 */
function NewAutomationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useUser();
    const { activeWorkspaceId } = useWorkspace();
    const [error, setError] = React.useState<string | null>(null);

    const creationStarted = React.useRef(false);
    const isMounted = React.useRef(true);

    const pipelineId = searchParams.get('pipelineId');
    const stageId = searchParams.get('stageId');
    const rawPipelineName = searchParams.get('pipelineName');
    const rawStageName = searchParams.get('stageName');

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
                const pipelineName = rawPipelineName ? decodeURIComponent(rawPipelineName) : '';
                const stageName = rawStageName ? decodeURIComponent(rawStageName) : '';

                const defaultName = (pipelineName && stageName)
                    ? `${pipelineName} - ${stageName}`
                    : 'Untitled Workflow';

                const hasStageTrigger = Boolean(pipelineId && stageId);

                const defaultNewAutomation = {
                    name: defaultName,
                    description: hasStageTrigger ? `Automation triggered when a deal enters "${stageName}" in "${pipelineName}".` : '',
                    isActive: false,
                    triggers: hasStageTrigger ? [
                        {
                            id: 'trig_1',
                            type: 'DEAL_STAGE_CHANGED' as const,
                            config: { pipelineId, stageId },
                            label: 'Deal Stage Changed'
                        }
                    ] : [],
                    triggerTypes: hasStageTrigger ? ['DEAL_STAGE_CHANGED'] : [],
                    workspaceIds: [activeWorkspaceId],
                    nodes: [
                        {
                            id: 'trigger',
                            type: 'triggerNode',
                            position: { x: 250, y: 100 },
                            data: {
                                label: hasStageTrigger ? 'Stage Entered Trigger' : 'Event Trigger',
                                ...(hasStageTrigger ? {
                                    triggerType: 'DEAL_STAGE_CHANGED',
                                    config: { pipelineId, stageId }
                                } : {})
                            }
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
            } catch (err: unknown) {
                if (isMounted.current) {
                    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
                    setError(message);
                }
            }
        }

        createDraft();
    }, [user, activeWorkspaceId, router, pipelineId, stageId, rawPipelineName, rawStageName]);

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

export default function NewAutomationPage() {
    return (
        <React.Suspense fallback={
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500 opacity-80" />
                <span className="text-xs text-muted-foreground font-semibold">Loading automation workspace...</span>
            </div>
        }>
            <NewAutomationContent />
        </React.Suspense>
    );
}