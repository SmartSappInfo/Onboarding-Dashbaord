/**
 * @fileOverview WhatsApp Contact Enrichment Protocol Script
 *
 * Scans `workspace_entities` and `entities` in bounded batches (max 50 per batch),
 * inspects contact phone numbers using libphonenumber-js line-type detection,
 * and sets `hasWhatsapp = true` for contacts with mobile / mobile-capable phone numbers.
 *
 * CAUTION: Updates entityContacts inside Firestore transactions to prevent clobbering.
 * Intentionally does NOT bump `updatedAt` to prevent triggering cascade automations.
 */

import { adminDb } from '../lib/firebase-admin';
import { parsePhoneNumberFromString } from 'libphonenumber-js/max';
import type { EntityContact } from '../lib/types';

export interface WhatsAppEnrichmentStats {
  processedEntities: number;
  updatedContacts: number;
  skippedContacts: number;
  errors: number;
}

export async function runWhatsAppEnrichmentSweep(limit: number = 50): Promise<WhatsAppEnrichmentStats> {
  const stats: WhatsAppEnrichmentStats = {
    processedEntities: 0,
    updatedContacts: 0,
    skippedContacts: 0,
    errors: 0,
  };

  try {
    const snap = await adminDb.collection('entities')
      .limit(limit)
      .get();

    if (snap.empty) {
      console.log('[WhatsAppEnrichment] No entities found to process.');
      return stats;
    }

    for (const doc of snap.docs) {
      try {
        await adminDb.runTransaction(async (txn) => {
          const entityRef = doc.ref;
          const entitySnap = await txn.get(entityRef);
          if (!entitySnap.exists) return;

          const data = entitySnap.data();
          const contacts = (data?.entityContacts || []) as EntityContact[];
          if (contacts.length === 0) return;

          let updatedAny = false;
          const nextContacts = contacts.map((c) => {
            if (!c.phone) {
              stats.skippedContacts++;
              return c;
            }

            // Parse phone number to determine line type
            const parsed = parsePhoneNumberFromString(c.phone);
            const lineType = parsed?.getType();
            const isMobile = lineType === 'MOBILE' || lineType === 'FIXED_LINE_OR_MOBILE';

            if (isMobile && c.hasWhatsapp !== true) {
              updatedAny = true;
              stats.updatedContacts++;
              const phoneTypeVal = lineType === 'MOBILE' ? ('mobile' as const) : ('fixed_line_or_mobile' as const);
              return { ...c, hasWhatsapp: true, phoneType: phoneTypeVal };
            }

            stats.skippedContacts++;
            return c;
          });

          if (updatedAny) {
            // Writeback without bumping updatedAt to avoid infinite automation triggers
            txn.set(entityRef, { entityContacts: nextContacts }, { merge: true });
          }
        });

        stats.processedEntities++;
      } catch (err: unknown) {
        stats.errors++;
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[WhatsAppEnrichment] Error processing entity ${doc.id}:`, errorMessage);
      }
    }

    console.log(`[WhatsAppEnrichment] Sweep complete. Processed ${stats.processedEntities} entities, updated ${stats.updatedContacts} contacts.`);
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[WhatsAppEnrichment] Fatal error during sweep execution:', errorMessage);
  }

  return stats;
}
