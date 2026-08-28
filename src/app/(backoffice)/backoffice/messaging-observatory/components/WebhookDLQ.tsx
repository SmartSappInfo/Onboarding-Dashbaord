/**
 * @fileoverview Outbound Webhook Dead-Letter Queue (DLQ) Component
 *
 * CAUTION FOR FUTURE MAINTAINERS:
 * - Real-time inspection table for failed webhook dispatches.
 * - Single item and bulk replay triggers calling `replayWebhookDeadLetterAction`.
 * - Zero `any` or `any[]` typing.
 */

'use client';

import * as React from 'react';
import {
  RotateCcw,
  AlertOctagon,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Search,
  Code,
  Layers,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useBackofficeToken } from '@/hooks/use-backoffice-token';
import { useToast } from '@/hooks/use-toast';
import { useBackoffice } from '../../context/BackofficeProvider';
import {
  listWebhookDeadLettersAction,
  replayWebhookDeadLetterAction,
} from '@/lib/backoffice/backoffice-messaging-observatory-actions';
import type { WebhookDeadLetter } from '@/lib/backoffice/backoffice-types';

export default function WebhookDLQ() {
  const { can } = useBackoffice();
  const getToken = useBackofficeToken();
  const { toast } = useToast();

  const [items, setItems] = React.useState<WebhookDeadLetter[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [replayingId, setReplayingId] = React.useState<string | null>(null);
  const [isBulkReplaying, setIsBulkReplaying] = React.useState(false);
  const [previewItem, setPreviewItem] = React.useState<WebhookDeadLetter | null>(null);

  const fetchItems = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const idToken = await getToken();
      const res = await listWebhookDeadLettersAction({ status: 'all' }, idToken);
      if (res.success && res.items) {
        setItems(res.items);
      }
    } catch (err) {
      console.error('Failed to list DLQ items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [getToken]);

  React.useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleReplaySingle = async (dlId: string) => {
    setReplayingId(dlId);
    try {
      const idToken = await getToken();
      const res = await replayWebhookDeadLetterAction(dlId, idToken);

      if (res.success) {
        toast({
          title: 'Webhook Replayed Successfully',
          description: `Endpoint responded with HTTP ${res.httpStatus}.`,
        });
        fetchItems();
      } else {
        toast({
          variant: 'destructive',
          title: 'Replay Failed',
          description: res.error || `Endpoint responded with HTTP ${res.httpStatus}.`,
        });
        fetchItems();
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to trigger webhook replay.',
      });
    } finally {
      setReplayingId(null);
    }
  };

  const handleBulkReplay = async () => {
    const failedItems = items.filter((i) => i.status === 'failed');
    if (failedItems.length === 0) return;

    setIsBulkReplaying(true);
    let successCount = 0;
    try {
      const idToken = await getToken();
      for (const item of failedItems) {
        const res = await replayWebhookDeadLetterAction(item.id, idToken);
        if (res.success) successCount++;
      }

      toast({
        title: 'Bulk Replay Finished',
        description: `Successfully delivered ${successCount} of ${failedItems.length} webhooks.`,
      });
      fetchItems();
    } catch {
      toast({
        variant: 'destructive',
        title: 'Bulk Replay Interrupted',
        description: 'Some webhooks could not be dispatched.',
      });
    } finally {
      setIsBulkReplaying(false);
    }
  };

  const filteredItems = React.useMemo(() => {
    return items.filter((i) => {
      return (
        search === '' ||
        i.endpointUrl.toLowerCase().includes(search.toLowerCase()) ||
        i.eventType.toLowerCase().includes(search.toLowerCase()) ||
        i.workspaceId.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [items, search]);

  return (
    <div className="space-y-4">
      {/* Action & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search DLQ by endpoint URL, event type, or workspace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 h-11 rounded-xl bg-card border-border text-xs"
          />
        </div>

        {can('messaging_observatory', 'execute') && items.some((i) => i.status === 'failed') && (
          <Button
            onClick={handleBulkReplay}
            disabled={isBulkReplaying}
            className="h-11 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/20 active:scale-[0.97] transition-all gap-2 w-full sm:w-auto"
          >
            {isBulkReplaying ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {isBulkReplaying ? 'Replaying DLQ...' : 'Replay All Failed'}
          </Button>
        )}
      </div>

      {/* DLQ Table */}
      <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            <p className="text-xs font-medium">Loading Dead-Letter Queue...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center gap-2 text-center">
            <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-foreground">Dead-Letter Queue Clean</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              All tenant outbound webhook deliveries have completed successfully with zero stranded payloads.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-xs font-bold uppercase tracking-wider py-4">Status</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Event Type</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Target Endpoint</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Attempts</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider">Last HTTP</TableHead>
                  <TableHead className="text-xs font-bold uppercase tracking-wider text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} className="border-border/60 hover:bg-muted/40 transition-colors">
                    <TableCell className="py-4">
                      <Badge
                        className={`capitalize text-[10px] rounded-lg border ${
                          item.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold'
                        }`}
                      >
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-bold text-foreground">{item.eventType}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground line-clamp-1 max-w-xs">
                        {item.endpointUrl}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs font-semibold text-muted-foreground">
                        {item.attemptCount}x
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-mono text-xs font-bold ${
                          item.httpStatus && item.httpStatus < 400 ? 'text-emerald-500' : 'text-rose-500'
                        }`}
                      >
                        {item.httpStatus ? `HTTP ${item.httpStatus}` : 'Timeout'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewItem(item)}
                          className="h-8 px-2.5 rounded-lg text-xs font-semibold gap-1"
                        >
                          <Code className="h-3.5 w-3.5" />
                          <span>Payload</span>
                        </Button>

                        {can('messaging_observatory', 'execute') && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReplaySingle(item.id)}
                            disabled={replayingId === item.id}
                            className="h-8 px-2.5 rounded-lg text-xs font-semibold active:scale-[0.97] gap-1"
                          >
                            {replayingId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
                            )}
                            <span>Replay</span>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Payload Inspection Modal */}
      <Dialog open={Boolean(previewItem)} onOpenChange={(open) => !open && setPreviewItem(null)}>
        <DialogContent className="max-w-xl bg-card border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground">
              Webhook Payload Preview
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-mono">
              {previewItem?.endpointUrl}
            </DialogDescription>
          </DialogHeader>

          {previewItem && (
            <div className="space-y-3 py-2">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border max-h-72 overflow-y-auto">
                <pre className="font-mono text-[11px] text-foreground/90 whitespace-pre-wrap">
                  {JSON.stringify(previewItem.payload, null, 2)}
                </pre>
              </div>

              {previewItem.errorMessage && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 font-mono">
                  <span className="font-bold">Error:</span> {previewItem.errorMessage}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
