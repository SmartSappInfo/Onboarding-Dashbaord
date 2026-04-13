'use client';

import * as React from 'react';
import { useEditor } from '../EditorContext';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { FieldListItem } from './FieldListItem';

export function SortableFieldList() {
  const { fields, setFields, selectedFieldIds, selectField, namingFieldId, isSidebarCollapsed, setIsFieldDeleteConfirmOpen, updateField } = useEditor();
  
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
 <div className="space-y-1">
          {fields.map((field) => (
            <FieldListItem 
              key={field.id} 
              field={field} 
              isSelected={selectedFieldIds.includes(field.id)} 
              isNamingField={field.id === namingFieldId}
              isCollapsed={isSidebarCollapsed}
              onSelect={(e) => selectField(field.id, e.shiftKey, e.ctrlKey || e.metaKey)}
              onRemove={() => {
                if (!selectedFieldIds.includes(field.id)) {
                  selectField(field.id);
                }
                setIsFieldDeleteConfirmOpen(true);
              }}
              onUpdateLabel={(newLabel) => updateField(field.id, { label: newLabel })}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
