'use client';

import * as React from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { GitMerge, Layers, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PipelineStageSelectorProps {
  pipelineId?: string;
  stageId?: string;
  onPipelineChange: (pipelineId: string) => void;
  onStageChange: (stageId: string) => void;
  className?: string;
  compact?: boolean;
  disabled?: boolean;
}

export function PipelineStageSelector({
  pipelineId,
  stageId,
  onPipelineChange,
  onStageChange,
  className,
  compact = false,
  disabled = false,
}: PipelineStageSelectorProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const onPipelineChangeRef = React.useRef(onPipelineChange);
  onPipelineChangeRef.current = onPipelineChange;

  const onStageChangeRef = React.useRef(onStageChange);
  onStageChangeRef.current = onStageChange;

  // Fetch workspace pipelines
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'pipelines'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: pipelines, isLoading: isPipelinesLoading } = useCollection<{ id: string; name: string }>(pipelinesQuery);

  // Auto-select first pipeline if none selected and pipelines exist
  React.useEffect(() => {
    if (!pipelineId && pipelines && pipelines.length > 0) {
      onPipelineChangeRef.current(pipelines[0].id);
    }
  }, [pipelineId, pipelines]);

  // Fetch stages for active pipeline
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !pipelineId) return null;
    return query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', pipelineId),
      orderBy('order', 'asc')
    );
  }, [firestore, pipelineId]);

  const { data: stages, isLoading: isStagesLoading } = useCollection<{ id: string; name: string; order?: number }>(stagesQuery);

  // Auto-select first stage if none selected and stages exist
  React.useEffect(() => {
    if (pipelineId && (!stageId || stageId === 'none') && stages && stages.length > 0) {
      onStageChangeRef.current(stages[0].id);
    }
  }, [pipelineId, stageId, stages]);

  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-4', className)}>
      {/* Pipeline Select */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-1">
          <GitMerge className="h-3 w-3 text-primary/70" /> Target Pipeline
        </Label>
        <Select
          disabled={disabled || isPipelinesLoading}
          value={pipelineId || 'none'}
          onValueChange={(val) => {
            onPipelineChange(val === 'none' ? '' : val);
            onStageChange(''); // Reset stage on pipeline change
          }}
        >
          <SelectTrigger className={cn('bg-background border-border/50 font-semibold rounded-xl transition-all focus:ring-1 focus:ring-primary/20', compact ? 'h-10 text-xs' : 'min-h-[44px] text-xs')}>
            {isPipelinesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading pipelines...</span>
              </div>
            ) : (
              <SelectValue placeholder="Choose pipeline..." />
            )}
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="none">Choose Pipeline...</SelectItem>
            {(pipelines || []).map((p) => (
              <SelectItem key={p.id} value={p.id} className="font-medium text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stage Select */}
      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 ml-1">
          <Layers className="h-3 w-3 text-primary/70" /> Target Stage
        </Label>
        <Select
          disabled={disabled || !pipelineId || isStagesLoading}
          value={stageId || 'none'}
          onValueChange={(val) => onStageChange(val === 'none' ? '' : val)}
        >
          <SelectTrigger className={cn('bg-background border-border/50 font-semibold rounded-xl transition-all focus:ring-1 focus:ring-primary/20', compact ? 'h-10 text-xs' : 'min-h-[44px] text-xs')}>
            {isStagesLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Loading stages...</span>
              </div>
            ) : (
              <SelectValue placeholder={pipelineId ? 'Choose stage...' : 'Select pipeline first'} />
            )}
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            <SelectItem value="none">Choose Stage...</SelectItem>
            {(stages || []).map((s) => (
              <SelectItem key={s.id} value={s.id} className="font-medium text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
