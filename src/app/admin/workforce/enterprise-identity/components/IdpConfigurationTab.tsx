'use client';

/**
 * @fileOverview Enterprise Identity Provider Configuration Tab (Phase 10)
 *
 * Configures SAML 2.0 and OIDC Identity Providers, manages verified domains,
 * and configures the emergency break-glass administrator bypass channel.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing and accessible keyboard bindings.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  KeyRound,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import type { EnterpriseIdpConfig, EnterpriseIdpType, EnterpriseIdpStatus } from '@/lib/types';

interface IdpConfigurationTabProps {
  config: EnterpriseIdpConfig | null;
  onSave: (payload: {
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
  }) => Promise<void>;
  isSaving: boolean;
}

export function IdpConfigurationTab({ config, onSave, isSaving }: IdpConfigurationTabProps) {
  const [providerType, setProviderType] = React.useState<EnterpriseIdpType>(config?.providerType || 'saml');
  const [displayName, setDisplayName] = React.useState(config?.displayName || '');
  const [issuer, setIssuer] = React.useState(config?.issuer || '');
  const [ssoUrl, setSsoUrl] = React.useState(config?.ssoUrl || '');
  const [certificate, setCertificate] = React.useState(config?.certificate || '');
  const [clientId, setClientId] = React.useState(config?.clientId || '');
  const [clientSecret, setClientSecret] = React.useState('');
  const [domainInput, setDomainInput] = React.useState(config?.domains.join(', ') || '');
  const [enforceSso, setEnforceSso] = React.useState(config?.enforceSso || false);
  const [allowBreakGlass, setAllowBreakGlass] = React.useState(config?.allowBreakGlass ?? true);
  const [status, setStatus] = React.useState<EnterpriseIdpStatus>(config?.status || 'testing');

  React.useEffect(() => {
    if (config) {
      setProviderType(config.providerType);
      setDisplayName(config.displayName);
      setIssuer(config.issuer);
      setSsoUrl(config.ssoUrl);
      setCertificate(config.certificate || '');
      setClientId(config.clientId || '');
      setDomainInput(config.domains.join(', '));
      setEnforceSso(config.enforceSso);
      setAllowBreakGlass(config.allowBreakGlass);
      setStatus(config.status);
    }
  }, [config]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const domains = domainInput
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    await onSave({
      providerType,
      displayName: displayName.trim() || `${providerType.toUpperCase()} Provider`,
      issuer: issuer.trim(),
      ssoUrl: ssoUrl.trim(),
      certificate: certificate.trim() || undefined,
      clientId: clientId.trim() || undefined,
      clientSecret: clientSecret.trim() || undefined,
      domains,
      enforceSso,
      allowBreakGlass,
      status,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-sm font-bold">Single Sign-On (SSO) Provider</CardTitle>
                <CardDescription className="text-xs">
                  Federate authentication via enterprise SAML 2.0 or OpenID Connect (OIDC)
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={status === 'active' ? 'default' : 'outline'}
                className="text-[10px] font-bold uppercase tracking-wider"
              >
                Status: {status}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-4 text-xs">
          {/* Protocol Switcher */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Federation Protocol</Label>
            <div className="grid grid-cols-2 gap-2 max-w-sm">
              <Button
                type="button"
                variant={providerType === 'saml' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProviderType('saml')}
                className="text-xs h-9 font-semibold active:scale-[0.97]"
              >
                SAML 2.0
              </Button>
              <Button
                type="button"
                variant={providerType === 'oidc' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setProviderType('oidc')}
                className="text-xs h-9 font-semibold active:scale-[0.97]"
              >
                OpenID Connect (OIDC)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Okta Corporate SSO"
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {providerType === 'saml' ? 'Entity ID / Issuer URI' : 'Issuer URL'}
              </Label>
              <Input
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder={providerType === 'saml' ? 'http://www.okta.com/exk1234...' : 'https://auth.company.com'}
                className="h-9 text-xs font-mono"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {providerType === 'saml' ? 'Single Sign-On (SSO) URL' : 'Authorization Endpoint'}
            </Label>
            <Input
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
              placeholder="https://company.okta.com/app/smartsapp/sso/saml"
              className="h-9 text-xs font-mono"
              required
            />
          </div>

          {providerType === 'saml' ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">X.509 Public Certificate (PEM format)</Label>
              <textarea
                value={certificate}
                onChange={(e) => setCertificate(e.target.value)}
                placeholder="-----BEGIN CERTIFICATE-----&#10;MIIDpDCCAoygAwIBAgIG...&#10;-----END CERTIFICATE-----"
                rows={4}
                className="w-full p-2.5 rounded-md border text-xs font-mono bg-muted/20 focus:outline-hidden focus:ring-1"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client ID</Label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="0oa123456789..."
                  className="h-9 text-xs font-mono"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Client Secret</Label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={config?.clientSecretMasked || 'Enter secret...'}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>
          )}

          {/* Domain-based Auto-Routing */}
          <div className="space-y-1.5 pt-2 border-t">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" /> Verified SSO Domains
            </Label>
            <Input
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="e.g. acme.com, corp.acme.com"
              className="h-9 text-xs font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Comma-separated domains for automatic SSO redirection during employee email sign-in.
            </p>
          </div>

          {/* Toggles */}
          <div className="pt-2 border-t space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Enforce SSO Authentication</Label>
                <p className="text-[11px] text-muted-foreground">
                  Require all verified domain users to authenticate exclusively through SSO.
                </p>
              </div>
              <Switch checked={enforceSso} onCheckedChange={setEnforceSso} />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-semibold">Allow Break-Glass Admin Bypass</Label>
                <p className="text-[11px] text-muted-foreground">
                  Permits emergency administrator login with password + MFA in case of IdP outage.
                </p>
              </div>
              <Switch checked={allowBreakGlass} onCheckedChange={setAllowBreakGlass} />
            </div>
          </div>
        </CardContent>

        <CardFooter className="p-4 border-t bg-muted/10 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> AES-256 encrypted credential storage
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Configuration...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save IdP Settings
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default IdpConfigurationTab;
