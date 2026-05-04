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
  doc,
  updateDoc,
  where,
  getDocs,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Deal, OnboardingStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { logActivity } from '@/lib/activity-logger';
import { triggerInternalNotification } from '@/lib/notification-engine';
import StageColumn from './StageColumn';
import DealCard from './DealCard';

interface KanbanBoardProps {
    pipelineId: string;
    customWidth?: number;
    filters: {
        searchTerm: string;
        status: 'open' | 'won' | 'lost' | 'all';
    };
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

  const [activeElement, setActiveElement] = React.useState<Deal | OnboardingStage | null>(null);
  const [dealsByStage, setDealsByStage] = React.useState<Record<string, Deal[]>>({});
  const initialDealsByStage = React.useRef<Record<string, Deal[]>>({});

  const allDeals = React.useMemo(() => {
    return deals || [];
  }, [deals]);

  // 4. Apply Multi-Layer Filtering
  const filteredDeals = React.useMemo(() => {
    if (!allDeals) return [];
    let temp = allDeals;

    // A. Global Assignment Filter
    if (assignedUserId) {
      if (assignedUserId === 'unassigned') {
        temp = temp.filter((d) => !d.assignedTo?.userId);
      } else {
        temp = temp.filter((d) => d.assignedTo?.userId === assignedUserId);
      }
    }

    // B. Search Filter
    if (filters.searchTerm) {
        const s = filters.searchTerm.toLowerCase();
        temp = temp.filter(d => {
            const nameMatch = d.name?.toLowerCase().includes(s);
            const assigneeMatch = d.assignedTo?.name?.toLowerCase().includes(s);
            return nameMatch || assigneeMatch;
        });
    }

    // C. Deal Status Filter
    if (filters.status !== 'all') {
        temp = temp.filter(d => d.status === filters.status);
    }

    return temp;
  }, [allDeals, assignedUserId, filters]);

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
        try {
          const dealRef = doc(firestore!, 'deals', dealId);
          await updateDoc(dealRef, {
            stageId: newStage.id,
            updatedAt: new Date().toISOString(),
          });

          toast({ title: 'Deal Moved', description: `Deal advanced to "${newStage.name}".` });
          
          if (user && deal) {
              logActivity({
                  organizationId: activeOrganizationId,
                  entityId: deal.entityId,
                  userId: user.uid,
                  type: 'pipeline_stage_changed',
                  source: 'user_action',
                  workspaceId: activeWorkspaceId,
                  description: `progressed deal "${deal.name}" to "${newStage.name}"`,
                  metadata: { dealId, to: newStage.name, pipelineId }
              });

              if (newStage.name.toLowerCase().includes('live') || newStage.name.toLowerCase().includes('won')) {
                  triggerInternalNotification({
                      entityId: deal.entityId,
                      notifyManager: true,
                      channel: 'both',
                      variables: { school_name: deal.name, new_stage: newStage.name, event_type: 'Deal Progression' }
                  }).catch(console.error);
              }
          }
        } catch (error) {
          console.error('Failed to update stage:', error);
          toast({ variant: 'destructive', title: 'Logic Error', description: 'Failed to update deal state.' });
          setDealsByStage(initialDealsByStage.current);
        }
      }
    }
  };

  const isLoading = isLoadingDeals || isLoadingStages || isLoadingFilter;

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
        <div className="flex h-full gap-8 p-10">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              customWidth={customWidth}
              deals={dealsByStage[stage.id] || []}
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
            />
          ) : (
            <div className="w-72 pointer-events-none">
              <DealCard deal={activeElement as Deal} isOverlay />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
