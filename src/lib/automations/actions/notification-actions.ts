import { adminDb } from '../../firebase-admin';
import { sendMessage } from '../../messaging-engine';
import { resolveContact } from '../../contact-adapter';
import type { ExecutionContext } from '../execution-types';

export async function handleSendNotification(
  actionType: string,
  config: Record<string, unknown>,
  context: ExecutionContext
): Promise<void> {
  const targets = (config.notificationTargets || []) as string[];
  const userIds = (config.notificationUserIds || []) as string[];
  const customRec = config.customRecipient as string | undefined;
  const bodyTemplate = (config.notificationBody || '') as string;
  const subjectTemplate = (config.notificationSubject || 'Notification Alert') as string;

  if (targets.length === 0) return;

  // Resolve recipient destinations
  const emails: string[] = [];
  const phones: string[] = [];
  const targetUserIds: string[] = [];

  // Get workspace context details
  const workspaceSnap = await adminDb.collection('workspaces').doc(context.workspaceId).get();
  if (!workspaceSnap.exists) {
    throw new Error(`Workspace ${context.workspaceId} not found`);
  }
  const workspaceData = workspaceSnap.data()!;
  const orgId = workspaceData.organizationId;

  // 1. Resolve Workspace Assignee
  if (targets.includes('assignee') && context.entityId) {
    const contact = await resolveContact(context.entityId, context.workspaceId);
    if (contact?.assignedTo?.userId) {
      targetUserIds.push(contact.assignedTo.userId);
      // Fetch assignee user profile details
      const userSnap = await adminDb.collection('users').doc(contact.assignedTo.userId).get();
      if (userSnap.exists) {
        const u = userSnap.data()!;
        if (u.email) emails.push(u.email);
        if (u.phone) phones.push(u.phone);
      }
    }
  }

  // 2. Resolve Selected Workspace Team Members
  if (targets.includes('users') && userIds.length > 0) {
    for (const uid of userIds) {
      targetUserIds.push(uid);
      const userSnap = await adminDb.collection('users').doc(uid).get();
      if (userSnap.exists) {
        const u = userSnap.data()!;
        if (u.email) emails.push(u.email);
        if (u.phone) phones.push(u.phone);
      }
    }
  }

  // 3. Resolve Custom Destination
  if (targets.includes('custom') && customRec) {
    if (actionType === 'SEND_NOTIFICATION_SMS') {
      phones.push(customRec);
    } else {
      emails.push(customRec);
    }
  }

  // Helper to compile dynamic templates using variables
  const compileTemplate = (tmpl: string, payload: any) => {
    return tmpl.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim();
      return payload[trimmed] !== undefined ? String(payload[trimmed]) : match;
    });
  };

  const resolvedBody = compileTemplate(bodyTemplate, context.payload);
  const resolvedSubject = compileTemplate(subjectTemplate, context.payload);

  const uniqueEmails = Array.from(new Set(emails));
  const uniquePhones = Array.from(new Set(phones));
  const uniqueUserIds = Array.from(new Set(targetUserIds));

  // Dispatch notification channel actions
  if (actionType === 'SEND_NOTIFICATION_EMAIL') {
    for (const email of uniqueEmails) {
      await sendMessage({
        templateId: 'administrative-notification-email',
        senderProfileId: 'system-alerts',
        recipient: email,
        variables: {
          ...context.payload,
          subject: resolvedSubject,
          body: resolvedBody
        },
        entityId: context.entityId,
        workspaceId: context.workspaceId,
        body: resolvedBody
      });
    }
  }

  if (actionType === 'SEND_NOTIFICATION_SMS') {
    for (const phone of uniquePhones) {
      await sendMessage({
        templateId: 'administrative-notification-sms',
        senderProfileId: 'system-alerts',
        recipient: phone,
        variables: {
          ...context.payload,
          body: resolvedBody
        },
        entityId: context.entityId,
        workspaceId: context.workspaceId,
        body: resolvedBody
      });
    }
  }

  if (actionType === 'SEND_NOTIFICATION_IN_APP') {
    // Record in-app notification doc in Firestore
    for (const uid of uniqueUserIds) {
      await adminDb.collection('notifications').add({
        organizationId: orgId,
        workspaceId: context.workspaceId,
        userId: uid,
        entityId: context.entityId || null,
        title: resolvedSubject,
        message: resolvedBody,
        status: 'unread',
        createdAt: new Date().toISOString(),
        actionType: 'system_alert'
      });
    }
  }

  if (actionType === 'SEND_NOTIFICATION_PUSH') {
    // Save push request alert to collection for dispatching
    for (const uid of uniqueUserIds) {
      await adminDb.collection('push_queue').add({
        organizationId: orgId,
        workspaceId: context.workspaceId,
        userId: uid,
        title: resolvedSubject,
        body: resolvedBody,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
    }
  }
}
