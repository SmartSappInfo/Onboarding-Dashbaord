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
import type { OnboardingStage, WorkspaceEntity } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { GripVertical, Plus, Trash2, Loader2, Pencil, Users, Workflow, AlertCircle } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ONBOARDING_STAGE_COLORS } from '@/lib/colors';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useWorkspace } from '@/context/WorkspaceContext';

interface StageEditorProps {
    pipelineId: string;
}

function SortableStageItem({ stage, count, onDelete, isEditing, onToggleEdit, onNameChange, newName, saveRename, onColorChange }: {
  stage: OnboardingStage;
  count: number;
  onDelete: (stage: OnboardingStage) => void;
  isEditing: boolean;
  onToggleEdit: (id: string) => void;
  onNameChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  newName: string;
  saveRename: () => void;
  onColorChange: (id: string, color: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-background p-3 border rounded-xl shadow-sm hover:shadow-md transition-shadow group">
      <Button variant="ghost" size="icon" className="cursor-grab h-8 w-8 text-muted-foreground/30 hover:text-primary" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
            <Button variant="outline" className="w-8 h-8 p-0 border-2 shrink-0" style={{ borderColor: stage.color || '#ccc' }}>
                <div className="w-full h-full rounded-sm" style={{ backgroundColor: stage.color || '#FFFFFF' }} />
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
            <div className="grid grid-cols-6 gap-1 mb-2">
                {ONBOARDING_STAGE_COLORS.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className={cn("w-6 h-6 rounded-md border transition-transform hover:scale-110", color === stage.color && 'ring-2 ring-ring ring-offset-2 ring-offset-background')}
                        style={{ backgroundColor: color }}
                        onClick={() => onColorChange(stage.id, color)}
                    />
                ))}
            </div>
             <div className="flex items-center gap-2 border-t pt-2">
              <label htmlFor={`color-picker-${stage.id}`} className="text-sm font-medium">Custom</label>
              <Input
                id={`color-picker-${stage.id}`}
                type="color"
                value={stage.color || '#FFFFFF'}
                onChange={(e) => onColorChange(stage.id, e.target.value)}
                className="w-10 h-10 p-1"
              />
            </div>
        </PopoverContent>
      </Popover>

      <div className="flex-grow flex items-center min-w-0">
        {isEditing ? (
            <Input
            value={newName}
            onChange={onNameChange}
            onBlur={saveRename}
            onKeyDown={(e) => e.key === 'Enter' && saveRename()}
            autoFocus
            className="h-9 font-bold"
            />
        ) : (
            <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="font-black text-xs uppercase truncate block" onDoubleClick={() => onToggleEdit(stage.id)}>{stage.name}</span>
                <Badge 
                    variant="outline" 
                    className={cn(
                        "h-5 px-1.5 font-black tabular-nums border-none shadow-inner shrink-0",
                        count > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground opacity-40"
                    )}
                >
                    <Users className="h-2.5 w-2.5 mr-1" />
                    {count}
                </Badge>
            </div>
        )}
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={() => onToggleEdit(stage.id)}>
            <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg" onClick={() => onDelete(stage)}>
            <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function StageEditor({ pipelineId }: StageEditorProps) {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  
  // 1. Fetch Stages
  const stagesQuery = useMemoFirebase(() => {
    if (!firestore || !pipelineId) return null;
    return query(
        collection(firestore, 'onboardingStages'), 
        where('pipelineId', '==', pipelineId),
        orderBy('order', 'asc')
    );
  }, [firestore, pipelineId]);
  
  // 2. Entities to calculate density
  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !pipelineId) return null;
    return query(
        collection(firestore, 'workspace_entities'),
        where('workspaceId', '==', activeWorkspaceId),
        where('pipelineId', '==', pipelineId)
    );
  }, [firestore, pipelineId, activeWorkspaceId]);

  const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);
  const { data: entities } = useCollection<WorkspaceEntity>(entitiesQuery);
  
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

  // Calculate lead counts per stage
  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    if (entities) {
        entities.forEach(s => {
            if (s.stageId) {
                counts[s.stageId] = (counts[s.stageId] || 0) + 1;
            }
        });
    }
    return counts;
  }, [entities]);
  
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !firestore) return;
    
    const reorderedStages = arrayMove(localStages, localStages.findIndex(s => s.id === active.id), localStages.findIndex(s => s.id === over.id));
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
      setLocalStages(stages || []);
    }
  };

  const handleAddStage = async () => {
    if (!newStageName.trim() || !firestore || !pipelineId) return;
    setIsAdding(true);
    const maxOrder = localStages.reduce((max, s) => Math.max(max, s.order), 0);
    const newStage = { 
        name: newStageName.trim(), 
        order: maxOrder + 1, 
        color: ONBOARDING_STAGE_COLORS[Math.floor(Math.random() * ONBOARDING_STAGE_COLORS.length)],
        pipelineId
    };

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
    const entitiesRef = collection(firestore, 'workspace_entities');
    const q = query(entitiesRef, where('workspaceId', '==', activeWorkspaceId), where('stageId', '==', stageToDelete.id));
    
    try {
      const entitiesToUpdateSnap = await getDocs(q);
      const welcomeStageId = localStages.find(s => s.order === 1)?.id || 'welcome';
      const welcomeStageName = localStages.find(s => s.order === 1)?.name || 'Welcome';
      
      entitiesToUpdateSnap.forEach(entityDoc => {
        batch.update(entityDoc.ref, { 
            stageId: welcomeStageId, 
            currentStageName: welcomeStageName,
            updatedAt: new Date().toISOString() 
        });
      });
      
      const stageRef = doc(firestore, 'onboardingStages', stageToDelete.id);
      batch.delete(stageRef);

      const remainingStages = localStages.filter(s => s.id !== stageToDelete.id);
      remainingStages.forEach((stage, index) => {
          if (stage.order !== index + 1) {
              batch.update(doc(firestore, 'onboardingStages', stage.id), { order: index + 1 });
          }
      });
      
      await batch.commit();
      toast({ title: 'Stage Deleted', description: `"${stageToDelete.name}" was deleted and affected schools were moved.`});
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

    const stageRef = doc(firestore, 'onboardingStages', editingStageId);
    batch.update(stageRef, { name: newName });
    
    const entitiesRef = collection(firestore, 'workspace_entities');
    const q = query(entitiesRef, where('workspaceId', '==', activeWorkspaceId), where('stageId', '==', editingStageId));
    
    try {
        const entitiesToUpdateSnap = await getDocs(q);
        entitiesToUpdateSnap.forEach(entityDoc => {
            batch.update(entityDoc.ref, { 
                currentStageName: newName,
                updatedAt: new Date().toISOString()
            });
        });
        
        await batch.commit();
        toast({ title: 'Stage Renamed', description: `"${stageToUpdate.name}" was renamed to "${newName}".`});

    } catch (error) {
        toast({ variant: 'destructive', title: 'Error', description: 'Failed to rename stage.' });
    } finally {
        setEditingStageId(null);
    }
  };
  
  const handleColorChange = async (id: string, color: string) => {
      if (!firestore) return;
      const stageRef = doc(firestore, 'onboardingStages', id);
      try {
          await updateDoc(stageRef, { color });
      } catch (error) {
          toast({ variant: 'destructive', title: 'Error', description: 'Failed to update stage color.' });
      }
  };

  return (
    <>
        <Card className="glass-card rounded-2xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b pb-6">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-foreground">Stage Architect</CardTitle>
                <CardDescription className="text-xs font-medium">Define the progression nodes. Double-click to rename.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {isLoadingStages ? (
                <div className="space-y-3">
                    <Skeleton className="h-14 w-full rounded-xl" />
                    <Skeleton className="h-14 w-full rounded-xl" />
                </div>
                ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={localStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                        {localStages.map((stage) => (
                            <SortableStageItem
                                key={stage.id}
                                stage={stage}
                                count={stageCounts[stage.id] || 0}
                                isEditing={editingStageId === stage.id}
                                newName={editingStageName}
                                onToggleEdit={(id) => {
                                    setEditingStageId(id);
                                    setEditingStageName(stage.name);
                                }}
                                onNameChange={(e) => setEditingStageName(e.target.value)}
                                saveRename={handleRename}
                                onColorChange={handleColorChange}
                                onDelete={setStageToDelete}
                            />
                        ))}
                    </div>
                    </SortableContext>
                </DndContext>
                )}
                
                {localStages.length === 0 && !isLoadingStages && (
                    <div className="py-12 text-center border-2 border-dashed rounded-xl opacity-20 text-left">
                        <Workflow className="h-10 w-10 mx-auto mb-2" />
                        <p className="text-[10px] font-black uppercase tracking-widest">No stages defined</p>
                    </div>
                )}

                <div className="flex gap-2 pt-4 border-t border-dashed">
                    <Input
                        placeholder="Initialize new stage..."
                        value={newStageName}
                        onChange={(e) => setNewStageName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
                        className="h-11 rounded-xl bg-muted/20 border-none shadow-none focus:ring-1 focus:ring-primary/20 font-bold"
                    />
                    <Button onClick={handleAddStage} disabled={isAdding || !newStageName.trim()} className="h-11 rounded-xl font-bold shadow-lg gap-2">
                        {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Add Stage
                    </Button>
                </div>
            </CardContent>
        </Card>
        <AlertDialog open={!!stageToDelete} onOpenChange={(open) => !open && setStageToDelete(null)}>
          <AlertDialogContent className="rounded-[2rem]">
              <AlertDialogHeader>
                  <AlertDialogTitle className="font-black uppercase tracking-tight">Purge Workflow Stage?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-medium text-left">
                      You are about to delete <span className="font-bold text-foreground">"{stageToDelete?.name}"</span>. 
                      <br/><br/>
                      {stageCounts[stageToDelete?.id || ''] > 0 ? (
                          <div className="p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3">
                              <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                              <p className="text-[11px] text-rose-900 font-bold uppercase leading-relaxed">
                                  WARNING: There are {stageCounts[stageToDelete?.id || '']} schools in this stage. 
                                  They will be reset to the primary entry stage (order 1).
                              </p>
                          </div>
                      ) : (
                          "This stage is currently empty and can be safely removed."
                      )}
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="sm:justify-center gap-3">
                  <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDeleteStage} className="rounded-xl font-black bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-xl">Confirm Deletion</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
    </>
  );
}