

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
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove, horizontalListSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
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

const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <User size={12} />;

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
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="mb-3 touch-manipulation"
    >
      <CardHeader className="p-4">
        <CardTitle className="text-sm font-medium">{school.name}</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                    <AvatarImage src={school.assignedTo?.email || ''} alt={school.assignedTo?.name || ''} />
                    <AvatarFallback className="text-xs">{getInitials(school.assignedTo?.name)}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{school.assignedTo?.name || 'Unassigned'}</span>
            </div>
            {school.modules && (
              <Badge variant="secondary" className="hidden sm:inline-flex">{school.modules.split(',')[0].trim()}</Badge>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function StageColumn({ stage, schools, isOverlay }: { stage: OnboardingStage; schools: School[], isOverlay?: boolean }) {
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
                className="h-full flex flex-col bg-card border-t-4"
                style={{ borderTopColor: stage.color || 'hsl(var(--border))' }}
            >
                <CardHeader className="p-3 border-b flex flex-row items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Button variant="ghost" {...attributes} {...listeners} className="cursor-grab h-8 w-8 p-0">
                           <GripVertical className="h-5 w-5 text-muted-foreground" />
                        </Button>
                        <CardTitle className="text-sm font-medium">{stage.name}</CardTitle>
                    </div>
                    <Badge variant="secondary">{schools.length}</Badge>
                </CardHeader>
                <ScrollArea className="flex-grow">
                    <CardContent className="p-3">
                         <SortableContext items={schools.map(s => s.id)} strategy={verticalListSortingStrategy}>
                            {schools.map(school => (
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

  // Data fetching
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc'));
  }, [firestore]);
  const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);
  
  const schoolsCol = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'schools');
  }, [firestore]);
  const { data: schools, isLoading: isLoadingSchools } = useCollection<School>(schoolsCol);
  
  const [activeElement, setActiveElement] = React.useState<School | OnboardingStage | null>(null);
  const [orderedStages, setOrderedStages] = React.useState<OnboardingStage[]>([]);

  React.useEffect(() => {
      if (stages) {
          setOrderedStages(stages);
      }
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const schoolsByStage = React.useMemo(() => {
    const grouped: Record<string, School[]> = {};
    if (orderedStages) {
      orderedStages.forEach(stage => {
        grouped[stage.id] = [];
      });
    }
    if (schools) {
      schools.forEach(school => {
        const stageId = school.stage?.id || orderedStages[0]?.id;
        if (stageId && grouped[stageId]) {
          grouped[stageId].push(school);
        } else if (orderedStages.length > 0 && grouped[orderedStages[0].id]) {
           grouped[orderedStages[0].id].push(school);
        }
      });
    }
    return grouped;
  }, [orderedStages, schools]);
  
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === 'SCHOOL') {
      setActiveElement(active.data.current.school);
    }
    if (active.data.current?.type === 'COLUMN') {
      setActiveElement(active.data.current.stage);
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveElement(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;
    
    const activeType = active.data.current?.type;

    if (activeType === 'COLUMN' && over.data.current?.type === 'COLUMN') {
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
                toast({ variant: 'destructive', title: 'Error', description: 'Failed to reorder stages.' });
                setOrderedStages(stages || []); // Revert on failure
            }
        }
    }

    if (activeType === 'SCHOOL' && over.data.current?.type === 'COLUMN') {
        const schoolId = active.id as string;
        const newStage = over.data.current.stage as OnboardingStage;
        
        const schoolRef = doc(firestore, 'schools', schoolId);
        
        try {
            await updateDoc(schoolRef, { stage: { id: newStage.id, name: newStage.name, order: newStage.order, color: newStage.color } });
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'Update failed',
                description: 'Could not move the school to the new stage.'
            });
        }
    }
  };

  if (isLoadingSchools || isLoadingStages) {
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
              <p className="text-muted-foreground">No onboarding stages have been configured.</p>
              <p className="text-sm text-muted-foreground mt-2">Go to "Edit Stages" to create your pipeline.</p>
          </div>
      )
  }

  // Mobile View
  if (isMobile) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-8">
          {orderedStages.map(stage => (
            <div key={stage.id}>
              <h2 className="font-bold mb-3">{stage.name} <Badge variant="secondary">{schoolsByStage[stage.id]?.length || 0}</Badge></h2>
              <div className="space-y-3">
                {(schoolsByStage[stage.id] || []).map(school => (
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

  // Desktop Kanban View
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveElement(null)}
    >
      <ScrollArea className="h-full whitespace-nowrap">
        <div className="flex h-full gap-4 p-4">
          <SortableContext items={orderedStages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
              {orderedStages.map(stage => (
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
                <StageColumn stage={activeElement as OnboardingStage} schools={schoolsByStage[(activeElement as OnboardingStage).id] || []} isOverlay />
            ) : (
                <SchoolCard school={activeElement as School} />
            )
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
