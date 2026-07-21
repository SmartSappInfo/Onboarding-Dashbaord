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
import { shouldAutoEnableWhatsApp } from './whatsapp-domain';
import type { WhatsAppTemplate } from './whatsapp-types';
import type { MessageTemplate } from '@/lib/types';

/**
 * Upsert the single sendable `message_templates` doc for a WhatsApp template,
 * deleting any legacy/duplicate docs for the same Meta template (different id) so
 * a template never appears twice in pickers or double-sends. Shared by manual
 * adopt and auto-enable.
 *
 * SECURITY (tenant isolation): Meta template names are only unique *within* a
 * WhatsApp Business Account, so two organizations routinely share a name such as
 * `order_update`. The duplicate lookup is therefore scoped to the owning
 * organization — without it, enabling a template in one org would delete another
 * org's template of the same name.
 */
export async function writeSendableWhatsAppDoc(template: MessageTemplate): Promise<void> {
  const { organizationId } = template;
  if (!organizationId) {
    // Refuse rather than run an unscoped, cross-tenant destructive query.
    throw new Error('[whatsapp-enable] Cannot write a sendable template without an organizationId.');
  }

  const col = adminDb.collection('message_templates');
  const dupes = await col
    .where('organizationId', '==', organizationId)
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
 * Activate the template the user authored, **in place**, once Meta approves it.
 *
 * The authored document (a "skeleton" created in the workshop and bound to Meta
 * on push) is the canonical record: it carries `workspaceIds`, `target`,
 * `createdBy` and its original id. Deleting and re-minting it on approval churned
 * the id and dropped workspace scoping, which removed the newly-live template
 * from workspace-scoped galleries and pickers. So we patch it instead.
 *
 * When no local document exists the template was authored in Meta Business
 * Manager. We deliberately do **not** mint one here: this runs server-side (sync
 * and webhook) with no workspace context, and a doc without `workspaceIds` would
 * be invisible anyway. Those surface in the gallery for a manual
 * "Enable for campaigns", which runs client-side and supplies the workspace.
 *
 * Idempotent and safe to call repeatedly. Returns whether a document was updated.
 */
export async function autoEnableApprovedWhatsAppTemplate(wa: WhatsAppTemplate): Promise<boolean> {
  if (!shouldAutoEnableWhatsApp(wa)) return false;
  if (!wa.organizationId) return false;

  const snap = await adminDb
    .collection('message_templates')
    .where('organizationId', '==', wa.organizationId)
    .where('channel', '==', 'whatsapp')
    .where('whatsappTemplateName', '==', wa.name)
    .limit(1)
    .get();

  if (snap.empty) return false;

  const doc = snap.docs[0];
  const existing = doc.data() as Partial<MessageTemplate> | undefined;
  const paramMap = wa.paramMap ?? [];

  const patch: Record<string, unknown> = {
    status: 'active',
    isActive: true, // legacy flag kept in step with `status`
    whatsappTemplateName: wa.name,
    whatsappLanguage: wa.language,
    whatsappParamMap: paramMap,
    declaredVariables: paramMap,
    updatedAt: new Date().toISOString(),
  };

  // Only fill classification the author never set — never overwrite their choice.
  if (!existing?.category) patch.category = wa.appCategory ?? 'general';
  if (!existing?.templateType) patch.templateType = wa.templateType ?? 'whatsapp';
  if (!existing?.contentMode) patch.contentMode = 'template';

  await doc.ref.update(patch);
  return true;
}
