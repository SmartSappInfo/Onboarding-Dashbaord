'use client';

import * as React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Mail, 
  Smartphone, 
  Search, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  MousePointer2, 
  User, 
  Building, 
  Users, 
  ExternalLink,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { getMessageNodeLogsAction } from '@/lib/automation-actions';
import type { MessageLog } from '@/lib/types';
import { MessageContactDisplay } from '@/components/messaging/MessageContactDisplay';

interface MessageNodeLogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  automationId: string;
  nodeId: string;
  nodeLabel: string;
  channel: 'email' | 'sms' | 'whatsapp';
  initialTab?: string;
}

export function MessageNodeLogsDialog({
  isOpen,
  onClose,
  automationId,
  nodeId,
  nodeLabel,
  channel,
  initialTab = 'sent'
}: MessageNodeLogsDialogProps) {
  const [logs, setLogs] = React.useState<MessageLog[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState(initialTab);
  const [search, setSearch] = React.useState('');

  // Fetch logs on mount or when id changes
  React.useEffect(() => {
    if (!isOpen || !automationId || !nodeId) return;

    async function loadLogs() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getMessageNodeLogsAction(automationId, nodeId);
        setLogs(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load delivery logs');
      } finally {
        setIsLoading(false);
      }
    }

    void loadLogs();
  }, [isOpen, automationId, nodeId]);

  // Sync active tab to initialTab if dialog opens with a specific metric clicked
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Tab counts
  const counts = React.useMemo(() => {
    const res = {
      sent: logs.length,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      replied: 0
    };

    logs.forEach(log => {
      if (log.deliveredAt || log.providerStatus === 'delivered') res.delivered++;
      if (log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened') res.opened++;
      if (log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked') res.clicked++;
      if (log.bouncedAt || log.status === 'failed' || log.providerStatus === 'bounced') res.bounced++;
      if (log.providerStatus === 'unsubscribed') res.unsubscribed++;
      if (log.direction === 'inbound' || log.providerStatus === 'replied') res.replied++;
    });

    return res;
  }, [logs]);

  // Filter logs based on active tab and search query
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // 1. Search filter
      const term = search.toLowerCase().trim();
      const matchesSearch = !term || 
        log.recipient.toLowerCase().includes(term) ||
        (log.displayName || '').toLowerCase().includes(term) ||
        (log.subject || '').toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. Status/Milestone filter
      switch (activeTab) {
        case 'sent':
          return true;
        case 'delivered':
          return !!log.deliveredAt || log.providerStatus === 'delivered';
        case 'opened':
          return !!log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
        case 'clicked':
          return !!log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
        case 'bounced':
          return !!log.bouncedAt || log.status === 'failed' || log.providerStatus === 'bounced';
        case 'unsubscribed':
          return log.providerStatus === 'unsubscribed';
        case 'replied':
          return log.direction === 'inbound' || log.providerStatus === 'replied';
        default:
          return true;
      }
    });
  }, [logs, activeTab, search]);

  const ChannelIcon = channel === 'email' ? Mail : Smartphone;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ChannelIcon className="h-5 w-5 text-primary" />
            <span>Delivery Logs: &quot;{nodeLabel}&quot;</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Drill down into individual status events and track recipient engagement.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive my-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-4 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-muted/80 p-0.5 rounded-lg">
              <TabsTrigger value="sent" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                Sent ({counts.sent})
              </TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                {channel === 'email' ? 'Delivered' : 'Delivered'} ({counts.delivered})
              </TabsTrigger>
              {channel === 'email' ? (
                <>
                  <TabsTrigger value="opened" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Opened ({counts.opened})
                  </TabsTrigger>
                  <TabsTrigger value="clicked" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Clicked ({counts.clicked})
                  </TabsTrigger>
                  <TabsTrigger value="unsubscribed" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Unsub ({counts.unsubscribed})
                  </TabsTrigger>
                </>
              ) : channel === 'whatsapp' ? (
                <>
                  <TabsTrigger value="opened" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Read ({counts.opened})
                  </TabsTrigger>
                  <TabsTrigger value="replied" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Replied ({counts.replied})
                  </TabsTrigger>
                </>
              ) : null}
              <TabsTrigger value="bounced" className="text-xs font-semibold px-3 py-1.5 rounded-md text-red-500 data-[state=active]:text-red-600">
                Failed ({counts.bounced})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search recipient..."
              className="pl-9 h-9 rounded-lg text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto border border-border/60 rounded-xl bg-card">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-xs text-muted-foreground font-medium">Fetching history...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-4">
              <Activity className="h-10 w-10 text-muted-foreground/30 mb-2" />
              <p className="text-xs font-semibold text-foreground">No matching logs found</p>
              <p className="text-[11px] text-muted-foreground/80 mt-1 max-w-xs">
                No outbound sends matched this category and search filter.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[200px] text-xs">Recipient</TableHead>
                  <TableHead className="w-[180px] text-xs">Contact Name</TableHead>
                  <TableHead className="text-xs">Subject / Title</TableHead>
                  <TableHead className="w-[140px] text-xs">Sent At</TableHead>
                  <TableHead className="w-[110px] text-xs text-center">Status</TableHead>
                  <TableHead className="w-[50px] text-xs text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => {
                  const hasOpened = log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
                  const hasClicked = log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
                  const hasFailed = log.status === 'failed' || log.providerStatus === 'bounced';

                  // Build status badge
                  let statusBadge = (
                    <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px]">
                      Sent
                    </Badge>
                  );
                  if (hasFailed) {
                    statusBadge = (
                      <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">
                        Failed
                      </Badge>
                    );
                  } else if (hasClicked) {
                    statusBadge = (
                      <Badge variant="outline" className="bg-indigo-500/10 text-indigo-500 border-indigo-500/20 text-[10px] flex items-center gap-1 justify-center">
                        <MousePointer2 className="h-2.5 w-2.5" /> Clicked
                      </Badge>
                    );
                  } else if (hasOpened) {
                    statusBadge = (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] flex items-center gap-1 justify-center">
                        <Eye className="h-2.5 w-2.5" /> {channel === 'email' ? 'Opened' : 'Read'}
                      </Badge>
                    );
                  } else if (log.deliveredAt || log.providerStatus === 'delivered') {
                    statusBadge = (
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 border-blue-500/20 text-[10px] flex items-center gap-1 justify-center">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Delivered
                      </Badge>
                    );
                  }

                  const entityId = log.entityId;

                  return (
                    <TableRow key={log.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-[11px] truncate max-w-[200px]" title={log.recipient}>
                        {log.recipient}
                      </TableCell>
                      <TableCell className="align-middle">
                        <MessageContactDisplay log={log} workspaceId={log.workspaceId || 'global'} />
                      </TableCell>
                      <TableCell className="text-xs max-w-[220px] truncate" title={log.subject || log.title || ''}>
                        {log.subject || log.title || <span className="text-muted-foreground/50 italic">No subject</span>}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {log.sentAt ? format(new Date(log.sentAt), 'MMM dd, yyyy HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="text-center align-middle">
                        {statusBadge}
                      </TableCell>
                      <TableCell className="text-right">
                        {entityId && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md hover:bg-primary/5 text-muted-foreground hover:text-primary"
                            asChild
                          >
                            <a
                              href={`/admin/entities/${entityId}`}
                              target="_blank"
                              rel="noreferrer"
                              title="View Contact Profile"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
