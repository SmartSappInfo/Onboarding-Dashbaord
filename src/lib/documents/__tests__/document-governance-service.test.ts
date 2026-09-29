import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  applyLegalHoldToContract,
  releaseLegalHoldFromContract,
  checkContractDeletionEligibility,
  calculateRetentionExpiration,
  generateEvidencePackageManifest,
  LegalHoldActiveError,
} from '@/lib/documents/document-governance-service';

// Mock Firestore
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
        update: mockUpdate,
      })),
      get: mockGet,
    })),
  },
}));

describe('Governance, Legal Hold & Evidence Package Exporter (Phase 6)', () => {
  const workspaceId = 'ws_corp_legal';
  const contractId = 'con_master_agreement_01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Legal Hold Lifecycle & Deletion Prevention (FM-P6-03)', () => {
    it('applies legal hold to contract and stores reason and actor', async () => {
      mockUpdate.mockResolvedValueOnce(undefined);

      const hold = await applyLegalHoldToContract(workspaceId, contractId, {
        holdId: 'hold_sec_889',
        matterId: 'MATTER-2026-09',
        reason: 'DOJ preservation notice received',
        placedByUserId: 'usr_general_counsel',
      });

      expect(hold.isUnderLegalHold).toBe(true);
      expect(hold.matterId).toBe('MATTER-2026-09');
      expect(hold.placedByUserId).toBe('usr_general_counsel');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('releases legal hold from contract', async () => {
      mockUpdate.mockResolvedValueOnce(undefined);

      const released = await releaseLegalHoldFromContract(workspaceId, contractId, {
        releasedByUserId: 'usr_general_counsel',
      });

      expect(released.isUnderLegalHold).toBe(false);
      expect(released.releasedByUserId).toBe('usr_general_counsel');
      expect(released.releasedAt).toBeDefined();
    });

    it('rejects contract deletion when contract is under active legal hold', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: contractId,
          workspaceId,
          isUnderLegalHold: true,
          legalHoldDetails: {
            matterId: 'MATTER-LITIGATION-1',
            reason: 'Active subpoena',
          },
        }),
      });

      const check = await checkContractDeletionEligibility(workspaceId, contractId);
      expect(check.canDelete).toBe(false);
      expect(check.reason).toContain('Active subpoena');
    });

    it('allows contract deletion when legal hold is not active', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: contractId,
          workspaceId,
          isUnderLegalHold: false,
        }),
      });

      const check = await checkContractDeletionEligibility(workspaceId, contractId);
      expect(check.canDelete).toBe(true);
    });
  });

  describe('Statutory Retention Period Calculations', () => {
    const executedDateIso = '2026-01-01T00:00:00.000Z';

    it('calculates 7-year retention for financial and tax contracts', () => {
      const finExp = calculateRetentionExpiration('financial', executedDateIso);
      expect(finExp.getUTCFullYear()).toBe(2033);

      const taxExp = calculateRetentionExpiration('statutory_tax', executedDateIso);
      expect(taxExp.getUTCFullYear()).toBe(2033);
    });

    it('calculates 3-year retention for standard commercial agreements', () => {
      const stdExp = calculateRetentionExpiration('standard', executedDateIso);
      expect(stdExp.getUTCFullYear()).toBe(2029);
    });

    it('calculates 10-year retention for IP contracts and respects custom duration', () => {
      const ipExp = calculateRetentionExpiration('intellectual_property', executedDateIso);
      expect(ipExp.getUTCFullYear()).toBe(2036);

      const customExp = calculateRetentionExpiration('custom', executedDateIso, 15);
      expect(customExp.getUTCFullYear()).toBe(2041);
    });
  });

  describe('generateEvidencePackageManifest (FM-P6-06 Anti-Tampering)', () => {
    it('produces cryptographic manifest with matching 64-char SHA-256 hashes', () => {
      const docBuffer = Buffer.from('%PDF-1.4 Mock Contract Content', 'utf8');
      const certBuffer = Buffer.from('%PDF-1.4 Mock Completion Certificate', 'utf8');
      const auditEvents = [
        { type: 'envelope.created', timestamp: '2026-09-29T10:00:00.000Z' },
        { type: 'recipient.signed', timestamp: '2026-09-29T10:05:00.000Z' },
      ];

      const manifest = generateEvidencePackageManifest({
        workspaceId,
        contractId,
        envelopeId: 'env_991',
        documentBuffer: docBuffer,
        certificateBuffer: certBuffer,
        auditEvents,
      });

      expect(manifest.packageId).toContain('pkg_');
      expect(manifest.documentSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.certificateSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.overallChecksum).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.auditEventsCount).toBe(2);
    });
  });
});
