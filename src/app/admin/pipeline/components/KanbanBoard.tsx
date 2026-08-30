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
  collection,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Deal, OnboardingStage, Task, Automation } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useEntityResolver } from '@/context/EntityCacheContext';
import { useWorkspace } from '@/context/WorkspaceContext';
import { triggerInternalNotification } from '@/lib/notification-engine';
import { updateDealStageAction, updateStageOrdersAction } from '@/app/actions/deal-actions';
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
import StageValidationModal from './StageValidationModal';
import MobileStageSwitcher from './MobileStageSwitcher';
import { validateStageTransition, resolveStageTerminalStatus } from '@/lib/deals/deal-stage-validation';
import type { StageRequiredField } from '@/lib/types';
import type { KanbanFilters } from '../pipeline-types';
import { applyDealFilters } from '../utils/filter-deals';

interface KanbanBoardProps {
    pipelineId: string;
    pipelineName?: string;
    customWidth?: number;
    filters: KanbanFilters;
    automations?: Automation[];
}

/**
 * ARCHITECTURAL POINTER (KanbanBoard Component):
 * Real-time deal progression hub with DnD, stage filters, and stage-linked automation indicators.
 */
export default function KanbanBoard({ pipelineId, pipelineName, customWidth, filters, automations }: KanbanBoardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const { activeWorkspaceId } = useWorkspace();
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
  
  // ARCHITECTURAL POINTER:
  // We capture the deal and its origin stage at drag start before any optimistic mutations
  // occur in handleDragOver. This prevents state-drift where source and target appear identical.
  const draggedDealRef = React.useRef<Deal | null>(null);
  const sourceStageIdRef = React.useRef<string | null>(null);
  
  // Pending state for deal marking as lost
  const [pendingLostDeal, setPendingLostDeal] = React.useState<{ deal: Deal; targetStage: OnboardingStage } | null>(null);
  const [selectedReason, setSelectedReason] = React.useState<string>('Competitor');
  const [extraNotes, setExtraNotes] = React.useState<string>('');
  const [isSavingLoss, setIsSavingLoss] = React.useState<boolean>(false);

  // Process gate validation blocker state
  const [pendingBlockedDeal, setPendingBlockedDeal] = React.useState<{
    deal: Deal;
    targetStage: OnboardingStage;
    missingFields: StageRequiredField[];
  } | null>(null);

  // Mobile active stage state
  const [activeMobileStageId, setActiveMobileStageId] = React.useState<string | null>(() => stages[0]?.id || null);

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
      const deal = active.data.current.deal as Deal;
      draggedDealRef.current = deal;
      const initialStageId = findContainer(active.id as string) || deal.stageId || null;
      sourceStageIdRef.current = initialStageId;
      setActiveElement(deal);
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
        const activeIndex = activeItems?.findIndex((item) => item.id === active.id) ?? -1;
        const overIndex = overItems?.findIndex((item) => item.id === over.id) ?? -1;

        if (!activeItems || activeIndex === -1) return prev;

        const safeOverItems = overItems || [];
        let newIndexInOverContainer = over.data.current?.type === 'COLUMN' ? safeOverItems.length : (overIndex >= 0 ? overIndex : safeOverItems.length);

        return {
          ...prev,
          [activeContainer]: activeItems.filter((item) => item.id !== active.id),
          [overContainer]: [
            ...safeOverItems.slice(0, newIndexInOverContainer),
            activeItems[activeIndex],
            ...safeOverItems.slice(newIndexInOverContainer),
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
      
      const res = await updateDealStageAction(deal.id, targetStage.id, {
        status: 'lost',
        lostReason: lostReasonString,
        userId: user?.uid,
      });
      if (!res.success) throw new Error(res.error || 'Failed to update deal stage');

      toast({
        title: 'Deal Updated',
        description: `Deal marked as lost: ${selectedReason}`,
      });

      initialDealsByStage.current = dealsByStage;
      setPendingLostDeal(null);
      setSelectedReason('Competitor');
      setExtraNotes('');
    } catch (error: unknown) {
      console.error('Failed to save loss reason:', error);
      const msg = error instanceof Error ? error.message : 'Failed to complete deal status transition.';
      toast({
        variant: 'destructive',
        title: 'Error',
        description: msg,
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

    const sourceStageId = sourceStageIdRef.current;
    const deal = (active.data.current?.deal as Deal | undefined) || draggedDealRef.current;

    // Reset captured drag references
    sourceStageIdRef.current = null;
    draggedDealRef.current = null;

    if (!over) {
      setDealsByStage(initialDealsByStage.current);
      return;
    }

    // Handle column reordering if dragging columns
    if (active.data.current?.type === 'COLUMN') {
      const activeStageId = active.id as string;
      const overStageId = over.id as string;

      if (activeStageId !== overStageId && stages && stages.length > 0) {
        const oldIndex = stages.findIndex((s) => s.id === activeStageId);
        const newIndex = stages.findIndex((s) => s.id === overStageId);

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedStages = [...stages];
          const [movedStage] = reorderedStages.splice(oldIndex, 1);
          reorderedStages.splice(newIndex, 0, movedStage);

          const orderedIds = reorderedStages.map((s) => s.id);
          try {
            const res = await updateStageOrdersAction(pipelineId, orderedIds, activeWorkspaceId, user?.uid);
            if (!res.success) {
              toast({ variant: 'destructive', title: 'Reorder Failed', description: res.error });
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Failed to reorder stages';
            toast({ variant: 'destructive', title: 'Reorder Failed', description: msg });
          }
        }
      }
      return;
    }

    // Handle deal moving across stage columns
    if (deal) {
      const targetStageId = over.data.current?.type === 'COLUMN' 
        ? (over.data.current.stage?.id as string) 
        : findContainer(over.id as string);

      const newStage = stages?.find((s) => s.id === targetStageId);

      if (!newStage || !targetStageId) {
        setDealsByStage(initialDealsByStage.current);
        return;
      }

      // If dropped back in the same starting stage, keep state in sync and exit
      if (sourceStageId === targetStageId) {
        initialDealsByStage.current = dealsByStage;
        return;
      }

      // 1. Process Gate Entry Validation (PRD Section 16)
      const validation = validateStageTransition(deal, newStage);
      if (!validation.valid) {
        setDealsByStage(initialDealsByStage.current);
        setPendingBlockedDeal({
          deal,
          targetStage: newStage,
          missingFields: validation.missingFields,
        });
        return;
      }

      // 2. Terminal Lost Stage Handler (PRD Section 14)
      const isLostStage = newStage.terminalType === 'lost' || newStage.terminalType === 'abandoned' || newStage.isLost || newStage.name.toLowerCase().includes('lost');
      if (isLostStage) {
        setPendingLostDeal({ deal, targetStage: newStage });
        return;
      }

      // 3. Normal or Terminal Won Progression
      try {
        const isWonStage = newStage.terminalType === 'won' || newStage.isWon || newStage.name.toLowerCase().includes('won') || newStage.name.toLowerCase().includes('live');
        const targetStatus = isWonStage ? 'won' : 'open';

        const resStage = await updateDealStageAction(deal.id, newStage.id, {
          status: targetStatus,
          userId: user?.uid,
        });
        if (!resStage.success) {
          throw new Error(resStage.error || 'Failed to update deal stage');
        }

        toast({
          title: isWonStage ? '🎉 Deal Won!' : 'Deal Moved',
          description: `Deal advanced to "${newStage.name}".`,
          actionConfig: {
            path: `/admin/deals/${deal.id}`,
            label: 'View Deal',
          },
        });
        initialDealsByStage.current = dealsByStage;

        if (isWonStage) {
          triggerInternalNotification({
            entityId: deal.entityId,
            notifyManager: true,
            channel: 'both',
            variables: { school_name: deal.name, new_stage: newStage.name, event_type: 'Deal Won' }
          }).catch(console.error);
        }
      } catch (error: unknown) {
        console.error('Failed to update stage:', error);
        const msg = error instanceof Error ? error.message : 'Failed to update deal state.';
        toast({ variant: 'destructive', title: 'Logic Error', description: msg });
        setDealsByStage(initialDealsByStage.current);
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

  const handleSelectMobileStage = (stageId: string) => {
    setActiveMobileStageId(stageId);
    if (typeof document !== 'undefined') {
      const el = document.getElementById(`stage-column-${stageId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Mobile Stage Switcher */}
      <MobileStageSwitcher
        stages={stages}
        deals={filteredDeals}
        activeStageId={activeMobileStageId}
        onSelectStage={handleSelectMobileStage}
      />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={() => { setActiveElement(null); setDealsByStage(initialDealsByStage.current); }}
        collisionDetection={closestCorners}
      >
        <ScrollArea className="flex-1 whitespace-nowrap">
          <div className="flex items-start gap-8 p-6 md:p-10">
            {stages.map((stage) => (
              <div key={stage.id} id={`stage-column-${stage.id}`}>
                <StageColumn
                  stage={stage}
                  pipelineId={pipelineId}
                  pipelineName={pipelineName}
                  customWidth={customWidth}
                  deals={dealsByStage[stage.id] || []}
                  tasksByDealId={tasksByDealId}
                  automations={automations}
                  isDraggingDeal={!!activeElement && !('order' in activeElement)}
                />
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      <DragOverlay dropAnimation={null}>
        {activeElement ? (
          'order' in activeElement ? (
            <StageColumn
              stage={activeElement as OnboardingStage}
              pipelineId={pipelineId}
              pipelineName={pipelineName}
              customWidth={customWidth}
              deals={dealsByStage[(activeElement as OnboardingStage).id] || []}
              isOverlay
              tasksByDealId={tasksByDealId}
              automations={automations}
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

      {/* Process Gate Validation Blocker Modal */}
      <StageValidationModal
        deal={pendingBlockedDeal?.deal || null}
        targetStage={pendingBlockedDeal?.targetStage || null}
        missingFields={pendingBlockedDeal?.missingFields || []}
        isOpen={!!pendingBlockedDeal}
        onClose={() => setPendingBlockedDeal(null)}
        onSuccess={() => {
          setPendingBlockedDeal(null);
        }}
      />
    </DndContext>
    </div>
  );
}
