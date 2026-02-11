

'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import type { School } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


const getInitials = (name?: string | null) => name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : <User size={12} />;

export default function SchoolCard({ school }: { school: School }) {
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
