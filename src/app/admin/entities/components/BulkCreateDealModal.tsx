'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Info } from 'lucide-react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { bulkCreateDealsAction } from '@/app/actions/bulk-deal-actions';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';

interface BulkCreateDealModalProps {
  entityIds: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export default function BulkCreateDealModal({
  entityIds,
  open,
  onOpenChange,
  onComplete,
}: BulkCreateDealModalProps) {
  const { toast } = useToast();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const firestore = useFirestore();

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [dealNamePattern, setDealNamePattern] = React.useState('{{entityName}} - Onboarding Deal');
  const [value, setValue] = React.useState('');
  const [pipelineId, setPipelineId] = React.useState('');
  const [assignmentStrategy, setAssignmentStrategy] = React.useState<'direct' | 'unassigned'>('direct');

  // Fetch pipelines for current workspace
  const pipelinesQuery = useMemoFirebase(() =>
    firestore && activeWorkspaceId
      ? query(
          collection(firestore, 'pipelines'),
          where('workspaceIds', 'array-contains', activeWorkspaceId),
          orderBy('createdAt', 'desc')
        )
      : null,
    [firestore, activeWorkspaceId]
  );
  
  const { data: pipelines, isLoading: isLoadingPipelines } = useCollection<any>(pipelinesQuery);

  React.useEffect(() => {
    if (open) {
      setDealNamePattern('{{entityName}} - Onboarding Deal');
      setValue('');
      setAssignmentStrategy('direct');
      if (pipelines && pipelines.length > 0) {
        setPipelineId(pipelines[0].id);
      }
    }
  }, [open, pipelines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealNamePattern || !pipelineId || entityIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const result = await bulkCreateDealsAction({
        entityIds,
        workspaceId: activeWorkspaceId!,
        organizationId: activeOrganizationId!,
        pipelineId,
        dealNamePattern,
        value: parseFloat(value) || 0,
        assignmentStrategy,
      });

      if (result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Bulk Deals Initiated',
        description: `Successfully created ${result.count} deals across selected entities.`,
      });
      onOpenChange(false);
      onComplete?.();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Bulk Deal Creation Failed',
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px] rounded-2xl p-0 border-none shadow-2xl overflow-hidden bg-card text-left">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="p-6 bg-card/50 backdrop-blur-xl border-b border-border/10 shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight">Initiate Bulk Deals</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground mt-1.5">
              Launch operational pipeline tracks for the{' '}
              <span className="text-primary font-mono">{entityIds.length}</span> selected records.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="deal-pattern" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Deal Name Template
              </Label>
              <Input
                id="deal-pattern"
                required
                value={dealNamePattern}
                onChange={e => setDealNamePattern(e.target.value)}
                placeholder="e.g. {{entityName}} - 2026 Expansion"
                className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
              />
              <div className="flex gap-1.5 p-2.5 rounded-lg bg-primary/5 text-primary text-[10px] font-bold mt-1">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Tip: Use <code>{"{{entityName}}"}</code> to dynamically inject each record's name.</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="deal-value" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Est. Value ($)
                </Label>
                <Input
                  id="deal-value"
                  type="number"
                  min="0"
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder="0"
                  className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deal-pipeline" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                  Pipeline
                </Label>
                <Select value={pipelineId} onValueChange={setPipelineId} disabled={isLoadingPipelines}>
                  <SelectTrigger id="deal-pipeline" className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner text-xs">
                    <SelectValue placeholder="Select Pipeline" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-none shadow-xl">
                    {pipelines?.map((p: any) => (
                      <SelectItem key={p.id} value={p.id} className="font-bold text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deal-routing" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">
                Assignment Routing
              </Label>
              <Select value={assignmentStrategy} onValueChange={(v: any) => setAssignmentStrategy(v)}>
                <SelectTrigger id="deal-routing" className="h-10 rounded-xl font-bold bg-muted/20 border-primary/10 shadow-inner text-xs">
                  <SelectValue placeholder="Select Routing Logic" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-none shadow-xl">
                  <SelectItem value="direct" className="font-bold text-xs">
                    Direct (Match Account Owner)
                  </SelectItem>
                  <SelectItem value="unassigned" className="font-bold text-xs">
                    Leave Unassigned
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/10 border-t border-border/10 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="rounded-xl font-bold h-10 px-6 hover:bg-rose-50 hover:text-rose-600 transition-colors"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !dealNamePattern || !pipelineId}
              className="rounded-xl font-bold h-10 px-8 shadow-md transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" /> Create Deals
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
