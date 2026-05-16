
'use client';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as React from 'react';

interface DraggableCardProps extends React.HTMLAttributes<HTMLDivElement> {
  id: string;
  children: React.ReactNode;
  disabled?: boolean;
  index?: number;
}

export function DraggableCard({ id, children, className, disabled, index = 0 }: DraggableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 'auto',
    animationDelay: `${index * 100}ms`
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={cn("relative group animate-in fade-in slide-in-from-bottom-4 fill-mode-backwards duration-500", className)}
    >
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="absolute top-4 right-4 z-10 p-1.5 bg-background/60 backdrop-blur-md rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 transition-all hover:bg-background/80 hover:text-foreground cursor-grab focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring shadow-sm"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {children}
    </div>
  );
}
