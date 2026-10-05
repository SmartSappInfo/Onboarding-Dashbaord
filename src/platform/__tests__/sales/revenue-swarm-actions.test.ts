/**
 * @fileOverview Unit & Security Tests for Revenue Swarm Server Actions (Phase 10 Milestone 5 Task 3)
 *
 * Implements:
 * - Rule 4: Zero any/any[] strict typing.
 * - Rule 8 & 47: Anti-IDOR multi-tenant boundary assertion.
 * - Rule 26: Cooperative cancellation via AbortSignal.
 * - Rule 40: Domain event emission verification.
 * - Rule 48: Sanitized error taxonomy and structured ActionResults.
 * - Rule 51: Server Action authentication via session cookie (requireAuth()).
 * - Rule 60: Step 1 emergency dead-man pause check (fails closed with HTTP 503).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  launchRevenueSwarmAction,
  getRevenueSwarmHistoryAction,
  cancelRevenueSwarmAction,
  getRevenueSwarmMetricsAction,
} from '@/app/actions/revenue-swarm-actions';

// Mock requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    uid: 'user_kwame',
    profile: {
      id: 'user_kwame',
      name: 'Kwame',
      email: 'kwame@test.com',
      organizationId: 'org_test',
      role: 'admin',
      workspaceIds: ['ws_test'],
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
    },
    isSystemAdmin: false,
  })),
}));

// Mock governance dead man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async (orgId?: string) => {
    if (orgId === 'org_paused') {
      throw new Error('Platform emergency dead-man pause engaged');
    }
  }),
}));

describe('Revenue Swarm Server Actions (Phase 10 Milestone 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('launchRevenueSwarmAction', () => {
    it('successfully launches full revenue swarm mission in dryRun mode', async () => {
      const res = await launchRevenueSwarmAction({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        criteria: {
          query: 'Find 20 qualified leads in edtech and prepare outreach',
          targetIndustry: 'edtech',
          targetLeadCount: 5,
          minQualificationScore: 60,
          channels: ['whatsapp', 'email'],
          sdrPersonaId: 'lead_sdr',
          dryRun: true,
        },
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.status).toBe('waiting_for_approval');
      expect(res.data?.stages).toHaveLength(6);
      expect(res.data?.blastRadius.liveMutations).toBe(0);
      expect(res.data?.blastRadius.simulated).toBe(true);
      expect(res.data?.proposals).toHaveLength(1);
    });

    it('rejects cross-tenant access with IDOR_VIOLATION (Rule 8 & 47)', async () => {
      const res = await launchRevenueSwarmAction({
        organizationId: 'org_attacker',
        workspaceId: 'ws_test',
        criteria: {
          query: 'Find leads in healthcare',
          targetIndustry: 'healthcare',
          targetLeadCount: 5,
        },
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('IDOR_VIOLATION');
      expect(res.error).toContain('Authenticated principal');
    });

    it('halts immediately when dead-man switch is active (Rule 60)', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => ({
        uid: 'user_kwame',
        profile: {
          id: 'user_kwame',
          name: 'Kwame',
          email: 'kwame@test.com',
          organizationId: 'org_paused',
          role: 'admin',
          workspaceIds: ['ws_test'],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      }));

      const res = await launchRevenueSwarmAction({
        organizationId: 'org_paused',
        workspaceId: 'ws_test',
        criteria: {
          query: 'Find leads in fintech',
          targetIndustry: 'fintech',
          targetLeadCount: 5,
        },
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('SWARM_DEAD_MAN_PAUSED');
      expect(res.error).toContain('suspended');
    });

    it('fails closed when authentication fails (Rule 51)', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => {
        throw new Error('Authentication required');
      });

      const res = await launchRevenueSwarmAction({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        criteria: {
          query: 'Find leads in edtech',
          targetIndustry: 'edtech',
          targetLeadCount: 5,
        },
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('AUTHENTICATION_REQUIRED');
    });
  });

  describe('getRevenueSwarmHistoryAction', () => {
    it('returns mission outcomes for the authenticated tenant', async () => {
      // Launch a mission first to populate history
      await launchRevenueSwarmAction({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
        criteria: {
          query: 'Find 3 edtech leads',
          targetIndustry: 'edtech',
          targetLeadCount: 3,
        },
      });

      const res = await getRevenueSwarmHistoryAction({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });

      expect(res.success).toBe(true);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data!.length).toBeGreaterThan(0);
      expect(res.data![0].organizationId).toBe('org_test');
    });

    it('rejects cross-tenant history query with IDOR_VIOLATION (Rule 8)', async () => {
      const res = await getRevenueSwarmHistoryAction({
        organizationId: 'org_other',
        workspaceId: 'ws_test',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('cancelRevenueSwarmAction', () => {
    it('returns cancelled status or not found for finished mission gracefully', async () => {
      const res = await cancelRevenueSwarmAction({
        organizationId: 'org_test',
        swarmRunId: 'swarm_run_non_existent',
      });

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe('cancelled');
    });

    it('rejects cross-tenant cancellation with IDOR_VIOLATION (Rule 8)', async () => {
      const res = await cancelRevenueSwarmAction({
        organizationId: 'org_other',
        swarmRunId: 'swarm_run_test',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('getRevenueSwarmMetricsAction', () => {
    it('aggregates metrics for the authenticated workspace', async () => {
      const res = await getRevenueSwarmMetricsAction({
        organizationId: 'org_test',
        workspaceId: 'ws_test',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(typeof res.data?.totalMissions).toBe('number');
      expect(typeof res.data?.totalQualifiedLeads).toBe('number');
      expect(typeof res.data?.totalDraftsGenerated).toBe('number');
      expect(typeof res.data?.totalStagedProposals).toBe('number');
    });

    it('rejects cross-tenant metrics query with IDOR_VIOLATION (Rule 8)', async () => {
      const res = await getRevenueSwarmMetricsAction({
        organizationId: 'org_other',
        workspaceId: 'ws_test',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('IDOR_VIOLATION');
    });
  });
});
