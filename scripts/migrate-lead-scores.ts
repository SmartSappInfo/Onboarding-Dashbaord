#!/usr/bin/env tsx
import { adminDb } from '../src/lib/firebase-admin';
import type { Entity } from '../src/lib/types';

/**
 * Migration Script: Lead Scores Synchronization & Backfill (Fully Parallelized)
 * 
 * Run using:
 *   FIREBASE_SERVICE_ACCOUNT_PATH=serviceAccountKey.json npx tsx scripts/migrate-lead-scores.ts
 */
async function runMigration(): Promise<void> {
  console.log('[Migration] Starting Lead Scores Backfill...');
  
  try {
    const totalCountSnap = await adminDb.collection('entities').count().get();
    const totalRecords = totalCountSnap.data().count;
    console.log(`[Migration] Total entities to scan: ${totalRecords}`);

    const entitiesRef = adminDb.collection('entities');
    const batchSize = 250;
    let processedCount = 0;
    let updatedEntitiesCount = 0;
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot<FirebaseFirestore.DocumentData> | null = null;
    
    let batch = adminDb.batch();
    let operationCount = 0;

    while (processedCount < totalRecords) {
      let query = entitiesRef.orderBy('__name__').limit(batchSize);
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      const snap = await query.get();
      if (snap.empty) {
        break;
      }

      // 1. Identify which entities in this batch require updates
      const candidates = snap.docs.map(entityDoc => {
        const entityData = entityDoc.data() as Entity;
        const contacts = entityData.entityContacts || [];
        const calculatedLeadScore = contacts.reduce((sum, c) => sum + (c.score || 0), 0);
        const existingLeadScore = entityData.leadScore ?? 0;
        
        const needUpdate = existingLeadScore !== calculatedLeadScore || entityData.leadScore === undefined;
        return { entityDoc, calculatedLeadScore, contacts, needUpdate };
      }).filter(c => c.needUpdate);

      if (candidates.length > 0) {
        console.log(`[Migration] Found ${candidates.length} mismatch candidates in current batch. Querying workspace entities in parallel...`);
        
        // 2. Fetch all corresponding workspace_entities documents in parallel (eliminating waterfalls)
        const weQueries = candidates.map(async (c) => {
          const weSnap = await adminDb.collection('workspace_entities').where('entityId', '==', c.entityDoc.id).get();
          return { candidate: c, weSnap };
        });
        
        const weResults = await Promise.all(weQueries);
        
        // 3. Stage updates inside the batch
        for (const { candidate, weSnap } of weResults) {
          batch.update(entitiesRef.doc(candidate.entityDoc.id), {
            leadScore: candidate.calculatedLeadScore,
            updatedAt: new Date().toISOString()
          });
          operationCount++;

          weSnap.forEach((weDoc) => {
            batch.update(adminDb.collection('workspace_entities').doc(weDoc.id), {
              leadScore: candidate.calculatedLeadScore,
              entityContacts: candidate.contacts,
              updatedAt: new Date().toISOString()
            });
            operationCount++;
          });

          updatedEntitiesCount++;

          if (operationCount >= 400) {
            console.log(`[Migration] Committing transaction batch containing ${operationCount} updates...`);
            await batch.commit();
            batch = adminDb.batch();
            operationCount = 0;
          }
        }
      }

      processedCount += snap.size;
      lastDoc = snap.docs[snap.docs.length - 1];
      console.log(`[Migration] Processed ${processedCount} / ${totalRecords} entities...`);
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
