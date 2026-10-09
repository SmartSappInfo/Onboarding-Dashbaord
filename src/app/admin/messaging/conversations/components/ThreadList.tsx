import * as React from 'react';
import { Search, Mail, Smartphone, MessageSquare, PanelLeftClose, Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ThreadGroup } from '../ConversationsClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';

export interface ThreadListProps {
  threads: ThreadGroup[];
  selectedEntityId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
  isCapped?: boolean;
  onLoadMore?: () => void;
  className?: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function formatThreadDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
  return isToday ? timeFormatter.format(date) : dateFormatter.format(date);
}

export default function ThreadList({
  threads,
  selectedEntityId,
  onSelect,
  searchQuery,
  onSearchChange,
  isCollapsed = false,
  onToggleCollapse,
  hasMore = false,
  isLoadingMore = false,
  isCapped = false,
  onLoadMore,
  className,
}: ThreadListProps) {
  if (isCollapsed) {
    return null;
  }

  return (
    <div
      className={cn(
        'w-80 shrink-0 border-r border-border bg-background flex flex-col h-full z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)] overflow-x-hidden',
        className
      )}
    >
      {/* Header & Search */}
      <div className="p-4 border-b border-border/50 shrink-0 space-y-3.5 bg-muted/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Inbox</h2>
            <Badge variant="secondary" className="font-mono text-[10px] tabular-nums px-2 py-0.5">
              {threads.length}
            </Badge>
          </div>

          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleCollapse}
              title="Collapse inbox list"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground active:scale-[0.97]"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search messages, names, schools…"
            className="pl-9 h-10 rounded-xl bg-background border-none shadow-xs focus-visible:ring-primary/20 text-xs"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Thread List Items (No horizontal scroll, clamped cards) */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="p-2 space-y-1 overflow-x-hidden">
          {threads.map((thread) => {
            const isSelected = thread.entityId === selectedEntityId;
            const hasUnread = thread.unreadCount > 0;
            const displayName = thread.contactName || thread.entityName || 'Contact';
            const initials = displayName.substring(0, 2).toUpperCase();
            const channels = Array.from(new Set(thread.messages.map((m) => m.channel)));

            return (
              <button
                key={thread.entityId}
                onClick={() => onSelect(thread.entityId)}
                className={cn(
                  'w-full text-left p-3 rounded-xl transition-all flex gap-3 relative group outline-none overflow-x-hidden',
                  'active:scale-[0.98] min-h-[44px]',
                  isSelected
                    ? 'bg-primary/10 hover:bg-primary/15'
                    : 'even:bg-muted/20 dark:even:bg-muted/10 hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary/20'
                )}
              >
                {/* Left Unread Indicator Bar */}
                {hasUnread && !isSelected && (
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-primary" />
                )}

                {/* Avatar */}
                <Avatar
                  className={cn(
                    'h-10 w-10 border-2 shrink-0 transition-colors',
                    isSelected ? 'border-primary/20' : 'border-border/50 group-hover:border-border'
                  )}
                >
                  <AvatarFallback
                    className={cn(
                      'text-xs font-bold',
                      isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Content Container (min-w-0 flex-1 avoids horizontal scroll) */}
                <div className="flex-1 min-w-0 flex flex-col justify-center space-y-1 overflow-x-hidden">
                  {/* Line 1: Contact Name · Institution Name & Timestamp */}
                  <div className="flex items-center justify-between gap-1.5 min-w-0">
                    <div className="min-w-0 flex-1 flex items-baseline gap-1 truncate">
                      <span
                        className={cn(
                          'text-xs font-bold truncate transition-colors',
                          isSelected
                            ? 'text-primary'
                            : hasUnread
                            ? 'text-foreground font-extrabold'
                            : 'text-foreground/90'
                        )}
                      >
                        {thread.contactName || thread.entityName}
                      </span>
                      {thread.institutionName &&
                        thread.institutionName !== (thread.contactName || thread.entityName) && (
                          <span className="text-[11px] font-normal text-muted-foreground truncate">
                            · {thread.institutionName}
                          </span>
                        )}
                    </div>

                    <div className="shrink-0 flex items-center gap-1.5">
                      <span
                        className={cn(
                          'text-[10px] whitespace-nowrap font-medium tabular-nums',
                          hasUnread && !isSelected ? 'text-primary font-bold' : 'text-muted-foreground'
                        )}
                      >
                        {formatThreadDate(thread.lastMessageTimestamp)}
                      </span>
                      {hasUnread && !isSelected && (
                        <Badge
                          variant="default"
                          className="h-4 min-w-4 px-1 flex items-center justify-center text-[9px] font-bold rounded-full pointer-events-none tabular-nums"
                        >
                          {thread.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Line 2: Subtext line (Email • Phone) */}
                  {(thread.email || thread.phone) && (
                    <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-normal min-w-0 overflow-hidden leading-tight">
                      {thread.email && (
                        <span className="truncate min-w-0 flex-1">{thread.email}</span>
                      )}
                      {thread.email && thread.phone && (
                        <span className="shrink-0 text-muted-foreground/40">•</span>
                      )}
                      {thread.phone && (
                        <span className="truncate min-w-0 shrink-0 tabular-nums">
                          {thread.phone}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Line 3: Channel Icons & Message Preview Snippet */}
                  <div className="flex items-center gap-1.5 min-w-0 pt-0.5">
                    <div className="flex -space-x-1 shrink-0">
                      {channels.includes('email') && (
                        <div
                          className={cn(
                            'rounded-full p-0.5 z-20 border-2',
                            isSelected
                              ? 'bg-blue-500/10 text-blue-600 border-primary/10'
                              : 'bg-muted text-muted-foreground border-background'
                          )}
                        >
                          <Mail className="h-2 w-2" />
                        </div>
                      )}
                      {channels.includes('sms') && (
                        <div
                          className={cn(
                            'rounded-full p-0.5 z-10 border-2',
                            isSelected
                              ? 'bg-orange-500/10 text-orange-600 border-primary/10'
                              : 'bg-muted text-muted-foreground border-background'
                          )}
                        >
                          <Smartphone className="h-2 w-2" />
                        </div>
                      )}
                      {channels.includes('whatsapp') && (
                        <div
                          className={cn(
                            'rounded-full p-0.5 z-0 border-2',
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-600 border-primary/10'
                              : 'bg-muted text-muted-foreground border-background'
                          )}
                        >
                          <MessageSquare className="h-2 w-2" />
                        </div>
                      )}
                    </div>

                    <p
                      className={cn(
                        'text-xs truncate transition-colors flex-1 min-w-0',
                        hasUnread && !isSelected
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground'
                      )}
                    >
                      {thread.lastMessage.subject || thread.lastMessage.body || 'New message'}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}

          {threads.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          )}

          {/* Lazy Loading Footer Trigger */}
          {threads.length > 0 && (
            <div className="pt-3 pb-2 px-1">
              {isLoadingMore ? (
                <Button
                  disabled
                  variant="outline"
                  size="sm"
                  className="w-full text-xs font-semibold rounded-xl min-h-[44px] gap-2 border-border/60"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  Loading older conversations…
                </Button>
              ) : hasMore ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onLoadMore}
                  className="w-full text-xs font-semibold rounded-xl min-h-[44px] bg-background shadow-xs hover:bg-muted/50 transition-all border-border/60 active:scale-[0.97]"
                >
                  Load older conversations (+1,000)
                </Button>
              ) : isCapped ? (
                <div className="p-3 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border/40">
                  Showing 5,000 latest messages. For full archives, view{' '}
                  <Link
                    href="/admin/messaging/logs"
                    className="underline font-semibold text-primary hover:text-primary/80"
                  >
                    Message Logs
                  </Link>
                  .
                </div>
              ) : (
                <div className="text-[11px] text-center text-muted-foreground py-2 flex items-center justify-center gap-1 font-medium">
                  <Check className="h-3 w-3 text-emerald-500" /> All conversations loaded ({threads.length})
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
