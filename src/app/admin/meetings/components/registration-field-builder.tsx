'use client';

import * as React from 'react';
import { nanoid } from 'nanoid';
import type { MeetingRegistrationField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  Check,
  Type,
  Mail,
  Phone,
  List,
  CheckSquare,
  AlignLeft,
} from 'lucide-react';

const FIELD_TYPE_OPTIONS = [
  { value: 'text', label: 'Text', icon: Type },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'select', label: 'Dropdown', icon: List },
  { value: 'multiselect', label: 'Multi-Select', icon: List },
  { value: 'checkbox', label: 'Checkbox', icon: CheckSquare },
  { value: 'textarea', label: 'Long Text', icon: AlignLeft },
] as const;

function getFieldTypeIcon(type: string) {
  const found = FIELD_TYPE_OPTIONS.find(f => f.value === type);
  return found?.icon || Type;
}

function getFieldTypeBadgeColor(type: string) {
  const map: Record<string, string> = {
    text: 'bg-slate-100 text-slate-700',
    email: 'bg-blue-50 text-blue-700',
    phone: 'bg-green-50 text-green-700',
    select: 'bg-amber-50 text-amber-700',
    multiselect: 'bg-orange-50 text-orange-700',
    checkbox: 'bg-purple-50 text-purple-700',
    textarea: 'bg-pink-50 text-pink-700',
  };
  return map[type] || 'bg-muted text-muted-foreground';
}

interface SortableFieldRowProps {
  field: MeetingRegistrationField;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleRequired: () => void;
  isEditing: boolean;
  editState: Partial<MeetingRegistrationField>;
  onEditChange: (updates: Partial<MeetingRegistrationField>) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}

