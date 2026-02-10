
'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  collection,
  orderBy,
  query,
  doc,
  writeBatch,
  addDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Module } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GripVertical, Plus, Trash2, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

function SortableModuleItem({ module, onDelete, isEditing, onToggleEdit, onFieldChange, editValues, saveChanges }: {
  module: Module;
  onDelete: (module: Module) => void;
  isEditing: boolean;
  onToggleEdit: (module: Module) => void;
  onFieldChange: (field: 'name' | 'description', value: string) => void;
  editValues: { name: string; description: string };
  saveChanges: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: module.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2 bg-background p-3 border rounded-md">
      <Button variant="ghost" size="icon" className="cursor-grab h-9 w-9 mt-1 shrink-0" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </Button>
      
      <div className="flex-grow space-y-2">
          {isEditing ? (
            <Input
              value={editValues.name}
              onChange={(e) => onFieldChange('name', e.target.value)}
              onBlur={saveChanges}
              onKeyDown={(e) => e.key === 'Enter' && saveChanges()}
              autoFocus
              className="font-medium"
            />
          ) : (
            <span className="font-medium block py-2 px-3" onDoubleClick={() => onToggleEdit(module)}>{module.name}</span>
          )}
          {isEditing ? (
             <Textarea
              value={editValues.description}
              onChange={(e) => onFieldChange('description', e.target.value)}
              onBlur={saveChanges}
              placeholder="Module description..."
              className="text-sm"
            />
          ) : (
             <p className="text-sm text-muted-foreground px-3">{module.description || 'No description.'}</p>
          )}

      </div>
      
      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10 shrink-0" onClick={() => onDelete(module)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function ModuleEditor() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const modulesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'modules'), orderBy('order', 'asc'));
  }, [firestore]);
  const { data: modules, isLoading } = useCollection<Module>(modulesQuery);
  
  const [localModules, setLocalModules] = React.useState<Module[]>([]);
  const [newModuleName, setNewModuleName] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);

  const [editingModuleId, setEditingModuleId] = React.useState<string | null>(null);
  const [editValues, setEditValues] = React.useState({ name: '', description: '' });

  const [moduleToDelete, setModuleToDelete] = React.useState<Module | null>(null);

  React.useEffect(() => {
    if (modules) {
      setLocalModules(modules);
    }
  }, [modules]);
  
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !firestore) return;
    
    const reorderedModules = arrayMove(localModules, localModules.findIndex(s => s.id === active.id), localModules.findIndex(s => s.id === over.id));
    setLocalModules(reorderedModules);

    const batch = writeBatch(firestore);
    reorderedModules.forEach((module, index) => {
      const moduleRef = doc(firestore, 'modules', module.id);
      batch.update(moduleRef, { order: index });
    });

    try {
      await batch.commit();
      toast({ title: 'Modules Reordered', description: 'The display order has been updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reorder modules.' });
      setLocalModules(modules || []);
    }
  };

  const handleAddModule = async () => {
    if (!newModuleName.trim() || !firestore) return;
    setIsAdding(true);
    const maxOrder = localModules.reduce((max, s) => Math.max(max, s.order), -1);
    const newModule = { name: newModuleName.trim(), description: '', order: maxOrder + 1 };

    try {
      await addDoc(collection(firestore, 'modules'), newModule);
      setNewModuleName('');
      toast({ title: 'Module Added', description: `"${newModule.name}" has been added.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add module.' });
    } finally {
      setIsAdding(false);
    }
  };
  
  const handleDeleteModule = async () => {
    if (!moduleToDelete || !firestore) return;
    
    try {
      await deleteDoc(doc(firestore, 'modules', moduleToDelete.id));
      toast({ title: 'Module Deleted', description: `"${moduleToDelete.name}" was deleted.`});
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete module.' });
    } finally {
        setModuleToDelete(null);
    }
  };

  const handleSaveChanges = async () => {
    if (!editingModuleId || !editValues.name.trim() || !firestore) {
        setEditingModuleId(null);
        return;
    };
    
    const moduleToUpdate = localModules.find(s => s.id === editingModuleId);
    if (!moduleToUpdate || (moduleToUpdate.name === editValues.name.trim() && moduleToUpdate.description === editValues.description.trim())) {
        setEditingModuleId(null);
        return;
    }

    const newName = editValues.name.trim();
    const newDescription = editValues.description.trim();
    const moduleRef = doc(firestore, 'modules', editingModuleId);
    
    try {
        await updateDoc(moduleRef, { name: newName, description: newDescription });
        toast({ title: 'Module Updated' });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to update module.' });
    } finally {
        setEditingModuleId(null);
    }
  };
  
  return (
    <>
        <Card>
            <CardHeader>
                <CardTitle>Module Management</CardTitle>
                <CardDescription>
                Manage the available SmartSapp modules. Drag to reorder, double-click to edit.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
                ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localModules.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {localModules.map((module) => (
                            <SortableModuleItem
                                key={module.id}
                                module={module}
                                isEditing={editingModuleId === module.id}
                                editValues={editValues}
                                onToggleEdit={(mod) => {
                                    setEditingModuleId(mod.id);
                                    setEditValues({ name: mod.name, description: mod.description || '' });
                                }}
                                onFieldChange={(field, value) => setEditValues(prev => ({...prev, [field]: value}))}
                                saveChanges={handleSaveChanges}
                                onDelete={setModuleToDelete}
                            />
                        ))}
                    </div>
                    </SortableContext>
                </DndContext>
                )}
                <div className="flex gap-2 pt-4">
                <Input
                    placeholder="New module name..."
                    value={newModuleName}
                    onChange={(e) => setNewModuleName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddModule()}
                />
                <Button onClick={handleAddModule} disabled={isAdding}>
                    {isAdding ? <Loader2 className="animate-spin" /> : <Plus />}
                    <span className="ml-2">Add Module</span>
                </Button>
                </div>
            </CardContent>
        </Card>
        <AlertDialog open={!!moduleToDelete} onOpenChange={(open) => !open && setModuleToDelete(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This will permanently delete the module "{moduleToDelete?.name}". This action cannot be undone.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteModule}>Delete</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
}
