'use client';

/**
 * {{Org_name}} Experience Platform — Portal Access & Security Policy Editor
 *
 * Configures public, authenticated, and password-protected boundaries,
 * domain restrictions, role gates, and suspension notices.
 */

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Lock, Globe, Key, Mail, AlertTriangle } from 'lucide-react';
import type { PortalAccessPolicy, PortalVisibility } from '@/lib/types/portal';

interface PortalAccessPolicyEditorProps {
  accessPolicy: PortalAccessPolicy;
  onChangeAccessPolicy: (policy: PortalAccessPolicy) => void;
}

const VISIBILITY_OPTIONS: {
  id: PortalVisibility;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  {
    id: 'public',
    title: 'Public Access',
    desc: 'Anyone with the URL can visit and explore without signing in.',
    icon: Globe,
  },
  {
    id: 'password_protected',
    title: 'Password Protected',
    desc: 'Visitors must enter a shared passcode before accessing content.',
    icon: Key,
  },
  {
    id: 'authenticated',
    title: 'Member Sign-In Required',
    desc: 'Only logged-in members or students can view the portal.',
    icon: Lock,
  },
  {
    id: 'invite_only',
    title: 'Invite Only',
    desc: 'Exclusive access granted via personalized invitation links.',
    icon: ShieldCheck,
  },
];

export function PortalAccessPolicyEditor({
  accessPolicy,
  onChangeAccessPolicy,
}: PortalAccessPolicyEditorProps) {
  const [plainPassword, setPlainPassword] = React.useState('');
  const [domainInput, setDomainInput] = React.useState('');

  const handleSelectVisibility = (visibility: PortalVisibility) => {
    onChangeAccessPolicy({
      ...accessPolicy,
      visibility,
      requireAuth: visibility === 'authenticated' || visibility === 'invite_only',
      passwordProtected: visibility === 'password_protected',
    });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPlainPassword(val);
    onChangeAccessPolicy({
      ...accessPolicy,
      passwordHash: val, // PortalService will securely hash on save
    });
  };

  const handleAddDomain = () => {
    if (!domainInput.trim()) return;
    const clean = domainInput.replace('@', '').trim().toLowerCase();
    const current = accessPolicy.allowedEmailDomains || [];
    if (!current.includes(clean)) {
      onChangeAccessPolicy({
        ...accessPolicy,
        allowedEmailDomains: [...current, clean],
      });
    }
    setDomainInput('');
  };

  const handleRemoveDomain = (domain: string) => {
    const current = accessPolicy.allowedEmailDomains || [];
    onChangeAccessPolicy({
      ...accessPolicy,
      allowedEmailDomains: current.filter(d => d !== domain),
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Visibility Modes ─────────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 text-primary font-bold text-sm">
            <ShieldCheck className="w-4 h-4" /> Visibility & Access Boundary
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {VISIBILITY_OPTIONS.map(opt => {
              const IconComp = opt.icon;
              const isSelected = accessPolicy.visibility === opt.id;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelectVisibility(opt.id)}
                  className={`flex items-start gap-3.5 p-4 rounded-2xl border-2 text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                      : 'border-border bg-card hover:border-primary/40'
                  }`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">{opt.title}</h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                      {opt.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Password Configuration (Conditional) ──────────────────────── */}
      {accessPolicy.visibility === 'password_protected' && (
        <Card className="rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 shadow-sm animate-in fade-in-50 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <Key className="w-4 h-4" /> Portal Access Passcode
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="max-w-md space-y-1.5">
              <Label className="text-xs font-bold">Set Access Passcode</Label>
              <Input
                type="text"
                placeholder={accessPolicy.passwordHash ? '•••••••• (Passcode is configured)' : 'e.g. Masterclass2026!'}
                value={plainPassword}
                onChange={handlePasswordChange}
                className="h-10 rounded-xl font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Passwords are cryptographically salted and hashed on the server prior to storage.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Email Domain Restrictions ─────────────────────────────────── */}
      {(accessPolicy.visibility === 'authenticated' || accessPolicy.visibility === 'invite_only') && (
        <Card className="rounded-2xl border-2 border-border shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <Mail className="w-4 h-4" /> Organization Email Whitelist (Optional)
            </div>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            <div className="flex items-center gap-2 max-w-md">
              <Input
                placeholder="e.g. school.edu"
                value={domainInput}
                onChange={e => setDomainInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddDomain())}
                className="h-10 rounded-xl text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleAddDomain}
                className="h-10 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 transition-all"
              >
                Add Domain
              </button>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {(accessPolicy.allowedEmailDomains || []).map(domain => (
                <Badge
                  key={domain}
                  variant="outline"
                  className="gap-1.5 px-3 py-1 text-xs font-mono rounded-xl bg-muted/60"
                >
                  @{domain}
                  <button
                    type="button"
                    onClick={() => handleRemoveDomain(domain)}
                    className="text-muted-foreground hover:text-rose-500 ml-1 font-bold"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Suspension Notice ─────────────────────────────────────────── */}
      <Card className="rounded-2xl border-2 border-border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 text-muted-foreground font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Maintenance & Offline Notice
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <Textarea
            placeholder="e.g. This learning portal is undergoing scheduled curriculum maintenance and will resume at 8:00 AM."
            value={accessPolicy.suspendedReason || ''}
            onChange={e =>
              onChangeAccessPolicy({
                ...accessPolicy,
                suspendedReason: e.target.value,
              })
            }
            className="rounded-xl text-xs min-h-[72px] resize-none"
          />
        </CardContent>
      </Card>
    </div>
  );
}
