
'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface DraggableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  children: React.ReactNode;
}

export function DraggableCard({ id, children, className }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
  };

  return (
 <div ref={setNodeRef} style={style} className={cn("relative group", className)}>
        <button
            {...attributes}
            {...listeners}
 className="absolute top-4 right-4 z-10 p-1 bg-card/50 rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Drag to reorder"
        >
 <GripVertical className="h-5 w-5" />
        </button>
        {children}
    </div>
  );
}
