'use client';

/**
 * @fileoverview In-App OAuth Credentials Studio Modal.
 * Enables workspace administrators to configure custom OAuth Client IDs and Secrets
 * for Google Calendar, Microsoft Teams/Outlook, and Zoom Meetings.
 *
 * Conforms to:
 * - next-best-practices & vercel-react-best-practices
 * - emilkowal-animations (tactile active:scale-[0.97] and smooth transitions)
 * - frontend-design & mobile accessibility (min-h-[44px] touch targets)
 * - Zero 'any' policy strictly enforced.
 */

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar as CalendarIcon,
  Video,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ShieldCheck,
  Loader2,
  Lock,
} from 'lucide-react';
import {
  saveWorkspaceOAuthCredentialsAction,
  saveOrganizationOAuthCredentialsAction,
  getWorkspaceOAuthCredentialsStatusAction,
  getOrganizationOAuthCredentialsStatusAction,
  type WorkspaceOAuthStatus,
  type OrganizationOAuthStatus,
} from '@/app/actions/calendar-connection-actions';

export type OAuthProvider = 'google_calendar' | 'microsoft_teams' | 'zoom';
export type OAuthCredentialsModalScope = 'workspace' | 'organization';
export type OAuthCombinedStatus = WorkspaceOAuthStatus | OrganizationOAuthStatus;

export interface OAuthCredentialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId?: string;
  organizationId?: string;
  scope?: OAuthCredentialsModalScope;
  defaultProvider?: OAuthProvider;
  onCredentialsSaved?: () => void;
}

