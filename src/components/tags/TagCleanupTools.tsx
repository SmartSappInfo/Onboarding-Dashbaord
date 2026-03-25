'use client';

import { useState, useMemo } from 'react';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Tag } from '@/lib/types';
import { bulkDeleteUnusedTagsAction, deleteTagAction } from '@/lib/tag-actions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Trash2, Merge, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { TagMergeDialog } from './TagMergeDialog';

interface TagCleanupToolsProps {
  onTagsChanged?: () => void;
}

/**
 * Computes a simple similarity score between two strings (0–1).
 * Uses Levenshtein distance normalized by max length.
 */
function similarity(a: string, b: string): number {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1;

  const len1 = s1.length;
  const len2 = s2.length;
  const dp: number[][] = Array.from({ length: len1 + 1 }, (_, i) =>
    Array.from({ length: len2 + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      dp[i][j] =
        s1[i - 1] === s2[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return 1 - dp[len1][len2] / Math.max(len1, len2);
}

interface DuplicatePair {
  tag1: Tag;
  tag2: Tag;
  score: number;
}

export function TagCleanupTools({ onTagsChanged }: TagCleanupToolsProps) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace() as any;
  const { toast } = useToast();

  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);

  const tagsQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'tags'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('name', 'asc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: allTags } = useCollection<Tag>(tagsQuery);

  const unusedTags = useMemo(
    () => (allTags || []).filter(t => !t.isSystem && (t.usageCount || 0) === 0),
    [allTags]
  );

  const duplicatePairs = useMemo((): DuplicatePair[] => {
    const tags = (allTags || []).filter(t => !t.isSystem);
    const pairs: DuplicatePair[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < tags.length; i++) {
      for (let j = i + 1; j < tags.length; j++) {
        const key = [tags[i].id, tags[j].id].sort().join('|');
        if (seen.has(key)) continue;
        seen.add(key);

        const score = similarity(tags[i].name, tags[j].name);
        if (score >= 0.75 && score < 1) {
          pairs.push({ tag1: tags[i], tag2: tags[j], score });
        }
      }
    }

    return pairs.sort((a, b) => b.score - a.score).slice(0, 20);
  }, [allTags]);

  const handleBulkDeleteUnused = async () => {
    if (!user) return;
    setIsBulkDeleting(true);
    try {
      const result = await bulkDeleteUnusedTagsAction(
        activeWorkspaceId,
        user.uid,
        user.displayName || undefined
      );
      if (result.success) {
        toast({
          title: 'Cleanup Complete',
          description: `Deleted ${result.deletedCount} unused tag(s).`,
        });
        onTagsChanged?.();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
      }
    } finally {
      setIsBulkDeleting(false);
      setConfirmBulkDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Unused tags */}
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-destructive" />
              Unused Tags
              {unusedTags.length > 0 && (
                <Badge variant="destructive" className="text-[9px] font-black rounded-full">
                  {unusedTags.length}
                </Badge>
              )}
            </CardTitle>
            {unusedTags.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmBulkDelete(true)}
                className="rounded-xl font-bold text-xs h-8"
              >
                Delete All Unused
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {unusedTags.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 py-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold">No unused tags — your library is clean.</span>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unusedTags.map(tag => (
                <Badge
                  key={tag.id}
                  variant="outline"
                  className="text-xs font-bold gap-1.5 pr-1 border-dashed"
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                  <span className="text-[9px] text-muted-foreground ml-0.5">0 contacts</span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicate suggestions */}
      <Card className="border-none shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
              <Merge className="h-4 w-4 text-amber-500" />
              Possible Duplicates
              {duplicatePairs.length > 0 && (
                <Badge className="text-[9px] font-black rounded-full bg-amber-100 text-amber-700 border-none">
                  {duplicatePairs.length}
                </Badge>
              )}
            </CardTitle>
            {duplicatePairs.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMergeOpen(true)}
                className="rounded-xl font-bold text-xs h-8"
              >
                Open Merge Tool
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {duplicatePairs.length === 0 ? (
            <div className="flex items-center gap-2 text-emerald-600 py-2">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-xs font-bold">No similar tag names detected.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {duplicatePairs.map(({ tag1, tag2, score }) => (
                <div
                  key={`${tag1.id}-${tag2.id}`}
                  className="flex items-center gap-3 p-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl"
                >
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Badge
                      className="text-white border-none text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: tag1.color }}
                    >
                      {tag1.name}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">≈</span>
                    <Badge
                      className="text-white border-none text-[9px] font-bold shrink-0"
                      style={{ backgroundColor: tag2.color }}
                    >
                      {tag2.name}
                    </Badge>
                  </div>
                  <span className="text-[9px] font-black text-amber-600 shrink-0">
                    {Math.round(score * 100)}% similar
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergeOpen(true)}
                    className="h-6 text-[9px] font-black uppercase tracking-widest rounded-lg px-2 text-amber-700 hover:bg-amber-100"
                  >
                    Merge
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk delete confirmation */}
      <AlertDialog open={confirmBulkDelete} onOpenChange={setConfirmBulkDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black">Delete All Unused Tags?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-bold">{unusedTags.length} unused tag(s)</span>.
              These tags have no contacts and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDeleteUnused}
              disabled={isBulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold"
            >
              {isBulkDeleting ? 'Deleting...' : `Delete ${unusedTags.length} Tags`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Merge dialog */}
      <TagMergeDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        onComplete={onTagsChanged}
      />
    </div>
  );
}
