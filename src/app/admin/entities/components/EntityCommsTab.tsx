'use client';

import * as React from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { MessageLog } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  Smartphone,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/context/WorkspaceContext';
import Link from 'next/link';

interface EntityCommsTabProps {
  entityId: string;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

const relativeTime = (dateStr: string) => {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return dateFormatter.format(new Date(dateStr));
};

const statusConfig = {
  sent: { icon: CheckCircle2, label: 'Delivered', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  failed: { icon: XCircle, label: 'Failed', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  scheduled: { icon: Clock, label: 'Scheduled', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
};

const MessageCard = React.memo(function MessageCard({ log }: { log: MessageLog }) {
  const [expanded, setExpanded] = React.useState(false);
  const config = statusConfig[log.status] || statusConfig.sent;
  const StatusIcon = config.icon;

  return (
    <div
      className={cn(
        'group relative rounded-2xl border bg-card p-4 transition-all hover:shadow-sm',
        log.status === 'failed' && 'border-destructive/20'
      )}
    >
      {/* Timeline connector */}
      <div className="absolute -left-[25px] top-5 w-3 h-3 rounded-full border-2 border-background bg-primary/30" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={cn('p-1.5 rounded-lg shrink-0', log.channel === 'email' ? 'bg-blue-500/10 text-blue-600' : 'bg-orange-500/10 text-orange-600')}>
            {log.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">
              {log.title || log.templateName || 'Untitled Message'}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className={cn('text-[8px] font-semibold uppercase h-4 px-1.5 border', config.className)}>
                <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                {config.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground font-medium">
                {relativeTime(log.sentAt)}
              </span>
            </div>
            {log.subject && (
              <p className="text-xs text-muted-foreground mt-1.5 truncate font-medium">
                Subject: {log.subject}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 rounded-lg hover:bg-muted/50 transition-colors shrink-0"
          aria-label={expanded ? 'Collapse message' : 'Expand message'}
        >
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[9px] font-semibold text-muted-foreground uppercase">To:</span>
            <code className="text-[10px] font-mono text-muted-foreground">{log.recipient}</code>
          </div>
          {log.channel === 'email' ? (
            <div
              className="prose prose-sm max-w-none text-foreground dark:prose-invert text-xs leading-relaxed rounded-xl bg-muted/20 p-3 max-h-48 overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: log.body }}
            />
          ) : (
            <div className="bg-muted/20 rounded-xl p-3">
              <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{log.body}</p>
            </div>
          )}
          {log.error && (
            <p className="text-[10px] text-destructive font-medium mt-2">Error: {log.error}</p>
          )}
          <p className="text-[9px] text-muted-foreground mt-2 font-medium">
            {dateFormatter.format(new Date(log.sentAt))}
          </p>
        </div>
      )}
    </div>
  );
});

export default function EntityCommsTab({ entityId }: EntityCommsTabProps) {
  const firestore = useFirestore();
  const { activeWorkspaceId } = useWorkspace();

  const logsQuery = useMemoFirebase(() => {
    if (!firestore || !entityId || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'message_logs'),
      where('entityId', '==', entityId),
      where('workspaceIds', 'array-contains', activeWorkspaceId),
      orderBy('sentAt', 'desc'),
      limit(50)
    );
  }, [firestore, entityId, activeWorkspaceId]);

  const { data: logs, isLoading } = useCollection<MessageLog>(logsQuery);

  const stats = React.useMemo(() => {
    if (!logs) return { total: 0, emails: 0, sms: 0, failed: 0 };
    return {
      total: logs.length,
      emails: logs.filter(l => l.channel === 'email').length,
      sms: logs.filter(l => l.channel === 'sms').length,
      failed: logs.filter(l => l.status === 'failed').length,
    };
  }, [logs]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 rounded-2xl bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="p-4 bg-muted/30 rounded-2xl">
          <MessageSquare className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-muted-foreground">No messages sent yet</p>
          <p className="text-xs text-muted-foreground/60">Send your first message to this contact.</p>
        </div>
        <Button variant="outline" asChild className="rounded-xl font-bold h-10 gap-2 mt-2">
          <Link href={`/admin/messaging/composer?entityId=${entityId}`}>
            <Send className="h-4 w-4" /> Send Message
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-1">
        <Badge variant="secondary" className="text-[9px] font-semibold h-5 px-2 gap-1">
          <MessageSquare className="h-2.5 w-2.5" /> {stats.total} messages
        </Badge>
        {stats.emails > 0 && (
          <Badge variant="outline" className="text-[9px] font-semibold h-5 px-2 gap-1 text-blue-600 border-blue-500/20 bg-blue-500/5">
            <Mail className="h-2.5 w-2.5" /> {stats.emails}
          </Badge>
        )}
        {stats.sms > 0 && (
          <Badge variant="outline" className="text-[9px] font-semibold h-5 px-2 gap-1 text-orange-600 border-orange-500/20 bg-orange-500/5">
            <Smartphone className="h-2.5 w-2.5" /> {stats.sms}
          </Badge>
        )}
        <div className="flex-1" />
        <Button variant="outline" size="sm" asChild className="rounded-xl font-bold h-8 text-[10px] gap-1.5">
          <Link href={`/admin/messaging/composer?entityId=${entityId}`}>
            <Send className="h-3 w-3" /> Send Message
          </Link>
        </Button>
      </div>

      {/* Timeline */}
      <ScrollArea className="h-[400px]">
        <div className="relative pl-6 space-y-3">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-0 bottom-0 w-px bg-border" />
          {logs.map((log) => (
            <MessageCard key={log.id} log={log} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
