'use client';

/**
 * @fileOverview Company Brain Workspace Console (Phase 4 Milestone 4)
 *
 * Implements Three-Zone Layout:
 * - Zone 1: Executive KPI Metrics (`CompanyBrainMetrics.tsx`) & Dead-Man Switch Banner
 * - Zone 2: Real-time Semantic Search & Filter Bar (`KnowledgeSearchBox.tsx`)
 * - Zone 3: Knowledge Item Stream with Standardized Inspector Drawer (`KnowledgeItemDrawer.tsx`, `theme.md` §8)
 *
 * Governance & Reactivity (Rules 4, 7, 8, 10, 22, 29, 30, 32, 47, 51, 60, 61, 62, 64):
 * - Live real-time ingestion reactivity via `useEventStream` (Rule 62)
 * - Multi-tenant isolation and anti-IDOR validation (Rules 8 & 47)
 * - Emil Kowalski mechanical tactile feedback (Rule 64)
 */

import * as React from 'react';
import Link from 'next/link';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useEventStream } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Inbox,
  RefreshCw,
  FolderOpen,
  Network,
} from 'lucide-react';
import type { CanonicalMemoryObject, MemoryStats } from '@/platform/memory';
import {
  searchMemoryAction,
  getMemoryBrainMetricsAction,
  verifyMemoryItemAction,
  rejectMemoryItemAction,
  deleteMemoryItemAction,
} from '@/app/actions/memory-actions';
import { CompanyBrainMetrics } from '@/components/brain/CompanyBrainMetrics';
import {
  KnowledgeSearchBox,
  type KnowledgeSearchFilters,
} from '@/components/brain/KnowledgeSearchBox';
import { KnowledgeCandidateCard } from '@/components/brain/KnowledgeCandidateCard';
import { KnowledgeItemDrawer } from '@/components/brain/KnowledgeItemDrawer';
import { CardInfoTooltip } from '@/components/shared/CardInfoTooltip';
import { DeadManPauseBanner } from '@/components/brain/DeadManPauseBanner';
import { KnowledgeGraphCanvas } from '@/components/brain/KnowledgeGraphCanvas';

