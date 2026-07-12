'use client';

import * as React from 'react';
import { Handle, Position } from 'reactflow';
import { TagIcon, PlusCircle, MinusCircle, Plus, StickyNote } from 'lucide-react';
import { NodeActionToolbar } from './NodeActionToolbar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useWorkspaceScopedQueries } from '../../../../hooks/useWorkspaceScopedQueries';
import { useExecutionOverlay, ExecutionBadge } from './ExecutionOverlay';

/**
 * TagActionNode — visual node for the automation canvas.
 * Applies or removes tags from a contact during flow execution.
 * Requirements: FR4.3.1, FR4.3.2
 */
export function TagActionNode({ id, data, selected }: any) {
  const [isHovered, setIsHovered] = React.useState(false);
  const action: 'add_tags' | 'remove_tags' = data.action || 'add_tags';
  const tagIds: string[] = data.tagIds || [];

  const { allTags } = useWorkspaceScopedQueries();

  const isAdd = action === 'add_tags';
  const colorScheme = isAdd
    ? {
        border: selected ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-emerald-200',
        header: 'bg-emerald-500',
        handle: 'bg-emerald-500',
      }
    : {
        border: selected ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-rose-200',
        header: 'bg-rose-500',
        handle: 'bg-rose-500',
      };

  const ActionIcon = isAdd ? PlusCircle : MinusCircle;

  const getTagActionDescription = () => {
    const watchedTags = tagIds.map((tid: string) => {
      const tag = allTags?.find((t: any) => t.id === tid);
      return tag ? tag.name : tid;
    });
    const actionPrefix = isAdd ? 'Add tag' : 'Remove tag';
    const suffix = tagIds.length > 1 ? 's' : '';
    return watchedTags.length > 0 
      ? `${actionPrefix}${suffix}: ${watchedTags.join(', ')}` 
      : `${isAdd ? 'Apply' : 'Remove'} tags to contact`;
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
        className={cn('border-2 border-white shadow-lg transition-colors hover:brightness-95', colorScheme.handle)}
        style={{ width: '12px', height: '12px', top: '-6px' }}
      />

      <Card
        className={cn(
          'w-64 h-14 rounded-xl border transition-all duration-300 bg-card overflow-hidden shadow-sm flex flex-row items-center',
          colorScheme.border,
          overlay.borderClass,
          overlay.glowClass
        )}
      >
        {/* Left Colored Accent Block */}
        <div className={cn('w-12 h-full flex items-center justify-center flex-shrink-0 animate-fade-in text-white', colorScheme.header)}>
          <ActionIcon className="h-4 w-4" />
        </div>
        
        {/* Right Content Area */}
        <div className="flex-1 min-w-0 h-full pl-3 pr-4 flex items-center justify-between text-left">
          <div className="flex flex-col justify-center min-w-0 pr-1">
            <span className="text-[8px] font-bold text-muted-foreground/60 uppercase tracking-wider leading-none mb-1 truncate">
              {data.stepNumber ? `Tag Action #${data.stepNumber}` : 'Tag Action'}
            </span>
            <p className="text-xs font-semibold text-foreground leading-tight truncate">
              {getTagActionDescription()}
            </p>
          </div>
        </div>
      </Card>

      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(
          "border-2 border-white shadow-lg transition-colors flex items-center justify-center cursor-pointer",
          colorScheme.handle,
          !data.isDefaultConnected && "bg-blue-500 animate-pulse hover:bg-blue-600"
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
