'use client';

/**
 * ARCHITECTURAL GUIDANCE & CAUTION FOR MAINTAINERS:
 * 
 * 1. Single Source of Truth for Tags:
 *    - Uses standardized `<TagSelector>` component in client/draft mode (`currentTagIds`, `onTagsChange`).
 *    - Direct text input for tags is strictly prohibited by workspace rules.
 * 2. Mobile Optimization:
 *    - Sticky bottom toolbar with `min-h-[44px]` touch targets and responsive flex layouts.
 * 3. Security & Multi-Tenant Guardrails:
 *    - All bulk actions validate `activeWorkspaceId` and strictly target identified contact IDs.
 * 4. Testability Pointers:
 *    - Test opening modals with 1+ contact, clearing selection, applying tags, and moving pipeline stages.
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
  Tag as TagIcon, X, Loader2, GitPullRequest, CheckCircle2 
} from 'lucide-react';
import { 
  bulkApplyTagsToMediaContactsAction, 
  bulkMoveMediaContactsStageAction 
} from '@/lib/media-analytics-entity-actions';

interface PipelineStageDoc {
  id: string;
  name: string;
  order?: number;
}

interface PipelineDoc {
  id: string;
  name: string;
}

interface MediaAnalyticsBulkActionsBarProps {
  selectedContactIds: string[];
  selectedContactNames: string[];
  onClearSelection: () => void;
  onActionComplete: () => void;
}

export default function MediaAnalyticsBulkActionsBar({
  selectedContactIds,
  selectedContactNames,
  onClearSelection,
  onActionComplete,
}: MediaAnalyticsBulkActionsBarProps) {
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

  /**
   * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
   * In Firestore, pipeline stages live in the `onboardingStages` collection matching `where('pipelineId', '==', selectedPipelineId)`.
   * Querying `onboardingStages` directly guarantees target stages dynamically load when a pipeline is selected.
   */
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !selectedPipelineId) return null;
    return query(
      collection(firestore, 'onboardingStages'),
      where('pipelineId', '==', selectedPipelineId),
      orderBy('order', 'asc')
    );
  }, [firestore, selectedPipelineId]);

  const { data: stages, isLoading: isStagesLoading } = useCollection<PipelineStageDoc>(stagesQuery);

  const handleApplyTags = async () => {
    if (!activeWorkspaceId || selectedContactIds.length === 0 || selectedTagIds.length === 0) return;
    setIsExecuting(true);
    try {
      const result = await bulkApplyTagsToMediaContactsAction({
        workspaceId: activeWorkspaceId,
        contactIds: selectedContactIds,
        tagIds: selectedTagIds,
      });

      if (result.success) {
        toast({
          title: 'Tags Applied Successfully',
          description: `Applied ${selectedTagIds.length} tag(s) to ${result.updatedCount} contact record(s).`,
        });
        setIsTagDialogOpen(false);
        setSelectedTagIds([]);
        onClearSelection();
        onActionComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Tagging Failed',
          description: result.error || 'Could not update contact tags.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const handleMoveStage = async () => {
    if (!activeWorkspaceId || selectedContactIds.length === 0 || !selectedPipelineId || !selectedStageId) return;
    setIsExecuting(true);
    try {
      const result = await bulkMoveMediaContactsStageAction({
        workspaceId: activeWorkspaceId,
        contactIds: selectedContactIds,
        pipelineId: selectedPipelineId,
        stageId: selectedStageId,
      });

      if (result.success) {
        toast({
          title: 'Pipeline Stage Updated',
          description: `Moved ${result.updatedCount} contact(s) to the selected stage.`,
        });
        setIsStageDialogOpen(false);
        setSelectedPipelineId('');
        setSelectedStageId('');
        onClearSelection();
        onActionComplete();
      } else {
        toast({
          variant: 'destructive',
          title: 'Stage Update Failed',
          description: result.error || 'Could not move pipeline stage.',
        });
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err instanceof Error ? err.message : 'An unexpected error occurred.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  if (selectedContactIds.length === 0) return null;

  return (
    <>
      {/* Sticky Bottom Bulk Actions Bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-3xl bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border border-slate-800 text-white p-3.5 px-6 rounded-2xl shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-in slide-in-from-bottom-5 duration-300">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Badge className="bg-primary text-white border-none font-extrabold text-xs px-2.5 py-1 rounded-lg">
            {selectedContactIds.length} Selected
          </Badge>
          <div className="flex flex-col text-left">
            <span className="text-xs font-bold truncate max-w-[200px] sm:max-w-[280px]">
              {selectedContactNames.slice(0, 2).join(', ')}
              {selectedContactNames.length > 2 ? ` +${selectedContactNames.length - 2} more` : ''}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Ready for CRM entity actions</span>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Button
            type="button"
            size="sm"
            onClick={() => setIsTagDialogOpen(true)}
            className="h-10 min-h-[44px] rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-4 gap-1.5 active:scale-[0.97] transition-all"
          >
            <TagIcon className="h-3.5 w-3.5" />
            Apply Tags
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => setIsStageDialogOpen(true)}
            className="h-10 min-h-[44px] rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-white px-4 gap-1.5 active:scale-[0.97] transition-all"
          >
            <GitPullRequest className="h-3.5 w-3.5" />
            Move Stage
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClearSelection}
            className="h-10 w-10 min-h-[44px] min-w-[44px] text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
            title="Clear Selection"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* TagSelector Modal */}
      <Dialog open={isTagDialogOpen} onOpenChange={setIsTagDialogOpen}>
        <DialogContent 
          className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="p-6 bg-emerald-500/10 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-lg">
                <TagIcon className="h-5 w-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-lg font-extrabold text-foreground">Apply Workspace Tags</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-medium">
                  Select tags to assign to {selectedContactIds.length} identified contact record(s).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 text-left">
            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Workspace Contact Tags
            </Label>
            <TagSelector
              currentTagIds={selectedTagIds}
              onTagsChange={setSelectedTagIds}
              className="w-full"
            />
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-between items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsTagDialogOpen(false)}
              disabled={isExecuting}
              className="rounded-xl font-bold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyTags}
              disabled={isExecuting || selectedTagIds.length === 0}
              className="rounded-xl font-bold min-h-[44px] px-6 bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg"
            >
              {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Apply Tags ({selectedTagIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move Stage Modal */}
      <Dialog open={isStageDialogOpen} onOpenChange={setIsStageDialogOpen}>
        <DialogContent 
          className="sm:max-w-md rounded-3xl p-0 overflow-hidden border-none shadow-2xl bg-card"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader className="p-6 bg-primary/10 border-b border-border shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary text-white rounded-2xl shadow-lg">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <div className="text-left">
                <DialogTitle className="text-lg font-extrabold text-foreground">Move Pipeline Stage</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground font-medium">
                  Update pipeline stage for {selectedContactIds.length} identified contact record(s).
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-4 text-left">
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                Target Pipeline
              </Label>
              <Select value={selectedPipelineId} onValueChange={(val) => { setSelectedPipelineId(val); setSelectedStageId(''); }}>
                <SelectTrigger className="h-11 rounded-xl bg-background border-border text-xs font-bold min-h-[44px]">
                  <SelectValue placeholder="Select workspace pipeline..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-border">
                  {pipelines?.map((pipe) => (
                    <SelectItem key={pipe.id} value={pipe.id} className="text-xs font-bold">
                      {pipe.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPipelineId && (
              <div className="space-y-2 animate-in fade-in duration-200">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
                  Target Stage
                </Label>
                <Select value={selectedStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-11 rounded-xl bg-background border-border text-xs font-bold min-h-[44px]">
                    <SelectValue placeholder={isStagesLoading ? "Loading stages..." : "Select target stage..."} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border">
                    {stages?.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id} className="text-xs font-bold">
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-muted/20 border-t border-border flex justify-between items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsStageDialogOpen(false)}
              disabled={isExecuting}
              className="rounded-xl font-bold min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleMoveStage}
              disabled={isExecuting || !selectedPipelineId || !selectedStageId}
              className="rounded-xl font-bold min-h-[44px] px-6 bg-primary hover:bg-primary/90 text-white gap-2 shadow-lg"
            >
              {isExecuting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Move Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
