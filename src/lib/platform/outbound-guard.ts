/**
 * @fileOverview The outbound messaging kill switch (backoffice isolation, risk R2).
 *
 * WHY THIS EXISTS
 * A staging or control-plane backend shares the production Firebase project, and provider
 * credentials are stored PER ORGANIZATION in Firestore (`org.mnotifyApiKey`,
 * `org.resendApiKey`). Withholding the environment secrets from a non-production backend
 * is therefore NOT enough to stop it messaging real customers — it would resolve a
 * tenant's own key and send. This guard is what actually prevents that.
 *
 * WHERE IT IS ENFORCED
 * At the provider boundaries (resend, mnotify, onesignal, whatsapp), not inside
 * messaging-engine.ts, so every call path is covered — including bulk-upload-actions.ts,
 * which resolves its own per-org keys and never touches the engine.
 *
 * TWO LAYERS, DELIBERATELY ORDERED
 *   1. ALLOW_OUTBOUND_MESSAGING=false — a hard floor. Checked FIRST, and short-circuits
 *      before any Firestore read, so it cannot be lifted from the backoffice UI.
 *   2. platform_config/messaging_controls.outboundEnabled — the operator pause switch.
 * An operator must never be able to turn a staging environment into one that messages
 * real customers, which is why the order matters and is covered by a test.
 *
 * CAUTION FOR FUTURE EDITORS
 * The default is ALLOW, and a failed config read is ALLOW. That is intentional: a missing
 * document or a Firestore outage must not silently stop production messaging. If you
 * change either default you are choosing "customers stop receiving mail during an
 * incident" — make that choice deliberately, and update the tests that assert it.
 */
import { reportError } from '@/lib/errors/report-error';

export type OutboundChannel = 'email' | 'sms' | 'push' | 'whatsapp';

/** Thrown when this deployment is not permitted to contact a customer. */
export class OutboundBlockedError extends Error {
  readonly channel: OutboundChannel;
  readonly reason: string;

  constructor(channel: OutboundChannel, reason: string) {
    super(`Outbound ${channel} is disabled on this deployment: ${reason}`);
    this.name = 'OutboundBlockedError';
    this.channel = channel;
    this.reason = reason;
  }
}

interface MessagingControls {
  outboundEnabled: boolean;
  pausedReason: string;
}

/** Long enough to keep Firestore out of the hot path, short enough that a pause lands fast. */
const CACHE_TTL_MS = 30_000;

const ALLOW_BY_DEFAULT: MessagingControls = { outboundEnabled: true, pausedReason: '' };

let cachedControls: MessagingControls | null = null;
let cachedAt = 0;
let inFlight: Promise<MessagingControls> | null = null;

/** Test seam — resets module state between cases. Not for production use. */
export function __resetOutboundCache(): void {
  cachedControls = null;
  cachedAt = 0;
  inFlight = null;
}

function envFloorAllows(): boolean {
  return process.env.ALLOW_OUTBOUND_MESSAGING !== 'false';
}

async function readControls(): Promise<MessagingControls> {
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const snap = await adminDb.collection('platform_config').doc('messaging_controls').get();
    if (!snap.exists) return ALLOW_BY_DEFAULT;

    const data = snap.data();
    return {
      // Absent or non-false means enabled: a partially written document must not block sending.
      outboundEnabled: data?.outboundEnabled !== false,
      pausedReason: typeof data?.pausedReason === 'string' ? data.pausedReason : '',
    };
  } catch (error) {
    // Fail open. A Firestore problem must not stop production messaging.
    reportError('platform.outbound-guard', error, { note: 'control read failed; allowing send' });
    return ALLOW_BY_DEFAULT;
  }
}

async function getControls(): Promise<MessagingControls> {
  if (cachedControls && Date.now() - cachedAt < CACHE_TTL_MS) return cachedControls;

  // Share one in-flight read across concurrent callers, so a cold start under load does
  // not stampede the config document.
  if (!inFlight) {
    inFlight = readControls().then((controls) => {
      cachedControls = controls;
      cachedAt = Date.now();
      inFlight = null;
      return controls;
    });
  }
  return inFlight;
}

/**
 * Throws {@link OutboundBlockedError} if this deployment must not send.
 * Call as the FIRST statement of every provider send function.
 */
export async function assertOutboundAllowed(channel: OutboundChannel): Promise<void> {
  // Checked before any I/O so the hard floor cannot be influenced by stored config.
  if (!envFloorAllows()) {
    throw new OutboundBlockedError(channel, 'sending is disabled for this environment');
  }

  const controls = await getControls();
  if (!controls.outboundEnabled) {
    throw new OutboundBlockedError(channel, controls.pausedReason || 'paused by an administrator');
  }
}

/** Non-throwing form, for status displays. */
export async function isOutboundAllowed(): Promise<boolean> {
  if (!envFloorAllows()) return false;
  return (await getControls()).outboundEnabled;
}
