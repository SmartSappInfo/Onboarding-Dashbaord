

'use client';

import * as React from 'react';
import { collection, doc, updateDoc, orderBy, query } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, errorEmitter, FirestorePermissionError, useUser } from '@/firebase';
import type { School, OnboardingStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2 } from 'lucide-react';
import { logActivity } from '@/lib/activity-logger';
import { useTenant } from '@/context/TenantContext';

interface ChangeStageModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ChangeStageModal({ school, open, onOpenChange }: ChangeStageModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = React.useState(false);

  const stagesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'onboardingStages'), orderBy('order', 'asc'));
  }, [firestore]);
  const { data: stages, isLoading } = useCollection<OnboardingStage>(stagesQuery);

  const handleStageChange = async (stage: OnboardingStage) => {
    if (!firestore || !school || !user) return;
    setIsUpdating(true);

    const schoolDocRef = doc(firestore, 'schools', school.id);
    const newStageData = { id: stage.id, name: stage.name, order: stage.order, color: stage.color };
    const oldStageName = school.stage?.name || 'an unknown stage';


    try {
      await updateDoc(schoolDocRef, { stage: newStageData });
      
      toast({
        title: 'Stage Updated',
        description: `${school.name} has been moved to the "${stage.name}" stage.`,
      });
      logActivity({
          organizationId: activeOrganizationId,
          schoolId: school.id,
          userId: user.uid,
          workspaceId: school.workspaceIds[0] || 'onboarding',
          type: 'pipeline_stage_changed',
          source: 'user_action',
          description: `moved school "${school.name}" from "${oldStageName}" to "${stage.name}"`,
          metadata: {
              from: oldStageName,
              to: stage.name,
          }
      });
      onOpenChange(false);
    } catch (e) {
        const permissionError = new FirestorePermissionError({
            path: schoolDocRef.path,
            operation: 'update',
            requestResourceData: { stage: newStageData },
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change Onboarding Stage</DialogTitle>
          <DialogDescription>
            Move "{school?.name}" to a new stage in the pipeline.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96 border rounded-md">
          <div className="p-2">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              stages?.map(stage => (
                <button
                  key={stage.id}
                  onClick={() => handleStageChange(stage)}
                  className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-50"
                  disabled={isUpdating || school?.stage?.id === stage.id}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stage.color }} />
                  <span className="font-medium">{stage.name}</span>
                  {school?.stage?.id === stage.id && (
                      <span className="ml-auto text-xs text-muted-foreground">Current</span>
                  )}
                </button>
              ))
            )}
            {!isLoading && (!stages || stages.length === 0) && (
                <p className="text-center text-sm text-muted-foreground p-4">No stages found.</p>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isUpdating}>Cancel</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
