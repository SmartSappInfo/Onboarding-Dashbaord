import { adminDb } from '../../firebase-admin';
import { sendMessage } from '../../messaging-engine';
import { sendPushNotification } from '../../onesignal-service';
import { resolveContact } from '../../contact-adapter';
import { logAutomationEvent } from '../../automation-log';
import type { ExecutionContext } from '../execution-types';

/**
 * Normalizes the `assignedTo` field from workspace_entities.
 * The field may be stored as a plain string (userId) or as an object { userId: string | null }.
 * Both shapes are valid — this function resolves them uniformly and always returns
 * `string | undefined` (null is coerced to undefined).
 */
function resolveAssigneeUserId(
  assignedTo: string | { userId?: string | null } | null | undefined
): string | undefined {
  if (!assignedTo) return undefined;
  if (typeof assignedTo === 'string') return assignedTo || undefined;
  return assignedTo.userId ?? undefined;
}

/**
 * Compiles a template string by replacing {{variable}} placeholders with
 * values from the provided payload. Unresolved placeholders are left as-is.
 */
function compileTemplate(tmpl: string, payload: Record<string, unknown>): string {
  return tmpl.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const trimmed = (key as string).trim();
    return trimmed in payload ? String(payload[trimmed]) : `{{${trimmed}}}`;
  });
}

