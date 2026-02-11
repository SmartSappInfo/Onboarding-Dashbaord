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
  useSortable,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection,
  orderBy,
  query,
  doc,
  writeBatch,
  updateDoc,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { School, OnboardingStage } from '@/lib/types';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useGlobalFilter } from '@/context/GlobalFilterProvider';
import { cn } from '@/lib/utils';

const getInitials = (name?: string | null) =>
  name
    ? name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : <User size={12} />;

function SchoolCard({ school }: { school: School }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: school.id, data: { type: 'SCHOOL', school } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1, // Hide original card while dragging
  };

  return (
    <Card ref={setNodeRef} style={style} className="mb-3 touch-manipulation bg-card">
      <CardHeader
        {...attributes}
        {...listeners}
        className="p-4 flex flex-row items-center gap-3 space-y-0 cursor-grab"
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={school.logoUrl} alt={school.name} />
          <AvatarFallback className="text-xs">
            {getInitials(school.name)}
          </AvatarFallback>
        </Avatar>
        <CardTitle className="text-sm font-medium flex-1">{school.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage
                src={school.assignedTo?.email || ''}
                alt={school.assignedTo?.name || ''}
              />
              <AvatarFallback className="text-xs">
                {getInitials(school.assignedTo?.name)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {school.assignedTo?.name || 'Unassigned'}
            </span>
          </div>
          {school.modules && school.modules.length > 0 && (
            <Badge
              style={{
                backgroundColor: school.modules[0].color,
                color: 'hsl(var(--primary-foreground))',
              }}
              className="hidden sm:inline-flex border-transparent"
            >
              {school.modules[0].abbreviation}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StageColumn({
  stage,
  schools,
  isOverlay,
}: {
  stage: OnboardingStage;
  schools: School[];
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage.id, data: { type: 'COLUMN', stage } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging && !isOverlay ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="h-full w-72 flex-shrink-0">
      <Card
        className={cn(
          'h-full flex flex-col bg-card border-t-4 transition-all duration-200 ease-in-out'
        )}
        style={{ borderTopColor: stage.color || 'hsl(var(--border))' }}
      >
        <CardHeader className="p-3 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              {...attributes}
              {...listeners}
              className="cursor-grab h-8 w-8 p-0"
            >
              <GripVertical className="h-5 w-5 text-muted-foreground" />
            </Button>
            <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
          </div>
          <Badge variant="secondary">{schools.length}</Badge>
        </CardHeader>
        <ScrollArea className="flex-grow">
          <CardContent className={cn('p-3 transition-colors')}>
            <SortableContext
              items={schools.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              {schools.map((school) => (
                <SchoolCard key={school.id} school={school} />
              ))}
            </SortableContext>
          </CardContent>
        </ScrollArea>
      </Card>
    </div>
  );
}

export default function KanbanBoard() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { assignedUserId, isLoading: isLoadingFilter } = useGlobalFilter();

  const stagesQuery = useMemoFirebase(
    () =>
      firestore
        ? query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc'))
        : null,
    [firestore]
  );
  const { data: stages, isLoading: isLoadingStages } =
    useCollection<OnboardingStage>(stagesQuery);

  const schoolsCol = useMemoFirebase(
    () => (firestore ? collection(firestore, 'schools') : null),
    [firestore]
  );
  const { data: allSchools, isLoading: isLoadingSchools } =
    useCollection<School>(schoolsCol);

  const [activeElement, setActiveElement] = React.useState<
    School | OnboardingStage | null
  >(null);
  const [orderedStages, setOrderedStages] = React.useState<OnboardingStage[]>([]);
  const [schoolsByStage, setSchoolsByStage] = React.useState<
    Record<string, School[]>
  >({});
  const initialSchoolsByStage = React.useRef<Record<string, School[]>>({});

  const filteredSchools = React.useMemo(() => {
    if (!allSchools) return [];
    if (!assignedUserId) return allSchools;
    if (assignedUserId === 'unassigned') {
      return allSchools.filter((school) => !school.assignedTo?.userId);
    }
    return allSchools.filter(
      (school) => school.assignedTo?.userId === assignedUserId
    );
  }, [allSchools, assignedUserId]);

  React.useEffect(() => {
    if (stages) {
      setOrderedStages(stages);
    }
  }, [stages]);

  React.useEffect(() => {
    if (orderedStages.length > 0 && filteredSchools) {
      const grouped: Record<string, School[]> = {};
      orderedStages.forEach((stage) => {
        grouped[stage.id] = [];
      });
      filteredSchools.forEach((school) => {
        const stageId = school.stage?.id || orderedStages[0]?.id;
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(school);
        } else if (orderedStages.length > 0 && grouped[orderedStages[0].id]) {
          grouped[orderedStages[0].id].push(school);
        }
      });
      setSchoolsByStage(grouped);
      initialSchoolsByStage.current = grouped;
    }
  }, [orderedStages, filteredSchools]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const findContainer = React.useCallback(
    (id: string) => {
      if (orderedStages.some((s) => s.id === id)) {
        return id;
      }
      for (const stageId in schoolsByStage) {
        if (schoolsByStage[stageId].some((s) => s.id === id)) {
          return stageId;
        }
      }
      return null;
    },
    [orderedStages, schoolsByStage]
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
    if (!over || active.id === over.id || active.data.current?.type !== 'SCHOOL') {
      return;
    }

    const activeContainer = findContainer(active.id as string);
    const overContainer = findContainer(over.id as string);

    if (!activeContainer || !overContainer) {
      return;
    }

    if (activeContainer !== overContainer) {
      setSchoolsByStage((prev) => {
        const activeItems = prev[activeContainer];
        const overItems = prev[overContainer];
        const activeIndex = activeItems.findIndex((item) => item.id === active.id);
        const overIndex = overItems.findIndex((item) => item.id === over.id);

        let newIndexInOverContainer;
        if (over.data.current?.type === 'COLUMN') {
          newIndexInOverContainer = overItems.length;
        } else {
          newIndexInOverContainer = overIndex >= 0 ? overIndex : overItems.length;
        }

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
    } else {
      // Reordering within the same column
      const items = schoolsByStage[activeContainer];
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      if (oldIndex !== newIndex && oldIndex !== -1 && newIndex !== -1) {
        setSchoolsByStage((prev) => ({
          ...prev,
          [activeContainer]: arrayMove(prev[activeContainer], oldIndex, newIndex),
        }));
      }
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

    if (
      active.data.current?.type === 'COLUMN' &&
      over.data.current?.type === 'COLUMN' &&
      active.id !== over.id
    ) {
      const oldIndex = orderedStages.findIndex((s) => s.id === active.id);
      const newIndex = orderedStages.findIndex((s) => s.id === over.id);

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(orderedStages, oldIndex, newIndex);
        setOrderedStages(reordered);

        const batch = writeBatch(firestore);
        reordered.forEach((stage, index) => {
          const stageRef = doc(firestore, 'onboardingStages', stage.id);
          batch.update(stageRef, { order: index + 1 });
        });
        try {
          await batch.commit();
          toast({ title: 'Stages Reordered' });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: 'Failed to reorder stages.',
          });
          setOrderedStages(stages || []);
        }
      }
    } else if (
      active.data.current?.type === 'SCHOOL' &&
      activeContainer !== overContainer &&
      overContainer
    ) {
      const schoolId = active.id as string;
      const newStage = orderedStages.find((s) => s.id === overContainer);

      if (newStage) {
        const schoolRef = doc(firestore, 'schools', schoolId);
        try {
          await updateDoc(schoolRef, {
            stage: {
              id: newStage.id,
              name: newStage.name,
              order: newStage.order,
              color: newStage.color,
            },
          });
          toast({
            title: 'School Moved',
            description: `Moved to "${newStage.name}" stage.`,
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Update failed',
            description: 'Could not move the school to the new stage.',
          });
          setSchoolsByStage(initialSchoolsByStage.current);
        }
      }
    }
  };

  const handleDragCancel = () => {
    setActiveElement(null);
    setSchoolsByStage(initialSchoolsByStage.current);
  };
  
  const isLoading = isLoadingSchools || isLoadingStages || isLoadingFilter;

  if (isLoading) {
    return (
      <div className="flex h-full gap-4 px-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-72 space-y-4">
            <Skeleton className="h-8 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!orderedStages || orderedStages.length === 0) {
    return (
      <div className="text-center p-8">
        <p className="text-muted-foreground">
          No onboarding stages have been configured.
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Go to "Edit Stages" to create your pipeline.
        </p>
      </div>
    );
  }

  if (isMobile) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-8">
          {orderedStages.map((stage) => (
            <div key={stage.id}>
              <h2 className="font-bold mb-3">
                {stage.name}{' '}
                <Badge variant="secondary">
                  {schoolsByStage[stage.id]?.length || 0}
                </Badge>
              </h2>
              <div className="space-y-3">
                {(schoolsByStage[stage.id] || []).map((school) => (
                  <SchoolCard key={school.id} school={school} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  const activeIsColumn = activeElement && 'order' in activeElement;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      collisionDetection={closestCorners}
    >
      <ScrollArea className="h-full whitespace-nowrap">
        <div className="flex h-full gap-4 p-4">
          <SortableContext
            items={orderedStages.map((s) => s.id)}
            strategy={horizontalListSortingStrategy}
          >
            {orderedStages.map((stage) => (
              <StageColumn
                key={stage.id}
                stage={stage}
                schools={schoolsByStage[stage.id] || []}
              />
            ))}
          </SortableContext>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <DragOverlay>
        {activeElement ? (
          activeIsColumn ? (
            <StageColumn
              stage={activeElement as OnboardingStage}
              schools={
                schoolsByStage[(activeElement as OnboardingStage).id] || []
              }
              isOverlay
            />
          ) : (
            <div className="shadow-2xl rounded-lg transform -rotate-3 transition-transform">
              <SchoolCard school={activeElement as School} />
            </div>
          )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
