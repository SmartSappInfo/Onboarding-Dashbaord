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

export async function seedGlobalTemplatesAction(): Promise<SeedGlobalTemplatesResult> {
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

      const isEmail = tpl.channel === 'email';
      const blocks = isEmail ? [
          {
              id: `block_head_${docId}`,
              type: 'heading',
              title: tpl.subject || tpl.name,
              variant: 'h2' as const,
              style: { textAlign: 'center', fontWeight: 'bold', marginTop: '16px', marginBottom: '16px' }
          },
          {
              id: `block_body_${docId}`,
              type: 'text',
              content: tpl.body,
              style: { textAlign: 'left', lineHeight: '1.6', marginTop: '8px', marginBottom: '16px' }
          }
      ] : undefined;

      const templateDoc = {
        id: docId,
        scope: 'global',
        category: tpl.category,
        channel: tpl.channel,
        target: trigger?.target || (tpl.recipientType === 'internal_alert' ? 'internal_team' : 'external_client'),
        name: tpl.name,
        contentMode: isEmail ? 'rich_builder' : 'plain_text',
        subject: tpl.subject || '',
        body: isEmail ? '' : tpl.body,
        ...(blocks ? { blocks } : {}),
        styleId: 'default',
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
  } catch (error: unknown) {
    console.error('[SEED_TEMPLATES] Seeding failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Seeding failed';
    return {
      total: 0,
      created: 0,
      skipped: 0,
      failed: 1,
      errors: [{ name: 'Global Messaging Blueprints', error: errorMessage }],
    };
  }
}
