/**
 * @fileOverview Unit & Security Tests for Concurrency Server Actions (Phase 14 Milestone 2)
 *
 * Implements Rules 4, 8, 10, 18, 22, 47, 48, 51, 60, and 69.
 * Verifies:
 * - Session authentication guarding (requireAuth)
 * - Anti-IDOR multi-tenant boundary checks (assertTenantAccess)
 * - Emergency dead-man switch fail-closed semantics (CONCURRENCY_DEAD_MAN_PAUSED)
 * - Snapshot capture execution and structured result formatting
 * - Optimistic version verification and hash drift detection
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  captureResourceSnapshotAction,
  verifyResourceVersionAction,
} from '@/app/actions/concurrency-actions';
import { requireAuth } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(),
}));

vi.mock('@/platform/events/event-bus', () => ({
  defaultEventBus: {
    publish: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('Phase 14 Milestone 2 - Concurrency Server Actions', () => {
  const validOrgId = 'org_enterprise';
  const validWsId = 'ws_sales';
  const callerUid = 'usr_operator_1';

  beforeEach(() => {
    vi.restoreAllMocks();

    vi.mocked(requireAuth).mockResolvedValue({
      uid: callerUid,
      claims: { sub: callerUid },
      profile: {
        id: callerUid,
        email: 'operator@enterprise.com',
        role: 'admin',
        organizationId: validOrgId,
        lastActiveWorkspaceId: validWsId,
      },
      isSystemAdmin: false,
    } as unknown as Awaited<ReturnType<typeof requireAuth>>);

    vi.mocked(checkGovernanceDeadManSwitch).mockResolvedValue(undefined);
  });

  describe('captureResourceSnapshotAction', () => {
    it('captures snapshot and returns structured ConcurrencyActionResult', async () => {
      const result = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_100',
        resourceData: { version: 1, name: 'Big Corp', status: 'ACTIVE' },
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.resourceId).toBe('entity_100');
      expect(result.data?.version).toBe(1);
      expect(result.data?.stateHash).toHaveLength(64);
    });

    it('rejects unauthenticated caller with UNAUTHENTICATED', async () => {
      vi.mocked(requireAuth).mockRejectedValueOnce(new Error('Auth failed'));

      const result = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_100',
        resourceData: { version: 1 },
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('UNAUTHENTICATED');
    });

    it('enforces Anti-IDOR: rejects cross-tenant caller with IDOR_VIOLATION (Rules 8 & 47)', async () => {
      const result = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_100',
        resourceData: { version: 1 },
        organizationId: 'org_different_target', // Mismatch!
        workspaceId: validWsId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('IDOR_VIOLATION');
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(
        new Error('Platform dead-man paused')
      );

      const result = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_100',
        resourceData: { version: 1 },
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONCURRENCY_DEAD_MAN_PAUSED');
    });
  });

  describe('verifyResourceVersionAction', () => {
    it('validates current version without drift', async () => {
      const snapRes = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_200',
        resourceData: { version: 1, name: 'Startup Inc' },
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      expect(snapRes.success).toBe(true);
      const snapshot = snapRes.data!;

      const verifyRes = await verifyResourceVersionAction({
        expectedSnapshot: snapshot,
        currentResourceData: { version: 1, name: 'Startup Inc' },
        organizationId: validOrgId,
        workspaceId: validWsId,
        assertCurrent: false,
      });

      expect(verifyRes.success).toBe(true);
      expect(verifyRes.data?.isCurrent).toBe(true);
      expect(verifyRes.data?.driftDetected).toBe(false);
    });

    it('assertCurrent: true returns STALE_VERSION_DETECTED error on stale data', async () => {
      const snapRes = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_201',
        resourceData: { version: 1 },
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      const verifyRes = await verifyResourceVersionAction({
        expectedSnapshot: snapRes.data!,
        currentResourceData: { version: 2 },
        organizationId: validOrgId,
        workspaceId: validWsId,
        assertCurrent: true,
      });

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error?.code).toBe('STALE_VERSION_DETECTED');
    });

    it('assertCurrent: true returns STATE_HASH_MISMATCH on stealth attribute drift (Rule 22)', async () => {
      const snapRes = await captureResourceSnapshotAction({
        resourceType: 'crm_entity',
        resourceId: 'entity_202',
        resourceData: { version: 1, score: 95 },
        organizationId: validOrgId,
        workspaceId: validWsId,
      });

      const verifyRes = await verifyResourceVersionAction({
        expectedSnapshot: snapRes.data!,
        currentResourceData: { version: 1, score: 50 }, // Hash drifted!
        organizationId: validOrgId,
        workspaceId: validWsId,
        assertCurrent: true,
      });

      expect(verifyRes.success).toBe(false);
      expect(verifyRes.error?.code).toBe('STATE_HASH_MISMATCH');
    });
  });
});
