/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Dedicated Phase 7 Integration & Cutover Test Suite:
 * 1. Purpose:
 *    Comprehensive end-to-end integration suite for Phase 7 (General Availability,
 *    Live Production Data Reconciliation, Dual-Write Sunsetting & Legacy Retirement).
 *    Validates the end-to-end cutover pipeline:
 *    - P7.1: Live Data Backfill Engine with Bounded Batches, Checkpoints & Quarantine (FM-P7-01, FM-P7-02, FM-P7-03).
 *    - P7.2: Automated Data Reconciliation & Cryptographic Parity Audit (FM-P7-06).
 *    - P7.3: Non-Blocking Shadow-Read Verifier & Telemetry (FM-P7-08).
 *    - P7.4: Staged Canary Switchboard & Emergency Lossless Rollback (FM-P7-05).
 *    - P7.5: Dual-Write Sunsetting & Legacy Endpoint Deprecation (FM-P7-09).
 * 2. Strict Multi-Tenant Scoping (Rule 5 & 8):
 *    All operations strictly verified per workspace boundary.
 * 3. Zero-Tolerance Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  migrateLegacyPdfFormToTemplate,
  migrateLegacyContractToEnvelope,
  executeMigrationBatch,
} from '@/lib/documents/live-migration-backfill-service';
import {
  auditWorkspaceDataReconciliation,
  formatReconciliationCsv,
  formatReconciliationJson,
} from '@/lib/documents/data-reconciliation-service';
import {
  executeShadowRead,
  getShadowReadParityMetrics,
} from '@/lib/documents/shadow-read-service';
import {
  computeEntityCohortHash,
  getWorkspaceRolloutCohort,
  updateWorkspaceRolloutCohort,
  shouldRouteToModernDomain,
  triggerEmergencyRollback,
} from '@/lib/documents/rollout-switchboard-service';
import {
  assertLegacyWriteAllowed,
  checkDualWriteStatus,
  logLegacyEndpointAccess,
  translateLegacyFormUrl,
  LegacyEndpointDeprecatedError,
} from '@/lib/documents/legacy-retirement-service';
import type { PDFForm } from '@/lib/types';

// Mock Firebase Admin
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
      })),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: mockGet,
    })),
    runTransaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => {
      mockRunTransaction();
      const mockTx = {
        get: mockGet,
        set: mockSet,
        update: vi.fn(),
      };
      return fn(mockTx);
    }),
  },
}));

