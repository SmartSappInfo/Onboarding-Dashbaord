/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Phase 7 Master Schemas Test Suite (Migration, Reconciliation & Rollout):
 * 1. Purpose:
 *    Validates the runtime Zod contracts for Phase 7 General Availability capabilities:
 *    - MigrationRunSchema: tracks live bounded-batch backfill runs, cursors, and metrics
 *    - MigrationQuarantineRecordSchema: isolates malformed or orphaned legacy records (FM-P7-03)
 *    - ReconciliationReportSchema: records automated parity audits and cryptographic checksums
 *    - RolloutCohortConfigSchema: controls canary traffic routing and emergency rollback (FM-P7-05)
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  MigrationRunSchema,
  MigrationQuarantineRecordSchema,
  ReconciliationReportSchema,
  RolloutCohortConfigSchema,
} from '@/lib/types/document-signing';

describe('Phase 7 Domain Schemas: Migration, Reconciliation & Rollout', () => {
  const workspaceId = 'ws_enterprise_cutover_01';

  describe('MigrationRunSchema', () => {
    it('validates a valid in-progress migration run payload', () => {
      const validPayload = {
        runId: 'mig_run_12345',
        workspaceId,
        isDryRun: false,
        status: 'in_progress',
        counts: {
          totalContracts: 500,
          migratedContracts: 250,
          totalTemplates: 20,
          migratedTemplates: 20,
          totalSubmissions: 500,
          migratedSubmissions: 250,
          quarantinedCount: 2,
          skippedCount: 0,
        },
        lastProcessedCursor: 'con_legacy_250',
        startedAt: new Date().toISOString(),
        completedAt: null,
        initiatedByUserId: 'usr_admin_ops',
        errorMessage: null,
      };

      const parsed = MigrationRunSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.runId).toBe('mig_run_12345');
        expect(parsed.data.status).toBe('in_progress');
      }
    });

    it('rejects an invalid migration run status', () => {
      const invalidPayload = {
        runId: 'mig_run_123',
        workspaceId,
        isDryRun: true,
        status: 'invalid_status_type',
        counts: {
          totalContracts: 10,
          migratedContracts: 0,
          totalTemplates: 1,
          migratedTemplates: 0,
          totalSubmissions: 10,
          migratedSubmissions: 0,
          quarantinedCount: 0,
          skippedCount: 0,
        },
        lastProcessedCursor: null,
        startedAt: new Date().toISOString(),
        completedAt: null,
        initiatedByUserId: 'usr_admin',
        errorMessage: null,
      };

      const parsed = MigrationRunSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('MigrationQuarantineRecordSchema (FM-P7-03)', () => {
    it('validates a properly formatted quarantine record', () => {
      const validPayload = {
        quarantineId: 'quar_98765',
        workspaceId,
        runId: 'mig_run_12345',
        sourceCollection: 'contract_submissions',
        sourceRecordId: 'sub_orphan_001',
        errorCode: 'ERR_ORPHANED_RECORD',
        reason: 'Parent contract con_missing_999 does not exist in workspace',
        rawPayload: { legacyField: 'test', submissionId: 'sub_orphan_001' },
        quarantinedAt: new Date().toISOString(),
        resolved: false,
        resolvedAt: null,
      };

      const parsed = MigrationQuarantineRecordSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.errorCode).toBe('ERR_ORPHANED_RECORD');
      }
    });

    it('rejects unrecognized error codes', () => {
      const invalidPayload = {
        quarantineId: 'quar_1',
        workspaceId,
        runId: 'mig_run_1',
        sourceCollection: 'contracts',
        sourceRecordId: 'con_1',
        errorCode: 'UNRECOGNIZED_CODE',
        reason: 'Random error',
        rawPayload: {},
        quarantinedAt: new Date().toISOString(),
        resolved: false,
        resolvedAt: null,
      };

      const parsed = MigrationQuarantineRecordSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe('ReconciliationReportSchema', () => {
    it('validates a complete reconciliation report with zero discrepancies', () => {
      const validPayload = {
        reportId: 'rec_rpt_2026_09',
        workspaceId,
        generatedAt: new Date().toISOString(),
        sourceCounts: {
          contracts: 100,
          templates: 10,
          submissions: 100,
        },
        targetCounts: {
          contracts: 100,
          templates: 10,
          envelopes: 100,
        },
        parityPercentage: 100.0,
        artifactParityPercentage: 100.0,
        discrepancies: [],
        status: 'perfect_parity',
      };

      const parsed = ReconciliationReportSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.parityPercentage).toBe(100.0);
        expect(parsed.data.status).toBe('perfect_parity');
      }
    });

    it('validates a report with discrepancies', () => {
      const reportWithDiscrepancy = {
        reportId: 'rec_rpt_divergent',
        workspaceId,
        generatedAt: new Date().toISOString(),
        sourceCounts: {
          contracts: 100,
          templates: 10,
          submissions: 100,
        },
        targetCounts: {
          contracts: 99,
          templates: 10,
          envelopes: 99,
        },
        parityPercentage: 99.0,
        artifactParityPercentage: 99.0,
        discrepancies: [
          {
            recordId: 'con_legacy_42',
            entityType: 'contract',
            discrepancyType: 'missing_target',
            expected: 'modern_contract_instance',
            actual: 'null',
            detectedAt: new Date().toISOString(),
          },
        ],
        status: 'discrepancies_detected',
      };

      const parsed = ReconciliationReportSchema.safeParse(reportWithDiscrepancy);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.discrepancies.length).toBe(1);
        expect(parsed.data.status).toBe('discrepancies_detected');
      }
    });
  });

  describe('RolloutCohortConfigSchema (FM-P7-05)', () => {
    it('validates a valid canary rollout configuration', () => {
      const validPayload = {
        workspaceId,
        cohortPercentage: 25,
        isEmergencyRollbackActive: false,
        legacyDualWriteEnabled: true,
        shadowReadsEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedByUserId: 'usr_devops_lead',
      };

      const parsed = RolloutCohortConfigSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.cohortPercentage).toBe(25);
        expect(parsed.data.isEmergencyRollbackActive).toBe(false);
      }
    });

    it('rejects cohort percentages out of bounds (<0 or >100)', () => {
      const outOfBoundsPayload = {
        workspaceId,
        cohortPercentage: 150,
        isEmergencyRollbackActive: false,
        legacyDualWriteEnabled: true,
        shadowReadsEnabled: true,
        updatedAt: new Date().toISOString(),
        updatedByUserId: 'usr_admin',
      };

      const parsed = RolloutCohortConfigSchema.safeParse(outOfBoundsPayload);
      expect(parsed.success).toBe(false);
    });
  });
});
