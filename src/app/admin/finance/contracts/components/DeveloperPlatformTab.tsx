'use client';

/**
 * Developer Platform & Embedded SDK Console Tab (Phase 8 Backoffice UI)
 *
 * Provides a unified console in Agreements Hub for:
 * 1. Scoped API Key provisioning, rotation, and revocation.
 * 2. Whitelisted Embed Origins for CSP frame-ancestors iframe defense.
 * 3. Interactive Iframe Sandbox with real-time postMessage event stream logger.
 * 4. Webhook Simulator with HMAC-SHA256 signature preview.
 * 5. Offline PWA sync queue health and conflict quarantine monitor.
 *
 * Ergonomics & Mobile Defense:
 * - Touch targets enforce `min-h-[44px]` and `active:scale-[0.97]`.
 * - Form inputs enforce `text-base sm:text-sm` (16px minimum) to lock iOS Safari zoom.
 * - Strict typing with zero `any` or `any[]`.
 *
 * @maintainer Antigravity Pair Programming
 */

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Key,
  Plus,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Globe,
  Radio,
  Send,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  Code2,
  Layers,
  Terminal,
  Activity,
} from 'lucide-react';
import type { ApiKeyRecord, ApiKeyScope, ApiKeyRateLimitTier } from '@/lib/types/document-signing';
import {
  createApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
  rotateApiKeyAction,
  updateAllowedEmbedOriginsAction,
  getAllowedEmbedOriginsAction,
  testWebhookDeliveryAction,
  getOfflineSyncQueueStatusAction,
} from '@/app/actions/developer-platform-actions';
import { useToast } from '@/hooks/use-toast';

interface DeveloperPlatformTabProps {
  workspaceId: string;
}

const AVAILABLE_SCOPES: { scope: ApiKeyScope; label: string; desc: string }[] = [
  { scope: 'envelopes:create', label: 'Create Envelopes', desc: 'Dispatch new signing envelopes' },
  { scope: 'envelopes:read', label: 'Read Envelopes', desc: 'Inspect envelope details and status' },
  { scope: 'envelopes:void', label: 'Void Envelopes', desc: 'Cancel in-progress envelopes' },
  { scope: 'templates:read', label: 'Read Templates', desc: 'List published templates and schemas' },
  { scope: 'webhooks:manage', label: 'Manage Webhooks', desc: 'Configure webhook event subscriptions' },
];

