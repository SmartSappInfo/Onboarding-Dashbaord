
'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection,
  orderBy,
  query,
  doc,
  writeBatch,
  where,
  getDocs,
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
import { User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

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

function StageColumn({ stage, schools }: { stage: OnboardingStage; schools: School[] }) {
    const { setNodeRef } = useSortable({ id: stage.id, data: { type: 'COLUMN', stage }});

    return (
        <div ref={setNodeRef} className="h-full w-72 flex-shrink-0">
            <Card className="h-full flex flex-col bg-muted/50">
                <CardHeader className="p-3 border-b">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <span>{stage.name}</span>
                        <Badge variant="secondary">{schools.length}</Badge>
                    </CardTitle>
                </CardHeader>
                <ScrollArea className="flex-grow">
                    <CardContent className="p-3">
                         <SortableContext items={schools.map(s => s.id)}>
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
  
  const [activeSchool, setActiveSchool] = React.useState<School | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    })
  );

  const schoolsByStage = React.useMemo(() => {
    const grouped: Record<string, School[]> = {};
    if (stages) {
      stages.forEach(stage => {
        grouped[stage.id] = [];
      });
    }
    if (schools) {
      schools.forEach(school => {
        const stageId = school.stage?.id || 'welcome';
        if (grouped[stageId]) {
          grouped[stageId].push(school);
        } else if (grouped['welcome']) {
           grouped['welcome'].push(school);
        }
      });
    }
    return grouped;
  }, [stages, schools]);
  
  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'SCHOOL') {
      setActiveSchool(event.active.data.current.school);
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveSchool(null);
    const { active, over } = event;

    if (!over || active.id === over.id || !active.data.current || !over.data.current) return;

    const isSchoolDrag = active.data.current.type === 'SCHOOL';
    const isOverColumn = over.data.current.type === 'COLUMN';

    if (isSchoolDrag && isOverColumn) {
        const schoolId = active.id as string;
        const newStage = over.data.current.stage as OnboardingStage;
        
        const schoolRef = doc(firestore, 'schools', schoolId);
        
        try {
            await updateDoc(schoolRef, { stage: { id: newStage.id, name: newStage.name, order: newStage.order } });
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
  
  if (!stages || stages.length === 0) {
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
          {stages.map(stage => (
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

  // Desktop Kanban View
  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveSchool(null)}
    >
      <ScrollArea className="h-full whitespace-nowrap">
        <div className="flex h-full gap-4 p-4">
          <SortableContext items={stages.map(s => s.id)}>
              {stages.map(stage => (
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
        {activeSchool ? <SchoolCard school={activeSchool} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
