import { adminDb } from './firebase-admin';

const BATCH_SIZE = 450;

export interface RollbackProtocolResult {
    total: number;
    succeeded: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
}

/**
 * Rollback Engine
 * Uses the backup collections created during the FER protocol to restore legacy state.
 */
export async function rollbackCollectionForeignKeys(
    collectionName: string
): Promise<RollbackProtocolResult> {
    console.log(`🔄 Starting ROLLBACK for collection: ${collectionName}`);
    const result: RollbackProtocolResult = { total: 0, succeeded: 0, failed: 0, errors: [] };
    
    try {
        // FETCH: Get all backups
        const backupRef = adminDb.collection(`backup_migrations_${collectionName}`);
        const snapshot = await backupRef.get();
        result.total = snapshot.size;
        
        console.log(`📊 Found ${result.total} backups to restore for ${collectionName}`);

        if (result.total === 0) return result;

        let batch = adminDb.batch();
        let operationCount = 0;
        
        for (const doc of snapshot.docs) {
            try {
                const { _backupProtocolMeta, ...originalData } = doc.data() as any;
                
                // RESTORE: Original Document
                const targetDocRef = adminDb.collection(collectionName).doc(doc.id);
                // We overwrite with original data to ensure exact parity
                batch.set(targetDocRef, originalData);
                operationCount++;
                
                // CLEANUP: Delete Backup Document
                batch.delete(doc.ref);
                operationCount++;
                
                if (operationCount >= BATCH_SIZE) {
                    await batch.commit();
                    console.log(`✅ Committed rollback batch (${result.succeeded + 1} docs processed)`);
                    batch = adminDb.batch();
                    operationCount = 0;
                }
                
                result.succeeded++;
                
            } catch (error: any) {
                console.error(`❌ Error rolling back doc ${doc.id}:`, error);
                result.failed++;
                result.errors.push({ id: doc.id, error: error.message });
            }
        }
        
        if (operationCount > 0) {
            await batch.commit();
            console.log(`✅ Committed final rollback batch`);
        }
        
        return result;
        
    } catch (error: any) {
        console.error('💥 Fatal error during rollback:', error);
        throw error;
    }
}
