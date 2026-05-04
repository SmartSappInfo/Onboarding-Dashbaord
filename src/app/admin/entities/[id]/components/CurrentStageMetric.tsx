'use client';

import * as React from 'react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Deal, OnboardingStage } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Workflow } from 'lucide-react';

interface CurrentStageMetricProps {
    entityId: string;
}

export function CurrentStageMetric({ entityId }: CurrentStageMetricProps) {
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();

    const dealsQuery = useMemoFirebase(() => {
        if (!firestore || !activeWorkspaceId || !entityId) return null;
        return query(
            collection(firestore, 'deals'),
            where('workspaceId', '==', activeWorkspaceId),
            where('entityId', '==', entityId),
            where('status', '==', 'open')
        );
    }, [firestore, activeWorkspaceId, entityId]);

    const { data: deals, isLoading: isDealsLoading } = useCollection<Deal>(dealsQuery);

    const stagesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'onboardingStages'));
    }, [firestore]);

    const { data: stages } = useCollection<OnboardingStage>(stagesQuery);

    if (isDealsLoading) {
        return (
            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/5 rounded-xl"><Workflow className="h-4 w-4 text-primary/70" /></div>
                    <div className="space-y-0.5 text-left">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Current Stage</p>
                        <div className="h-4 w-24 bg-muted animate-pulse rounded"></div>
                    </div>
                </div>
            </div>
        );
    }

    let displayValue = 'Not in Pipeline';
    let subValue = '';

    if (deals && deals.length > 0 && stages) {
        if (deals.length === 1) {
            const deal = deals[0];
            const stage = stages.find(s => s.id === deal.stageId);
            displayValue = stage ? stage.name : 'Unknown Stage';
            subValue = deal.name;
        } else {
            displayValue = `${deals.length} Active Deals`;
            const stageNames = deals.map(d => {
                const s = stages.find(st => st.id === d.stageId);
                return s ? s.name : 'Unknown';
            });
            // Unique stage names
            subValue = Array.from(new Set(stageNames)).join(', ');
        }
    }

    return (
        <div className="flex items-center justify-between py-2 group">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/5 rounded-xl group-hover:bg-primary/10 transition-colors">
                    <Workflow className="h-4 w-4 text-primary/70" />
                </div>
                <div className="space-y-0.5 text-left">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Current Stage</p>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold text-foreground">{displayValue}</span>
                        {subValue && (
                            <span className="text-[9px] font-semibold text-muted-foreground/80 truncate max-w-[200px]" title={subValue}>
                                {subValue}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