function SortableFieldRow({
  field,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
  onToggleRequired,
  isEditing,
  editState,
  onEditChange,
  onEditSave,
  onEditCancel,
}: SortableFieldRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = getFieldTypeIcon(field.type);
  const isProtected = ['name', 'email'].includes(field.key);

  if (isEditing) {
    return (
      <div
        ref={setNodeRef}
        style={style}
 className="p-4 bg-primary/5 rounded-xl border-2 border-primary/20 space-y-4 animate-in fade-in"
      >
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label className="text-[9px] font-semibold text-muted-foreground">Label</Label>
            <Input
              value={editState.label || ''}
              onChange={e => onEditChange({ label: e.target.value })}
              placeholder="Field label..."
 className="h-10 rounded-lg text-sm font-bold"
            />
          </div>
 <div className="space-y-1.5">
 <Label className="text-[9px] font-semibold text-muted-foreground">Type</Label>
            <Select
              value={editState.type || 'text'}
              onValueChange={v => onEditChange({ type: v as MeetingRegistrationField['type'] })}
            >
 <SelectTrigger className="h-10 rounded-lg text-sm font-bold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPE_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <div className="space-y-1.5">
 <Label className="text-[9px] font-semibold text-muted-foreground">Placeholder</Label>
            <Input
              value={editState.placeholder || ''}
              onChange={e => onEditChange({ placeholder: e.target.value })}
              placeholder="Placeholder text..."
 className="h-10 rounded-lg text-sm"
            />
          </div>
 <div className="space-y-1.5">
 <Label className="text-[9px] font-semibold text-muted-foreground">Key (slug)</Label>
            <Input
              value={editState.key || ''}
              onChange={e => onEditChange({ key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
              placeholder="field_key"
 className="h-10 rounded-lg text-sm font-mono"
            />
          </div>
        </div>
        {(editState.type === 'select' || editState.type === 'multiselect') && (
 <div className="space-y-1.5">
 <Label className="text-[9px] font-semibold text-muted-foreground">Options (comma-separated)</Label>
            <Input
              value={(editState.options || []).join(', ')}
              onChange={e => onEditChange({ options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Option 1, Option 2, Option 3"
 className="h-10 rounded-lg text-sm"
            />
          </div>
        )}
 <div className="flex items-center justify-between pt-2">
 <div className="flex items-center gap-2">
            <Switch
              checked={editState.required ?? false}
              onCheckedChange={checked => onEditChange({ required: checked })}
              id={`edit-required-${field.id}`}
            />
 <Label htmlFor={`edit-required-${field.id}`} className="text-xs font-bold">Required</Label>
          </div>
 <div className="flex items-center gap-2">
 <Button type="button" variant="ghost" size="sm" onClick={onEditCancel} className="rounded-lg h-8 gap-1 text-xs font-bold">
 <X className="h-3 w-3" /> Cancel
            </Button>
 <Button type="button" size="sm" onClick={onEditSave} className="rounded-lg h-8 gap-1 text-xs font-bold">
 <Check className="h-3 w-3" /> Save
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
 className={cn(
        "flex items-center gap-3 p-3 rounded-xl border bg-background group transition-all",
        isDragging && "opacity-50 shadow-lg ring-2 ring-primary/20",
        "hover:border-primary/20 hover:shadow-sm"
      )}
    >
      {/* Drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
 className="p-1 rounded-md cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0"
      >
 <GripVertical className="h-4 w-4" />
      </button>

      {/* Field icon + label */}
 <div className="flex items-center gap-2.5 flex-1 min-w-0">
 <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
 <span className="text-sm font-bold truncate">{field.label}</span>
        <Badge className={cn("text-[8px] font-semibold uppercase px-1.5 h-4 border-none shrink-0", getFieldTypeBadgeColor(field.type))}>
          {field.type}
        </Badge>
        {field.required && (
          <Badge className="text-[8px] font-semibold uppercase px-1.5 h-4 bg-rose-50 text-rose-600 border-none shrink-0">
            Required
          </Badge>
        )}
      </div>

      {/* Actions */}
 <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
 className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onMoveUp}
          disabled={index === 0}
        >
 <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
 className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={onMoveDown}
          disabled={index === total - 1}
        >
 <ChevronDown className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
 className="h-7 w-7 text-muted-foreground hover:text-primary"
          onClick={onEdit}
        >
 <Pencil className="h-3.5 w-3.5" />
        </Button>
        {!isProtected && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
 className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onDelete}
          >
 <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

interface RegistrationFieldBuilderProps {
  value: MeetingRegistrationField[];
  onChange: (fields: MeetingRegistrationField[]) => void;
}

export default function RegistrationFieldBuilder({ value, onChange }: RegistrationFieldBuilderProps) {
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editState, setEditState] = React.useState<Partial<MeetingRegistrationField>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = value.findIndex(f => f.id === active.id);
      const newIndex = value.findIndex(f => f.id === over.id);
      const reordered = arrayMove(value, oldIndex, newIndex).map((f, i) => ({ ...f, order: i }));
      onChange(reordered);
    }
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const reordered = arrayMove([...value], index, index - 1).map((f, i) => ({ ...f, order: i }));
    onChange(reordered);
  };

  const handleMoveDown = (index: number) => {
    if (index === value.length - 1) return;
    const reordered = arrayMove([...value], index, index + 1).map((f, i) => ({ ...f, order: i }));
    onChange(reordered);
  };

  const handleAddField = () => {
    const newField: MeetingRegistrationField = {
      id: nanoid(8),
      key: `custom_field_${value.length}`,
      label: 'New Field',
      type: 'text',
      required: false,
      placeholder: '',
      order: value.length,
    };
    onChange([...value, newField]);
    setEditingId(newField.id);
    setEditState(newField);
  };

  const handleStartEdit = (field: MeetingRegistrationField) => {
    setEditingId(field.id);
    setEditState({ ...field });
  };

  const handleEditSave = () => {
    if (!editingId) return;
    const updated = value.map(f =>
      f.id === editingId ? { ...f, ...editState } : f
    );
    onChange(updated);
    setEditingId(null);
    setEditState({});
  };

  const handleEditCancel = () => {
    // If it's a brand new field with default label, remove it
    const field = value.find(f => f.id === editingId);
    if (field && field.label === 'New Field' && editState.label === 'New Field') {
      onChange(value.filter(f => f.id !== editingId));
    }
    setEditingId(null);
    setEditState({});
  };

  const handleDelete = (id: string) => {
    const updated = value.filter(f => f.id !== id).map((f, i) => ({ ...f, order: i }));
    onChange(updated);
  };

  const handleToggleRequired = (id: string) => {
    const updated = value.map(f =>
      f.id === id ? { ...f, required: !f.required } : f
    );
    onChange(updated);
  };

  return (
 <div className="space-y-3">
 <div className="flex items-center justify-between">
 <Label className="text-[10px] font-semibold text-muted-foreground/60 ml-1">
          Registration Fields
        </Label>
        <Badge variant="secondary" className="text-[9px] font-bold h-5">
          {value.length} field{value.length !== 1 ? 's' : ''}
        </Badge>
      </div>

 <Card className="border-dashed border-2 rounded-xl overflow-hidden">
 <CardContent className="p-3 space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={value.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              {value.map((field, index) => (
                <SortableFieldRow
                  key={field.id}
                  field={field}
                  index={index}
                  total={value.length}
                  onMoveUp={() => handleMoveUp(index)}
                  onMoveDown={() => handleMoveDown(index)}
                  onEdit={() => handleStartEdit(field)}
                  onDelete={() => handleDelete(field.id)}
                  onToggleRequired={() => handleToggleRequired(field.id)}
                  isEditing={editingId === field.id}
                  editState={editState}
                  onEditChange={updates => setEditState(prev => ({ ...prev, ...updates }))}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                />
              ))}
            </SortableContext>
          </DndContext>

          <Button
            type="button"
            variant="outline"
            onClick={handleAddField}
 className="w-full rounded-xl h-10 border-dashed font-bold gap-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
          >
 <Plus className="h-4 w-4" />
            Add Custom Field
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
