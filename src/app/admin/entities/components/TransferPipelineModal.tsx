'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, updateDoc, getDocs, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { WorkspaceEntity, Pipeline, OnboardingStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogDescription, 
    DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
    Workflow, 
    ArrowRightLeft, 
    Loader2, 
    ShieldCheck,
    Building,
    Check,
    Zap,
    Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activity-logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';
import { useTerminology } from '@/hooks/use-terminology';

interface TransferPipelineModalProps {
  entity: WorkspaceEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransferPipelineModal({ entity, open, onOpenChange }: TransferPipelineModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId, activeWorkspace } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  const { singular } = useTerminology();
  
  const [targetPipelineId, setTargetPipelineId] = React.useState<string | null>(null);
  const [isUpdating, setIsUpdating] = React.useState(false);

  // 1. Fetch Available Pipelines - Restricted to active workspace tracks
  const pipelinesQuery = useMemoFirebase(() => 
    firestore && activeWorkspaceId ? query(
        collection(firestore, 'pipelines'), 
        where('workspaceIds', 'array-contains', activeWorkspaceId),
        orderBy('name', 'asc')
    ) : null, 
  [firestore, activeWorkspaceId]);
  const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<Pipeline>(pipelinesQuery);

  const handleTransfer = async () => {
    if (!firestore || !entity || !user || !targetPipelineId || isUpdating) return;

    setIsUpdating(true);
    try {
        // 2. Resolve the initial stage of the target pipeline
        const stagesRef = collection(firestore, 'onboardingStages');
        const stagesQuery = query(
            stagesRef, 
            where('pipelineId', '==', targetPipelineId), 
            orderBy('order', 'asc'),
            limit(1)
        );
        const stagesSnap = await getDocs(stagesQuery);
        
        if (stagesSnap.empty) throw new Error("Target pipeline has no defined stages.");
        
        const firstStageDoc = stagesSnap.docs[0];
        const firstStage = { id: firstStageDoc.id, ...firstStageDoc.data() } as OnboardingStage;

        // 3. Update Workspace Entity Record
        const weRef = doc(firestore, 'workspace_entities', entity.id);
        const targetPipeline = pipelines?.find(p => p.id === targetPipelineId);

        await updateDoc(weRef, {
            pipelineId: targetPipelineId,
            stageId: firstStage.id,
            currentStageName: firstStage.name,
            updatedAt: new Date().toISOString()
        });

        toast({ 
            title: 'Protocol Transfer Complete', 
            description: `"${entity.displayName}" moved to ${targetPipeline?.name}.` 
        });

        logActivity({
            entityId: entity.entityId,
            userId: user.uid,
            organizationId: activeOrganizationId,
            type: 'pipeline_stage_changed',
            workspaceId: activeWorkspaceId,
            source: 'user_action',
            description: `transferred ${singular.toLowerCase()} "${entity.displayName}" to the "${targetPipeline?.name}" workflow`,
            metadata: { pipelineId: targetPipelineId, stageId: firstStage.id }
        });

        onOpenChange(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Transfer Failed', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  };

  if (!entity) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
 <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
 <DialogHeader className="p-8 bg-emerald-500/10 border-b border-emerald-500/20 shrink-0 text-left">
 <div className="flex items-center gap-4">
 <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-500/20">
 <Zap className="h-6 w-6" />
                </div>
 <div className="text-left">
 <DialogTitle className="text-xl font-semibold tracking-tight text-emerald-500">Pipeline Transfer</DialogTitle>
 <DialogDescription className="text-xs font-bold text-emerald-400 opacity-70">Elevate {entity.displayName} to new workflow</DialogDescription>
                </div>
            </div>
        </DialogHeader>

 <div className="p-8 space-y-8 bg-background text-left">
 <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border shadow-inner">
 <div className="p-2 bg-card rounded-xl shadow-sm shrink-0 text-primary">
 <Building className="h-5 w-5" />
                </div>
 <div className="min-w-0 flex-1">
 <p className="text-[10px] font-semibold text-muted-foreground leading-none mb-1">Target Record</p>
 <p className="text-base font-semibold text-foreground truncate">{entity.displayName}</p>
                </div>
            </div>

 <div className="space-y-4">
 <Label className="text-[10px] font-semibold text-primary ml-1 flex items-center gap-2">
 <Workflow className="h-3 w-3" /> Select Integration Pipeline
                </Label>
                
 <div className="space-y-2">
                    {isLoadingPipelines ? (
 <Skeleton className="h-12 w-full rounded-xl" />
                    ) : pipelines?.filter(p => p.id !== entity.pipelineId).map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setTargetPipelineId(p.id)}
 className={cn(
                                "w-full flex flex-col items-start p-4 rounded-2xl border-2 transition-all text-left",
                                targetPipelineId === p.id ? "bg-primary/10 border-primary shadow-md" : "bg-card/50 border-transparent hover:bg-muted/30"
                            )}
                        >
 <div className="flex items-center justify-between w-full mb-1">
 <span className={cn("font-semibold text-xs", targetPipelineId === p.id ? "text-primary" : "text-foreground")}>{p.name}</span>
 {targetPipelineId === p.id && <Check className="h-4 w-4 text-primary animate-in zoom-in" />}
                            </div>
 <p className="text-[10px] text-muted-foreground font-medium line-clamp-1">{p.description}</p>
                        </button>
                    ))}
                    {!isLoadingPipelines && (!pipelines || pipelines.length <= 1) && (
 <p className="text-center text-[10px] font-semibold text-muted-foreground p-10 opacity-30 italic">No alternative pipelines available.</p>
                    )}
                </div>
            </div>

 <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-3 mt-4">
 <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
 <p className="text-[9px] font-bold text-blue-500 leading-relaxed tracking-tighter text-left">
                    Pipeline structures are specific to this workspace. Workflow state is tracked independently per hub.
                </p>
            </div>
        </div>

 <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
 <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUpdating} className="rounded-xl font-bold h-12 px-8">Discard</Button>
            <Button 
                onClick={handleTransfer} 
                disabled={isUpdating || !targetPipelineId}
 className="rounded-xl font-semibold h-12 px-10 shadow-2xl bg-primary text-white gap-2 text-xs"
            >
 {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Execute Transfer
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
