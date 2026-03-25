'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag, TagCategory } from '@/lib/types';
import { bulkApplyTagsAction, bulkRemoveTagsAction } from '@/lib/tag-actions';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Search, Tag as TagIcon, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkTagOperationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedContactIds: string[];
  contactType: 'school' | 'prospect';
  onComplete?: () => void;
}

export function BulkTagOperations({
  open,
  onOpenChange,
  selectedContactIds,
  contactType,
  onComplete,
}: BulkTagOperationsProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace() as any;
  const { toast } = useToast();

  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; count: number; partialFailures?: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  // Real-time tags subscription
  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('category', 'asc'),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allTags } = useCollection<Tag>(tagsQuery);

  const filteredTags = useMemo(() => {
    if (!allTags) return [];
    const lower = searchTerm.toLowerCase();
    return allTags.filter(t =>
      t.name.toLowerCase().includes(lower) ||
      t.description?.toLowerCase().includes(lower)
    );
  }, [allTags, searchTerm]);

  const selectedTagObjects = useMemo(
    () => (allTags || []).filter(t => selectedTagIds.includes(t.id)),
    [allTags, selectedTagIds]
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  // Reset focus when search changes
  useEffect(() => { setFocusedIndex(-1); }, [searchTerm]);

  // Sync DOM focus to focused list item
  useEffect(() => {
    if (focusedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLElement>('[role="option"]');
    items[focusedIndex]?.focus();
  }, [focusedIndex]);

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const total = filteredTags.length;
    if (total === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusedIndex(i => (i + 1) % total); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusedIndex(i => (i <= 0 ? total - 1 : i - 1)); }
    else if (e.key === 'Enter' && focusedIndex >= 0) { e.preventDefault(); toggleTag(filteredTags[focusedIndex].id); }
    else if (e.key === 'Escape') { e.preventDefault(); open && handleClose(); }
  };

  const handleExecute = async () => {
    if (!user || selectedTagIds.length === 0 || selectedContactIds.length === 0) return;
    setIsProcessing(true);
    setProgress(0);

    try {
      const total = selectedContactIds.length;
      const onProgress = (processed: number) => {
        setProgress(Math.round((processed / total) * 100));
      };

      let res;
      if (operation === 'add') {
        res = await bulkApplyTagsAction(
          selectedContactIds,
          contactType,
          selectedTagIds,
          user.uid,
          user.displayName || undefined,
          onProgress
        );
      } else {
        res = await bulkRemoveTagsAction(
          selectedContactIds,
          contactType,
          selectedTagIds,
          user.uid,
          user.displayName || undefined,
          onProgress
        );
      }

      setProgress(100);

      if (res.success) {
        const partialFailures = (res as any).partialFailures?.length ?? 0;
        setResult({ success: true, count: res.processedCount || selectedContactIds.length, partialFailures });
        toast({
          title: 'Operation Complete',
          description: `${operation === 'add' ? 'Applied' : 'Removed'} tags ${operation === 'add' ? 'to' : 'from'} ${res.processedCount} contacts.${partialFailures > 0 ? ` ${partialFailures} contacts could not be updated.` : ''}`,
        });
        onComplete?.();
      } else {
        setResult({ success: false, count: 0 });
        toast({ variant: 'destructive', title: 'Operation Failed', description: (res as any).error });
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
    setSelectedTagIds([]);
    setSearchTerm('');
    setOperation('add');
    setProgress(0);
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">Bulk Tag Operations</DialogTitle>
          <DialogDescription>
            {operation === 'add' ? 'Apply' : 'Remove'} tags {operation === 'add' ? 'to' : 'from'}{' '}
            <span className="font-bold">{selectedContactIds.length} selected contacts</span>
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-8 text-center space-y-4">
            {result.success ? (
              <>
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
                <div>
                  <p className="font-black text-lg uppercase tracking-tight">Operation Complete</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">
                    {operation === 'add' ? 'Applied' : 'Removed'} {selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''}{' '}
                    {operation === 'add' ? 'to' : 'from'} {result.count} contacts
                  </p>
                  {(result.partialFailures ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1">
                      {result.partialFailures} contact{result.partialFailures !== 1 ? 's' : ''} could not be updated
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

            {/* Tag selection */}
            <div className="space-y-2">
              <Label htmlFor="bulk-tag-search" className="text-[10px] font-black uppercase tracking-widest">Select Tags</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" aria-hidden="true" />
                <Input
                  id="bulk-tag-search"
                  placeholder="Search tags…"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={handleListKeyDown}
                  className="pl-8 h-9 rounded-xl text-xs focus-visible:ring-2 focus-visible:ring-primary"
                  aria-label="Search tags"
                  aria-controls={listboxId}
                  role="combobox"
                  aria-expanded={true}
                  aria-autocomplete="list"
                  aria-activedescendant={focusedIndex >= 0 ? `bulk-option-${filteredTags[focusedIndex]?.id}` : undefined}
                />
              </div>
              <div
                ref={listRef}
                id={listboxId}
                role="listbox"
                aria-label="Available tags"
                aria-multiselectable="true"
                className="max-h-48 overflow-y-auto border rounded-xl p-2 space-y-1"
                onKeyDown={handleListKeyDown}
              >
                {filteredTags.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground text-center py-4 font-medium" role="status">No tags found</p>
                ) : (
                  filteredTags.map((tag, idx) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    const isFocused = focusedIndex === idx;
                    return (
                      <button
                        key={tag.id}
                        id={`bulk-option-${tag.id}`}
                        role="option"
                        aria-selected={isSelected}
                        tabIndex={isFocused ? 0 : -1}
                        onClick={() => toggleTag(tag.id)}
                        onFocus={() => setFocusedIndex(idx)}
                        className={cn(
                          'w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-colors text-left',
                          'min-h-[44px] sm:min-h-0 sm:py-1.5',
                          'cursor-pointer touch-manipulation',
                          isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                          isFocused
                            ? 'outline-none ring-2 ring-primary ring-inset'
                            : 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
                        )}
                      >
                        <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} aria-hidden="true" />
                        <span className="text-xs font-bold flex-1 truncate">{tag.name}</span>
                        <span className="text-[9px] text-muted-foreground uppercase font-bold hidden sm:block">{tag.category}</span>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0" aria-hidden="true">
                            <X className="h-2.5 w-2.5 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Selected tags preview */}
            {selectedTagObjects.length > 0 && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest">
                  Selected ({selectedTagObjects.length})
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  {selectedTagObjects.map(tag => (
                    <Badge
                      key={tag.id}
                      className="text-white border-none font-bold text-[10px] uppercase gap-1 pr-1"
                      style={{ backgroundColor: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => toggleTag(tag.id)}
                        className="ml-0.5 hover:bg-black/20 rounded-full p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Operation summary */}
            <div className="p-3 bg-muted/30 rounded-xl text-xs font-medium text-muted-foreground">
              {operation === 'add' ? 'Will add' : 'Will remove'}{' '}
              <span className="font-black text-foreground">{selectedTagIds.length} tag{selectedTagIds.length !== 1 ? 's' : ''}</span>{' '}
              {operation === 'add' ? 'to' : 'from'}{' '}
              <span className="font-black text-foreground">{selectedContactIds.length} contact{selectedContactIds.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Progress */}
            {isProcessing && (
              <div className="space-y-2" role="status" aria-live="polite" aria-label={`Processing: ${progress}% complete`}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">
                    Processing…
                  </p>
                  <p className="text-[10px] font-black text-muted-foreground" aria-hidden="true">{progress}%</p>
                </div>
                <Progress value={progress} className="h-2 rounded-full" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} />
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={isProcessing}
            className="rounded-xl font-bold focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-0"
          >
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button
              onClick={handleExecute}
              disabled={isProcessing || selectedTagIds.length === 0 || selectedContactIds.length === 0}
              className={cn(
                'rounded-xl font-bold focus-visible:ring-2 focus-visible:ring-primary min-h-[44px] sm:min-h-0',
                operation === 'remove' && 'bg-destructive hover:bg-destructive/90'
              )}
              aria-busy={isProcessing}
            >
              {isProcessing ? 'Processing…' : `${operation === 'add' ? 'Apply' : 'Remove'} Tags`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
