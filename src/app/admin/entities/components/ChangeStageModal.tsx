'use client';

import * as React from 'react';
import { collection, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { WorkspaceEntity, OnboardingStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { logActivity } from '@/lib/activity-logger';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';
import { Badge } from '@/components/ui/badge';

interface ChangeStageModalProps {
  entity: WorkspaceEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangeStageModal({ entity, open, onOpenChange }: ChangeStageModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const { singular } = useTerminology();
  const [isUpdating, setIsUpdating] = React.useState(false);

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc'));
  }, [firestore]);
  const { data: stages, isLoading } = useCollection<OnboardingStage>(stagesQuery);

  const handleStageChange = async (stage: OnboardingStage) => {
    if (!firestore || !entity || !user) return;
    setIsUpdating(true);

    const weDocRef = doc(firestore, 'workspace_entities', entity.id);
    const oldStageName = entity.currentStageName || 'an unknown stage';

    try {
      await updateDoc(weDocRef, { 
        stageId: stage.id, 
        currentStageName: stage.name,
        updatedAt: new Date().toISOString()
      });
      
      toast({
        title: 'Stage Updated',
        description: `${entity.displayName} has been moved to the "${stage.name}" stage.`,
      });
      logActivity({
          organizationId: activeOrganizationId,
          entityId: entity.entityId,
          userId: user.uid,
          workspaceId: entity.workspaceId,
          type: 'pipeline_stage_changed',
          source: 'user_action',
          description: `moved ${singular.toLowerCase()} "${entity.displayName}" from "${oldStageName}" to "${stage.name}"`,
          metadata: {
              from: oldStageName,
              to: stage.name,
          }
      });
      onOpenChange(false);
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            path: weDocRef.path,
            operation: 'update',
            requestResourceData: { stageId: stage.id, currentStageName: stage.name },
        });
        errorEmitter.emit('permission-error', permissionError);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'You may not have the required permissions to change the stage.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
 <DialogHeader className="p-8 bg-muted/30 border-b shrink-0 text-left">
 <div className="flex flex-col text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight">Change Pipeline Stage</DialogTitle>
 <DialogDescription className="text-xs font-bold text-muted-foreground mt-1">
              Move "{entity?.displayName}" to a new phase
            </DialogDescription>
          </div>
        </DialogHeader>
 <div className="p-6 bg-background">
 <ScrollArea className="h-96 border-2 border-dashed rounded-2xl bg-background">
 <div className="p-2 space-y-1">
              {isLoading ? (
 <div className="space-y-2 p-2">
                  {Array.from({ length: 5 }).map((_, i) => (
 <Skeleton key={i} className="h-12 w-full rounded-xl" />
                  ))}
                </div>
              ) : (
                stages?.map(stage => (
                  <button
                    key={stage.id}
                    onClick={() => handleStageChange(stage)}
 className="w-full text-left flex items-center gap-4 p-4 rounded-xl hover:bg-card hover:shadow-md transition-all group disabled:opacity-50"
                    disabled={isUpdating || entity?.stageId === stage.id}
                  >
 <div className="w-4 h-4 rounded-full shadow-inner" style={{ backgroundColor: stage.color }} />
 <span className="font-semibold text-xs text-foreground/80 group-hover:text-primary transition-colors">{stage.name}</span>
                    {entity?.stageId === stage.id && (
                        <Badge variant="secondary" className="ml-auto text-[8px] font-semibold uppercase bg-primary/10 text-primary">Current</Badge>
                    )}
                  </button>
                ))
              )}
              {!isLoading && (!stages || stages.length === 0) && (
 <p className="text-center text-[10px] font-semibold text-muted-foreground p-20 opacity-30 italic">No stages found.</p>
              )}
            </div>
          </ScrollArea>
        </div>
 <DialogFooter className="p-4 bg-muted/30 border-t shrink-0 flex justify-end gap-3">
 <div className="flex items-center gap-2 text-primary font-semibold text-[10px] animate-pulse px-4">
 {isUpdating && <><Loader2 className="h-3 w-3 animate-spin"/> Updating Stage...</>}
            </div>
 <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUpdating} className="rounded-xl font-bold h-11 px-8">Discard</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
