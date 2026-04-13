import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

const BATCH_SIZE = 450;

export interface MigrationProtocolResult {
    total: number;
    succeeded: number;
    failed: number;
    skipped: number;
    errors: Array<{ id: string; error: string }>;
}

/**
 * Fetch-Enrich-Restore (FER) Protocol Engine
 * Replaces 'entityId' with 'entityId' in any collection while maintaining a 7-day backup.
 */
export async function migrateCollectionForeignKeys(
    collectionName: string, 
    userId: string
): Promise<MigrationProtocolResult> {
    console.log(`🚀 Starting FER migration for collection: ${collectionName}`);
    const timestamp = new Date().toISOString();
    const result: MigrationProtocolResult = { total: 0, succeeded: 0, failed: 0, skipped: 0, errors: [] };
    
    try {
        // FETCH: Get all records with entityId
        const targetRef = adminDb.collection(collectionName);
        const snapshot = await targetRef.where('entityId', '!=', null).get();
        result.total = snapshot.size;
        
        console.log(`📊 Found ${result.total} documents with entityId in ${collectionName}`);

        if (result.total === 0) return result;

        let batch = adminDb.batch();
        let operationCount = 0;
        
        for (const doc of snapshot.docs) {
            try {
                const data = doc.data();
                
                // If it already uses entityId primarily, skip it
                if (data.entityId && !data.entityId) {
                    result.skipped++;
                    continue;
                }
                
                const schoolId = data.schoolId;
                const entityId = data.entityId || `entity_${schoolId}`;
                
                // ENRICH: Prepare metadata
                const backupData = {
                    ...data,
                    _backupProtocolMeta: {
                        migratedAt: timestamp,
                        migratedBy: userId,
                        originalSchoolId: entityId
                    }
                };
                
                // RESTORE Step A: Create backup (7-day retention intended via lifecycle rules)
                const backupRef = adminDb.collection(`backup_migrations_${collectionName}`).doc(doc.id);
                batch.set(backupRef, backupData);
                operationCount++;
                
                // RESTORE Step B: Update primary document atomically
                // We map entityId -> entityId and remove entityId
                const updatePayload: any = {
                    entityId: entityId,
                    entityType: data.entityType || 'institution',
                    _ferMigrated: true
                };
                
                // Firestore Admin batch update with FieldValue.delete() requires building the object safely or dot notation
                // To be safe, we merge the new fields and delete the old
                batch.set(doc.ref, updatePayload, { merge: true });
                // We handle deletion in a separate command within the batch to ensure it works properly with the SDK
                
                operationCount++;

                // Optional: Deletion of legacy fields
                const deletePayload: { [key: string]: any } = {
                    ["schoolId"]: FieldValue.delete(),
                    ...(data.entityName && { ["entityName"]: FieldValue.delete() }),
                    ...(data.entitySlug && { ["entitySlug"]: FieldValue.delete() })
                };
                
                // Handle deletion
                batch.update(doc.ref, deletePayload);
                
                if (operationCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`✅ Committed batch (${result.succeeded + 1} docs processed)`);
                    batch = adminDb.batch();
                    operationCount = 0;
                }
                
                result.succeeded++;
                
            } catch (error: any) {
                console.error(`❌ Error migrating doc ${doc.id}:`, error);
                result.failed++;
                result.errors.push({ id: doc.id, error: error.message });
            }
        }
        
        if (operationCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final batch`);
        }
        
        return result;
        
    } catch (error: any) {
        console.error('💥 Fatal error during migration:', error);
        throw error;
    }
}
