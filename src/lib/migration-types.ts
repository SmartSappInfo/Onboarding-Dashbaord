/**
 * Migration Types for SchoolId to EntityId Migration
 * 
 * This file defines all TypeScript interfaces and types used by the migration engine
 * to migrate feature collections from schoolId to entityId references.
 * 
 * Requirements: 17.3, 17.5
 */

/**
 * Migration status for a feature collection
 */
export type MigrationStatusType = 'not_started' | 'in_progress' | 'completed' | 'failed';

/**
 * Tracks the migration status of a feature collection
 */
export interface MigrationStatus {
  collection: string;
  status: MigrationStatusType;
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  lastRunAt?: string;
  completedAt?: string;
  errors: MigrationError[];
}

/**
 * Error that occurred during migration of a specific record
 */
export interface MigrationError {
  recordId: string;
  error: string;
  timestamp: string;
}

/**
 * Result of a migration operation (enrich & restore)
 */
export interface MigrationResult {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Result of a verification operation
 */
export interface VerificationResult {
  collection: string;
  totalRecords: number;
  migratedRecords: number;
  unmigratedRecords: number;
  orphanedRecords: number; // entityId exists but entity doesn't
  validationErrors: ValidationError[];
}

/**
 * Validation error found during verification
 */
export interface ValidationError {
  recordId: string;
  field: string;
  issue: string;
}

/**
 * Batch of records to be migrated
 */
export interface MigrationBatch {
  collection: string;
  records: any[];
  batchSize: number;
  totalBatches: number;
  currentBatch: number;
}

/**
 * Record enriched with entityId and entityType
 */
export interface EnrichedRecord {
  id: string;
  original: any;
  enriched: {
    entityId: string;
    entityType: 'institution' | 'family' | 'person';
  };
}

/**
 * Batch of enriched records ready for restoration
 */
export interface EnrichedBatch {
  collection: string;
  records: EnrichedRecord[];
  backupCollection: string;
}

/**
 * Result of a fetch operation
 */
export interface FetchResult {
  collection: string;
  totalRecords: number;
  recordsToMigrate: number;
  sampleRecords: any[];
  invalidRecords: Array<{ id: string; reason: string }>;
}

/**
 * Result of a rollback operation
 */
export interface RollbackResult {
  collection: string;
  totalRestored: number;
  failed: number;
  errors: Array<{ id: string; error: string }>;
}

/**
 * Progress tracking for migration operations
 */
export interface MigrationProgress {
  collection: string;
  phase: 'fetch' | 'enrich' | 'restore' | 'verify' | 'rollback';
  percentage: number;
  recordsProcessed: number;
  totalRecords: number;
  currentBatch: number;
  totalBatches: number;
  errors: MigrationError[];
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: MigrationProgress) => void;

/**
 * Entity type for contact identification
 */
export type EntityType = 'institution' | 'family' | 'person';

/**
 * Contact identifier that can use either legacy schoolId or new entityId
 */
export interface ContactIdentifier {
  schoolId?: string;
  entityId?: string;
}
