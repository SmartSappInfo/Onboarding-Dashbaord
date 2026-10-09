'use client';

/**
 * @fileOverview Live Conversations / Inbox Preview Mini-Widget.
 * 
 * Part of SmartSapp Communications Hub (Phase 8).
 * Conforms to SmartSapp Agentic Development Rules:
 * - Rule 1: Zero `any` or `any[]` typing.
 * - Rule 7: Mobile-first ergonomic touch targets (`min-h-[44px]`).
 * - Rule 8: Safe relative internal navigation (`/admin/messaging/conversations`).
 * - Rule 9: Bounded preview list with live filtering.
 */

import * as React from 'react';
import Link from 'next/link';
import { Search, ArrowRight, Users, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { InboxThreadPreviewItem } from '@/lib/types/messaging-dashboard';

export interface MessagingInboxPreviewProps {
  items?: InboxThreadPreviewItem[];
  isLoading?: boolean;
  onOpenAiAssistant?: () => void;
  className?: string;
}

export function MessagingInboxPreview({
  items = [],
  isLoading,
  onOpenAiAssistant,
  className,
}: MessagingInboxPreviewProps) {
  const [filter, setFilter] = React.useState<'all' | 'unread' | 'groups' | 'direct'>('all');
  const [search, setSearch] = React.useState('');

  const counts = React.useMemo(() => {
    return {
      all: items.length,
      unread: items.filter((i) => i.unreadCount > 0).length,
      groups: items.filter((i) => i.isGroup).length,
      direct: items.filter((i) => !i.isGroup).length,
    };
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((item) => {
      if (filter === 'unread' && item.unreadCount === 0) return false;
      if (filter === 'groups' && !item.isGroup) return false;
      if (filter === 'direct' && item.isGroup) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.entityName.toLowerCase().includes(query) ||
          item.lastMessageSnippet.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [items, filter, search]);

  if (isLoading) {
    return (
      <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs space-y-3', className)}>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border border-border/80 bg-card p-4 sm:p-5 text-card-foreground shadow-xs', className)}>
      <div className="flex items-center justify-between pb-3 border-b border-border/60">
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-foreground">Conversations Inbox</h3>
          <p className="text-xs text-muted-foreground">Real-time two-way dialogue</p>
        </div>
        <Link
          href="/admin/messaging/conversations"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 active:scale-[0.97] transition-all"
        >
          Open inbox <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="pt-3 space-y-3">
        {/* Search & Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="pl-8 h-9 text-xs rounded-xl bg-muted/20"
            />
          </div>
          <div className="flex items-center gap-1 w-full sm:w-auto bg-muted/30 p-0.5 rounded-lg overflow-x-auto">
            {(
              [
                { key: 'all', label: `All (${counts.all})` },
                { key: 'unread', label: `Unread (${counts.unread})` },
                { key: 'groups', label: `Groups (${counts.groups})` },
                { key: 'direct', label: `Direct (${counts.direct})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={cn(
                  'px-2 py-1 text-[11px] font-medium rounded-md whitespace-nowrap transition-all active:scale-[0.97]',
                  filter === tab.key
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Thread List */}
        <div className="divide-y divide-border/50 min-h-[160px]">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center italic">No conversations found.</p>
          ) : (
            filtered.map((thread) => (
              <Link
                key={thread.threadId}
                href={`/admin/messaging/conversations?thread=${thread.threadId}`}
                className="py-2.5 flex items-center justify-between hover:bg-muted/15 px-2 rounded-xl transition-all group active:scale-[0.98]"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                    {thread.isGroup ? <Users className="w-4 h-4" /> : thread.entityName.charAt(0)}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {thread.entityName}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{thread.lastMessageSnippet}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  {thread.unreadCount > 0 && (
                    <span className="text-[10px] font-bold text-white bg-primary px-1.5 py-0.5 rounded-full tabular-nums">
                      {thread.unreadCount}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {thread.lastMessageChannel === 'whatsapp' ? 'WA' : thread.lastMessageChannel.toUpperCase()}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>

        {/* Docked AI Assistant Trigger Bar */}
        <div className="pt-2 border-t border-border/60">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenAiAssistant}
            aria-label="Ask AI to draft reply"
            className="w-full min-h-[44px] rounded-xl text-xs font-semibold border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center gap-2 active:scale-[0.97] transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Ask AI to draft a response or follow-up →</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
