'use client';

import * as React from 'react';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Deal } from '@/lib/types';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Workflow, TrendingUp } from 'lucide-react';

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

    if (isDealsLoading) {
        return (
            <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/5 rounded-xl"><Workflow className="h-4 w-4 text-primary/70" /></div>
                    <div className="space-y-0.5 text-left">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Stage</p>
                        <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    </div>
                </div>
            </div>
        );
    }

    const openDeals = deals ?? [];
    const hasDeals = openDeals.length > 0;

    // For single deal: show its stage name. For multiple: show count + unique stage names.
    let displayValue = 'No Open Deals';
    let subValue = '';

    if (hasDeals) {
        if (openDeals.length === 1) {
            const deal = openDeals[0];
            displayValue = deal.stageName || 'In Progress';
            subValue = deal.name;
        } else {
            displayValue = `${openDeals.length} Open Deals`;
            const stageNames = Array.from(
                new Set(openDeals.map(d => d.stageName).filter(Boolean))
            );
            subValue = stageNames.length > 0 ? stageNames.join(', ') : 'Multiple Stages';
        }
    }

    return (
        <div className="flex items-center justify-between py-2 group">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl group-hover:bg-primary/10 transition-colors ${hasDeals ? 'bg-primary/5' : 'bg-muted'}`}>
                    {hasDeals
                        ? <TrendingUp className="h-4 w-4 text-primary/70" />
                        : <Workflow className="h-4 w-4 text-muted-foreground/40" />
                    }
                </div>
                <div className="space-y-0.5 text-left">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Active Stage</p>
                    <div className="flex flex-col">
                        <span className={`text-sm font-bold ${hasDeals ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {displayValue}
                        </span>
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
