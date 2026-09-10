'use client';

import * as React from 'react';
import {
  Inbox,
  Sparkles,
  Search,
  CheckCheck,
  XCircle,
  RefreshCw,
  CheckCircle,
  Tag,
  Link2,
  GitMerge,
  AlertTriangle,
  Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type {
  KnowledgeInboxItem,
  KnowledgeInboxType,
  KnowledgeInboxStatus,
} from '@/lib/quick-notes-types';
import { filterInboxItems } from '@/lib/quick-notes-domain';
import {
  getWorkspaceInboxAction,
  reviewInboxItemAction,
  bulkReviewInboxAction,
} from '@/lib/quick-notes-insight-actions';
import { InboxItemCard } from './InboxItemCard';
import { MergeNotesModal } from './MergeNotesModal';
import { InboxReviewDrawer } from './InboxReviewDrawer';
import { OrganizationMemoryView } from '@/components/memory/OrganizationMemoryView';

interface KnowledgeInboxViewProps {
  workspaceId: string;
  userId: string;
  initialItems?: KnowledgeInboxItem[];
}

export function KnowledgeInboxView({
  workspaceId,
  userId,
  initialItems = [],
}: KnowledgeInboxViewProps) {
  const { toast } = useToast();

  const [items, setItems] = React.useState<KnowledgeInboxItem[]>(initialItems);
  const [isLoading, setIsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<KnowledgeInboxType | 'all'>('all');
  const [statusFilter, setStatusFilter] = React.useState<KnowledgeInboxStatus | 'all'>('pending');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedItemIds, setSelectedItemIds] = React.useState<Set<string>>(new Set());

  // Modal / Drawer state
  const [mergeTargetItem, setMergeTargetItem] = React.useState<KnowledgeInboxItem | null>(null);
  const [drawerTargetItem, setDrawerTargetItem] = React.useState<KnowledgeInboxItem | null>(null);

  // Refresh inbox
  const handleRefresh = async () => {
    if (activeTab === 'memory_review') return;
    setIsLoading(true);
    try {
      const res = await getWorkspaceInboxAction(workspaceId, {
        status: statusFilter,
        type: activeTab,
      });
      if (res.success && res.data) {
        setItems(res.data);
      }
    } catch {
      toast({ title: 'Error refreshing inbox', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    handleRefresh();
  }, [workspaceId, statusFilter, activeTab]);

  // Filtered items
  const filteredItems = React.useMemo(() => {
    return filterInboxItems(items, {
      type: activeTab,
      status: statusFilter,
      searchQuery,
    });
  }, [items, activeTab, statusFilter, searchQuery]);

  // Tab counts
  const counts = React.useMemo(() => {
    const pending = items.filter((i) => i.status === 'pending');
    return {
      all: pending.length,
      classification: pending.filter((i) => i.type === 'classification').length,
      link_suggestion: pending.filter((i) => i.type === 'link_suggestion').length,
      duplicate_detection: pending.filter((i) => i.type === 'duplicate_detection').length,
      contradiction_detection: pending.filter((i) => i.type === 'contradiction_detection').length,
      ai_insight: pending.filter((i) => i.type === 'ai_insight').length,
      action_suggestion: pending.filter((i) => i.type === 'action_suggestion').length,
      memory_review: pending.filter((i) => i.type === 'memory_review').length,
    };
  }, [items]);

  // Single accept
  const handleAccept = async (item: KnowledgeInboxItem) => {
    try {
      const res = await reviewInboxItemAction(workspaceId, item.id, 'accept', item.suggestedPatch, userId);
      if (res.success && res.data) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data! : i)));
        toast({ title: 'Suggestion accepted and applied' });
      } else {
        toast({ title: 'Failed to accept', description: res.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error accepting suggestion', variant: 'destructive' });
    }
  };

  // Single dismiss
  const handleDismiss = async (item: KnowledgeInboxItem) => {
    try {
      const res = await reviewInboxItemAction(workspaceId, item.id, 'dismiss', undefined, userId);
      if (res.success && res.data) {
        setItems((prev) => prev.map((i) => (i.id === item.id ? res.data! : i)));
        toast({ title: 'Suggestion dismissed' });
      }
    } catch {
      toast({ title: 'Error dismissing suggestion', variant: 'destructive' });
    }
  };

  // Bulk actions
  const handleBulkAction = async (resolution: 'accept' | 'dismiss') => {
    const ids = Array.from(selectedItemIds);
    if (ids.length === 0) return;

    try {
      const res = await bulkReviewInboxAction(workspaceId, ids, resolution, userId);
      if (res.success) {
        toast({
          title: `Bulk ${resolution === 'accept' ? 'accepted' : 'dismissed'} ${res.count} items`,
        });
        setSelectedItemIds(new Set());
        handleRefresh();
      }
    } catch {
      toast({ title: 'Error executing bulk action', variant: 'destructive' });
    }
  };

  const _handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
    } else {
      setSelectedItemIds(new Set());
    }
  };

  const handleToggleSelect = (id: string, selected: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Inbox className="h-5 w-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Knowledge Inbox</h1>
            <Badge variant="secondary" className="font-mono text-xs font-bold px-2 py-0.5">
              {counts.all} pending
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Human-in-the-loop review queue for AI-discovered links, duplicate notes, and contradiction alerts.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
            className="h-9 text-xs font-semibold gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Category Tabs & Filter Toolbar */}
      <div className="space-y-4">
        {/* Category Pills (Horizontal Scrolling on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs font-semibold">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All Categories
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30">{counts.all}</span>
          </button>

          <button
            onClick={() => setActiveTab('duplicate_detection')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'duplicate_detection'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <GitMerge className="h-3.5 w-3.5" />
            Duplicates
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30">{counts.duplicate_detection}</span>
          </button>

          <button
            onClick={() => setActiveTab('contradiction_detection')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'contradiction_detection'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            Contradictions
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30">{counts.contradiction_detection}</span>
          </button>

          <button
            onClick={() => setActiveTab('link_suggestion')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'link_suggestion'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            Link Suggestions
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30">{counts.link_suggestion}</span>
          </button>

          <button
            onClick={() => setActiveTab('classification')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'classification'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Tag className="h-3.5 w-3.5" />
            Classifications
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30">{counts.classification}</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_insight')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'ai_insight'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Insights
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-background/30">{counts.ai_insight}</span>
          </button>

          <button
            onClick={() => setActiveTab('memory_review')}
            className={`px-3 py-1.5 rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'memory_review'
                ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            <Brain className="h-3.5 w-3.5 text-indigo-500" />
            Organization Memories
          </button>
        </div>

        {/* Search & Status Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search suggestions by title, note name, or topic..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl text-xs font-semibold">
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === 'pending' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('accepted')}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === 'accepted' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Accepted
              </button>
              <button
                onClick={() => setStatusFilter('dismissed')}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === 'dismissed' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                Dismissed
              </button>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg ${
                  statusFilter === 'all' ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground'
                }`}
              >
                All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar (Visible when items selected) */}
      {selectedItemIds.size > 0 && (
        <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="text-xs font-bold text-primary">
            {selectedItemIds.size} suggestion{selectedItemIds.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleBulkAction('dismiss')}
              className="h-8 text-xs font-semibold text-destructive hover:bg-destructive/10"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" />
              Dismiss Selected
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkAction('accept')}
              className="h-8 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Accept Selected
            </Button>
          </div>
        </div>
      )}

      {/* Items List or Organization Memories View */}
      {activeTab === 'memory_review' ? (
        <OrganizationMemoryView workspaceId={workspaceId} userId={userId} />
      ) : (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-border bg-muted/10 space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mx-auto">
                <CheckCircle className="h-6 w-6" />
              </span>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-foreground">You&apos;re all caught up!</h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  No pending suggestions in this category. New AI-discovered links, duplicate merges, and contradiction
                  alerts will appear here.
                </p>
              </div>
            </div>
          ) : (
            filteredItems.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                isSelected={selectedItemIds.has(item.id)}
                onSelect={(checked) => handleToggleSelect(item.id, checked)}
                onAccept={handleAccept}
                onDismiss={handleDismiss}
                onOpenMerge={(target) => setMergeTargetItem(target)}
                onOpenDrawer={(target) => setDrawerTargetItem(target)}
              />
            ))
          )}
        </div>
      )}

      {/* Merge Notes Modal */}
      <MergeNotesModal
        item={mergeTargetItem}
        workspaceId={workspaceId}
        userId={userId}
        open={Boolean(mergeTargetItem)}
        onClose={() => setMergeTargetItem(null)}
        onMergedSuccess={() => {
          if (mergeTargetItem) {
            handleAccept(mergeTargetItem);
          }
        }}
      />

      {/* Detailed Review Drawer */}
      <InboxReviewDrawer
        item={drawerTargetItem}
        open={Boolean(drawerTargetItem)}
        onClose={() => setDrawerTargetItem(null)}
        onAccept={handleAccept}
        onDismiss={handleDismiss}
      />
    </div>
  );
}
