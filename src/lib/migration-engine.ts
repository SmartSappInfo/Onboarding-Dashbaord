/**
 * Migration Engine for SchoolId to EntityId Migration
 * 
 * This file implements the core migration engine that handles the fetch-enrich-restore
 * protocol for migrating feature collections from schoolId to entityId references.
 * 
 * Requirements: 18.1, 19.1, 19.2, 19.7, 20.1, 21.2
 */

'use client';

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  setDoc,
  writeBatch,
  type Firestore,
  type DocumentData,
  deleteDoc,
  QuerySnapshot
} from 'firebase/firestore';

import type {
  MigrationBatch,
  EnrichedRecord,
  EnrichedBatch,
  MigrationResult,
  VerificationResult,
  FetchResult,
  RollbackResult,
  ValidationError,
  EntityType
} from './migration-types';

/**
 * Batch size for Firestore operations (450 to stay under 500 limit)
 */
const BATCH_SIZE = 450;

/**
 * Maximum number of sample records to return in fetch operation
 */
const SAMPLE_SIZE = 5;

/**
 * Migration Engine Interface
 * 
 * Provides methods for migrating feature collections from schoolId to entityId
 */
export interface MigrationEngine {
  /**
   * Fetch records that need migration (have schoolId but no entityId)
   * Requirement: 18.1
   */
  fetch(collection: string): Promise<FetchResult>;

  /**
   * Enrich records by resolving entityId from schoolId
   * Requirement: 19.1, 19.2
   */
  enrich(batch: MigrationBatch): Promise<EnrichedBatch>;

  /**
   * Restore enriched records to Firestore with backups
   * Requirement: 19.7
   */
  restore(batch: EnrichedBatch): Promise<MigrationResult>;

  /**
   * Verify migration completeness and data integrity
   * Requirement: 20.1
   */
  verify(collection: string): Promise<VerificationResult>;

  /**
   * Rollback migration by restoring from backups
   * Requirement: 21.2
   */
  rollback(collection: string): Promise<RollbackResult>;
}

/**
 * Implementation of the Migration Engine
 */
export class MigrationEngineImpl implements MigrationEngine {
  constructor(private firestore: Firestore) {}

  /**
   * Fetch records needing migration
   * Identifies all records with schoolId but no entityId
   * 
   * Requirement: 18.1 - Query records where schoolId exists and entityId is null
   */
  async fetch(collectionName: string): Promise<FetchResult> {
    try {
      const collectionRef = collection(this.firestore, collectionName);
      
      // Get all records in the collection
      const allRecordsSnapshot = await getDocs(collectionRef);
      const totalRecords = allRecordsSnapshot.size;

      // Filter records that need migration (have schoolId but no entityId)
      const recordsToMigrate: DocumentData[] = [];
      const invalidRecords: Array<{ id: string; reason: string }> = [];

      allRecordsSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const id = docSnapshot.id;

        // Check if record needs migration
        if (data.schoolId && !data.entityId) {
          recordsToMigrate.push({ id, ...data });
        } else if (!data.schoolId && !data.entityId) {
          // Record has neither identifier - invalid
          invalidRecords.push({
            id,
            reason: 'Missing both schoolId and entityId'
          });
        }
      });

      // Get sample records (first 5)
      const sampleRecords = recordsToMigrate.slice(0, SAMPLE_SIZE);

