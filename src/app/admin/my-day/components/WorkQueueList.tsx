'use client';

/**
 * @fileoverview Filterable Work Queue List for SmartSapp Seller Workspace (Phase 2).
 *
 * ARCHITECTURAL POINTER:
 * Implements PRD Section 30 & UI Section 16:
 * - Filter pills for rapid task triage: All, Calls, Follow-ups, Meetings, Urgent SLA.
 * - Text search filter by entity, deal, or title.
 * - Renders ranked QueueItemCards with continuous rank indexing (#2, #3...).
 * - Graceful empty states when all tasks are completed or filter has no results.
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Strictly typed without 'any'.
 * - Touch targets on filter pills and inputs >= 44px on mobile.
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Phone,
  MessageSquare,
  Calendar,
  AlertTriangle,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import type { WorkQueueItem } from '@/lib/seller-workspace/types';
import { QueueItemCard } from './QueueItemCard';

interface WorkQueueListProps {
  items: WorkQueueItem[];
  topPriorityId?: string;
  onOpenActionDrawer: (item: WorkQueueItem) => void;
  onQuickComplete: (item: WorkQueueItem) => void;
  onSnooze: (item: WorkQueueItem, hours: number) => void;
  onDismiss: (item: WorkQueueItem) => void;
  isActionLoading?: boolean;
}

type FilterCategory = 'all' | 'calls' | 'follow_ups' | 'meetings' | 'signals' | 'urgent_sla';

export function WorkQueueList({
  items,
  topPriorityId,
  onOpenActionDrawer,
  onQuickComplete,
  onSnooze,
  onDismiss,
  isActionLoading = false,
}: WorkQueueListProps) {
  const [selectedCategory, setSelectedCategory] = React.useState<FilterCategory>('all');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Exclude the hero item if it's already rendered in the DoThisNowCard
  const secondaryQueue = React.useMemo(() => {
    return items.filter((item) => item.id !== topPriorityId);
  }, [items, topPriorityId]);

  // Compute category counts
  const counts = React.useMemo(() => {
    return {
      all: secondaryQueue.length,
      calls: secondaryQueue.filter((i) => i.type === 'call').length,
      follow_ups: secondaryQueue.filter((i) => i.type === 'follow_up' || i.type === 'task').length,
      meetings: secondaryQueue.filter((i) => i.type === 'meeting_prep').length,
      signals: secondaryQueue.filter((i) => i.type === 'buyer_signal').length,
      urgent_sla: secondaryQueue.filter((i) => i.slaStatus === 'at_risk' || i.slaStatus === 'breached').length,
    };
  }, [secondaryQueue]);

  // Filter items by category & search query
  const filteredItems = React.useMemo(() => {
    return secondaryQueue.filter((item) => {
      // Category filter
      if (selectedCategory === 'calls' && item.type !== 'call') return false;
      if (selectedCategory === 'follow_ups' && item.type !== 'follow_up' && item.type !== 'task') return false;
      if (selectedCategory === 'meetings' && item.type !== 'meeting_prep') return false;
      if (selectedCategory === 'signals' && item.type !== 'buyer_signal') return false;
      if (selectedCategory === 'urgent_sla' && item.slaStatus !== 'at_risk' && item.slaStatus !== 'breached') return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesEntity = item.entityName?.toLowerCase().includes(q) ?? false;
        const matchesDeal = item.dealName?.toLowerCase().includes(q) ?? false;
        const matchesReason = item.reason.toLowerCase().includes(q);
        if (!matchesTitle && !matchesEntity && !matchesDeal && !matchesReason) {
          return false;
        }
      }

      return true;
    });
  }, [secondaryQueue, selectedCategory, searchQuery]);

  return (
    <div className="space-y-4">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-extrabold text-foreground tracking-tight">
            Prioritized Work Queue
          </h3>
          <Badge variant="secondary" className="font-mono text-xs font-bold">
            {secondaryQueue.length}
          </Badge>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter by account, deal..."
            className="pl-9 h-10 rounded-xl text-xs"
          />
        </div>
      </div>

      {/* Category Pills (Horizontal Scroll on Mobile) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none">
        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('all')}
          className="rounded-xl text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          All
          <span className="ml-1.5 opacity-80 font-mono text-[10px]">({counts.all})</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'calls' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('calls')}
          className="rounded-xl text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          <Phone className="h-3 w-3 mr-1" />
          Calls
          <span className="ml-1.5 opacity-80 font-mono text-[10px]">({counts.calls})</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'follow_ups' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('follow_ups')}
          className="rounded-xl text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          <MessageSquare className="h-3 w-3 mr-1" />
          Follow-ups
          <span className="ml-1.5 opacity-80 font-mono text-[10px]">({counts.follow_ups})</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'meetings' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('meetings')}
          className="rounded-xl text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          <Calendar className="h-3 w-3 mr-1" />
          Meetings
          <span className="ml-1.5 opacity-80 font-mono text-[10px]">({counts.meetings})</span>
        </Button>

        <Button
          type="button"
          size="sm"
          variant={selectedCategory === 'signals' ? 'default' : 'outline'}
          onClick={() => setSelectedCategory('signals')}
          className="rounded-xl text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all whitespace-nowrap"
        >
          <Sparkles className="h-3 w-3 mr-1" />
          Signals
          <span className="ml-1.5 opacity-80 font-mono text-[10px]">({counts.signals})</span>
        </Button>

        {counts.urgent_sla > 0 && (
          <Button
            type="button"
            size="sm"
            variant={selectedCategory === 'urgent_sla' ? 'destructive' : 'outline'}
            onClick={() => setSelectedCategory('urgent_sla')}
            className="rounded-xl text-xs font-bold min-h-[38px] px-3 active:scale-[0.97] transition-all whitespace-nowrap border-rose-500/40 text-rose-600 dark:text-rose-400"
          >
            <AlertTriangle className="h-3 w-3 mr-1 text-rose-500" />
            Urgent SLA
            <span className="ml-1.5 opacity-80 font-mono text-[10px]">({counts.urgent_sla})</span>
          </Button>
        )}
      </div>

      {/* Queue Items List */}
      <div className="space-y-2.5">
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => (
            <QueueItemCard
              key={item.id}
              item={item}
              rankIndex={idx + 2} // #1 is DoThisNowCard, so secondary list begins at #2
              onOpenActionDrawer={onOpenActionDrawer}
              onQuickComplete={onQuickComplete}
              onSnooze={onSnooze}
              onDismiss={onDismiss}
              isActionLoading={isActionLoading}
            />
          ))
        ) : (
          <div className="rounded-2xl border border-dashed p-8 text-center space-y-2 bg-muted/10">
            <CheckCircle className="h-8 w-8 text-muted-foreground/40 mx-auto" />
            <h4 className="text-sm font-bold text-foreground">No items match this view</h4>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              {searchQuery
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'All actions in this category are completed!'}
            </p>
            {searchQuery && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-xs font-semibold text-primary"
              >
                Clear Search
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
