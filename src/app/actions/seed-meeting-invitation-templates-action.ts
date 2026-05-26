'use server';

import { adminDb } from '@/lib/firebase-admin';
import { TEMPLATES } from '@/lib/messaging-templates-registry';

/**
 * Seeds only the meeting invitation templates (email + SMS) into Firestore.
 * These are the templates used by the Meeting Invitations page for bulk
 * invitation dispatches. Uses upsert (set) so it is safe to re-run.
 */
export async function seedMeetingInvitationTemplatesAction(): Promise<{
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}> {
  try {
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();
    let createdCount = 0;

    // Filter only meeting_invitation templates from the global registry
    const invitationTemplates = TEMPLATES.filter(
      (t) => t.templateType === 'meeting_invitation'
    );

    for (const tpl of invitationTemplates) {
      const docId = `global_${tpl.templateType}_${tpl.channel}`;
      const docRef = adminDb.collection('message_templates').doc(docId);

      const templateDoc = {
        id: docId,
        scope: 'global',
        category: tpl.category,
        channel: tpl.channel,
        target: 'external_client',
        name: tpl.name,
        contentMode: 'plain_text',
        subject: tpl.subject || '',
        body: tpl.body,
        templateType: tpl.templateType,
        recipientType: tpl.recipientType || 'external_alert',
        variableContext: tpl.variableContext || 'meeting',
        declaredVariables: tpl.declaredVariables || [],
        status: 'active',
        version: 1,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'system_seed_meeting_invitations',
      };

      batch.set(docRef, templateDoc);
      createdCount++;
    }

    await batch.commit();

    return {
      total: invitationTemplates.length,
      created: createdCount,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  } catch (error: any) {
    console.error('[SEED_MEETING_INVITATIONS] Seeding failed:', error);
    return {
      total: 0,
      created: 0,
      skipped: 0,
      failed: 1,
      errors: [{ name: 'Meeting Invitation Templates', error: error.message || 'Seeding failed' }],
    };
  }
}
