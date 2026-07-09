'use server';

import { decryptToken } from '@/lib/crypto';
import { adminDb } from '@/lib/firebase-admin';

interface DecryptResult {
  success: boolean;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  error?: string;
}

export async function decryptRecipientAction(token: string): Promise<DecryptResult> {
  try {
    const contactId = decryptToken(token);
    if (!contactId) {
      return { success: false, error: 'Decryption yielded empty identifier.' };
    }

    // Pre-fetch basic display names to assist landing page greeting
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
