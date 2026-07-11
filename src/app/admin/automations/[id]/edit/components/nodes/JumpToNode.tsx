'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Milestone, Plus, StickyNote } from 'lucide-react';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';
import { useExecutionOverlay, ExecutionBadge, type ExecutionStatus } from './ExecutionOverlay';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';

interface JumpToNodeConfig {
    groups?: Record<string, unknown>[];
    relation?: 'and' | 'or';
    jumpFromAnywhere?: boolean;
    sequentialBehavior?: 'wait' | 'proceed' | 'exit';
}

interface JumpToNodeData {
    config?: JumpToNodeConfig;
    stepNumber?: number;
    label?: string;
    executionStatus?: ExecutionStatus;
    canMoveUp?: boolean;
    canMoveDown?: boolean;
    hasNote?: boolean;
    note?: string;
    onAddStep?: (id: string) => void;
    onAddAbove?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    onDuplicate?: () => void;
    onDelete?: () => void;
    onToggleNote?: () => void;
    onFilterDiagnostics?: (id: string) => void;
    isDefaultConnected?: boolean;
}

interface JumpToNodeProps {
    id: string;
    data: JumpToNodeData;
    selected: boolean;
}

/**
 * @fileOverview Jump To / Goal Milestone Node for Automation Canvas.
 * Anchors goal conditions and enables contacts to jump to this point from other steps.
 */
export function JumpToNode({ id, data, selected }: JumpToNodeProps) {
    const [isHovered, setIsHovered] = React.useState(false);
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

    const { data: jobs } = useCollection<Record<string, unknown>>(jobsQuery);
    const waitingCount = jobs?.length || 0;

    const overlay = useExecutionOverlay({
        executionStatus: data.executionStatus,
    });

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
                canMoveUp={!!data.canMoveUp}
                canMoveDown={!!data.canMoveDown}
                hasNote={!!data.hasNote}
                onAddAbove={data.onAddAbove || (() => {})}
                onAddBelow={() => data.onAddStep?.(id)}
                onMoveUp={data.onMoveUp || (() => {})}
                onMoveDown={data.onMoveDown || (() => {})}
                onDuplicate={data.onDuplicate || (() => {})}
                onDelete={data.onDelete || (() => {})}
                onToggleNote={data.onToggleNote || (() => {})}
            />
            {overlay.badgeIcon && data.executionStatus && (
                <div className="absolute -top-2.5 -right-2.5 z-50">
                    <ExecutionBadge icon={overlay.badgeIcon} status={data.executionStatus} />
                </div>
            )}
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-fuchsia-500 border-2 border-white shadow-lg transition-colors hover:bg-fuchsia-600" 
                style={{ width: '12px', height: '12px', top: '-6px' }}
            />
            
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-fuchsia-500 shadow-md ring-2 ring-fuchsia-500/20" : "border-fuchsia-200",
                overlay.borderClass,
                overlay.glowClass
            )}>
                {/* Left Colored Accent Block */}
                <div className="w-12 h-full bg-fuchsia-500 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <Milestone className="h-4 w-4 text-white" />
                </div>
                
                {/* Right Content Area */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
                            {data.stepNumber ? `Goal Milestone #${data.stepNumber}` : 'Goal Milestone'}
                        </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            {data.label || 'Jump To Milestone'}
                        </p>
                    </div>
                    <Badge 
                        variant="outline" 
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-fuchsia-100 bg-fuchsia-50 text-fuchsia-700 truncate max-w-[85px] h-5 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-fuchsia-100/50 transition-colors"
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
                    data.isDefaultConnected ? "bg-fuchsia-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
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
            {data.note && (
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md px-1.5 py-0.5 max-w-[200px] cursor-pointer" onClick={() => data.onToggleNote?.()}>
                    <StickyNote className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                    <span className="text-[8px] text-amber-700 dark:text-amber-400 truncate font-medium">{data.note}</span>
                </div>
            )}
        </div>
    );
}
