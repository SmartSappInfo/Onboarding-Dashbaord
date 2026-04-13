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
import type { WorkspaceEntity, OnboardingStage, LifecycleStatus, School } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { logActivity } from '@/lib/activity-logger';
import { triggerInternalNotification } from '@/lib/notification-engine';
import StageColumn from './StageColumn';
import EntityCard from './EntityCard';

interface KanbanBoardProps {
    pipelineId: string;
    customWidth?: number;
    filters: {
        searchTerm: string;
        zoneId: string;
        lifecycleStatus: LifecycleStatus | 'all';
    };
}

/**
 * KanbanBoard - Modern Institutional Progression Hub
 * 
 * Powered by workspace_entities collection for real-time tracking.
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

  // 2. Fetch Entities from the modern unified collection
  const entitiesQuery = useMemoFirebase(
    () => (firestore && activeWorkspaceId ? query(
        collection(firestore, 'workspace_entities'), 
        where('pipelineId', '==', pipelineId),
        where('workspaceId', '==', activeWorkspaceId)
    ) : null),
    [firestore, pipelineId, activeWorkspaceId]
  );
  const { data: entities, isLoading: isLoadingEntities } = useCollection<WorkspaceEntity>(entitiesQuery);

  const [activeElement, setActiveElement] = React.useState<WorkspaceEntity | OnboardingStage | null>(null);
  const [entitiesByStage, setEntitiesByStage] = React.useState<Record<string, WorkspaceEntity[]>>({});
  const initialEntitiesByStage = React.useRef<Record<string, WorkspaceEntity[]>>({});

  // 3. Map WorkspaceEntity to a compatible School format for Legacy UI support if needed
  // Note: We are now moving towards using WorkspaceEntity directly in components
  const allEntities = React.useMemo(() => {
    return entities || [];
  }, [entities]);

  // 4. Apply Multi-Layer Filtering
  const filteredEntities = React.useMemo(() => {
    if (!allEntities) return [];
    let temp = allEntities;

    // A. Global Assignment Filter
    if (assignedUserId) {
      if (assignedUserId === 'unassigned') {
        temp = temp.filter((e) => !e.assignedTo?.userId);
      } else {
        temp = temp.filter((e) => e.assignedTo?.userId === assignedUserId);
      }
    }

    // B. Search Filter
    if (filters.searchTerm) {
        const s = filters.searchTerm.toLowerCase();
        temp = temp.filter(e => {
            const nameMatch = e.displayName.toLowerCase().includes(s);
            const signatoryMatch = e.focalPersons?.some(p => p.name.toLowerCase().includes(s));
            return nameMatch || signatoryMatch;
        });
    }

    // C. Zone Filter
    if (filters.zoneId !== 'all') {
        temp = temp.filter(e => e.zoneId === filters.zoneId);
    }

    // D. Lifecycle Status Filter
    if (filters.lifecycleStatus !== 'all') {
        temp = temp.filter(e => e.lifecycleStatus === filters.lifecycleStatus);
    }

    return temp;
  }, [allEntities, assignedUserId, filters]);

  // 5. Grouping Logic
  React.useEffect(() => {
    if (stages && filteredEntities) {
      const grouped: Record<string, WorkspaceEntity[]> = {};
      stages.forEach((stage) => { grouped[stage.id] = []; });
      
      filteredEntities.forEach((entity) => {
        const stageId = entity.stageId || (stages.length > 0 ? stages[0].id : null);
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(entity);
        }
      });
      setEntitiesByStage(grouped);
      initialEntitiesByStage.current = grouped;
    }
  }, [stages, filteredEntities]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const findContainer = React.useCallback((id: string) => {
      if (stages?.some((s) => s.id === id)) return id;
      for (const stageId in entitiesByStage) {
        if (entitiesByStage[stageId].some((e) => e.id === id)) return stageId;
      }
      return null;
    },
    [stages, entitiesByStage]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'SCHOOL' || active.data.current?.type === 'ENTITY') {
      setActiveElement(active.data.current.entity);
      initialEntitiesByStage.current = entitiesByStage;
    }
    if (active.data.current?.type === 'COLUMN') {
      setActiveElement(active.data.current.stage);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const activeType = active.data.current?.type;
    if (activeType !== 'SCHOOL' && activeType !== 'ENTITY') return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) return;

    if (activeContainer !== overContainer) {
      setEntitiesByStage((prev) => {
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
      setEntitiesByStage(initialEntitiesByStage.current);
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (active.data.current?.type === 'COLUMN' && over.data.current?.type === 'COLUMN' && active.id !== over.id) {
        return;
    } else if (overContainer) {
      const entityId = active.data.current?.entity?.entityId || active.id as string;
      const newStage = stages?.find((s) => s.id === overContainer);
      const entity = active.data.current?.entity as WorkspaceEntity;
      const oldStageName = entity?.currentStageName || 'Initialization';

      if (newStage && activeContainer !== overContainer) {
        try {
          // Primary path: Update workspace_entities
          const workspaceEntityQuery = query(
            collection(firestore!, 'workspace_entities'),
            where('entityId', '==', entityId),
            where('workspaceId', '==', activeWorkspaceId)
          );
          const weSnap = await getDocs(workspaceEntityQuery);

          if (!weSnap.empty) {
            const workspaceEntityRef = doc(firestore!, 'workspace_entities', weSnap.docs[0].id);
            await updateDoc(workspaceEntityRef, {
              stageId: newStage.id,
              currentStageName: newStage.name,
              updatedAt: new Date().toISOString(),
            });

            toast({ title: 'Protocol Advanced', description: `Institutional state set to "${newStage.name}".` });
            
            if (user && entity) {
                logActivity({
                    organizationId: activeOrganizationId,
                    entityId: entityId,
                    userId: user.uid,
                    type: 'pipeline_stage_changed',
                    source: 'user_action',
                    workspaceId: activeWorkspaceId,
                    description: `progressed "${entity.displayName}" from "${oldStageName}" to "${newStage.name}"`,
                    metadata: { from: oldStageName, to: newStage.name, pipelineId }
                });

                if (newStage.name.toLowerCase().includes('live') || newStage.name.toLowerCase().includes('training')) {
                    triggerInternalNotification({
                        entityId: entityId,
                        notifyManager: true,
                        channel: 'both',
                        variables: { school_name: entity.displayName, new_stage: newStage.name, event_type: 'Workflow Progression' }
                    }).catch(console.error);
                }
            }
          }
        } catch (error) {
          console.error('Failed to update stage:', error);
          toast({ variant: 'destructive', title: 'Logic Error', description: 'Failed to update workflow state.' });
          setEntitiesByStage(initialEntitiesByStage.current);
        }
      }
    }
  };

  const isLoading = isLoadingEntities || isLoadingStages || isLoadingFilter;

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
      onDragCancel={() => { setActiveElement(null); setEntitiesByStage(initialEntitiesByStage.current); }}
      collisionDetection={closestCorners}
    >
 <ScrollArea className="h-full whitespace-nowrap">
 <div className="flex h-full gap-8 p-10">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              customWidth={customWidth}
              entities={entitiesByStage[stage.id] || []}
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
              entities={entitiesByStage[(activeElement as OnboardingStage).id] || []}
              isOverlay
            />
          ) : (
 <div className="w-72 pointer-events-none">
              <EntityCard entity={activeElement as WorkspaceEntity} isOverlay />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
