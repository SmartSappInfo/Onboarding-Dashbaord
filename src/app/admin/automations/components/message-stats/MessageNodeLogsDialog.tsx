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
  AlertCircle,
  TrendingUp,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { format } from 'date-fns';
import { getMessageNodeLogsAction } from '@/lib/automation-actions';
import type { MessageLog } from '@/lib/types';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip as ChartTooltip 
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';

interface MessageNodeLogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  automationId: string;
  nodeId: string;
  nodeLabel: string;
  channel: 'email' | 'sms' | 'whatsapp';
  initialTab?: string;
}

// Separate component to asynchronously resolve and render Entity Name + Contact Person details per row
interface MessageContactRowDetailsProps {
  log: MessageLog;
  workspaceId: string;
}

function MessageContactRowDetails({ log, workspaceId }: MessageContactRowDetailsProps) {
  const [entityName, setEntityName] = React.useState<string>('-');
  const [contactPerson, setContactPerson] = React.useState<string>('-');
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function resolve() {
      try {
        const identifier = log.entityId;
        if (!identifier) {
          setEntityName(log.entityName || log.displayName || '-');
          setContactPerson(log.displayName || '-');
          setIsLoading(false);
          return;
        }

        const { resolveContact } = await import('@/lib/contact-adapter');
        const contact = await resolveContact(identifier, workspaceId);

        if (contact) {
          setEntityName(contact.name || '-');
          
          // Match recipient to contacts list
          const cleanRecipient = log.recipient.toLowerCase().trim();
          const matchedContact = contact.contacts?.find(
            c => c.email?.toLowerCase().trim() === cleanRecipient ||
                 c.phone?.replace(/[+\s-]/g, '') === cleanRecipient.replace(/[+\s-]/g, '')
          );
          
          setContactPerson(matchedContact?.name || contact.primaryContactName || '-');
        } else {
          setEntityName(log.entityName || log.displayName || '-');
          setContactPerson(log.displayName || '-');
        }
      } catch (error) {
        setEntityName(log.entityName || log.displayName || '-');
        setContactPerson(log.displayName || '-');
      } finally {
        setIsLoading(false);
      }
    }
    void resolve();
  }, [log, workspaceId]);

  if (isLoading) {
    return (
      <>
        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
      </>
    );
  }

  return (
    <>
      <TableCell className="font-semibold text-foreground truncate max-w-[200px]" title={entityName}>
        {entityName}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground truncate max-w-[180px]" title={contactPerson}>
        {contactPerson}
      </TableCell>
    </>
  );
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

  // Counts and metrics
  const stats = React.useMemo(() => {
    const res = {
      sent: logs.length,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      replied: 0,
      pending: 0
    };

    logs.forEach(log => {
      const isClicked = !!log.clickedAt || (log.clickedCount ?? 0) > 0 || log.providerStatus === 'clicked';
      const isOpened = !!log.openedAt || (log.openedCount ?? 0) > 0 || log.providerStatus === 'opened';
      const isDelivered = !!log.deliveredAt || log.providerStatus === 'delivered';
      const isFailed = log.status === 'failed' || log.providerStatus === 'bounced';

      if (isClicked) res.clicked++;
      if (isOpened || isClicked) res.opened++; // Opened includes clicked
      if (isDelivered || isOpened || isClicked) res.delivered++; // Delivered includes opened/clicked
      if (isFailed) res.bounced++;
      if (log.providerStatus === 'unsubscribed') res.unsubscribed++;
      if (log.direction === 'inbound' || log.providerStatus === 'replied') res.replied++;

      // Sent but pending delivery
      if (!isDelivered && !isOpened && !isClicked && !isFailed) {
        res.pending++;
      }
    });

    return res;
  }, [logs]);

  // Chart data distribution (mutually exclusive slices)
  const chartData = React.useMemo(() => {
    const distribution = {
      clicked: stats.clicked,
      opened: Math.max(0, stats.opened - stats.clicked), // Opened but not clicked
      delivered: Math.max(0, stats.delivered - stats.opened), // Delivered but not opened
      failed: stats.bounced,
      pending: stats.pending
    };

    return [
      { name: 'Clicked', value: distribution.clicked, color: '#6366f1' }, // Indigo
      { name: channel === 'email' ? 'Opened' : 'Read', value: distribution.opened, color: '#10b981' }, // Emerald
      { name: 'Delivered', value: distribution.delivered, color: '#3b82f6' }, // Blue
      { name: 'Sent / Pending', value: distribution.pending, color: '#64748b' }, // Slate
      { name: 'Failed', value: distribution.failed, color: '#ef4444' }, // Red
    ].filter(item => item.value > 0);
  }, [stats, channel]);

  // Filter logs based on active tab and search query
  const filteredLogs = React.useMemo(() => {
    return logs.filter(log => {
      // 1. Search filter
      const term = search.toLowerCase().trim();
      const matchesSearch = !term || 
        log.recipient.toLowerCase().includes(term) ||
        (log.displayName || '').toLowerCase().includes(term) ||
        (log.entityName || '').toLowerCase().includes(term);

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

  // Metrics helper
  const sentCount = stats.sent;
  const openRate = sentCount > 0 ? Math.round((stats.opened / sentCount) * 100) : 0;
  const clickRate = sentCount > 0 ? Math.round((stats.clicked / sentCount) * 100) : 0;
  const bounceRate = sentCount > 0 ? Math.round((stats.bounced / sentCount) * 100) : 0;
  const replyRate = sentCount > 0 ? Math.round((stats.replied / sentCount) * 100) : 0;

  const ChannelIcon = channel === 'email' ? Mail : Smartphone;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6 overflow-hidden bg-background border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <ChannelIcon className="h-5 w-5 text-primary" />
            <span>Delivery Analytics: &quot;{nodeLabel}&quot;</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Drill down into recipient engagement, delivery distribution, and contact logs.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive my-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Statistics & Chart Section */}
        {!isLoading && logs.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-4 rounded-xl border border-border/50 bg-muted/20 my-2 shrink-0">
            {/* Summary Cards */}
            <div className="md:col-span-7 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Total Dispatched</p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className="text-2xl font-extrabold tracking-tight text-foreground">{stats.sent}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">messages</p>
                </div>
              </div>

              <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                  {channel === 'email' ? 'Engagement Rate' : 'Read Rate'}
                </p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className="text-2xl font-extrabold tracking-tight text-emerald-500">{openRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-medium">({stats.opened} read)</p>
                </div>
              </div>

              {channel === 'email' ? (
                <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Click Rate (CTR)</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold tracking-tight text-indigo-500">{clickRate}%</p>
                    <p className="text-[10px] text-muted-foreground font-medium">({stats.clicked} clicked)</p>
                  </div>
                </div>
              ) : channel === 'whatsapp' ? (
                <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Reply Rate</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold tracking-tight text-indigo-500">{replyRate}%</p>
                    <p className="text-[10px] text-muted-foreground font-medium">({stats.replied} replied)</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Delivered</p>
                  <div className="flex items-baseline gap-1.5 mt-1.5">
                    <p className="text-2xl font-extrabold tracking-tight text-blue-500">
                      {stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0}%
                    </p>
                    <p className="text-[10px] text-muted-foreground font-medium">({stats.delivered} delivered)</p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-border/50 bg-card p-3.5 shadow-sm">
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Bounce / Failed</p>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <p className="text-2xl font-extrabold tracking-tight text-rose-500">{bounceRate}%</p>
                  <p className="text-[10px] text-muted-foreground font-medium">({stats.bounced} failed)</p>
                </div>
              </div>
            </div>

            {/* Distribution Donut Chart */}
            <div className="md:col-span-5 flex flex-row items-center gap-4 border-l border-border/50 pl-6">
              <div className="h-[120px] w-[120px] shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={55}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip 
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-popover border border-border rounded-lg p-2 shadow-md text-[10px] font-semibold">
                              {data.name}: {data.value}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Chart Legend */}
              <div className="flex-1 space-y-1.5 min-w-0">
                {chartData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-muted-foreground truncate">{item.name}</span>
                    </div>
                    <span className="font-mono font-bold text-foreground pl-2 shrink-0">
                      {item.value} ({stats.sent > 0 ? Math.round((item.value / stats.sent) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabs and search bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2 mb-4 shrink-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-muted/80 p-0.5 rounded-lg border border-border/40">
              <TabsTrigger value="sent" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                Sent ({stats.sent})
              </TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                Delivered ({stats.delivered})
              </TabsTrigger>
              {channel === 'email' ? (
                <>
                  <TabsTrigger value="opened" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Opened ({stats.opened})
                  </TabsTrigger>
                  <TabsTrigger value="clicked" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Clicked ({stats.clicked})
                  </TabsTrigger>
                  <TabsTrigger value="unsubscribed" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Unsub ({stats.unsubscribed})
                  </TabsTrigger>
                </>
              ) : channel === 'whatsapp' ? (
                <>
                  <TabsTrigger value="opened" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Read ({stats.opened})
                  </TabsTrigger>
                  <TabsTrigger value="replied" className="text-xs font-semibold px-3 py-1.5 rounded-md">
                    Replied ({stats.replied})
                  </TabsTrigger>
                </>
              ) : null}
              <TabsTrigger value="bounced" className="text-xs font-semibold px-3 py-1.5 rounded-md text-red-500 data-[state=active]:text-red-600">
                Failed ({stats.bounced})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by recipient, entity or contact..."
              className="pl-9 h-9 rounded-lg text-xs border border-border/80 bg-background"
            />
          </div>
        </div>

        {/* Drill-down Table view */}
        <div className="flex-1 overflow-auto border border-border/60 rounded-xl bg-card shadow-inner">
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
              <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b border-border/50">
                <TableRow>
                  <TableHead className="w-[180px] text-xs">Recipient</TableHead>
                  <TableHead className="w-[200px] text-xs">Entity Name</TableHead>
                  <TableHead className="w-[160px] text-xs">Contact Person</TableHead>
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
                      <TableCell className="font-mono text-[11px] truncate max-w-[180px]" title={log.recipient}>
                        {log.recipient}
                      </TableCell>
                      
                      {/* Async Entity details */}
                      <MessageContactRowDetails log={log} workspaceId={log.workspaceId || 'global'} />

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
