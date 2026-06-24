/**
 * @fileOverview Surfacing of messaging-send failures to org admins via the
 * in-app notifications panel.
 *
 * When a send cannot resolve a valid org-owned sender (or hits another fatal
 * tenant-isolation guard), the engine returns an error AND calls
 * {@link notifyMessagingFailure} so an admin who can fix it sees it in the panel
 * rather than the failure being silent.
 *
 * The id/text builders are pure (unit-tested); the dispatcher does Firestore I/O
 * with a lazy admin import so this module stays importable in pure tests.
 */

import type { ResolutionOutcome } from './sender-resolution';
import type { UserProfile } from '@/lib/types';

const CHANNEL_LABEL: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  in_app: 'In-App',
  push: 'Push',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel.toUpperCase();
}

export interface FailureNoticeKey {
  orgId: string;
  templateId: string;
  channel: string;
  recipient: string;
}

/**
 * Deterministic, Firestore-safe id for a failure so repeated identical failures
 * upsert a single notice per admin (de-dupe — avoids notification spam).
 * Uses a dependency-free FNV-1a hash so the function stays pure.
 */
export function failureNoticeId(key: FailureNoticeKey): string {
  const raw = `${key.orgId}|${key.templateId}|${key.channel}|${key.recipient}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    // FNV prime multiply, kept in 32-bit unsigned range.
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `msgfail_${hash.toString(36)}`;
}

/** Short title for the notice. */
export function buildFailureTitle(channel: string): string {
  return `${channelLabel(channel)} message could not be sent`;
}

/** Actionable body text explaining why the send failed and how to fix it. */
export function buildFailureBody(outcome: ResolutionOutcome, channel: string): string {
  const label = channelLabel(channel);
  if (outcome === 'cross_org_explicit') {
    return `A ${label} message was blocked because the selected sender belongs to a different organization. Pick a sender that belongs to this organization.`;
  }
  // 'no_sender' (plus every other non-resolved outcome)
  return `A ${label} message could not be sent because no ${label} sender is configured for this organization. Set a default sender under Messaging → Sender Profiles.`;
}

export interface NotifyMessagingFailureInput {
  orgId: string;
  channel: string;
  templateId: string;
  recipient: string;
  outcome: ResolutionOutcome;
  workspaceId?: string;
  /** Where the admin should go to fix it. Defaults to the sender-profiles page. */
  actionUrl?: string;
}

/**
 * Write an in-app failure notice to every org admin who can configure senders.
 * Idempotent per (failure, admin) via {@link failureNoticeId}. Never throws —
 * notification failure must not mask or escalate the original send failure.
 */
export async function notifyMessagingFailure(input: NotifyMessagingFailureInput): Promise<void> {
  try {
    const { adminDb } = await import('@/lib/firebase-admin');
    const { canManageOrgIntegrations } = await import('@/lib/auth/require-org-admin');

    const usersSnap = await adminDb
      .collection('users')
      .where('organizationId', '==', input.orgId)
      .get();

    const recipients = usersSnap.docs
      .map((d) => ({ id: d.id, profile: d.data() as UserProfile }))
      .filter(({ profile }) => canManageOrgIntegrations(profile, input.orgId));

    if (recipients.length === 0) {
      console.warn(`[MSG-FAIL] No admin recipients found for org ${input.orgId}; failure not surfaced in-app.`);
      return;
    }

    const noticeId = failureNoticeId({
      orgId: input.orgId,
      templateId: input.templateId,
      channel: input.channel,
      recipient: input.recipient,
    });
    const title = buildFailureTitle(input.channel);
    const body = buildFailureBody(input.outcome, input.channel);
    const actionUrl = input.actionUrl ?? '/admin/messaging/profiles';
    const now = new Date().toISOString();

    const batch = adminDb.batch();
    for (const r of recipients) {
      const ref = adminDb.collection('in_app_notifications').doc(`${noticeId}_${r.id}`);
      batch.set(ref, {
        userId: r.id,
        organizationId: input.orgId,
        ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
        title,
        body,
        category: 'messaging',
        isRead: false,
        actionUrl,
        createdAt: now,
      });
    }
    await batch.commit();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[MSG-FAIL] Failed to surface messaging failure notice (non-fatal):', message);
  }
}
