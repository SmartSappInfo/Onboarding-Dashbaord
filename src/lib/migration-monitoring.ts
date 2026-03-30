/**
 * Migration Monitoring Service
 * 
 * Provides logging, metrics tracking, alerting, and log retention
 * for migration operations.
 * 
 * Requirements: 30.1, 30.2, 30.3, 30.5
 */

'use server';

import { adminDb } from './firebase-admin';
import type {
  MigrationOperationLog,
  MigrationOperationResult,
  MigrationOperationType,
  MigrationMetrics,
  MigrationAlert,
  MigrationDashboardSummary,
} from './migration-monitoring-types';

/**
 * Log the start of a migration operation
 * 
 * Requirement 30.1: Log all migration operations
 * 
 * @param params - Operation parameters
 * @returns Promise resolving to log ID
 */
export async function logMigrationOperationStart(params: {
  operationType: MigrationOperationType;
  collection: string;
  userId?: string;
  userName?: string;
  organizationId?: string;
}): Promise<string> {
  try {
    const logRef = adminDb.collection('migration_operation_logs').doc();
    const log: MigrationOperationLog = {
      id: logRef.id,
      operationType: params.operationType,
      collection: params.collection,
      timestamp: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      status: 'started',
      userId: params.userId,
      userName: params.userName,
      organizationId: params.organizationId,
    };
    
    await logRef.set(log);
    return logRef.id;
  } catch (error) {
    console.error('Failed to log migration operation start:', error);
    throw error;
  }
}

/**
 * Log the completion of a migration operation
 * 
 * Requirement 30.1: Include operation type, collection, timestamp, result summary
 * 
 * @param logId - ID of the log entry to update
 * @param result - Operation result
 */
export async function logMigrationOperationComplete(
  logId: string,
  result: MigrationOperationResult
): Promise<void> {
  try {
    const logRef = adminDb.collection('migration_operation_logs').doc(logId);
    const logDoc = await logRef.get();
    
    if (!logDoc.exists) {
      console.error('Migration operation log not found:', logId);
      return;
    }
    
    const log = logDoc.data() as MigrationOperationLog;
    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(log.startedAt).getTime();
    
    await logRef.update({
      status: 'completed',
      completedAt,
      duration,
      result,
    });
    
    // Track metrics
    await trackMigrationMetrics({
      collection: log.collection,
      operationType: log.operationType,
      recordsProcessed: result.totalRecords,
      successCount: result.successCount,
      failureCount: result.failureCount,
      skippedCount: result.skippedCount || 0,
      duration,
    });
    
    // Check for alerts
    await checkAndCreateAlerts(log.collection, result);
  } catch (error) {
    console.error('Failed to log migration operation complete:', error);
  }
}

/**
 * Log a failed migration operation
 * 
 * @param logId - ID of the log entry to update
 * @param error - Error message
 */
export async function logMigrationOperationFailed(
  logId: string,
  error: string
): Promise<void> {
  try {
    const logRef = adminDb.collection('migration_operation_logs').doc(logId);
    const logDoc = await logRef.get();
    
    if (!logDoc.exists) {
      console.error('Migration operation log not found:', logId);
      return;
    }
    
    const log = logDoc.data() as MigrationOperationLog;
    const completedAt = new Date().toISOString();
    const duration = new Date(completedAt).getTime() - new Date(log.startedAt).getTime();
    
    await logRef.update({
      status: 'failed',
      completedAt,
      duration,
      error,
    });
    
    // Create alert for failed operation
    await createMigrationAlert({
      collection: log.collection,
      alertType: 'operation_failed',
      severity: 'error',
      message: `Migration operation ${log.operationType} failed for collection ${log.collection}`,
      details: {
        operationType: log.operationType,
        errors: [{ id: 'operation', error }],
      },
    });
  } catch (err) {
    console.error('Failed to log migration operation failure:', err);
  }
}

/**
 * Track migration metrics
 * 
 * Requirement 30.2: Track records processed, success count, failure count, duration
 * 
 * @param params - Metrics parameters
 */
