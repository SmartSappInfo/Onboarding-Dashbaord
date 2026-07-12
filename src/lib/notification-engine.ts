
'use server';

import { adminDb } from './firebase-admin';
import { sendMessage } from './messaging-engine';
import { resolveContact } from './contact-adapter';
import type { School, UserProfile } from './types';

interface InternalNotificationOptions {
  triggerKey?: string;
  entityId?: string;
  specificUserIds?: string[];
  notifyManager?: boolean;
  emailTemplateId?: string;
  smsTemplateId?: string;
  whatsappTemplateId?: string;
  inAppTemplateId?: string;
  pushTemplateId?: string;
  variables: Record<string, any>;
  // 'both' = email+sms (legacy); 'all' includes whatsapp; 'whatsapp' = whatsapp only.
  channel?: 'email' | 'sms' | 'whatsapp' | 'both' | 'all';
}

interface ExternalNotificationOptions {
  entityId: string;
  contactTypes: string[];
  emailTemplateId?: string;
  smsTemplateId?: string;
  whatsappTemplateId?: string;
  variables: Record<string, any>;
  channel?: 'email' | 'sms' | 'whatsapp' | 'both';
}

/**
 * High-performance internal notification router.
 * Resolves recipients (Manager vs Specific Users) and dispatches alerts.
 * 
 * Updated to use the Contact Adapter Layer for backward compatibility (Requirement 18)
 */
