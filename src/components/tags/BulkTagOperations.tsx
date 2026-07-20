'use client';

import { useState, useMemo, useRef, useEffect, useId } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag, TagCategory } from '@/lib/types';
import { bulkApplyTagsAction, bulkRemoveTagsAction, createTagAction } from '@/lib/tag-actions';
import { checkTagAutomations } from '@/lib/automations/checkTagAutomations';
import { useToast } from '@/hooks/use-toast';
import { useTerminology } from '@/hooks/use-terminology';
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
import { Search, Tag as TagIcon, X, CheckCircle2, AlertCircle, Plus, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const TAG_CATEGORIES: { value: TagCategory; label: string }[] = [
  { value: 'behavioral', label: 'Behavioral' },
  { value: 'demographic', label: 'Demographic' },
  { value: 'interest', label: 'Interest' },
  { value: 'status', label: 'Status' },
  { value: 'lifecycle', label: 'Lifecycle' },
  { value: 'engagement', label: 'Engagement' },
  { value: 'custom', label: 'Custom' },
];

const TAG_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#14B8A6', '#3B82F6', '#8B5CF6', '#EC4899',
];

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
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace() as { activeWorkspaceId: string; activeOrganizationId: string };
  const { toast } = useToast();
  const { singular, plural } = useTerminology();

  const [operation, setOperation] = useState<'add' | 'remove'>('add');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ success: boolean; count: number; partialFailures?: number } | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Inline tag creation state
  const [isCreatingInline, setIsCreatingInline] = useState(false);
  const [inlineTagName, setInlineTagName] = useState('');
  const [inlineCategory, setInlineCategory] = useState<TagCategory>('custom');
  const [inlineColor, setInlineColor] = useState('#3B82F6');
  const [isSubmittingInline, setIsSubmittingInline] = useState(false);

  // Automation trigger awareness
  const [automationMatches, setAutomationMatches] = useState<Array<{
    automationId: string;
    automationName: string;
    tagId: string;
    enrollOnce: boolean;
  }>>([]);

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

  const exactMatchExists = useMemo(() => {
    const cleanSearch = searchTerm.trim().toLowerCase();
    if (!cleanSearch) return true;
    return (allTags || []).some(t => t.name.toLowerCase() === cleanSearch);
  }, [allTags, searchTerm]);

  const handleCreateInlineTag = async () => {
    if (!inlineTagName.trim() || !user || !activeWorkspaceId) return;
    setIsSubmittingInline(true);
    try {
      const result = await createTagAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || '',
        name: inlineTagName.trim(),
        category: inlineCategory,
        color: inlineColor,
        userId: user.uid,
        userName: user.displayName || undefined,
      });

      if (result.success && result.data) {
        // Automatically select the newly created tag
        const newTagId = result.data.id;
        setSelectedTagIds(prev => [...prev, newTagId]);
        toast({
          title: 'Tag Created',
          description: `"${inlineTagName.trim()}" has been created and selected.`,
        });
        setIsCreatingInline(false);
        setSearchTerm('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Creating Tag',
          description: result.error || 'Failed to create tag',
        });
      }
    } catch (err: unknown) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'An unexpected error occurred',
      });
    } finally {
      setIsSubmittingInline(false);
    }
  };

  const selectedTagObjects = useMemo(
    () => (allTags || []).filter(t => selectedTagIds.includes(t.id)),
    [allTags, selectedTagIds]
  );

  const toggleTag = (tagId: string) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
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

  const handleClose = () => {
    if (isProcessing) return;
    setSelectedTagIds([]);
    setSearchTerm('');
    setOperation('add');
    setProgress(0);
    setResult(null);
    setIsCreatingInline(false);
    setInlineTagName('');
    setInlineCategory('custom');
    setInlineColor('#3B82F6');
    setAutomationMatches([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-lg bg-card border-border text-foreground" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight">Bulk Tag Operations</DialogTitle>
          <DialogDescription>
            {operation === 'add' ? 'Apply' : 'Remove'} tags {operation === 'add' ? 'to' : 'from'}{' '}
            <span className="font-bold">{selectedContactIds.length} selected {selectedContactIds.length === 1 ? singular.toLowerCase() : plural.toLowerCase()}</span>
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
                    {operation === 'add' ? 'to' : 'from'} {result.count} {result.count === 1 ? singular.toLowerCase() : plural.toLowerCase()}
                  </p>
                  {(result.partialFailures ?? 0) > 0 && (
                    <p className="text-xs text-amber-600 font-medium mt-1">
                      {result.partialFailures} {result.partialFailures === 1 ? singular.toLowerCase() : plural.toLowerCase()} could not be updated
                    </p>
                  )}
                  {automationMatches.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-border/30">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
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

            {/* Tag selection */}
            <div className="space-y-3">
              <Label className="text-[10px] font-black uppercase tracking-widest">
                Select Tags
              </Label>
              <div className="min-h-[44px] border border-border/40 rounded-xl p-2 bg-muted/20 flex flex-wrap items-center gap-1.5">
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
              disabled={isProcessing || selectedTagIds.length === 0 || selectedContactIds.length === 0 || isCreatingInline}
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
