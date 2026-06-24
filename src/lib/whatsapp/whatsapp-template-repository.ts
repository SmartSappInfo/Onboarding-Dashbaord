/**
 * @fileOverview Server-only persistence for the org-scoped mirror of Meta's
 * template registry. Written exclusively by the sync action (Admin SDK);
 * clients read via firestore rules (org members) or authenticated actions.
 */

import { adminDb } from '@/lib/firebase-admin';
import type {
  WhatsAppTemplate,
  WhatsAppTemplateStatus,
  WhatsAppTemplateCategory,
} from './whatsapp-types';

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

  /** Fetch the merged stored doc by Meta's global template id (or null). */
  static async getByMetaTemplateId(metaTemplateId: string): Promise<WhatsAppTemplate | null> {
    const snap = await adminDb
      .collection(COLLECTION)
      .where('metaTemplateId', '==', metaTemplateId)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as WhatsAppTemplate);
  }

  /**
   * Idempotently patch a template's status/category from a Meta webhook, keyed
   * by the global `metaTemplateId`. No-op (returns false) when the template
   * isn't mirrored locally yet — a later sync will pick it up. Only defined
   * patch fields are written.
   */
  static async updateStatusByMetaId(
    metaTemplateId: string,
    patch: {
      status?: WhatsAppTemplateStatus;
      rejectedReason?: string;
      category?: WhatsAppTemplateCategory;
    },
  ): Promise<boolean> {
    const snap = await adminDb
      .collection(COLLECTION)
      .where('metaTemplateId', '==', metaTemplateId)
      .limit(1)
      .get();
    if (snap.empty) return false;

    const update: Record<string, unknown> = { syncedAt: new Date().toISOString() };
    if (patch.status) update.status = patch.status;
    if (patch.category) update.category = patch.category;
    if (patch.rejectedReason) update.rejectedReason = patch.rejectedReason;

    await snap.docs[0].ref.set(update, { merge: true });
    return true;
  }
}
