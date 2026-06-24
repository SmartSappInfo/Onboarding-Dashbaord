/**
 * @fileOverview Server-only effects for turning an approved WhatsApp template
 * into a selectable/sendable `message_templates` doc.
 *
 * NOT a `'use server'` module — these are plain server utilities (they touch
 * `adminDb`) imported by the WhatsApp actions AND the webhook route. Keeping them
 * out of the `'use server'` actions file avoids exposing them as client-callable
 * server actions (they take a trusted `WhatsAppTemplate` and must not be
 * reachable from the browser).
 */
import { adminDb } from '@/lib/firebase-admin';
import {
  buildAdoptedWhatsAppMessageTemplate,
  shouldAutoEnableWhatsApp,
} from './whatsapp-domain';
import type { WhatsAppTemplate } from './whatsapp-types';
import type { MessageTemplate } from '@/lib/types';

/**
 * Upsert the single sendable `message_templates` doc for a WhatsApp template,
 * deleting any legacy/duplicate docs for the same Meta template (different id) so
 * a template never appears twice in pickers or double-sends. Shared by manual
 * adopt and auto-enable.
 */
export async function writeSendableWhatsAppDoc(template: MessageTemplate): Promise<void> {
  const col = adminDb.collection('message_templates');
  const dupes = await col
    .where('channel', '==', 'whatsapp')
    .where('whatsappTemplateName', '==', template.whatsappTemplateName)
    .get();
  const batch = adminDb.batch();
  for (const d of dupes.docs) {
    if (d.id !== template.id) batch.delete(d.ref);
  }
  batch.set(col.doc(template.id), template, { merge: true });
  await batch.commit();
}

/**
 * Create/refresh the sendable doc for an approved template, if eligible
 * ({@link shouldAutoEnableWhatsApp}). Idempotent. Returns whether a doc was
 * written. Safe to call from sync and the status webhook.
 */
export async function autoEnableApprovedWhatsAppTemplate(wa: WhatsAppTemplate): Promise<boolean> {
  if (!shouldAutoEnableWhatsApp(wa)) return false;
  const template = buildAdoptedWhatsAppMessageTemplate(wa, {
    paramMap: wa.paramMap ?? [],
    appCategory: wa.appCategory,
    templateType: wa.templateType,
  });
  await writeSendableWhatsAppDoc(template);
  return true;
}