async function trackMigrationMetrics(params: {
  collection: string;
  operationType: MigrationOperationType;
  recordsProcessed: number;
  successCount: number;
  failureCount: number;
  skippedCount: number;
  duration: number;
}): Promise<void> {
  try {
    const timestamp = new Date().toISOString();
    const metricsRef = adminDb.collection('migration_metrics').doc();
    
    const successRate = params.recordsProcessed > 0
      ? (params.successCount / params.recordsProcessed) * 100
      : 0;
    
    const errorRate = params.recordsProcessed > 0
      ? (params.failureCount / params.recordsProcessed) * 100
      : 0;
    
    const recordsPerSecond = params.duration > 0
      ? (params.recordsProcessed / (params.duration / 1000))
      : 0;
    
    const metrics: MigrationMetrics = {
      id: metricsRef.id,
      collection: params.collection,
      timestamp,
      operationType: params.operationType,
      recordsProcessed: params.recordsProcessed,
      successCount: params.successCount,
      failureCount: params.failureCount,
      skippedCount: params.skippedCount,
      successRate,
      errorRate,
      duration: params.duration,
      recordsPerSecond,
    };
    
    await metricsRef.set(metrics);
  } catch (error) {
    console.error('Failed to track migration metrics:', error);
  }
}

/**
 * Check migration results and create alerts if needed
 * 
 * Requirement 30.3: Send alert when failure rate exceeds 5% of records
 * 
 * @param collection - Collection name
 * @param result - Migration result
 */
async function checkAndCreateAlerts(
  collection: string,
  result: MigrationOperationResult
): Promise<void> {
  try {
    const errorRate = result.totalRecords > 0
      ? (result.failureCount / result.totalRecords) * 100
      : 0;
    
    // Alert if error rate exceeds 5%
    if (errorRate > 5) {
      await createMigrationAlert({
        collection,
        alertType: 'high_error_rate',
        severity: errorRate > 20 ? 'critical' : 'warning',
        message: `High error rate detected: ${errorRate.toFixed(2)}% of records failed migration`,
        details: {
          errorRate,
          failureCount: result.failureCount,
          totalRecords: result.totalRecords,
          errors: result.errors?.slice(0, 10), // Include first 10 errors
        },
      });
    }
  } catch (error) {
    console.error('Failed to check and create alerts:', error);
  }
}

/**
 * Create a migration alert
 * 
 * @param params - Alert parameters
 */
async function createMigrationAlert(params: {
  collection: string;
  alertType: MigrationAlert['alertType'];
  severity: MigrationAlert['severity'];
  message: string;
  details: MigrationAlert['details'];
}): Promise<void> {
  try {
    const alertRef = adminDb.collection('migration_alerts').doc();
    const alert: MigrationAlert = {
      id: alertRef.id,
      collection: params.collection,
      timestamp: new Date().toISOString(),
      alertType: params.alertType,
      severity: params.severity,
      message: params.message,
      details: params.details,
      acknowledged: false,
    };
    
    await alertRef.set(alert);
    
    // Log to console for immediate visibility
    console.warn(`[MIGRATION ALERT] ${params.severity.toUpperCase()}: ${params.message}`, params.details);
  } catch (error) {
    console.error('Failed to create migration alert:', error);
  }
}

/**
 * Get migration operation logs
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to operation logs
 */
