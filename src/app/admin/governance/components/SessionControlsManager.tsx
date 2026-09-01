'use client';

/**
 * @fileOverview Session Management & Security Policies (Governance 2.0)
 *
 * Controls active user sessions, remote session revocation, and organization MFA policies.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Radix components with Emil Kowalski spring easing (`cubic-bezier(0.32, 0.72, 0, 1)`).
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  Shield,
  Laptop,
  Smartphone,
  Globe,
  Ban,
  Save,
  Loader2,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserSession, SecurityPolicyConfig, MFAEnforcementLevel } from '@/lib/types';
import {
  listSessionsAction,
  revokeSessionAction,
  getSecurityPolicyAction,
  updateSecurityPolicyAction,
} from '@/app/actions/governance-actions';

export function SessionControlsManager() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [policy, setPolicy] = React.useState<SecurityPolicyConfig | null>(null);
  const [sessions, setSessions] = React.useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = React.useState(false);

  // Policy Form State
  const [mfaLevel, setMfaLevel] = React.useState<MFAEnforcementLevel>('recommended');
  const [idleTimeout, setIdleTimeout] = React.useState(60);
  const [maxSessions, setMaxSessions] = React.useState(5);

  const loadData = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [polRes, sessRes] = await Promise.all([
        getSecurityPolicyAction({ idToken, organizationId: activeOrganizationId }),
        listSessionsAction({ idToken, organizationId: activeOrganizationId }),
      ]);

      if (polRes.success && polRes.policy) {
        setPolicy(polRes.policy);
        setMfaLevel(polRes.policy.mfaEnforcement);
        setIdleTimeout(polRes.policy.sessionIdleTimeoutMinutes);
        setMaxSessions(polRes.policy.maxConcurrentSessions);
      }
      if (sessRes.success) {
        setSessions(sessRes.sessions);
      }
    } catch (err: unknown) {
      console.warn('[SessionControlsManager] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  // Save Policy
  const handleSavePolicy = async () => {
    if (!authUser || !activeOrganizationId) return;

    setIsSavingPolicy(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await updateSecurityPolicyAction({
        idToken,
        organizationId: activeOrganizationId,
        patch: {
          mfaEnforcement: mfaLevel,
          sessionIdleTimeoutMinutes: idleTimeout,
          maxConcurrentSessions: maxSessions,
        },
      });

      if (res.success && res.policy) {
        setPolicy(res.policy);
        toast({ title: 'Security Policies Updated' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Save error';
      toast({ title: 'Update Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSavingPolicy(false);
    }
  };

  // Revoke Session
  const handleRevokeSession = async (sessionId: string, deviceName: string) => {
    if (!authUser || !activeOrganizationId) return;

    const ok = await confirm({
      title: `Revoke Session for '${deviceName}'?`,
      description: 'The user will be immediately logged out and forced to re-authenticate.',
      confirmText: 'Revoke Session',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      const idToken = await authUser.getIdToken();
      const res = await revokeSessionAction({
        idToken,
        organizationId: activeOrganizationId,
        sessionId,
      });

      if (res.success) {
        toast({ title: 'Session Revoked' });
        loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Revocation error';
      toast({ title: 'Revoke Failed', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Security Policies Card */}
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" />
            <div>
              <CardTitle className="text-sm font-bold text-foreground">Organization Security Policies</CardTitle>
              <CardDescription className="text-xs">
                Configure Multi-Factor Authentication (MFA) enforcement and session idle timeouts
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">MFA Enforcement Level</Label>
              <Select value={mfaLevel} onValueChange={(v) => setMfaLevel(v as MFAEnforcementLevel)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="disabled" className="text-xs">Disabled / Optional</SelectItem>
                  <SelectItem value="recommended" className="text-xs">Recommended (In-app prompt)</SelectItem>
                  <SelectItem value="enforced_admins" className="text-xs">Enforce for Administrators Only</SelectItem>
                  <SelectItem value="enforced_all" className="text-xs">Enforce for All Members</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Idle Timeout (Minutes)</Label>
              <Input
                type="number"
                value={idleTimeout}
                onChange={(e) => setIdleTimeout(Number(e.target.value))}
                className="h-9 text-xs"
                min={15}
                max={1440}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Max Concurrent Sessions</Label>
              <Input
                type="number"
                value={maxSessions}
                onChange={(e) => setMaxSessions(Number(e.target.value))}
                className="h-9 text-xs"
                min={1}
                max={20}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button
              type="button"
              size="sm"
              onClick={handleSavePolicy}
              disabled={isSavingPolicy}
              className="text-xs h-8.5 px-4 font-semibold active:scale-[0.97]"
            >
              {isSavingPolicy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5 mr-1.5" /> Save Security Policies
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions Table */}
      <Card className="border bg-card shadow-xs overflow-hidden">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold">Active Device Sessions</CardTitle>
          <CardDescription className="text-xs">
            Inspect active connections and remotely invalidate compromised sessions
          </CardDescription>
        </CardHeader>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow>
                <TableHead className="text-[10px] uppercase font-bold py-3 pl-4">Member</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Device & Browser</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">IP Address</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3">Last Active</TableHead>
                <TableHead className="text-[10px] uppercase font-bold py-3 text-right pr-4">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5} className="p-4">
                      <div className="h-8 bg-muted/40 animate-pulse rounded-md" />
                    </TableCell>
                  </TableRow>
                ))
              ) : sessions.length > 0 ? (
                sessions.map((sess) => (
                  <TableRow key={sess.id} className="hover:bg-muted/10">
                    <TableCell className="pl-4 py-3">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-xs text-foreground block">{sess.personName}</span>
                        <span className="text-[10px] text-muted-foreground block">{sess.personEmail}</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        {sess.device?.toLowerCase().includes('mobile') ? (
                          <Smartphone className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Laptop className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-xs text-foreground font-medium">
                          {sess.device || 'Desktop'} ({sess.browser || 'Browser'})
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs font-mono text-muted-foreground">{sess.ipAddress || '—'}</span>
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {new Date(sess.lastActiveAt).toLocaleString()}
                      </span>
                    </TableCell>

                    <TableCell className="text-right pr-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevokeSession(sess.id, sess.device || 'Device')}
                        className="text-xs h-7 px-2 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 active:scale-[0.97]"
                      >
                        <Ban className="w-3 h-3 mr-1" /> Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-xs text-muted-foreground">
                    No active device sessions found.
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

export default SessionControlsManager;
