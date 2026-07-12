'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Clock, Hourglass, Plus, StickyNote } from 'lucide-react';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * @fileOverview Temporal Delay Node for Automation Canvas.
 * Introduces a wait period into the protocol.
 */
export function DelayNode({ id, data, selected }: any) {
    const [isHovered, setIsHovered] = React.useState(false);
    const config = data.config || {};
    const params = useParams();
    const automationId = params?.id as string;
    const firestore = useFirestore();
    const { activeWorkspaceId } = useWorkspace();

    const jobsQuery = useMemoFirebase(() => {
        if (!firestore || !automationId || !id || !activeWorkspaceId) return null;
        return query(
            collection(firestore, 'automation_jobs'),
            where('automationId', '==', automationId),
            where('targetNodeId', '==', id),
            where('status', '==', 'pending'),
            where('workspaceId', '==', activeWorkspaceId)
        );
    }, [firestore, automationId, id, activeWorkspaceId]);

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

    const overlay = useExecutionOverlay(data);

    return (
        <div className={cn(
            "relative transition-all duration-300",
            selected ? "scale-[1.02]" : "scale-100",
            overlay.opacityClass
        )} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
            <NodeActionToolbar
                nodeId={id}
                isVisible={selected || isHovered}
                isTrigger={false}
                canMoveUp={data.canMoveUp}
                canMoveDown={data.canMoveDown}
                hasNote={data.hasNote}
                onAddAbove={data.onAddAbove}
                onAddBelow={() => data.onAddStep(id)}
                onMoveUp={data.onMoveUp}
                onMoveDown={data.onMoveDown}
                onDuplicate={data.onDuplicate}
                onDelete={data.onDelete}
                onToggleNote={data.onToggleNote}
            />
            {overlay.badgeIcon && (
                <div className="absolute -top-2.5 -right-2.5 z-50">
                    <ExecutionBadge icon={overlay.badgeIcon} status={data.executionStatus} />
                </div>
            )}
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-purple-500 border-2 border-white shadow-lg transition-colors hover:bg-purple-600" 
                style={{ width: '12px', height: '12px', top: '-6px' }}
            />
            
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-purple-500 shadow-md ring-2 ring-purple-500/20" : "border-purple-200",
                overlay.borderClass,
                overlay.glowClass
            )}>
                {/* Left Colored Accent Block */}
                <div className="w-12 h-full bg-purple-500 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <Clock className="h-4 w-4 text-white" />
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
                            {data.stepNumber ? `Wait Period #${data.stepNumber}` : 'Wait Period'}
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {getWaitLabel()}
                        </p>
                    </div>
                    <Badge 
                        variant="outline" 
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-purple-100 bg-purple-50 text-purple-700 truncate max-w-[85px] h-5 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-purple-100/50 transition-colors"
                        onClick={(e) => {
                            if (data.onFilterDiagnostics) {
                                e.stopPropagation();
                                data.onFilterDiagnostics(id);
                            }
                        }}
                    >
                        {waitingCount} {waitingCount === 1 ? 'Contact' : 'Contacts'}
                    </Badge>
                </div>
            </Card>
            
            <Handle 
                type="source" 
                position={Position.Bottom} 
                className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    data.isDefaultConnected ? "bg-purple-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '12px', height: '12px', bottom: '-6px' }}
                onClick={(e) => {
                    if (!data.isDefaultConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id);
                    }
                }}
            >
                {!data.isDefaultConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
            </Handle>
            {(selected || isHovered) && data.note && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1 max-w-[280px] shadow-sm cursor-pointer z-50" onClick={() => data.onToggleNote?.()}>
                    <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 truncate font-semibold">{data.note}</span>
                </div>
            )}
        </div>
    );
}
