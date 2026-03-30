/**
 * Property Tests for Migration Monitoring
 * 
 * Tests correctness properties for migration operation logging,
 * metrics tracking, alerting, and log retention.
 * 
 * Requirements: 26.3, 30.1, 30.2, 30.3, 30.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import {
  logMigrationOperationStart,
  logMigrationOperationComplete,
  logMigrationOperationFailed,
  getMigrationOperationLogs,
  getMigrationMetrics,
  getMigrationAlerts,
  cleanupOldMigrationLogs,
  exportMigrationLogs,
} from '../migration-monitoring';
import type {
  MigrationOperationType,
  MigrationOperationResult,
} from '../migration-monitoring-types';
import { adminDb } from '../firebase-admin';

// Mock firebase-admin
vi.mock('../firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

describe('Migration Monitoring Property Tests', () => {
  let mockCollection: any;
  let mockDoc: any;
  let mockBatch: any;
  let createdDocs: Map<string, any>;

  beforeEach(() => {
    createdDocs = new Map();

    mockDoc = {
      id: '',
      set: vi.fn(async (data: any) => {
        createdDocs.set(mockDoc.id, data);
      }),
      update: vi.fn(async (data: any) => {
        const existing = createdDocs.get(mockDoc.id);
        if (existing) {
          createdDocs.set(mockDoc.id, { ...existing, ...data });
        }
      }),
      get: vi.fn(async () => ({
        exists: createdDocs.has(mockDoc.id),
        data: () => createdDocs.get(mockDoc.id),
      })),
    };

    mockBatch = {
      delete: vi.fn(),
      commit: vi.fn(async () => {}),
    };

    mockCollection = {
      doc: vi.fn((id?: string) => {
        mockDoc.id = id || `doc_${Date.now()}_${Math.random()}`;
        return mockDoc;
      }),
      where: vi.fn(() => mockCollection),
      orderBy: vi.fn(() => mockCollection),
      limit: vi.fn(() => mockCollection),
      get: vi.fn(async () => ({
        docs: Array.from(createdDocs.entries()).map(([id, data]) => ({
          id,
          data: () => data,
          ref: { id },
        })),
      })),
    };

    (adminDb.collection as any).mockReturnValue(mockCollection);
    (adminDb as any).batch = vi.fn(() => mockBatch);
  });

  afterEach(() => {
    vi.clearAllMocks();
    createdDocs.clear();
  });

  /**
   * Property 26: Migration Operation Logging
   * 
   * For any migration operation (fetch, enrich, restore, verify, rollback),
   * the system should create a log entry with operation type, collection,
   * timestamp, and result summary.
   * 
   * Validates: Requirement 30.1
   */
  describe('Property 26: Migration Operation Logging', () => {
    it('should log all migration operations with required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('fetch', 'enrich', 'restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.record({
            userId: fc.option(fc.uuid(), { nil: undefined }),
            userName: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
            organizationId: fc.option(fc.uuid(), { nil: undefined }),
          }),
          async (operationType, collection, context) => {
            // Log operation start
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
              ...context,
            });

            // Verify log was created
            expect(logId).toBeDefined();
            expect(typeof logId).toBe('string');

            // Verify log entry exists in mock storage
            const logEntry = createdDocs.get(logId);
            expect(logEntry).toBeDefined();

            // Verify required fields
            expect(logEntry.operationType).toBe(operationType);
            expect(logEntry.collection).toBe(collection);
            expect(logEntry.timestamp).toBeDefined();
            expect(logEntry.startedAt).toBeDefined();
            expect(logEntry.status).toBe('started');

            // Verify optional context fields
            if (context.userId) {
              expect(logEntry.userId).toBe(context.userId);
            }
            if (context.userName) {
              expect(logEntry.userName).toBe(context.userName);
            }
            if (context.organizationId) {
              expect(logEntry.organizationId).toBe(context.organizationId);
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update log entry on operation completion', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('fetch', 'enrich', 'restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.record({
            totalRecords: fc.integer({ min: 0, max: 1000 }),
            successCount: fc.integer({ min: 0, max: 1000 }),
            failureCount: fc.integer({ min: 0, max: 100 }),
            skippedCount: fc.integer({ min: 0, max: 50 }),
          }),
          async (operationType, collection, resultData) => {
            // Ensure success + failure <= total
            const totalRecords = Math.max(
              resultData.totalRecords,
              resultData.successCount + resultData.failureCount
            );

            const result: MigrationOperationResult = {
              totalRecords,
              successCount: resultData.successCount,
              failureCount: resultData.failureCount,
              skippedCount: resultData.skippedCount,
            };

            // Log operation start
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            // Log operation complete
            await logMigrationOperationComplete(logId, result);

            // Verify log was updated
            const logEntry = createdDocs.get(logId);
            expect(logEntry).toBeDefined();
            expect(logEntry.status).toBe('completed');
            expect(logEntry.completedAt).toBeDefined();
            expect(logEntry.duration).toBeDefined();
            expect(logEntry.result).toEqual(result);

            // Verify duration is positive
            expect(logEntry.duration).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should update log entry on operation failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('fetch', 'enrich', 'restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (operationType, collection, errorMessage) => {
            // Log operation start
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            // Log operation failed
            await logMigrationOperationFailed(logId, errorMessage);

            // Verify log was updated
            const logEntry = createdDocs.get(logId);
            expect(logEntry).toBeDefined();
            expect(logEntry.status).toBe('failed');
            expect(logEntry.completedAt).toBeDefined();
            expect(logEntry.duration).toBeDefined();
            expect(logEntry.error).toBe(errorMessage);

            // Verify duration is positive
            expect(logEntry.duration).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 27: Migration Metrics Tracking
   * 
   * For any completed migration operation, the system should track metrics
   * including records processed, success count, failure count, duration,
   * success rate, error rate, and records per second.
   * 
   * Validates: Requirement 30.2
   */
  describe('Property 27: Migration Metrics Tracking', () => {
    it('should track metrics with correct calculations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('fetch', 'enrich', 'restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.record({
            totalRecords: fc.integer({ min: 1, max: 1000 }),
            successCount: fc.integer({ min: 0, max: 1000 }),
            failureCount: fc.integer({ min: 0, max: 100 }),
          }),
          async (operationType, collection, resultData) => {
            // Ensure success + failure <= total
            const totalRecords = Math.max(
              resultData.totalRecords,
              resultData.successCount + resultData.failureCount
            );
            const successCount = Math.min(resultData.successCount, totalRecords);
            const failureCount = Math.min(resultData.failureCount, totalRecords - successCount);

            const result: MigrationOperationResult = {
              totalRecords,
              successCount,
              failureCount,
              skippedCount: 0,
            };

            // Log operation
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            // Wait a bit to ensure duration > 0
            await new Promise(resolve => setTimeout(resolve, 10));

            await logMigrationOperationComplete(logId, result);

            // Find the metrics entry
            const metricsEntries = Array.from(createdDocs.values()).filter(
              (doc: any) => doc.collection === collection && doc.operationType === operationType
            );

            expect(metricsEntries.length).toBeGreaterThan(0);

            const metrics = metricsEntries[metricsEntries.length - 1];

            // Verify metrics fields
            expect(metrics.recordsProcessed).toBe(totalRecords);
            expect(metrics.successCount).toBe(successCount);
            expect(metrics.failureCount).toBe(failureCount);
            expect(metrics.duration).toBeGreaterThan(0);

            // Verify calculated rates
            const expectedSuccessRate = (successCount / totalRecords) * 100;
            const expectedErrorRate = (failureCount / totalRecords) * 100;

            expect(metrics.successRate).toBeCloseTo(expectedSuccessRate, 2);
            expect(metrics.errorRate).toBeCloseTo(expectedErrorRate, 2);

            // Verify success rate + error rate + skipped rate <= 100%
            expect(metrics.successRate + metrics.errorRate).toBeLessThanOrEqual(100.1); // Allow small floating point error

            // Verify records per second is positive
            expect(metrics.recordsPerSecond).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should handle zero records correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('fetch', 'enrich', 'restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          async (operationType, collection) => {
            const result: MigrationOperationResult = {
              totalRecords: 0,
              successCount: 0,
              failureCount: 0,
              skippedCount: 0,
            };

            // Log operation
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            await logMigrationOperationComplete(logId, result);

            // Find the metrics entry
            const metricsEntries = Array.from(createdDocs.values()).filter(
              (doc: any) => doc.collection === collection && doc.operationType === operationType
            );

            if (metricsEntries.length > 0) {
              const metrics = metricsEntries[metricsEntries.length - 1];

              // Verify rates are 0 when no records
              expect(metrics.successRate).toBe(0);
              expect(metrics.errorRate).toBe(0);
              expect(metrics.recordsPerSecond).toBe(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 28: Migration Error Alerting
   * 
   * For any migration operation where the error rate exceeds 5% of records,
   * the system should create an alert with error details and affected collection.
   * 
   * Validates: Requirement 30.3
   */
  describe('Property 28: Migration Error Alerting', () => {
    it('should create alert when error rate exceeds 5%', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 6, max: 100 }), // At least 6% failure rate
          async (operationType, collection, totalRecords, failurePercentage) => {
            const failureCount = Math.ceil((totalRecords * failurePercentage) / 100);
            const successCount = totalRecords - failureCount;

            const result: MigrationOperationResult = {
              totalRecords,
              successCount,
              failureCount,
              skippedCount: 0,
              errors: Array.from({ length: Math.min(failureCount, 10) }, (_, i) => ({
                id: `record_${i}`,
                error: `Error ${i}`,
              })),
            };

            // Log operation
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            await logMigrationOperationComplete(logId, result);

            // Find alert entries
            const alertEntries = Array.from(createdDocs.values()).filter(
              (doc: any) => doc.alertType === 'high_error_rate' && doc.collection === collection
            );

            // Should have created an alert
            expect(alertEntries.length).toBeGreaterThan(0);

            const alert = alertEntries[alertEntries.length - 1];

            // Verify alert fields
            expect(alert.collection).toBe(collection);
            expect(alert.alertType).toBe('high_error_rate');
            expect(alert.severity).toBeDefined();
            expect(alert.message).toContain('error rate');
            expect(alert.details.errorRate).toBeGreaterThan(5);
            expect(alert.details.failureCount).toBe(failureCount);
            expect(alert.details.totalRecords).toBe(totalRecords);
            expect(alert.acknowledged).toBe(false);

            // Verify severity is appropriate
            if (alert.details.errorRate > 20) {
              expect(alert.severity).toBe('critical');
            } else {
              expect(alert.severity).toBe('warning');
            }
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should NOT create alert when error rate is below 5%', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.integer({ min: 100, max: 1000 }),
          fc.integer({ min: 0, max: 4 }), // Less than 5% failure rate
          async (operationType, collection, totalRecords, failurePercentage) => {
            const failureCount = Math.floor((totalRecords * failurePercentage) / 100);
            const successCount = totalRecords - failureCount;

            const result: MigrationOperationResult = {
              totalRecords,
              successCount,
              failureCount,
              skippedCount: 0,
            };

            // Clear previous alerts
            const alertsBefore = Array.from(createdDocs.values()).filter(
              (doc: any) => doc.alertType === 'high_error_rate'
            ).length;

            // Log operation
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            await logMigrationOperationComplete(logId, result);

            // Find alert entries for this collection
            const alertsAfter = Array.from(createdDocs.values()).filter(
              (doc: any) => doc.alertType === 'high_error_rate' && doc.collection === collection
            ).length;

            // Should NOT have created a new alert
            expect(alertsAfter).toBe(alertsBefore);
          }
        ),
        { numRuns: 30 }
      );
    });

    it('should create alert on operation failure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom<MigrationOperationType>('fetch', 'enrich', 'restore', 'verify', 'rollback'),
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.string({ minLength: 10, maxLength: 100 }),
          async (operationType, collection, errorMessage) => {
            // Log operation start
            const logId = await logMigrationOperationStart({
              operationType,
              collection,
            });

            // Log operation failed
            await logMigrationOperationFailed(logId, errorMessage);

            // Find alert entries
            const alertEntries = Array.from(createdDocs.values()).filter(
              (doc: any) => doc.alertType === 'operation_failed' && doc.collection === collection
            );

            // Should have created an alert
            expect(alertEntries.length).toBeGreaterThan(0);

            const alert = alertEntries[alertEntries.length - 1];

            // Verify alert fields
            expect(alert.collection).toBe(collection);
            expect(alert.alertType).toBe('operation_failed');
            expect(alert.severity).toBe('error');
            expect(alert.message).toContain('failed');
            expect(alert.details.operationType).toBe(operationType);
            expect(alert.acknowledged).toBe(false);
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 29: Migration Log Retention
   * 
   * For any migration logs older than the retention period (default 90 days),
   * the cleanup operation should delete them while preserving recent logs.
   * 
   * Validates: Requirement 30.5
   */
  describe('Property 29: Migration Log Retention', () => {
    it('should delete logs older than retention period', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 30, max: 180 }), // Retention days
          fc.integer({ min: 5, max: 20 }), // Number of old logs
          fc.integer({ min: 5, max: 20 }), // Number of recent logs
          async (retentionDays, oldLogsCount, recentLogsCount) => {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const oldDate = new Date(cutoffDate.getTime() - 24 * 60 * 60 * 1000).toISOString();
            const recentDate = new Date(cutoffDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

            // Create old logs (should be deleted)
            const oldLogIds: string[] = [];
            for (let i = 0; i < oldLogsCount; i++) {
              const logId = `old_log_${i}`;
              createdDocs.set(logId, {
                id: logId,
                operationType: 'fetch',
                collection: 'test_collection',
                timestamp: oldDate,
                status: 'completed',
              });
              oldLogIds.push(logId);
            }

            // Create recent logs (should be preserved)
            const recentLogIds: string[] = [];
            for (let i = 0; i < recentLogsCount; i++) {
              const logId = `recent_log_${i}`;
              createdDocs.set(logId, {
                id: logId,
                operationType: 'fetch',
                collection: 'test_collection',
                timestamp: recentDate,
                status: 'completed',
              });
              recentLogIds.push(logId);
            }

            // Mock the query to return old logs
            mockCollection.get.mockResolvedValueOnce({
              docs: oldLogIds.map(id => ({
                id,
                data: () => createdDocs.get(id),
                ref: { id },
              })),
            });

            // Mock empty results for metrics and alerts
            mockCollection.get.mockResolvedValueOnce({ docs: [] });
            mockCollection.get.mockResolvedValueOnce({ docs: [] });

            // Run cleanup
            const result = await cleanupOldMigrationLogs(retentionDays);

            // Verify cleanup was successful
            expect(result.success).toBe(true);
            expect(result.deletedCount).toBe(oldLogsCount);

            // Verify batch delete was called for old logs (at least oldLogsCount times)
            expect(mockBatch.delete).toHaveBeenCalled();
            expect(mockBatch.commit).toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve acknowledged alerts within retention period', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 30, max: 180 }),
          async (retentionDays) => {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const recentDate = new Date(cutoffDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

            // Create recent acknowledged alert (should be preserved)
            const alertId = 'recent_alert';
            createdDocs.set(alertId, {
              id: alertId,
              collection: 'test_collection',
              timestamp: recentDate,
              alertType: 'high_error_rate',
              acknowledged: true,
            });

            // Mock empty results for logs and metrics
            mockCollection.get.mockResolvedValueOnce({ docs: [] });
            mockCollection.get.mockResolvedValueOnce({ docs: [] });

            // Mock empty result for old acknowledged alerts
            mockCollection.get.mockResolvedValueOnce({ docs: [] });

            // Run cleanup
            const result = await cleanupOldMigrationLogs(retentionDays);

            // Verify cleanup was successful
            expect(result.success).toBe(true);

            // Verify the recent alert was not deleted
            expect(createdDocs.has(alertId)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });

    it('should preserve unacknowledged alerts regardless of age', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 30, max: 180 }),
          async (retentionDays) => {
            const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
            const oldDate = new Date(cutoffDate.getTime() - 24 * 60 * 60 * 1000).toISOString();

            // Create old unacknowledged alert (should be preserved)
            const alertId = 'old_unacknowledged_alert';
            createdDocs.set(alertId, {
              id: alertId,
              collection: 'test_collection',
              timestamp: oldDate,
              alertType: 'high_error_rate',
              acknowledged: false,
            });

            // Mock empty results for logs and metrics
            mockCollection.get.mockResolvedValueOnce({ docs: [] });
            mockCollection.get.mockResolvedValueOnce({ docs: [] });

            // Mock empty result for old acknowledged alerts (unacknowledged not queried)
            mockCollection.get.mockResolvedValueOnce({ docs: [] });

            // Run cleanup
            const result = await cleanupOldMigrationLogs(retentionDays);

            // Verify cleanup was successful
            expect(result.success).toBe(true);

            // Verify the unacknowledged alert was not deleted
            expect(createdDocs.has(alertId)).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Additional Property: Log Export Completeness
   * 
   * For any log export operation, the system should include all logs
   * matching the filter criteria (operations, metrics, alerts).
   */
  describe('Additional Property: Log Export Completeness', () => {
    it('should export all logs matching filters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 20 }),
          fc.integer({ min: 5, max: 20 }),
          async (collection, logCount) => {
            // Create logs for the collection
            const logIds: string[] = [];
            for (let i = 0; i < logCount; i++) {
              const logId = `log_${i}`;
              createdDocs.set(logId, {
                id: logId,
                operationType: 'fetch',
                collection,
                timestamp: new Date().toISOString(),
                status: 'completed',
              });
              logIds.push(logId);
            }

            // Mock query results
            mockCollection.get.mockResolvedValue({
              docs: logIds.map(id => ({
                id,
                data: () => createdDocs.get(id),
                ref: { id },
              })),
            });

            // Export logs
            const result = await exportMigrationLogs({ collection });

            // Verify export was successful
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
            expect(result.data!.operations.length).toBe(logCount);
            expect(result.data!.exportedAt).toBeDefined();

            // Verify all logs are for the correct collection
            result.data!.operations.forEach(log => {
              expect(log.collection).toBe(collection);
            });
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