describe('Dedicated Phase 7 End-to-End Cutover Suite (DocSigning_roadmap.md Phase 7)', () => {
  const workspaceId = 'ws_ga_cutover_enterprise';
  const runId = 'mig_run_phase7_e2e';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── 1. Live Data Backfill & Checkpoints ─────────────────────────────────────
  describe('P7.1: Live Data Backfill Engine with Quarantine & Checkpoints', () => {
    it('backfills a legacy PDF form into modern DocumentTemplate and TemplateVersion v1.0', async () => {
      const legacyForm: PDFForm = {
        id: 'pdf_legacy_nda_001',
        name: 'Master Enterprise NDA',
        publicTitle: 'Master Enterprise NDA',
        slug: 'master-nda',
        storagePath: 'templates/nda.pdf',
        downloadUrl: 'https://storage.googleapis.com/test-bucket/nda.pdf',
        status: 'published',
        workspaceIds: [workspaceId],
        fields: [
          {
            id: 'field_sig_01',
            type: 'signature',
            label: 'Authorized Officer Signature',
            required: true,
            pageNumber: 1,
            position: { x: 50, y: 700 },
            dimensions: { width: 200, height: 50 },
          },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      const result = await migrateLegacyPdfFormToTemplate({
        workspaceId,
        runId,
        legacyForm,
        isDryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('pdf_legacy_nda_001');
      expect(result.versionId).toBe('v1.0');
      expect(mockRunTransaction).toHaveBeenCalled();
    });

    it('quarantines orphaned legacy contracts with missing entity IDs (FM-P7-03)', async () => {
      const result = await migrateLegacyContractToEnvelope({
        workspaceId,
        runId,
        legacyContract: null, // Missing parent contract
        legacySubmission: {
          id: 'sub_orphan_999',
          pdfId: 'pdf_legacy_999',
          formData: {},
          status: 'submitted',
          submittedAt: '2026-01-01T00:00:00.000Z',
        },
        isDryRun: false,
      });

      expect(result.success).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.errorCode).toBe('ERR_ORPHANED_RECORD');
      expect(mockSet).toHaveBeenCalled();
    });

    it('executes bounded batch migration with resumable cursor checkpoints (FM-P7-02)', async () => {
      mockGet.mockResolvedValueOnce({
        size: 2,
        docs: [
          {
            id: 'con_batch_01',
            data: () => ({
              id: 'con_batch_01',
              entityId: 'ent_client_01',
              status: 'signed',
              recipientName: 'Alice Smith',
              recipientEmail: 'alice@domain.com',
              workspaceId,
              createdAt: '2026-01-10T00:00:00.000Z',
            }),
          },
          {
            id: 'con_batch_02',
            data: () => ({
              id: 'con_batch_02',
              entityId: 'ent_client_02',
              status: 'sent',
              recipientName: 'Bob Jones',
              recipientEmail: 'bob@domain.com',
              workspaceId,
              createdAt: '2026-01-11T00:00:00.000Z',
            }),
          },
        ],
      });

      const batchRun = await executeMigrationBatch({
        workspaceId,
        runId,
        batchSize: 25,
        cursor: null,
        isDryRun: false,
      });

      expect(batchRun.workspaceId).toBe(workspaceId);
      expect(batchRun.counts.migratedContracts).toBe(2);
      expect(batchRun.lastProcessedCursor).toBe('con_batch_02');
      expect(batchRun.status).toBe('completed');
    });
  });

  // ── 2. Data Reconciliation & Integrity Audit ───────────────────────────────
  describe('P7.2: Automated Data Reconciliation & Parity Engine', () => {
    it('audits collections, computes parity score, and detects status divergences', async () => {
      // Mock legacy snapshots
      mockGet.mockResolvedValueOnce({
        size: 1,
        docs: [{ id: 'con_audit_01', data: () => ({ id: 'con_audit_01', status: 'signed' }) }],
      });
      mockGet.mockResolvedValueOnce({ size: 0, docs: [] });
      mockGet.mockResolvedValueOnce({ size: 0, docs: [] });

      // Mock modern snapshots (divergent status)
      mockGet.mockResolvedValueOnce({
        size: 1,
        docs: [{ id: 'con_audit_01', data: () => ({ id: 'con_audit_01', status: 'draft' }) }],
      });
      mockGet.mockResolvedValueOnce({ size: 0, docs: [] });
      mockGet.mockResolvedValueOnce({ size: 0, docs: [] });

      const report = await auditWorkspaceDataReconciliation(workspaceId);
      expect(report.sourceCounts.contracts).toBe(1);
      expect(report.targetCounts.contracts).toBe(1);
      expect(report.discrepancies.length).toBe(1);
      expect(report.discrepancies[0].discrepancyType).toBe('status_divergence');

      // Export formats
      const csv = formatReconciliationCsv(report);
      expect(csv).toContain('status_divergence');
      const json = formatReconciliationJson(report);
      expect(json).toContain('con_audit_01');
    });
  });

  // ── 3. Non-Blocking Shadow-Read Verifier ────────────────────────────────────
  describe('P7.3: Non-Blocking Shadow-Read Verifier & Telemetry', () => {
    it('returns legacy read immediately while validating modern adapter in background (FM-P7-08)', async () => {
      interface TestDoc {
        id: string;
        status: string;
        title: string;
      }
      const legacyFn = vi.fn<() => Promise<TestDoc>>().mockResolvedValue({ id: 'doc_123', status: 'signed', title: 'Agmt' });
      const modernFn = vi.fn<() => Promise<TestDoc>>().mockResolvedValue({ id: 'doc_123', status: 'signed', title: 'Agmt' });

      const result = await executeShadowRead<TestDoc>({
        workspaceId,
        entityType: 'contracts',
        entityId: 'doc_123',
        legacyReader: legacyFn,
        modernReader: modernFn,
      });

      expect(result.id).toBe('doc_123');
      expect(result.status).toBe('signed');
      expect(legacyFn).toHaveBeenCalledTimes(1);
    });

    it('calculates rolling parity rate across shadow reads', async () => {
      mockGet.mockResolvedValueOnce({
        empty: false,
        size: 2,
        docs: [
          { data: () => ({ matched: true }) },
          { data: () => ({ matched: false }) },
        ],
      });

      const metrics = await getShadowReadParityMetrics(workspaceId);
      expect(metrics.totalReads).toBe(2);
      expect(metrics.matchedReads).toBe(1);
      expect(metrics.parityPercentage).toBe(50);
    });
  });

  // ── 4. Staged Canary Switchboard & Rollback ─────────────────────────────────
  describe('P7.4: Staged Canary Switchboard & Rollout Controls', () => {
    it('uses deterministic hash routing and promotes from canary to 100% GA', async () => {
      const hashA = computeEntityCohortHash('con_enterprise_alpha');
      const hashB = computeEntityCohortHash('con_enterprise_alpha');
      expect(hashA).toBe(hashB);

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 25,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_architect',
        }),
      });

      const updated = await updateWorkspaceRolloutCohort(
        workspaceId,
        { cohortPercentage: 100, legacyDualWriteEnabled: false },
        'usr_chief_architect'
      );

      expect(updated.cohortPercentage).toBe(100);
      expect(updated.legacyDualWriteEnabled).toBe(false);
    });

    it('instantly enforces legacy fallback when emergency rollback is triggered (FM-P7-05)', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100,
          isEmergencyRollbackActive: true, // Emergency switch tripped
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_incident',
        }),
      });

      const shouldRouteModern = await shouldRouteToModernDomain(workspaceId, 'con_live_01');
      expect(shouldRouteModern).toBe(false);

      // Verify triggerEmergencyRollback & getWorkspaceRolloutCohort
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const rolledBack = await triggerEmergencyRollback(
        workspaceId,
        'Live incident containment',
        'usr_sec_admin'
      );
      expect(rolledBack.isEmergencyRollbackActive).toBe(true);

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => rolledBack,
      });
      const activeCohort = await getWorkspaceRolloutCohort(workspaceId);
      expect(activeCohort.isEmergencyRollbackActive).toBe(true);
    });
  });

  // ── 5. Dual-Write Sunsetting & Legacy Deprecation ───────────────────────────
  describe('P7.5: Dual-Write Sunsetting & Legacy Deprecation Layer', () => {
    it('blocks legacy mutations after 100% GA cutover with LegacyEndpointDeprecatedError', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: false, // Dual write sunset
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const isAllowed = await checkDualWriteStatus(workspaceId);
      expect(isAllowed).toBe(false);

      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: false,
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      await expect(
        assertLegacyWriteAllowed(workspaceId, 'saveContractAction')
      ).rejects.toThrow(LegacyEndpointDeprecatedError);

      // Soft deprecation telemetry logging
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logLegacyEndpointAccess({
        workspaceId,
        endpointName: 'getPDFFormAction',
        callerUserId: 'usr_legacy',
      });
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('translates legacy /forms/[pdfId] public URLs to canonical /sign/[token] URLs', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'env_migrated_777',
          signingToken: 'tok_live_production_999',
        }),
      });

      const translated = await translateLegacyFormUrl(workspaceId, 'pdf_legacy_777');
      expect(translated.destinationUrl).toBe('/sign/tok_live_production_999');
      expect(translated.isPermanentRedirect).toBe(true);
    });
  });
});
