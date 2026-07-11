'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { Tag, Plus, StickyNote } from 'lucide-react';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useWorkspaceScopedQueries } from '../../../../hooks/useWorkspaceScopedQueries';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';
import { useWorkspace } from '@/context/WorkspaceContext';

/**
 * TagConditionNode — visual node for the automation canvas.
 * Evaluates tag-based conditions during flow execution.
 * Requirements: FR4.2.1, FR4.2.2
 */
export function TagConditionNode({ id, data, selected }: any) {
  const [isHovered, setIsHovered] = React.useState(false);
  const logic: string = data.logic || '';
  const tagIds: string[] = data.tagIds || [];
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

  const { allTags } = useWorkspaceScopedQueries();

  const getTagConditionDescription = () => {
    if (data.conditions) {
      const conditionCount = data.conditions.length;
      return `${conditionCount} Condition${conditionCount !== 1 ? 's' : ''} + Default`;
    }
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
    <div className={cn('relative transition-all duration-300', selected ? 'scale-[1.02]' : 'scale-100', overlay.opacityClass)} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
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
              {data.stepNumber ? `Tag Split #${data.stepNumber}` : 'Tag Split'}
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

      {data.conditions ? (
        // Multi-condition Switch Mode
        <>
          {data.conditions.map((cond: { id: string; tagId: string }, idx: number) => {
            const tag = allTags?.find((t: any) => t.id === cond.tagId);
            const tagName = tag ? tag.name : (cond.tagId || 'Select tag...');
            const isConnected = data.connectedSourceHandles?.includes(cond.id);
            const total = data.conditions.length + 1;
            const leftPercent = ((idx + 1) * 100) / (total + 1);

            return (
              <React.Fragment key={cond.id}>
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id={cond.id}
                  className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    isConnected ? "bg-emerald-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                  )}
                  style={{ width: '12px', height: '12px', bottom: '-6px', left: `${leftPercent}%` }}
                  onClick={(e) => {
                    if (!isConnected && data.onAddStep) {
                      e.stopPropagation();
                      data.onAddStep(id, cond.id);
                    }
                  }}
                >
                  {!isConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
                </Handle>
                <span 
                  className="absolute text-[8px] font-bold text-violet-600 select-none animate-fade-in truncate max-w-[55px] text-center" 
                  style={{ bottom: '-20px', left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                  title={tagName}
                >
                  {tagName}
                </span>
              </React.Fragment>
            );
          })}
          {(() => {
            const total = data.conditions.length + 1;
            const leftPercent = (total * 100) / (total + 1);
            const isConnected = data.connectedSourceHandles?.includes('none');

            return (
              <React.Fragment key="none">
                <Handle
                  type="source"
                  position={Position.Bottom}
                  id="none"
                  className={cn(
                    "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
                    isConnected ? "bg-rose-500" : "bg-blue-500 animate-pulse hover:bg-blue-600"
                  )}
                  style={{ width: '12px', height: '12px', bottom: '-6px', left: `${leftPercent}%` }}
                  onClick={(e) => {
                    if (!isConnected && data.onAddStep) {
                      e.stopPropagation();
                      data.onAddStep(id, 'none');
                    }
                  }}
                >
                  {!isConnected && <Plus className="h-2.5 w-2.5 text-white pointer-events-none" />}
                </Handle>
                <span 
                  className="absolute text-[8px] font-bold text-rose-600 select-none animate-fade-in text-center" 
                  style={{ bottom: '-20px', left: `${leftPercent}%`, transform: 'translateX(-50%)' }}
                >
                  None
                </span>
              </React.Fragment>
            );
          })()}
        </>
      ) : (
        // Legacy binary True/False Mode
        <>
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
        </>
      )}
      {data.note && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-md px-1.5 py-0.5 max-w-[200px] cursor-pointer" onClick={() => data.onToggleNote?.()}>
              <StickyNote className="h-2.5 w-2.5 text-amber-500 shrink-0" />
              <span className="text-[8px] text-amber-700 dark:text-amber-400 truncate font-medium">{data.note}</span>
          </div>
      )}
    </div>
  );
}
