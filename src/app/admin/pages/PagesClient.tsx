'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { CampaignPage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
import { Search, PlusCircle, LayoutList, AlertTriangle, Trash2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { PageContainerFluid } from '@/components/ui/page-container';
import { PageCard } from './components/PageCard';
import { PagePreviewModal } from './components/PagePreviewModal';
import ShareEmbedDialog from '@/components/share-embed-dialog';
import {
  duplicatePageAction,
  updatePageStatusAction,
  deletePageAction,
} from '@/lib/page-actions';

// ─── Skeleton grid — hoisted to avoid redefinition on each render ─────────────
// rendering-hoist-jsx: static JSX extracted to module level

const SKELETON_KEYS = [0, 1, 2, 3, 4, 5] as const;

function PagesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {SKELETON_KEYS.map(i => (
        <Skeleton key={i} className="w-full aspect-square rounded-2xl" />
      ))}
    </div>
  );
}

// ─── Empty state — module-level to avoid rerender-no-inline-components ────────

function EmptyState({ searchTerm }: { searchTerm: string }) {
  return (
    <div className="py-32 text-center border-4 border-dashed rounded-[4rem] bg-background flex flex-col items-center justify-center gap-4 opacity-40">
      <LayoutList className="h-16 w-16" />
      <p className="font-semibold text-lg">
        {searchTerm ? 'No pages matched your search' : 'No campaign pages found'}
      </p>
    </div>
  );
}

// ─── PagesClient ──────────────────────────────────────────────────────────────

