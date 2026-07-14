'use server';

import { decryptToken } from '@/lib/crypto';
import { adminDb } from '@/lib/firebase-admin';
import type { EntityContact } from '@/lib/types';

interface DecryptResult {
  success: boolean;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  error?: string;
}

export async function decryptRecipientAction(token: string): Promise<DecryptResult> {
  try {
    const decrypted = decryptToken(token);
    if (!decrypted) {
      return { success: false, error: 'Decryption yielded empty identifier.' };
    }

    const [contactId, entityId] = decrypted.split(':');

    if (entityId) {
      try {
        const weSnap = await adminDb.collection('workspace_entities')
          .where('entityId', '==', entityId)
          .limit(1)
          .get();
        if (!weSnap.empty) {
          const data = weSnap.docs[0].data() || {};
          const contacts = (data.entityContacts || []) as EntityContact[];
          const found = contacts.find(c => c.id === contactId);
          if (found) {
            const contactName = found.name || '';
            const contactEmail = found.email || '';
            return { success: true, contactId, contactName, contactEmail };
          }
        }
      } catch (weErr) {
        console.warn('[RECIPIENT-TRACKING] Workspace entity lookup failed:', weErr);
      }
    }

    // Pre-fetch basic display names to assist landing page greeting (fallback lookup)
    const contactSnap = await adminDb.collection('contacts').doc(contactId).get();
    if (contactSnap.exists) {
      const data = contactSnap.data() || {};
      const contactName = String(data.displayName || data.name || [data.firstName, data.lastName].filter(Boolean).join(' ') || '');
      const contactEmail = String(data.email || '');
      return { success: true, contactId, contactName, contactEmail };
    }

    return { success: true, contactId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[RECIPIENT-TRACKING] Decryption action failed:', msg);
    return { success: false, error: msg };
  }
}
