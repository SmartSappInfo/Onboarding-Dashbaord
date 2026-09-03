'use client';

/**
 * @fileOverview Enterprise Identity & Federation Client (Phase 10)
 *
 * Operational hub for configuring SAML/OIDC Single Sign-On, MFA & Passkeys,
 * SCIM 2.0 directory synchronization, and session policies.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring animations.
 * - Conforms to `.agents/AGENTS.md` and zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import {
  KeyRound,
  Fingerprint,
  RefreshCw,
  Clock,
  Building2,
  Users,
  Terminal,
  Shield,
} from 'lucide-react';
import Link from 'next/link';
import type {
  EnterpriseIdpConfig,
  EnterpriseIdpType,
  EnterpriseIdpStatus,
  MfaPolicyConfig,
  MfaFactorType,
  DirectorySyncConfig,
  DirectorySyncLog,
  DirectorySyncProvider,
  EnterpriseSessionConfig,
} from '@/lib/types';
import {
  getEnterpriseIdpConfigAction,
  saveEnterpriseIdpConfigAction,
  getMfaPolicyAction,
  saveMfaPolicyAction,
  getDirectorySyncConfigAction,
  saveDirectorySyncConfigAction,
  listDirectorySyncLogsAction,
  getEnterpriseSessionConfigAction,
  saveEnterpriseSessionConfigAction,
} from '@/app/actions/enterprise-identity-actions';

import { IdpConfigurationTab } from './components/IdpConfigurationTab';
import { MfaPolicyTab } from './components/MfaPolicyTab';
import { DirectorySyncTab } from './components/DirectorySyncTab';
import { SessionPolicyTab } from './components/SessionPolicyTab';

export function EnterpriseIdentityClient() {
  const { toast } = useToast();
  const { user: authUser } = useUser();
  const { activeOrganizationId } = useTenant();

  const [activeTab, setActiveTab] = React.useState('idp');
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [idpConfig, setIdpConfig] = React.useState<EnterpriseIdpConfig | null>(null);
  const [mfaPolicy, setMfaPolicy] = React.useState<MfaPolicyConfig>({
    organizationId: activeOrganizationId || '',
    enforceMfa: false,
    allowedFactors: ['totp', 'passkey'],
    enforceForRoles: [],
    gracePeriodDays: 7,
    requirePasskeysForAdmin: false,
    updatedAt: new Date().toISOString(),
  });
  const [syncConfig, setSyncConfig] = React.useState<DirectorySyncConfig>({
    organizationId: activeOrganizationId || '',
    provider: 'okta',
    scimBaseUrl: '',
    bearerTokenMasked: '',
    syncEnabled: false,
    autoDeactivateOnDelete: true,
    defaultRoleId: 'member',
    totalUsersSynced: 0,
    totalGroupsSynced: 0,
  });
  const [syncLogs, setSyncLogs] = React.useState<DirectorySyncLog[]>([]);
  const [sessionConfig, setSessionConfig] = React.useState<EnterpriseSessionConfig>({
    organizationId: activeOrganizationId || '',
    idleTimeoutMinutes: 30,
    maxSessionDurationHours: 12,
    concurrentSessionLimit: 3,
    forceReauthOnSensitiveActions: true,
    updatedAt: new Date().toISOString(),
  });

  const loadAll = React.useCallback(async () => {
    if (!authUser || !activeOrganizationId) return;
    setIsLoading(true);
    try {
      const idToken = await authUser.getIdToken();
      const [idpRes, mfaRes, syncRes, logsRes, sessRes] = await Promise.all([
        getEnterpriseIdpConfigAction({ idToken, organizationId: activeOrganizationId }),
        getMfaPolicyAction({ idToken, organizationId: activeOrganizationId }),
        getDirectorySyncConfigAction({ idToken, organizationId: activeOrganizationId }),
        listDirectorySyncLogsAction({ idToken, organizationId: activeOrganizationId }),
        getEnterpriseSessionConfigAction({ idToken, organizationId: activeOrganizationId }),
      ]);

      if (idpRes.success) setIdpConfig(idpRes.config);
      if (mfaRes.success) setMfaPolicy(mfaRes.policy);
      if (syncRes.success) setSyncConfig(syncRes.config);
      if (logsRes.success) setSyncLogs(logsRes.logs);
      if (sessRes.success) setSessionConfig(sessRes.config);
    } catch (err: unknown) {
      console.warn('[EnterpriseIdentityClient] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [authUser, activeOrganizationId]);

  React.useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSaveIdp = async (payload: {
    providerType: EnterpriseIdpType;
    displayName: string;
    issuer: string;
    ssoUrl: string;
    certificate?: string;
    clientId?: string;
    clientSecret?: string;
    domains: string[];
    enforceSso: boolean;
    allowBreakGlass: boolean;
    status: EnterpriseIdpStatus;
  }) => {
    if (!authUser || !activeOrganizationId) return;
    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await saveEnterpriseIdpConfigAction({
        idToken,
        organizationId: activeOrganizationId,
        ...payload,
      });

      if (res.success && res.config) {
        setIdpConfig(res.config);
        toast({ title: 'IdP Settings Saved', description: 'Enterprise SSO configuration updated.' });
      } else {
        throw new Error(res.error || 'Failed to save IdP settings');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving IdP';
      toast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveMfa = async (payload: {
    enforceMfa: boolean;
    allowedFactors: MfaFactorType[];
    enforceForRoles: string[];
    gracePeriodDays: number;
    requirePasskeysForAdmin: boolean;
  }) => {
    if (!authUser || !activeOrganizationId) return;
    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await saveMfaPolicyAction({
        idToken,
        organizationId: activeOrganizationId,
        ...payload,
      });

      if (res.success && res.policy) {
        setMfaPolicy(res.policy);
        toast({ title: 'MFA Policy Updated', description: 'Multi-factor policy enforced.' });
      } else {
        throw new Error(res.error || 'Failed to save MFA policy');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving MFA';
      toast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSync = async (payload: {
    provider: DirectorySyncProvider;
    syncEnabled: boolean;
    autoDeactivateOnDelete: boolean;
    defaultRoleId: string;
    regenerateToken?: boolean;
  }) => {
    if (!authUser || !activeOrganizationId) return;
    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await saveDirectorySyncConfigAction({
        idToken,
        organizationId: activeOrganizationId,
        ...payload,
      });

      if (res.success && res.config) {
        setSyncConfig(res.config);
        toast({ title: 'SCIM Settings Saved', description: 'Directory sync configuration updated.' });
      } else {
        throw new Error(res.error || 'Failed to save SCIM settings');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving SCIM';
      toast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSession = async (payload: {
    idleTimeoutMinutes: number;
    maxSessionDurationHours: number;
    concurrentSessionLimit: number;
    forceReauthOnSensitiveActions: boolean;
  }) => {
    if (!authUser || !activeOrganizationId) return;
    setIsSaving(true);
    try {
      const idToken = await authUser.getIdToken();
      const res = await saveEnterpriseSessionConfigAction({
        idToken,
        organizationId: activeOrganizationId,
        ...payload,
      });

      if (res.success && res.config) {
        setSessionConfig(res.config);
        toast({ title: 'Session Policy Saved', description: 'Session lifetime rules updated.' });
      } else {
        throw new Error(res.error || 'Failed to save session policy');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error saving session policy';
      toast({ title: 'Save Failed', description: msg, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-32 w-full p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Enterprise Identity & Federation
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Single Sign-On (SAML/OIDC), WebAuthn Passkeys, SCIM 2.0 Directory Sync, and Session Policies
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/workforce/command-center">
              <Terminal className="h-3.5 w-3.5 mr-1.5 text-primary" /> AI Command Center
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]">
            <Link href="/admin/users">
              <Users className="h-3.5 w-3.5 mr-1.5 text-primary" /> Users Hub
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={loadAll}
            disabled={isLoading}
            className="rounded-lg h-9 px-3.5 text-xs font-semibold active:scale-[0.97]"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Tabs Layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/40 p-1 border flex-wrap h-auto gap-1">
          <TabsTrigger value="idp" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
            <KeyRound className="w-3.5 h-3.5 text-primary" /> Identity Providers (SSO)
          </TabsTrigger>
          <TabsTrigger value="mfa" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
            <Fingerprint className="w-3.5 h-3.5 text-primary" /> MFA & Passkeys
          </TabsTrigger>
          <TabsTrigger value="scim" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
            <RefreshCw className="w-3.5 h-3.5 text-primary" /> Directory Sync (SCIM 2.0)
          </TabsTrigger>
          <TabsTrigger value="session" className="text-xs gap-1.5 font-semibold active:scale-[0.97]">
            <Clock className="w-3.5 h-3.5 text-primary" /> Session Policy
          </TabsTrigger>
        </TabsList>

        <TabsContent value="idp">
          <IdpConfigurationTab
            config={idpConfig}
            onSave={handleSaveIdp}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="mfa">
          <MfaPolicyTab
            policy={mfaPolicy}
            onSave={handleSaveMfa}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="scim">
          <DirectorySyncTab
            config={syncConfig}
            logs={syncLogs}
            onSave={handleSaveSync}
            isSaving={isSaving}
          />
        </TabsContent>

        <TabsContent value="session">
          <SessionPolicyTab
            config={sessionConfig}
            onSave={handleSaveSession}
            isSaving={isSaving}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EnterpriseIdentityClient;
