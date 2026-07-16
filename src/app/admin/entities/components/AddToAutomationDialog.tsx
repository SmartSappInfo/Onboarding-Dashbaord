'use client';

import * as React from 'react';
import { collection, query, where } from 'firebase/firestore';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { enrollContactsInAutomationAction } from '@/lib/automation-actions';
import type { Automation } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Sparkles, AlertCircle, PlayCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTerminology } from '@/hooks/use-terminology';

interface AddToAutomationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityIds: string[];
  workspaceId: string;
  onComplete?: () => void;
}

export function AddToAutomationDialog({
  open,
  onOpenChange,
  entityIds,
  workspaceId,
  onComplete,
}: AddToAutomationDialogProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const firestore = useFirestore();
  const { singular, plural } = useTerminology();

  const [selectedAutomationId, setSelectedAutomationId] = React.useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // 1. Query automations for the workspace
  const automationsQuery = React.useMemo(() => {
    if (!firestore || !workspaceId) return null;
    // Bypasses composite index requirements by filtering archived/active status in-memory
    return query(
      collection(firestore, 'automations'),
      where('workspaceIds', 'array-contains', workspaceId)
    );
  }, [firestore, workspaceId]);

  const { data: rawAutomations, loading: isLoading } = useCollection<Automation>(automationsQuery);

  // 2. Filter active and unarchived automations in-memory to prevent composite index errors
  const activeAutomations = React.useMemo(() => {
    if (!rawAutomations) return [];
    return rawAutomations.filter((a) => a.isActive && !a.isArchived);
  }, [rawAutomations]);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setSelectedAutomationId(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleConfirm = async () => {
    if (!selectedAutomationId || !user) return;
    setIsSubmitting(true);

    try {
      const selectedAutomation = activeAutomations.find((a) => a.id === selectedAutomationId);
      const automationName = selectedAutomation?.name || 'Automation';

      const result = await enrollContactsInAutomationAction(
        entityIds,
        selectedAutomationId,
        workspaceId,
        user.uid
      );

      if (result.success) {
        toast({
          title: 'Direct Enrollment Scheduled',
          description: `Successfully enqueued ${result.enrolledCount ?? entityIds.length} ${
            entityIds.length === 1 ? singular : plural
          } into "${automationName}".`,
        });
        onComplete?.();
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: 'Enrollment Failed',
          description: result.error || 'Failed to enroll contacts. Please try again.',
        });
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: errMsg || 'An unexpected error occurred during direct enrollment.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const entityLabel = entityIds.length === 1 ? singular : plural;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-[95vw] rounded-2xl border-none bg-slate-900 text-slate-100 p-6 shadow-2xl overflow-hidden focus:outline-none">
        <DialogHeader className="space-y-2 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-xl text-primary animate-pulse">
              <Sparkles className="h-4 w-4" />
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-white">
              Direct Automation Enrollment
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-400 font-medium leading-relaxed mt-1">
            Enroll selected {entityLabel} directly into any active automation. This bypasses the trigger condition entirely and initiates the first workflow step immediately.
          </DialogDescription>
        </DialogHeader>

        <div className="my-5 space-y-4">
          {/* Target Summary Card */}
          <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Targets</span>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-primary bg-primary/10 px-2.5 py-1 rounded-lg">
                {entityIds.length}
              </span>
              <span className="text-xs font-bold text-slate-200">{entityLabel}</span>
            </div>
          </div>

          {/* Automation Selector */}
          <div className="space-y-1.5 text-left">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-1">
              Select Automation
            </label>

            {isLoading ? (
              <div className="flex items-center justify-center p-6 border border-dashed border-slate-800 rounded-xl bg-slate-950/20">
                <Loader2 className="h-5 w-5 text-primary animate-spin" />
              </div>
            ) : activeAutomations.length === 0 ? (
              <div className="flex items-center gap-2.5 p-4 border border-dashed border-amber-500/30 rounded-xl bg-amber-500/5 text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <p className="text-xs font-bold leading-normal">
                  No active automations found for this workspace. Create or activate one first.
                </p>
              </div>
            ) : (
              <Select
                value={selectedAutomationId || undefined}
                onValueChange={setSelectedAutomationId}
              >
                <SelectTrigger className="w-full h-11 px-3.5 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-200 focus:ring-2 focus:ring-primary focus:border-transparent text-sm font-semibold transition-all">
                  <SelectValue placeholder="Choose an active automation program..." />
                </SelectTrigger>
                <SelectContent className="max-h-56 bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-1 shadow-xl">
                  <ScrollArea className="h-full max-h-48 overflow-y-auto">
                    {activeAutomations.map((automation) => (
                      <SelectItem
                        key={automation.id}
                        value={automation.id}
                        className="rounded-lg p-2.5 font-semibold text-xs cursor-pointer hover:bg-slate-800 focus:bg-slate-800 focus:text-white transition-colors"
                      >
                        {automation.name}
                      </SelectItem>
                    ))}
                  </ScrollArea>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2.5 mt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 text-xs font-bold active:scale-[0.97] transition-all duration-150 ease-out"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedAutomationId || isSubmitting}
            className="flex-1 h-11 rounded-xl bg-primary text-white hover:bg-primary/90 text-xs font-bold active:scale-[0.97] transition-all duration-150 ease-out gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Enrolling...
              </>
            ) : (
              <>
                <PlayCircle className="h-4 w-4" />
                Enroll Targets
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
