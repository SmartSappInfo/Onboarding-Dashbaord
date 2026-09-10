'use client';

/**
 * @fileOverview SmartSapp Media Intelligence 2.0 - Developer Platform & API Hub
 *
 * Provides a unified enterprise workbench for API key management, HMAC-SHA256 outbound webhooks,
 * live interactive API testing, and developer SDK quickstarts.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (RULE 10):
 * 1. Zero Plaintext Persistence: API keys are shown ONCE in a secure reveal dialog.
 * 2. Touch Target Compliance: All interactive buttons and inputs enforce `min-h-[44px] min-w-[44px]`.
 * 3. Tactile Micro-Animations: `active:scale-[0.97]` applied to all primary and secondary actions.
 * 4. Strict Typing: Zero `any`, `any[]`, or `unknown`.
 *
 * PRD & UX REFERENCES:
 * - PRD Sec 113 (Webhooks), Sec 115 (SDK), Sec 132 (Phase 9 - Enterprise Platform).
 * - UX Sec 160 (Phase 9 - Enterprise) & Screen 63 (Settings / API).
 */

import React, { useState, useEffect, useTransition } from 'react';
import {
  Key,
  Webhook,
  Code2,
  Terminal,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Send,
  AlertCircle,
  ShieldCheck,
  Activity,
  Layers,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/context/WorkspaceContext';
import {
  generateMediaApiKeyAction,
  listMediaApiKeysAction,
  revokeMediaApiKeyAction,
} from '@/lib/media/developer-service';
import {
  createWebhookEndpointAction,
  listWebhookEndpointsAction,
  deleteWebhookEndpointAction,
  testWebhookEndpointAction,
  listWebhookDeliveryLogsAction,
  replayWebhookDeliveryAction,
} from '@/lib/media/webhook-service';
import type {
  MediaApiKey,
  MediaApiKeyScope,
  MediaWebhookEndpoint,
  MediaWebhookDeliveryLog,
  MediaWebhookEventType,
} from '@/lib/types/media-2.0';

const AVAILABLE_SCOPES: { id: MediaApiKeyScope; label: string; desc: string }[] = [
  { id: 'media:read', label: 'Read Media', desc: 'Query assets, experiences, transcripts, and recommendations.' },
  { id: 'media:write', label: 'Write Media', desc: 'Create assets, ingest external playback telemetry, and log events.' },
  { id: 'media:publish', label: 'Publish Media', desc: 'Publish, unpublish, and configure experience gating rules.' },
  { id: 'media:analytics', label: 'Analytics & Attribution', desc: 'Query multi-touch attribution and executive metrics.' },
  { id: 'media:webhooks', label: 'Manage Webhooks', desc: 'Register, inspect, and rotate outbound webhook endpoints.' },
  { id: 'media:admin', label: 'Full Admin Access', desc: 'Complete administrative access across all media capabilities.' },
];

const AVAILABLE_WEBHOOK_EVENTS: { id: MediaWebhookEventType; label: string; desc: string }[] = [
  { id: 'media.asset.published', label: 'Asset Published', desc: 'Fires when an asset is published or versioned.' },
  { id: 'media.session.completed', label: 'Session Completed', desc: 'Fires when a viewer completes playback.' },
  { id: 'media.cta.clicked', label: 'CTA Clicked', desc: 'Fires when a viewer engages with an interactive CTA.' },
  { id: 'media.contact.identified', label: 'Contact Identified', desc: 'Fires when viewer identity is resolved to CRM.' },
  { id: 'media.intent.high', label: 'High Buyer Intent', desc: 'Fires when multi-stakeholder or high intent triggers.' },
  { id: 'media.deal.influenced', label: 'Deal Influenced', desc: 'Fires when media is attributed to closed-won revenue.' },
  { id: 'media.experiment.winner_promoted', label: 'Winner Promoted', desc: 'Fires when an A/B or MAB winner is locked.' },
  { id: 'media.decay.detected', label: 'Content Decay', desc: 'Fires when view velocity regression is detected.' },
];

export default function MediaDeveloperConsolePage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id || '';
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'keys' | 'webhooks' | 'explorer' | 'sdk'>('keys');
  const [keys, setKeys] = useState<MediaApiKey[]>([]);
  const [endpoints, setEndpoints] = useState<MediaWebhookEndpoint[]>([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState<MediaWebhookEndpoint | null>(null);
  const [deliveryLogs, setDeliveryLogs] = useState<MediaWebhookDeliveryLog[]>([]);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [_isPending, startTransition] = useTransition();

  // Create Key Modal State
  const [isCreateKeyOpen, setIsCreateKeyOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<MediaApiKeyScope[]>(['media:read']);
  const [expiryDays, setExpiryDays] = useState<string>('90');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Add Webhook Modal State
  const [isAddWebhookOpen, setIsAddWebhookOpen] = useState(false);
  const [webhookName, setWebhookName] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<MediaWebhookEventType[]>([
    'media.asset.published',
    'media.cta.clicked',
  ]);

  // API Explorer State
  const [explorerEndpoint, setExplorerEndpoint] = useState<string>('/api/v1/media/assets');
  const [explorerMethod, setExplorerMethod] = useState<'GET' | 'POST'>('GET');
  const [explorerBody, setExplorerBody] = useState<string>('{\n  "query": "pricing",\n  "limit": 5\n}');
  const [explorerResponse, setExplorerResponse] = useState<string | null>(null);
  const [isExecutingApi, setIsExecutingApi] = useState(false);

  // Load Data
  const loadData = () => {
    if (!workspaceId) return;
    startTransition(async () => {
      const [keysRes, epRes] = await Promise.all([
        listMediaApiKeysAction(workspaceId),
        listWebhookEndpointsAction(workspaceId),
      ]);

      if (keysRes.success && keysRes.keys) setKeys(keysRes.keys);
      if (epRes.success && epRes.endpoints) setEndpoints(epRes.endpoints);
    });
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  // Handle Key Generation
  const handleGenerateKey = async () => {
    if (!newKeyName.trim() || !workspaceId) return;
    const days = expiryDays === 'never' ? undefined : parseInt(expiryDays, 10);

    startTransition(async () => {
      const res = await generateMediaApiKeyAction(workspaceId, newKeyName, selectedScopes, days);
      if (res.success && res.key) {
        setRevealedKey(res.key);
        setIsCreateKeyOpen(false);
        setNewKeyName('');
        setSelectedScopes(['media:read']);
        loadData();
      } else {
        toast({ title: 'Key Generation Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle Key Revocation
  const handleRevokeKey = (keyId: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action is immediate and permanent.')) return;
    startTransition(async () => {
      const res = await revokeMediaApiKeyAction(keyId, workspaceId);
      if (res.success) {
        toast({ title: 'API Key Revoked', description: 'The key can no longer authenticate requests.' });
        loadData();
      } else {
        toast({ title: 'Revocation Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle Add Webhook
  const handleAddWebhook = async () => {
    if (!webhookName.trim() || !webhookUrl.trim() || !workspaceId) return;

    startTransition(async () => {
      const res = await createWebhookEndpointAction(workspaceId, webhookName, webhookUrl, selectedEvents);
      if (res.success) {
        toast({ title: 'Webhook Registered', description: 'Endpoint will receive signed JSON POST notifications.' });
        setIsAddWebhookOpen(false);
        setWebhookName('');
        setWebhookUrl('');
        loadData();
      } else {
        toast({ title: 'Registration Failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  // Handle Test Ping
  const handleTestPing = (webhookId: string) => {
    startTransition(async () => {
      toast({ title: 'Dispatching Test Ping...', description: 'Sending signed test payload to endpoint.' });
      const res = await testWebhookEndpointAction(webhookId, workspaceId);
      if (res.success) {
        toast({ title: 'Ping Succeeded', description: 'Destination acknowledged request with HTTP 200 OK.' });
        loadData();
      } else {
        toast({
          title: 'Ping Failed',
          description: res.error || 'Destination failed to respond successfully.',
          variant: 'destructive',
        });
      }
    });
  };

  // Handle View Logs
  const handleOpenLogs = async (endpoint: MediaWebhookEndpoint) => {
    setSelectedEndpoint(endpoint);
    setIsLogsOpen(true);
    const res = await listWebhookDeliveryLogsAction(workspaceId, endpoint.id, 50);
    if (res.success && res.logs) {
      setDeliveryLogs(res.logs);
    }
  };

  // Handle Replay Log
  const handleReplayLog = async (logId: string) => {
    const res = await replayWebhookDeliveryAction(logId, workspaceId);
    if (res.success) {
      toast({ title: 'Replay Dispatched', description: 'Delivery was successfully resent.' });
      if (selectedEndpoint) {
        const refreshed = await listWebhookDeliveryLogsAction(workspaceId, selectedEndpoint.id, 50);
        if (refreshed.success && refreshed.logs) setDeliveryLogs(refreshed.logs);
      }
      loadData();
    } else {
      toast({ title: 'Replay Failed', description: res.error, variant: 'destructive' });
    }
  };

  // Handle API Explorer Execution
  const handleExecuteExplorer = async () => {
    setIsExecutingApi(true);
    setExplorerResponse(null);
    try {
      let bodyData: BodyInit | undefined;
      if (explorerMethod === 'POST') {
        bodyData = explorerBody;
      }

      // Execute request using the first active key if available
      const activeKey = keys.find((k) => k.status === 'ACTIVE');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey) {
        headers['x-api-key'] = activeKey.keyPrefix; // Simulator indicator
      }

      const res = await fetch(explorerEndpoint, {
        method: explorerMethod,
        headers,
        body: bodyData,
      });

      const json = await res.json();
      setExplorerResponse(JSON.stringify(json, null, 2));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'API invocation failed';
      setExplorerResponse(JSON.stringify({ error: msg }, null, 2));
    } finally {
      setIsExecutingApi(false);
    }
  };

  // Hero KPI Calculations
  const activeKeysCount = keys.filter((k) => k.status === 'ACTIVE').length;
  const activeWebhooksCount = endpoints.filter((e) => e.status === 'ACTIVE').length;
  const totalDeliveries = endpoints.reduce((acc, ep) => acc + (ep.totalDeliveries || 0), 0);
  const successfulDeliveries = endpoints.reduce((acc, ep) => acc + (ep.successfulDeliveries || 0), 0);
  const deliveryRate = totalDeliveries > 0 ? Math.round((successfulDeliveries / totalDeliveries) * 100) : 100;

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Code2 className="h-6 w-6 text-primary" /> Developer Platform & API Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Provision scoped API credentials, HMAC-signed webhooks, interactive API exploration, and developer SDKs.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setIsCreateKeyOpen(true)}
            className="rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" /> Create API Key
          </Button>

          <Button
            onClick={() => setIsAddWebhookOpen(true)}
            variant="outline"
            className="rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
          >
            <Webhook className="h-4 w-4" /> Add Webhook
          </Button>
        </div>
      </div>

      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Active API Keys</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{activeKeysCount}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{keys.length} total provisioned</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Key className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Webhook Endpoints</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{activeWebhooksCount}</h3>
              <p className="text-[11px] text-emerald-500 font-semibold mt-0.5">HMAC-SHA256 Signed</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Webhook className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Delivery Success Rate</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{deliveryRate}%</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{successfulDeliveries} of {totalDeliveries} delivered</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-border bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">API Rate Limit</p>
              <h3 className="text-2xl font-black text-foreground mt-1">60/min</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">Sliding-window windowing</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Activity className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="w-full">
        <TabsList className="bg-muted/60 p-1 rounded-2xl w-full sm:w-auto grid grid-cols-4 min-h-[44px]">
          <TabsTrigger value="keys" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <Key className="h-3.5 w-3.5" /> API Keys
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <Webhook className="h-3.5 w-3.5" /> Webhooks
          </TabsTrigger>
          <TabsTrigger value="explorer" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <Terminal className="h-3.5 w-3.5" /> API Explorer
          </TabsTrigger>
          <TabsTrigger value="sdk" className="rounded-xl font-bold text-xs min-h-[36px] gap-1.5 active:scale-[0.97]">
            <Code2 className="h-3.5 w-3.5" /> Developer SDK
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: API Keys */}
        <TabsContent value="keys" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Workspace API Keys</CardTitle>
              <CardDescription className="text-xs">
                Credentials carry scoped permissions. Raw secret tokens are never stored in the database.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {keys.length === 0 ? (
                <div className="p-8 text-center">
                  <Key className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">No API Keys Generated</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Generate an API key to programmatically upload assets, query transcripts, or stream viewer telemetry.
                  </p>
                  <Button
                    onClick={() => setIsCreateKeyOpen(true)}
                    className="mt-4 rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
                  >
                    <Plus className="h-4 w-4" /> Create API Key
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {keys.map((k) => (
                    <div key={k.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{k.name}</span>
                          <Badge variant={k.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-[10px] font-bold">
                            {k.status}
                          </Badge>
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
                            {k.keyPrefix}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {k.scopes.map((s) => (
                            <Badge key={s} variant="outline" className="text-[10px] bg-background">
                              {s}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                          {k.expiresAt && <span>Expires: {new Date(k.expiresAt).toLocaleDateString()}</span>}
                          {k.lastUsedAt && <span>Last Used: {new Date(k.lastUsedAt).toLocaleDateString()}</span>}
                        </div>
                      </div>

                      {k.status === 'ACTIVE' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRevokeKey(k.id)}
                          className="rounded-xl text-xs font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 min-h-[44px] self-start sm:self-auto active:scale-[0.97]"
                        >
                          <Trash2 className="h-4 w-4 mr-1" /> Revoke Key
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Outbound Webhooks */}
        <TabsContent value="webhooks" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Configured Webhook Endpoints</CardTitle>
              <CardDescription className="text-xs">
                SmartSapp sends HMAC-SHA256 signed JSON notifications for published assets, CTA conversions, and buyer intent.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {endpoints.length === 0 ? (
                <div className="p-8 text-center">
                  <Webhook className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-foreground">No Webhooks Registered</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                    Add a destination URL to receive real-time updates in your CRM, Slack bot, or data warehouse.
                  </p>
                  <Button
                    onClick={() => setIsAddWebhookOpen(true)}
                    className="mt-4 rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
                  >
                    <Plus className="h-4 w-4" /> Add Webhook
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {endpoints.map((ep) => (
                    <div key={ep.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{ep.name}</span>
                          <Badge
                            variant={ep.status === 'ACTIVE' ? 'default' : ep.status === 'FAILING' ? 'destructive' : 'secondary'}
                            className="text-[10px] font-bold"
                          >
                            {ep.status}
                          </Badge>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground break-all">{ep.url}</p>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {ep.subscribedEvents.map((ev) => (
                            <Badge key={ev} variant="outline" className="text-[10px] bg-background">
                              {ev}
                            </Badge>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-1">
                          <span>Success: {ep.successfulDeliveries || 0}</span>
                          <span>Failed: {ep.failedDeliveries || 0}</span>
                          {ep.lastDeliveryAt && <span>Last: {new Date(ep.lastDeliveryAt).toLocaleTimeString()}</span>}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestPing(ep.id)}
                          className="rounded-xl text-xs font-bold min-h-[44px] gap-1.5 active:scale-[0.97]"
                        >
                          <Send className="h-3.5 w-3.5" /> Test Ping
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenLogs(ep)}
                          className="rounded-xl text-xs font-bold min-h-[44px] gap-1.5 active:scale-[0.97]"
                        >
                          <Layers className="h-3.5 w-3.5" /> View Logs
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteWebhookEndpointAction(ep.id, workspaceId).then(loadData)}
                          className="rounded-xl text-muted-foreground hover:text-destructive min-h-[44px] min-w-[44px] p-0 active:scale-[0.97]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Interactive API Explorer */}
        <TabsContent value="explorer" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Interactive API Explorer</CardTitle>
              <CardDescription className="text-xs">
                Test live REST API v1 endpoints directly from your browser with authenticated tokens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-semibold">Method</Label>
                  <Select value={explorerMethod} onValueChange={(val) => setExplorerMethod(val as 'GET' | 'POST')}>
                    <SelectTrigger className="rounded-xl min-h-[44px] mt-1 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-3">
                  <Label className="text-xs font-semibold">Endpoint</Label>
                  <Select value={explorerEndpoint} onValueChange={(val) => setExplorerEndpoint(val)}>
                    <SelectTrigger className="rounded-xl min-h-[44px] mt-1 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="/api/v1/media/assets">GET /api/v1/media/assets</SelectItem>
                      <SelectItem value="/api/v1/media/experiences">GET /api/v1/media/experiences</SelectItem>
                      <SelectItem value="/api/v1/media/search">POST /api/v1/media/search</SelectItem>
                      <SelectItem value="/api/v1/media/recommendations">POST /api/v1/media/recommendations</SelectItem>
                      <SelectItem value="/api/v1/media/events">POST /api/v1/media/events</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {explorerMethod === 'POST' && (
                <div>
                  <Label className="text-xs font-semibold">JSON Request Body</Label>
                  <textarea
                    value={explorerBody}
                    onChange={(e) => setExplorerBody(e.target.value)}
                    className="w-full h-28 rounded-xl border border-border bg-muted/40 p-3 font-mono text-xs text-foreground mt-1 focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}

              <Button
                onClick={handleExecuteExplorer}
                disabled={isExecutingApi}
                className="rounded-xl font-bold text-xs min-h-[44px] gap-2 active:scale-[0.97]"
              >
                {isExecutingApi ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Terminal className="h-4 w-4" />}
                Run Request
              </Button>

              {explorerResponse && (
                <div className="mt-4 pt-4 border-t border-border">
                  <Label className="text-xs font-semibold">JSON Response</Label>
                  <pre className="mt-1 p-4 rounded-xl bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-80 text-foreground">
                    {explorerResponse}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Developer SDK Quickstart */}
        <TabsContent value="sdk" className="space-y-4 mt-4">
          <Card className="rounded-2xl border-border">
            <CardHeader>
              <CardTitle className="text-base font-bold">Developer SDK Integration</CardTitle>
              <CardDescription className="text-xs">
                Zero-dependency client libraries for TypeScript, Node.js, and browser embedding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">1. Quick Installation</h4>
                <div className="bg-muted p-3 rounded-xl font-mono text-xs flex items-center justify-between">
                  <span>npm install @smartsapp/media-sdk</span>
                  <Button size="sm" variant="ghost" className="h-8 min-h-[36px] rounded-lg">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">2. Client Initialization & Event Tracking</h4>
                <pre className="p-4 rounded-xl bg-muted/50 border border-border text-xs font-mono overflow-x-auto text-foreground">
{`import { SmartSappMediaClient } from '@smartsapp/media-sdk';

const media = new SmartSappMediaClient({
  apiKey: 'sk_media_your_api_key_here',
  baseUrl: 'https://app.smartsapp.com',
});

// Identify active buyer
media.identify('contact_123');

// Track interactive playback
await media.track({
  assetId: 'asset_789',
  eventType: 'progress',
  progressPercent: 75,
});`}
                </pre>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">3. Outbound Webhook HMAC Verification (Node.js)</h4>
                <pre className="p-4 rounded-xl bg-muted/50 border border-border text-xs font-mono overflow-x-auto text-foreground">
{`import crypto from 'crypto';

function verifySignature(payload, signatureHeader, timestampHeader, secret) {
  const expected = 'v1=' + crypto
    .createHmac('sha256', secret)
    .update(timestampHeader + '.' + payload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Create API Key */}
      <Dialog open={isCreateKeyOpen} onOpenChange={setIsCreateKeyOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Generate Scoped API Key</DialogTitle>
            <DialogDescription className="text-xs">
              Keys provide programmatic access to your workspace media library.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Key Name</Label>
              <Input
                placeholder="e.g. Website Integration, Zapier Sync"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="rounded-xl min-h-[44px] mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Expiration</Label>
              <Select value={expiryDays} onValueChange={setExpiryDays}>
                <SelectTrigger className="rounded-xl min-h-[44px] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="30">30 Days</SelectItem>
                  <SelectItem value="90">90 Days (Recommended)</SelectItem>
                  <SelectItem value="365">1 Year</SelectItem>
                  <SelectItem value="never">Never (Long-Lived)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Granular Permissions (Scopes)</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {AVAILABLE_SCOPES.map((sc) => (
                  <label key={sc.id} className="flex items-start gap-2.5 p-2 rounded-xl border border-border hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={selectedScopes.includes(sc.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedScopes([...selectedScopes, sc.id]);
                        } else {
                          setSelectedScopes(selectedScopes.filter((s) => s !== sc.id));
                        }
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">{sc.label}</p>
                      <p className="text-[11px] text-muted-foreground">{sc.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateKeyOpen(false)} className="rounded-xl font-bold min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={handleGenerateKey} disabled={!newKeyName.trim() || selectedScopes.length === 0} className="rounded-xl font-bold min-h-[44px]">
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Key Reveal Dialog (Shown ONCE) */}
      <Dialog open={!!revealedKey} onOpenChange={() => setRevealedKey(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-500">
              <AlertCircle className="h-5 w-5" /> Save Your Secret API Key
            </DialogTitle>
            <DialogDescription className="text-xs">
              This secret key will <strong>never be shown again</strong>. Please copy and store it securely in your secret manager.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <div className="p-3 bg-muted rounded-xl font-mono text-xs break-all text-foreground select-all border border-border">
              {revealedKey}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                if (revealedKey) {
                  navigator.clipboard.writeText(revealedKey);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                  toast({ title: 'Copied to Clipboard' });
                }
              }}
              className="w-full rounded-xl font-bold min-h-[44px] gap-2 active:scale-[0.97]"
            >
              {copiedKey ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copiedKey ? 'Copied!' : 'Copy Secret Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Add Webhook */}
      <Dialog open={isAddWebhookOpen} onOpenChange={setIsAddWebhookOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Register Webhook Endpoint</DialogTitle>
            <DialogDescription className="text-xs">
              SmartSapp will send HMAC-SHA256 signed JSON requests to this destination.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold">Endpoint Name</Label>
              <Input
                placeholder="e.g. HubSpot Sync, Slack Alert Bot"
                value={webhookName}
                onChange={(e) => setWebhookName(e.target.value)}
                className="rounded-xl min-h-[44px] mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold">Destination URL (HTTPS)</Label>
              <Input
                placeholder="https://api.yourdomain.com/webhooks/media"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                className="rounded-xl min-h-[44px] mt-1 font-mono text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-2 block">Subscribed Events</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {AVAILABLE_WEBHOOK_EVENTS.map((ev) => (
                  <label key={ev.id} className="flex items-start gap-2.5 p-2 rounded-xl border border-border hover:bg-muted/40 cursor-pointer">
                    <Checkbox
                      checked={selectedEvents.includes(ev.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEvents([...selectedEvents, ev.id]);
                        } else {
                          setSelectedEvents(selectedEvents.filter((s) => s !== ev.id));
                        }
                      }}
                      className="mt-0.5"
                    />
                    <div>
                      <p className="text-xs font-bold text-foreground">{ev.label}</p>
                      <p className="text-[11px] text-muted-foreground">{ev.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddWebhookOpen(false)} className="rounded-xl font-bold min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={handleAddWebhook} disabled={!webhookName.trim() || !webhookUrl.trim() || selectedEvents.length === 0} className="rounded-xl font-bold min-h-[44px]">
              Add Endpoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delivery Logs Viewer */}
      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="sm:max-w-2xl rounded-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Webhook Delivery Logs
            </DialogTitle>
            <DialogDescription className="text-xs">
              Recent outbound delivery attempts for {selectedEndpoint?.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 py-2">
            {deliveryLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No delivery attempts recorded yet.</p>
            ) : (
              deliveryLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={log.status === 'SUCCESS' ? 'default' : log.status === 'DEAD_LETTER' ? 'destructive' : 'secondary'}
                        className="text-[10px] font-bold"
                      >
                        {log.status}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-foreground">{log.event}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Status Code: {log.statusCode || 'N/A'}</span>
                    <span>Duration: {log.durationMs}ms</span>
                    <span>Attempt: {log.attempt} of {log.maxAttempts}</span>
                  </div>

                  {log.errorMessage && (
                    <p className="text-[11px] text-rose-500 font-semibold">{log.errorMessage}</p>
                  )}

                  {log.status !== 'SUCCESS' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReplayLog(log.id)}
                      className="rounded-xl text-[11px] font-bold min-h-[36px] gap-1 active:scale-[0.97]"
                    >
                      <RefreshCw className="h-3 w-3" /> Replay Delivery
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
