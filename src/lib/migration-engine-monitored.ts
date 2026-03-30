/**
 * Monitored Migration Engine Wrapper
 * 
 * Wraps the migration engine with monitoring, logging, metrics tracking, and alerting.
 * 
 * Requirements: 30.1, 30.2, 30.3
 */

'use client';

import type { Firestore } from 'firebase/firestore';
import type { MigrationEngine } from './migration-engine';
import type {
  MigrationBatch,
  EnrichedBatch,
  MigrationResult,
  VerificationResult,
  FetchResult,
  RollbackResult,
  ProgressCallback,
} from './migration-types';
import { MigrationEngineImpl } from './migration-engine';
import type { MigrationOperationType } from './migration-monitoring-types';

/**
 * Monitored Migration Engine
 * 
 * Wraps the base migration engine with monitoring capabilities
 */
export class MonitoredMigrationEngine implements MigrationEngine {
  private engine: MigrationEngine;
  private userId?: string;
  private userName?: string;
  private organizationId?: string;

  constructor(
    firestore: Firestore,
    context?: {
      userId?: string;
      userName?: string;
      organizationId?: string;
    }
  ) {
    this.engine = new MigrationEngineImpl(firestore);
    this.userId = context?.userId;
    this.userName = context?.userName;
    this.organizationId = context?.organizationId;
  }

  /**
   * Fetch with monitoring
   */
  async fetch(collectionName: string): Promise<FetchResult> {
    return this.executeWithMonitoring(
      'fetch',
      collectionName,
      async () => await this.engine.fetch(collectionName)
    );
  }

  /**
   * Fetch collection with monitoring
   */
  async fetchCollection(collectionName: string): Promise<FetchResult> {
    return this.executeWithMonitoring(
      'fetch',
      collectionName,
      async () => await this.engine.fetchCollection(collectionName)
    );
  }

  /**
   * Enrich with monitoring
   */
  async enrich(batch: MigrationBatch, onProgress?: ProgressCallback): Promise<EnrichedBatch> {
    return this.executeWithMonitoring(
      'enrich',
      batch.collection,
      async () => await this.engine.enrich(batch, onProgress)
    );
  }

  /**
   * Restore with monitoring
   */
  async restore(batch: EnrichedBatch, onProgress?: ProgressCallback): Promise<MigrationResult> {
    return this.executeWithMonitoring(
      'restore',
      batch.collection,
      async () => await this.engine.restore(batch, onProgress),
      (result) => ({
        totalRecords: result.total,
        successCount: result.succeeded,
        failureCount: result.failed,
        skippedCount: result.skipped,
        errors: result.errors,
      })
    );
  }

  /**
   * Verify with monitoring
   */
  async verify(collectionName: string): Promise<VerificationResult> {
    return this.executeWithMonitoring(
      'verify',
      collectionName,
      async () => await this.engine.verify(collectionName),
      (result) => ({
        totalRecords: result.totalRecords,
        successCount: result.migratedRecords,
        failureCount: 0,
        validationErrors: result.validationErrors,
      })
    );
  }

  /**
   * Rollback with monitoring
   */
  async rollback(collectionName: string): Promise<RollbackResult> {
    return this.executeWithMonitoring(
      'rollback',
      collectionName,
      async () => await this.engine.rollback(collectionName),
      (result) => ({
        totalRecords: result.totalRestored + result.failed,
        successCount: result.totalRestored,
        failureCount: result.failed,
        errors: result.errors,
      })
    );
  }

  /**
   * Execute an operation with monitoring
   * 
   * @param operationType - Type of operation
   * @param collection - Collection name
   * @param operation - Operation to execute
   * @param resultMapper - Optional function to map result to MigrationOperationResult
   */
  private async executeWithMonitoring<T>(
    operationType: MigrationOperationType,
    collection: string,
    operation: () => Promise<T>,
    resultMapper?: (result: T) => {
      totalRecords: number;
      successCount: number;
      failureCount: number;
      skippedCount?: number;
      errors?: Array<{ id: string; error: string }>;
      validationErrors?: Array<{ recordId: string; field: string; issue: string }>;
    }
  ): Promise<T> {
    // Log operation start
    const logId = await this.logOperationStart(operationType, collection);
    
    try {
      // Execute operation
      const result = await operation();
      
      // Log operation complete
      if (resultMapper) {
        await this.logOperationComplete(logId, resultMapper(result));
      } else {
        // For operations without result mapping (fetch, enrich)
        await this.logOperationComplete(logId, {
          totalRecords: 0,
          successCount: 0,
          failureCount: 0,
        });
      }
      
      return result;
    } catch (error: any) {
      // Log operation failed
      await this.logOperationFailed(logId, error.message || 'Unknown error');
      throw error;
    }
  }

  /**
   * Log operation start via server action
   */
  private async logOperationStart(
    operationType: MigrationOperationType,
    collection: string
  ): Promise<string> {
    try {
      // Call server action to log operation start
      const response = await fetch('/api/migration/log-operation-start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationType,
          collection,
          userId: this.userId,
          userName: this.userName,
          organizationId: this.organizationId,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to log operation start');
      }
      
      const data = await response.json();
      return data.logId;
    } catch (error) {
      console.error('Failed to log operation start:', error);
      return 'unknown'; // Return placeholder ID if logging fails
    }
  }

  /**
   * Log operation complete via server action
   */
  private async logOperationComplete(
    logId: string,
    result: {
      totalRecords: number;
      successCount: number;
      failureCount: number;
      skippedCount?: number;
      errors?: Array<{ id: string; error: string }>;
      validationErrors?: Array<{ recordId: string; field: string; issue: string }>;
    }
  ): Promise<void> {
    try {
      await fetch('/api/migration/log-operation-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, result }),
      });
    } catch (error) {
      console.error('Failed to log operation complete:', error);
    }
  }

  /**
   * Log operation failed via server action
   */
  private async logOperationFailed(logId: string, error: string): Promise<void> {
    try {
      await fetch('/api/migration/log-operation-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, error }),
      });
    } catch (err) {
      console.error('Failed to log operation failure:', err);
    }
  }
}

/**
 * Create a monitored migration engine
 * 
 * @param firestore - Firestore instance
 * @param context - Optional user context for logging
 * @returns Monitored migration engine
 */
export function createMonitoredMigrationEngine(
  firestore: Firestore,
  context?: {
    userId?: string;
    userName?: string;
    organizationId?: string;
  }
): MigrationEngine {
  return new MonitoredMigrationEngine(firestore, context);
}
