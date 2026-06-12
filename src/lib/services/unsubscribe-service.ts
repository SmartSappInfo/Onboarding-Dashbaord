import { createHmac, timingSafeEqual } from 'crypto';
import { adminDb } from '../firebase-admin';
import { suppressRecipient, removeSuppression } from '../suppression-service';

// Retrieve secure secret key for token signing
const getSecretKey = (): string => {
  const secret = process.env.UNSUBSCRIBE_SECRET_KEY || process.env.NEXTAUTH_SECRET || 'fallback_unsubscribe_secret_key_change_me_in_prod';
  return secret;
};

/**
 * Generates a cryptographically secure HMAC token for unsubscription.
 */
export function generateUnsubscribeToken(recipient: string): string {
  return createHmac('sha256', getSecretKey())
    .update(recipient.toLowerCase().trim())
    .digest('hex');
}

/**
 * Verifies if the provided unsubscription token matches the recipient.
 */
export function verifyUnsubscribeToken(recipient: string, token: string): boolean {
  if (!recipient || !token) return false;
  const expected = generateUnsubscribeToken(recipient);
  
  try {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const tokenBuffer = Buffer.from(token, 'hex');
    
    if (expectedBuffer.length !== tokenBuffer.length) {
      return false;
    }
    
    return timingSafeEqual(expectedBuffer, tokenBuffer);
  } catch {
    return false;
  }
}

/**
 * Generates the secure unsubscribe link for emails.
 */
export async function generateSecureUnsubscribeLink(
  recipient: string,
  entityId?: string | null,
  workspaceId?: string | null
): Promise<string> {
  const { getRequestBaseUrl } = await import('../utils/url-helpers');
  const baseUrl = await getRequestBaseUrl();
  const token = generateUnsubscribeToken(recipient);
  
  const params = new URLSearchParams({
    token,
    recipient: recipient.toLowerCase().trim(),
  });
  
  if (entityId) params.append('entityId', entityId);
  if (workspaceId) params.append('ws', workspaceId);
  
  return `${baseUrl}/preferences/${encodeURIComponent(recipient)}?${params.toString()}`;
}

interface UnsubscribePreferences {
  emailStatus: 'valid' | 'bounced' | 'unsubscribed' | 'complained' | 'snoozed' | 'opt-down';
  unsubscribedCategories?: string[];
  snoozedUntil?: string; // ISO String
  optDownFrequency?: 'weekly' | 'monthly' | 'default';
  entityId?: string;
  workspaceId?: string;
}

/**
 * Processes unsubscription preferences, updating suppression list and entity contact statuses.
 */
export async function processUnsubscribe(
  recipient: string,
  preferences: UnsubscribePreferences
): Promise<void> {
  const cleanRecipient = recipient.toLowerCase().trim();
  const timestamp = new Date().toISOString();
  
  // 1. Update suppression list (suppressions collection)
  // If unsubscribe or opt-down/snooze, we add suppression. If unsubscribed/snoozed/opt-down we treat as suppressed.
  // If status is 'valid', we remove suppression.
  const workspaceId = preferences.workspaceId || 'global';
  
  if (preferences.emailStatus === 'valid') {
    await removeSuppression(cleanRecipient, workspaceId);
  } else {
    // Add suppression
    await suppressRecipient({
      recipient: cleanRecipient,
      workspaceId,
      channel: 'email',
      reason: preferences.emailStatus,
      entityId: preferences.entityId || undefined,
      snoozedUntil: preferences.snoozedUntil || undefined,
    });
  }

  // 2. Identify the target entity
  let entityId = preferences.entityId;
  
  if (!entityId) {
    // Attempt to locate the entity by searching entities where contact email matches
    try {
      const entitiesSnap = await adminDb.collection('entities').get();
      for (const doc of entitiesSnap.docs) {
        const data = doc.data();
        const contacts = data.entityContacts || [];
        const hasMatch = contacts.some(
          (c: any) => c.email?.toLowerCase().trim() === cleanRecipient
        );
        if (hasMatch) {
          entityId = doc.id;
          break;
        }
      }
    } catch (e) {
      console.error('[UNSUBSCRIBE-SERVICE] Error scanning entities for email:', e);
    }
  }

  if (!entityId) {
    console.warn(`[UNSUBSCRIBE-SERVICE] No entity found for recipient: ${cleanRecipient}. Suppression list updated but contact status sync skipped.`);
    return;
  }

  // 3. Batch transaction to update root Entity and Workspace Entities
  const entityRef = adminDb.collection('entities').doc(entityId);
  
  await adminDb.runTransaction(async (transaction) => {
    const entitySnap = await transaction.get(entityRef);
    if (!entitySnap.exists) {
      console.warn(`[UNSUBSCRIBE-SERVICE] Entity ${entityId} does not exist in transaction.`);
      return;
    }

    const entityData = entitySnap.data() || {};
    const entityContacts = entityData.entityContacts || [];
    
    // Update matching contact status inside the array
    let updatedAny = false;
    const updatedContacts = entityContacts.map((c: any) => {
      if (c.email?.toLowerCase().trim() === cleanRecipient) {
        updatedAny = true;
        return {
          ...c,
          emailStatus: preferences.emailStatus,
          unsubscribedAt: preferences.emailStatus === 'unsubscribed' ? timestamp : c.unsubscribedAt || null,
          unsubscribedCategories: preferences.unsubscribedCategories || null,
          snoozedUntil: preferences.snoozedUntil || null,
          optDownFrequency: preferences.optDownFrequency || null,
          updatedAt: timestamp,
        };
      }
      return c;
    });

    if (!updatedAny) {
      console.warn(`[UNSUBSCRIBE-SERVICE] Contact with email ${cleanRecipient} not found in entity ${entityId}.`);
      return;
    }

    // Write entity update
    transaction.update(entityRef, {
      entityContacts: updatedContacts,
      updatedAt: timestamp,
    });

    // Sync to workspace_entities
    const weQuery = adminDb.collection('workspace_entities')
      .where('entityId', '==', entityId);
    
    const weSnap = await weQuery.get();
    weSnap.docs.forEach((weDoc) => {
      transaction.update(weDoc.ref, {
        entityContacts: updatedContacts,
        updatedAt: timestamp,
      });
    });
  });

  console.log(`[UNSUBSCRIBE-SERVICE] Successfully updated unsubscription status for ${cleanRecipient} to ${preferences.emailStatus}`);
}