export function BrainClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [stats, setStats] = React.useState<MemoryStats | null>(null);
  const [items, setItems] = React.useState<CanonicalMemoryObject[]>([]);
  const [selectedItem, setSelectedItem] = React.useState<CanonicalMemoryObject | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isLoadingItems, setIsLoadingItems] = React.useState(true);
  const [isLoadingStats, setIsLoadingStats] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'stream' | 'graph'>('stream');

  const [filters, setFilters] = React.useState<KnowledgeSearchFilters>({
    query: '',
    tier: 'all',
    sourceType: 'all',
    sensitivity: 'all',
  });

  const fetchStats = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoadingStats(true);
    try {
      const res = await getMemoryBrainMetricsAction({
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch {
      // Swallowed on mount
    } finally {
      setIsLoadingStats(false);
    }
  }, [activeWorkspaceId, activeOrganizationId]);

  const fetchItems = React.useCallback(async () => {
    if (!activeWorkspaceId) {
      setIsLoadingItems(false);
      return;
    }
    setIsLoadingItems(true);
    try {
      const res = await searchMemoryAction({
        query: filters.query || '*',
        limit: 50,
        tiers: filters.tier !== 'all' ? [filters.tier] : undefined,
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success && res.data) {
        let results = res.data;
        if (filters.sourceType !== 'all') {
          results = results.filter((i) => i.source.type === filters.sourceType);
        }
        setItems(results);
      } else if (res.code === 'MEMORY_DEAD_MAN_PAUSED') {
        setIsPaused(true);
      }
    } catch {
      // Swallowed on mount
    } finally {
      setIsLoadingItems(false);
    }
  }, [filters, activeWorkspaceId, activeOrganizationId]);

  React.useEffect(() => {
    void fetchStats();
    void fetchItems();
  }, [fetchStats, fetchItems]);

  // Live SSE Stream Reactivity (Rule 62)
  useEventStream({
    workspaceId: activeWorkspaceId,
    enabled: Boolean(activeWorkspaceId),
    onActivity: (activity) => {
      if (
        activity.eventType === 'memory.ingestion.completed' ||
        activity.eventType === 'memory.item.created' ||
        activity.eventType === 'memory.item.superseded' ||
        activity.eventType === 'memory.item.deleted'
      ) {
        void fetchStats();
        void fetchItems();
      }
    },
  });

  const handleVerify = async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await verifyMemoryItemAction(id, undefined, {
        workspaceId: activeWorkspaceId || undefined,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success && res.data) {
        toast({ title: 'Item Verified', description: 'Institutional memory record confirmed.' });
        setItems((prev) => prev.map((i) => (i.id === id ? res.data! : i)));
        if (selectedItem?.id === id) setSelectedItem(res.data);
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to verify item', variant: 'destructive' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await rejectMemoryItemAction(id, 'Invalidated via Company Brain console', {
        workspaceId: activeWorkspaceId || undefined,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success && res.data) {
        toast({ title: 'Item Invalidated', description: 'Memory record marked as invalid.' });
        setItems((prev) => prev.map((i) => (i.id === id ? res.data! : i)));
        if (selectedItem?.id === id) setSelectedItem(res.data);
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to reject item', variant: 'destructive' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await deleteMemoryItemAction(id, {
        workspaceId: activeWorkspaceId || undefined,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success) {
        toast({ title: 'Deleted', description: 'Memory item deleted permanently.' });
        setItems((prev) => prev.filter((i) => i.id !== id));
        setIsDrawerOpen(false);
        void fetchStats();
      } else {
        toast({ title: 'Error', description: res.error || 'Failed to delete item', variant: 'destructive' });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInspect = (item: CanonicalMemoryObject) => {
    setSelectedItem(item);
    setIsDrawerOpen(true);
  };

  return (
    <PageContainerFluid className="space-y-6 py-6 max-w-7xl mx-auto">
      {/* Zone 1: Header, Executive KPI Metrics & Mission Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Company Brain</h1>
          <CardInfoTooltip text="Institutional memory control plane unifying dense vectors, episodic action history, and organizational knowledge." />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void fetchStats();
              void fetchItems();
            }}
            disabled={isLoadingItems || isLoadingStats}
            className="rounded-xl active:scale-[0.97] text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoadingItems || isLoadingStats ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            asChild
            variant="default"
            size="sm"
            className="rounded-xl active:scale-[0.97] text-xs h-9 bg-primary text-primary-foreground"
          >
            <Link href="/admin/knowledge/inbox">
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              <span>Knowledge Inbox</span>
              {stats?.inboxPending ? (
                <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-500 text-white font-mono text-[10px]">
                  {stats.inboxPending}
                </span>
              ) : null}
            </Link>
          </Button>
        </div>
      </div>

      <DeadManPauseBanner isPaused={isPaused} />

      <CompanyBrainMetrics stats={stats} isLoading={isLoadingStats} />

      {/* Zone 2: Real-time Search & Filter Toolbar */}
      <div className="pt-2">
        <KnowledgeSearchBox
          filters={filters}
          onFiltersChange={setFilters}
          isLoading={isLoadingItems}
        />
      </div>

      {/* Zone 3: Knowledge Stream / Graph Mesh */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border/60">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={viewMode === 'stream' ? 'default' : 'outline'}
              onClick={() => setViewMode('stream')}
              className="h-8 px-3 text-xs rounded-xl active:scale-[0.97]"
            >
              Memory Stream
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'graph' ? 'default' : 'outline'}
              onClick={() => setViewMode('graph')}
              className="h-8 px-3 text-xs rounded-xl active:scale-[0.97] gap-1.5"
            >
              <Network className="h-3.5 w-3.5 text-primary" />
              Knowledge Graph Mesh
            </Button>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <span className="font-medium">
              {isLoadingItems ? 'Searching memory...' : `${items.length} knowledge record${items.length === 1 ? '' : 's'} found`}
            </span>
            {filters.query && (
              <span className="font-mono text-[11px]">
                Query: &quot;{filters.query}&quot;
              </span>
            )}
          </div>
        </div>

        {viewMode === 'graph' ? (
          <KnowledgeGraphCanvas centerNodeId={items[0]?.id || activeWorkspaceId || 'ent_workspace'} />
        ) : (
          <div>
            {isLoadingItems ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <div
                    key={idx}
                    className="h-44 rounded-xl border border-border/60 bg-muted/20 animate-pulse"
                  />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-border/80 bg-card/40 p-12 text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <FolderOpen className="h-6 w-6 text-muted-foreground/60" />
                </div>
                <h3 className="text-base font-semibold">No Knowledge Items Found</h3>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  No institutional memories matched your search or filters. Try adjusting your query or importing documents via the Knowledge Ingestion Pipeline.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item) => (
                  <KnowledgeCandidateCard
                    key={item.id}
                    item={item}
                    onInspect={handleInspect}
                    onVerify={handleVerify}
                    onReject={handleReject}
                    isProcessing={isProcessing}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Standardized Memory Inspector Drawer (theme.md §8) */}
      <KnowledgeItemDrawer
        item={selectedItem}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
        onVerify={handleVerify}
        onReject={handleReject}
        onDelete={handleDelete}
        isProcessing={isProcessing}
      />
    </PageContainerFluid>
  );
}
