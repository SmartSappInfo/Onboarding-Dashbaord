'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { collection, query, where, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { useWorkspace } from '@/context/WorkspaceContext';
import type { Webhook, WebhookType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  PlusCircle, Search, Zap, ZapOff, MoreHorizontal,
  Trash2, Edit, Copy, Loader2,
  ArrowUpRight, ArrowDownLeft, Activity,
  Power, PowerOff, ShieldCheck, Clock, Unplug
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// bundle-dynamic-imports: Lazy-load the heavy editor sheet
const WebhookEditor = dynamic(() => import('./components/WebhookEditor'), {
  ssr: false,
  loading: () => null,
});

// --- Helper: Human-readable trigger names ---
const TRIGGER_LABELS: Record<string, string> = {
  SURVEY_SUBMITTED: 'Survey Submitted',
  FORM_SUBMITTED: 'Form Submitted',
  ENTITY_CREATED: 'Entity Created',
  TAG_ADDED: 'Tag Applied',
  TAG_REMOVED: 'Tag Removed',
  MEETING_CREATED: 'Meeting Scheduled',
  CAMPAIGN_OPENED: 'Campaign Opened',
  CAMPAIGN_CLICKED: 'Campaign Clicked',
  WEBHOOK_RECEIVED: 'External Ingress',
};

export default function WebhooksClient() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | WebhookType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused' | 'failed'>('all');

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null);
  const [webhookToDelete, setWebhookToDelete] = useState<Webhook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // --- Data ---
  const webhooksQuery = useMemoFirebase(() => {
    if (!firestore || !activeWorkspaceId) return null;
    return query(
      collection(firestore, 'webhooks'),
      where('workspaceId', '==', activeWorkspaceId),
      orderBy('createdAt', 'desc')
    );
  }, [firestore, activeWorkspaceId]);

  const { data: webhooks, isLoading } = useCollection<Webhook>(webhooksQuery);

  const filteredWebhooks = useMemo(() => {
    return webhooks?.filter(w => {
      const matchesSearch = w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.url.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = typeFilter === 'all' || w.type === typeFilter;
      const matchesStatus = statusFilter === 'all' || w.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    }) || [];
  }, [webhooks, searchTerm, typeFilter, statusFilter]);

  // --- Stats ---
  const stats = useMemo(() => {
    const all = webhooks || [];
    return {
      total: all.length,
      active: all.filter(w => w.status === 'active').length,
      outbound: all.filter(w => w.type === 'outbound').length,
      inbound: all.filter(w => w.type === 'inbound').length,
    };
  }, [webhooks]);

  // --- Actions ---
  const handleDeleteWebhook = async () => {
    if (!firestore || !webhookToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'webhooks', webhookToDelete.id));
      toast({ title: 'Webhook Deleted', description: `"${webhookToDelete.name}" removed.` });
      setWebhookToDelete(null);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleWebhookStatus = async (webhook: Webhook) => {
    if (!firestore) return;
    const newStatus = webhook.status === 'paused' ? 'active' : 'paused';
    try {
      await updateDoc(doc(firestore, 'webhooks', webhook.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast({
        title: `Webhook ${newStatus === 'active' ? 'Activated' : 'Paused'}`,
        description: `"${webhook.name}" is now ${newStatus}.`
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: e.message });
    }
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'URL Copied', description: 'Endpoint URL copied to clipboard.' });
  };

  // --- Render Helpers ---
  const StatusDot = ({ status }: { status: Webhook['status'] }) => (
    <span className={cn(
      "relative flex h-2.5 w-2.5 shrink-0",
      status === 'active' && "text-emerald-500",
      status === 'paused' && "text-muted-foreground",
      status === 'failed' && "text-destructive"
    )}>
      {status === 'active' && (
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      )}
      <span className={cn(
        "relative inline-flex rounded-full h-2.5 w-2.5",
        status === 'active' && "bg-emerald-500",
        status === 'paused' && "bg-muted-foreground/40",
        status === 'failed' && "bg-destructive"
      )} />
    </span>
  );

  return (
    <TooltipProvider>
        <div className="space-y-8 pb-32 w-full">

          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Webhook Hub</h1>
              <p className="text-muted-foreground font-medium text-sm mt-1">
                Manage real-time data flows and external system integrations.
              </p>
            </div>
            <Button
              onClick={() => { setEditingWebhook(null); setIsEditorOpen(true); }}
              className="h-11 px-6 rounded-xl font-bold text-sm shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              Create Webhook
            </Button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total Endpoints', value: stats.total, icon: Activity, color: 'text-primary' },
              { label: 'Active', value: stats.active, icon: Zap, color: 'text-emerald-500' },
              { label: 'Outbound', value: stats.outbound, icon: ArrowUpRight, color: 'text-blue-500' },
              { label: 'Inbound', value: stats.inbound, icon: ArrowDownLeft, color: 'text-purple-500' },
            ].map(stat => (
              <Card key={stat.label} className="p-4 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm shadow-sm flex items-center gap-3">
                <div className={cn("p-2 rounded-xl bg-muted", stat.color)}>
                  <stat.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-2xl font-bold tracking-tight leading-none">
                    {isLoading ? <Skeleton className="h-7 w-8" /> : stat.value}
                  </div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card className="p-4 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm shadow-sm">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or URL..."
                  className="pl-9 rounded-xl border-border bg-background h-10 w-full font-medium"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-3 w-full md:w-auto">
                <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 rounded-xl border-border bg-background h-10 font-bold text-xs">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold">
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="inbound">Inbound</SelectItem>
                    <SelectItem value="outbound">Outbound</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                  <SelectTrigger className="w-full md:w-36 rounded-xl border-border bg-background h-10 font-bold text-xs">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl font-bold">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Card>

          {/* Table */}
          <Card className="rounded-2xl border-border/50 bg-card overflow-hidden shadow-xl">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground pl-6 h-11">Webhook</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground h-11">Direction</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground h-11">Trigger</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground h-11">Status</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground h-11 hidden lg:table-cell">Last Fired</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground text-right pr-6 h-11">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="pl-6 py-4"><Skeleton className="h-10 w-48 rounded-lg" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-24 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-28 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                      <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto rounded-md" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredWebhooks.length > 0 ? (
                  filteredWebhooks.map((webhook) => (
                    <TableRow key={webhook.id} className="group border-border/30 hover:bg-muted/20 transition-all duration-200">
                      {/* Identity */}
                      <TableCell className="pl-6 py-3.5">
                        <div className="flex items-center gap-3 max-w-xs">
                          <StatusDot status={webhook.status} />
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span
                              className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors cursor-pointer truncate"
                              onClick={() => { setEditingWebhook(webhook); setIsEditorOpen(true); }}
                            >
                              {webhook.name}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <code className="text-[10px] font-mono text-muted-foreground truncate max-w-[180px]">
                                {webhook.url}
                              </code>
                              <button onClick={() => copyUrl(webhook.url)} className="text-muted-foreground hover:text-primary transition-colors shrink-0 opacity-0 group-hover:opacity-100">
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      {/* Type */}
                      <TableCell>
                        {webhook.type === 'outbound' ? (
                          <Badge variant="outline" className="bg-blue-500/5 text-blue-500 border-blue-500/20 gap-1 text-[10px] font-bold rounded-lg">
                            <ArrowUpRight className="h-3 w-3" /> Out
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-purple-500/5 text-purple-500 border-purple-500/20 gap-1 text-[10px] font-bold rounded-lg">
                            <ArrowDownLeft className="h-3 w-3" /> In
                          </Badge>
                        )}
                      </TableCell>
                      {/* Trigger */}
                      <TableCell>
                        {webhook.trigger ? (
                          <span className="text-[10px] font-bold text-foreground/70 bg-muted/50 px-2.5 py-1 rounded-lg">
                            {TRIGGER_LABELS[webhook.trigger] || webhook.trigger}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/40 italic">—</span>
                        )}
                      </TableCell>
                      {/* Status */}
                      <TableCell>
                        <Badge
                          variant={webhook.status === 'failed' ? 'destructive' : 'secondary'}
                          className={cn(
                            "gap-1 text-[10px] font-bold uppercase rounded-lg",
                            webhook.status === 'active' && "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20",
                            webhook.status === 'paused' && "text-muted-foreground"
                          )}
                        >
                          {webhook.status === 'active' ? <Zap className="h-3 w-3" /> : webhook.status === 'paused' ? <ZapOff className="h-3 w-3" /> : null}
                          {webhook.status}
                        </Badge>
                      </TableCell>
                      {/* Last Fired */}
                      <TableCell className="hidden lg:table-cell">
                        {webhook.lastTriggeredAt ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 cursor-default">
                                <Clock className="h-3 w-3 opacity-40" />
                                {formatDistanceToNow(new Date(webhook.lastTriggeredAt), { addSuffix: true })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="text-xs font-bold">
                              {format(new Date(webhook.lastTriggeredAt), "PPpp")}
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/30 italic">Never</span>
                        )}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary" onClick={() => toggleWebhookStatus(webhook)}>
                                {webhook.status === 'paused' ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{webhook.status === 'paused' ? 'Activate' : 'Pause'}</TooltipContent>
                          </Tooltip>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="rounded-xl font-bold w-48">
                              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">Manage</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => { setEditingWebhook(webhook); setIsEditorOpen(true); }}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => copyUrl(webhook.url)}>
                                <Copy className="mr-2 h-4 w-4" /> Copy URL
                              </DropdownMenuItem>
                              {webhook.secret && (
                                <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(webhook.secret!); toast({ title: 'Secret Copied' }); }}>
                                  <ShieldCheck className="mr-2 h-4 w-4" /> Copy Secret
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-destructive focus:bg-destructive/10" onClick={() => setWebhookToDelete(webhook)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-72 text-center">
                      <div className="flex flex-col items-center justify-center gap-4 opacity-25">
                        <Unplug className="h-16 w-16 stroke-[1.2]" />
                        <div className="space-y-1">
                          <p className="font-bold text-sm">No webhooks configured</p>
                          <p className="text-xs font-medium">Create your first integration to move data in real-time.</p>
                        </div>
                        <Button variant="outline" className="rounded-xl font-bold h-9 mt-2" onClick={() => { setEditingWebhook(null); setIsEditorOpen(true); }}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Create Webhook
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Delete Confirmation */}
          <AlertDialog open={!!webhookToDelete} onOpenChange={(open) => !open && setWebhookToDelete(null)}>
            <AlertDialogContent className="rounded-2xl border-border/50 shadow-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl font-bold">Delete Webhook?</AlertDialogTitle>
                <AlertDialogDescription className="text-sm font-medium">
                  This will permanently remove <span className="font-bold text-foreground">"{webhookToDelete?.name}"</span>.
                  Any external systems relying on this endpoint will stop receiving data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="gap-2 sm:gap-0">
                <AlertDialogCancel className="rounded-xl font-bold h-11">Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteWebhook}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl font-bold h-11 px-8"
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Editor Sheet (lazy-loaded) */}
          <WebhookEditor
            isOpen={isEditorOpen}
            onOpenChange={setIsEditorOpen}
            webhook={editingWebhook}
          />
        </div>
    </TooltipProvider>
  );
}
