'use server';

import { adminDb } from '@/lib/firebase-admin';
import type { MessageBlock, MessageTemplate } from '@/lib/types';

export interface MigrateTemplatesResult {
  total: number;
  migrated: number;
  skipped: number;
  failed: number;
  errors: string[];
}

function replaceSchoolWithEntity(text: string): string {
  if (!text) return text;
  return text
    .replace(/school_name/g, 'entity_name')
    .replace(/school_email/g, 'entity_email')
    .replace(/school_phone/g, 'entity_phone')
    .replace(/school_location/g, 'entity_location')
    .replace(/school_initials/g, 'entity_initials')
    .replace(/school_package/g, 'entity_package');
}

function migrateBlock(block: MessageBlock): MessageBlock {
  const newBlock = { ...block };

  if (newBlock.title) {
    newBlock.title = replaceSchoolWithEntity(newBlock.title);
  }
  if (newBlock.content) {
    newBlock.content = replaceSchoolWithEntity(newBlock.content);
  }
  if (newBlock.url) {
    newBlock.url = replaceSchoolWithEntity(newBlock.url);
  }
  if (newBlock.link) {
    newBlock.link = replaceSchoolWithEntity(newBlock.link);
  }
  if (newBlock.items && Array.isArray(newBlock.items)) {
    newBlock.items = newBlock.items.map(item => replaceSchoolWithEntity(item));
  }
  if (newBlock.visibilityLogic && Array.isArray(newBlock.visibilityLogic.rules)) {
    newBlock.visibilityLogic = {
      ...newBlock.visibilityLogic,
      rules: newBlock.visibilityLogic.rules.map(rule => ({
        ...rule,
        variableKey: replaceSchoolWithEntity(rule.variableKey || ''),
      })),
    };
  }

  return newBlock;
}

export async function migrateTemplatesAction(userId: string): Promise<MigrateTemplatesResult> {
  const result: MigrateTemplatesResult = {
    total: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  try {
    // 1. Authorization Check (Must be system_admin)
    if (!userId) {
      throw new Error('Authentication required: userId is missing.');
    }

    const userSnap = await adminDb.collection('users').doc(userId).get();
    if (!userSnap.exists) {
      throw new Error(`Authorization error: User profile not found for ID ${userId}.`);
    }

    const userData = userSnap.data();
    const isSystemAdmin = userData?.permissions?.includes('system_admin');
    
    if (!isSystemAdmin) {
      throw new Error('Unauthorized access: Only system administrators can run this template migration.');
    }

    // 2. Fetch all templates
    const snapshot = await adminDb.collection('message_templates').get();
    result.total = snapshot.size;

    const batches: FirebaseFirestore.WriteBatch[] = [];
    let currentBatch = adminDb.batch();
    let opCount = 0;

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data() as MessageTemplate;
        const updates: Partial<MessageTemplate> = {};
        let hasChanges = false;

        // Migrate Top Level Text Fields
        if (data.subject && typeof data.subject === 'string') {
          const updatedSubject = replaceSchoolWithEntity(data.subject);
          if (updatedSubject !== data.subject) {
            updates.subject = updatedSubject;
            hasChanges = true;
          }
        }
        if (data.previewText && typeof data.previewText === 'string') {
          const updatedPreview = replaceSchoolWithEntity(data.previewText);
          if (updatedPreview !== data.previewText) {
            updates.previewText = updatedPreview;
            hasChanges = true;
          }
        }
        if (data.body && typeof data.body === 'string') {
          const updatedBody = replaceSchoolWithEntity(data.body);
          if (updatedBody !== data.body) {
            updates.body = updatedBody;
            hasChanges = true;
          }
        }

        // Migrate Blocks
        if (data.blocks && Array.isArray(data.blocks)) {
          const updatedBlocks = data.blocks.map((b: MessageBlock) => migrateBlock(b));
          if (JSON.stringify(updatedBlocks) !== JSON.stringify(data.blocks)) {
            updates.blocks = updatedBlocks;
            hasChanges = true;
          }
        }
        if (data.bodyBlocks && Array.isArray(data.bodyBlocks)) {
          const updatedBodyBlocks = data.bodyBlocks.map((b: MessageBlock) => migrateBlock(b));
          if (JSON.stringify(updatedBodyBlocks) !== JSON.stringify(data.bodyBlocks)) {
            updates.bodyBlocks = updatedBodyBlocks;
            hasChanges = true;
          }
        }

        // Migrate Declared Variables list
        if (data.declaredVariables && Array.isArray(data.declaredVariables)) {
          const updatedDeclared = data.declaredVariables.map((v: string) => replaceSchoolWithEntity(v));
          if (JSON.stringify(updatedDeclared) !== JSON.stringify(data.declaredVariables)) {
            updates.declaredVariables = updatedDeclared;
            hasChanges = true;
          }
        }

        // Migrate Deprecated variables list
        if (data.variables && Array.isArray(data.variables)) {
          const updatedVars = data.variables.map((v: string) => replaceSchoolWithEntity(v));
          if (JSON.stringify(updatedVars) !== JSON.stringify(data.variables)) {
            updates.variables = updatedVars;
            hasChanges = true;
          }
        }

        if (hasChanges) {
          updates.updatedAt = new Date().toISOString();
          currentBatch.update(doc.ref, updates as any);
          opCount++;
          result.migrated++;

          if (opCount >= 450) {
            batches.push(currentBatch);
            currentBatch = adminDb.batch();
            opCount = 0;
          }
        } else {
          result.skipped++;
        }
      } catch (err: any) {
        result.failed++;
        result.errors.push(`Template ID ${doc.id}: ${err.message}`);
      }
    }

    if (opCount > 0) {
      batches.push(currentBatch);
    }

    // Commit all batches in parallel
    await Promise.all(batches.map(b => b.commit()));

    return result;
  } catch (error: any) {
    console.error('[MIGRATE_TEMPLATES] Migration action failed:', error);
    return {
      total: result.total,
      migrated: result.migrated,
      skipped: result.skipped,
      failed: result.failed + (result.total - (result.migrated + result.skipped + result.failed)),
      errors: [...result.errors, error.message || 'Migration action failed.'],
    };
  }
}