export default function PagesClient() {
  const router              = useRouter();
  const firestore           = useFirestore();
  const { toast }           = useToast();
  const { activeWorkspaceId } = useTenant();
  const { user }            = useUser();

  const [searchTerm,   setSearchTerm]   = React.useState('');
  const [duplicatingId, setDuplicatingId] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<CampaignPage | null>(null);
  const [confirmNameInput, setConfirmNameInput] = React.useState('');
  const [confirmCheckbox, setConfirmCheckbox] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [sharePage, setSharePage] = React.useState<CampaignPage | null>(null);
  const [previewPage, setPreviewPage] = React.useState<CampaignPage | null>(null);

  // ── Firestore collection query ────────────────────────────────────────────
  const pagesQuery = useMemoFirebase(
    () =>
      firestore && activeWorkspaceId
        ? query(
            collection(firestore, 'campaign_pages'),
            where('workspaceIds', 'array-contains', activeWorkspaceId),
            orderBy('createdAt', 'desc'),
          )
        : null,
    [firestore, activeWorkspaceId],
  );

  const { data: pages, isLoading } = useCollection<CampaignPage>(pagesQuery);

  // rerender-derived-state-no-effect: derive filteredPages during render, not in effect
  const filteredPages = React.useMemo(
    () =>
      pages?.filter(
        p =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.slug.toLowerCase().includes(searchTerm.toLowerCase()),
      ) ?? [],
    [pages, searchTerm],
  );

  // ── Stable action handlers ────────────────────────────────────────────────
  // rerender-memo: useCallback ensures PageCard (React.memo) skips re-renders
  // when PagesClient re-renders due to searchTerm changes.

  const handleCopyLink = React.useCallback(
    (_e: React.MouseEvent, page: CampaignPage) => {
      setSharePage(page);
    },
    [],
  );

  const handleDuplicate = React.useCallback(
    async (e: React.MouseEvent, pageId: string) => {
      e.preventDefault();
      e.stopPropagation();
      if (!user) return;

      setDuplicatingId(pageId);
      try {
        const res = await duplicatePageAction(pageId, user.uid);
        if (res.success) {
          toast({ title: 'Page Duplicated', description: 'A draft copy has been created.' });
        } else {
          toast({ variant: 'destructive', title: 'Error', description: res.error });
        }
      } finally {
        setDuplicatingId(null);
      }
    },
    [user, toast],
  );

  const handlePublish = React.useCallback(
    async (pageId: string) => {
      if (!user) return;
      const res = await updatePageStatusAction(pageId, 'published', user.uid);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Publish Failed', description: res.error });
      } else {
        toast({ title: 'Page Published', description: 'Your page is now live.' });
      }
    },
    [user, toast],
  );

  const handleUnpublish = React.useCallback(
    async (pageId: string) => {
      if (!user) return;
      const res = await updatePageStatusAction(pageId, 'draft', user.uid);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Unpublish Failed', description: res.error });
      } else {
        toast({ title: 'Page Unpublished', description: 'Page moved back to draft.' });
      }
    },
    [user, toast],
  );

  const handleArchive = React.useCallback(
    async (pageId: string) => {
      if (!user) return;
      const res = await updatePageStatusAction(pageId, 'archived', user.uid);
      if (!res.success) {
        toast({ variant: 'destructive', title: 'Archive Failed', description: res.error });
      } else {
        toast({ title: 'Page Archived' });
      }
    },
    [user, toast],
  );

  const handleDeleteRequest = React.useCallback((page: CampaignPage) => {
    setDeleteTarget(page);
    setConfirmNameInput('');
    setConfirmCheckbox(false);
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget || !user) return;
    setIsDeleting(true);
    try {
      const res = await deletePageAction(deleteTarget.id, user.uid);
      if (res.success) {
        toast({ title: deleteTarget.status === 'archived' ? 'Archived Page Permanently Deleted' : 'Page Deleted' });
      } else {
        toast({ variant: 'destructive', title: 'Delete Failed', description: res.error });
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setConfirmNameInput('');
      setConfirmCheckbox(false);
    }
  }, [deleteTarget, user, toast]);

  const isArchivedTarget = deleteTarget?.status === 'archived';
  const isNameMatched = confirmNameInput.trim().toLowerCase() === (deleteTarget?.name ?? '').trim().toLowerCase();
  const isDoubleConfirmed = !isArchivedTarget || (confirmCheckbox && isNameMatched);

  const handleSettings = React.useCallback(
    (page: CampaignPage) => {
      router.push(`/admin/pages/${page.id}/builder?tab=settings`);
    },
    [router],
  );

  /**
   * Navigates to the dedicated analytics dashboard for the target campaign page.
   * 
   * Developer Note: Guards against empty page.id to prevent open/invalid routing errors.
   */
  const handleViewAnalytics = React.useCallback(
    (page: CampaignPage) => {
      if (!page?.id) return;
      router.push(`/admin/pages/${page.id}/analytics`);
    },
    [router],
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PageContainerFluid>
      <div className="space-y-12 pb-32 text-left w-full">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="flex flex-col items-start">
            <h1 className="text-3xl font-bold text-foreground">Campaign Hub</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Conversion-optimized landing architectural system
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto shrink-0">
            <div className="relative w-full sm:w-[240px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-40" />
              <Input
                placeholder="Filter pages..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-11 h-11 rounded-xl bg-background border-border shadow-sm ring-1 ring-border focus:ring-primary/20 font-bold transition-all text-sm"
              />
            </div>
            <Button
              asChild
              className="h-11 px-8 rounded-xl font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transform active:scale-95 transition-all text-sm w-full sm:w-auto"
            >
              <Link href="/admin/pages/new">
                <PlusCircle className="mr-2 h-4 w-4" />
                New Blueprint
              </Link>
            </Button>
          </div>
        </div>

        {/* ── Grid ───────────────────────────────────────────────────────── */}
        {isLoading ? (
          <PagesSkeleton />
        ) : (
          <div className="space-y-16">
            {filteredPages.length > 0 ? (
              <section className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* lg:grid-cols-3 xl:grid-cols-4 — square cards need more vertical space */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {filteredPages.map(page => (
                    <PageCard
                      key={page.id}
                      page={page}
                      duplicatingId={duplicatingId}
                      onDuplicate={handleDuplicate}
                      onPreview={setPreviewPage}
                      onViewAnalytics={handleViewAnalytics}
                      onPublish={handlePublish}
                      onUnpublish={handleUnpublish}
                      onArchive={handleArchive}
                      onDeleteRequest={handleDeleteRequest}
                      onSettings={handleSettings}
                      onCopyLink={handleCopyLink}
                    />
                  ))}
                </div>
              </section>
            ) : (
              <EmptyState searchTerm={searchTerm} />
            )}
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog ──────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={open => {
          if (!open) {
            setDeleteTarget(null);
            setConfirmNameInput('');
            setConfirmCheckbox(false);
          }
        }}
      >
        <AlertDialogContent className={cn(isArchivedTarget && "sm:max-w-md border-destructive/30 shadow-2xl")}>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 text-destructive mb-1">
              <div className="p-2.5 rounded-2xl bg-destructive/10 text-destructive shrink-0">
                {isArchivedTarget ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </div>
              <AlertDialogTitle className="text-base font-bold text-foreground leading-snug">
                {isArchivedTarget
                  ? `Permanently Delete "${deleteTarget?.name}"?`
                  : `Delete "${deleteTarget?.name}"?`}
              </AlertDialogTitle>
            </div>
            <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
              {isArchivedTarget
                ? `You are about to permanently delete this archived page and all its saved versions. This action cannot be undone.`
                : `This permanently removes the draft page and all its saved versions. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Double Confirmation Section for Archived Pages */}
          {isArchivedTarget && (
            <div className="space-y-4 py-2 text-left">
              <div className="p-3.5 rounded-xl border border-destructive/20 bg-destructive/5 space-y-2.5">
                <p className="text-[11px] text-destructive font-bold flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>Double Confirmation Required</span>
                </p>
                <label className="flex items-start gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmCheckbox}
                    onChange={(e) => setConfirmCheckbox(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-destructive/30 text-destructive focus:ring-destructive/20 cursor-pointer shrink-0"
                  />
                  <span className="text-[11px] text-foreground font-semibold leading-snug">
                    I understand that permanently deleting this archived page is irreversible and will remove all page data.
                  </span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-muted-foreground">
                  Type <span className="text-foreground font-extrabold select-all px-1 py-0.5 rounded bg-muted/60">{deleteTarget?.name}</span> to confirm:
                </label>
                <Input
                  value={confirmNameInput}
                  onChange={(e) => setConfirmNameInput(e.target.value)}
                  placeholder={deleteTarget?.name}
                  className="h-10 text-xs font-semibold bg-background border-border rounded-xl focus-visible:ring-destructive/30"
                />
              </div>
            </div>
          )}

          <AlertDialogFooter className="pt-3 gap-2">
            <AlertDialogCancel disabled={isDeleting} className="rounded-xl font-semibold text-xs h-10 px-5">
              Cancel
            </AlertDialogCancel>
            <Button
              disabled={!isDoubleConfirmed || isDeleting}
              onClick={handleDeleteConfirm}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground font-bold text-xs rounded-xl h-10 px-5 shadow-sm active:scale-[0.97] transition-all"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  {isArchivedTarget ? 'Permanently Delete Page' : 'Delete Page'}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {sharePage && (
        <ShareEmbedDialog
          isOpen={!!sharePage}
          onOpenChange={(open) => !open && setSharePage(null)}
          title="Share & Embed Campaign Page"
          resourceName="Page"
          publicUrl={`${window.location.origin}/p/${sharePage.slug}`}
          embedUrl={`${window.location.origin}/p/${sharePage.slug}?embed=true`}
        />
      )}

      {previewPage && (
        <PagePreviewModal
          page={previewPage}
          onClose={() => setPreviewPage(null)}
        />
      )}
    </PageContainerFluid>
  );
}
