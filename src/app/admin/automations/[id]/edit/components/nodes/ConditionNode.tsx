'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

/**
 * @fileOverview High-fidelity Condition Node for Automation Canvas.
 * Represents a logical fork in the operational protocol.
 */
export function ConditionNode({ id, data, selected }: any) {
    const config = data.config || {};
    const params = useParams();
    const automationId = params?.id as string;
    const firestore = useFirestore();

    const jobsQuery = useMemoFirebase(() => {
        if (!firestore || !automationId || !id) return null;
        return query(
            collection(firestore, 'automation_jobs'),
            where('automationId', '==', automationId),
            where('targetNodeId', '==', id),
            where('status', '==', 'pending')
        );
    }, [firestore, automationId, id]);

    const { data: jobs } = useCollection<any>(jobsQuery);
    const waitingCount = jobs?.length || 0;

    const groups = config.groups || [];
    
    const getConditionDescription = () => {
        if (groups.length === 0) {
            const legacyConditions = config.conditions || [];
            if (legacyConditions.length === 0) {
                if (config.field && config.operator) {
                    return `If "${config.field}" ${config.operator.replace('_', ' ')} "${config.value ?? ''}"`;
                }
                return 'Awaiting condition rules';
            }
            if (legacyConditions.length === 1) {
                const c = legacyConditions[0];
                return `If "${c.field}" ${c.operator?.replace('_', ' ') || ''} "${c.value ?? ''}"`;
            }
            return `If ${legacyConditions.length} rules match (${(config.relation || 'and').toUpperCase()})`;
        }

        let totalConditions = 0;
        groups.forEach((g: any) => {
            totalConditions += (g.conditions || []).length;
        });

        if (totalConditions === 1) {
            const firstCond = groups[0]?.conditions?.[0] || {};
            return `If "${firstCond.field}" ${firstCond.operator?.replace('_', ' ') || ''} "${firstCond.value ?? ''}"`;
        }

        const relation = (config.relation || 'and').toUpperCase();
        return `If ${totalConditions} rules match (${relation})`;
    };

    return (
        <div className={cn(
            "relative transition-all duration-300",
            selected ? "scale-[1.02]" : "scale-100"
        )}>
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-amber-500 border-2 border-white shadow-lg transition-colors hover:bg-amber-600" 
                style={{ width: '11px', height: '11px', top: '-5.5px' }}
            />
            
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-amber-500 shadow-md ring-2 ring-amber-500/20" : "border-amber-200"
            )}>
                {/* Left Colored Accent Block */}
                <div className="w-12 h-full bg-amber-500 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <ArrowRightLeft className="h-4 w-4 text-white" />
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
                            If / Else Split
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {getConditionDescription()}
                        </p>
                    </div>
                    <Badge 
                        variant="outline" 
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-amber-100 bg-amber-50 text-amber-700 truncate max-w-[85px] h-5 flex-shrink-0 flex items-center justify-center"
                    >
                        {waitingCount} {waitingCount === 1 ? 'Contact' : 'Contacts'}
                    </Badge>
                </div>
            </Card>

            {/* True Path Output */}
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="true"
                className={cn(
                    "border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer",
                    data.isTrueConnected ? "bg-emerald-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '15px', height: '15px', bottom: '-7.5px', left: '25%' }}
                onClick={(e) => {
                    if (!data.isTrueConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id, 'true');
                    }
                }}
            >
                {!data.isTrueConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
            </Handle>
            <span className="absolute text-[9px] font-bold text-emerald-600 select-none animate-fade-in" style={{ bottom: '-20px', left: '25%', transform: 'translateX(-150%)' }}>
                True
            </span>

            {/* False Path Output */}
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="false"
                className={cn(
                    "border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer",
                    data.isFalseConnected ? "bg-rose-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '15px', height: '15px', bottom: '-7.5px', left: '75%' }}
                onClick={(e) => {
                    if (!data.isFalseConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id, 'false');
                    }
                }}
            >
                {!data.isFalseConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
            </Handle>
            <span className="absolute text-[9px] font-bold text-rose-600 select-none animate-fade-in" style={{ bottom: '-20px', left: '75%', transform: 'translateX(50%)' }}>
                False
            </span>
        </div>
    );
}