      return {
        collection: collectionName,
        totalRecords,
        recordsToMigrate: recordsToMigrate.length,
        sampleRecords,
        invalidRecords
      };
    } catch (error) {
      throw new Error(`Fetch operation failed for ${collectionName}: ${error}`);
    }
  }

  /**
   * Enrich records by resolving entityId from schoolId
   * 
   * Requirement: 19.1 - Fetch all records with schoolId but no entityId
   * Requirement: 19.2 - Resolve entityId by querying schools collection
   */
  async enrich(batch: MigrationBatch): Promise<EnrichedBatch> {
    const enrichedRecords: EnrichedRecord[] = [];

    for (const record of batch.records) {
      try {
        // Query the schools collection for this schoolId
        const schoolRef = doc(this.firestore, 'schools', record.schoolId);
        const schoolSnapshot = await getDoc(schoolRef);

        if (!schoolSnapshot.exists()) {
          throw new Error(`School ${record.schoolId} not found`);
        }

        const schoolData = schoolSnapshot.data();
        let entityId: string;
        let entityType: EntityType = 'institution'; // Default type

        // Check if school has been migrated
        if (schoolData.migrationStatus === 'migrated' && schoolData.entityId) {
          // Use existing entityId from migrated school
          entityId = schoolData.entityId;
        } else {
          // Generate entityId for non-migrated school
          entityId = `entity_${record.schoolId}`;
        }

        // Determine entity type from school data if available
        if (schoolData.entityType) {
          entityType = schoolData.entityType as EntityType;
        }

        enrichedRecords.push({
          id: record.id,
          original: record,
          enriched: {
            entityId,
            entityType
          }
        });
      } catch (error) {
        // Log error but continue processing
        console.error(`Failed to enrich record ${record.id}:`, error);
        throw error; // Re-throw to be caught by restore operation
      }
    }

    return {
      collection: batch.collection,
      records: enrichedRecords,
      backupCollection: `backup_${batch.collection}_entity_migration`
    };
  }

  /**
   * Restore enriched records to Firestore with backups
   * 
   * Requirement: 19.7 - Process in batches of 450 records
   */
  async restore(enrichedBatch: EnrichedBatch): Promise<MigrationResult> {
    const result: MigrationResult = {
      total: enrichedBatch.records.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Process records in batches to avoid Firestore limits
    const batches = this.chunkArray(enrichedBatch.records, BATCH_SIZE);

    for (let i = 0; i < batches.length; i++) {
      const batchRecords = batches[i];
      const firestoreBatch = writeBatch(this.firestore);

      for (const enrichedRecord of batchRecords) {
        try {
          // Check if already migrated (idempotency)
          if (enrichedRecord.original.entityId) {
            result.skipped++;
            continue;
          }

          // Create backup before updating
          const backupRef = doc(
            this.firestore,
            enrichedBatch.backupCollection,
            enrichedRecord.id
          );
          firestoreBatch.set(backupRef, {
            ...enrichedRecord.original,
            backedUpAt: new Date().toISOString()
          });

          // Update original record with entityId and entityType
          const recordRef = doc(
            this.firestore,
            enrichedBatch.collection,
            enrichedRecord.id
          );
          firestoreBatch.update(recordRef, {
            entityId: enrichedRecord.enriched.entityId,
            entityType: enrichedRecord.enriched.entityType,
            updatedAt: new Date().toISOString()
          });

          result.succeeded++;
        } catch (error) {
          result.failed++;
          result.errors.push({
            id: enrichedRecord.id,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Commit the batch
      try {
        await firestoreBatch.commit();
      } catch (error) {
        // If batch commit fails, mark all records in batch as failed
        for (const enrichedRecord of batchRecords) {
          if (!enrichedRecord.original.entityId) {
            result.failed++;
            result.succeeded = Math.max(0, result.succeeded - 1);
            result.errors.push({
              id: enrichedRecord.id,
              error: `Batch commit failed: ${error}`
            });
          }
        }
      }
    }

    return result;
  }

  /**
   * Verify migration completeness and data integrity
   * 
   * Requirement: 20.1 - Count migrated, unmigrated, and orphaned records
   */
  async verify(collectionName: string): Promise<VerificationResult> {
    try {
      const collectionRef = collection(this.firestore, collectionName);
      const snapshot = await getDocs(collectionRef);

      let migratedRecords = 0;
      let unmigratedRecords = 0;
      let orphanedRecords = 0;
      const validationErrors: ValidationError[] = [];

      // Check each record
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        const id = docSnapshot.id;

        if (data.entityId) {
          migratedRecords++;

          // Validate entityId is not empty
          if (!data.entityId || data.entityId.trim() === '') {
            validationErrors.push({
              recordId: id,
              field: 'entityId',
              issue: 'Empty entityId value'
            });
          }

          // Validate entityType is present and valid
          if (!data.entityType) {
            validationErrors.push({
              recordId: id,
              field: 'entityType',
              issue: 'Missing entityType'
            });
          } else if (!['institution', 'family', 'person'].includes(data.entityType)) {
            validationErrors.push({
              recordId: id,
              field: 'entityType',
              issue: `Invalid entityType: ${data.entityType}`
            });
          }

          // Check if entity exists (orphaned check)
          try {
            const entityRef = doc(this.firestore, 'entities', data.entityId);
            const entitySnapshot = await getDoc(entityRef);
            if (!entitySnapshot.exists()) {
              orphanedRecords++;
              validationErrors.push({
                recordId: id,
                field: 'entityId',
                issue: `Entity ${data.entityId} does not exist`
              });
            }
          } catch (error) {
            validationErrors.push({
              recordId: id,
              field: 'entityId',
              issue: `Failed to verify entity existence: ${error}`
            });
          }
        } else if (data.schoolId) {
          unmigratedRecords++;
        }
      }

      return {
        collection: collectionName,
        totalRecords: snapshot.size,
        migratedRecords,
        unmigratedRecords,
        orphanedRecords,
        validationErrors
      };
    } catch (error) {
      throw new Error(`Verification failed for ${collectionName}: ${error}`);
    }
  }

  /**
   * Rollback migration by restoring from backups
   * 
   * Requirement: 21.2 - Restore records from backup collection
   */
  async rollback(collectionName: string): Promise<RollbackResult> {
    const result: RollbackResult = {
      collection: collectionName,
      totalRestored: 0,
      failed: 0,
      errors: []
    };

    try {
      const backupCollectionName = `backup_${collectionName}_entity_migration`;
      const backupCollectionRef = collection(this.firestore, backupCollectionName);
      const backupSnapshot = await getDocs(backupCollectionRef);

      if (backupSnapshot.empty) {
        return result; // No backups to restore
      }

      // Process backups in batches
      const backupDocs = backupSnapshot.docs;
      const batches = this.chunkArray(backupDocs, BATCH_SIZE);

      for (const batchDocs of batches) {
        const firestoreBatch = writeBatch(this.firestore);

        for (const backupDoc of batchDocs) {
          try {
            const backupData = backupDoc.data();
            const { backedUpAt, ...originalData } = backupData;

            // Restore original record (remove entityId and entityType)
            const recordRef = doc(this.firestore, collectionName, backupDoc.id);
            const { entityId, entityType, ...restoredData } = originalData;
            
            firestoreBatch.set(recordRef, {
              ...restoredData,
              updatedAt: new Date().toISOString()
            });

            result.totalRestored++;
          } catch (error) {
            result.failed++;
            result.errors.push({
              id: backupDoc.id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }

        // Commit the batch
        try {
          await firestoreBatch.commit();
        } catch (error) {
          // If batch commit fails, mark all records in batch as failed
          for (const backupDoc of batchDocs) {
            result.failed++;
            result.totalRestored = Math.max(0, result.totalRestored - 1);
            result.errors.push({
              id: backupDoc.id,
              error: `Batch commit failed: ${error}`
            });
          }
        }
      }

      // Delete backup collection after successful rollback
      if (result.failed === 0) {
        await this.deleteBackupCollection(backupCollectionName);
      }

      return result;
    } catch (error) {
      throw new Error(`Rollback failed for ${collectionName}: ${error}`);
    }
  }

  /**
   * Delete backup collection after successful rollback
   */
  private async deleteBackupCollection(backupCollectionName: string): Promise<void> {
    try {
      const backupCollectionRef = collection(this.firestore, backupCollectionName);
      const snapshot = await getDocs(backupCollectionRef);

      // Delete in batches
      const batches = this.chunkArray(snapshot.docs, BATCH_SIZE);

      for (const batchDocs of batches) {
        const firestoreBatch = writeBatch(this.firestore);

        for (const doc of batchDocs) {
          firestoreBatch.delete(doc.ref);
        }

        await firestoreBatch.commit();
      }
    } catch (error) {
      console.error(`Failed to delete backup collection ${backupCollectionName}:`, error);
      // Don't throw - backup deletion failure shouldn't fail the rollback
    }
  }

  /**
   * Utility function to chunk array into smaller batches
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

/**
 * Factory function to create a migration engine instance
 */
export function createMigrationEngine(firestore: Firestore): MigrationEngine {
  return new MigrationEngineImpl(firestore);
}

/**
 * Convenience function to migrate a collection end-to-end
 * Combines fetch, enrich, and restore operations
 */
export async function migrateCollection(
  firestore: Firestore,
  collectionName: string
): Promise<MigrationResult> {
  const engine = createMigrationEngine(firestore);

  // Fetch unmigrated records
  const fetchResult = await engine.fetch(collectionName);

  if (fetchResult.recordsToMigrate === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      skipped: fetchResult.totalRecords,
      errors: []
    };
  }

  // Process in batches
  const allRecords = await getAllUnmigratedRecords(firestore, collectionName);
  const batches = chunkArray(allRecords, BATCH_SIZE);

  const aggregatedResult: MigrationResult = {
    total: allRecords.length,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (let i = 0; i < batches.length; i++) {
    const batch: MigrationBatch = {
      collection: collectionName,
      records: batches[i],
      batchSize: BATCH_SIZE,
      totalBatches: batches.length,
      currentBatch: i + 1
    };

    try {
      // Enrich batch
      const enrichedBatch = await engine.enrich(batch);

      // Restore batch
      const batchResult = await engine.restore(enrichedBatch);

      // Aggregate results
      aggregatedResult.succeeded += batchResult.succeeded;
      aggregatedResult.failed += batchResult.failed;
      aggregatedResult.skipped += batchResult.skipped;
      aggregatedResult.errors.push(...batchResult.errors);
    } catch (error) {
      // Mark entire batch as failed
      aggregatedResult.failed += batch.records.length;
      for (const record of batch.records) {
        aggregatedResult.errors.push({
          id: record.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  return aggregatedResult;
}

/**
 * Helper function to get all unmigrated records
 */
async function getAllUnmigratedRecords(
  firestore: Firestore,
  collectionName: string
): Promise<DocumentData[]> {
  const collectionRef = collection(firestore, collectionName);
  const snapshot = await getDocs(collectionRef);

  const unmigratedRecords: DocumentData[] = [];

  snapshot.forEach((docSnapshot) => {
    const data = docSnapshot.data();
    if (data.schoolId && !data.entityId) {
      unmigratedRecords.push({ id: docSnapshot.id, ...data });
    }
  });

  return unmigratedRecords;
}

/**
 * Helper function to chunk array
 */
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
