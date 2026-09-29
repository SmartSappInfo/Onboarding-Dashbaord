/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10 Maintainer Guidance):
 *
 * Staged Canary Switchboard & Rollout Controls Test Suite (Phase 7):
 * 1. Purpose:
 *    Validates the staged rollout switchboard:
 *    - Deterministic hashing routing (cohort 0% to 100% GA).
 *    - Emergency 1-Click Rollback (FM-P7-05): Instant reversion to legacy compatibility mode.
 *    - Strict Multi-Tenant Scoping (Rule 5 & 8): Cohort settings partition per workspace.
 * 2. Strict Typing (Rule 4):
 *    Strictly zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkspaceRolloutCohort,
  updateWorkspaceRolloutCohort,
  shouldRouteToModernDomain,
  triggerEmergencyRollback,
  computeEntityCohortHash,
} from '@/lib/documents/rollout-switchboard-service';

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
    })),
  },
}));

describe('Staged Canary Switchboard & Rollout Controls (Phase 7)', () => {
  const workspaceId = 'ws_enterprise_cutover_01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('computeEntityCohortHash', () => {
    it('computes deterministic integer modulo 100 for identical input IDs', () => {
      const hash1 = computeEntityCohortHash('con_enterprise_42');
      const hash2 = computeEntityCohortHash('con_enterprise_42');
      expect(hash1).toBe(hash2);
      expect(hash1).toBeGreaterThanOrEqual(0);
      expect(hash1).toBeLessThan(100);
    });
  });

  describe('getWorkspaceRolloutCohort', () => {
    it('returns default 0% cohort when no config exists', async () => {
      mockGet.mockResolvedValueOnce({
        exists: false,
      });

      const config = await getWorkspaceRolloutCohort(workspaceId);
      expect(config.workspaceId).toBe(workspaceId);
      expect(config.cohortPercentage).toBe(0);
      expect(config.isEmergencyRollbackActive).toBe(false);
      expect(config.legacyDualWriteEnabled).toBe(true);
    });

    it('returns stored cohort configuration when valid doc exists', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 25,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const config = await getWorkspaceRolloutCohort(workspaceId);
      expect(config.cohortPercentage).toBe(25);
    });
  });

  describe('shouldRouteToModernDomain', () => {
    it('always routes to legacy (false) when cohort percentage is 0%', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 0,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const shouldRoute = await shouldRouteToModernDomain(workspaceId, 'con_test_01');
      expect(shouldRoute).toBe(false);
    });

    it('always routes to modern (true) when cohort percentage is 100% GA', async () => {
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

      const shouldRoute = await shouldRouteToModernDomain(workspaceId, 'con_test_01');
      expect(shouldRoute).toBe(true);
    });

    it('immediately forces legacy routing when emergency rollback is active (FM-P7-05)', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 100, // Even if cohort is 100%
          isEmergencyRollbackActive: true, // Emergency switch tripped
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: false,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const shouldRoute = await shouldRouteToModernDomain(workspaceId, 'con_critical_01');
      expect(shouldRoute).toBe(false);
    });
  });

  describe('updateWorkspaceRolloutCohort & triggerEmergencyRollback', () => {
    it('updates cohort percentage and persists to Firestore', async () => {
      mockGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          workspaceId,
          cohortPercentage: 10,
          isEmergencyRollbackActive: false,
          legacyDualWriteEnabled: true,
          shadowReadsEnabled: true,
          updatedAt: new Date().toISOString(),
          updatedByUserId: 'usr_admin',
        }),
      });

      const updated = await updateWorkspaceRolloutCohort(
        workspaceId,
        { cohortPercentage: 50 },
        'usr_lead_architect'
      );

      expect(updated.cohortPercentage).toBe(50);
      expect(mockSet).toHaveBeenCalled();
    });

    it('triggers emergency rollback setting isEmergencyRollbackActive to true', async () => {
      mockGet.mockResolvedValueOnce({
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

      const rolledBack = await triggerEmergencyRollback(
        workspaceId,
        'Downstream ERP connectivity failure detected',
        'usr_incident_responder'
      );

      expect(rolledBack.isEmergencyRollbackActive).toBe(true);
      expect(mockSet).toHaveBeenCalled();
    });
  });
});