export function OAuthCredentialsModal({
  open,
  onOpenChange,
  workspaceId,
  organizationId,
  scope = 'workspace',
  defaultProvider = 'google_calendar',
  onCredentialsSaved,
}: OAuthCredentialsModalProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = React.useState<OAuthProvider>(defaultProvider);
  const [isLoadingStatus, setIsLoadingStatus] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [showSecret, setShowSecret] = React.useState<Record<string, boolean>>({});

  // Credentials State
  const [googleClientId, setGoogleClientId] = React.useState('');
  const [googleClientSecret, setGoogleClientSecret] = React.useState('');

  const [msClientId, setMsClientId] = React.useState('');
  const [msClientSecret, setMsClientSecret] = React.useState('');
  const [msTenantId, setMsTenantId] = React.useState('');

  const [zoomClientId, setZoomClientId] = React.useState('');
  const [zoomClientSecret, setZoomClientSecret] = React.useState('');

  const [oauthStatus, setOauthStatus] = React.useState<OAuthCombinedStatus | null>(null);

  // Sync tab with defaultProvider when modal opens
  React.useEffect(() => {
    if (open) {
      setActiveTab(defaultProvider);
    }
  }, [open, defaultProvider]);

  // Load current configuration status
  const loadStatus = React.useCallback(async () => {
    if (scope === 'organization') {
      if (!organizationId) return;
      setIsLoadingStatus(true);
      try {
        const res = await getOrganizationOAuthCredentialsStatusAction(organizationId);
        if (res.success && res.data) {
          setOauthStatus(res.data);
          if (res.data.google.clientId && !res.data.google.clientId.includes('***')) {
            setGoogleClientId(res.data.google.clientId);
          }
          if (res.data.microsoft.clientId && !res.data.microsoft.clientId.includes('***')) {
            setMsClientId(res.data.microsoft.clientId);
          }
          if (res.data.microsoft.tenantId) {
            setMsTenantId(res.data.microsoft.tenantId);
          }
          if (res.data.zoom.clientId && !res.data.zoom.clientId.includes('***')) {
            setZoomClientId(res.data.zoom.clientId);
          }
        }
      } catch {
        // Non-blocking status fetch
      } finally {
        setIsLoadingStatus(false);
      }
    } else {
      if (!workspaceId) return;
      setIsLoadingStatus(true);
      try {
        const res = await getWorkspaceOAuthCredentialsStatusAction(workspaceId);
        if (res.success && res.data) {
          setOauthStatus(res.data);
          // Only pre-populate input if it was explicitly configured at the workspace level
          if (res.data.google.source === 'workspace' && res.data.google.clientId && !res.data.google.clientId.includes('***')) {
            setGoogleClientId(res.data.google.clientId);
          }
          if (res.data.microsoft.source === 'workspace' && res.data.microsoft.clientId && !res.data.microsoft.clientId.includes('***')) {
            setMsClientId(res.data.microsoft.clientId);
          }
          if (res.data.microsoft.source === 'workspace' && res.data.microsoft.tenantId) {
            setMsTenantId(res.data.microsoft.tenantId);
          }
          if (res.data.zoom.source === 'workspace' && res.data.zoom.clientId && !res.data.zoom.clientId.includes('***')) {
            setZoomClientId(res.data.zoom.clientId);
          }
        }
      } catch {
        // Non-blocking status fetch
      } finally {
        setIsLoadingStatus(false);
      }
    }
  }, [scope, organizationId, workspaceId]);

  React.useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open, loadStatus]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast({
        title: 'Redirect URI Copied',
        description: 'Paste this into your authorized redirect URIs in the developer console.',
      });
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Please copy the URI manually.',
      });
    }
  };

  const toggleShowSecret = (key: string) => {
    setShowSecret(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getRuntimeRedirectUri = (provider: OAuthProvider): string => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (provider === 'google_calendar') return `${origin}/api/integrations/google/callback`;
      if (provider === 'microsoft_teams') return `${origin}/api/integrations/microsoft/callback`;
      if (provider === 'zoom') return `${origin}/api/integrations/zoom/callback`;
    }
    return oauthStatus?.redirectUris[
      provider === 'google_calendar' ? 'google' : provider === 'microsoft_teams' ? 'microsoft' : 'zoom'
    ] || '';
  };

  const handleSave = async (provider: OAuthProvider) => {
    setIsSaving(true);

    try {
      let clientId = '';
      let clientSecret = '';
      let tenantId: string | undefined;

      if (provider === 'google_calendar') {
        clientId = googleClientId.trim();
        clientSecret = googleClientSecret.trim();
        if (!clientId) {
          toast({ variant: 'destructive', title: 'Client ID Required', description: 'Please enter your Google OAuth Client ID.' });
          setIsSaving(false);
          return;
        }
      } else if (provider === 'microsoft_teams') {
        clientId = msClientId.trim();
        clientSecret = msClientSecret.trim();
        tenantId = msTenantId.trim() || undefined;
        if (!clientId) {
          toast({ variant: 'destructive', title: 'Client ID Required', description: 'Please enter your Microsoft Application (Client) ID.' });
          setIsSaving(false);
          return;
        }
      } else if (provider === 'zoom') {
        clientId = zoomClientId.trim();
        clientSecret = zoomClientSecret.trim();
        if (!clientId) {
          toast({ variant: 'destructive', title: 'Client ID Required', description: 'Please enter your Zoom Client ID.' });
          setIsSaving(false);
          return;
        }
      }

      let res: { success: boolean; error?: string };

      if (scope === 'organization') {
        if (!organizationId) {
          toast({ variant: 'destructive', title: 'Organization ID Required', description: 'Missing organization identifier.' });
          setIsSaving(false);
          return;
        }
        res = await saveOrganizationOAuthCredentialsAction(organizationId, {
          provider,
          clientId,
          clientSecret: clientSecret || undefined,
          tenantId,
        });
      } else {
        if (!workspaceId) {
          toast({ variant: 'destructive', title: 'Workspace ID Required', description: 'Missing workspace identifier.' });
          setIsSaving(false);
          return;
        }
        res = await saveWorkspaceOAuthCredentialsAction(workspaceId, {
          provider,
          clientId,
          clientSecret: clientSecret || undefined,
          tenantId,
        });
      }

      if (res.success) {
        toast({
          title: scope === 'organization' ? 'Organization Defaults Saved' : 'Workspace Credentials Saved',
          description: scope === 'organization'
            ? 'Global organization OAuth credentials encrypted and stored. Workspaces can now inherit and connect.'
            : 'Workspace API credentials encrypted and stored.',
        });
        await loadStatus();
        onCredentialsSaved?.();
        // Clear secret from memory for security
        if (provider === 'google_calendar') setGoogleClientSecret('');
        if (provider === 'microsoft_teams') setMsClientSecret('');
        if (provider === 'zoom') setZoomClientSecret('');
      } else {
        toast({
          variant: 'destructive',
          title: 'Save Failed',
          description: res.error || 'Failed to save OAuth credentials.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      toast({
        variant: 'destructive',
        title: 'Error Saving Credentials',
        description: msg,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-6 sm:p-8">
        <DialogHeader className="space-y-1.5 border-b border-border pb-4 text-left">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight">
                {scope === 'organization' ? 'Global Organization API Credentials' : 'Workspace API Credentials'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {scope === 'organization'
                  ? 'Configure organization default OAuth 2.0 developer credentials. Workspaces without overrides automatically inherit these.'
                  : 'Configure custom OAuth 2.0 developer credentials for this workspace. These will override organization defaults.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoadingStatus ? (
          <div className="flex items-center justify-center py-12 gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-xs font-semibold text-muted-foreground">Loading credentials status...</span>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={val => setActiveTab(val as OAuthProvider)}
            className="w-full space-y-6 pt-2"
          >
            <TabsList className="grid grid-cols-3 w-full h-11 p-1 bg-muted/60 rounded-2xl">
              <TabsTrigger
                value="google_calendar"
                className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <CalendarIcon className="w-3.5 h-3.5 text-red-500" />
                <span>Google</span>
              </TabsTrigger>
              <TabsTrigger
                value="microsoft_teams"
                className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Video className="w-3.5 h-3.5 text-blue-500" />
                <span>Microsoft</span>
              </TabsTrigger>
              <TabsTrigger
                value="zoom"
                className="rounded-xl text-xs font-bold gap-1.5 min-h-[36px] data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                <Video className="w-3.5 h-3.5 text-indigo-500" />
                <span>Zoom</span>
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: GOOGLE CALENDAR */}
            <TabsContent value="google_calendar" className="space-y-6 outline-none">
              {/* Contextual Status Banner */}
              {scope === 'workspace' && oauthStatus?.google.source === 'organization' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                  <span>Currently using <strong>Organization Default</strong>. Entering keys below will override them for this workspace only.</span>
                </div>
              )}
              {scope === 'workspace' && oauthStatus?.google.source === 'workspace' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>A custom <strong>Workspace Override</strong> is active.</span>
                </div>
              )}
              {scope === 'organization' && oauthStatus?.google.source === 'organization' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>Global default configured. Workspaces inherit this automatically.</span>
                </div>
              )}

              {/* Step 1: Copy Redirect URI */}
              <div className="p-4 rounded-2xl border border-border bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. Authorized Redirect URI
                  </span>
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In Google Cloud Console, navigate to <strong>APIs & Services → Credentials → Create Credentials → OAuth Client ID (Web application)</strong>, and add this exact URL:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-background border border-border px-3 py-2 rounded-xl flex-1 truncate select-all">
                    {getRuntimeRedirectUri('google_calendar')}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(getRuntimeRedirectUri('google_calendar'), 'google')}
                    className="min-h-[40px] px-3 rounded-xl gap-1.5 active:scale-[0.97]"
                  >
                    {copiedKey === 'google' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-xs font-semibold">{copiedKey === 'google' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Required scopes: <code className="text-[10px] font-mono">calendar.events</code>, <code className="text-[10px] font-mono">calendar.readonly</code></span>
                </div>
              </div>

              {/* Step 2: Form Inputs */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="google-client-id" className="text-xs font-bold">
                    Google OAuth Client ID
                  </Label>
                  <Input
                    id="google-client-id"
                    placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com"
                    value={googleClientId}
                    onChange={e => setGoogleClientId(e.target.value)}
                    className="rounded-xl min-h-[44px] font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="google-client-secret" className="text-xs font-bold">
                      Google OAuth Client Secret
                    </Label>
                    {oauthStatus?.google.hasSecret && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Secret configured (leave blank to keep existing)
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="google-client-secret"
                      type={showSecret['google'] ? 'text' : 'password'}
                      placeholder={oauthStatus?.google.hasSecret ? '••••••••••••••••••••••••' : 'Enter client secret'}
                      value={googleClientSecret}
                      onChange={e => setGoogleClientSecret(e.target.value)}
                      className="rounded-xl min-h-[44px] font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('google')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret['google'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Footer CTA */}
              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Secrets are encrypted using AES-256-GCM.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="rounded-xl min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave('google_calendar')}
                    disabled={isSaving}
                    className="rounded-xl min-h-[44px] px-6 font-semibold shadow-sm active:scale-[0.97]"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {scope === 'organization' ? 'Save Google Org Default' : 'Save Google Keys'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 2: MICROSOFT TEAMS / OUTLOOK */}
            <TabsContent value="microsoft_teams" className="space-y-6 outline-none">
              {/* Contextual Status Banner */}
              {scope === 'workspace' && oauthStatus?.microsoft.source === 'organization' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                  <span>Currently using <strong>Organization Default</strong>. Entering keys below will override them for this workspace only.</span>
                </div>
              )}
              {scope === 'workspace' && oauthStatus?.microsoft.source === 'workspace' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>A custom <strong>Workspace Override</strong> is active.</span>
                </div>
              )}
              {scope === 'organization' && oauthStatus?.microsoft.source === 'organization' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>Global default configured. Workspaces inherit this automatically.</span>
                </div>
              )}

              <div className="p-4 rounded-2xl border border-border bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. Authorized Redirect URI
                  </span>
                  <a
                    href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Azure Portal (App Registrations) <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In Microsoft Entra ID (Azure), create an <strong>App registration</strong> (Accounts in any organizational directory & personal Microsoft accounts), add a <strong>Web platform</strong>, and paste this Redirect URI:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-background border border-border px-3 py-2 rounded-xl flex-1 truncate select-all">
                    {getRuntimeRedirectUri('microsoft_teams')}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(getRuntimeRedirectUri('microsoft_teams'), 'microsoft')}
                    className="min-h-[40px] px-3 rounded-xl gap-1.5 active:scale-[0.97]"
                  >
                    {copiedKey === 'microsoft' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-xs font-semibold">{copiedKey === 'microsoft' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Required Graph scopes: <code className="text-[10px] font-mono">Calendars.ReadWrite</code>, <code className="text-[10px] font-mono">OnlineMeetings.ReadWrite</code>, <code className="text-[10px] font-mono">offline_access</code></span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ms-client-id" className="text-xs font-bold">
                    Application (Client) ID
                  </Label>
                  <Input
                    id="ms-client-id"
                    placeholder="e.g. 00000000-0000-0000-0000-000000000000"
                    value={msClientId}
                    onChange={e => setMsClientId(e.target.value)}
                    className="rounded-xl min-h-[44px] font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="ms-client-secret" className="text-xs font-bold">
                      Client Secret Value
                    </Label>
                    {oauthStatus?.microsoft.hasSecret && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Secret configured (leave blank to keep existing)
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="ms-client-secret"
                      type={showSecret['ms'] ? 'text' : 'password'}
                      placeholder={oauthStatus?.microsoft.hasSecret ? '••••••••••••••••••••••••' : 'Enter client secret value'}
                      value={msClientSecret}
                      onChange={e => setMsClientSecret(e.target.value)}
                      className="rounded-xl min-h-[44px] font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('ms')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret['ms'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ms-tenant-id" className="text-xs font-bold">
                    Directory (Tenant) ID <span className="text-muted-foreground font-normal">(Optional — leave blank for multi-tenant & personal accounts)</span>
                  </Label>
                  <Input
                    id="ms-tenant-id"
                    placeholder="common (default) or specific tenant GUID"
                    value={msTenantId}
                    onChange={e => setMsTenantId(e.target.value)}
                    className="rounded-xl min-h-[44px] font-mono text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Secrets are encrypted using AES-256-GCM.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="rounded-xl min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave('microsoft_teams')}
                    disabled={isSaving}
                    className="rounded-xl min-h-[44px] px-6 font-semibold shadow-sm active:scale-[0.97]"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {scope === 'organization' ? 'Save Microsoft Org Default' : 'Save Microsoft Keys'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* TAB 3: ZOOM MEETING */}
            <TabsContent value="zoom" className="space-y-6 outline-none">
              {/* Contextual Status Banner */}
              {scope === 'workspace' && oauthStatus?.zoom.source === 'organization' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-blue-500" />
                  <span>Currently using <strong>Organization Default</strong>. Entering keys below will override them for this workspace only.</span>
                </div>
              )}
              {scope === 'workspace' && oauthStatus?.zoom.source === 'workspace' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>A custom <strong>Workspace Override</strong> is active.</span>
                </div>
              )}
              {scope === 'organization' && oauthStatus?.zoom.source === 'organization' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span>Global default configured. Workspaces inherit this automatically.</span>
                </div>
              )}

              <div className="p-4 rounded-2xl border border-border bg-muted/30 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. OAuth Redirect URL
                  </span>
                  <a
                    href="https://marketplace.zoom.us/develop/create"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] font-semibold text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Zoom App Marketplace <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  In Zoom App Marketplace, create a <strong>General App</strong> (User-managed or Account-level OAuth), add the OAuth Redirect URL and OAuth Allow Lists:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono bg-background border border-border px-3 py-2 rounded-xl flex-1 truncate select-all">
                    {getRuntimeRedirectUri('zoom')}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(getRuntimeRedirectUri('zoom'), 'zoom')}
                    className="min-h-[40px] px-3 rounded-xl gap-1.5 active:scale-[0.97]"
                  >
                    {copiedKey === 'zoom' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    <span className="text-xs font-semibold">{copiedKey === 'zoom' ? 'Copied' : 'Copy'}</span>
                  </Button>
                </div>
                <div className="text-[11px] text-muted-foreground/80 flex items-center gap-1.5 pt-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Required scopes: <code className="text-[10px] font-mono">meeting:write</code>, <code className="text-[10px] font-mono">meeting:read</code>, <code className="text-[10px] font-mono">user:read</code></span>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="zoom-client-id" className="text-xs font-bold">
                    Zoom Client ID
                  </Label>
                  <Input
                    id="zoom-client-id"
                    placeholder="Enter Zoom Client ID"
                    value={zoomClientId}
                    onChange={e => setZoomClientId(e.target.value)}
                    className="rounded-xl min-h-[44px] font-mono text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="zoom-client-secret" className="text-xs font-bold">
                      Zoom Client Secret
                    </Label>
                    {oauthStatus?.zoom.hasSecret && (
                      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <Lock className="w-2.5 h-2.5" /> Secret configured (leave blank to keep existing)
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <Input
                      id="zoom-client-secret"
                      type={showSecret['zoom'] ? 'text' : 'password'}
                      placeholder={oauthStatus?.zoom.hasSecret ? '••••••••••••••••••••••••' : 'Enter Zoom client secret'}
                      value={zoomClientSecret}
                      onChange={e => setZoomClientSecret(e.target.value)}
                      className="rounded-xl min-h-[44px] font-mono text-xs pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => toggleShowSecret('zoom')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showSecret['zoom'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Secrets are encrypted using AES-256-GCM.</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="rounded-xl min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => handleSave('zoom')}
                    disabled={isSaving}
                    className="rounded-xl min-h-[44px] px-6 font-semibold shadow-sm active:scale-[0.97]"
                  >
                    {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {scope === 'organization' ? 'Save Zoom Org Default' : 'Save Zoom Keys'}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
