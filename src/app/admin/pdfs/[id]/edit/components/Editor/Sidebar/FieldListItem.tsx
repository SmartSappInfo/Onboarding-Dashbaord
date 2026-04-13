'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { GripVertical, Trash2, Key, Text, Signature, Calendar, ChevronDownSquare, Phone, Mail, Clock, Camera, Tag } from 'lucide-react';
import { PDFFormField } from '@/lib/types';

const fieldIcons: Record<PDFFormField['type'], React.ElementType> = {
  text: Text, 
  signature: Signature, 
  date: Calendar, 
  dropdown: ChevronDownSquare, 
  phone: Phone, 
  email: Mail, 
  time: Clock, 
  photo: Camera,
  'static-text': Tag
};

export function FieldListItem({ field, isSelected, isNamingField, onSelect, onRemove, onUpdateLabel, isCollapsed }: { 
  field: PDFFormField; 
  isSelected: boolean; 
  isNamingField: boolean;
  onSelect: (e: React.MouseEvent) => void; 
  onRemove: () => void;
  onUpdateLabel: (newLabel: string) => void;
  isCollapsed: boolean;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(field.label || '');
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: field.id });
  
  // Fallback to Text icon if type is not found in the map to prevent crashes
  const Icon = fieldIcons[field.type] || Text;
  
  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleBlur = () => { setIsEditing(false); if (editValue.trim() !== field.label) onUpdateLabel(editValue.trim()); };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); handleBlur(); }
    if (e.key === 'Escape') { setEditValue(field.label || ''); setIsEditing(false); }
  };

  if (isCollapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
 <div ref={setNodeRef} style={style} className={cn("flex items-center justify-center p-2 rounded-md hover:bg-muted cursor-pointer transition-all", isSelected && 'bg-primary/10 ring-1 ring-primary')} onClick={onSelect}>
 <Icon className={cn("h-5 w-5", isSelected ? 'text-primary' : 'text-muted-foreground')} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right"><p>{field.label || field.id}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
 <div ref={setNodeRef} style={style} className="flex items-center gap-1 group">
 <button {...attributes} {...listeners} type="button" className="cursor-grab p-1 hover:bg-muted rounded text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical className="h-3 w-3" /></button>
      <div 
 className={cn("w-full text-left p-2 rounded-md flex items-center gap-2 hover:bg-muted transition-colors cursor-pointer", isSelected && 'bg-muted ring-1 ring-primary')}
        onClick={onSelect}
        onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
      >
 <Icon className="h-4 w-4 text-muted-foreground" />
        {isEditing ? (
 <Input autoFocus value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={handleBlur} onKeyDown={handleKeyDown} className="h-6 text-sm px-1 py-0 flex-1" onClick={(e) => e.stopPropagation()} />
        ) : (
 <span className="truncate text-sm flex-1">{field.label || field.id}</span>
        )}
 {isNamingField && <Key className="h-3 w-3 text-primary shrink-0" />}
 {field.required && <span className="text-destructive font-bold">*</span>}
      </div>
 <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}
