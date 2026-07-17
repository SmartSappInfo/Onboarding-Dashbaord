'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { SplitSquareVertical, Plus, StickyNote } from 'lucide-react';
import { usePendingJobs } from '../../../../components/AutomationPendingJobsContext';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useParams } from 'next/navigation';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';

interface CommonNodeData {
  config?: any;
  stepNumber?: number;
  executionStatus?: string;
  isDefaultConnected?: boolean;
  note?: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  hasNote?: boolean;
  onAddStep?: (id: string, branch?: string | boolean) => void;
  onAddAbove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onToggleNote?: () => void;
  onFilterDiagnostics?: (id: string) => void;
  isFalseConnected?: boolean;
  [key: string]: any;
}

interface ABSplitNodeProps {
  id: string;
  data: CommonNodeData;
  selected?: boolean;
}

export function ABSplitNode({ id, data, selected }: ABSplitNodeProps) {
    const [isHovered, setIsHovered] = React.useState(false);
    const config = data.config || {};
    const params = useParams();
    const { countsBySourceNodeId } = usePendingJobs();
    const waitingCount = countsBySourceNodeId[id] || 0;
    const splitRatio = config.splitRatio ?? 50;

    const overlay = useExecutionOverlay(data);

    return (
        <div className={cn(
            "relative transition-all duration-300 hover:scale-[1.01]",
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
                onAddAbove={data.onAddAbove ?? (() => {})}
                onAddBelow={() => data.onAddStep?.(id)}
                onMoveUp={data.onMoveUp ?? (() => {})}
                onMoveDown={data.onMoveDown ?? (() => {})}
                onDuplicate={data.onDuplicate ?? (() => {})}
                onDelete={data.onDelete ?? (() => {})}
                onToggleNote={data.onToggleNote ?? (() => {})}
            />
            {overlay.badgeIcon ? (
                <div className="absolute -top-2.5 -right-2.5 z-50">
                    <ExecutionBadge icon={overlay.badgeIcon} status={data.executionStatus} />
                </div>
            ) : null}
            <Handle 
                type="target" 
                position={Position.Top} 
                className="bg-violet-500 border-2 border-white shadow-lg transition-colors hover:bg-violet-600" 
                style={{ width: '12px', height: '12px', top: '-6px' }}
            />
            
            <Card className={cn(
                "w-64 h-14 rounded-xl border transition-all duration-300 bg-card/85 backdrop-blur-md overflow-hidden shadow-sm flex flex-row items-center",
                selected ? "border-violet-500 shadow-md ring-2 ring-violet-500/20" : "border-violet-200",
                overlay.borderClass,
                overlay.glowClass
            )}>
                {/* Left Accent Accent */}
                <div className="w-12 h-full bg-gradient-to-b from-violet-500 to-indigo-600 flex items-center justify-center flex-shrink-0 animate-fade-in">
                    <SplitSquareVertical className="h-4 w-4 text-white" />
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
                    <div className="flex flex-col justify-center min-w-0 pr-1">
                        <span className="text-[8px] font-bold text-violet-500 uppercase tracking-wider leading-none mb-1 truncate">
                            {data.stepNumber ? `A/B Split #${data.stepNumber}` : 'A/B Split'}
                          </span>
                        <p className="text-xs font-semibold text-foreground leading-tight truncate">
                            Variant A: {splitRatio}% / Variant B: {100 - splitRatio}%
                          </p>
                    </div>
                    <Badge 
                        variant="outline" 
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-violet-100 bg-violet-50 text-violet-700 truncate max-w-[85px] h-5 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-violet-100/50 transition-colors animate-pulse"
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

            {/* Handle A */}
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="a"
                className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    data.isTrueConnected ? "bg-emerald-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '12px', height: '12px', bottom: '-6px', left: '25%' }}
                onClick={(e) => {
                    if (!data.isTrueConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id, 'a');
                    }
                }}
            >
                {!data.isTrueConnected ? <Plus className="h-2.5 w-2.5 text-white pointer-events-none" /> : null}
            </Handle>
            <span className="absolute text-[9px] font-bold text-emerald-600 select-none animate-fade-in" style={{ bottom: '-20px', left: '25%', transform: 'translateX(-120%)' }}>
                Path A ({splitRatio}%)
              </span>

            {/* Handle B */}
            <Handle 
                type="source" 
                position={Position.Bottom} 
                id="b"
                className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    data.isFalseConnected ? "bg-rose-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                )}
                style={{ width: '12px', height: '12px', bottom: '-6px', left: '75%' }}
                onClick={(e) => {
                    if (!data.isFalseConnected && data.onAddStep) {
                        e.stopPropagation();
                        data.onAddStep(id, 'b');
                    }
                }}
            >
                {!data.isFalseConnected ? <Plus className="h-2.5 w-2.5 text-white pointer-events-none" /> : null}
            </Handle>
            <span className="absolute text-[9px] font-bold text-rose-600 select-none animate-fade-in" style={{ bottom: '-20px', left: '75%', transform: 'translateX(20%)' }}>
                Path B ({100 - splitRatio}%)
              </span>
            {(selected || isHovered) && data.note && (
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-full px-2.5 py-1 max-w-[280px] shadow-sm cursor-pointer z-50" onClick={() => data.onToggleNote?.()}>
                    <StickyNote className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 truncate font-semibold">{data.note}</span>
                </div>
            )}
        </div>
    );
}
