/**
 * @fileOverview Unit & Integration Tests for StateVersionService & TOCTOU Optimistic Guard (Phase 14 Milestone 2)
 *
 * Rules verified:
 * - Rule 4 (Strict Typing): Zero any
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Lock): Strict tenant boundary checks
 * - Rule 18 (TOCTOU Optimistic Concurrency Guard): Drift and version detection
 * - Rule 22 (Cryptographic Hash Binding): SHA-256 stealth drift detection
 * - Rule 26 (Cooperative Cancellation): AbortSignal cancellation
 * - Rule 60 (Emergency Dead-Man Switch): Immediate fail-closed on active pause
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StateVersionService,
  getStateVersionService,
  StateConcurrencyError,
} from '@/platform/verification/concurrency';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';

describe('Phase 14 Milestone 2 - StateVersionService', () => {
  let service: StateVersionService;

  beforeEach(() => {
    service = new StateVersionService();
    setGovernanceDeadManStateForTests(null);
  });

  afterEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  describe('captureSnapshot', () => {
    it('captures a valid snapshot for a crm_entity with deterministic SHA-256 hash', async () => {
      const entityData = {
        firstName: 'Alice',
        lastName: 'Wonderland',
        version: 1,
        status: 'ACTIVE',
      };

      const snapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'entity_001',
        resourceData: entityData,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(snapshot.resourceId).toBe('entity_001');
      expect(snapshot.resourceType).toBe('crm_entity');
      expect(snapshot.version).toBe(1);
      expect(snapshot.stateHash).toHaveLength(64);
      expect(snapshot.organizationId).toBe('org_test_1');
      expect(snapshot.workspaceId).toBe('ws_test_1');
      expect(snapshot.attributes).toEqual(entityData);
    });

    it('resolves stageVersion field for deal resource', async () => {
      const dealData = {
        title: 'Enterprise License',
        stage: 'PROPOSAL',
        stageVersion: 4,
        value: 120000,
      };

      const snapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_001',
        resourceData: dealData,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(snapshot.version).toBe(4);
    });

    it('rejects capture with invalid context (missing tenant IDs)', async () => {
      await expect(
        service.captureSnapshot({
          resourceType: 'crm_entity',
          resourceId: 'entity_001',
          resourceData: { version: 1 },
          organizationId: '',
          workspaceId: 'ws_test_1',
        })
      ).rejects.toThrow(StateConcurrencyError);
    });

    it('fails closed immediately when emergency dead-man switch is active (Rule 60)', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(
        service.captureSnapshot({
          resourceType: 'crm_entity',
          resourceId: 'entity_001',
          resourceData: { version: 1 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.captureSnapshot({
          resourceType: 'crm_entity',
          resourceId: 'entity_001',
          resourceData: { version: 1 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        });
      } catch (err) {
        expect((err as StateConcurrencyError).code).toBe('CONCURRENCY_DEAD_MAN_PAUSED');
        expect((err as StateConcurrencyError).statusCode).toBe(503);
      }
    });

    it('honors cooperative cancellation via AbortSignal (Rule 26)', async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        service.captureSnapshot(
          {
            resourceType: 'crm_entity',
            resourceId: 'entity_001',
            resourceData: { version: 1 },
            organizationId: 'org_test_1',
            workspaceId: 'ws_test_1',
          },
          { signal: controller.signal }
        )
      ).rejects.toThrow(StateConcurrencyError);
    });
  });

  describe('validateResourceVersion', () => {
    it('returns isCurrent: true when live data matches snapshot', async () => {
      const data = { version: 2, title: 'Contract Draft', amount: 5000 };
      const snapshot = await service.captureSnapshot({
        resourceType: 'invoice',
        resourceId: 'inv_001',
        resourceData: data,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      const validation = await service.validateResourceVersion({
        expectedSnapshot: snapshot,
        currentResourceData: { ...data },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(validation.isCurrent).toBe(true);
      expect(validation.driftDetected).toBe(false);
      expect(validation.violationType).toBe('NONE');
      expect(validation.actualVersion).toBe(2);
    });

    it('detects STALE_READ when actualVersion > expectedVersion', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'invoice',
        resourceId: 'inv_001',
        resourceData: { version: 2, amount: 5000 },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      const validation = await service.validateResourceVersion({
        expectedSnapshot: snapshot,
        currentResourceData: { version: 3, amount: 5000 },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(validation.isCurrent).toBe(false);
      expect(validation.driftDetected).toBe(true);
      expect(validation.violationType).toBe('STALE_READ');
      expect(validation.actualVersion).toBe(3);
    });

    it('detects DELETED_RESOURCE when live resource data is null', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'entity_deleted',
        resourceData: { version: 1, name: 'Ghost' },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      const validation = await service.validateResourceVersion({
        expectedSnapshot: snapshot,
        currentResourceData: null,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(validation.isCurrent).toBe(false);
      expect(validation.actualVersion).toBeNull();
      expect(validation.violationType).toBe('DELETED_RESOURCE');
    });

    it('detects HASH_DRIFT when version was unbumped but attributes changed (Rule 22)', async () => {
      const originalData = { version: 1, name: 'Normal Client', creditScore: 700 };
      const snapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'entity_002',
        resourceData: originalData,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      // Sneaky out-of-band edit: version remains 1, but creditScore was modified
      const tamperedData = { version: 1, name: 'Normal Client', creditScore: 400 };

      const validation = await service.validateResourceVersion({
        expectedSnapshot: snapshot,
        currentResourceData: tamperedData,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(validation.isCurrent).toBe(false);
      expect(validation.driftDetected).toBe(true);
      expect(validation.violationType).toBe('HASH_DRIFT');
    });

    it('enforces Anti-IDOR multi-tenant check strictly (Rules 8 & 47)', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'entity_003',
        resourceData: { version: 1 },
        organizationId: 'org_victim',
        workspaceId: 'ws_victim',
      });

      await expect(
        service.validateResourceVersion({
          expectedSnapshot: snapshot,
          currentResourceData: { version: 1 },
          organizationId: 'org_attacker', // Mismatch!
          workspaceId: 'ws_victim',
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.validateResourceVersion({
          expectedSnapshot: snapshot,
          currentResourceData: { version: 1 },
          organizationId: 'org_attacker',
          workspaceId: 'ws_victim',
        });
      } catch (err) {
        expect((err as StateConcurrencyError).code).toBe('IDOR_VIOLATION');
        expect((err as StateConcurrencyError).statusCode).toBe(403);
      }
    });
  });

  describe('assertVersionCurrent', () => {
    it('returns result successfully when resource is current', async () => {
      const data = { version: 1, stageVersion: 1, name: 'Deal Alpha' };
      const snapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_100',
        resourceData: data,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      const res = await service.assertVersionCurrent({
        expectedSnapshot: snapshot,
        currentResourceData: data,
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      expect(res.isCurrent).toBe(true);
    });

    it('throws 409 STALE_VERSION_DETECTED on stale version', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_101',
        resourceData: { stageVersion: 1 },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: { stageVersion: 2 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: { stageVersion: 2 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        });
      } catch (err) {
        expect((err as StateConcurrencyError).code).toBe('STALE_VERSION_DETECTED');
        expect((err as StateConcurrencyError).statusCode).toBe(409);
      }
    });

    it('throws 409 STATE_HASH_MISMATCH on hash drift', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_102',
        resourceData: { stageVersion: 1, dealSize: 1000 },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: { stageVersion: 1, dealSize: 2000 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: { stageVersion: 1, dealSize: 2000 },
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        });
      } catch (err) {
        expect((err as StateConcurrencyError).code).toBe('STATE_HASH_MISMATCH');
        expect((err as StateConcurrencyError).statusCode).toBe(409);
      }
    });

    it('throws 404 RESOURCE_NOT_FOUND on deleted resource', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_103',
        resourceData: { stageVersion: 1 },
        organizationId: 'org_test_1',
        workspaceId: 'ws_test_1',
      });

      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: null,
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: null,
          organizationId: 'org_test_1',
          workspaceId: 'ws_test_1',
        });
      } catch (err) {
        expect((err as StateConcurrencyError).code).toBe('RESOURCE_NOT_FOUND');
        expect((err as StateConcurrencyError).statusCode).toBe(404);
      }
    });
  });

  describe('Singleton Access', () => {
    it('returns a consistent singleton instance via getStateVersionService()', () => {
      const s1 = getStateVersionService();
      const s2 = getStateVersionService();
      expect(s1).toBe(s2);
      expect(s1 instanceof StateVersionService).toBe(true);
    });
  });
});
