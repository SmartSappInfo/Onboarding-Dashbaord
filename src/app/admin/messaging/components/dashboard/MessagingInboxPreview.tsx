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
import { Search, ArrowRight, Users, Sparkles, Mail, Smartphone, MessageSquare, Inbox } from 'lucide-react';
import { CardInfoTooltip } from '@/components/ui/card-info-tooltip';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toDisplayText } from '@/lib/utils/display-text';
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
      direct: items.filter((i) => (i.isDirect ?? !i.isGroup)).length,
    };
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((item) => {
      if (filter === 'unread' && item.unreadCount === 0) return false;
      if (filter === 'groups' && !item.isGroup) return false;
      if (filter === 'direct' && !(item.isDirect ?? !item.isGroup)) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const cleanSnippet = toDisplayText(item.lastMessageSnippet).toLowerCase();
        const recipient = (item.recipientName || '').toLowerCase();
        const institution = (item.institutionName || '').toLowerCase();
        const entity = item.entityName.toLowerCase();
        const email = (item.email || '').toLowerCase();
        const phone = (item.phone || '').toLowerCase();
        const address = (item.contactAddress || '').toLowerCase();

        return (
          recipient.includes(query) ||
          institution.includes(query) ||
          entity.includes(query) ||
          email.includes(query) ||
          phone.includes(query) ||
          address.includes(query) ||
          cleanSnippet.includes(query)
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
      <div className="flex items-center justify-between pb-3 border-b border-border/60 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
            <Inbox className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
              Conversations Inbox
            </h3>
            <CardInfoTooltip text="Real-time two-way dialogue, replies, and active conversation threads." />
          </div>
        </div>
        <Link
          href="/admin/messaging/conversations"
          className="text-xs font-medium text-primary hover:underline flex items-center gap-1 active:scale-[0.97] transition-all shrink-0"
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
            filtered.map((thread) => {
              const recipient = thread.recipientName || thread.entityName;
              const institution = thread.institutionName && thread.institutionName !== recipient ? thread.institutionName : null;
              const isEmail = thread.lastMessageChannel === 'email';
              const isWhatsapp = thread.lastMessageChannel === 'whatsapp';
              const isSms = thread.lastMessageChannel === 'sms';

              // Channel-specific contact address (email for email, phone for sms/whatsapp)
              const address = isEmail
                ? (thread.email || thread.contactAddress || (thread.phone ? thread.phone : null))
                : (thread.phone || thread.contactAddress || (thread.email ? thread.email : null));

              const cleanSnippet = toDisplayText(thread.lastMessageSnippet) || 'No message content';
              const avatarLetter = (recipient || 'C').charAt(0).toUpperCase();

              return (
                <Link
                  key={thread.threadId}
                  href={`/admin/messaging/conversations?thread=${thread.threadId}`}
                  className="py-2.5 px-2.5 flex items-center justify-between hover:bg-muted/15 rounded-xl transition-all group active:scale-[0.98] min-h-[44px] overflow-hidden w-full max-w-full gap-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {thread.isGroup ? <Users className="w-4 h-4" /> : avatarLetter}
                    </div>

                    <div className="flex-1 min-w-0 max-w-full overflow-hidden space-y-0.5">
                      {/* Line 1: Recipient Name & Entity / Institution Name */}
                      <div className="flex items-center gap-1.5 min-w-0 w-full overflow-hidden">
                        <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {recipient}
                        </span>
                        {institution && (
                          <span className="text-[11px] font-medium text-muted-foreground truncate">
                            · {institution}
                          </span>
                        )}
                      </div>

                      {/* Line 2: Email or Phone depending on message type */}
                      {address && (
                        <div className="text-[11px] text-muted-foreground flex items-center gap-1 min-w-0 w-full overflow-hidden leading-tight font-normal">
                          {isEmail ? (
                            <>
                              <Mail className="h-3 w-3 shrink-0 text-blue-500/80" />
                              <span className="truncate">{address}</span>
                            </>
                          ) : isWhatsapp ? (
                            <>
                              <MessageSquare className="h-3 w-3 shrink-0 text-emerald-500/80" />
                              <span className="truncate tabular-nums">{address}</span>
                            </>
                          ) : isSms ? (
                            <>
                              <Smartphone className="h-3 w-3 shrink-0 text-orange-500/80" />
                              <span className="truncate tabular-nums">{address}</span>
                            </>
                          ) : (
                            <span className="truncate">{address}</span>
                          )}
                        </div>
                      )}

                      {/* Line 3: Message preview snippet (no raw html, cleanly truncated) */}
                      <p className="text-[11px] text-muted-foreground/80 truncate pt-0.5">
                        {cleanSnippet}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-center gap-1 shrink-0 ml-1">
                    <span
                      className={cn(
                        'text-[9px] font-semibold px-1.5 py-0.5 rounded font-mono',
                        isEmail && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
                        isWhatsapp && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
                        isSms && 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
                        !isEmail && !isWhatsapp && !isSms && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {isWhatsapp ? 'WA' : thread.lastMessageChannel.toUpperCase()}
                    </span>

                    {thread.unreadCount > 0 && (
                      <span className="text-[10px] font-bold text-white bg-primary px-1.5 py-0.2 rounded-full tabular-nums">
                        {thread.unreadCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
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
