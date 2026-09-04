'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Brain, 
  LayoutGrid, 
  List, 
  Table, 
  Lightbulb, 
  Sparkles, 
  CheckCircle2, 
  MessageSquareQuote,
  Notebook,
  Compass,
  BookOpen,
  Eye,
  CheckSquare
} from 'lucide-react';
import { PageContainerFluid } from '@/components/ui/page-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useFirestore, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import { cn } from '@/lib/utils';
import type { QuickNote, UnifiedNote, KnowledgeType } from '@/lib/quick-notes-types';
import { collectOwnedStoragePaths, quickNoteToUnified, sortUnifiedNotes, KNOWLEDGE_TYPE_META, normalizeKnowledgeType } from '@/lib/quick-notes-domain';
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
import { KnowledgeListView } from './KnowledgeListView';
import { KnowledgeTableView } from './KnowledgeTableView';
import type { KnowledgeViewMode } from './quick-notes-ui';

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
  const [selectedType, setSelectedType] = React.useState<KnowledgeType | 'all'>('all');
  const [viewMode, setViewMode] = React.useState<KnowledgeViewMode>('grid');
  const [search, setSearch] = React.useState('');
  const deferredSearch = React.useDeferredValue(search);

  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingNote, setEditingNote] = React.useState<QuickNote | null>(null);

  // Lazily-fetched read-only legacy notes (entity / task / call). Only loaded
  // when the unified "All sources" view is active.
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
    const byType: Record<string, number> = {};
    let pinned = 0;
    for (const n of allNotes) {
      if (n.isPinned) pinned += 1;
      if (n.categoryId) byCategory[n.categoryId] = (byCategory[n.categoryId] ?? 0) + 1;
      const typeKey = normalizeKnowledgeType(n.knowledgeType);
      byType[typeKey] = (byType[typeKey] ?? 0) + 1;
    }
    return { all: allNotes.length, pinned, byCategory, byType };
  }, [allNotes]);

  const visibleNotes = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return allNotes.filter((n) => {
      if (filter.kind === 'pinned' && !n.isPinned) return false;
      if (filter.kind === 'category' && n.categoryId !== filter.categoryId) return false;
      if (filter.kind === 'sources') return false; // handled by unified view
      if (selectedType !== 'all' && normalizeKnowledgeType(n.knowledgeType) !== selectedType) return false;
      if (!q) return true;
      const haystack = `${n.title} ${n.plainText} ${(n.tags ?? []).join(' ')}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [allNotes, filter, selectedType, deferredSearch]);

  // Fetch aggregated legacy notes the first time the unified view is opened
  const fetchedFor = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (filter.kind !== 'sources' || !activeWorkspaceId) return;
    if (!user?.uid) return;
    if (fetchedFor.current === activeWorkspaceId) return;
    fetchedFor.current = activeWorkspaceId;

    let cancelled = false;
    setAggLoading(true);
    fetchAggregatedNotes(activeWorkspaceId, user.uid)
      .then((notes) => {
        if (!cancelled && Array.isArray(notes)) setAggregated(notes);
      })
      .finally(() => {
        if (!cancelled) setAggLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter.kind, activeWorkspaceId, user?.uid]);

  const unifiedItems = React.useMemo<UnifiedNote[]>(() => {
    if (filter.kind !== 'sources') return [];
    const nativeUnified = allNotes.map(quickNoteToUnified);
    const combined = [...nativeUnified, ...(aggregated ?? [])];
    const q = deferredSearch.trim().toLowerCase();
    const filtered = q
      ? combined.filter((i) =>
          `${i.title ?? ''} ${i.plainText} ${i.tags.join(' ')}`.toLowerCase().includes(q)
        )
      : combined;
    return sortUnifiedNotes(filtered);
  }, [filter.kind, allNotes, aggregated, deferredSearch]);

  const nativeById = React.useMemo(
    () => new Map(allNotes.map((n) => [n.id, n])),
    [allNotes]
  );

  const digestNotes = React.useMemo(
    () => (filter.kind === 'sources' ? unifiedItems : visibleNotes),
    [filter.kind, unifiedItems, visibleNotes]
  );

  const scopeLabel = React.useMemo(() => {
    if (filter.kind === 'all') return 'All knowledge';
    if (filter.kind === 'pinned') return 'Pinned knowledge';
    if (filter.kind === 'sources') return 'All sources';
    const cat = categoryById.get(filter.categoryId);
    return cat ? `Category: ${cat.name}` : 'Current view';
  }, [filter, categoryById]);

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
        title: 'Delete this item?',
        description: 'This will permanently remove this knowledge object and any uploaded attachments.',
        confirmText: 'Delete',
        variant: 'destructive',
      });
      if (!ok) return;

      try {
        await deleteQuickNote(firestore, note.id);
        const paths = collectOwnedStoragePaths(note);
        for (const p of paths) void deleteAttachmentObject(p);
        toast({ title: 'Deleted' });
      } catch {
        toast({ title: 'Failed to delete', variant: 'destructive' });
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
        description: 'Items in this category are kept; they simply become uncategorised.',
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
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
            <Brain className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground">Company Brain</h1>
              <Badge variant="outline" className="text-xs font-mono font-medium">
                {counts.all} {counts.all === 1 ? 'item' : 'items'}
              </Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Organizational knowledge, ideas, decisions, and intelligence across this workspace.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <AskNotesDialog workspaceId={activeWorkspaceId} userId={user?.uid} />
          <DigestButton notes={digestNotes} scopeLabel={scopeLabel} workspaceId={activeWorkspaceId} userId={user?.uid} />
          <Button onClick={handleNew} className="gap-2 shadow-sm font-semibold">
            <Plus className="h-4 w-4" />
            Capture Knowledge
          </Button>
        </div>
      </div>

      {/* Main layout */}
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
          {/* Controls Bar: Search + Type Filter Pills + View Switcher */}
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search knowledge by title, text, or tags…"
                  aria-label="Search knowledge"
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* View Switcher: Grid / List / Table */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 self-end sm:self-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    'h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md',
                    viewMode === 'grid' && 'bg-background shadow-sm text-foreground'
                  )}
                  aria-label="Card Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Cards</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md',
                    viewMode === 'list' && 'bg-background shadow-sm text-foreground'
                  )}
                  aria-label="List View"
                >
                  <List className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">List</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewMode('table')}
                  className={cn(
                    'h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md',
                    viewMode === 'table' && 'bg-background shadow-sm text-foreground'
                  )}
                  aria-label="Table View"
                >
                  <Table className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Table</span>
                </Button>
              </div>
            </div>

            {/* Semantic Knowledge Type Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={cn(
                  'px-2.5 py-1 rounded-full font-medium transition-all cursor-pointer whitespace-nowrap',
                  selectedType === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                All Types
              </button>
              {(Object.keys(KNOWLEDGE_TYPE_META) as KnowledgeType[]).map((tKey) => {
                const meta = KNOWLEDGE_TYPE_META[tKey];
                const count = counts.byType[tKey] ?? 0;
                if (count === 0 && selectedType !== tKey) return null; // Only show active or populated types
                return (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setSelectedType(tKey)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-medium border transition-all cursor-pointer whitespace-nowrap',
                      selectedType === tKey
                        ? cn(meta.badgeColor, 'border-current font-bold')
                        : 'border-transparent bg-muted/60 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full', meta.dotColor)} />
                    <span>{meta.label}</span>
                    <span className="text-[10px] opacity-70">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Body content based on active view mode */}
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
          ) : viewMode === 'list' ? (
            <KnowledgeListView
              notes={visibleNotes}
              categories={allCategories}
              onEdit={handleEdit}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
            />
          ) : viewMode === 'table' ? (
            <KnowledgeTableView
              notes={visibleNotes}
              categories={allCategories}
              onEdit={handleEdit}
              onTogglePin={handleTogglePin}
              onDelete={handleDelete}
            />
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

      {/* Editor Modal */}
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
          initialType={selectedType !== 'all' ? selectedType : 'note'}
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
      <Brain className="h-10 w-10 text-muted-foreground/50" />
      <h3 className="mt-4 font-serif text-lg font-medium text-foreground">
        {hasAny ? 'No knowledge matches this view' : 'No knowledge captured yet'}
      </h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {hasAny
          ? 'Try a different type filter, category, or clear your search.'
          : 'Capture your first thought — meeting takeaways, strategic ideas, decisions, feedback, or follow-ups.'}
      </p>
      {!hasAny && (
        <Button onClick={onNew} className="mt-4 gap-2">
          <Plus className="h-4 w-4" />
          Capture Knowledge
        </Button>
      )}
    </div>
  );
}
