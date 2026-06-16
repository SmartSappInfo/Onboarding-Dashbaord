'use client';

import * as React from 'react';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { MessageCircle, Loader2 } from 'lucide-react';
import { connectWhatsAppViaOAuth } from '@/lib/whatsapp-actions';
import type { WhatsAppConnectionPublic } from '@/lib/whatsapp/whatsapp-types';

// Platform Embedded Signup config (public — app id + the ES configuration id).
const APP_ID = process.env.NEXT_PUBLIC_META_APP_ID;
const CONFIG_ID = process.env.NEXT_PUBLIC_META_ES_CONFIG_ID;
const GRAPH_VERSION = 'v21.0';

interface Props {
  organizationId: string;
  onConnected: (conn: WhatsAppConnectionPublic) => void;
}

/**
 * "Connect with WhatsApp" — Meta Embedded Signup (OAuth). The hosted popup lets
 * the org select/create their WABA + number and returns an auth code (via
 * FB.login) plus the chosen waba_id/phone_number_id (via a postMessage). The
 * server action exchanges the code for a token, provisions the connection, and
 * auto-wires webhooks — no manual paste.
 *
 * Renders nothing unless the platform has configured Embedded Signup
 * (NEXT_PUBLIC_META_APP_ID + NEXT_PUBLIC_META_ES_CONFIG_ID), so the manual flow
 * remains the default until the platform's Meta app passes App Review.
 */
export default function WhatsAppEmbeddedSignup({ organizationId, onConnected }: Props) {
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [sdkReady, setSdkReady] = React.useState(false);
  const sessionRef = React.useRef<{ wabaId?: string; phoneNumberId?: string }>({});

  const enabled = !!APP_ID && !!CONFIG_ID;

  React.useEffect(() => {
    if (!enabled) return;

    // Capture the WABA/number selected inside the popup (postMessage from Meta).
    function onMessage(event: MessageEvent) {
      // Only trust messages from a facebook.com origin.
      let host = '';
      try {
        host = new URL(event.origin).hostname;
      } catch {
        return;
      }
      if (host !== 'facebook.com' && !host.endsWith('.facebook.com')) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type === 'WA_EMBEDDED_SIGNUP' && data?.data) {
          sessionRef.current = {
            wabaId: data.data.waba_id ?? sessionRef.current.wabaId,
            phoneNumberId: data.data.phone_number_id ?? sessionRef.current.phoneNumberId,
          };
        }
      } catch {
        /* not our message */
      }
    }
    window.addEventListener('message', onMessage);

    const w = window as unknown as { FB?: unknown; fbAsyncInit?: () => void };
    if (!w.FB) {
      w.fbAsyncInit = function () {
        (window as any).FB.init({ appId: APP_ID, autoLogAppEvents: true, xfbml: false, version: GRAPH_VERSION });
        setSdkReady(true);
      };
      const s = document.createElement('script');
      s.src = 'https://connect.facebook.net/en_US/sdk.js';
      s.async = true;
      s.defer = true;
      s.crossOrigin = 'anonymous';
      document.body.appendChild(s);
    } else {
      setSdkReady(true);
    }

    return () => window.removeEventListener('message', onMessage);
  }, [enabled]);

  const launch = React.useCallback(() => {
    const FB = (window as any).FB;
    if (!FB || !user) return;
    setLoading(true);
    sessionRef.current = {};

    FB.login(
      (response: any) => {
        const code = response?.authResponse?.code;
        const { wabaId, phoneNumberId } = sessionRef.current;
        if (!code) {
          setLoading(false); // user closed the popup
          return;
        }
        if (!wabaId || !phoneNumberId) {
          setLoading(false);
          toast({ variant: 'destructive', title: 'Incomplete', description: 'Meta did not return the WABA/number. Please try again.' });
          return;
        }
        (async () => {
          try {
            const idToken = await user.getIdToken();
            const res = await connectWhatsAppViaOAuth(idToken, { organizationId, code, wabaId, phoneNumberId });
            if (res.success) {
              onConnected(res.data);
              toast({ title: 'WhatsApp connected', description: 'Credentials provisioned and webhooks wired automatically.' });
            } else {
              toast({ variant: 'destructive', title: 'Connect failed', description: res.error });
            }
          } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
          } finally {
            setLoading(false);
          }
        })();
      },
      {
        config_id: CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      },
    );
  }, [user, organizationId, onConnected, toast]);

  if (!enabled) return null;

  return (
    <Button
      type="button"
      onClick={launch}
      disabled={loading || !sdkReady}
      className="rounded-xl font-semibold h-10 px-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <MessageCircle className="h-4 w-4 mr-2" />}
      Connect with WhatsApp
    </Button>
  );
}
