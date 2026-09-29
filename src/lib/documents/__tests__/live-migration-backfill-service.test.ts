/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Live Data Backfill Service Test Suite (Phase 7):
 * 1. Purpose & Invariants:
 *    - Verifies zero-downtime bounded-batch migration of legacy PDFForm, Contract, and Submission records.
 *    - In-Flight Signature Race Mitigation (FM-P7-01): Transactions re-check timestamps before committing.
 *    - Rate-Limiting & Quota Contention (FM-P7-02): Batch size capped at 25 records with backpressure.
 *    - Orphaned Record Quarantine (FM-P7-03): Submissions without parent contracts are routed to quarantine.
 *    - Strict Tenant Boundary Isolation (FM-P7-04): Mismatched workspace IDs are barred from insertion.
 *    - Replay Event Loop Defense (FM-P7-07): Domain events carry isMigrationReplay = true.
 *    - Retention Expiration Calculation (FM-P7-12): Calculates and stamps retention dates.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  migrateLegacyPdfFormToTemplate,
  migrateLegacyContractToEnvelope,
  executeMigrationBatch,
} from '@/lib/documents/live-migration-backfill-service';
import { PDFForm, Contract, Submission } from '@/lib/types';

// Mock Firebase Admin
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();
const mockRunTransaction = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      })),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      get: mockGet,
    })),
    runTransaction: (fn: (transaction: unknown) => Promise<unknown>) => mockRunTransaction(fn),
  },
}));

describe('Live Migration Backfill Engine (Phase 7)', () => {
  const workspaceId = 'ws_enterprise_cutover_01';
  const runId = 'mig_run_alpha_01';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ exists: false, data: () => ({}) });
    mockRunTransaction.mockImplementation(async (callback) => {
      const mockTx = {
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      };
      return await callback(mockTx);
    });
  });

  describe('migrateLegacyPdfFormToTemplate', () => {
    const legacyForm: PDFForm = {
      id: 'pdf_legacy_001',
      name: 'Enterprise Master Services Agreement',
      publicTitle: 'Enterprise Master Services Agreement',
      slug: 'enterprise-msa',
      storagePath: 'templates/msa.pdf',
      downloadUrl: 'https://storage.googleapis.com/test-bucket/msa.pdf',
      status: 'published',
      workspaceIds: [workspaceId],
      fields: [
        {
          id: 'field_client_name',
          type: 'text',
          pageNumber: 1,
          position: { x: 10, y: 20 },
          dimensions: { width: 200, height: 30 },
          label: 'Client Legal Entity',
          required: true,
        },
      ],
      createdAt: '2025-01-15T10:00:00.000Z',
      updatedAt: '2025-01-15T10:00:00.000Z',
    };

    it('transforms legacy PDFForm into DocumentTemplate and version 1.0', async () => {
      const result = await migrateLegacyPdfFormToTemplate({
        workspaceId,
        runId,
        legacyForm,
        isDryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.templateId).toBe('pdf_legacy_001');
      expect(result.versionId).toBe('v1.0');

      // Verify transaction committed template and version documents
      expect(mockSet).toHaveBeenCalledTimes(2);
    });

    it('quarantines record if tenant workspaceId does not match (FM-P7-04)', async () => {
      const mismatchedForm: PDFForm = {
        ...legacyForm,
        workspaceIds: ['other_workspace_hacker'],
      };

      const result = await migrateLegacyPdfFormToTemplate({
        workspaceId,
        runId,
        legacyForm: mismatchedForm,
        isDryRun: false,
      });

      expect(result.success).toBe(false);
      expect(result.quarantined).toBe(true);
      expect(result.errorCode).toBe('ERR_TENANT_MISMATCH');
    });
  });

  describe('migrateLegacyContractToEnvelope', () => {
    const legacyContract: Contract = {
      id: 'con_legacy_888',
      entityId: 'ent_cyberdyne_01',
      entityName: 'Cyberdyne Systems',
      pdfId: 'pdf_legacy_001',
      pdfName: 'Enterprise Master Services Agreement',
      status: 'signed',
      recipients: [
        {
          name: 'Sarah Connor',
          email: 'sarah.connor@cyberdyne.com',
          type: 'signer',
        },
      ],
      storagePath: 'contracts/signed_msa.pdf',
      createdAt: '2025-06-01T12:00:00.000Z',
      updatedAt: '2025-06-01T12:30:00.000Z',
    };

    const legacySubmission: Submission = {
      id: 'sub_legacy_888',
      pdfId: 'pdf_legacy_001',
      status: 'submitted',
      submittedAt: '2025-06-01T12:30:00.000Z',
      formData: { field_client_name: 'Cyberdyne Systems' },
    };

    it('migrates legacy contract and submission to modern Contract and SigningEnvelope', async () => {
      const result = await migrateLegacyContractToEnvelope({
        workspaceId,
        runId,
        legacyContract,
        legacySubmission,
        isDryRun: false,
      });

      expect(result.success).toBe(true);
      expect(result.contractId).toBe('con_legacy_888');
      expect(result.envelopeId).toBeDefined();

      // Verify that statutory retention expiration is calculated (FM-P7-12)
      expect(result.retentionExpirationDate).toBeDefined();

      // Verify that transaction writes contract, envelope, and recipient
      expect(mockSet).toHaveBeenCalled();
    });

    it('quarantines submission if contract parent does not exist (FM-P7-03)', async () => {
      const orphanResult = await migrateLegacyContractToEnvelope({
        workspaceId,
        runId,
        legacyContract: null, // Missing parent contract
        legacySubmission,
        isDryRun: false,
      });

      expect(orphanResult.success).toBe(false);
      expect(orphanResult.quarantined).toBe(true);
      expect(orphanResult.errorCode).toBe('ERR_ORPHANED_RECORD');
    });

    it('handles dry-run mode without committing Firestore writes', async () => {
      const dryResult = await migrateLegacyContractToEnvelope({
        workspaceId,
        runId,
        legacyContract,
        legacySubmission,
        isDryRun: true,
      });

      expect(dryResult.success).toBe(true);
      expect(dryResult.isDryRun).toBe(true);
      expect(mockSet).not.toHaveBeenCalled();
    });
  });

  describe('executeMigrationBatch (FM-P7-02)', () => {
    it('executes a bounded batch and updates migration run cursor', async () => {
      // Mock contracts query returning 2 items
      mockGet.mockResolvedValueOnce({
        empty: false,
        size: 2,
        docs: [
          {
            id: 'con_batch_1',
            data: () => ({
              id: 'con_batch_1',
              workspaceId,
              status: 'draft',
              pdfTemplateId: 'tpl_1',
              createdAt: '2025-01-01T00:00:00.000Z',
              updatedAt: '2025-01-01T00:00:00.000Z',
            }),
          },
          {
            id: 'con_batch_2',
            data: () => ({
              id: 'con_batch_2',
              workspaceId,
              status: 'signed',
              pdfTemplateId: 'tpl_1',
              createdAt: '2025-01-02T00:00:00.000Z',
              updatedAt: '2025-01-02T00:00:00.000Z',
            }),
          },
        ],
      });

      const batchResult = await executeMigrationBatch({
        workspaceId,
        runId,
        batchSize: 25,
        cursor: null,
        isDryRun: false,
        initiatedByUserId: 'usr_migration_ops',
      });

      expect(batchResult.runId).toBe(runId);
      expect(batchResult.counts.migratedContracts).toBe(2);
      expect(batchResult.lastProcessedCursor).toBe('con_batch_2');
    });
  });
});
