'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Webhook,
  Plus,
  Copy,
  Check,
  Send,
  Trash2,
  Key,
  ShieldCheck,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  getMeetingWebhooksAction,
  saveMeetingWebhookAction,
  deleteMeetingWebhookAction,
  testDispatchWebhookAction,
  getWebhookDeliveryLogsAction,
} from '@/app/actions/meeting-webhook-actions';
import type {
  MeetingWebhookEndpoint,
  WebhookDeliveryLog,
  MeetingWebhookEvent,
} from '@/lib/meetings/types/webhooks';
import { format } from 'date-fns';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'An unexpected error occurred.';
}

const AVAILABLE_EVENTS: Array<{ event: MeetingWebhookEvent; label: string }> = [
  { event: 'booking.created', label: 'Booking Created' },
  { event: 'booking.rescheduled', label: 'Booking Rescheduled' },
  { event: 'booking.cancelled', label: 'Booking Cancelled' },
  { event: 'meeting.completed', label: 'Meeting Completed' },
  { event: 'participant.joined', label: 'Participant Joined' },
  { event: 'intelligence.generated', label: 'AI Intelligence Generated' },
];

export function DeveloperClient() {
  const { activeWorkspaceId } = useWorkspace();
  const { toast } = useToast();

  const [endpoints, setEndpoints] = React.useState<MeetingWebhookEndpoint[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [copiedSecretId, setCopiedSecretId] = React.useState<string | null>(null);

  // Modal State
  const [modalOpen, setModalOpen] = React.useState(false);
  const [targetUrl, setTargetUrl] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedEvents, setSelectedEvents] = React.useState<MeetingWebhookEvent[]>([
    'booking.created',
    'booking.cancelled',
  ]);
  const [isSaving, setIsSaving] = React.useState(false);

  // Testing & Delivery Logs State
  const [testingEndpointId, setTestingEndpointId] = React.useState<string | null>(null);
  const [activeLogsEndpoint, setActiveLogsEndpoint] = React.useState<MeetingWebhookEndpoint | null>(null);
  const [deliveryLogs, setDeliveryLogs] = React.useState<WebhookDeliveryLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = React.useState(false);

  const fetchEndpoints = React.useCallback(async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    try {
      const res = await getMeetingWebhooksAction(activeWorkspaceId);
      if (res.success && res.endpoints) {
        setEndpoints(res.endpoints);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Failed to load webhook endpoints',
        description: getErrorMessage(err),
      });
    } finally {
      setIsLoading(false);
    }
  }, [activeWorkspaceId, toast]);

  React.useEffect(() => {
    fetchEndpoints();
  }, [fetchEndpoints]);

  const handleToggleEvent = (event: MeetingWebhookEvent) => {
    setSelectedEvents(prev =>
      prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]
    );
  };

  const handleSaveEndpoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    if (!targetUrl.trim().startsWith('http://') && !targetUrl.trim().startsWith('https://')) {
      toast({
        variant: 'destructive',
        title: 'Invalid URL',
        description: 'Endpoint URL must start with http:// or https://',
      });
      return;
    }
    if (selectedEvents.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Events required',
        description: 'Select at least one webhook event to subscribe to.',
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await saveMeetingWebhookAction({
        workspaceId: activeWorkspaceId,
        url: targetUrl.trim(),
        description: description.trim() || undefined,
        subscribedEvents: selectedEvents,
      });

      if (res.success) {
        toast({
          title: 'Webhook Endpoint Registered!',
          description: 'Outbound meeting events will now be dispatched with HMAC-SHA256 signatures.',
        });
        setModalOpen(false);
        setTargetUrl('');
        setDescription('');
        fetchEndpoints();
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEndpoint = async (id: string) => {
    if (!activeWorkspaceId) return;
    try {
      const res = await deleteMeetingWebhookAction(id, activeWorkspaceId);
      if (res.success) {
        toast({ title: 'Webhook Endpoint Deleted' });
        fetchEndpoints();
      }
    } catch (err) {
      console.warn('[delete webhook]', err);
    }
  };

  const handleTestDispatch = async (endpoint: MeetingWebhookEndpoint) => {
    if (!activeWorkspaceId) return;
    setTestingEndpointId(endpoint.id);
    try {
      const res = await testDispatchWebhookAction(
        endpoint.id,
        activeWorkspaceId,
        endpoint.subscribedEvents[0] || 'booking.created'
      );

      if (res.success) {
        toast({
          title: 'Test Webhook Dispatched!',
          description: `Endpoint responded with status ${res.statusCode} in ${res.durationMs}ms.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Test Webhook Failed',
          description: res.error || 'Endpoint failed to respond.',
        });
      }
      fetchEndpoints();
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Dispatch Error',
        description: getErrorMessage(err),
      });
    } finally {
      setTestingEndpointId(null);
    }
  };

  const handleViewLogs = async (endpoint: MeetingWebhookEndpoint) => {
    if (!activeWorkspaceId) return;
    setActiveLogsEndpoint(endpoint);
    setIsLoadingLogs(true);
    try {
      const res = await getWebhookDeliveryLogsAction(endpoint.id, activeWorkspaceId);
      if (res.success && res.logs) {
        setDeliveryLogs(res.logs);
      }
    } catch (err) {
      console.warn('[fetch logs]', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const handleCopySecret = (secret: string, id: string) => {
    navigator.clipboard.writeText(secret);
    setCopiedSecretId(id);
    toast({ title: 'Signing Secret copied!' });
    setTimeout(() => setCopiedSecretId(null), 2000);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl" />
        <Skeleton className="h-44 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Developer Hub & Webhooks
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Receive signed real-time HTTP webhooks for booking lifecycles, attendance, and AI intelligence.
          </p>
        </div>

        <Button
          onClick={() => setModalOpen(true)}
          className="rounded-xl min-h-[44px] gap-2 font-semibold shadow-sm active:scale-[0.97]"
        >
          <Plus className="h-4 w-4" />
          Add Webhook Endpoint
        </Button>
      </div>

      {/* Endpoints List */}
      {endpoints.length === 0 ? (
        <Card className="rounded-3xl border-dashed p-12 text-center space-y-3">
          <Webhook className="h-12 w-12 mx-auto text-primary opacity-30 animate-pulse" />
          <h3 className="text-base font-semibold text-foreground">No webhook endpoints registered</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Subscribe your external backend, Zapier, Make, or custom API to SmartSapp meeting events.
          </p>
          <Button
            onClick={() => setModalOpen(true)}
            className="rounded-xl min-h-[44px] text-xs gap-2 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Add First Endpoint
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {endpoints.map(endpoint => (
            <Card key={endpoint.id} className="rounded-2xl border shadow-sm p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-foreground">{endpoint.url}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] uppercase font-bold ${
                        endpoint.enabled ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {endpoint.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                  </div>
                  {endpoint.description && (
                    <p className="text-xs text-muted-foreground">{endpoint.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleTestDispatch(endpoint)}
                    disabled={testingEndpointId === endpoint.id}
                    className="rounded-xl h-9 text-xs gap-1.5 active:scale-[0.97]"
                  >
                    <Send className="h-3.5 w-3.5" />
                    {testingEndpointId === endpoint.id ? 'Pinging...' : 'Send Test Ping'}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleViewLogs(endpoint)}
                    className="rounded-xl h-9 text-xs gap-1.5"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    Logs
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteEndpoint(endpoint.id)}
                    className="rounded-xl h-9 w-9 text-rose-500 hover:text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Subscribed Events Badges */}
              <div className="flex flex-wrap gap-1.5">
                {endpoint.subscribedEvents.map(evt => (
                  <Badge key={evt} variant="outline" className="text-[10px] font-mono">
                    {evt}
                  </Badge>
                ))}
              </div>

              {/* Signing Secret Box */}
              <div className="p-3 rounded-xl bg-muted/40 border flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Key className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="text-[11px] text-muted-foreground">Signing Secret:</span>
                  <code className="font-mono text-[11px] text-foreground">
                    {endpoint.secretKey.slice(0, 10)}••••••••••••••••
                  </code>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopySecret(endpoint.secretKey, endpoint.id)}
                  className="h-7 text-[11px] px-2 rounded-lg gap-1"
                >
                  {copiedSecretId === endpoint.id ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy Secret
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add Webhook Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              Register Webhook Endpoint
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure target URL and subscribed event triggers.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEndpoint} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Endpoint URL *</Label>
              <Input
                required
                type="url"
                value={targetUrl}
                onChange={e => setTargetUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/smartsapp"
                className="rounded-xl min-h-[44px] text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="font-semibold">Description (Optional)</Label>
              <Input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="e.g. Production Zapier Sync"
                className="rounded-xl min-h-[44px] text-xs"
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="font-semibold text-foreground">Subscribed Events *</Label>
              <div className="grid grid-cols-2 gap-2">
                {AVAILABLE_EVENTS.map(item => (
                  <button
                    key={item.event}
                    type="button"
                    onClick={() => handleToggleEvent(item.event)}
                    className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center justify-between transition-all ${
                      selectedEvents.includes(item.event)
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-muted/30 text-muted-foreground'
                    }`}
                  >
                    <span>{item.label}</span>
                    {selectedEvents.includes(item.event) && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            <DialogFooter className="gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="rounded-xl min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="rounded-xl min-h-[44px] px-5 active:scale-[0.97]"
              >
                {isSaving ? 'Registering...' : 'Register Endpoint'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delivery Logs Viewer Modal */}
      {activeLogsEndpoint && (
        <Dialog open={Boolean(activeLogsEndpoint)} onOpenChange={() => setActiveLogsEndpoint(null)}>
          <DialogContent className="max-w-2xl rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Delivery Logs for {activeLogsEndpoint.url}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 max-h-96 overflow-y-auto">
              {isLoadingLogs ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 rounded-xl" />
                  <Skeleton className="h-12 rounded-xl" />
                </div>
              ) : deliveryLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No delivery logs recorded yet. Send a test ping to verify!
                </p>
              ) : (
                deliveryLogs.map(log => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      log.success ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        {log.success ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />
                        )}
                        <span className="font-mono font-bold text-foreground">{log.event}</span>
                        <Badge variant="outline" className="text-[9px]">
                          {log.statusCode || 'Err'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(log.deliveredAt), 'p')} • Duration: {log.durationMs}ms
                      </p>
                    </div>

                    {log.responseBody && (
                      <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">
                        {log.responseBody}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
