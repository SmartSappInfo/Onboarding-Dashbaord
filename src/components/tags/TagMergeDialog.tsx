'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag } from '@/lib/types';
import { mergeTagsAction } from '@/lib/tag-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Check, Search, ArrowRight, Merge, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function TagMergeDialog({ open, onOpenChange, onComplete }: TagMergeDialogProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace() as any;
  const { toast } = useToast();

  const [sourceTagIds, setSourceTagIds] = useState<string[]>([]);
  const [targetTagId, setTargetTagId] = useState<string | null>(null);
  const [searchSource, setSearchSource] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allTags } = useCollection<Tag>(tagsQuery);

  const editableTags = useMemo(
    () => (allTags || []).filter(t => !t.isSystem),
    [allTags]
  );

  const filteredSourceTags = useMemo(() => {
    const lower = searchSource.toLowerCase();
    return editableTags.filter(
      t => t.id !== targetTagId &&
        (!lower || t.name.toLowerCase().includes(lower))
    );
  }, [editableTags, searchSource, targetTagId]);

  const filteredTargetTags = useMemo(() => {
    const lower = searchTarget.toLowerCase();
    return editableTags.filter(
      t => !sourceTagIds.includes(t.id) &&
        (!lower || t.name.toLowerCase().includes(lower))
    );
  }, [editableTags, searchTarget, sourceTagIds]);

  const sourceTags = useMemo(
    () => editableTags.filter(t => sourceTagIds.includes(t.id)),
    [editableTags, sourceTagIds]
  );

  const targetTag = useMemo(
    () => editableTags.find(t => t.id === targetTagId) || null,
    [editableTags, targetTagId]
  );

  const affectedContactCount = useMemo(() => {
    const allSourceTags = editableTags.filter(t => sourceTagIds.includes(t.id));
    // Sum usage counts (approximate — contacts may have multiple source tags)
    return allSourceTags.reduce((sum, t) => sum + (t.usageCount || 0), 0);
  }, [editableTags, sourceTagIds]);

  const toggleSource = (tagId: string) => {
    setSourceTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleMerge = async () => {
    if (!user || sourceTagIds.length === 0 || !targetTagId) return;
    setIsProcessing(true);
    try {
      const result = await mergeTagsAction(
        sourceTagIds,
        targetTagId,
        user.uid,
        user.displayName || undefined
      );
      if (result.success) {
        toast({
          title: 'Tags Merged',
          description: `Merged ${sourceTagIds.length} tag(s) into "${targetTag?.name}". ${result.affectedCount} contacts updated.`,
        });
        setSourceTagIds([]);
        setTargetTagId(null);
        onOpenChange(false);
        onComplete?.();
      } else {
        toast({ variant: 'destructive', title: 'Merge Failed', description: result.error });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setSourceTagIds([]);
    setTargetTagId(null);
    setSearchSource('');
    setSearchTarget('');
    onOpenChange(false);
  };

  const canMerge = sourceTagIds.length > 0 && targetTagId !== null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="rounded-2xl max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-black uppercase tracking-tight flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Merge Tags
          </DialogTitle>
          <DialogDescription>
            Select source tags to merge into a single target tag. Source tags will be deleted after merging.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-start">
          {/* Source tags */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Source Tags (select multiple)
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchSource}
                onChange={e => setSearchSource(e.target.value)}
                className="pl-8 h-8 rounded-xl text-xs"
              />
            </div>
            <ScrollArea className="h-52 border rounded-xl p-1">
              {filteredSourceTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => toggleSource(tag.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                    sourceTagIds.includes(tag.id)
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-xs font-bold flex-1 truncate">{tag.name}</span>
                  <span className="text-[9px] text-muted-foreground">{tag.usageCount || 0}</span>
                  {sourceTagIds.includes(tag.id) && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}
              {filteredSourceTags.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-6">No tags available</p>
              )}
            </ScrollArea>
            {sourceTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {sourceTags.map(t => (
                  <Badge
                    key={t.id}
                    className="text-white border-none text-[9px] font-bold gap-1 pr-1"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name}
                    <button onClick={() => toggleSource(t.id)} className="hover:bg-black/20 rounded-full p-0.5">
                      <X className="h-2 w-2" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex items-center justify-center pt-16">
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </div>

          {/* Target tag */}
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-widest">
              Target Tag (keep this one)
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchTarget}
                onChange={e => setSearchTarget(e.target.value)}
                className="pl-8 h-8 rounded-xl text-xs"
              />
            </div>
            <ScrollArea className="h-52 border rounded-xl p-1">
              {filteredTargetTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => setTargetTagId(tag.id === targetTagId ? null : tag.id)}
                  className={cn(
                    'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                    targetTagId === tag.id
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-xs font-bold flex-1 truncate">{tag.name}</span>
                  <span className="text-[9px] text-muted-foreground">{tag.usageCount || 0}</span>
                  {targetTagId === tag.id && <Check className="h-3 w-3 shrink-0 text-emerald-600" />}
                </button>
              ))}
              {filteredTargetTags.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-6">No tags available</p>
              )}
            </ScrollArea>
            {targetTag && (
              <Badge
                className="text-white border-none text-[9px] font-bold"
                style={{ backgroundColor: targetTag.color }}
              >
                {targetTag.name}
              </Badge>
            )}
          </div>
        </div>

        {/* Summary */}
        {canMerge && (
          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs">
            <p className="font-bold text-amber-800 dark:text-amber-300">
              Merge summary: {sourceTagIds.length} tag(s) → "{targetTag?.name}"
            </p>
            <p className="text-amber-700 dark:text-amber-400 mt-0.5">
              ~{affectedContactCount} contact(s) affected. Source tags will be permanently deleted.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose} className="rounded-xl font-bold">
            Cancel
          </Button>
          <Button
            onClick={handleMerge}
            disabled={!canMerge || isProcessing}
            className="rounded-xl font-bold"
          >
            {isProcessing ? 'Merging...' : `Merge ${sourceTagIds.length > 0 ? sourceTagIds.length : ''} Tag(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
