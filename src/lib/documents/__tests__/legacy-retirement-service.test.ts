/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Dual-Write Sunsetting & Legacy Deprecation Layer Test Suite (Phase 7):
 * 1. Purpose:
 *    Validates the graceful sunsetting of legacy contracts/PDF endpoints:
 *    - Soft-deprecation logging & auto-projection to modern domain (FM-P7-09).
 *    - Hard cutover rejection: Throws LegacyEndpointDeprecatedError when dual-write is disabled.
 *    - Perpetual public URL translation: Resolves legacy `/forms/[pdfId]` to modern `/sign/[token]`.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  assertLegacyWriteAllowed,
  LegacyEndpointDeprecatedError,
  logLegacyEndpointAccess,
  translateLegacyFormUrl,
  checkDualWriteStatus,
} from '@/lib/documents/legacy-retirement-service';

// Mock Firebase Admin
const mockGet = vi.fn();
const mockSet = vi.fn();

vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: mockGet,
        set: mockSet,
      })),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    })),
  },
}));

describe('Dual-Write Sunsetting & Legacy Deprecation Layer (Phase 7)', () => {
  const workspaceId = 'ws_enterprise_cutover_01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('assertLegacyWriteAllowed & checkDualWriteStatus', () => {
    it('allows legacy writes when legacyDualWriteEnabled is true', async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 50,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const isAllowed = await checkDualWriteStatus(workspaceId);
      expect(isAllowed).toBe(true);

      // Should not throw
      await expect(
        assertLegacyWriteAllowed(workspaceId, 'saveContractAction')
      ).resolves.not.toThrow();
    });

    it('rejects legacy writes with LegacyEndpointDeprecatedError when dual-write is disabled (Hard Cutover)', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: false, // Dual write sunset!
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      await expect(
        assertLegacyWriteAllowed(workspaceId, 'saveContractAction')
      ).rejects.toThrow(LegacyEndpointDeprecatedError);
    });

    it('allows writes if emergency rollback is triggered even if dual-write was previously disabled', async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100,
          isEmergencyRollbackActive: true, // Emergency rollback active
          legacyDualWriteEnabled: false,
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const isAllowed = await checkDualWriteStatus(workspaceId);
      expect(isAllowed).toBe(true);
      await expect(
        assertLegacyWriteAllowed(workspaceId, 'saveContractAction')
      ).resolves.not.toThrow();
    });
  });

  describe('logLegacyEndpointAccess', () => {
    it('logs soft-deprecation telemetry without throwing an error', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logLegacyEndpointAccess({
        workspaceId,
        endpointName: 'getPDFFormAction',
        callerUserId: 'usr_legacy_client',
        entityId: 'pdf_legacy_99',
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DEPRECATION WARNING] Legacy endpoint called: getPDFFormAction')
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe('translateLegacyFormUrl', () => {
    it('translates legacy /forms/[pdfId] path to canonical /sign/[token] path', async () => {
      // Mock looking up the signing envelope or agreement by legacy form ID
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          id: 'env_migrated_456',
          legacyPdfFormId: 'pdf_legacy_form_123',
          signingToken: 'tok_sec_secure_access_789',
          status: 'pending',
        }),
      });

      const translated = await translateLegacyFormUrl(
        workspaceId,
        'pdf_legacy_form_123'
      );

      expect(translated.destinationUrl).toBe('/sign/tok_sec_secure_access_789');
      expect(translated.isPermanentRedirect).toBe(true);
      expect(translated.envelopeId).toBe('env_migrated_456');
    });

    it('falls back to legacy /forms/[pdfId] if no modern envelope mapping exists yet', async () => {
      mockGet.mockResolvedValueOnce({
        exists: false,
      });

      const translated = await translateLegacyFormUrl(
        workspaceId,
        'pdf_unmigrated_999'
      );

      expect(translated.destinationUrl).toBe('/forms/pdf_unmigrated_999');
      expect(translated.isPermanentRedirect).toBe(false);
      expect(translated.envelopeId).toBeNull();
    });
  });
});
