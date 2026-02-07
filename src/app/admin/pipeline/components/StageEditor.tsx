
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
  where,
  getDocs,
  addDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { OnboardingStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GripVertical, Plus, Trash2, Loader2, Save } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';


function SortableStageItem({ stage, onRename, onDelete, isEditing, onToggleEdit, onNameChange, newName, saveRename }: {
  stage: OnboardingStage;
  onRename: (id: string, newName: string) => void;
  onDelete: (id: string) => void;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  newName: string;
  saveRename: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-background p-2 border rounded-md">
      <Button variant="ghost" size="icon" className="cursor-grab h-8 w-8" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </Button>
      {isEditing ? (
        <Input
          value={newName}
          onChange={onNameChange}
          onBlur={saveRename}
          onKeyDown={(e) => e.key === 'Enter' && saveRename()}
          autoFocus
        />
      ) : (
        <span className="flex-grow font-medium" onDoubleClick={() => onToggleEdit(stage.id)}>{stage.name}</span>
      )}
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
    </div>
  );
}

export default function StageEditor() {
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc'));
  }, [firestore]);
  const { data: stages, isLoading } = useCollection<OnboardingStage>(stagesQuery);
  
  const [localStages, setLocalStages] = React.useState<OnboardingStage[]>([]);
  const [newStageName, setNewStageName] = React.useState('');
  const [isAdding, setIsAdding] = React.useState(false);
  const [editingStageId, setEditingStageId] = React.useState<string | null>(null);
  const [editingStageName, setEditingStageName] = React.useState('');
  const [stageToDelete, setStageToDelete] = React.useState<OnboardingStage | null>(null);

  React.useEffect(() => {
    if (stages) {
      setLocalStages(stages);
    }
  }, [stages]);
  
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    
    const oldIndex = localStages.findIndex((s) => s.id === active.id);
    const newIndex = localStages.findIndex((s) => s.id === over.id);
    const reorderedStages = arrayMove(localStages, oldIndex, newIndex);
    
    setLocalStages(reorderedStages);

    const batch = writeBatch(firestore);
    reorderedStages.forEach((stage, index) => {
      const stageRef = doc(firestore, 'onboardingStages', stage.id);
      batch.update(stageRef, { order: index + 1 });
    });

    try {
      await batch.commit();
      toast({ title: 'Stages Reordered', description: 'The pipeline order has been updated.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to reorder stages.' });
      setLocalStages(stages || []); // Revert on failure
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim() || !firestore) return;
    setIsAdding(true);
    const maxOrder = localStages.reduce((max, s) => Math.max(max, s.order), 0);
    const newStage = { name: newStageName.trim(), order: maxOrder + 1 };

    try {
      await addDoc(collection(firestore, 'onboardingStages'), newStage);
      setNewStageName('');
      toast({ title: 'Stage Added', description: `"${newStage.name}" has been added to the pipeline.` });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to add stage.' });
    } finally {
      setIsAdding(false);
    }
  };
  
  const handleDeleteStage = async () => {
    if (!stageToDelete || !firestore) return;

    const batch = writeBatch(firestore);
    const schoolsRef = collection(firestore, 'schools');
    const q = query(schoolsRef, where('stage.id', '==', stageToDelete.id));
    
    try {
      // Find all schools in the stage being deleted
      const schoolsToUpdateSnap = await getDocs(q);
      
      // Move them to the 'Welcome' stage
      const welcomeStage = localStages.find(s => s.order === 1) || { id: 'welcome', name: 'Welcome', order: 1 };
      schoolsToUpdateSnap.forEach(schoolDoc => {
        batch.update(schoolDoc.ref, { stage: welcomeStage });
      });
      
      // Delete the stage itself
      const stageRef = doc(firestore, 'onboardingStages', stageToDelete.id);
      batch.delete(stageRef);

      // Re-index remaining stages
      const remainingStages = localStages.filter(s => s.id !== stageToDelete.id);
      remainingStages.forEach((stage, index) => {
          if (stage.order !== index + 1) {
              batch.update(doc(firestore, 'onboardingStages', stage.id), { order: index + 1 });
          }
      });
      
      await batch.commit();
      toast({ title: 'Stage Deleted', description: `"${stageToDelete.name}" was deleted and associated schools were moved to "Welcome".`});
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete stage.' });
    } finally {
        setStageToDelete(null);
    }
  };

  const handleRename = async () => {
    if (!editingStageId || !editingStageName.trim() || !firestore) {
        setEditingStageId(null);
        return;
    };
    
    const stageToUpdate = localStages.find(s => s.id === editingStageId);
    if (!stageToUpdate || stageToUpdate.name === editingStageName.trim()) {
        setEditingStageId(null);
        return;
    }

    const newName = editingStageName.trim();
    const batch = writeBatch(firestore);

    // Update the stage document itself
    const stageRef = doc(firestore, 'onboardingStages', editingStageId);
    batch.update(stageRef, { name: newName });
    
    // Update all schools with the old stage name
    const schoolsRef = collection(firestore, 'schools');
    const q = query(schoolsRef, where('stage.id', '==', editingStageId));
    
    try {
        const schoolsToUpdateSnap = await getDocs(q);
        schoolsToUpdateSnap.forEach(schoolDoc => {
            const currentStage = schoolDoc.data().stage;
            batch.update(schoolDoc.ref, { stage: { ...currentStage, name: newName } });
        });
        
        await batch.commit();
        toast({ title: 'Stage Renamed', description: `"${stageToUpdate.name}" was renamed to "${newName}".`});

    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename stage.' });
    } finally {
        setEditingStageId(null);
    }
  };

  return (
    <AlertDialog>
        <Card>
            <CardHeader>
                <CardTitle>Onboarding Stages</CardTitle>
                <CardDescription>
                Manage the stages of your school onboarding pipeline. Drag to reorder, double-click to rename.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
                ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {localStages.map((stage) => (
                            <SortableStageItem
                                key={stage.id}
                                stage={stage}
                                isEditing={editingStageId === stage.id}
                                newName={editingStageName}
                                onToggleEdit={(id) => {
                                    setEditingStageId(id);
                                    setEditingStageName(stage.name);
                                }}
                                onNameChange={(e) => setEditingStageName(e.target.value)}
                                saveRename={handleRename}
                                onRename={handleRename}
                                onDelete={() => setStageToDelete(stage)}
                            />
                        ))}
                    </div>
                    </SortableContext>
                </DndContext>
                )}
                <div className="flex gap-2 pt-4">
                <Input
                    placeholder="New stage name..."
                    value={newStageName}
                    onChange={(e) => setNewStageName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                />
                <Button onClick={handleAddStage} disabled={isAdding}>
                    {isAdding ? <Loader2 className="animate-spin" /> : <Plus />}
                    <span className="ml-2">Add Stage</span>
                </Button>
                </div>
            </CardContent>
        </Card>
        <AlertDialogContent>
             <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action will delete the stage "{stageToDelete?.name}". All schools currently in this stage will be moved to "{localStages.find(s=>s.order===1)?.name || 'Welcome'}". This cannot be undone.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setStageToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteStage}>Delete</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>
  );
}
