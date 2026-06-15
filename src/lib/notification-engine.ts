
'use server';

import { adminDb } from './firebase-admin';
import { sendMessage } from './messaging-engine';
import { resolveContact } from './contact-adapter';
import type { School, UserProfile } from './types';

interface InternalNotificationOptions {
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
  const { entityId, specificUserIds, notifyManager, emailTemplateId, smsTemplateId, whatsappTemplateId, inAppTemplateId, pushTemplateId, variables, channel = 'both' } = options;

  console.log(`>>> [NOTIFY] Triggering Internal Notification Hub...`);

  try {
    const recipients = new Set<string>(); // Set of user IDs
    const resolvedContacts: { id: string; email?: string; phone?: string; name: string; preferences?: any }[] = [];

    // 1. Resolve Assigned Manager using adapter layer (Requirement 18)
    if (notifyManager && entityId) {
      // Use adapter to resolve contact from either schools or entities + workspace_entities
      const contact = await resolveContact(entityId, variables.workspaceId || 'onboarding');
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
      const personalVars = { ...variables, admin_name: contact.name };
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
            workspaceId: variables.workspaceId || 'onboarding'
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
            workspaceId: variables.workspaceId || 'onboarding'
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
            workspaceId: variables.workspaceId || 'onboarding'
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
            workspaceId: variables.workspaceId || 'onboarding'
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
            workspaceId: variables.workspaceId || 'onboarding'
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
    // 1. Resolve Entity Contacts using adapter layer
    const contact = await resolveContact(entityId, variables.workspaceId || 'onboarding');
    
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
            workspaceId: variables.workspaceId || 'onboarding'
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
            workspaceId: variables.workspaceId || 'onboarding'
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
            workspaceId: variables.workspaceId || 'onboarding'
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
