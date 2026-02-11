

'use client';

import * as React from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { School, OnboardingStage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User, GripVertical } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';


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
      className="mb-3 touch-manipulation bg-card"
    >
      <CardHeader 
        {...attributes} 
        {...listeners} 
        className="p-4 flex flex-row items-center gap-3 space-y-0 cursor-grab"
      >
        <Avatar className="h-8 w-8">
            <AvatarImage src={school.logoUrl} alt={school.name} />
            <AvatarFallback className="text-xs">{getInitials(school.name)}</AvatarFallback>
        </Avatar>
        <CardTitle className="text-sm font-medium flex-1">{school.name}</CardTitle>
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
            {school.modules && school.modules.length > 0 && (
              <Badge style={{ backgroundColor: school.modules[0].color, color: 'hsl(var(--primary-foreground))' }} className="hidden sm:inline-flex border-transparent">{school.modules[0].abbreviation}</Badge>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

function StageColumn({ stage, schools, isOverlay, isHovered }: { stage: OnboardingStage; schools: School[], isOverlay?: boolean, isHovered?: boolean }) {
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
                    <CardContent className={cn("p-3 transition-colors", isHovered && "bg-accent")}>
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

export default StageColumn;