export async function handleSendNotification(
  actionType: string,
  config: Record<string, unknown>,
  context: ExecutionContext,
): Promise<void> {
  const templateId = config.templateId as string | undefined;

  // Guard: templateId is required and validated at save time. This is defence-in-depth.
  if (!templateId) {
    console.error(
      `[notification-actions] No templateId on ${actionType} node — skipping. automationId=${context.automationId}`,
    );
    return;
  }

  const targets    = (config.notificationTargets  || []) as string[];
  const userIds    = (config.notificationUserIds   || []) as string[];
  const customRec  = config.customRecipient as string | undefined;

  if (targets.length === 0) return;

  // ── Fetch the user-selected template (subject + body) ─────────────────────
  const templateSnap = await adminDb.collection('message_templates').doc(templateId).get();
  if (!templateSnap.exists) {
    console.error(
      `[notification-actions] Template ${templateId} not found — skipping notification.`,
    );
    return;
  }
  const templateData = templateSnap.data()!;
  const resolvedSubject = compileTemplate(
    (templateData.subject as string | undefined) || 'Notification',
    context.payload,
  );
  const resolvedBody = compileTemplate(
    (templateData.body as string | undefined) || '',
    context.payload,
  );

  // ── Fetch workspace context ────────────────────────────────────────────────
  const workspaceSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
  if (!workspaceSnap.exists) {
    throw new Error(`Workspace ${context.workspaceId} not found`);
  }
  const orgId = (workspaceSnap.data()!.organizationId as string) || '';

  // ── Resolve recipient destinations ─────────────────────────────────────────
  const emails:        string[] = [];
  const phones:        string[] = [];
  const targetUserIds: string[] = [];

  // 1. Workspace Assignee
  // resolveAssigneeUserId normalizes assignedTo regardless of storage shape
  // (plain string userId or { userId: string } object — both are stored in the wild)
  if (targets.includes('assignee') && context.entityId) {
    const contact = await resolveContact(context.entityId, context.workspaceId);
    const assigneeUserId = resolveAssigneeUserId(contact?.assignedTo);
    if (assigneeUserId) {
      targetUserIds.push(assigneeUserId);
      const userSnap = await adminDb.collection('users').doc(assigneeUserId).get();
      if (userSnap.exists) {
        const u = userSnap.data()!;
        if (u.email) emails.push(u.email as string);
        if (u.phone) phones.push(u.phone as string);
      }
    }
  }

  // 2. Selected Team Members
  if (targets.includes('users') && userIds.length > 0) {
    for (const uid of userIds) {
      targetUserIds.push(uid);
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const u = userSnap.data()!;
        if (u.email) emails.push(u.email as string);
        if (u.phone) phones.push(u.phone as string);
      }
    }
  }

  // 3. Custom Destination
  if (targets.includes('custom') && customRec) {
    if (actionType === 'SEND_NOTIFICATION_SMS') {
      phones.push(customRec);
    } else {
      emails.push(customRec);
    }
  }

  const uniqueEmails    = Array.from(new Set(emails));
  const uniquePhones    = Array.from(new Set(phones));
  const uniqueUserIds   = Array.from(new Set(targetUserIds));
  const now             = new Date().toISOString();

  // Failures here are surfaced to the automation activity log so a misconfigured
  // sender / missing recipient is visible, but they never throw — an internal
  // notification hiccup must not halt the entity's journey through the flow.
  const logNotificationFailure = (detail: Record<string, unknown>) => {
    logAutomationEvent('error', 'notification_dispatch_failed', {
      automationId: context.automationId,
      runId: context.runId,
      workspaceId: context.workspaceId,
      entityId: context.entityId,
      actionType,
      ...detail,
    });
  };

  // ── Dispatch per channel ───────────────────────────────────────────────────

  if (actionType === 'SEND_NOTIFICATION_EMAIL') {
    for (const email of uniqueEmails) {
      const result = await sendMessage({
        templateId,
        // 'default' resolves to this org's default sender; a cross-org named
        // profile would be rejected by the org-scoped resolver.
        senderProfileId: 'default',
        organizationId: orgId,
        recipient: email,
        variables: { ...context.payload, subject: resolvedSubject, body: resolvedBody },
        entityId: context.entityId,
        workspaceId: context.workspaceId,
      });
      if (!result.success) {
        console.error(`[notification-actions] Email notification to ${email} failed: ${result.error}`);
        logNotificationFailure({ recipient: email, channel: 'email', error: result.error });
      }
    }
  }

  if (actionType === 'SEND_NOTIFICATION_SMS') {
    for (const phone of uniquePhones) {
      const result = await sendMessage({
        templateId,
        senderProfileId: 'default',
        organizationId: orgId,
        recipient: phone,
        variables: { ...context.payload, body: resolvedBody },
        entityId: context.entityId,
        workspaceId: context.workspaceId,
      });
      if (!result.success) {
        console.error(`[notification-actions] SMS notification to ${phone} failed: ${result.error}`);
        logNotificationFailure({ recipient: phone, channel: 'sms', error: result.error });
      }
    }
  }

  if (actionType === 'SEND_NOTIFICATION_IN_APP') {
    // Canonical in-app shape consumed by NotificationCenter (in_app_notifications
    // collection, `body`/`isRead`/`category` fields). The previous `notifications`
    // collection + `message`/`status` fields were never read by the UI.
    for (const uid of uniqueUserIds) {
      await adminDb.collection('in_app_notifications').add({
        organizationId: orgId,
        workspaceId:    context.workspaceId,
        userId:         uid,
        title:          resolvedSubject,
        body:           resolvedBody,
        category:       'automations',
        isRead:         false,
        templateId,                    // stored for traceability / re-render
        entityId:       context.entityId || null,
        createdAt:      now,
      });
    }
  }

  if (actionType === 'SEND_NOTIFICATION_PUSH' && uniqueUserIds.length > 0) {
    // OneSignal is keyed by external user id, which matches our userId. The
    // previous `push_queue` write had no consumer, so pushes never dispatched.
    const pushResult = await sendPushNotification(uniqueUserIds, resolvedSubject, resolvedBody);
    if (!pushResult || pushResult.errors) {
      console.error('[notification-actions] Push notification dispatch failed:', pushResult?.errors);
      logNotificationFailure({ userIds: uniqueUserIds, channel: 'push', error: pushResult?.errors ? String(pushResult.errors) : 'OneSignal credentials missing or send failed' });
    }
  }
}