export async function getMigrationOperationLogs(filters?: {
  collection?: string;
  operationType?: MigrationOperationType;
  status?: 'started' | 'completed' | 'failed';
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{ success: boolean; data?: MigrationOperationLog[]; error?: string }> {
  try {
    let query = adminDb.collection('migration_operation_logs') as FirebaseFirestore.Query;
    
    if (filters?.collection) {
      query = query.where('collection', '==', filters.collection);
    }
    
    if (filters?.operationType) {
      query = query.where('operationType', '==', filters.operationType);
    }
    
    if (filters?.status) {
      query = query.where('status', '==', filters.status);
    }
    
    if (filters?.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }
    
    query = query.orderBy('timestamp', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const snapshot = await query.get();
    const logs = snapshot.docs.map(doc => doc.data() as MigrationOperationLog);
    
    return { success: true, data: logs };
  } catch (error: any) {
    console.error('getMigrationOperationLogs error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get migration metrics
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to metrics
 */
export async function getMigrationMetrics(filters?: {
  collection?: string;
  operationType?: MigrationOperationType;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{ success: boolean; data?: MigrationMetrics[]; error?: string }> {
  try {
    let query = adminDb.collection('migration_metrics') as FirebaseFirestore.Query;
    
    if (filters?.collection) {
      query = query.where('collection', '==', filters.collection);
    }
    
    if (filters?.operationType) {
      query = query.where('operationType', '==', filters.operationType);
    }
    
    if (filters?.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }
    
    query = query.orderBy('timestamp', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const snapshot = await query.get();
    const metrics = snapshot.docs.map(doc => doc.data() as MigrationMetrics);
    
    return { success: true, data: metrics };
  } catch (error: any) {
    console.error('getMigrationMetrics error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get migration alerts
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to alerts
 */
export async function getMigrationAlerts(filters?: {
  collection?: string;
  alertType?: MigrationAlert['alertType'];
  severity?: MigrationAlert['severity'];
  acknowledged?: boolean;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<{ success: boolean; data?: MigrationAlert[]; error?: string }> {
  try {
    let query = adminDb.collection('migration_alerts') as FirebaseFirestore.Query;
    
    if (filters?.collection) {
      query = query.where('collection', '==', filters.collection);
    }
    
    if (filters?.alertType) {
      query = query.where('alertType', '==', filters.alertType);
    }
    
    if (filters?.severity) {
      query = query.where('severity', '==', filters.severity);
    }
    
    if (filters?.acknowledged !== undefined) {
      query = query.where('acknowledged', '==', filters.acknowledged);
    }
    
    if (filters?.startDate) {
      query = query.where('timestamp', '>=', filters.startDate);
    }
    
    if (filters?.endDate) {
      query = query.where('timestamp', '<=', filters.endDate);
    }
    
    query = query.orderBy('timestamp', 'desc');
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const snapshot = await query.get();
    const alerts = snapshot.docs.map(doc => doc.data() as MigrationAlert);
    
    return { success: true, data: alerts };
  } catch (error: any) {
    console.error('getMigrationAlerts error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Acknowledge a migration alert
 * 
 * @param alertId - Alert ID
 * @param acknowledgedBy - User who acknowledged the alert
 */
export async function acknowledgeMigrationAlert(
  alertId: string,
  acknowledgedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const alertRef = adminDb.collection('migration_alerts').doc(alertId);
    await alertRef.update({
      acknowledged: true,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy,
    });
    
    return { success: true };
  } catch (error: any) {
    console.error('acknowledgeMigrationAlert error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get migration dashboard summary
 * 
 * Requirement 30.2: Display metrics in Seeds page dashboard
 * 
 * @returns Promise resolving to dashboard summary
 */
export async function getMigrationDashboardSummary(): Promise<{
  success: boolean;
  data?: MigrationDashboardSummary;
  error?: string;
}> {
  try {
    // Get recent alerts (last 24 hours, unacknowledged)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const alertsResult = await getMigrationAlerts({
      acknowledged: false,
      startDate: yesterday,
      limit: 10,
    });
    
    // Get recent operations (last 50)
    const operationsResult = await getMigrationOperationLogs({
      limit: 50,
    });
    
    // Get all metrics to calculate overall stats
    const metricsResult = await getMigrationMetrics({
      limit: 1000,
    });
    
    if (!alertsResult.success || !operationsResult.success || !metricsResult.success) {
      throw new Error('Failed to fetch dashboard data');
    }
    
    const metrics = metricsResult.data || [];
    const operations = operationsResult.data || [];
    
    // Calculate aggregated stats
    const totalRecords = metrics.reduce((sum, m) => sum + m.recordsProcessed, 0);
    const migratedRecords = metrics.reduce((sum, m) => sum + m.successCount, 0);
    const failedRecords = metrics.reduce((sum, m) => sum + m.failureCount, 0);
    
    const overallSuccessRate = totalRecords > 0
      ? (migratedRecords / totalRecords) * 100
      : 0;
    
    const overallErrorRate = totalRecords > 0
      ? (failedRecords / totalRecords) * 100
      : 0;
    
    // Count collection statuses from recent operations
    const collectionStatuses = new Map<string, 'completed' | 'failed' | 'in_progress'>();
    operations.forEach(op => {
      if (!collectionStatuses.has(op.collection)) {
        collectionStatuses.set(op.collection, op.status === 'started' ? 'in_progress' : op.status);
      }
    });
    
    const completedCollections = Array.from(collectionStatuses.values())
      .filter(s => s === 'completed').length;
    const failedCollections = Array.from(collectionStatuses.values())
      .filter(s => s === 'failed').length;
    const inProgressCollections = Array.from(collectionStatuses.values())
      .filter(s => s === 'in_progress').length;
    
    const summary: MigrationDashboardSummary = {
      totalCollections: collectionStatuses.size,
      completedCollections,
      inProgressCollections,
      failedCollections,
      notStartedCollections: 0, // Would need to query all possible collections
      totalRecords,
      migratedRecords,
      unmigratedRecords: totalRecords - migratedRecords - failedRecords,
      failedRecords,
      overallSuccessRate,
      overallErrorRate,
      recentAlerts: alertsResult.data || [],
      recentOperations: operations.slice(0, 10),
    };
    
    return { success: true, data: summary };
  } catch (error: any) {
    console.error('getMigrationDashboardSummary error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old migration logs
 * 
 * Requirement 30.5: Retain migration logs for 90 days
 * 
 * @param retentionDays - Number of days to retain logs (default: 90)
 */
export async function cleanupOldMigrationLogs(
  retentionDays: number = 90
): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    
    let deletedCount = 0;
    
    // Clean up operation logs
    const operationLogsSnapshot = await adminDb
      .collection('migration_operation_logs')
      .where('timestamp', '<', cutoffDate)
      .get();
    
    const operationLogBatch = adminDb.batch();
    operationLogsSnapshot.docs.forEach(doc => {
      operationLogBatch.delete(doc.ref);
      deletedCount++;
    });
    await operationLogBatch.commit();
    
    // Clean up metrics
    const metricsSnapshot = await adminDb
      .collection('migration_metrics')
      .where('timestamp', '<', cutoffDate)
      .get();
    
    const metricsBatch = adminDb.batch();
    metricsSnapshot.docs.forEach(doc => {
      metricsBatch.delete(doc.ref);
      deletedCount++;
    });
    await metricsBatch.commit();
    
    // Clean up acknowledged alerts older than retention period
    const alertsSnapshot = await adminDb
      .collection('migration_alerts')
      .where('timestamp', '<', cutoffDate)
      .where('acknowledged', '==', true)
      .get();
    
    const alertsBatch = adminDb.batch();
    alertsSnapshot.docs.forEach(doc => {
      alertsBatch.delete(doc.ref);
      deletedCount++;
    });
    await alertsBatch.commit();
    
    console.log(`Cleaned up ${deletedCount} old migration logs (retention: ${retentionDays} days)`);
    
    return { success: true, deletedCount };
  } catch (error: any) {
    console.error('cleanupOldMigrationLogs error:', error);
    return { success: false, deletedCount: 0, error: error.message };
  }
}

/**
 * Export migration logs for audit purposes
 * 
 * Requirement 30.5: Provide log export functionality for audit purposes
 * 
 * @param filters - Optional filters
 * @returns Promise resolving to exported logs
 */
export async function exportMigrationLogs(filters?: {
  collection?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{
  success: boolean;
  data?: {
    operations: MigrationOperationLog[];
    metrics: MigrationMetrics[];
    alerts: MigrationAlert[];
    exportedAt: string;
  };
  error?: string;
}> {
  try {
    const operationsResult = await getMigrationOperationLogs({
      collection: filters?.collection,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: 10000,
    });
    
    const metricsResult = await getMigrationMetrics({
      collection: filters?.collection,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: 10000,
    });
    
    const alertsResult = await getMigrationAlerts({
      collection: filters?.collection,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
      limit: 10000,
    });
    
    if (!operationsResult.success || !metricsResult.success || !alertsResult.success) {
      throw new Error('Failed to export migration logs');
    }
    
    return {
      success: true,
      data: {
        operations: operationsResult.data || [],
        metrics: metricsResult.data || [],
        alerts: alertsResult.data || [],
        exportedAt: new Date().toISOString(),
      },
    };
  } catch (error: any) {
    console.error('exportMigrationLogs error:', error);
    return { success: false, error: error.message };
  }
}
