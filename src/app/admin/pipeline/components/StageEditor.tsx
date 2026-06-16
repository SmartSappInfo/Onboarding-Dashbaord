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
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 bg-muted/10 dark:bg-muted/5 p-3 border border-border/80 rounded-xl hover:bg-muted/20 dark:hover:bg-muted/10 hover:border-primary/20 hover:scale-[1.01] hover:shadow-sm transition-all duration-200 group">
      <Button variant="ghost" size="icon" className="cursor-grab h-8 w-8 text-muted-foreground/30 hover:text-primary transition-colors" {...attributes} {...listeners}>
        <GripVertical className="h-5 w-5" />
      </Button>
      
      <Popover>
        <PopoverTrigger asChild>
 <Button variant="outline" className="w-8 h-8 p-0 border-2 shrink-0" style={{ borderColor: stage.color || '#ccc' }}>
 <div className="w-full h-full rounded-sm" style={{ backgroundColor: stage.color || '#FFFFFF' }} />
            </Button>
        </PopoverTrigger>
    <PopoverContent className="w-auto p-3 rounded-xl bg-popover border border-border shadow-md" align="start">
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
            className="h-9 rounded-xl border border-border bg-background shadow-sm text-xs font-semibold px-3 focus:ring-1 focus:ring-primary/20 transition-all"
          />
        ) : (
 <div className="flex items-center gap-3 min-w-0 flex-1">
 <span className="font-semibold text-xs truncate block" onDoubleClick={() => onToggleEdit(stage.id)}>{stage.name}</span>
            <Badge 
              variant="outline" 
              className={cn(
                "h-5 px-1.5 font-bold uppercase tracking-wider text-[9px] shrink-0 border transition-all",
                count > 0 ? "bg-primary/5 text-primary border-primary/20" : "bg-muted text-muted-foreground border-border/80"
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
  
  const { data: stages, isLoading: isLoadingStages } = useCollection<OnboardingStage>(stagesQuery);
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

  // TODO: Stage counts need to be refactored for Deal-based pipeline (currently
  // always empty — the WorkspaceEntity stageId source was removed). Kept as a
  // stable empty map so render sites are unchanged.
  const stageCounts = React.useMemo<Record<string, number>>(() => ({}), []);
  
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
      <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/5 text-primary shrink-0"><Workflow size={18} /></div>
            <CardTitle className="text-sm font-semibold text-foreground">Stage Architect</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {isLoadingStages ? (
            <div className="space-y-3 animate-pulse">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
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
            <div className="py-12 text-center border border-dashed border-border rounded-xl bg-muted/5 flex flex-col items-center justify-center text-muted-foreground gap-2">
              <Workflow className="h-8 w-8 text-muted-foreground/50 animate-pulse" />
              <p className="text-xs font-semibold">No stages defined</p>
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t border-dashed border-border/60">
            <Input
              placeholder="Initialize new stage..."
              value={newStageName}
              onChange={(e) => setNewStageName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddStage()}
              className="h-10 rounded-xl border border-border bg-background shadow-sm text-xs px-4 focus:ring-1 focus:ring-primary/20 transition-all font-medium"
            />
            <Button onClick={handleAddStage} disabled={isAdding || !newStageName.trim()} className="h-10 rounded-xl font-bold text-xs bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98] gap-2 flex items-center justify-center px-4 shrink-0">
              {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Add Stage
            </Button>
          </div>
        </CardContent>
      </Card>
    <AlertDialog open={!!stageToDelete} onOpenChange={(open) => !open && setStageToDelete(null)}>
      <AlertDialogContent className="rounded-2xl border border-border bg-card shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-bold text-lg tracking-tight text-foreground flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Purge Workflow Stage?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs font-medium text-muted-foreground text-left leading-relaxed mt-2">
            You are about to delete <span className="font-bold text-foreground">"{stageToDelete?.name}"</span>. 
            <br/><br/>
            {stageCounts[stageToDelete?.id || ''] > 0 ? (
              <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/10 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-semibold leading-relaxed">
                  WARNING: There are {stageCounts[stageToDelete?.id || '']} schools in this stage. 
                  They will be reset to the primary entry stage (order 1).
                </p>
              </div>
            ) : (
              "This stage is currently empty and can be safely removed."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-end gap-2 mt-4">
          <AlertDialogCancel className="rounded-xl h-10 px-4 text-xs font-semibold border border-border bg-background hover:bg-muted/50 transition-colors">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDeleteStage} className="rounded-xl h-10 px-4 text-xs font-bold bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg shadow-destructive/20 transition-all active:scale-[0.98]">Confirm Deletion</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}