export async function triggerInternalNotification(options: InternalNotificationOptions) {
  const { entityId, specificUserIds, notifyManager, variables, channel = 'both', triggerKey } = options;
  const { resolveWorkspaceIdFromEntity } = await import('./services/workspace-resolver');
  const resolvedWorkspaceId = (variables.workspaceId as string | undefined) || (entityId ? await resolveWorkspaceIdFromEntity(entityId) : null) || undefined;
  if (!resolvedWorkspaceId) {
    console.warn(">>> [NOTIFY] Skipping: no workspace context resolved.");
    return;
  }

  let emailTemplateId = options.emailTemplateId;
  let smsTemplateId = options.smsTemplateId;
  let whatsappTemplateId = options.whatsappTemplateId;
  let inAppTemplateId = options.inAppTemplateId;
  let pushTemplateId = options.pushTemplateId;

  console.log(`>>> [NOTIFY] Triggering Internal Notification Hub...`);

  if (triggerKey) {
    try {
      let orgId: string | null = (variables.organizationId as string | undefined) || null;
      if (!orgId && resolvedWorkspaceId) {
        const wsSnap = await adminDb.collection('workspaces').doc(resolvedWorkspaceId).get();
        if (wsSnap.exists) {
          orgId = (wsSnap.data()?.organizationId as string | undefined) || null;
        }
      }
      if (!orgId && entityId) {
        const contact = await resolveContact(entityId, resolvedWorkspaceId);
        if (contact && contact.schoolData?.organizationId) {
          orgId = contact.schoolData.organizationId;
        }
      }
      if (!orgId) {
        const wsSnap = await adminDb.collection('workspaces').limit(1).get();
        if (!wsSnap.empty) {
          orgId = (wsSnap.docs[0].data().organizationId as string | undefined) || null;
        }
      }
      const finalOrgId = orgId || 'default_org';

      const { resolveActiveTemplate } = await import('./template-resolver');

      if (!emailTemplateId && (channel === 'email' || channel === 'both' || channel === 'all')) {
        try {
          const tpl = await resolveActiveTemplate(triggerKey, finalOrgId, 'email');
          if (tpl && (tpl.status === 'active' || tpl.isActive === true)) {
            emailTemplateId = tpl.id;
          }
        } catch (e: unknown) {
          console.warn(`[NOTIFY] Could not resolve email template for trigger ${triggerKey}:`, e);
        }
      }
      if (!smsTemplateId && (channel === 'sms' || channel === 'both' || channel === 'all')) {
        try {
          const tpl = await resolveActiveTemplate(triggerKey, finalOrgId, 'sms');
          if (tpl && (tpl.status === 'active' || tpl.isActive === true)) {
            smsTemplateId = tpl.id;
          }
        } catch (e: unknown) {
          console.warn(`[NOTIFY] Could not resolve sms template for trigger ${triggerKey}:`, e);
        }
      }
      if (!whatsappTemplateId && (channel === 'whatsapp' || channel === 'all')) {
        try {
          const tpl = await resolveActiveTemplate(triggerKey, finalOrgId, 'whatsapp');
          if (tpl && (tpl.status === 'active' || tpl.isActive === true)) {
            whatsappTemplateId = tpl.id;
          }
        } catch (e: unknown) {
          console.warn(`[NOTIFY] Could not resolve whatsapp template for trigger ${triggerKey}:`, e);
        }
      }
      if (!inAppTemplateId) {
        try {
          const tpl = await resolveActiveTemplate(triggerKey, finalOrgId, 'in_app');
          if (tpl && (tpl.status === 'active' || tpl.isActive === true)) {
            inAppTemplateId = tpl.id;
          }
        } catch (e: unknown) {
          // ignore
        }
      }
      if (!pushTemplateId) {
        try {
          const tpl = await resolveActiveTemplate(triggerKey, finalOrgId, 'push');
          if (tpl && (tpl.status === 'active' || tpl.isActive === true)) {
            pushTemplateId = tpl.id;
          }
        } catch (e: unknown) {
          // ignore
        }
      }
    } catch (err: unknown) {
      console.error(`[NOTIFY] Error resolving template IDs for trigger ${triggerKey}:`, err);
    }
  }

  try {
    const recipients = new Set<string>(); // Set of user IDs
    const resolvedContacts: { id: string; email?: string; phone?: string; name: string; preferences?: any }[] = [];

    // 1. Resolve Assigned Manager using adapter layer (Requirement 18)
    if (notifyManager && entityId) {
      // Use adapter to resolve contact from either schools or entities + workspace_entities
      const contact = await resolveContact(entityId, resolvedWorkspaceId);
      if (contact && contact.assignedTo && contact.assignedTo.userId) {
        recipients.add(contact.assignedTo.userId);
      }
    }

    // 2. Resolve Specific Users
    if (specificUserIds && specificUserIds.length > 0) {
      specificUserIds.forEach(id => recipients.add(id));
    }

    if (recipients.size === 0) {
      console.warn(">>> [NOTIFY] No recipients resolved for notification.");
      return;
    }

    // 3. Fetch contact details for all resolved recipients
    const userDocs = await Promise.all(
      Array.from(recipients).map(id => adminDb.collection('users').doc(id).get())
    );

    userDocs.forEach(snap => {
      if (snap.exists) {
        const userData = snap.data() as UserProfile;
        if (userData.isAuthorized) {
          resolvedContacts.push({
            id: userData.id,
            email: userData.email,
            phone: userData.phone,
            name: userData.name,
            preferences: userData.notificationPreferences
          });
        }
      }
    });

    // 4. Dispatch Messages
    const dispatchPromises = [];

    for (const contact of resolvedContacts) {
      const personalVars = { ...variables, admin_name: contact.name, user_name: contact.name };
      const prefs = contact.preferences || { email: true, sms: true, inApp: true, push: true };

      // Check category-specific opt-outs if defined
      const category = variables.category || 'general';
      if (prefs.categories && prefs.categories[category] === false) {
        continue; // User opted out of this category entirely
      }

      // Email Dispatch
      if ((channel === 'email' || channel === 'both' || channel === 'all') && emailTemplateId && contact.email && prefs.email !== false) {
        dispatchPromises.push(
          sendMessage({
            templateId: emailTemplateId,
            senderProfileId: 'default',
            recipient: contact.email,
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }

      // SMS Dispatch
      if ((channel === 'sms' || channel === 'both' || channel === 'all') && smsTemplateId && contact.phone && prefs.sms !== false) {
        dispatchPromises.push(
          sendMessage({
            templateId: smsTemplateId,
            senderProfileId: 'default',
            recipient: contact.phone,
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }

      // WhatsApp Dispatch (delivers to phone; opt-in via 'whatsapp'/'all' channel)
      if ((channel === 'whatsapp' || channel === 'all') && whatsappTemplateId && contact.phone && prefs.whatsapp !== false) {
        dispatchPromises.push(
          sendMessage({
            templateId: whatsappTemplateId,
            senderProfileId: 'default',
            recipient: contact.phone,
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }

      // In-App Dispatch
      if (inAppTemplateId && prefs.inApp !== false) {
        dispatchPromises.push(
          sendMessage({
            templateId: inAppTemplateId,
            senderProfileId: 'default',
            recipient: contact.id, // For in-app, recipient is userId
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }

      // Push Dispatch
      if (pushTemplateId && prefs.push !== false) {
        dispatchPromises.push(
          sendMessage({
            templateId: pushTemplateId,
            senderProfileId: 'default',
            recipient: contact.id, // For push, recipient is userId
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }
    }

    await Promise.allSettled(dispatchPromises);
    console.log(`>>> [NOTIFY] Successfully queued ${dispatchPromises.length} alerts for ${resolvedContacts.length} recipients.`);

  } catch (error: any) {
    console.error(">>> [NOTIFY] Critical Failure in Notification Engine:", error.message);
  }
}

/**
 * High-performance external notification router for focal persons.
 * Resolves contacts at a specific campus/entity and dispatches alerts.
 */
export async function triggerExternalNotification(options: ExternalNotificationOptions) {
  const { entityId, contactTypes, emailTemplateId, smsTemplateId, whatsappTemplateId, variables, channel = 'both' } = options;

  console.log(`>>> [EXTERNAL-NOTIFY] Triggering External Notification Hub for Entity: ${entityId}`);

  try {
    const { resolveWorkspaceIdFromEntity } = await import('./services/workspace-resolver');
    const resolvedWorkspaceId = (variables.workspaceId as string | undefined) || (entityId ? await resolveWorkspaceIdFromEntity(entityId) : null) || undefined;
    if (!resolvedWorkspaceId) {
      console.warn(">>> [EXTERNAL-NOTIFY] Skipping: no workspace context resolved.");
      return;
    }

    // 1. Resolve Entity Contacts using adapter layer
    const contact = await resolveContact(entityId, resolvedWorkspaceId);
    
    if (!contact || !contact.contacts || contact.contacts.length === 0) {
      console.warn(">>> [EXTERNAL-NOTIFY] No focal persons found for entity.");
      return;
    }

    // 2. Filter contacts based on types configured in the survey
    const targetContacts = contact.contacts.filter(c => 
      contactTypes.length === 0 || contactTypes.includes(c.type)
    );

    if (targetContacts.length === 0) {
      console.warn(">>> [EXTERNAL-NOTIFY] No focal persons matched the target criteria.");
      return;
    }

    // 3. Dispatch Messages
    const dispatchPromises = [];

    for (const stakeholder of targetContacts) {
      const personalVars = { 
        ...variables, 
        contact_name: stakeholder.name,
        contact_role: stakeholder.type 
      };

      // Email Dispatch
      if ((channel === 'email' || channel === 'both') && emailTemplateId && stakeholder.email) {
        dispatchPromises.push(
          sendMessage({
            templateId: emailTemplateId,
            senderProfileId: 'default',
            recipient: stakeholder.email,
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }

      // SMS Dispatch
      if ((channel === 'sms' || channel === 'both') && smsTemplateId && stakeholder.phone) {
        dispatchPromises.push(
          sendMessage({
            templateId: smsTemplateId,
            senderProfileId: 'default',
            recipient: stakeholder.phone,
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }

      // WhatsApp Dispatch (delivers to phone; opt-in via 'whatsapp' channel)
      if (channel === 'whatsapp' && whatsappTemplateId && stakeholder.phone) {
        dispatchPromises.push(
          sendMessage({
            templateId: whatsappTemplateId,
            senderProfileId: 'default',
            recipient: stakeholder.phone,
            variables: personalVars,
            entityId,
            workspaceId: resolvedWorkspaceId
          })
        );
      }
    }

    await Promise.allSettled(dispatchPromises);
    console.log(`>>> [EXTERNAL-NOTIFY] Successfully queued ${dispatchPromises.length} alerts for ${targetContacts.length} stakeholders.`);

  } catch (error: any) {
    console.error(">>> [EXTERNAL-NOTIFY] Critical Failure in External Notification Engine:", error.message);
  }
}
