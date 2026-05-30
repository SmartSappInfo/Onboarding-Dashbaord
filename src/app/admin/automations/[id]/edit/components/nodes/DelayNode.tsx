'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, Hourglass, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';

/**
 * @fileOverview Temporal Delay Node for Automation Canvas.
 * Introduces a wait period into the protocol.
 */
export function DelayNode({ id, data, selected }: any) {
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

    const getWaitLabel = () => {
        const type = config.waitType || 'period';
        if (type === 'period') {
            return `Wait for ${config.value ?? 5} ${config.unit || 'Minutes'}`;
        }
        if (type === 'specific_date') {
            return `Until ${config.specificDate || 'date'} at ${config.specificTime || '09:00'}`;
        }
        if (type === 'date_field') {
            const offset = config.offsetDirection === 'current_date' 
                ? 'On' 
                : `${config.offsetDays ?? 1}d ${config.offsetDirection}`;
            return `Wait until ${offset} of ${config.dateField || 'field'}`;
        }
        if (type === 'conditions_met') {
            const limitStr = config.hasTimeLimit 
                ? ` (max ${config.timeLimitValue ?? 30} ${config.timeLimitUnit || 'Days'})` 
                : '';
            return `Until conditions are met${limitStr}`;
        }
        return 'Awaiting wait time';
    };

    return (
        <div className={cn(
            "relative transition-all duration-300",
            selected ? "scale-[1.02]" : "scale-100"
        )}>
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-purple-500 border-2 border-white shadow-lg transition-colors hover:bg-purple-600" 
                style={{ width: '11px', height: '11px', top: '-5.5px' }}
            />
            
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-purple-500 shadow-md ring-2 ring-purple-500/20" : "border-purple-200"
            )}>
                {/* Left Colored Accent Block */}
                <div className="w-12 h-full bg-purple-500 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <Clock className="h-4 w-4 text-white" />
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
                            Wait Period
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {getWaitLabel()}
                        </p>
                    </div>
                    <Badge 
                        variant="outline" 
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-purple-100 bg-purple-50 text-purple-700 truncate max-w-[85px] h-5 flex-shrink-0 flex items-center justify-center"
                    >
                        {waitingCount} {waitingCount === 1 ? 'Contact' : 'Contacts'}
                    </Badge>
                </div>
            </Card>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className={cn(
                    "border-2 border-white shadow-lg transition-transform hover:scale-110 active:scale-95 flex items-center justify-center cursor-pointer",
                    data.isDefaultConnected ? "bg-purple-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '15px', height: '15px', bottom: '-7.5px' }}
                onClick={(e) => {
                    if (!data.isDefaultConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id);
                    }
                }}
            >
                {!data.isDefaultConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
            </Handle>
        </div>
    );
}
