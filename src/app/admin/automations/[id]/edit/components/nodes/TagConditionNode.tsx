'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Tag, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWorkspaceScopedQueries } from '../../../../hooks/useWorkspaceScopedQueries';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';

/**
 * TagConditionNode — visual node for the automation canvas.
 * Evaluates tag-based conditions during flow execution.
 * Requirements: FR4.2.1, FR4.2.2
 */
export function TagConditionNode({ id, data, selected }: any) {
  const logic: string = data.logic || '';
  const tagIds: string[] = data.tagIds || [];
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

  const { allTags } = useWorkspaceScopedQueries();

  const getTagConditionDescription = () => {
    const watchedTags = tagIds.map((tid: string) => {
      const tag = allTags?.find((t: any) => t.id === tid);
      return tag ? tag.name : tid;
    });
    const logicLabel = logic === 'has_tag' ? 'Has tag' : (logic === 'has_all_tags' ? 'Has all tags' : (logic === 'not_has_tag' ? 'Does not have tag' : 'Check tags'));
    const suffix = tagIds.length > 1 ? 's' : '';
    return watchedTags.length > 0 
      ? `${logicLabel}${suffix}: ${watchedTags.join(', ')}` 
      : 'Check contact tags';
  };

  const overlay = useExecutionOverlay(data);

  return (
    <div className={cn('relative transition-all duration-300', selected ? 'scale-[1.02]' : 'scale-100', overlay.opacityClass)}>
      {overlay.badgeIcon && (
        <div className="absolute -top-2.5 -right-2.5 z-50">
          <ExecutionBadge icon={overlay.badgeIcon} status={data.executionStatus} />
        </div>
      )}
      <Handle
        type="target"
        position={Position.Top}
        className="bg-violet-500 border-2 border-white shadow-lg hover:bg-violet-600 transition-colors"
        style={{ width: '12px', height: '12px', top: '-6px' }}
      />

      <Card
        className={cn(
          'w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center',
          selected
            ? 'border-violet-500 shadow-md ring-2 ring-violet-500/20'
            : 'border-violet-200',
          overlay.borderClass,
          overlay.glowClass
        )}
      >
        {/* Left Colored Accent Block */}
        <div className="w-12 h-full bg-violet-500 flex items-center justify-center flex-shrink-0 animate-fade-in text-white">
          <Tag className="h-4 w-4" />
        </div>
        
        {/* Right Content Area */}
        <div className="flex-1 min-w-0 h-full pl-3 pr-2 flex items-center justify-between text-left">
          <div className="flex flex-col justify-center min-w-0 pr-1">
            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
              Tag Split
            </span>
            <p className="text-xs font-semibold text-foreground leading-tight truncate">
              {getTagConditionDescription()}
            </p>
          </div>
          <Badge
            variant="outline"
            className="text-[8px] font-bold px-1.5 py-0.5 rounded border border-violet-100 bg-violet-50 text-violet-700 truncate max-w-[85px] h-5 flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-violet-100/50 transition-colors"
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

      {/* True Path */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className={cn(
          "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
          data.isTrueConnected ? "bg-emerald-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
        )}
        style={{ width: '12px', height: '12px', bottom: '-6px', left: '25%' }}
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

      {/* False Path */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className={cn(
          "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
          data.isFalseConnected ? "bg-rose-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
        )}
        style={{ width: '12px', height: '12px', bottom: '-6px', left: '75%' }}
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
