#!/usr/bin/env tsx
import { adminDb } from '../src/lib/firebase-admin';
import type { Entity } from '../src/lib/types';

/**
 * Migration Script: Lead Scores Synchronization & Backfill
 * 
 * Run using:
 *   npx tsx scripts/migrate-lead-scores.ts
 */
async function runMigration(): Promise<void> {
  console.log('[Migration] Starting Lead Scores Backfill...');
  
  try {
    const entitiesRef = adminDb.collection('entities');
    const entitiesSnap = await entitiesRef.get();
    
    if (entitiesSnap.empty) {
      console.log('[Migration] No entities found. Migration complete.');
      return;
    }

    console.log(`[Migration] Processing ${entitiesSnap.size} entities...`);
    let updatedEntitiesCount = 0;
    let batch = adminDb.batch();
    let operationCount = 0;

    for (const entityDoc of entitiesSnap.docs) {
      const entityData = entityDoc.data() as Entity;
      const contacts = entityData.entityContacts || [];
      
      // Calculate overall lead score as sum of individual contact scores
      const calculatedLeadScore = contacts.reduce((sum, c) => sum + (c.score || 0), 0);
      const existingLeadScore = entityData.leadScore ?? 0;

      if (existingLeadScore !== calculatedLeadScore || entityData.leadScore === undefined) {
        console.log(`[Migration] Entity ${entityDoc.id} score mismatch. Existing: ${existingLeadScore}, Calculated: ${calculatedLeadScore}`);
        
        // 1. Queue Entity Update
        batch.update(entitiesRef.doc(entityDoc.id), {
          leadScore: calculatedLeadScore,
          updatedAt: new Date().toISOString()
        });
        operationCount++;

        // 2. Queue corresponding WorkspaceEntity updates
        const weRef = adminDb.collection('workspace_entities');
        const weSnap = await weRef.where('entityId', '==', entityDoc.id).get();
        
        weSnap.forEach((weDoc) => {
          batch.update(weRef.doc(weDoc.id), {
            leadScore: calculatedLeadScore,
            entityContacts: contacts,
            updatedAt: new Date().toISOString()
          });
          operationCount++;
        });

        updatedEntitiesCount++;

        // Firestore batch limits: max 500 writes
        if (operationCount >= 400) {
          console.log(`[Migration] Committing batch of ${operationCount} updates...`);
          await batch.commit();
          batch = adminDb.batch();
          operationCount = 0;
        }
      }
    }

    if (operationCount > 0) {
      console.log(`[Migration] Committing final batch of ${operationCount} updates...`);
      await batch.commit();
    }

    console.log(`[Migration] Migration complete. Synchronized ${updatedEntitiesCount} entities.`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown migration error';
    console.error('[Migration] Failed:', msg);
    process.exit(1);
  }
}

runMigration().catch(err => {
  console.error('[Migration] Unhandled execution error:', err);
  process.exit(1);
});
