import * as React from 'react';
import { Search, Mail, Smartphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ThreadGroup } from '../ConversationsClient';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ThreadListProps {
  threads: ThreadGroup[];
  selectedEntityId: string | null;
  onSelect: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
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
  const isToday = date.getDate() === now.getDate() && 
                  date.getMonth() === now.getMonth() && 
                  date.getFullYear() === now.getFullYear();
  return isToday ? timeFormatter.format(date) : dateFormatter.format(date);
}

export default function ThreadList({ threads, selectedEntityId, onSelect, searchQuery, onSearchChange }: ThreadListProps) {
  return (
    <div className="w-80 shrink-0 border-r border-border bg-background flex flex-col h-full z-10 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
      {/* Header & Search */}
      <div className="p-4 border-b border-border/50 shrink-0 space-y-4 bg-muted/10">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">Inbox</h2>
          <Badge variant="secondary" className="font-mono text-[10px]">{threads.length}</Badge>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search messages…" 
            className="pl-9 h-10 rounded-xl bg-background border-none shadow-sm focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
          />
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {threads.map((thread) => {
            const isSelected = thread.entityId === selectedEntityId;
            const hasUnread = thread.unreadCount > 0;
            const initials = thread.entityName.substring(0, 2).toUpperCase();
            const channels = Array.from(new Set(thread.messages.map(m => m.channel)));

            return (
              <button
                key={thread.entityId}
                onClick={() => onSelect(thread.entityId)}
                className={cn(
                  'w-full text-left p-3 rounded-xl transition-all flex gap-3 relative group outline-none',
                  isSelected 
                    ? 'bg-primary/10 hover:bg-primary/15' 
                    : 'hover:bg-muted/50 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-primary/20'
                )}
              >
                {/* Unread indicator dot */}
                {hasUnread && !isSelected && (
                  <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--primary),0.5)]" />
                )}

                <Avatar className={cn("h-10 w-10 border-2 shrink-0 transition-colors", isSelected ? "border-primary/20" : "border-border/50 group-hover:border-border")}>
                  <AvatarFallback className={cn("text-xs font-bold", isSelected ? "bg-primary/5 text-primary" : "bg-muted text-muted-foreground")}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm truncate font-semibold transition-colors",
                      (hasUnread && !isSelected) ? "text-foreground" : (isSelected ? "text-primary" : "text-foreground/80")
                    )}>
                      {thread.entityName}
                    </span>
                    <span className={cn(
                      "text-[10px] whitespace-nowrap ml-2 font-medium",
                      (hasUnread && !isSelected) ? "text-primary" : "text-muted-foreground"
                    )}>
                      {formatThreadDate(thread.lastMessageTimestamp)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {/* Channel indicators */}
                    <div className="flex -space-x-1 shrink-0">
                      {channels.includes('email') && (
                        <div className={cn("rounded-full p-0.5 z-10 border-2", isSelected ? "bg-blue-500/10 text-blue-600 border-primary/10" : "bg-muted text-muted-foreground border-background")}>
                          <Mail className="h-2 w-2" />
                        </div>
                      )}
                      {channels.includes('sms') && (
                        <div className={cn("rounded-full p-0.5 z-0 border-2", isSelected ? "bg-orange-500/10 text-orange-600 border-primary/10" : "bg-muted text-muted-foreground border-background")}>
                          <Smartphone className="h-2 w-2" />
                        </div>
                      )}
                    </div>
                    
                    {/* Preview */}
                    <p className={cn(
                      "text-xs truncate transition-colors",
                      (hasUnread && !isSelected) ? "font-medium text-foreground/90" : "text-muted-foreground"
                    )}>
                      {thread.lastMessage.subject || thread.lastMessage.body || 'New message'}
                    </p>
                  </div>
                </div>

                {/* Unread badge */}
                {hasUnread && !isSelected && (
                  <Badge variant="default" className="absolute right-3 top-1/2 -translate-y-1/2 h-5 min-w-5 px-1.5 flex items-center justify-center text-[9px] font-bold rounded-full pointer-events-none">
                    {thread.unreadCount}
                  </Badge>
                )}
              </button>
            );
          })}
          
          {threads.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
