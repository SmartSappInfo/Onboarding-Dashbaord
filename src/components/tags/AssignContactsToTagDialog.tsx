'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag, WorkspaceEntity } from '@/lib/types';
import { bulkApplyTagsAction } from '@/lib/tag-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, X, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AsyncEntityAvatar } from '@/app/admin/components/AsyncEntityAvatar';

interface AssignContactsToTagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onComplete?: () => void;
}

export function AssignContactsToTagDialog({
  open,
  onOpenChange,
  tag,
  onComplete,
}: AssignContactsToTagDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace() as any;
  const { toast } = useToast();

  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; count: number; partialFailures?: number } | null>(null);

  // Load all workspace entities to allow searching/selection
  const entitiesQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'workspace_entities'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('displayName', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allEntities } = useCollection<WorkspaceEntity>(entitiesQuery);

  const filteredEntities = useMemo(() => {
    if (!allEntities) return [];
    
    // First remove entities that ALREADY have this tag
    const actionableEntities = allEntities.filter(e => !tag || !(e.workspaceTags || []).includes(tag.id));
    
    const lower = searchTerm.toLowerCase();
    return actionableEntities.filter(e =>
      e.displayName?.toLowerCase().includes(lower) || 
      e.primaryEmail?.toLowerCase().includes(lower)
    );
  }, [allEntities, searchTerm, tag]);

  const selectedEntityObjects = useMemo(
    () => (allEntities || []).filter(e => selectedContactIds.includes(e.id)),
    [allEntities, selectedContactIds]
  );

  const toggleEntity = (entityId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(entityId) ? prev.filter(id => id !== entityId) : [...prev, entityId]
    );
  };

  const handleExecute = async () => {
    if (!user || !tag || selectedContactIds.length === 0) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const total = selectedContactIds.length;

      const res = await bulkApplyTagsAction(
        selectedContactIds,
        'workspace_entity',
        [tag.id],
        user.uid,
        user.displayName || undefined
      );

      setProgress(100);

      if (res.success) {
        const partialFailures = (res as any).partialFailures?.length ?? 0;
        setResult({ success: true, count: res.processedCount || selectedContactIds.length, partialFailures });
        toast({
          title: 'Assignment Complete',
          description: `Applied ${tag.name} to ${res.processedCount} contacts.`,
        });
        onComplete?.();
      } else {
        setResult({ success: false, count: 0 });
        toast({ variant: 'destructive', title: 'Assignment Failed', description: (res as any).error });
      }
    } catch (err: any) {
      setResult({ success: false, count: 0 });
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing) return;
    setSelectedContactIds([]);
    setSearchTerm('');
    setProgress(0);
    setResult(null);
    onOpenChange(false);
  };

  // Pre-load tags cache
  useEffect(() => {
    if (!open) {
      setSelectedContactIds([]);
      setSearchTerm('');
      setResult(null);
    }
  }, [open]);

  if (!tag) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">Assign Tag</DialogTitle>
          <DialogDescription>
            Applying <span className="font-bold" style={{ color: tag.color }}>{tag.name}</span> to contacts.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-8 text-center space-y-4">
            {result.success ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <div>
                  <p className="font-black text-lg uppercase tracking-tight">Assignment Complete</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">
                    Applied tag to {result.count} contacts
                  </p>
                  {(result.partialFailures ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1">
                      {result.partialFailures} contacts could not be updated
                    </p>
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
            {/* Contact selection */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest">Select Contacts</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search contacts by name or email…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 h-9 rounded-xl text-xs focus-visible:ring-2 focus-visible:ring-primary"
                />
              </div>
              <div
                className="max-h-56 overflow-y-auto border rounded-xl p-2 space-y-1"
              >
                {!allEntities ? (
                   <p className="text-[10px] text-muted-foreground text-center py-4 font-medium">Loading contacts...</p>
                ) : filteredEntities.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-4 font-medium">No available contacts found</p>
                ) : (
                  filteredEntities.map((entity) => {
                    const isSelected = selectedContactIds.includes(entity.id);
                    return (
                      <button
                        key={entity.id}
                        onClick={() => toggleEntity(entity.id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left',
                          'cursor-pointer touch-manipulation',
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                        )}
                      >
                       <AsyncEntityAvatar entityId={entity.entityId} src={entity.logoUrl} name={entity.displayName} className="h-7 w-7 rounded-md shrink-0" fallbackClassName="text-[8px]" />
                        <div className="flex-1 min-w-0">
                           <span className="text-xs font-bold truncate block">{entity.displayName}</span>
                           <span className="text-[9px] text-muted-foreground truncate block">{entity.primaryEmail || 'No email'}</span>
                        </div>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <CheckCircle2 className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected contacts preview */}
            {selectedEntityObjects.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Selected ({selectedEntityObjects.length})
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedEntityObjects.map(e => (
                    <Badge
                      key={e.id}
                      variant="secondary"
                      className="font-bold text-[10px] gap-1 pr-1"
                    >
                      {e.displayName}
                      <button
                        onClick={() => toggleEntity(e.id)}
                        className="ml-0.5 hover:bg-black/10 rounded-full p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                    Processing…
                  </p>
                  <p className="text-[10px] font-black text-muted-foreground">{progress}%</p>
                </div>
                <Progress value={progress} className="h-2 rounded-full" />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded-xl font-bold"
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleExecute}
              disabled={isProcessing || selectedContactIds.length === 0}
              className="rounded-xl font-bold"
            >
              {isProcessing ? 'Processing…' : `Assign to ${selectedContactIds.length} Contacts`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
