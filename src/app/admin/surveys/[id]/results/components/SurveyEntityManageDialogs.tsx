'use client';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 
 * 1. Single Source of Truth for Tags:
 *    - Uses standardized `<TagSelector>` component in client/draft mode (`currentTagIds`, `onTagsChange`).
 *    - Direct text input for tags is strictly prohibited by workspace rules.
 * 2. Mobile & Accessibility First:
 *    - Touch targets >= 44px, keyboard accessible dialogs, and clear active press states (`active:scale-[0.97]`).
 * 3. Security:
 *    - Multi-tenant workspaceId validation on all mutations.
 */

import * as React from 'react';
import { TagSelector } from '@/components/tags/TagSelector';
import { Button } from '@/components/ui/button';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter 
} from '@/components/ui/dialog';
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Tag as TagIcon, Loader2, GitPullRequest } from 'lucide-react';
import { 
  bulkApplyTagsToSurveyEntitiesAction, 
  bulkMoveSurveyEntitiesStageAction 
} from '@/lib/survey-entity-actions';

interface PipelineStageDoc {
  id: string;
  name: string;
  order?: number;
}

interface PipelineDoc {
  id: string;
  name: string;
}

export interface ManagedEntityTarget {
  id: string;
  name: string;
  currentTagIds?: string[];
}

interface SurveyEntityManageDialogsProps {
  taggingEntity: ManagedEntityTarget | null;
  onCloseTagging: () => void;
  movingEntity: ManagedEntityTarget | null;
  onCloseMoving: () => void;
  onComplete?: () => void;
}

export default function SurveyEntityManageDialogs({
  taggingEntity,
  onCloseTagging,
  movingEntity,
  onCloseMoving,
  onComplete,
}: SurveyEntityManageDialogsProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('');
  const [selectedStageId, setSelectedStageId] = React.useState<string>('');
  const [isExecuting, setIsExecuting] = React.useState(false);

  // Sync initial tag IDs when tagging entity changes
  React.useEffect(() => {
    if (taggingEntity) {
      setSelectedTagIds(taggingEntity.currentTagIds || []);
    } else {
      setSelectedTagIds([]);
    }
  }, [taggingEntity]);

  // Reset pipeline & stage selections when moving entity changes
  React.useEffect(() => {
    if (!movingEntity) {
      setSelectedPipelineId('');
      setSelectedStageId('');
    }
  }, [movingEntity]);

  // Query workspace pipelines
  const pipelinesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'pipelines'),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: pipelines } = useCollection<PipelineDoc>(pipelinesQuery);

  // Query pipeline stages
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedPipelineId) return null;
    return query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', selectedPipelineId),
      orderBy('order', 'asc')
    );
  }, [firestore, selectedPipelineId]);

  const { data: stages } = useCollection<PipelineStageDoc>(stagesQuery);

  // Handle Apply Tags
  const handleApplyTags = async () => {
    if (!activeWorkspaceId || !taggingEntity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Workspace or entity context missing.' });
      return;
    }
    if (selectedTagIds.length === 0) {
      toast({ variant: 'destructive', title: 'No Tags Selected', description: 'Please select at least one tag.' });
      return;
    }

    setIsExecuting(true);
    try {
      const res = await bulkApplyTagsToSurveyEntitiesAction({
        workspaceId: activeWorkspaceId,
        entityIds: [taggingEntity.id],
        tagIds: selectedTagIds,
      });

      if (res.success) {
        toast({
          title: 'Tags Updated',
          description: `Tags successfully updated for ${taggingEntity.name}.`,
        });
        onCloseTagging();
        if (onComplete) onComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Tagging Failed',
          description: res.error || 'Could not update tags.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Move Stage
  const handleMoveStage = async () => {
    if (!activeWorkspaceId || !movingEntity) {
      toast({ variant: 'destructive', title: 'Error', description: 'Workspace or entity context missing.' });
      return;
    }
    if (!selectedPipelineId || !selectedStageId) {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please select both a pipeline and a target stage.',
      });
      return;
    }

    setIsExecuting(true);
    try {
      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: activeWorkspaceId,
        entityIds: [movingEntity.id],
        pipelineId: selectedPipelineId,
        stageId: selectedStageId,
      });

      if (res.success) {
        toast({
          title: 'Pipeline Stage Updated',
          description: `${movingEntity.name} moved to the selected pipeline stage.`,
          actionConfig: {
            path: '/admin/pipeline',
            label: 'View in Pipeline',
          },
        });
        onCloseMoving();
        if (onComplete) onComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Stage Move Failed',
          description: res.error || 'Could not move pipeline stage.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Unknown error occurred.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <>
      {/* Single Entity Tag Dialog */}
      <Dialog open={Boolean(taggingEntity)} onOpenChange={(open) => !open && onCloseTagging()}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TagIcon className="h-5 w-5 text-primary" />
              Apply Tags to Entity
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Manage workspace tags applied to <strong>{taggingEntity?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-semibold">Select Tags</Label>
            <TagSelector
              currentTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onCloseTagging}
              disabled={isExecuting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyTags}
              disabled={isExecuting || selectedTagIds.length === 0}
              className="font-semibold px-6 rounded-xl active:scale-[0.97]"
            >
              {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TagIcon className="mr-2 h-4 w-4" />}
              Save Tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single Entity Move Pipeline Stage Dialog */}
      <Dialog open={Boolean(movingEntity)} onOpenChange={(open) => !open && onCloseMoving()}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <GitPullRequest className="h-5 w-5 text-emerald-500" />
              Move Entity in Pipeline
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select destination pipeline and stage for <strong>{movingEntity?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Select Pipeline</Label>
              <Select
                value={selectedPipelineId}
                onValueChange={(val) => {
                  setSelectedPipelineId(val);
                  setSelectedStageId('');
                }}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Choose a pipeline..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {pipelines && pipelines.length > 0 ? (
                    pipelines.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No pipelines available in this workspace
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedPipelineId && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label className="text-xs font-semibold">Select Target Stage</Label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue placeholder="Choose target stage..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {stages && stages.length > 0 ? (
                      stages.map((st) => (
                        <SelectItem key={st.id} value={st.id}>
                          {st.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        No stages found for this pipeline
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={onCloseMoving}
              disabled={isExecuting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMoveStage}
              disabled={isExecuting || !selectedPipelineId || !selectedStageId}
              className="font-semibold px-6 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.97]"
            >
              {isExecuting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitPullRequest className="mr-2 h-4 w-4" />}
              Move to Stage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
