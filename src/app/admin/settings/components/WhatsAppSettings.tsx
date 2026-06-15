'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  MessageCircle,
  Loader2,
  Save,
  Eye,
  EyeOff,
  PlugZap,
  Unplug,
  ShieldCheck,
} from 'lucide-react';
import {
  getWhatsAppConnection,
  saveWhatsAppConnection,
  testWhatsAppConnection,
  disconnectWhatsApp,
} from '@/lib/whatsapp-actions';
import type {
  WhatsAppConnectionPublic,
  WhatsAppConnectionStatus,
  WhatsAppQualityRating,
} from '@/lib/whatsapp/whatsapp-types';

interface WhatsAppSettingsProps {
  organizationId: string;
}

// ── Derived display maps (computed during render, not in effects) ────────────
const STATUS_STYLE: Record<WhatsAppConnectionStatus, { label: string; cls: string }> = {
  connected: { label: 'Connected', cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  pending: { label: 'Pending test', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  error: { label: 'Error', cls: 'bg-red-500/10 text-red-600 border-red-500/20' },
  disconnected: { label: 'Disconnected', cls: 'bg-muted text-muted-foreground border-border' },
};

const QUALITY_STYLE: Record<WhatsAppQualityRating, string> = {
  GREEN: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  YELLOW: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  RED: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function WhatsAppSettings({ organizationId }: WhatsAppSettingsProps) {
  const { user } = useUser();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [conn, setConn] = React.useState<WhatsAppConnectionPublic | null>(null);
  const [showSecrets, setShowSecrets] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  // Form state
  const [wabaId, setWabaId] = React.useState('');
  const [phoneNumberId, setPhoneNumberId] = React.useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  const [accessToken, setAccessToken] = React.useState('');
  const [appSecret, setAppSecret] = React.useState('');

  const getToken = React.useCallback(async () => {
    if (!user) throw new Error('Not signed in.');
    return user.getIdToken();
  }, [user]);

  const hydrate = React.useCallback((c: WhatsAppConnectionPublic | null) => {
    setConn(c);
    setWabaId(c?.wabaId ?? '');
    setPhoneNumberId(c?.phoneNumberId ?? '');
    setDisplayPhoneNumber(c?.displayPhoneNumber ?? '');
    setBusinessName(c?.businessName ?? '');
    setAccessToken('');
    setAppSecret('');
  }, []);

  // Initial load (genuine async I/O on mount — server-only collection).
  React.useEffect(() => {
    let active = true;
    if (!user) return;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await getWhatsAppConnection(idToken, organizationId);
        if (active && res.success) hydrate(res.data);
      } catch {
        /* surfaced on action use */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, organizationId, hydrate]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const idToken = await getToken();
      const res = await saveWhatsAppConnection(idToken, {
        organizationId,
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        displayPhoneNumber: displayPhoneNumber.trim(),
        businessName: businessName.trim() || undefined,
        accessToken: accessToken.trim(),
        appSecret: appSecret.trim() || undefined,
      });
      if (res.success) {
        hydrate(res.data);
        toast({ title: 'WhatsApp saved', description: 'Credentials stored (encrypted). Run a connection test.' });
      } else {
        toast({ variant: 'destructive', title: 'Save failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const idToken = await getToken();
      const res = await testWhatsAppConnection(idToken, organizationId);
      if (res.success) {
        setConn(res.data);
        const ok = res.data?.status === 'connected';
        toast({
          variant: ok ? 'default' : 'destructive',
          title: ok ? 'Connection healthy' : 'Connection error',
          description: ok ? `Quality: ${res.data?.qualityRating ?? '—'} · Tier: ${res.data?.messagingLimit ?? '—'}` : res.data?.lastError,
        });
      } else {
        toast({ variant: 'destructive', title: 'Test failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Remove this WhatsApp connection? Stored credentials will be deleted.')) return;
    setIsDisconnecting(true);
    try {
      const idToken = await getToken();
      const res = await disconnectWhatsApp(idToken, organizationId);
      if (res.success) {
        hydrate(null);
        toast({ title: 'Disconnected', description: 'WhatsApp connection removed.' });
      } else {
        toast({ variant: 'destructive', title: 'Disconnect failed', description: res.error });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const status = conn?.status ?? 'disconnected';
  const statusStyle = STATUS_STYLE[status];
  const canSave =
    wabaId.trim() && phoneNumberId.trim() && displayPhoneNumber.trim() && accessToken.trim().length >= 10;

  return (
    <Card className="rounded-[2rem] border border-border shadow-sm bg-transparent overflow-hidden">
      <CardHeader className="p-8 border-b">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              WhatsApp Business (Meta Cloud API)
            </CardTitle>
            <CardDescription className="text-xs font-semibold text-muted-foreground mt-0.5">
              Connect your organization's WhatsApp Business Account to send on the WhatsApp channel
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] font-bold ${statusStyle.cls}`}>
              {statusStyle.label}
            </Badge>
            {conn?.qualityRating && (
              <Badge variant="outline" className={`text-[10px] font-bold ${QUALITY_STYLE[conn.qualityRating]}`}>
                {conn.qualityRating}
              </Badge>
            )}
            {conn?.messagingLimit && (
              <Badge variant="outline" className="text-[10px] font-bold bg-muted text-muted-foreground border-border">
                {conn.messagingLimit}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-8 space-y-6">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading connection…
          </div>
        ) : (
          <>
            {conn?.lastError && status === 'error' && (
              <p className="text-xs font-semibold text-red-600 bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                {conn.lastError}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="WhatsApp Business Account ID (WABA)">
                <Input value={wabaId} onChange={(e) => setWabaId(e.target.value)} placeholder="1234567890"
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" />
              </Field>
              <Field label="Phone Number ID">
                <Input value={phoneNumberId} onChange={(e) => setPhoneNumberId(e.target.value)} placeholder="1098765432"
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" />
              </Field>
              <Field label="Display Phone Number">
                <Input value={displayPhoneNumber} onChange={(e) => setDisplayPhoneNumber(e.target.value)} placeholder="+233 20 000 0000"
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" />
              </Field>
              <Field label="Business Name (optional)">
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Inc."
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" />
              </Field>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-semibold text-muted-foreground ml-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Secrets are encrypted at rest and never shown again
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets((s) => !s)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground">
                {showSecrets ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showSecrets ? 'Hide' : 'Show'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="System User Access Token">
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={conn?.hasToken ? `••••${conn.tokenLast4 ?? ''} — paste to replace` : 'EAAG…'}
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" />
              </Field>
              <Field label="App Secret (optional — webhook validation)">
                <Input value={appSecret} onChange={(e) => setAppSecret(e.target.value)}
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={conn?.hasAppSecret ? '•••• — paste to replace' : 'app secret'}
                  className="h-11 rounded-xl bg-muted/20 border-none shadow-inner font-medium px-4" />
              </Field>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-2">
              {conn && (
                <Button type="button" variant="ghost" onClick={handleDisconnect} disabled={isDisconnecting}
                  className="rounded-xl font-bold h-11 px-5 text-red-600 hover:text-red-700 hover:bg-red-500/5">
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unplug className="h-4 w-4 mr-2" />}
                  Disconnect
                </Button>
              )}
              {conn && (
                <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting}
                  className="rounded-xl font-bold h-11 px-5">
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlugZap className="h-4 w-4 mr-2" />}
                  Test connection
                </Button>
              )}
              <Button onClick={handleSave} disabled={isSaving || !canSave}
                className="rounded-xl font-bold h-11 px-8 shadow-lg shadow-emerald-500/10 bg-emerald-600 hover:bg-emerald-700">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save credentials
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[10px] font-semibold text-muted-foreground ml-1">{label}</Label>
      {children}
    </div>
  );
}
