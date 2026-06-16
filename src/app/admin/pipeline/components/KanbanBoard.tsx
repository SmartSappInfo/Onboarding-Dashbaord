'use client';

import * as React from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  collection,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Deal, OnboardingStage, Task } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { updateDealStageAction, updateDealStatusAction } from '@/app/actions/deal-actions';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import StageColumn from './StageColumn';
import DealCard from './DealCard';
import type { KanbanFilters } from '../pipeline-types';
import { applyDealFilters } from '../utils/filter-deals';

interface KanbanBoardProps {
    pipelineId: string;
    customWidth?: number;
    filters: KanbanFilters;
}

/**
 * KanbanBoard - Modern Deal Progression Hub
 * 
 * Powered by deals collection for real-time tracking.
 */
export default function KanbanBoard({ pipelineId, customWidth, filters }: KanbanBoardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { user } = useUser();
  // Resolve only the entities referenced by the visible deals (for tag filtering)
  // instead of loading the entire workspace into memory (Phase 5).
  const { entitiesById, resolveIds } = useEntityResolver();
  const getEntityTags = React.useCallback(
    (entityId: string) => entitiesById.get(entityId)?.workspaceTags ?? [],
    [entitiesById]
  );

  // 1. Fetch Stages for specific Pipeline
  const stagesQuery = useMemoFirebase(
    () =>
      firestore
        ? query(
            collection(firestore, 'onboardingStages'), 
            where('pipelineId', '==', pipelineId),
            orderBy('order', 'asc')
          )
        : null,
    [firestore, pipelineId]
  );
  const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);

  // 2. Fetch Deals from the modern unified collection
  const dealsQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId ? query(
        collection(firestore, 'deals'), 
        where('pipelineId', '==', pipelineId),
        where('workspaceId', '==', activeWorkspaceId)
    ) : null),
    [firestore, pipelineId, activeWorkspaceId]
  );
  const { data: deals, isLoading: isLoadingDeals } = useCollection<Deal>(dealsQuery);

  // 3. Fetch Tasks to index badges
  const tasksQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId ? query(
        collection(firestore, 'tasks'), 
        where('workspaceId', '==', activeWorkspaceId),
        where('relatedEntityType', '==', 'Deal')
    ) : null),
    [firestore, activeWorkspaceId]
  );
  const { data: tasks, isLoading: isLoadingTasks } = useCollection<Task>(tasksQuery);

  const tasksByDealId = React.useMemo(() => {
    const map: Record<string, { total: number; completed: number; hasOverdue: boolean }> = {};
    if (!tasks) return map;
    
    const now = new Date();
    tasks.forEach((task) => {
      const dealId = task.relatedEntityId;
      if (!dealId) return;
      
      if (!map[dealId]) {
        map[dealId] = { total: 0, completed: 0, hasOverdue: false };
      }
      
      map[dealId].total += 1;
      if (task.status === 'done') {
        map[dealId].completed += 1;
      } else {
        if (task.dueDate) {
          const due = new Date(task.dueDate);
          if (due < now) {
            map[dealId].hasOverdue = true;
          }
        }
      }
    });
    return map;
  }, [tasks]);

  const [activeElement, setActiveElement] = React.useState<Deal | OnboardingStage | null>(null);
  const [dealsByStage, setDealsByStage] = React.useState<Record<string, Deal[]>>({});
  const initialDealsByStage = React.useRef<Record<string, Deal[]>>({});
  
  // Pending state for deal marking as lost
  const [pendingLostDeal, setPendingLostDeal] = React.useState<{ deal: Deal; targetStage: OnboardingStage } | null>(null);
  const [selectedReason, setSelectedReason] = React.useState<string>('Competitor');
  const [extraNotes, setExtraNotes] = React.useState<string>('');
  const [isSavingLoss, setIsSavingLoss] = React.useState<boolean>(false);

  const allDeals = React.useMemo(() => {
    return deals || [];
  }, [deals]);

  // Resolve the entities referenced by the current deals (deduped + batched) so
  // tag filtering has the data it needs — O(deals), not O(all entities).
  React.useEffect(() => {
    const ids = allDeals.map((d) => d.entityId).filter((x): x is string => !!x);
    if (ids.length > 0) resolveIds(ids);
  }, [allDeals, resolveIds]);

  // 4. Apply Multi-Layer Filtering (shared with the list view)
  const filteredDeals = React.useMemo(
    () => applyDealFilters(allDeals, filters, assignedUserId, getEntityTags),
    [allDeals, assignedUserId, filters, getEntityTags]
  );

  // 5. Grouping Logic
  React.useEffect(() => {
    if (stages && filteredDeals) {
      const grouped: Record<string, Deal[]> = {};
      stages.forEach((stage) => { grouped[stage.id] = []; });
      
      filteredDeals.forEach((deal) => {
        const stageId = deal.stageId || (stages.length > 0 ? stages[0].id : null);
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(deal);
        }
      });
      setDealsByStage(grouped);
      initialDealsByStage.current = grouped;
    }
  }, [stages, filteredDeals]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const findContainer = React.useCallback((id: string) => {
      if (stages?.some((s) => s.id === id)) return id;
      for (const stageId in dealsByStage) {
        if (dealsByStage[stageId].some((d) => d.id === id)) return stageId;
      }
      return null;
    },
    [stages, dealsByStage]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'DEAL') {
      setActiveElement(active.data.current.deal);
      initialDealsByStage.current = dealsByStage;
    }
    if (active.data.current?.type === 'COLUMN') {
      setActiveElement(active.data.current.stage);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const activeType = active.data.current?.type;
    if (activeType !== 'DEAL') return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) return;

    if (activeContainer !== overContainer) {
      setDealsByStage((prev) => {
        const activeItems = prev[activeContainer];
        const overItems = prev[overContainer];
        const activeIndex = activeItems.findIndex((item) => item.id === active.id);
        const overIndex = overItems.findIndex((item) => item.id === over.id);

        let newIndexInOverContainer = over.data.current?.type === 'COLUMN' ? overItems.length : (overIndex >= 0 ? overIndex : overItems.length);

        return {
          ...prev,
          [activeContainer]: activeItems.filter((item) => item.id !== active.id),
          [overContainer]: [
            ...overItems.slice(0, newIndexInOverContainer),
            activeItems[activeIndex],
            ...overItems.slice(newIndexInOverContainer),
          ],
        };
      });
    }
  };

  const handleSaveLossReason = async () => {
    if (!pendingLostDeal) return;
    const { deal, targetStage } = pendingLostDeal;
    setIsSavingLoss(true);

    try {
      const lostReasonString = `${selectedReason}${extraNotes ? ': ' + extraNotes : ''}`;
      
      const resStage = await updateDealStageAction(deal.id, targetStage.id);
      if (!resStage.success) throw new Error(resStage.error || 'Failed to update deal stage');

      const resStatus = await updateDealStatusAction(deal.id, 'lost', lostReasonString);
      if (!resStatus.success) throw new Error(resStatus.error || 'Failed to update deal status');

      toast({
        title: 'Deal Updated',
        description: `Deal marked as lost: ${selectedReason}`,
      });

      initialDealsByStage.current = dealsByStage;
      setPendingLostDeal(null);
      setSelectedReason('Competitor');
      setExtraNotes('');
    } catch (error: any) {
      console.error('Failed to save loss reason:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to complete deal status transition.',
      });
      setDealsByStage(initialDealsByStage.current);
      setPendingLostDeal(null);
      setSelectedReason('Competitor');
      setExtraNotes('');
    } finally {
      setIsSavingLoss(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveElement(null);
    const { active, over } = event;

    if (!over) {
      setDealsByStage(initialDealsByStage.current);
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (active.data.current?.type === 'COLUMN' && over.data.current?.type === 'COLUMN' && active.id !== over.id) {
        return;
    } else if (overContainer) {
      const dealId = active.data.current?.deal?.id || active.id as string;
      const newStage = stages?.find((s) => s.id === overContainer);
      const deal = active.data.current?.deal as Deal;

      if (newStage && activeContainer !== overContainer) {
        if (newStage.name.toLowerCase().includes('lost')) {
          setPendingLostDeal({ deal, targetStage: newStage });
          return;
        }

        try {
          const resStage = await updateDealStageAction(dealId, newStage.id);
          if (!resStage.success) {
            throw new Error(resStage.error || 'Failed to update deal stage');
          }

          const isWonStage = newStage.name.toLowerCase().includes('live') || newStage.name.toLowerCase().includes('won');
          const targetStatus = isWonStage ? 'won' : 'open';

          if (deal.status !== targetStatus) {
            const resStatus = await updateDealStatusAction(dealId, targetStatus);
            if (!resStatus.success) {
              throw new Error(resStatus.error || 'Failed to update deal status');
            }
          }

          toast({ title: 'Deal Moved', description: `Deal advanced to "${newStage.name}".` });
          initialDealsByStage.current = dealsByStage;

          if (isWonStage) {
            triggerInternalNotification({
              entityId: deal.entityId,
              notifyManager: true,
              channel: 'both',
              variables: { school_name: deal.name, new_stage: newStage.name, event_type: 'Deal Progression' }
            }).catch(console.error);
          }
        } catch (error: any) {
          console.error('Failed to update stage:', error);
          toast({ variant: 'destructive', title: 'Logic Error', description: error.message || 'Failed to update deal state.' });
          setDealsByStage(initialDealsByStage.current);
        }
      }
    }
  };

  const isLoading = isLoadingDeals || isLoadingStages || isLoadingFilter || isLoadingTasks;

  if (isLoading) {
    return (
      <div className="flex h-full gap-8 px-8 py-10 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-80 space-y-8 shrink-0">
            <Skeleton className="h-14 w-full rounded-[1.25rem]" />
            <Skeleton className="h-48 w-full rounded-[2.25rem]" />
            <Skeleton className="h-48 w-full rounded-[2.25rem]" />
          </div>
        ))}
      </div>
    );
  }

  if (!stages || stages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 opacity-10 gap-6">
        <div className="p-10 bg-muted rounded-[3rem] shadow-inner border"><Workflow size={80} /></div>
        <div className="text-center space-y-2">
          <p className="font-semibold tracking-[0.3em] text-xl">Empty Architecture</p>
          <p className="text-xs font-bold opacity-60">Please define stages in Configuration Hub.</p>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { setActiveElement(null); setDealsByStage(initialDealsByStage.current); }}
      collisionDetection={closestCorners}
    >
      <ScrollArea className="h-full whitespace-nowrap">
        <div className="flex items-start gap-8 p-10">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              customWidth={customWidth}
              deals={dealsByStage[stage.id] || []}
              tasksByDealId={tasksByDealId}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay dropAnimation={null}>
        {activeElement ? (
          'order' in activeElement ? (
            <StageColumn
              stage={activeElement as OnboardingStage}
              customWidth={customWidth}
              deals={dealsByStage[(activeElement as OnboardingStage).id] || []}
              isOverlay
              tasksByDealId={tasksByDealId}
            />
          ) : (
            <div className="w-72 pointer-events-none">
              <DealCard 
                deal={activeElement as Deal} 
                isOverlay 
                taskStats={tasksByDealId[(activeElement as Deal).id]}
              />
            </div>
          )
        ) : null}
      </DragOverlay>

      {/* Loss Reason Dialog */}
      <Dialog open={pendingLostDeal !== null} onOpenChange={(open) => {
        if (!open) {
          setDealsByStage(initialDealsByStage.current);
          setPendingLostDeal(null);
          setSelectedReason('Competitor');
          setExtraNotes('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Mark Deal as Lost
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-1">
              Please specify the reason why you lost the deal for <strong>{pendingLostDeal?.deal.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Reason Category</label>
              <Select value={selectedReason} onValueChange={setSelectedReason}>
                <SelectTrigger className="w-full rounded-xl border border-input bg-background/50 hover:bg-background/80 transition-colors">
                  <SelectValue placeholder="Select a reason" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-2xl">
                  <SelectItem value="Competitor" className="rounded-lg">Competitor</SelectItem>
                  <SelectItem value="Price/Budget" className="rounded-lg">Price / Budget</SelectItem>
                  <SelectItem value="Feature Gap" className="rounded-lg">Feature Gap</SelectItem>
                  <SelectItem value="Timeout" className="rounded-lg">Timeout / No Response</SelectItem>
                  <SelectItem value="Other" className="rounded-lg">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Additional Details (Optional)</label>
              <Textarea
                placeholder="Describe what happened..."
                value={extraNotes}
                onChange={(e) => setExtraNotes(e.target.value)}
                className="min-h-[100px] rounded-xl bg-background/50 border border-input focus:bg-background transition-all"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setDealsByStage(initialDealsByStage.current);
                setPendingLostDeal(null);
                setSelectedReason('Competitor');
                setExtraNotes('');
              }}
              disabled={isSavingLoss}
              className="rounded-xl font-bold text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveLossReason}
              disabled={isSavingLoss}
              className="rounded-xl font-bold text-xs bg-red-600 hover:bg-red-700 text-white shrink-0"
            >
              {isSavingLoss ? 'Saving...' : 'Confirm Lost'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  );
}
