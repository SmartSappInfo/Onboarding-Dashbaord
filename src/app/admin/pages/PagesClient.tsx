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
import { Search, PlusCircle, LayoutList } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useTenant } from '@/context/TenantContext';
import Link from 'next/link';
import { useUser } from '@/firebase';
import { PageContainerFluid } from '@/components/ui/page-container';
import { PageCard } from './components/PageCard';
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
    (_e: React.MouseEvent, slug: string) => {
      if (typeof window === 'undefined') return;
      const url = `${window.location.origin}/p/${slug}`;
      navigator.clipboard.writeText(url);
      toast({ title: 'Link Copied', description: 'Page URL copied to clipboard.' });
    },
    [toast],
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
  }, []);

  const handleDeleteConfirm = React.useCallback(async () => {
    if (!deleteTarget || !user) return;
    const res = await deletePageAction(deleteTarget.id, user.uid);
    if (res.success) {
      toast({ title: 'Page Deleted' });
    } else {
      toast({ variant: 'destructive', title: 'Delete Failed', description: res.error });
    }
    setDeleteTarget(null);
  }, [deleteTarget, user, toast]);

  const handleSettings = React.useCallback(
    (page: CampaignPage) => {
      router.push(`/admin/pages/${page.id}/builder?tab=settings`);
    },
    [router],
  );

  const handleViewAnalytics = React.useCallback(
    (page: CampaignPage) => {
      // Future: open analytics slide-over. For now route to campaigns analytics.
      router.push(`/admin/messaging/campaigns?pageId=${page.id}`);
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
        onOpenChange={open => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &quot;{deleteTarget?.name}&quot;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the draft page and all its saved versions.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              Delete Page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainerFluid>
  );
}
