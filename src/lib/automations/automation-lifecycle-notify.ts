/**
 * @fileOverview Aggregated in-app notifications for automation lifecycle events.
 *
 * - started / completed: batched into 5-min windows via automation_notification_buffers
 * - failed: immediate — written directly to in_app_notifications for all workspace admins
 *
 * All functions are fire-and-forget safe (swallow errors, non-fatal).
 */

import { adminDb } from '../firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { UserProfile } from '../types';

const BUFFER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

// ── Types ───────────────────────────────────────────────────────────────────────

interface AutomationNotificationBuffer {
  automationId: string;
  automationName: string;
  event: 'started' | 'completed';
  workspaceId: string;
  count: number;
  firstAt: string;
  pendingFlushAt: string;
  flushed: boolean;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Resolves all authorized users who belong to the given workspace.
 */
async function resolveWorkspaceAdmins(workspaceId: string): Promise<UserProfile[]> {
  const snap = await adminDb
    .collection('users')
    .where('workspaceIds', 'array-contains', workspaceId)
    .where('isAuthorized', '==', true)
    .get();

  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as UserProfile));
}

function currentWindowKey(): string {
  // Round down to the nearest 5-min slot so all runs in the same window share one buffer doc
  const slotMs = Math.floor(Date.now() / BUFFER_WINDOW_MS) * BUFFER_WINDOW_MS;
  return new Date(slotMs).toISOString().slice(0, 16); // "2026-06-25T08:10"
}

async function writeInAppNotifications(params: {
  workspaceId: string;
  automationId: string;
  title: string;
  body: string;
  category: string;
}): Promise<void> {
  const admins = await resolveWorkspaceAdmins(params.workspaceId);
  if (!admins.length) return;

  const now = new Date().toISOString();
  const actionUrl = `/admin/automations/${params.automationId}/edit`;

  const batch = adminDb.batch();
  for (const admin of admins) {
    const ref = adminDb.collection('in_app_notifications').doc();
    batch.set(ref, {
      userId: admin.id,
      workspaceId: params.workspaceId,
      title: params.title,
      body: params.body,
      category: params.category,
      isRead: false,
      actionUrl,
      createdAt: now,
    });
  }
  await batch.commit();
}

// ── Buffer Flush (called by heartbeat) ─────────────────────────────────────────

/**
 * Flushes pending notification buffers whose window has closed.
 * Safe to call from the heartbeat processor once per minute.
 */
export async function flushAutomationNotificationBuffers(): Promise<void> {
  try {
    const now = new Date().toISOString();
    const snap = await adminDb
      .collection('automation_notification_buffers')
      .where('flushed', '==', false)
      .where('pendingFlushAt', '<=', now)
      .limit(50)
      .get();

    if (snap.empty) return;

    for (const bufferDoc of snap.docs) {
      const data = bufferDoc.data() as AutomationNotificationBuffer;
      const countLabel = data.count === 1 ? '1 contact' : `${data.count} contacts`;

      let title = '';
      let body = '';

      if (data.event === 'started') {
        title = 'Automation Started';
        body = `${countLabel} entered "${data.automationName}"`;
      } else if (data.event === 'completed') {
        title = 'Automation Completed';
        body = `${countLabel} finished "${data.automationName}"`;
      }

      if (title) {
        await writeInAppNotifications({
          workspaceId: data.workspaceId,
          automationId: data.automationId,
          title,
          body,
          category: 'automation',
        });
      }

      await bufferDoc.ref.update({ flushed: true });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AUTO-NOTIFY] Buffer flush failed (non-fatal):', message);
  }
}

// ── Public API ──────────────────────────────────────────────────────────────────

/**
 * Increments the started-event buffer. Notification fires ~5 min after first contact.
 */
export async function notifyAutomationStarted(params: {
  automationId: string;
  automationName: string;
  workspaceId: string;
}): Promise<void> {
  try {
    const key = `${params.automationId}_started_${currentWindowKey()}`;
    const ref = adminDb.collection('automation_notification_buffers').doc(key);
    const now = new Date().toISOString();
    const flushAt = new Date(Date.now() + BUFFER_WINDOW_MS).toISOString();

    await ref.set(
      {
        automationId: params.automationId,
        automationName: params.automationName,
        event: 'started',
        workspaceId: params.workspaceId,
        count: FieldValue.increment(1),
        firstAt: now,
        pendingFlushAt: flushAt,
        flushed: false,
      },
      { merge: true }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AUTO-NOTIFY] notifyAutomationStarted failed (non-fatal):', message);
  }
}

/**
 * Immediately notifies workspace admins of a step failure — no batching.
 */
export async function notifyAutomationFailed(params: {
  automationId: string;
  automationName: string;
  workspaceId: string;
  stepLabel: string;
  error: string;
}): Promise<void> {
  try {
    const errorSnippet = params.error.length > 120
      ? `${params.error.slice(0, 120)}…`
      : params.error;

    await writeInAppNotifications({
      workspaceId: params.workspaceId,
      automationId: params.automationId,
      title: 'Automation Step Failed',
      body: `"${params.stepLabel}" failed in "${params.automationName}": ${errorSnippet}`,
      category: 'automation_error',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AUTO-NOTIFY] notifyAutomationFailed failed (non-fatal):', message);
  }
}

/**
 * Increments the completed-event buffer. Notification fires ~5 min after first completion.
 */
export async function notifyAutomationCompleted(params: {
  automationId: string;
  automationName: string;
  workspaceId: string;
}): Promise<void> {
  try {
    const key = `${params.automationId}_completed_${currentWindowKey()}`;
    const ref = adminDb.collection('automation_notification_buffers').doc(key);
    const now = new Date().toISOString();
    const flushAt = new Date(Date.now() + BUFFER_WINDOW_MS).toISOString();

    await ref.set(
      {
        automationId: params.automationId,
        automationName: params.automationName,
        event: 'completed',
        workspaceId: params.workspaceId,
        count: FieldValue.increment(1),
        firstAt: now,
        pendingFlushAt: flushAt,
        flushed: false,
      },
      { merge: true }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[AUTO-NOTIFY] notifyAutomationCompleted failed (non-fatal):', message);
  }
}
