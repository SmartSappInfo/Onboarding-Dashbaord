'use client';

import * as React from 'react';
import { collection, query, orderBy, doc, updateDoc, getDocs, where, limit } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { School, Pipeline, OnboardingStage } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
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
    Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logActivity } from '@/lib/activity-logger';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useTenant } from '@/context/TenantContext';

interface TransferPipelineModalProps {
  school: School | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function TransferPipelineModal({ school, open, onOpenChange }: TransferPipelineModalProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const { activeWorkspaceId } = useWorkspace();
  const { activeOrganizationId } = useTenant();
  
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
    if (!firestore || !school || !user || !targetPipelineId || isUpdating) return;

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

        // 3. Update School Record
        const schoolRef = doc(firestore, 'schools', school.id);
        const targetPipeline = pipelines?.find(p => p.id === targetPipelineId);

        await updateDoc(schoolRef, {
            pipelineId: targetPipelineId,
            stage: { 
                id: firstStage.id, 
                name: firstStage.name, 
                order: firstStage.order, 
                color: firstStage.color 
            },
            updatedAt: new Date().toISOString()
        });

        toast({ 
            title: 'Protocol Transfer Complete', 
            description: `"${school.name}" moved to ${targetPipeline?.name}.` 
        });

        logActivity({
            entityId: school.id,
            userId: user.uid,
            organizationId: activeOrganizationId,
            type: 'pipeline_stage_changed',
            workspaceId: activeWorkspaceId,
            source: 'user_action',
            description: `transferred "${school.name}" to the "${targetPipeline?.name}" workflow`,
            metadata: { pipelineId: targetPipelineId, stageId: firstStage.id }
        });

        onOpenChange(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Transfer Failed', description: e.message });
    } finally {
        setIsUpdating(false);
    }
  };

  if (!school) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-8 bg-muted/30 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary text-white rounded-2xl shadow-xl shadow-primary/20">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <div className="text-left">
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Workflow Migration</DialogTitle>
              <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Transfer institution to another pipeline</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-8 space-y-8 bg-background text-left">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/20 border shadow-inner">
                <div className="p-2 bg-white rounded-xl shadow-sm shrink-0 text-primary">
                    <Building className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest leading-none mb-1">Source Record</p>
                    <p className="text-base font-black uppercase text-foreground truncate">{school.name}</p>
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary ml-1 flex items-center gap-2">
                    <Workflow className="h-3 w-3" /> Target Pipeline
                </Label>
                <Select value={targetPipelineId || ''} onValueChange={setTargetPipelineId}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-none shadow-inner font-bold">
                        <SelectValue placeholder="Select destination..." />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-none shadow-2xl p-2">
                        {pipelines?.filter(p => p.id !== school.pipelineId).map(p => (
                            <SelectItem key={p.id} value={p.id} className="rounded-lg p-3">
                                <div className="flex flex-col">
                                    <span className="font-black uppercase text-xs">{p.name}</span>
                                    <span className="text-[10px] text-muted-foreground font-medium">{p.description}</span>
                                </div>
                            </SelectItem>
                        ))}
                        {pipelines?.filter(p => p.id !== school.pipelineId).length === 0 && (
                            <div className="p-4 text-center text-[10px] font-black uppercase text-muted-foreground opacity-40">No alternate pipelines defined</div>
                        )}
                    </SelectContent>
                </Select>
            </div>

            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-100 flex items-start gap-4">
                <Zap className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-[9px] font-bold text-amber-800 leading-relaxed uppercase tracking-tighter text-left">
                    Transferring a school will reset its position to the first stage of the destination pipeline. Current workflow history is preserved in the audit log.
                </p>
            </div>
        </div>

        <DialogFooter className="p-6 bg-muted/30 border-t flex justify-between items-center sm:justify-between">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isUpdating} className="rounded-xl font-bold h-12 px-8">Discard</Button>
            <Button 
                onClick={handleTransfer} 
                disabled={isUpdating || !targetPipelineId}
                className="rounded-xl font-black h-12 px-10 shadow-2xl bg-primary text-white gap-2 uppercase tracking-widest text-xs"
            >
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Execute Transfer
            </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
