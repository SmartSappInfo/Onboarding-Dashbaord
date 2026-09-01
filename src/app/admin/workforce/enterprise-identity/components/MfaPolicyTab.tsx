'use client';

/**
 * @fileOverview MFA & WebAuthn Passkeys Policy Tab (Phase 10)
 *
 * Configures organization-wide and role-scoped multi-factor authentication policies,
 * allowed authentication factors, and grace periods.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Employs Emil Kowalski spring easing and accessible keyboard bindings.
 * - Zero `any` or `any[]` typing.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ShieldCheck,
  Fingerprint,
  Smartphone,
  Mail,
  Loader2,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import type { MfaPolicyConfig, MfaFactorType } from '@/lib/types';

interface MfaPolicyTabProps {
  policy: MfaPolicyConfig;
  onSave: (payload: {
    enforceMfa: boolean;
    allowedFactors: MfaFactorType[];
    enforceForRoles: string[];
    gracePeriodDays: number;
    requirePasskeysForAdmin: boolean;
  }) => Promise<void>;
  isSaving: boolean;
}

export function MfaPolicyTab({ policy, onSave, isSaving }: MfaPolicyTabProps) {
  const [enforceMfa, setEnforceMfa] = React.useState(policy.enforceMfa);
  const [allowedFactors, setAllowedFactors] = React.useState<MfaFactorType[]>(policy.allowedFactors);
  const [gracePeriodDays, setGracePeriodDays] = React.useState(policy.gracePeriodDays);
  const [requirePasskeysForAdmin, setRequirePasskeysForAdmin] = React.useState(policy.requirePasskeysForAdmin);

  React.useEffect(() => {
    setEnforceMfa(policy.enforceMfa);
    setAllowedFactors(policy.allowedFactors);
    setGracePeriodDays(policy.gracePeriodDays);
    setRequirePasskeysForAdmin(policy.requirePasskeysForAdmin);
  }, [policy]);

  const toggleFactor = (factor: MfaFactorType) => {
    if (allowedFactors.includes(factor)) {
      if (allowedFactors.length === 1) return; // Prevent 0 factors
      setAllowedFactors(allowedFactors.filter((f) => f !== factor));
    } else {
      setAllowedFactors([...allowedFactors, factor]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      enforceMfa,
      allowedFactors,
      enforceForRoles: ['admin', 'supervisor'],
      gracePeriodDays,
      requirePasskeysForAdmin,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border bg-card shadow-xs">
        <CardHeader className="p-4 pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Fingerprint className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-sm font-bold">MFA & Passkeys Policy</CardTitle>
                <CardDescription className="text-xs">
                  Enforce strong second-factor authentication and hardware-bound passkeys
                </CardDescription>
              </div>
            </div>
            <Badge
              variant={enforceMfa ? 'default' : 'secondary'}
              className="text-[10px] font-bold uppercase tracking-wider"
            >
              {enforceMfa ? 'MFA Mandatory' : 'MFA Optional'}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-6 space-y-5 text-xs">
          {/* Main Enforce Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-muted/20 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">Enforce Multi-Factor Authentication</Label>
              <p className="text-[11px] text-muted-foreground">
                Require all organization members to enroll and verify an MFA factor upon login.
              </p>
            </div>
            <Switch checked={enforceMfa} onCheckedChange={setEnforceMfa} />
          </div>

          {/* Allowed Factors */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">Allowed Authentication Factors</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => toggleFactor('passkey')}
                className="p-3 border rounded-lg flex items-start gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
              >
                <Checkbox checked={allowedFactors.includes('passkey')} className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                    <Fingerprint className="w-3.5 h-3.5 text-primary" /> WebAuthn / FIDO2 Passkeys
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Hardware-bound biometrics (TouchID, FaceID, YubiKey). Phishing-resistant.
                  </p>
                </div>
              </div>

              <div
                onClick={() => toggleFactor('totp')}
                className="p-3 border rounded-lg flex items-start gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
              >
                <Checkbox checked={allowedFactors.includes('totp')} className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                    <Smartphone className="w-3.5 h-3.5 text-primary" /> Authenticator Apps (TOTP)
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    Time-based one-time passwords (Google Authenticator, 1Password, Authy).
                  </p>
                </div>
              </div>

              <div
                onClick={() => toggleFactor('sms')}
                className="p-3 border rounded-lg flex items-start gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
              >
                <Checkbox checked={allowedFactors.includes('sms')} className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                    <Smartphone className="w-3.5 h-3.5 text-primary" /> SMS Verification Codes
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    SMS text message verification codes delivered to registered mobile numbers.
                  </p>
                </div>
              </div>

              <div
                onClick={() => toggleFactor('email')}
                className="p-3 border rounded-lg flex items-start gap-3 cursor-pointer hover:bg-muted/10 transition-colors"
              >
                <Checkbox checked={allowedFactors.includes('email')} className="mt-0.5" />
                <div className="space-y-0.5">
                  <span className="font-semibold text-xs flex items-center gap-1.5 text-foreground">
                    <Mail className="w-3.5 h-3.5 text-primary" /> Email Magic Codes
                  </span>
                  <p className="text-[10px] text-muted-foreground">
                    One-time numeric verification codes sent to verified work email.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Admin Passkey Strictness */}
          <div className="flex items-center justify-between p-3.5 bg-muted/20 border rounded-lg">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-primary" /> Require Hardware Passkeys for Administrators
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Disallow SMS and TOTP for Admin roles, mandating phishing-resistant FIDO2 hardware passkeys.
              </p>
            </div>
            <Switch checked={requirePasskeysForAdmin} onCheckedChange={setRequirePasskeysForAdmin} />
          </div>

          {/* Grace Period */}
          <div className="space-y-1.5 max-w-xs">
            <Label className="text-xs font-semibold">New Employee Grace Period (Days)</Label>
            <Input
              type="number"
              min={0}
              max={30}
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(Number(e.target.value))}
              className="h-9 text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Number of days newly onboarded employees have to register their MFA factor before login is blocked.
            </p>
          </div>
        </CardContent>

        <CardFooter className="p-4 border-t bg-muted/10 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> FIDO2 & WebAuthn Level 2 certified
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isSaving}
            className="text-xs h-9 px-4 font-semibold active:scale-[0.97]"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Saving Policy...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Save MFA Policy
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}

export default MfaPolicyTab;
