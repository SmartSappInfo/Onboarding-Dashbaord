/**
 * @fileOverview Server-only persistence for the org-scoped mirror of Meta's
 * template registry. Written exclusively by the sync action (Admin SDK);
 * clients read via firestore rules (org members) or authenticated actions.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { WhatsAppTemplate, WhatsAppTemplateStatus } from './whatsapp-types';

const COLLECTION = 'whatsapp_templates';
const BATCH_LIMIT = 400; // Firestore allows 500 writes/batch; stay under.

export class WhatsAppTemplateRepository {
  /** Upsert synced templates in chunked batches. Returns the number written. */
  static async upsertMany(templates: WhatsAppTemplate[]): Promise<number> {
    let written = 0;
    for (let i = 0; i < templates.length; i += BATCH_LIMIT) {
      const batch = adminDb.batch();
      for (const t of templates.slice(i, i + BATCH_LIMIT)) {
        batch.set(adminDb.collection(COLLECTION).doc(t.id), t, { merge: true });
        written++;
      }
      await batch.commit();
    }
    return written;
  }

  static async list(
    organizationId: string,
    opts?: { status?: WhatsAppTemplateStatus },
  ): Promise<WhatsAppTemplate[]> {
    let query = adminDb
      .collection(COLLECTION)
      .where('organizationId', '==', organizationId) as FirebaseFirestore.Query;
    if (opts?.status) query = query.where('status', '==', opts.status);
    const snap = await query.get();
    return snap.docs.map((d) => d.data() as WhatsAppTemplate);
  }

  static async get(id: string): Promise<WhatsAppTemplate | null> {
    const snap = await adminDb.collection(COLLECTION).doc(id).get();
    return snap.exists ? (snap.data() as WhatsAppTemplate) : null;
  }
}
