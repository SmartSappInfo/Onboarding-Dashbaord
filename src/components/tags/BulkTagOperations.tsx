'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { bulkApplyTagsAction, bulkRemoveTagsAction } from '@/lib/tag-actions';
import { checkTagAutomations } from '@/lib/automations/checkTagAutomations';
import { useToast } from '@/hooks/use-toast';
import { useTerminology } from '@/hooks/use-terminology';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TagSelector } from './TagSelector';

interface BulkTagOperationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  contactType: 'school' | 'prospect' | 'workspace_entity' | 'entity';
  onComplete?: () => void;
}

export function BulkTagOperations({
  open,
  onOpenChange,
  selectedContactIds,
  contactType,
  onComplete,
}: BulkTagOperationsProps) {
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace() as { activeWorkspaceId: string; activeOrganizationId: string };
  const { toast } = useToast();
  const { singular, plural } = useTerminology();

  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; count: number; partialFailures?: number } | null>(null);

  // Automation trigger awareness
  const [automationMatches, setAutomationMatches] = useState<Array<{
    automationId: string;
    automationName: string;
    tagId: string;
    enrollOnce: boolean;
  }>>([]);

  const handleClose = () => {
    if (isProcessing) return;
    onOpenChange(false);
    setTimeout(() => {
      setOperation('add');
      setSelectedTagIds([]);
      setResult(null);
      setProgress(0);
    }, 200);
  };

  // Check if selected tags trigger automations (only for "add" operation)
  useEffect(() => {
    if (operation !== 'add' || selectedTagIds.length === 0 || !activeWorkspaceId) {
      setAutomationMatches([]);
      return;
    }

    let cancelled = false;
    checkTagAutomations(selectedTagIds, activeWorkspaceId)
      .then((matches) => { if (!cancelled) setAutomationMatches(matches); })
      .catch(() => { if (!cancelled) setAutomationMatches([]); });

    return () => { cancelled = true; };
  }, [selectedTagIds, operation, activeWorkspaceId]);

  const handleExecute = async () => {
    if (!user || selectedTagIds.length === 0 || selectedContactIds.length === 0) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      let res;
      if (operation === 'add') {
        res = await bulkApplyTagsAction(
          selectedContactIds,
          contactType,
          selectedTagIds,
          user.uid,
          user.displayName || undefined
        );
      } else {
        res = await bulkRemoveTagsAction(
          selectedContactIds,
          contactType,
          selectedTagIds,
          user.uid,
          user.displayName || undefined
        );
      }

      setProgress(100);

      if (res.success) {
        const partialFailures = (res as { partialFailures?: any[] }).partialFailures?.length ?? 0;
        setResult({ success: true, count: res.processedCount || selectedContactIds.length, partialFailures });
        toast({
          title: 'Operation Complete',
          description: `${operation === 'add' ? 'Applied' : 'Removed'} tags ${operation === 'add' ? 'to' : 'from'} ${res.processedCount} ${res.processedCount === 1 ? singular.toLowerCase() : plural.toLowerCase()}.${partialFailures > 0 ? ` ${partialFailures} ${partialFailures === 1 ? singular.toLowerCase() : plural.toLowerCase()} could not be updated.` : ''}`,
        });
        onComplete?.();
      } else {
        setResult({ success: false, count: 0 });
        toast({ variant: 'destructive', title: 'Operation Failed', description: (res as { error?: string }).error || 'Unknown error' });
      }
    } catch (err: unknown) {
      setResult({ success: false, count: 0 });
      toast({ variant: 'destructive', title: 'Error', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] overflow-hidden gap-0 p-0 border-border/40">
        <DialogHeader className="p-5 pb-4 border-b border-border/20 bg-muted/10">
          <DialogTitle className="font-black uppercase tracking-tight text-lg">Bulk Tag Operations</DialogTitle>
          <DialogDescription className="text-xs font-semibold text-muted-foreground mt-1">
            Apply or remove tags across multiple {plural.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>

        <div className="p-5">
          {result ? (
            <div className="py-6 text-center space-y-4 animate-in fade-in zoom-in duration-200">
              {result.success ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
                  <div>
                    <p className="font-black text-lg uppercase tracking-tight">Operation Complete</p>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                      Successfully updated {result.count} {result.count === 1 ? singular.toLowerCase() : plural.toLowerCase()}.
                    </p>
                    {result.partialFailures ? (
                      <p className="text-[10px] text-destructive/80 font-bold mt-2 bg-destructive/10 inline-block px-2 py-1 rounded-md">
                        {result.partialFailures} failed to update
                      </p>
                    ) : null}
                    
                    {operation === 'add' && automationMatches.length > 0 && (
                      <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-left flex items-start gap-3">
                        <Zap className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                        <span className="text-xs font-semibold text-amber-700 dark:text-amber-400">
                          {[...new Set(automationMatches.map(m => m.automationId))].length} automation{[...new Set(automationMatches.map(m => m.automationId))].length !== 1 ? 's' : ''} triggered — processing in background
                        </span>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
                  <div>
                    <p className="font-black text-lg uppercase tracking-tight">Operation Failed</p>
                    <p className="text-sm text-muted-foreground font-medium mt-1">Please try again.</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Operation type */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">Operation</Label>
                <RadioGroup
                  value={operation}
                  onValueChange={v => setOperation(v as 'add' | 'remove')}
                  className="flex gap-4"
                >
                  <div className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer flex-1 transition-colors",
                    operation === 'add' ? "border-primary bg-primary/5" : "border-border"
                  )}>
                    <RadioGroupItem value="add" id="op-add" />
                    <Label htmlFor="op-add" className="cursor-pointer font-bold text-sm">Add Tags</Label>
                  </div>
                  <div className={cn(
                    "flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer flex-1 transition-colors",
                    operation === 'remove' ? "border-destructive bg-destructive/5" : "border-border"
                  )}>
                    <RadioGroupItem value="remove" id="op-remove" />
                    <Label htmlFor="op-remove" className="cursor-pointer font-bold text-sm">Remove Tags</Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Tag selection using TagSelector component */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Tags
                </Label>
                <div className="min-h-[44px] p-2 bg-muted/20 border border-border/40 rounded-xl">
                  <TagSelector
                    currentTagIds={selectedTagIds}
                    onTagsChange={setSelectedTagIds}
                  />
                </div>
              </div>

              {/* Operation summary */}
              <div className="p-3 bg-muted/30 rounded-xl text-xs font-medium text-muted-foreground">
                {operation === 'add' ? 'Will add' : 'Will remove'}{' '}
                <span className="font-black text-foreground">{selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''}</span>{' '}
                {operation === 'add' ? 'to' : 'from'}{' '}
                <span className="font-black text-foreground">{selectedContactIds.length} {selectedContactIds.length === 1 ? singular.toLowerCase() : plural.toLowerCase()}</span>
              </div>

              {/* Automation trigger warning */}
              {operation === 'add' && automationMatches.length > 0 && !isProcessing && !result && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <Zap className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-400">
                      {[...new Set(automationMatches.map(m => m.automationId))].length} automation{[...new Set(automationMatches.map(m => m.automationId))].length !== 1 ? 's' : ''} will trigger
                    </p>
                    <p className="text-[10px] text-amber-600/80 dark:text-amber-500/70 leading-relaxed">
                      Applying these tags will enroll the selected {plural.toLowerCase()} into:
                    </p>
                    <ul className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold space-y-0.5 mt-1">
                      {[...new Set(automationMatches.map(m => m.automationName))].map((name) => (
                        <li key={name} className="flex items-center gap-1.5">
                          <Zap className="h-2.5 w-2.5 shrink-0" /> {name}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Progress */}
              {isProcessing && (
                <div className="space-y-2" role="status" aria-live="polite" aria-label={`Processing: ${progress}% complete`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                      Processing…
                    </p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      {progress}%
                    </p>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-5 pt-4 border-t border-border/20 bg-muted/10">
          {result ? (
            <Button
              onClick={handleClose}
              className="w-full rounded-xl font-bold uppercase tracking-widest text-xs h-11"
            >
              Close
            </Button>
          ) : (
            <div className="flex w-full gap-3">
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={isProcessing}
                className="flex-1 rounded-xl font-bold uppercase tracking-widest text-xs h-11"
              >
                Cancel
              </Button>
              <Button
                onClick={handleExecute}
                disabled={isProcessing || selectedTagIds.length === 0}
                className={cn(
                  "flex-1 rounded-xl font-bold uppercase tracking-widest text-xs h-11 transition-all",
                  operation === 'remove' ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""
                )}
              >
                {isProcessing ? 'Processing…' : `${operation === 'add' ? 'Apply' : 'Remove'} Tags`}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
