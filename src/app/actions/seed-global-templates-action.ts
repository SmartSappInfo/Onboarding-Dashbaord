'use server';

import { adminDb } from '@/lib/firebase-admin';
import { TEMPLATES } from '@/lib/messaging-templates-registry';
import { MESSAGING_TRIGGERS } from '@/lib/messaging-triggers';

export interface SeedGlobalTemplatesResult {
  total: number;
  created: number;
  skipped: number;
  failed: number;
  errors: Array<{ name: string; error: string }>;
}

export async function seedGlobalTemplatesAction(): Promise<{ total: number; created: number; skipped: number; failed: number; errors: any[] }> {
  try {
    const timestamp = new Date().toISOString();
    const batches: FirebaseFirestore.WriteBatch[] = [];
    let batch = adminDb.batch();
    let opCount = 0;
    let createdCount = 0;

    for (const tpl of TEMPLATES) {
      const docId = `global_${tpl.templateType}_${tpl.channel}`;
      const docRef = adminDb.collection('message_templates').doc(docId);
      
      const trigger = MESSAGING_TRIGGERS.find(t => t.id === tpl.templateType);

      const templateDoc = {
        id: docId,
        scope: 'global',
        category: tpl.category,
        channel: tpl.channel,
        target: trigger?.target || (tpl.recipientType === 'internal_alert' ? 'internal_team' : 'external_client'),
        name: tpl.name,
        contentMode: 'plain_text',
        subject: tpl.subject || '',
        body: tpl.body,
        templateType: tpl.templateType,
        recipientType: tpl.recipientType || trigger?.recipientType || 'external_alert',
        variableContext: tpl.variableContext || 'common',
        declaredVariables: tpl.declaredVariables || [],
        status: 'active',
        version: 1,
        isActive: true,
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: 'system_seed_v3',
        ...(tpl.reminderConfig ? { reminderConfig: tpl.reminderConfig } : {}),
      };

      batch.set(docRef, templateDoc);
      opCount++;
      createdCount++;

      if (opCount >= 450) {
        batches.push(batch);
        batch = adminDb.batch();
        opCount = 0;
      }
    }

    if (opCount > 0) {
      batches.push(batch);
    }

    for (const b of batches) {
      await b.commit();
    }

    return {
      total: TEMPLATES.length,
      created: createdCount,
      skipped: 0,
      failed: 0,
      errors: [],
    };
  } catch (error: any) {
    console.error('[SEED_TEMPLATES] Seeding failed:', error);
    return {
      total: 0,
      created: 0,
      skipped: 0,
      failed: 1,
      errors: [{ name: 'Global Messaging Blueprints', error: error.message || 'Seeding failed' }],
    };
  }
}
