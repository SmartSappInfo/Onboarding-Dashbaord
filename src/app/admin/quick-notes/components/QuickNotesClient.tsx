'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { 
  Plus, 
  Search, 
  Brain, 
  LayoutGrid, 
  List, 
  Table, 
  LayoutTemplate,
  Lightbulb, 
  Sparkles, 
  CheckCircle2, 
  MessageSquareQuote,
  Notebook,
  Compass,
  BookOpen,
  Eye,
  CheckSquare,
  Settings,
  Network,
  Inbox,
  TrendingUp,
  Rocket,
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
import { KnowledgeSearchRibbon } from './KnowledgeSearchRibbon';
import { KnowledgeListView } from './KnowledgeListView';
import { KnowledgeTableView } from './KnowledgeTableView';
import { KnowledgeGraphView } from './graph/KnowledgeGraphView';
import { IdeaStudioView } from './ideas/IdeaStudioView';
import type { KnowledgeViewMode } from './quick-notes-ui';
import type { UnifiedNoteSource } from '@/lib/quick-notes-types';

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
  const [selectedSource, setSelectedSource] = React.useState<'all' | UnifiedNoteSource>('all');
  const [viewMode, setViewMode] = React.useState<KnowledgeViewMode>('grid');
  const [search, setSearch] = React.useState('');
  const [askModalOpen, setAskModalOpen] = React.useState(false);
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
          <Link href="/admin/quick-notes/inbox">
            <Button variant="outline" className="gap-2 shadow-sm font-semibold min-h-[36px] text-purple-600 border-purple-300 dark:border-purple-800 dark:text-purple-400">
              <Inbox className="h-4 w-4" />
              <span>Inbox</span>
            </Button>
          </Link>
          <Link href="/admin/quick-notes/insights">
            <Button variant="outline" className="gap-2 shadow-sm font-semibold min-h-[36px] text-emerald-600 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
              <span>Insights</span>
            </Button>
          </Link>
          <Link href="/admin/quick-notes/campaigns">
            <Button variant="outline" className="gap-2 shadow-sm font-semibold min-h-[36px] text-blue-600 border-blue-300 dark:border-blue-800 dark:text-blue-400">
              <Rocket className="h-4 w-4" />
              <span>Campaigns</span>
            </Button>
          </Link>
          <Link href="/admin/quick-notes/ask">
            <Button variant="outline" className="gap-2 shadow-sm font-semibold min-h-[36px] text-violet-600 border-violet-300 dark:border-violet-800 dark:text-violet-400">
              <Sparkles className="h-4 w-4" />
              <span>Ask Brain AI</span>
            </Button>
          </Link>
          <Link href="/admin/quick-notes/templates">
            <Button variant="outline" className="gap-2 shadow-sm font-semibold min-h-[36px]">
              <LayoutTemplate className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">Templates</span>
            </Button>
          </Link>
          <Link href="/admin/quick-notes/settings">
            <Button variant="outline" className="gap-2 shadow-sm font-semibold min-h-[36px]">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <span className="hidden sm:inline">Settings</span>
            </Button>
          </Link>
          <AskNotesDialog
            workspaceId={activeWorkspaceId}
            userId={user?.uid}
            open={askModalOpen}
            onOpenChange={setAskModalOpen}
            showTriggerButton={false}
          />
          <DigestButton notes={digestNotes} scopeLabel={scopeLabel} workspaceId={activeWorkspaceId} userId={user?.uid} />
          <Button onClick={handleNew} className="gap-2 shadow-sm font-semibold min-h-[36px]">
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

        <div className="min-w-0 flex-1 space-y-4">
          {/* Omnibar Search Ribbon */}
          <KnowledgeSearchRibbon
            searchQuery={search}
            onSearchChange={setSearch}
            selectedSource={selectedSource}
            onSourceChange={(src) => {
              setSelectedSource(src);
              if (src !== 'all' && src !== 'quick_note') {
                setFilter({ kind: 'sources' });
              }
            }}
            selectedType={selectedType}
            onTypeChange={setSelectedType}
            onOpenAskModal={() => setAskModalOpen(true)}
            totalResultsCount={filter.kind === 'sources' ? unifiedItems.length : visibleNotes.length}
          />

          {/* View Switcher: Grid / List / Table */}
          <div className="flex items-center justify-end gap-1">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('graph')}
                className={cn(
                  'h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md',
                  viewMode === 'graph' && 'bg-background shadow-sm text-foreground'
                )}
                aria-label="Knowledge Graph View"
              >
                <Network className="h-3.5 w-3.5 text-blue-500" />
                <span className="hidden sm:inline">Graph</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('ideas')}
                className={cn(
                  'h-7 px-2.5 text-xs font-medium gap-1.5 rounded-md',
                  viewMode === 'ideas' && 'bg-background shadow-sm text-foreground'
                )}
                aria-label="Idea Intelligence Studio"
              >
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                <span className="hidden sm:inline">Idea Studio</span>
              </Button>
            </div>
          </div>

          {/* Body content based on active view mode */}
          {viewMode === 'ideas' ? (
            <IdeaStudioView
              workspaceId={activeWorkspaceId || ''}
              userId={user?.uid || 'user'}
              userName={user?.displayName || 'User'}
            />
          ) : viewMode === 'graph' ? (
            <KnowledgeGraphView />
          ) : filter.kind === 'sources' ? (
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
