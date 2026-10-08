/**
 * @fileOverview 4-Vector Adversarial Red-Team & Concurrency Chaos Test Battery (Phase 14 Milestone 2)
 *
 * Attacks & Scenarios tested:
 * - Attack Vector 1: Mid-flight concurrent modification / TOCTOU race detection (Rule 18)
 * - Attack Vector 2: Cryptographic SHA-256 state tampering / stealth attribute drift (Rule 22)
 * - Attack Vector 3: Dead-man switch emergency lockdown fail-closed (Rule 60)
 * - Attack Vector 4: Phantom deletion detection & Anti-IDOR cross-tenant probing (Rules 8, 47, 48)
 * - Chaos Scenarios: AbortSignal timeout / cancellation & key-order permutation determinism (Rules 11, 26)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  StateVersionService,
  StateConcurrencyError,
  type ResourceSnapshot,
} from '@/platform/verification/concurrency';
import { setGovernanceDeadManStateForTests } from '@/platform/policy/governance-dead-man';
import { sha256Hex } from '@/platform/capabilities/contracts/canonical-json';

describe('Phase 14 Milestone 2 - Concurrency Red-Team & Chaos Battery', () => {
  let service: StateVersionService;
  const orgId = 'org_enterprise_secure';
  const wsId = 'ws_finance_core';

  beforeEach(() => {
    service = new StateVersionService();
    setGovernanceDeadManStateForTests(null);
  });

  afterEach(() => {
    setGovernanceDeadManStateForTests(null);
  });

  // ==========================================================================
  // ATTACK VECTOR 1: Mid-flight Concurrent Modification / TOCTOU Race (Rule 18)
  // ==========================================================================
  describe('Attack Vector 1: TOCTOU Concurrency Race Conditions', () => {
    it('halts execution when competing worker updates resource mid-flight', async () => {
      // Step 2 (Predict): Worker A snapshots pre-mutation state
      const initialDeal = {
        title: 'Acme Enterprise Expansion',
        stage: 'PROPOSAL',
        stageVersion: 3,
        dealSize: 250000,
      };

      const workerASnapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_race_01',
        resourceData: initialDeal,
        organizationId: orgId,
        workspaceId: wsId,
      });

      // Worker B commits an update mid-flight before Worker A finishes
      const workerBUpdatedDeal = {
        title: 'Acme Enterprise Expansion',
        stage: 'NEGOTIATION',
        stageVersion: 4, // Incremented by Worker B
        dealSize: 275000,
      };

      // Step 5 (Commit): Worker A attempts to assert version currency
      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: workerASnapshot,
          currentResourceData: workerBUpdatedDeal,
          organizationId: orgId,
          workspaceId: wsId,
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent({
          expectedSnapshot: workerASnapshot,
          currentResourceData: workerBUpdatedDeal,
          organizationId: orgId,
          workspaceId: wsId,
        });
      } catch (err) {
        const error = err as StateConcurrencyError;
        expect(error.code).toBe('STALE_VERSION_DETECTED');
        expect(error.statusCode).toBe(409);
        expect(error.message).toContain('STALE_READ');
      }
    });

    it('detects concurrent mutation when version jumps significantly', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'invoice',
        resourceId: 'inv_race_02',
        resourceData: { version: 1, balance: 50000 },
        organizationId: orgId,
        workspaceId: wsId,
      });

      const validation = await service.validateResourceVersion({
        expectedSnapshot: snapshot,
        currentResourceData: { version: 9, balance: 0 },
        organizationId: orgId,
        workspaceId: wsId,
      });

      expect(validation.isCurrent).toBe(false);
      expect(validation.driftDetected).toBe(true);
      expect(validation.violationType).toBe('STALE_READ');
      expect(validation.actualVersion).toBe(9);
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 2: Cryptographic State Tampering & Stealth Drift (Rule 22)
  // ==========================================================================
  describe('Attack Vector 2: Cryptographic State Tampering & Stealth Drift', () => {
    it('detects out-of-band attribute tampering when version number is forged/unbumped', async () => {
      // Resource snapshot captured with high credit limit
      const legitimateAccount = {
        version: 1,
        accountName: 'Global Logistics Ltd',
        creditLimit: 1000000,
        kycVerified: true,
      };

      const snapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'crm_tamper_01',
        resourceData: legitimateAccount,
        organizationId: orgId,
        workspaceId: wsId,
      });

      // Attacker modifies creditLimit out-of-band without bumping version
      const tamperedAccount = {
        version: 1, // Stealth: version untouched!
        accountName: 'Global Logistics Ltd',
        creditLimit: 50000000, // Maliciously inflated!
        kycVerified: true,
      };

      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: tamperedAccount,
          organizationId: orgId,
          workspaceId: wsId,
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: tamperedAccount,
          organizationId: orgId,
          workspaceId: wsId,
        });
      } catch (err) {
        const error = err as StateConcurrencyError;
        expect(error.code).toBe('STATE_HASH_MISMATCH');
        expect(error.statusCode).toBe(409);
        expect(error.message).toContain('Cryptographic state hash mismatch');
      }
    });

    it('confirms mathematical determinism: key order perturbation does NOT cause false-positive drift (Rule 11)', async () => {
      const obj1 = { version: 1, alpha: 'A', beta: 'B', gamma: 'C' };
      const obj2 = { gamma: 'C', version: 1, beta: 'B', alpha: 'A' };

      expect(sha256Hex(obj1)).toBe(sha256Hex(obj2));

      const snapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'crm_order_01',
        resourceData: obj1,
        organizationId: orgId,
        workspaceId: wsId,
      });

      const validation = await service.validateResourceVersion({
        expectedSnapshot: snapshot,
        currentResourceData: obj2, // Reordered keys
        organizationId: orgId,
        workspaceId: wsId,
      });

      expect(validation.isCurrent).toBe(true);
      expect(validation.driftDetected).toBe(false);
      expect(validation.violationType).toBe('NONE');
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 3: Dead-Man Switch Emergency Lockdown (Rule 60)
  // ==========================================================================
  describe('Attack Vector 3: Dead-Man Switch Lockdown Fail-Closed', () => {
    it('halts both snapshot capture and version assertion when kill-switch is engaged', async () => {
      setGovernanceDeadManStateForTests(true);

      await expect(
        service.captureSnapshot({
          resourceType: 'deal',
          resourceId: 'deal_dead_01',
          resourceData: { stageVersion: 1 },
          organizationId: orgId,
          workspaceId: wsId,
        })
      ).rejects.toThrow(StateConcurrencyError);

      const fakeSnapshot: ResourceSnapshot = {
        resourceId: 'deal_dead_01',
        resourceType: 'deal',
        organizationId: orgId,
        workspaceId: wsId,
        version: 1,
        stateHash: '0'.repeat(64),
        capturedAt: new Date().toISOString(),
        attributes: {},
      };

      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: fakeSnapshot,
          currentResourceData: { stageVersion: 1 },
          organizationId: orgId,
          workspaceId: wsId,
        })
      ).rejects.toThrow(StateConcurrencyError);
    });
  });

  // ==========================================================================
  // ATTACK VECTOR 4: Phantom Deletion & Cross-Tenant Probing (Rules 8 & 47)
  // ==========================================================================
  describe('Attack Vector 4: Phantom Deletion & Cross-Tenant Probing', () => {
    it('detects phantom deletion and halts with 404 RESOURCE_NOT_FOUND', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'knowledge_fact',
        resourceId: 'fact_deleted_01',
        resourceData: { version: 1, statement: 'Important Policy' },
        organizationId: orgId,
        workspaceId: wsId,
      });

      // Target record was deleted from database
      await expect(
        service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: null,
          organizationId: orgId,
          workspaceId: wsId,
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent({
          expectedSnapshot: snapshot,
          currentResourceData: null,
          organizationId: orgId,
          workspaceId: wsId,
        });
      } catch (err) {
        const error = err as StateConcurrencyError;
        expect(error.code).toBe('RESOURCE_NOT_FOUND');
        expect(error.statusCode).toBe(404);
      }
    });

    it('rejects cross-organization snapshot verification with 403 IDOR_VIOLATION', async () => {
      const victimSnapshot = await service.captureSnapshot({
        resourceType: 'crm_entity',
        resourceId: 'victim_entity_99',
        resourceData: { version: 1, balance: 100000 },
        organizationId: 'org_victim_corp',
        workspaceId: 'ws_victim_main',
      });

      // Rogue agent tries to validate victim snapshot under attacker tenant context
      await expect(
        service.validateResourceVersion({
          expectedSnapshot: victimSnapshot,
          currentResourceData: { version: 1 },
          organizationId: 'org_attacker_corp',
          workspaceId: 'ws_attacker_main',
        })
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.validateResourceVersion({
          expectedSnapshot: victimSnapshot,
          currentResourceData: { version: 1 },
          organizationId: 'org_attacker_corp',
          workspaceId: 'ws_attacker_main',
        });
      } catch (err) {
        const error = err as StateConcurrencyError;
        expect(error.code).toBe('IDOR_VIOLATION');
        expect(error.statusCode).toBe(403);
      }
    });
  });

  // ==========================================================================
  // CHAOS SCENARIOS: Cancellation & Fault Injection (Rules 26 & 45)
  // ==========================================================================
  describe('Chaos Scenarios: Cooperative Cancellation & Timeouts', () => {
    it('aborts assertion immediately when AbortSignal fires', async () => {
      const snapshot = await service.captureSnapshot({
        resourceType: 'deal',
        resourceId: 'deal_chaos_01',
        resourceData: { stageVersion: 1 },
        organizationId: orgId,
        workspaceId: wsId,
      });

      const abortController = new AbortController();
      abortController.abort();

      await expect(
        service.assertVersionCurrent(
          {
            expectedSnapshot: snapshot,
            currentResourceData: { stageVersion: 1 },
            organizationId: orgId,
            workspaceId: wsId,
          },
          { signal: abortController.signal }
        )
      ).rejects.toThrow(StateConcurrencyError);

      try {
        await service.assertVersionCurrent(
          {
            expectedSnapshot: snapshot,
            currentResourceData: { stageVersion: 1 },
            organizationId: orgId,
            workspaceId: wsId,
          },
          { signal: abortController.signal }
        );
      } catch (err) {
        const error = err as StateConcurrencyError;
        expect(error.code).toBe('CONCURRENCY_TIMEOUT');
        expect(error.statusCode).toBe(504);
      }
    });
  });
});
