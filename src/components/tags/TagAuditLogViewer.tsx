'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { TagAuditLog } from '@/lib/types';
import { getTagAuditLogsAction } from '@/lib/tag-actions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Minus, Edit, Trash2, Merge, Tag as TagIcon,
  RefreshCw, Search, Filter, User, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ACTION_CONFIG: Record<
  TagAuditLog['action'],
  { label: string; icon: React.ElementType; color: string }
> = {
  created:  { label: 'Created',  icon: Plus,    color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30' },
  updated:  { label: 'Updated',  icon: Edit,    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30' },
  deleted:  { label: 'Deleted',  icon: Trash2,  color: 'text-red-600 bg-red-50 dark:bg-red-950/30' },
  merged:   { label: 'Merged',   icon: Merge,   color: 'text-purple-600 bg-purple-50 dark:bg-purple-950/30' },
  applied:  { label: 'Applied',  icon: Plus,    color: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30' },
  removed:  { label: 'Removed',  icon: Minus,   color: 'text-orange-600 bg-orange-50 dark:bg-orange-950/30' },
};

function formatTimestamp(ts: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

interface TagAuditLogViewerProps {
  /** Pre-filter by a specific tag ID */
  tagId?: string;
  /** Pre-filter by a specific contact ID */
  contactId?: string;
  /** Max height of the scroll area */
  maxHeight?: string;
}

export function TagAuditLogViewer({ tagId, contactId, maxHeight = '480px' }: TagAuditLogViewerProps) {
  const { activeWorkspaceId } = useWorkspace() as any;

  const [logs, setLogs] = useState<TagAuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterAction, setFilterAction] = useState<TagAuditLog['action'] | 'all'>('all');
  const [filterUser, setFilterUser] = useState('');
  const [filterTag, setFilterTag] = useState(tagId || '');
  const [filterContact, setFilterContact] = useState(contactId || '');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const result = await getTagAuditLogsAction(activeWorkspaceId, {
        tagId: filterTag || undefined,
        contactId: filterContact || undefined,
        action: filterAction !== 'all' ? filterAction : undefined,
        startDate: filterStartDate || undefined,
        endDate: filterEndDate ? filterEndDate + 'T23:59:59Z' : undefined,
        limit: 200,
      });
      if (result.success && result.data) {
        // Client-side user filter (not indexed)
        const filtered = filterUser
          ? result.data.filter(l =>
              l.userName?.toLowerCase().includes(filterUser.toLowerCase()) ||
              l.userId?.toLowerCase().includes(filterUser.toLowerCase())
            )
          : result.data;
        setLogs(filtered);
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, filterAction, filterTag, filterContact, filterUser, filterStartDate, filterEndDate]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(v => !v)}
          className={cn('rounded-xl font-bold text-xs h-8 gap-1.5', showFilters && 'bg-primary/5 border-primary/30')}
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchLogs}
          disabled={isLoading}
          className="rounded-xl font-bold text-xs h-8 gap-1.5 ml-auto"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-muted/20 rounded-2xl border">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Action</Label>
            <Select value={filterAction} onValueChange={v => setFilterAction(v as any)}>
              <SelectTrigger className="h-8 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">All Actions</SelectItem>
                {(Object.keys(ACTION_CONFIG) as TagAuditLog['action'][]).map(a => (
                  <SelectItem key={a} value={a} className="text-xs capitalize">{ACTION_CONFIG[a].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Tag Name / ID</Label>
            <div className="relative">
              <TagIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={filterTag}
                onChange={e => setFilterTag(e.target.value)}
                placeholder="Tag ID..."
                className="pl-7 h-8 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">User</Label>
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <Input
                value={filterUser}
                onChange={e => setFilterUser(e.target.value)}
                placeholder="Name or ID..."
                className="pl-7 h-8 rounded-xl text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">Contact ID</Label>
            <Input
              value={filterContact}
              onChange={e => setFilterContact(e.target.value)}
              placeholder="Contact ID..."
              className="h-8 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">From Date</Label>
            <Input
              type="date"
              value={filterStartDate}
              onChange={e => setFilterStartDate(e.target.value)}
              className="h-8 rounded-xl text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest">To Date</Label>
            <Input
              type="date"
              value={filterEndDate}
              onChange={e => setFilterEndDate(e.target.value)}
              className="h-8 rounded-xl text-xs"
            />
          </div>
        </div>
      )}

      {/* Log count */}
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {isLoading ? 'Loading...' : `${logs.length} event(s)`}
      </p>

      {/* Log list */}
      <ScrollArea style={{ maxHeight }} className="pr-2">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-xl" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed rounded-2xl">
            <TagIcon className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              No audit events found
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {logs.map(log => {
              const config = ACTION_CONFIG[log.action];
              const Icon = config.icon;
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-xl border bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className={cn('p-1.5 rounded-lg shrink-0 mt-0.5', config.color)}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={cn('text-[9px] font-black uppercase tracking-widest border-none px-1.5 py-0', config.color)}
                      >
                        {config.label}
                      </Badge>
                      <span className="text-xs font-bold truncate">{log.tagName}</span>
                      {log.contactName && (
                        <>
                          <span className="text-[10px] text-muted-foreground">on</span>
                          <span className="text-xs font-medium text-muted-foreground truncate">{log.contactName}</span>
                        </>
                      )}
                      {log.metadata?.bulkOperation && (
                        <Badge variant="outline" className="text-[9px] font-black rounded-full px-1.5 py-0">
                          Bulk ({log.metadata.affectedCount})
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-2.5 w-2.5" />
                        {log.userName || log.userId}
                      </span>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
