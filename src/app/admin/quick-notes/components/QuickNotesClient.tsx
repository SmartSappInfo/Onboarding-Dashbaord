'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, NotebookPen } from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useFirestore, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import type { QuickNote, UnifiedNote } from '@/lib/quick-notes-types';
import { collectOwnedStoragePaths, quickNoteToUnified, sortUnifiedNotes } from '@/lib/quick-notes-domain';
import { deleteAttachmentObject } from '@/lib/quick-notes-attachments';
import { fetchAggregatedNotes } from '@/lib/quick-notes-feed-actions';
import {
  useQuickNotes,
  useNoteCategories,
  toggleQuickNotePin,
  deleteQuickNote,
  createQuickNoteCategory,
  deleteQuickNoteCategory,
  BOARD_NOTE_LIMIT,
} from '@/lib/quick-notes-hooks';
import { QuickNoteCard } from './QuickNoteCard';
import { AggregatedNoteCard } from './AggregatedNoteCard';
import CategoryRail, { type BoardFilter } from './CategoryRail';
import NoteEditorDialog from './NoteEditorDialog';
import DigestButton from './DigestButton';
import AskNotesDialog from './AskNotesDialog';

export default function QuickNotesClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();
  const confirm = useConfirm();

  const searchParams = useSearchParams();
  const initialCategory = searchParams.get('category');

  const { data: notes, isLoading } = useQuickNotes(activeWorkspaceId);
  const { data: categories } = useNoteCategories(activeWorkspaceId);

  const [filter, setFilter] = React.useState<BoardFilter>(
    initialCategory ? { kind: 'category', categoryId: initialCategory } : { kind: 'all' }
  );
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<QuickNote | null>(null);

  // Lazily-fetched read-only legacy notes (entity / task / call). Only loaded
  // when the unified "All sources" view is active — bundle-conditional, so the
  // default native view costs a single Firestore subscription.
  const [aggregated, setAggregated] = React.useState<UnifiedNote[] | null>(null);
  const [aggLoading, setAggLoading] = React.useState(false);

  const allNotes = React.useMemo<QuickNote[]>(() => notes ?? [], [notes]);
  const allCategories = React.useMemo(() => categories ?? [], [categories]);

  const categoryById = React.useMemo(
    () => new Map(allCategories.map((c) => [c.id, c])),
    [allCategories]
  );

  const counts = React.useMemo(() => {
    const byCategory: Record<string, number> = {};
    let pinned = 0;
    for (const n of allNotes) {
      if (n.isPinned) pinned += 1;
      if (n.categoryId) byCategory[n.categoryId] = (byCategory[n.categoryId] ?? 0) + 1;
    }
    return { all: allNotes.length, pinned, byCategory };
  }, [allNotes]);

  const visibleNotes = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return allNotes.filter((n) => {
      if (filter.kind === 'pinned' && !n.isPinned) return false;
      if (filter.kind === 'category' && n.categoryId !== filter.categoryId) return false;
      if (filter.kind === 'sources') return false; // handled by the unified view
      if (!q) return true;
      const haystack = `${n.title} ${n.plainText} ${(n.tags ?? []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allNotes, filter, deferredSearch]);

  // Fetch aggregated legacy notes the first time the unified view is opened
  // for the active workspace.
  const fetchedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (filter.kind !== 'sources' || !activeWorkspaceId) return;
    if (!user?.uid) return;
    if (fetchedFor.current === activeWorkspaceId) return;
    fetchedFor.current = activeWorkspaceId;
    setAggLoading(true);
    fetchAggregatedNotes(activeWorkspaceId, user.uid)
      .then((rows) => setAggregated(rows))
      .catch(() => setAggregated([]))
      .finally(() => setAggLoading(false));
  }, [filter.kind, activeWorkspaceId, user?.uid]);

  // Combined, sorted unified feed (native quick notes + legacy), search-filtered.
  const unifiedItems = React.useMemo(() => {
    const nativeUnified = allNotes.map(quickNoteToUnified);
    const merged = sortUnifiedNotes([...nativeUnified, ...(aggregated ?? [])]);
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return merged;
    return merged.filter((n) =>
      `${n.title ?? ''} ${n.plainText} ${n.tags.join(' ')}`.toLowerCase().includes(q)
    );
  }, [allNotes, aggregated, deferredSearch]);

  const nativeById = React.useMemo(() => new Map(allNotes.map((n) => [n.id, n])), [allNotes]);

  // Notes + label fed to the AI digest, scoped to the active view.
  const { digestNotes, scopeLabel } = React.useMemo(() => {
    if (filter.kind === 'sources') {
      return {
        digestNotes: unifiedItems.map((n) => ({ title: n.title, plainText: n.plainText, createdAt: n.createdAt })),
        scopeLabel: 'All sources',
      };
    }
    const label =
      filter.kind === 'pinned'
        ? 'Pinned notes'
        : filter.kind === 'category'
          ? categoryById.get(filter.categoryId)?.name ?? 'Category'
          : 'All notes';
    return {
      digestNotes: visibleNotes.map((n) => ({ title: n.title, plainText: n.plainText, createdAt: n.createdAt })),
      scopeLabel: label,
    };
  }, [filter, unifiedItems, visibleNotes, categoryById]);

  // Stable callbacks so memoized cards don't re-render on every keystroke.
  const handleNew = React.useCallback(() => {
    setEditingNote(null);
    setEditorOpen(true);
  }, []);

  const handleEdit = React.useCallback((note: QuickNote) => {
    setEditingNote(note);
    setEditorOpen(true);
  }, []);

  const handleTogglePin = React.useCallback(
    async (note: QuickNote) => {
      if (!firestore) return;
      try {
        await toggleQuickNotePin(firestore, note, user?.uid);
      } catch {
        toast({ title: 'Failed to update pin', variant: 'destructive' });
      }
    },
    [firestore, user?.uid, toast]
  );

  const handleDelete = React.useCallback(
    async (note: QuickNote) => {
      if (!firestore) return;
      const ok = await confirm({
        title: 'Delete note?',
        description: 'This note will be permanently deleted.',
        confirmText: 'Delete',
        variant: 'destructive',
      });
      if (!ok) return;
      try {
        await deleteQuickNote(firestore, note.id);
        // Best-effort cleanup of owned Storage objects (R13).
        for (const path of collectOwnedStoragePaths(note)) {
          void deleteAttachmentObject(path);
        }
        toast({ title: 'Note deleted' });
      } catch {
        toast({ title: 'Failed to delete note', variant: 'destructive' });
      }
    },
    [firestore, confirm, toast]
  );

  const handleCreateCategory = React.useCallback(
    async (name: string, color: string) => {
      if (!firestore || !activeWorkspaceId || !activeOrganizationId || !user) return;
      try {
        await createQuickNoteCategory(firestore, {
          organizationId: activeOrganizationId,
          workspaceId: activeWorkspaceId,
          createdBy: user.uid,
          name,
          color,
          order: allCategories.length,
        });
        toast({ title: 'Category created' });
      } catch {
        toast({ title: 'Failed to create category', variant: 'destructive' });
      }
    },
    [firestore, activeWorkspaceId, activeOrganizationId, user, allCategories.length, toast]
  );

  const handleDeleteCategory = React.useCallback(
    async (categoryId: string) => {
      if (!firestore) return;
      const ok = await confirm({
        title: 'Delete category?',
        description: 'Notes in this category are kept; they simply become uncategorised.',
        confirmText: 'Delete',
        variant: 'destructive',
      });
      if (!ok) return;
      try {
        await deleteQuickNoteCategory(firestore, categoryId);
        if (filter.kind === 'category' && filter.categoryId === categoryId) setFilter({ kind: 'all' });
        toast({ title: 'Category deleted' });
      } catch {
        toast({ title: 'Failed to delete category', variant: 'destructive' });
      }
    },
    [firestore, confirm, filter, toast]
  );

  return (
    <PageContainerFluid>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Quick Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Capture, organise, and link every note across this workspace.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AskNotesDialog workspaceId={activeWorkspaceId} userId={user?.uid} />
          <DigestButton notes={digestNotes} scopeLabel={scopeLabel} workspaceId={activeWorkspaceId} userId={user?.uid} />
          <Button onClick={handleNew} className="gap-2">
            <Plus className="h-4 w-4" />
            New note
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <CategoryRail
          categories={allCategories}
          counts={counts}
          capped={allNotes.length >= BOARD_NOTE_LIMIT}
          active={filter}
          onSelect={setFilter}
          onCreateCategory={handleCreateCategory}
          onDeleteCategory={handleDeleteCategory}
        />

        <div className="min-w-0 flex-1">
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes by title, text, or tag…"
              aria-label="Search notes"
              className="pl-9"
            />
          </div>

          {filter.kind === 'sources' ? (
            (isLoading || aggLoading) && aggregated === null ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-44 rounded-xl" />
                ))}
              </div>
            ) : unifiedItems.length === 0 ? (
              <EmptyState hasAny={allNotes.length > 0} onNew={handleNew} />
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {unifiedItems.map((item) => {
                  const native = item.source === 'quick_note' ? nativeById.get(item.sourceId) : undefined;
                  return (
                    <div key={item.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_220px]">
                      {native ? (
                        <QuickNoteCard
                          note={native}
                          category={native.categoryId ? categoryById.get(native.categoryId) : undefined}
                          onEdit={handleEdit}
                          onTogglePin={handleTogglePin}
                          onDelete={handleDelete}
                        />
                      ) : (
                        <AggregatedNoteCard note={item} />
                      )}
                    </div>
                  );
                })}
              </div>
            )
          ) : isLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-xl" />
              ))}
            </div>
          ) : visibleNotes.length === 0 ? (
            <EmptyState hasAny={allNotes.length > 0} onNew={handleNew} />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {visibleNotes.map((note) => (
                <div key={note.id} className="[content-visibility:auto] [contain-intrinsic-size:auto_220px]">
                  <QuickNoteCard
                    note={note}
                    category={note.categoryId ? categoryById.get(note.categoryId) : undefined}
                    onEdit={handleEdit}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {firestore && activeWorkspaceId && activeOrganizationId && user && (
        <NoteEditorDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          note={editingNote}
          categories={allCategories}
          firestore={firestore}
          organizationId={activeOrganizationId}
          workspaceId={activeWorkspaceId}
          userId={user.uid}
          userName={user.displayName ?? undefined}
        />
      )}
    </PageContainerFluid>
  );
}

function EmptyState({ hasAny, onNew }: { hasAny: boolean; onNew: () => void }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border',
        'bg-card/40 px-6 py-16 text-center'
      )}
    >
      <NotebookPen className="h-10 w-10 text-muted-foreground/50" />
      <h3 className="mt-4 font-serif text-lg font-medium text-foreground">
        {hasAny ? 'No notes match this view' : 'No notes yet'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasAny
          ? 'Try a different filter or clear your search.'
          : 'Capture your first thought — meeting takeaways, ideas, follow-ups, anything.'}
      </p>
      {!hasAny && (
        <Button onClick={onNew} className="mt-4 gap-2">
          <Plus className="h-4 w-4" />
          New note
        </Button>
      )}
    </div>
  );
}