export default function DeveloperPlatformTab({ workspaceId }: DeveloperPlatformTabProps) {
  const { toast } = useToast();

  // Sub-navigation state
  const [subSection, setSubSection] = React.useState<
    'keys' | 'embed' | 'sandbox' | 'webhooks' | 'offline'
  >('keys');

  // API Keys state
  const [apiKeys, setApiKeys] = React.useState<ApiKeyRecord[]>([]);
  const [isLoadingKeys, setIsLoadingKeys] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [newKeyName, setNewKeyName] = React.useState('');
  const [selectedScopes, setSelectedScopes] = React.useState<ApiKeyScope[]>([
    'envelopes:create',
    'envelopes:read',
  ]);
  const [selectedTier, setSelectedTier] = React.useState<ApiKeyRateLimitTier>('standard');
  const [isCreatingKey, setIsCreatingKey] = React.useState(false);

  // One-time secret copy modal
  const [secretModalOpen, setSecretModalOpen] = React.useState(false);
  const [generatedSecret, setGeneratedSecret] = React.useState('');
  const [hasCopiedSecret, setHasCopiedSecret] = React.useState(false);

  // Embed Origins state
  const [allowedOrigins, setAllowedOrigins] = React.useState<string[]>([]);
  const [newOriginInput, setNewOriginInput] = React.useState('');
  const [isSavingOrigins, setIsSavingOrigins] = React.useState(false);

  // Webhook Simulator state
  const [webhookUrl, setWebhookUrl] = React.useState('https://webhook.site/demo-sample-endpoint');
  const [webhookEvent, setWebhookEvent] = React.useState('envelope.signed');
  const [isTestingWebhook, setIsTestingWebhook] = React.useState(false);
  const [webhookResult, setWebhookResult] = React.useState<{
    statusCode?: number;
    latencyMs?: number;
    signatureHeader?: string;
  } | null>(null);

  // Offline queue health state
  const [offlineMetrics, setOfflineMetrics] = React.useState<{
    syncedCount: number;
    conflictCount: number;
    pendingCount: number;
  }>({ syncedCount: 0, conflictCount: 0, pendingCount: 0 });

  // Sandbox state
  const [sandboxLogs, setSandboxLogs] = React.useState<
    { id: string; time: string; type: string; payload: string }[]
  >([]);
  const [simulatedIframeHeight, setSimulatedIframeHeight] = React.useState(580);

  // Initial Data Fetch
  React.useEffect(() => {
    if (!workspaceId) return;

    const loadData = async () => {
      setIsLoadingKeys(true);
      try {
        const [keysRes, originsRes, offlineRes] = await Promise.all([
          listApiKeysAction(workspaceId),
          getAllowedEmbedOriginsAction(workspaceId),
          getOfflineSyncQueueStatusAction(workspaceId),
        ]);

        if (keysRes.success && keysRes.keys) {
          setApiKeys(keysRes.keys);
        }
        if (originsRes.success && originsRes.origins) {
          setAllowedOrigins(originsRes.origins);
        }
        if (offlineRes.success) {
          setOfflineMetrics({
            syncedCount: offlineRes.syncedCount || 0,
            conflictCount: offlineRes.conflictCount || 0,
            pendingCount: offlineRes.pendingCount || 0,
          });
        }
      } catch (err) {
        console.error('Failed to load developer platform data:', err);
      } finally {
        setIsLoadingKeys(false);
      }
    };

    loadData();
  }, [workspaceId]);

  // PostMessage Event Listener for Sandbox
  React.useEffect(() => {
    const handleSandboxMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const type = (event.data as Record<string, unknown>).type;
      if (typeof type !== 'string') return;

      if (type === 'resize_request') {
        const height = (event.data as Record<string, unknown>).height;
        if (typeof height === 'number') {
          setSimulatedIframeHeight(height);
        }
      }

      setSandboxLogs((prev) => [
        {
          id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          time: new Date().toLocaleTimeString(),
          type,
          payload: JSON.stringify(event.data, null, 2),
        },
        ...prev.slice(0, 19),
      ]);
    };

    window.addEventListener('message', handleSandboxMessage);
    return () => window.removeEventListener('message', handleSandboxMessage);
  }, []);

  // Handlers: API Keys
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) {
      toast({ variant: 'destructive', title: 'Key Name Required', description: 'Please name this API key.' });
      return;
    }

    try {
      setIsCreatingKey(true);
      const res = await createApiKeyAction(workspaceId, {
        name: newKeyName.trim(),
        scopes: selectedScopes,
        rateLimitTier: selectedTier,
      });

      if (!res.success || !res.rawKey || !res.keyRecord) {
        toast({ variant: 'destructive', title: 'Generation Failed', description: res.error || 'Unable to generate API key.' });
        return;
      }

      setGeneratedSecret(res.rawKey);
      setHasCopiedSecret(false);
      setCreateDialogOpen(false);
      setSecretModalOpen(true);
      setApiKeys((prev) => [res.keyRecord!, ...prev]);
      setNewKeyName('');
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (keyId: string) => {
    const res = await revokeApiKeyAction(workspaceId, keyId);
    if (res.success) {
      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked' as const } : k))
      );
      toast({ title: 'API Key Revoked', description: 'This key will immediately be rejected by REST endpoints.' });
    } else {
      toast({ variant: 'destructive', title: 'Revocation Failed', description: res.error });
    }
  };

  const handleRotateKey = async (keyId: string) => {
    const res = await rotateApiKeyAction(workspaceId, keyId);
    if (res.success && res.rawKey && res.keyRecord) {
      setGeneratedSecret(res.rawKey);
      setHasCopiedSecret(false);
      setSecretModalOpen(true);
      setApiKeys((prev) =>
        prev.map((k) => (k.id === keyId ? { ...k, status: 'revoked' as const } : k)).concat(res.keyRecord!)
      );
      toast({ title: 'Key Rotated', description: 'Previous key was revoked and a new secret has been issued.' });
    } else {
      toast({ variant: 'destructive', title: 'Rotation Failed', description: res.error });
    }
  };

  // Handlers: Embed Origins
  const handleAddOrigin = () => {
    const trimmed = newOriginInput.trim();
    if (!trimmed) return;

    try {
      const url = new URL(trimmed);
      const clean = `${url.protocol}//${url.host}`;
      if (allowedOrigins.includes(clean)) {
        toast({ title: 'Origin Exists', description: 'This origin domain is already in the whitelist.' });
        return;
      }
      setAllowedOrigins((prev) => [...prev, clean]);
      setNewOriginInput('');
    } catch {
      toast({ variant: 'destructive', title: 'Invalid URL', description: 'Please enter a valid URL origin (e.g. https://partner.example.com).' });
    }
  };

  const handleRemoveOrigin = (originToRemove: string) => {
    setAllowedOrigins((prev) => prev.filter((o) => o !== originToRemove));
  };

  const handleSaveOrigins = async () => {
    try {
      setIsSavingOrigins(true);
      const res = await updateAllowedEmbedOriginsAction(workspaceId, allowedOrigins);
      if (res.success) {
        toast({ title: 'Origins Updated', description: 'CSP frame-ancestors headers will reflect these domains immediately.' });
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: res.error });
      }
    } finally {
      setIsSavingOrigins(false);
    }
  };

  // Handlers: Webhooks
  const handleTestWebhook = async () => {
    try {
      setIsTestingWebhook(true);
      setWebhookResult(null);
      const res = await testWebhookDeliveryAction(workspaceId, webhookUrl, webhookEvent);
      if (res.success) {
        setWebhookResult({
          statusCode: res.statusCode,
          latencyMs: res.latencyMs,
          signatureHeader: res.signatureHeader,
        });
        toast({ title: 'Webhook Dispatched', description: `HTTP ${res.statusCode} recorded in ${res.latencyMs}ms.` });
      } else {
        toast({ variant: 'destructive', title: 'Simulation Failed', description: res.error });
      }
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Console Sub-Navigation Bar */}
      <div className="flex flex-wrap items-center gap-2 border-b pb-4">
        <Button
          type="button"
          variant={subSection === 'keys' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubSection('keys')}
          className="rounded-xl min-h-[44px] sm:min-h-0 text-xs font-semibold active:scale-[0.97] transition-all"
        >
          <Key className="w-3.5 h-3.5 mr-1.5" />
          API Keys ({apiKeys.length})
        </Button>
        <Button
          type="button"
          variant={subSection === 'embed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubSection('embed')}
          className="rounded-xl min-h-[44px] sm:min-h-0 text-xs font-semibold active:scale-[0.97] transition-all"
        >
          <Globe className="w-3.5 h-3.5 mr-1.5" />
          Embed Origins ({allowedOrigins.length})
        </Button>
        <Button
          type="button"
          variant={subSection === 'sandbox' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubSection('sandbox')}
          className="rounded-xl min-h-[44px] sm:min-h-0 text-xs font-semibold active:scale-[0.97] transition-all"
        >
          <Layers className="w-3.5 h-3.5 mr-1.5" />
          Iframe Sandbox & Logs
        </Button>
        <Button
          type="button"
          variant={subSection === 'webhooks' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubSection('webhooks')}
          className="rounded-xl min-h-[44px] sm:min-h-0 text-xs font-semibold active:scale-[0.97] transition-all"
        >
          <Radio className="w-3.5 h-3.5 mr-1.5" />
          Webhook Simulator
        </Button>
        <Button
          type="button"
          variant={subSection === 'offline' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSubSection('offline')}
          className="rounded-xl min-h-[44px] sm:min-h-0 text-xs font-semibold active:scale-[0.97] transition-all"
        >
          <WifiOff className="w-3.5 h-3.5 mr-1.5" />
          Offline Sync Queue
        </Button>
      </div>

      {/* SECTION 1: API KEYS MANAGER */}
      {subSection === 'keys' && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-4">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                REST API Keys & Authentication
              </CardTitle>
              <CardDescription className="text-xs">
                Generate scoped bearer tokens for automated envelope dispatch, status polling, and voiding.
              </CardDescription>
            </div>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Generate API Key
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingKeys ? (
              <div className="py-8 text-center text-xs text-muted-foreground">Loading workspace API keys...</div>
            ) : apiKeys.length === 0 ? (
              <div className="py-12 text-center space-y-2 border border-dashed rounded-xl p-6">
                <Code2 className="w-8 h-8 text-muted-foreground mx-auto" />
                <p className="text-xs text-muted-foreground">No active API keys found for this workspace.</p>
              </div>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden bg-background">
                {apiKeys.map((key) => (
                  <div key={key.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{key.name}</span>
                        <Badge
                          variant={key.status === 'active' ? 'default' : 'secondary'}
                          className={`text-[10px] uppercase font-bold ${
                            key.status === 'active'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {key.status}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          Tier: {key.rateLimitTier}
                        </Badge>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        Prefix: <span className="text-foreground font-semibold">{key.prefix}••••••••••••</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {key.scopes.map((s) => (
                          <span
                            key={s}
                            className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-mono text-secondary-foreground"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end md:self-center">
                      {key.status === 'active' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRotateKey(key.id)}
                            className="rounded-xl min-h-[44px] sm:min-h-0 text-xs active:scale-[0.97]"
                          >
                            <RefreshCw className="w-3.5 h-3.5 mr-1" />
                            Rotate
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRevokeKey(key.id)}
                            className="rounded-xl min-h-[44px] sm:min-h-0 text-xs text-destructive hover:bg-destructive/10 active:scale-[0.97]"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" />
                            Revoke
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 2: EMBED ORIGINS WHITELIST */}
      {subSection === 'embed' && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              Allowed Embedded Iframe Origins
            </CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              To prevent clickjacking and framing attacks, only whitelisted domains are permitted to embed your signing portals.
              These populate the authoritative <code className="bg-muted px-1.5 py-0.5 rounded font-mono">frame-ancestors</code> Content Security Policy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="https://partner.example.com"
                value={newOriginInput}
                onChange={(e) => setNewOriginInput(e.target.value)}
                className="text-base sm:text-sm min-h-[44px] rounded-xl"
              />
              <Button
                type="button"
                onClick={handleAddOrigin}
                className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform text-xs font-semibold shrink-0"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Domain
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Whitelisted Domains ({allowedOrigins.length})</Label>
              {allowedOrigins.length === 0 ? (
                <div className="p-4 border border-dashed rounded-xl text-center text-xs text-muted-foreground">
                  No external domains whitelisted. Only same-origin embedding is permitted.
                </div>
              ) : (
                <div className="divide-y border rounded-xl overflow-hidden bg-background">
                  {allowedOrigins.map((origin) => (
                    <div key={origin} className="p-3 flex items-center justify-between">
                      <span className="font-mono text-xs">{origin}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOrigin(origin)}
                        className="text-destructive hover:bg-destructive/10 text-xs h-8 px-2"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                onClick={handleSaveOrigins}
                disabled={isSavingOrigins}
                className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform text-xs font-semibold px-6"
              >
                {isSavingOrigins ? 'Saving...' : 'Save Whitelist Settings'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* SECTION 3: IFRAME SANDBOX & LOGS */}
      {subSection === 'sandbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-4">
            <Card className="rounded-2xl border shadow-sm overflow-hidden">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-sm font-bold flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    Embedded Iframe Viewport
                  </span>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    Height: {simulatedIframeHeight}px
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <iframe
                  title="Signing Embed Sandbox"
                  src={`/embed/sign/sandbox_demo_token?envelopeId=demo_envelope`}
                  style={{ height: `${simulatedIframeHeight}px` }}
                  className="w-full border-0 transition-all duration-300"
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <Card className="rounded-2xl border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-primary" />
                    PostMessage Event Stream
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Live bi-directional telemetry exchanged with parent window.
                  </CardDescription>
                </div>
                {sandboxLogs.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSandboxLogs([])}
                    className="text-xs text-muted-foreground h-8 px-2"
                  >
                    Clear
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                {sandboxLogs.length === 0 ? (
                  <div className="py-12 text-center text-xs text-muted-foreground border border-dashed rounded-xl p-4">
                    Awaiting postMessage handshake from embedded iframe...
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto font-mono text-xs pr-1">
                    {sandboxLogs.map((log) => (
                      <div key={log.id} className="p-2.5 rounded-lg border bg-muted/30 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="font-semibold text-primary">{log.type}</span>
                          <span>{log.time}</span>
                        </div>
                        <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap text-foreground/90 bg-background/50 p-2 rounded">
                          {log.payload}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* SECTION 4: WEBHOOK SIMULATOR */}
      {subSection === 'webhooks' && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Radio className="w-4 h-4 text-primary" />
              Webhook Delivery Simulator
            </CardTitle>
            <CardDescription className="text-xs">
              Test automated event dispatches to your webhook consumer with standard HMAC-SHA256 signature headers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label className="text-xs font-medium">Consumer Webhook URL</Label>
                <Input
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="text-base sm:text-sm min-h-[44px] rounded-xl font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">Event Type</Label>
                <select
                  value={webhookEvent}
                  onChange={(e) => setWebhookEvent(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl border bg-background text-base sm:text-sm"
                >
                  <option value="envelope.signed">envelope.signed</option>
                  <option value="envelope.completed">envelope.completed</option>
                  <option value="envelope.voided">envelope.voided</option>
                  <option value="envelope.declined">envelope.declined</option>
                </select>
              </div>
            </div>

            <Button
              onClick={handleTestWebhook}
              disabled={isTestingWebhook}
              className="rounded-xl min-h-[44px] active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {isTestingWebhook ? 'Simulating Dispatch...' : 'Dispatch Test Webhook'}
            </Button>

            {webhookResult && (
              <div className="p-4 rounded-xl border bg-muted/40 space-y-2 font-mono text-xs">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-200">
                    HTTP {webhookResult.statusCode} OK
                  </Badge>
                  <span className="text-muted-foreground">Latency: {webhookResult.latencyMs}ms</span>
                </div>
                <div className="text-[11px] text-muted-foreground break-all">
                  <strong>SmartSapp-Signature:</strong> {webhookResult.signatureHeader}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* SECTION 5: OFFLINE PWA SYNC QUEUE HEALTH */}
      {subSection === 'offline' && (
        <Card className="rounded-2xl border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
              <WifiOff className="w-4 h-4 text-primary" />
              Offline PWA Sync Queue Health
            </CardTitle>
            <CardDescription className="text-xs">
              Monitor biometric stroke captures submitted from disconnected tablets and field devices.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-200 dark:border-emerald-950 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Synced Signatures</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-2xl font-bold">{offlineMetrics.syncedCount}</div>
                <p className="text-[11px] text-muted-foreground">Idempotently applied with entropy verification</p>
              </div>

              <div className="p-4 rounded-xl border bg-blue-500/5 border-blue-200 dark:border-blue-950 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Pending In Transit</span>
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-2xl font-bold">{offlineMetrics.pendingCount}</div>
                <p className="text-[11px] text-muted-foreground">Queued in IndexedDB awaiting connectivity</p>
              </div>

              <div className="p-4 rounded-xl border bg-amber-500/5 border-amber-200 dark:border-amber-950 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Conflict Quarantine</span>
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                </div>
                <div className="text-2xl font-bold">{offlineMetrics.conflictCount}</div>
                <p className="text-[11px] text-muted-foreground">Voided/expired or duplicate captures quarantined</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create API Key Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Generate Scoped API Key</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure access permissions and rate limiting for this key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Application or Integration Name</Label>
              <Input
                placeholder="e.g. Production Salesforce Connector"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                className="text-base sm:text-sm min-h-[44px] rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Rate Limit Tier</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={selectedTier === 'standard' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier('standard')}
                  className="rounded-xl min-h-[44px] text-xs font-medium"
                >
                  Standard (60 req/min)
                </Button>
                <Button
                  type="button"
                  variant={selectedTier === 'enterprise' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedTier('enterprise')}
                  className="rounded-xl min-h-[44px] text-xs font-medium"
                >
                  Enterprise (300 req/min)
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium">Granted Scopes</Label>
              <div className="space-y-2 border rounded-xl p-3 bg-muted/20">
                {AVAILABLE_SCOPES.map(({ scope, label, desc }) => {
                  const isChecked = selectedScopes.includes(scope);
                  return (
                    <label key={scope} className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedScopes((prev) =>
                            isChecked ? prev.filter((s) => s !== scope) : [...prev, scope]
                          );
                        }}
                        className="mt-0.5 rounded border-slate-300"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">{label}</span>
                        <p className="text-[11px] text-muted-foreground">{desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
              className="min-h-[44px] rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateKey}
              disabled={isCreatingKey}
              className="min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              {isCreatingKey ? 'Generating...' : 'Issue API Key'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1-Time Secret Display Modal */}
      <Dialog open={secretModalOpen} onOpenChange={setSecretModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
              API Key Generated Successfully
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Please copy this secret key now. For security, you will not be able to view it again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="p-3 bg-slate-900 text-emerald-400 font-mono text-xs rounded-xl break-all select-all flex items-center justify-between gap-2 border">
              <span>{generatedSecret}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedSecret);
                  setHasCopiedSecret(true);
                }}
                className="shrink-0 text-emerald-400 hover:text-emerald-300 hover:bg-slate-800"
              >
                {hasCopiedSecret ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Keep this key secret. Store it in environment variables or an encrypted secrets vault.</span>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => setSecretModalOpen(false)}
              className="w-full min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-xs font-semibold"
            >
              I Have Saved My Secret Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
