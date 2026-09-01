'use client';

/**
 * @fileOverview SCIM 2.0 Directory Synchronization Tab (Phase 10)
 *
 * Configures automated inbound directory provisioning, manages SCIM bearer tokens,
 * and displays real-time sync audit logs.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  RefreshCw,
  Copy,
  CheckCircle2,
  XCircle,
  Loader2,
  Key,
  Users,
} from 'lucide-react';
import type { DirectorySyncConfig, DirectorySyncLog, DirectorySyncProvider } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface DirectorySyncTabProps {
  config: DirectorySyncConfig;
  logs: DirectorySyncLog[];
  onSave: (payload: {
    provider: DirectorySyncProvider;
    syncEnabled: boolean;
    autoDeactivateOnDelete: boolean;
    defaultRoleId: string;
    regenerateToken?: boolean;
  }) => Promise<void>;
  isSaving: boolean;
}

export function DirectorySyncTab({ config, logs, onSave, isSaving }: DirectorySyncTabProps) {
  const { toast } = useToast();
  const [provider, setProvider] = React.useState<DirectorySyncProvider>(config.provider);
  const [syncEnabled, setSyncEnabled] = React.useState(config.syncEnabled);
  const [autoDeactivateOnDelete, setAutoDeactivateOnDelete] = React.useState(config.autoDeactivateOnDelete);
  const [defaultRoleId, setDefaultRoleId] = React.useState(config.defaultRoleId || 'member');

  React.useEffect(() => {
    setProvider(config.provider);
    setSyncEnabled(config.syncEnabled);
    setAutoDeactivateOnDelete(config.autoDeactivateOnDelete);
    setDefaultRoleId(config.defaultRoleId || 'member');
  }, [config]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} Copied`, description: 'Copied to clipboard' });
  };

  const handleSave = async (regenerate = false) => {
    await onSave({
      provider,
      syncEnabled,
      autoDeactivateOnDelete,
      defaultRoleId,
      regenerateToken: regenerate,
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-sm font-bold">SCIM 2.0 Directory Synchronization</CardTitle>
                <CardDescription className="text-xs">
                  Automate user onboarding, role assignments, and safe de-provisioning from your Identity Provider
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={syncEnabled ? 'default' : 'secondary'}
              className="text-[10px] font-bold uppercase tracking-wider"
            >
              {syncEnabled ? 'SCIM Active' : 'SCIM Disabled'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
          {/* Provider Select */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Directory Provider</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['okta', 'azure_ad', 'google_workspace', 'generic_scim'] as DirectorySyncProvider[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={provider === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setProvider(p)}
                  className="text-xs h-9 font-semibold uppercase tracking-wider active:scale-[0.97]"
                >
                  {p.replace(/_/g, ' ')}
                </Button>
              ))}
            </div>
          </div>

          {/* SCIM URL & Token */}
          <div className="space-y-3 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">SCIM 2.0 Base URL</Label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={config.scimBaseUrl || 'https://api.smartsapp.com/scim/v2/org-id'}
                  className="flex-1 h-9 px-3 text-xs font-mono rounded-md border bg-muted/20"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(config.scimBaseUrl, 'SCIM URL')}
                  className="h-9 px-3 text-xs active:scale-[0.97]"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copy
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">SCIM Bearer Token</Label>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={config.bearerTokenMasked || 'scim_sec_••••••••••••none'}
                  className="flex-1 h-9 px-3 text-xs font-mono rounded-md border bg-muted/20"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="h-9 px-3 text-xs active:scale-[0.97]"
                >
                  <Key className="w-3.5 h-3.5 mr-1" /> Regenerate
                </Button>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Enable Directory Synchronization</Label>
                <p className="text-[11px] text-muted-foreground">
                  Accept incoming SCIM 2.0 provisioning requests from your IdP.
                </p>
              </div>
              <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Auto-Deactivate on SCIM Delete</Label>
                <p className="text-[11px] text-muted-foreground">
                  Automatically suspend members when removed from IdP (bridges to Phase 7 Offboarding Safety Gate).
                </p>
              </div>
              <Switch checked={autoDeactivateOnDelete} onCheckedChange={setAutoDeactivateOnDelete} />
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 border-t bg-muted/10 flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            Total Synced: <span className="font-bold text-foreground">{config.totalUsersSynced} users</span>
          </div>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Settings...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save SCIM Settings
              </>
            )}
          </Button>
        </CardFooter>
      </Card>

      {/* Sync Log Stream */}
      <Card className="border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold">Recent SCIM Synchronization Events</CardTitle>
          <CardDescription className="text-xs">
            Real-time audit log of inbound user provisioning and de-provisioning events
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Timestamp</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Event</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Target Member</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length > 0 ? (
                logs.map((l) => (
                  <TableRow key={l.id} className="text-xs">
                    <TableCell className="pl-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                      {new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[9px] uppercase font-bold">
                        {l.eventType.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{l.targetEmail}</TableCell>
                    <TableCell className="text-right pr-4">
                      {l.status === 'success' ? (
                        <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Synced
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[9px] font-bold">
                          <XCircle className="w-3 h-3" /> Failed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-xs text-muted-foreground">
                    No SCIM sync events recorded yet. Connect your IdP above to start syncing.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

export default DirectorySyncTab;
