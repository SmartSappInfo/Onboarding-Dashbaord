'use server';

import { adminDb } from '@/lib/firebase-admin';

/**
 * Seeds and updates all global and workspace blueprints (message templates)
 * to use the default template style, executing a Fetch-Enrich-Restore (FER) protocol.
 */
export async function seedDefaultStyleBlueprintsAction(): Promise<{
  success: boolean;
  totalProcessed: number;
  updatedCount: number;
  errors: Array<{ name: string; error: string }>;
}> {
  try {
    const timestamp = new Date().toISOString();
    
    // Step 1: Fetch all blueprints currently in the system
    const templatesSnapshot = await adminDb.collection('message_templates').get();
    
    let totalProcessed = 0;
    let updatedCount = 0;
    let currentBatch = adminDb.batch();
    let currentBatchCount = 0;
    
    for (const doc of templatesSnapshot.docs) {
      const data = doc.data();
      totalProcessed++;
      
      // We only apply/reconcile styleId to 'default' if it's not already 'default' (or empty/none but we want default wrapper coverage)
      if (data.styleId !== 'default') {
        currentBatch.update(doc.ref, {
          styleId: 'default',
          updatedAt: timestamp,
          updatedBy: 'system_default_style_fer_protocol'
        });
        currentBatchCount++;
        updatedCount++;

        // Commit and reset batch if limit reached (500 is firestore limit)
        if (currentBatchCount === 450) {
          await currentBatch.commit();
          currentBatch = adminDb.batch();
          currentBatchCount = 0;
        }
      }
    }
    
    if (currentBatchCount > 0) {
      await currentBatch.commit();
    }
    
    return {
      success: true,
      totalProcessed,
      updatedCount,
      errors: []
    };
  } catch (error: any) {
    console.error('[SEED_DEFAULT_STYLE_BLUEPRINTS] FER Seeding failed:', error);
    return {
      success: false,
      totalProcessed: 0,
      updatedCount: 0,
      errors: [{ name: 'Default Style Seeding Failure', error: error.message || 'Unknown error' }]
    };
  }
}
