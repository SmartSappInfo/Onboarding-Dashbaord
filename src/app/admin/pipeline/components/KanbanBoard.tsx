
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
  writeBatch,
  updateDoc,
  where,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { School, OnboardingStage, LifecycleStatus } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Workflow, Info } from 'lucide-react';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { usePerspective } from '@/context/PerspectiveContext';
import { logActivity } from '@/lib/activity-logger';
import { triggerInternalNotification } from '@/lib/notification-engine';
import StageColumn from './StageColumn';
import SchoolCard from './SchoolCard';

interface KanbanBoardProps {
    pipelineId: string;
    customWidth?: number;
    filters: {
        searchTerm: string;
        zoneId: string;
        lifecycleStatus: LifecycleStatus | 'all';
    };
}

export default function KanbanBoard({ pipelineId, customWidth, filters }: KanbanBoardProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();
  const { activeTrack } = usePerspective();
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

  // 2. Fetch Schools for specific Pipeline and track (Track filtering is mandatory for rules)
  const schoolsQuery = useMemoFirebase(
    () => (firestore ? query(
        collection(firestore, 'schools'), 
        where('pipelineId', '==', pipelineId),
        where('track', '==', activeTrack)
    ) : null),
    [firestore, pipelineId, activeTrack]
  );
  const { data: allSchools, isLoading: isLoadingSchools } = useCollection<School>(schoolsQuery);

  const [activeElement, setActiveElement] = React.useState<School | OnboardingStage | null>(null);
  const [schoolsByStage, setSchoolsByStage] = React.useState<Record<string, School[]>>({});
  const initialSchoolsByStage = React.useRef<Record<string, School[]>>({});

  // 3. Apply Multi-Layer Filtering
  const filteredSchools = React.useMemo(() => {
    if (!allSchools) return [];
    let temp = allSchools;

    // A. Global Assignment Filter
    if (assignedUserId) {
      if (assignedUserId === 'unassigned') {
        temp = temp.filter((school) => !school.assignedTo?.userId);
      } else {
        temp = temp.filter((school) => school.assignedTo?.userId === assignedUserId);
      }
    }

    // B. Search Filter
    if (filters.searchTerm) {
        const s = filters.searchTerm.toLowerCase();
        temp = temp.filter(school => {
            const nameMatch = school.name.toLowerCase().includes(s);
            const signatory = school.focalPersons?.find(p => p.isSignatory);
            const signatoryMatch = signatory?.name.toLowerCase().includes(s);
            return nameMatch || signatoryMatch;
        });
    }

    // C. Zone Filter
    if (filters.zoneId !== 'all') {
        temp = temp.filter(school => school.zone?.id === filters.zoneId);
    }

    // D. Lifecycle Status Filter
    if (filters.lifecycleStatus !== 'all') {
        temp = temp.filter(school => school.lifecycleStatus === filters.lifecycleStatus);
    }

    return temp;
  }, [allSchools, assignedUserId, filters]);

  // 4. Grouping Logic
  React.useEffect(() => {
    if (stages && filteredSchools) {
      const grouped: Record<string, School[]> = {};
      stages.forEach((stage) => { grouped[stage.id] = []; });
      
      filteredSchools.forEach((school) => {
        const stageId = school.stage?.id || (stages.length > 0 ? stages[0].id : null);
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(school);
        }
      });
      setSchoolsByStage(grouped);
      initialSchoolsByStage.current = grouped;
    }
  }, [stages, filteredSchools]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 10 } }));

  const findContainer = React.useCallback((id: string) => {
      if (stages?.some((s) => s.id === id)) return id;
      for (const stageId in schoolsByStage) {
        if (schoolsByStage[stageId].some((s) => s.id === id)) return stageId;
      }
      return null;
    },
    [stages, schoolsByStage]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'SCHOOL') {
      setActiveElement(active.data.current.school);
      initialSchoolsByStage.current = schoolsByStage;
    }
    if (active.data.current?.type === 'COLUMN') {
      setActiveElement(active.data.current.stage);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || active.data.current?.type !== 'SCHOOL') return;

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) return;

    if (activeContainer !== overContainer) {
      setSchoolsByStage((prev) => {
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
      setSchoolsByStage(initialSchoolsByStage.current);
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (active.data.current?.type === 'COLUMN' && over.data.current?.type === 'COLUMN' && active.id !== over.id) {
        return;
    } else if (active.data.current?.type === 'SCHOOL' && activeContainer !== overContainer && overContainer) {
      const schoolId = active.id as string;
      const newStage = stages?.find((s) => s.id === overContainer);
      const school = (active.data.current?.school) as School;
      const oldStageName = school?.stage?.name || 'Initialization';

      if (newStage) {
        const schoolRef = doc(firestore!, 'schools', schoolId);
        try {
          await updateDoc(schoolRef, {
            stage: { id: newStage.id, name: newStage.name, order: newStage.order, color: newStage.color },
          });
          toast({ title: 'Protocol Advanced', description: `Institutional state set to "${newStage.name}".` });
          
          if (user && school) {
            logActivity({
                schoolId, userId: user.uid, type: 'pipeline_stage_changed', source: 'user_action',
                description: `progressed "${school.name}" from "${oldStageName}" to "${newStage.name}"`,
                metadata: { from: oldStageName, to: newStage.name, pipelineId }
            });

            if (newStage.name.toLowerCase().includes('live') || newStage.name.toLowerCase().includes('training')) {
                triggerInternalNotification({
                    schoolId, notifyManager: true, channel: 'both',
                    variables: { school_name: school.name, new_stage: newStage.name, event_type: 'Workflow Progression' }
                }).catch(console.error);
            }
          }
        } catch (error) {
          toast({ variant: 'destructive', title: 'Logic Error', description: 'Failed to update workflow state.' });
          setSchoolsByStage(initialSchoolsByStage.current);
        }
      }
    }
  };

  const isLoading = isLoadingSchools || isLoadingStages || isLoadingFilter;

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
            <p className="font-black uppercase tracking-[0.3em] text-xl">Empty Architecture</p>
            <p className="text-xs font-bold uppercase tracking-widest opacity-60">Please define stages in Configuration Hub.</p>
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
      onDragCancel={() => { setActiveElement(null); setSchoolsByStage(initialSchoolsByStage.current); }}
      collisionDetection={closestCorners}
    >
      <ScrollArea className="h-full whitespace-nowrap">
        <div className="flex h-full gap-8 p-10">
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              customWidth={customWidth}
              schools={schoolsByStage[stage.id] || []}
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
              schools={schoolsByStage[(activeElement as OnboardingStage).id] || []}
              isOverlay
            />
          ) : (
            <div className="w-72 pointer-events-none">
              <SchoolCard school={activeElement as School} isOverlay />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
