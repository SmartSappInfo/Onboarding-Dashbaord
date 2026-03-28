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
  EntityType,
  ProgressCallback,
  MigrationProgress
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
   * Fetch records for a specific collection with collection-specific logic
   * Handles special cases like meetings using schoolSlug
   * Requirement: 18.1, 18.2, 18.3, 18.4
   */
  fetchCollection(collectionName: string): Promise<FetchResult>;

  /**
   * Enrich records by resolving entityId from schoolId
   * Requirement: 19.1, 19.2
   */
  enrich(batch: MigrationBatch, onProgress?: ProgressCallback): Promise<EnrichedBatch>;

  /**
   * Restore enriched records to Firestore with backups
   * Requirement: 19.7
   */
  restore(batch: EnrichedBatch, onProgress?: ProgressCallback): Promise<MigrationResult>;

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
   * Fetch records for a specific collection with collection-specific logic
   * Handles special cases like meetings using schoolSlug instead of schoolId
   * 
   * Requirement: 18.1, 18.2, 18.3, 18.4
   */
  async fetchCollection(collectionName: string): Promise<FetchResult> {
    // Special handling for meetings collection (uses schoolSlug)
    if (collectionName === 'meetings') {
      return this.fetchMeetings();
    }

    // For all other collections, use the generic fetch method
    return this.fetch(collectionName);
  }

  /**
   * Fetch meetings collection (special case: uses schoolSlug instead of schoolId)
   */
  private async fetchMeetings(): Promise<FetchResult> {
    try {
      const collectionRef = collection(this.firestore, 'meetings');
      
      // Get all records in the collection
      const allRecordsSnapshot = await getDocs(collectionRef);
      const totalRecords = allRecordsSnapshot.size;

      // Filter records that need migration (have schoolSlug but no entityId)
      const recordsToMigrate: DocumentData[] = [];
      const invalidRecords: Array<{ id: string; reason: string }> = [];

      allRecordsSnapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const id = docSnapshot.id;

        // Check if record needs migration (meetings use schoolSlug)
        if (data.schoolSlug && !data.entityId) {
          recordsToMigrate.push({ id, ...data });
        } else if (!data.schoolSlug && !data.entityId) {
          // Record has neither identifier - invalid
          invalidRecords.push({
            id,
            reason: 'Missing both schoolSlug and entityId'
          });
        }
      });

      // Get sample records (first 5)
      const sampleRecords = recordsToMigrate.slice(0, SAMPLE_SIZE);

      return {
        collection: 'meetings',
        totalRecords,
        recordsToMigrate: recordsToMigrate.length,
        sampleRecords,
        invalidRecords
      };
    } catch (error) {
      throw new Error(`Fetch operation failed for meetings: ${error}`);
    }
  }

  /**
   * Enrich records by resolving entityId from schoolId
   * 
   * Requirement: 19.1 - Fetch all records with schoolId but no entityId
   * Requirement: 19.2 - Resolve entityId by querying schools collection
   * Requirement: 19.3 - Use school's entityId if migrationStatus === 'migrated'
   * Requirement: 19.4 - Generate entityId using format entity_<schoolId> if school doesn't have entityId
   * Requirement: 19.8 - Log errors for individual record failures
   * Requirement: 19.9 - Continue processing remaining records after error
   * Requirement: 19.11 - Track progress (percentage, records processed, current batch)
   */
  async enrich(batch: MigrationBatch, onProgress?: ProgressCallback): Promise<EnrichedBatch> {
    const enrichedRecords: EnrichedRecord[] = [];
    const errors: Array<{ id: string; error: string }> = [];
    const totalRecords = batch.records.length;

    for (let i = 0; i < batch.records.length; i++) {
      const record = batch.records[i];
      
      try {
        // Query the schools collection for this schoolId
        const schoolRef = doc(this.firestore, 'schools', record.schoolId);
        const schoolSnapshot = await getDoc(schoolRef);

        if (!schoolSnapshot.exists()) {
          // Log error and continue with next record
          const errorMsg = `School ${record.schoolId} not found`;
          console.error(`Failed to enrich record ${record.id}: ${errorMsg}`);
          errors.push({ id: record.id, error: errorMsg });
          continue;
        }

        const schoolData = schoolSnapshot.data();
        let entityId: string;
        let entityType: EntityType = 'institution'; // Default type

        // Check if school has been migrated (Requirement 19.3)
        if (schoolData.migrationStatus === 'migrated' && schoolData.entityId) {
          // Use existing entityId from migrated school
          entityId = schoolData.entityId;
        } else {
          // Generate entityId for non-migrated school (Requirement 19.4)
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
        // Log error and continue processing (Requirement 19.9)
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error(`Failed to enrich record ${record.id}:`, errorMsg);
        errors.push({ id: record.id, error: errorMsg });
        // Continue with next record instead of throwing
      }

      // Report progress (Requirement 19.11)
      if (onProgress) {
        const recordsProcessed = i + 1;
        const percentage = Math.round((recordsProcessed / totalRecords) * 100);
        
        onProgress({
          collection: batch.collection,
          phase: 'enrich',
          percentage,
          recordsProcessed,
          totalRecords,
          currentBatch: batch.currentBatch,
          totalBatches: batch.totalBatches,
          errors: errors.map(e => ({
            recordId: e.id,
            error: e.error,
            timestamp: new Date().toISOString()
          }))
        });
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
   * Requirement: 19.5 - Create backup collection before updates
   * Requirement: 19.6 - Update original record with entityId and entityType while preserving schoolId
   * Requirement: 19.7 - Process in batches of 450 records
   * Requirement: 19.8 - Log errors for individual record failures
   * Requirement: 19.9 - Continue processing remaining records after error
   * Requirement: 19.11 - Track progress (percentage, records processed, current batch)
   */
  async restore(enrichedBatch: EnrichedBatch, onProgress?: ProgressCallback): Promise<MigrationResult> {
    const result: MigrationResult = {
      total: enrichedBatch.records.length,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    // Process records in batches to avoid Firestore limits (Requirement 19.7)
    const batches = this.chunkArray(enrichedBatch.records, BATCH_SIZE);
    let recordsProcessed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batchRecords = batches[i];
      const firestoreBatch = writeBatch(this.firestore);
      let batchSucceeded = 0;
      let batchSkipped = 0;

      for (const enrichedRecord of batchRecords) {
        try {
          // Check if already migrated (idempotency)
          if (enrichedRecord.original.entityId) {
            result.skipped++;
            batchSkipped++;
            continue;
          }

          // Create backup before updating (Requirement 19.5)
          const backupRef = doc(
            this.firestore,
            enrichedBatch.backupCollection,
            enrichedRecord.id
          );
          firestoreBatch.set(backupRef, {
            ...enrichedRecord.original,
            backedUpAt: new Date().toISOString()
          });

          // Update original record with entityId and entityType (Requirement 19.6)
          // Preserves original schoolId field (dual-write)
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

          batchSucceeded++;
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
        result.succeeded += batchSucceeded;
        recordsProcessed += batchRecords.length;
      } catch (error) {
        // If batch commit fails, mark all non-skipped records in batch as failed (Requirement 19.9)
        for (const enrichedRecord of batchRecords) {
          if (!enrichedRecord.original.entityId) {
            result.failed++;
            result.errors.push({
              id: enrichedRecord.id,
              error: `Batch commit failed: ${error}`
            });
          }
        }
        recordsProcessed += batchRecords.length;
      }

      // Report progress (Requirement 19.11)
      if (onProgress) {
        const percentage = Math.round((recordsProcessed / enrichedBatch.records.length) * 100);
        
        onProgress({
          collection: enrichedBatch.collection,
          phase: 'restore',
          percentage,
          recordsProcessed,
          totalRecords: enrichedBatch.records.length,
          currentBatch: i + 1,
          totalBatches: batches.length,
          errors: result.errors.map(e => ({
            recordId: e.id,
            error: e.error,
            timestamp: new Date().toISOString()
          }))
        });
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
 * Collection names for feature migrations
 */
export const FEATURE_COLLECTIONS = [
  'tasks',
  'activities',
  'forms',
  'invoices',
  'meetings',
  'surveys',
  'message_logs',
  'pdfs',
  'automation_logs'
] as const;

export type FeatureCollection = typeof FEATURE_COLLECTIONS[number];

/**
 * Fetch operations for all feature collections
 * Provides a convenient way to fetch migration data for all collections
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */
export async function fetchAllCollections(
  firestore: Firestore
): Promise<Record<FeatureCollection, FetchResult>> {
  const engine = createMigrationEngine(firestore);
  const results: Partial<Record<FeatureCollection, FetchResult>> = {};

  for (const collectionName of FEATURE_COLLECTIONS) {
    try {
      results[collectionName] = await engine.fetchCollection(collectionName);
    } catch (error) {
      console.error(`Failed to fetch ${collectionName}:`, error);
      // Continue with other collections even if one fails
    }
  }

  return results as Record<FeatureCollection, FetchResult>;
}

/**
 * Fetch operation for a single collection
 * 
 * Requirements: 18.1, 18.2, 18.3, 18.4
 */
export async function fetchCollectionData(
  firestore: Firestore,
  collectionName: FeatureCollection
): Promise<FetchResult> {
  const engine = createMigrationEngine(firestore);
  return engine.fetchCollection(collectionName);
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
