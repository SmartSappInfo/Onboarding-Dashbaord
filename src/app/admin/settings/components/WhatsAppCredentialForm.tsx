'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { MessageCircle, Loader2, Save, Eye, EyeOff, PlugZap, Unplug, ShieldCheck } from 'lucide-react';
import WhatsAppEmbeddedSignup from './WhatsAppEmbeddedSignup';
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
import { parseDraft, serializeDraft, isDraftEmpty, type CredentialDraft } from '@/lib/whatsapp/whatsapp-draft';

// Derived display maps — computed during render, never in effects. Status/quality
// keep semantic state colours (with dark: variants) per the QR Studio convention.
const STATUS_STYLE: Record<WhatsAppConnectionStatus, { label: string; cls: string }> = {
  connected: { label: 'Connected', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  pending: { label: 'Pending test', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
  error: { label: 'Error', cls: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' },
  disconnected: { label: 'Disconnected', cls: 'bg-muted text-muted-foreground border-border' },
};
const QUALITY_STYLE: Record<WhatsAppQualityRating, string> = {
  GREEN: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  YELLOW: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  RED: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
};

const INPUT_CLS = 'h-10 rounded-xl border-border bg-background px-4 font-medium';

// localStorage key prefix for the unsaved-credential draft. Scoped per org so
// switching organizations never bleeds one tenant's draft into another. The
// draft itself is versioned + token-free — see whatsapp-draft.ts.
const DRAFT_PREFIX = 'whatsapp-cred-draft:';

/**
 * Left column of the WhatsApp setup page: the credential form + live status.
 * Resolves the active organization from tenant context. Styling conforms to the
 * QR Studio theme (ring cards, thin headers, blue/`primary` accents, light+dark).
 */
export default function WhatsAppCredentialForm() {
  const { user } = useUser();
  const { activeOrganizationId } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = React.useState(true);
  const [conn, setConn] = React.useState<WhatsAppConnectionPublic | null>(null);
  const [showSecrets, setShowSecrets] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [isDisconnecting, setIsDisconnecting] = React.useState(false);

  const [wabaId, setWabaId] = React.useState('');
  const [phoneNumberId, setPhoneNumberId] = React.useState('');
  const [displayPhoneNumber, setDisplayPhoneNumber] = React.useState('');
  const [businessName, setBusinessName] = React.useState('');
  const [accessToken, setAccessToken] = React.useState('');
  const [appSecret, setAppSecret] = React.useState('');

  // True once the admin has actually edited a field, so we never overwrite a
  // server-loaded form with an auto-written "draft" the user never touched.
  const dirtyRef = React.useRef(false);
  const draftKey = activeOrganizationId ? `${DRAFT_PREFIX}${activeOrganizationId}` : null;

  const getToken = React.useCallback(async () => {
    if (!user) throw new Error('Not signed in.');
    return user.getIdToken();
  }, [user]);

  const markDirty = React.useCallback(() => {
    dirtyRef.current = true;
  }, []);

  // Drop the saved draft once it's persisted server-side (or removed).
  const clearDraft = React.useCallback(() => {
    dirtyRef.current = false;
    if (!draftKey) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      /* storage unavailable (private mode / quota) — non-fatal */
    }
  }, [draftKey]);

  // Restore unsaved input on top of the server values after a reload. Treated
  // as dirty so it survives until an explicit save clears it. A version-mismatch
  // or corrupt payload yields null and is ignored.
  const restoreDraft = React.useCallback(() => {
    if (!draftKey) return;
    let d: CredentialDraft | null = null;
    try {
      d = parseDraft(localStorage.getItem(draftKey));
    } catch {
      return; // storage unavailable
    }
    if (!d) return;
    setWabaId(d.wabaId);
    setPhoneNumberId(d.phoneNumberId);
    setDisplayPhoneNumber(d.displayPhoneNumber);
    setBusinessName(d.businessName);
    setAppSecret(d.appSecret);
    dirtyRef.current = true;
  }, [draftKey]);

  const hydrate = React.useCallback((c: WhatsAppConnectionPublic | null) => {
    setConn(c);
    setWabaId(c?.wabaId ?? '');
    setPhoneNumberId(c?.phoneNumberId ?? '');
    setDisplayPhoneNumber(c?.displayPhoneNumber ?? '');
    setBusinessName(c?.businessName ?? '');
    setAccessToken('');
    setAppSecret('');
  }, []);

  // Initial load — genuine async I/O on mount (server-only collection).
  React.useEffect(() => {
    let active = true;
    if (!user || !activeOrganizationId) return;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await getWhatsAppConnection(idToken, activeOrganizationId);
        if (active && res.success) hydrate(res.data);
      } catch {
        /* surfaced on action use */
      } finally {
        if (active) {
          restoreDraft(); // layer any unsaved input over the server values
          setLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [user, activeOrganizationId, hydrate, restoreDraft]);

  // Persist the draft (sans access token) on every edit, so a reload or a
  // failed save never loses what was typed. Only runs after load and only once
  // the user has actually changed something.
  React.useEffect(() => {
    if (loading || !draftKey || !dirtyRef.current) return;
    const draft: CredentialDraft = { wabaId, phoneNumberId, displayPhoneNumber, businessName, appSecret };
    try {
      if (isDraftEmpty(draft)) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, serializeDraft(draft));
    } catch {
      /* storage unavailable — non-fatal */
    }
  }, [loading, draftKey, wabaId, phoneNumberId, displayPhoneNumber, businessName, appSecret]);

  const handleSave = async () => {
    if (!activeOrganizationId) return;
    setIsSaving(true);
    try {
      const idToken = await getToken();
      const res = await saveWhatsAppConnection(idToken, {
        organizationId: activeOrganizationId,
        wabaId: wabaId.trim(),
        phoneNumberId: phoneNumberId.trim(),
        displayPhoneNumber: displayPhoneNumber.trim(),
        businessName: businessName.trim() || undefined,
        accessToken: accessToken.trim(),
        appSecret: appSecret.trim() || undefined,
      });
      if (res.success) {
        hydrate(res.data);
        clearDraft();
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
    if (!activeOrganizationId) return;
    setIsTesting(true);
    try {
      const idToken = await getToken();
      const res = await testWhatsAppConnection(idToken, activeOrganizationId);
      if (res.success) {
        setConn(res.data);
        const ok = res.data?.status === 'connected';
        toast({
          variant: ok ? 'default' : 'destructive',
          title: ok ? 'Connection healthy' : 'Connection error',
          description: ok
            ? `Quality: ${res.data?.qualityRating ?? '—'} · Tier: ${res.data?.messagingLimit ?? '—'}`
            : res.data?.lastError,
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
    if (!activeOrganizationId) return;
    if (!confirm('Remove this WhatsApp connection? Stored credentials will be deleted.')) return;
    setIsDisconnecting(true);
    try {
      const idToken = await getToken();
      const res = await disconnectWhatsApp(idToken, activeOrganizationId);
      if (res.success) {
        hydrate(null);
        clearDraft();
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
    !!activeOrganizationId &&
    !!wabaId.trim() &&
    !!phoneNumberId.trim() &&
    !!displayPhoneNumber.trim() &&
    accessToken.trim().length >= 10;

  return (
    <Card className="rounded-2xl border-none ring-1 ring-border shadow-sm bg-card overflow-hidden">
      {/* Thin title bar — icon aligned with title, no description */}
      <div className="px-5 py-3.5 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-sm font-bold tracking-tight flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" /> Credentials
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
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

      <CardContent className="p-5 space-y-5">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading connection…
          </div>
        ) : (
          <>
            {!conn && activeOrganizationId && (
              <div className="rounded-xl bg-primary/5 ring-1 ring-primary/15 p-4 space-y-2">
                <p className="text-sm font-bold">Prefer one click?</p>
                <p className="text-xs font-medium text-muted-foreground">
                  Use Embedded Signup to connect without copying any values — or fill the form below.
                </p>
                <WhatsAppEmbeddedSignup organizationId={activeOrganizationId} onConnected={hydrate} />
              </div>
            )}

            {conn?.lastError && status === 'error' && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-500/5 ring-1 ring-red-500/20 rounded-xl px-4 py-3">
                {conn.lastError}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="WhatsApp Business Account ID (WABA)">
                <Input value={wabaId} onChange={(e) => { markDirty(); setWabaId(e.target.value); }} placeholder="1234567890" className={INPUT_CLS} />
              </Field>
              <Field label="Phone Number ID">
                <Input value={phoneNumberId} onChange={(e) => { markDirty(); setPhoneNumberId(e.target.value); }} placeholder="1098765432" className={INPUT_CLS} />
              </Field>
              <Field label="Display Phone Number">
                <Input value={displayPhoneNumber} onChange={(e) => { markDirty(); setDisplayPhoneNumber(e.target.value); }} placeholder="+233 20 000 0000" className={INPUT_CLS} />
              </Field>
              <Field label="Business Name (optional)">
                <Input value={businessName} onChange={(e) => { markDirty(); setBusinessName(e.target.value); }} placeholder="Acme Inc." className={INPUT_CLS} />
              </Field>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-0.5 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Encrypted at rest · never shown again
              </Label>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowSecrets((s) => !s)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground">
                {showSecrets ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
                {showSecrets ? 'Hide' : 'Show'}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="System User Access Token">
                <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)}
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={conn?.hasToken ? `••••${conn.tokenLast4 ?? ''} — paste to replace` : 'EAAG…'}
                  className={INPUT_CLS} />
              </Field>
              <Field label="App Secret (optional — webhook validation)">
                <Input value={appSecret} onChange={(e) => { markDirty(); setAppSecret(e.target.value); }}
                  type={showSecrets ? 'text' : 'password'}
                  placeholder={conn?.hasAppSecret ? '•••• — paste to replace' : 'app secret'}
                  className={INPUT_CLS} />
              </Field>
            </div>

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              {conn && (
                <Button type="button" variant="ghost" onClick={handleDisconnect} disabled={isDisconnecting}
                  className="rounded-xl font-semibold h-10 px-5 text-destructive hover:text-destructive hover:bg-destructive/10">
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unplug className="h-4 w-4 mr-2" />}
                  Disconnect
                </Button>
              )}
              {conn && (
                <Button type="button" variant="outline" onClick={handleTest} disabled={isTesting}
                  className="rounded-xl font-semibold h-10 px-5 border-border">
                  {isTesting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PlugZap className="h-4 w-4 mr-2" />}
                  Test connection
                </Button>
              )}
              <Button onClick={handleSave} disabled={isSaving || !canSave}
                className="rounded-xl font-semibold h-10 px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
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
    <div className="space-y-1.5">
      <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground ml-0.5">{label}</Label>
      {children}
    </div>
  );
}
