'use client';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS (Rule 10):
 * 
 * 1. Single Source of Truth for Tags:
 *    - Uses standardized `<TagSelector>` component in client/draft mode (`currentTagIds`, `onTagsChange`).
 *    - Direct text inputs for tags are strictly prohibited.
 * 2. Mobile & Accessibility:
 *    - Floating bottom dock with `min-h-[44px]` touch targets, responsive horizontal wrapping, and `active:scale-[0.97]`.
 * 3. Conditional Visibility:
 *    - If identified entities exist among selected rows (`identifiedEntityIds.length > 0`), renders Apply Tags & Move Stage.
 *    - If all selected rows are anonymous, suppresses entity actions and renders simpler actions (Delete, Clear).
 * 4. Multi-Tenant Security:
 *    - Validates `activeWorkspaceId` and scopes mutations through `bulkApplyTagsToSurveyEntitiesAction` and `bulkMoveSurveyEntitiesStageAction`.
 */

import * as React from 'react';
import { TagSelector } from '@/components/tags/TagSelector';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { 
  Tag as TagIcon, X, Loader2, GitPullRequest, Trash2, Building2 
} from 'lucide-react';
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

interface SurveyAnalyticsBulkActionsBarProps {
  selectedResponseIds: string[];
  identifiedEntityIds: string[];
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onActionComplete: () => void;
}

export default function SurveyAnalyticsBulkActionsBar({
  selectedResponseIds,
  identifiedEntityIds,
  onClearSelection,
  onDeleteSelected,
  onActionComplete,
}: SurveyAnalyticsBulkActionsBarProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const [isTagDialogOpen, setIsTagDialogOpen] = React.useState(false);
  const [isStageDialogOpen, setIsStageDialogOpen] = React.useState(false);
  const [selectedTagIds, setSelectedTagIds] = React.useState<string[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = React.useState<string>('');
  const [selectedStageId, setSelectedStageId] = React.useState<string>('');
  const [isExecuting, setIsExecuting] = React.useState(false);

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

  const selectedCount = selectedResponseIds.length;
  const identifiedCount = identifiedEntityIds.length;

  if (selectedCount === 0) return null;

  // Handle Apply Tags
  const handleApplyTags = async () => {
    if (!activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Workspace not active.' });
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
        entityIds: identifiedEntityIds,
        tagIds: selectedTagIds,
      });

      if (res.success) {
        toast({
          title: 'Tags Applied',
          description: `Successfully applied tags to ${identifiedCount} identified ${identifiedCount === 1 ? 'entity' : 'entities'}.`,
        });
        setIsTagDialogOpen(false);
        setSelectedTagIds([]);
        onActionComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Bulk Tagging Failed',
          description: res.error || 'Could not apply tags.',
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
    if (!activeWorkspaceId) {
      toast({ variant: 'destructive', title: 'Error', description: 'Workspace not active.' });
      return;
    }
    if (!selectedPipelineId || !selectedStageId) {
      toast({
        variant: 'destructive',
        title: 'Selection Required',
        description: 'Please choose both a pipeline and a target stage.',
      });
      return;
    }

    setIsExecuting(true);
    try {
      const res = await bulkMoveSurveyEntitiesStageAction({
        workspaceId: activeWorkspaceId,
        entityIds: identifiedEntityIds,
        pipelineId: selectedPipelineId,
        stageId: selectedStageId,
      });

      if (res.success) {
        toast({
          title: 'Pipeline Stage Updated',
          description: `Successfully moved ${identifiedCount} identified ${identifiedCount === 1 ? 'entity' : 'entities'} to the target stage.`,
        });
        setIsStageDialogOpen(false);
        setSelectedPipelineId('');
        setSelectedStageId('');
        onActionComplete();
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
      {/* Floating Bottom Bulk Actions Dock */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-out select-none">
        <div className="flex items-center flex-wrap gap-1.5 sm:gap-3 px-3 sm:px-5 py-2.5 sm:py-3 rounded-2xl backdrop-blur-xl bg-slate-950/90 dark:bg-slate-900/95 border border-slate-800 dark:border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10 max-w-[95vw] md:max-w-max">
          
          {/* Selection Counts */}
          <div className="flex items-center gap-2 pr-2 sm:pr-3 border-r border-slate-800/80">
            <div className="h-7 px-2.5 rounded-lg bg-primary/20 flex items-center justify-center">
              <span className="font-mono text-xs font-black text-primary">{selectedCount}</span>
            </div>
            <span className="text-xs font-semibold text-slate-300 hidden sm:inline">
              Selected
            </span>
            {identifiedCount > 0 ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px] font-bold gap-1 py-0.5">
                <Building2 className="h-3 w-3" />
                {identifiedCount} Identified
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] font-medium py-0.5">
                Anonymous
              </Badge>
            )}
          </div>

          {/* Conditional Actions: Entity Actions vs Simpler Actions */}
          {identifiedCount > 0 && (
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsTagDialogOpen(true)}
                className="h-9 px-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl gap-1.5 active:scale-[0.97] touch-manipulation"
              >
                <TagIcon className="h-3.5 w-3.5 text-primary" />
                <span>Apply Tags</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsStageDialogOpen(true)}
                className="h-9 px-3 text-xs font-bold text-slate-200 hover:text-white hover:bg-slate-800 rounded-xl gap-1.5 active:scale-[0.97] touch-manipulation"
              >
                <GitPullRequest className="h-3.5 w-3.5 text-emerald-400" />
                <span>Move Stage</span>
              </Button>
            </div>
          )}

          {/* Common / Simpler Actions */}
          <div className="flex items-center gap-1 sm:gap-2 pl-1 border-l border-slate-800/80">
            <Button
              variant="ghost"
              size="sm"
              onClick={onDeleteSelected}
              className="h-9 px-3 text-xs font-bold text-destructive hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5 active:scale-[0.97] touch-manipulation"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClearSelection}
              aria-label="Clear Selection"
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl active:scale-[0.97]"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Apply Tags Dialog */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <TagIcon className="h-5 w-5 text-primary" />
              Apply Tags to Identified Entities
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select workspace tags to apply across <strong>{identifiedCount}</strong> identified {identifiedCount === 1 ? 'entity' : 'entities'}.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Label className="text-xs font-semibold text-foreground">Tags</Label>
            <TagSelector
              currentTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
            />
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTagDialogOpen(false)}
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
              Apply Tags ({selectedTagIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Move Pipeline Stage Dialog */}
      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <GitPullRequest className="h-5 w-5 text-emerald-500" />
              Move Identified Entities in Pipeline
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Select the destination pipeline and stage for <strong>{identifiedCount}</strong> identified {identifiedCount === 1 ? 'entity' : 'entities'}.
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
              onClick={() => setIsStageDialogOpen(false)}
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
