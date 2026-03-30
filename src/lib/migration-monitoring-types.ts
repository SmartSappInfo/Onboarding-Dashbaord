/**
 * Migration Monitoring Types
 * 
 * Types for migration operation logging, metrics tracking, and alerting.
 * 
 * Requirements: 30.1, 30.2, 30.3, 30.5
 */

/**
 * Migration operation types that can be logged
 */
export type MigrationOperationType = 'fetch' | 'enrich' | 'restore' | 'verify' | 'rollback';

/**
 * Migration operation log entry
 * Stored in Firestore collection: migration_operation_logs
 */
export interface MigrationOperationLog {
  id: string;
  operationType: MigrationOperationType;
  collection: string;
  timestamp: string;
  startedAt: string;
  completedAt?: string;
  duration?: number; // milliseconds
  status: 'started' | 'completed' | 'failed';
  result?: MigrationOperationResult;
  error?: string;
  userId?: string;
  userName?: string;
  organizationId?: string;
}

/**
 * Result summary for a migration operation
 */
export interface MigrationOperationResult {
  totalRecords: number;
  successCount: number;
  failureCount: number;
  skippedCount?: number;
  errors?: Array<{ id: string; error: string }>;
  validationErrors?: Array<{ recordId: string; field: string; issue: string }>;
}

/**
 * Migration metrics for a collection
 * Stored in Firestore collection: migration_metrics
 */
export interface MigrationMetrics {
  id: string; // Format: {collection}_{timestamp}
  collection: string;
  timestamp: string;
  operationType: MigrationOperationType;
  
  // Record counts
  recordsProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  
  // Rates
  successRate: number; // percentage (0-100)
  errorRate: number; // percentage (0-100)
  
  // Performance
  duration: number; // milliseconds
  recordsPerSecond: number;
  
  // Batch info
  totalBatches?: number;
  batchesProcessed?: number;
}

/**
 * Migration alert
 * Stored in Firestore collection: migration_alerts
 */
export interface MigrationAlert {
  id: string;
  collection: string;
  timestamp: string;
  alertType: 'high_error_rate' | 'operation_failed' | 'orphaned_records';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  details: {
    errorRate?: number;
    failureCount?: number;
    totalRecords?: number;
    errors?: Array<{ id: string; error: string }>;
    operationType?: MigrationOperationType;
  };
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

/**
 * Migration dashboard summary
 * Aggregated view of all collection migration statuses
 */
export interface MigrationDashboardSummary {
  totalCollections: number;
  completedCollections: number;
  inProgressCollections: number;
  failedCollections: number;
  notStartedCollections: number;
  
  totalRecords: number;
  migratedRecords: number;
  unmigratedRecords: number;
  failedRecords: number;
  
  overallSuccessRate: number;
  overallErrorRate: number;
  
  recentAlerts: MigrationAlert[];
  recentOperations: MigrationOperationLog[];
}

/**
 * Log retention policy
 */
export interface LogRetentionPolicy {
  retentionDays: number; // Default: 90 days
  autoCleanup: boolean;
  lastCleanupAt?: string;
}
