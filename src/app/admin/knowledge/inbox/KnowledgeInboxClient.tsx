'use client';

/**
 * @fileOverview Knowledge Inbox Client Container (Phase 4 Milestone 4)
 *
 * Implements PRD §62 & §93, Rule 4 (Zero any), Rule 10 (Inline Architectural Docs),
 * Rule 47 (Multi-Tenant Isolation), Rule 51 (Server Actions), Rule 60 (Emergency Pause),
 * Rule 61 (Operator Console Surface), and Rule 62 (Real-Time SSE Reactivity).
 */

import * as React from 'react';
import Link from 'next/link';
import { PageContainerFluid } from '@/components/ui/page-container';
import { useWorkspace } from '@/context/WorkspaceContext';
import { useEventStream } from '@/hooks/useEventStream';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Inbox,
  Sparkles,
  Layers,
  AlertTriangle,
  Clock,
  Archive,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import type { CanonicalMemoryObject } from '@/platform/memory';
import {
  listKnowledgeInboxAction,
  verifyMemoryItemAction,
  rejectMemoryItemAction,
  deleteMemoryItemAction,
  type InboxTab,
} from '@/app/actions/memory-actions';
import { KnowledgeCandidateCard } from '@/components/brain/KnowledgeCandidateCard';
import { KnowledgeItemDrawer } from '@/components/brain/KnowledgeItemDrawer';
import { DeadManPauseBanner } from '@/components/brain/DeadManPauseBanner';

const INBOX_TABS: { id: InboxTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'new', label: 'New Memories', icon: Inbox },
  { id: 'insights', label: 'AI Insights', icon: Sparkles },
  { id: 'potential', label: 'Potential Knowledge', icon: Layers },
  { id: 'conflicts', label: 'Conflicts', icon: AlertTriangle },
  { id: 'unconfirmed', label: 'Needs Confirmation', icon: Clock },
  { id: 'stale', label: 'Stale Memories', icon: Archive },
];

export function KnowledgeInboxClient() {
  const { activeWorkspaceId, activeOrganizationId } = useWorkspace();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = React.useState<InboxTab>('new');
  const [items, setItems] = React.useState<CanonicalMemoryObject[]>([]);
  const [selectedItem, setSelectedItem] = React.useState<CanonicalMemoryObject | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [isPaused, setIsPaused] = React.useState(false);

  const fetchItems = React.useCallback(async () => {
    if (!activeWorkspaceId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await listKnowledgeInboxAction({
        tab: activeTab,
        workspaceId: activeWorkspaceId,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success && res.data) {
        setItems(res.data);
      } else if (res.code === 'MEMORY_DEAD_MAN_PAUSED') {
        setIsPaused(true);
      }
    } catch {
      // Swallowed on mount
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, activeWorkspaceId, activeOrganizationId]);

  React.useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  // Live SSE Stream Reactivity (Rule 62)
  useEventStream({
    workspaceId: activeWorkspaceId,
    enabled: Boolean(activeWorkspaceId),
    onActivity: (activity) => {
      if (activity.eventType === 'memory.ingestion.completed' || activity.eventType === 'memory.item.created') {
        void fetchItems();
      } else if (activity.eventType === 'memory.item.verified' || activity.eventType === 'memory.item.rejected') {
        const resolvedId = (activity.metadata?.id as string) || (activity.entity?.id as string);
        if (resolvedId) {
          setItems((prev) => prev.filter((i) => i.id !== resolvedId));
        }
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
      if (res.success) {
        toast({
          title: 'Knowledge Confirmed',
          description: 'Memory item promoted to institutional knowledge.',
        });
        setItems((prev) => prev.filter((i) => i.id !== id));
        setIsDrawerOpen(false);
      } else {
        toast({
          title: 'Verification Failed',
          description: res.error || 'Failed to verify item.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(true);
    try {
      const res = await rejectMemoryItemAction(id, 'Rejected by operator in Knowledge Inbox', {
        workspaceId: activeWorkspaceId || undefined,
        organizationId: activeOrganizationId || undefined,
      });
      if (res.success) {
        toast({
          title: 'Knowledge Invalidated',
          description: 'Candidate marked as invalid and quarantined.',
        });
        setItems((prev) => prev.filter((i) => i.id !== id));
        setIsDrawerOpen(false);
      } else {
        toast({
          title: 'Rejection Failed',
          description: res.error || 'Failed to reject item.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
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
        toast({
          title: 'Memory Deleted',
          description: 'Item permanently deleted from memory store and vector index.',
        });
        setItems((prev) => prev.filter((i) => i.id !== id));
        setIsDrawerOpen(false);
      } else {
        toast({
          title: 'Deletion Failed',
          description: res.error || 'Failed to delete item.',
          variant: 'destructive',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed';
      toast({ title: 'Error', description: message, variant: 'destructive' });
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
      {/* Zone 1: Header & Mission Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/70">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Knowledge Inbox</h1>
            <Badge variant="outline" className="font-mono text-xs">
              Triage Desk
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Review, confirm, or invalidate candidate memories generated from calls, notes, and AI insights (PRD §62 & §93).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchItems()}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.97] text-xs h-9"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            asChild
            variant="default"
            size="sm"
            className="rounded-xl active:scale-[0.97] text-xs h-9 bg-primary text-primary-foreground"
          >
            <Link href="/admin/brain">
              <span>Company Brain</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>

      <DeadManPauseBanner isPaused={isPaused} />

      {/* Zone 2: PRD §93 Triage Tabs */}
      <div className="space-y-4">
        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as InboxTab)}
          className="w-full"
        >
          <div className="overflow-x-auto pb-1 scrollbar-none">
            <TabsList className="bg-muted/40 p-1 rounded-xl h-auto gap-1 inline-flex min-w-full sm:min-w-0">
              {INBOX_TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="rounded-lg text-xs font-medium px-3 py-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-1.5 active:scale-[0.97]"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{t.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>
        </Tabs>

        {/* Zone 3: Candidates Stream / Grid */}
        {isLoading ? (
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
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="text-base font-semibold">Inbox Zero</h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
              No pending candidates in this category. New meeting takeaways, CRM note deductions, and AI insights will appear here automatically.
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
