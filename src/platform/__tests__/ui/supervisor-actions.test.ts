// @vitest-environment node
/**
 * @fileOverview Unit & Security Test Suite for Supervisor Server Actions (Phase 13 Milestone 3)
 *
 * Implements:
 * - Rule 4 (Zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Scoping)
 * - Rule 12 (Canonical Risk Taxonomy)
 * - Rule 26 (Cooperative Cancellation)
 * - Rule 42 (Shadow Mode Simulation Engine)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  decomposeSupervisorGoalAction,
  executeSupervisorMissionAction,
  getSupervisorMissionStatusAction,
  cancelSupervisorMissionAction,
  simulateSupervisorShadowGoalAction,
} from '@/app/actions/supervisor-actions';

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(),
}));

vi.mock('@/platform/policy/governance-dead-man', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/platform/policy/governance-dead-man')>();
  return {
    ...actual,
    checkGovernanceDeadManSwitch: vi.fn(),
  };
});

describe('Supervisor Server Actions (Phase 13 Milestone 3)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementation(async () => ({
      uid: 'user_operator_1',
      profile: {
        id: 'user_operator_1',
        name: 'Enterprise Operator',
        email: 'operator@smartsapp.com',
        role: 'admin',
        organizationId: 'org_enterprise_1',
        workspaceIds: ['ws_main'],
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      roles: [
        'workspace:read',
        'workspace:write',
        'rbac:operations.campuses.view',
        'rbac:operations.classes.view',
        'rbac:operations.attendance.view',
        'rbac:operations.tasks.view',
        'rbac:operations.tasks.create',
        'rbac:operations.tasks.edit',
        'rbac:finance.invoices.view',
        'rbac:finance.invoices.manage',
        'crm:deals:read',
        'crm:deals:write',
        'crm:contacts:read',
        'crm:contacts:write',
        'crm:timeline:view',
        'knowledge:read',
        'communication:messaging:draft',
        'sales:leads:read',
        'sales:leads:write',
      ],
      isSystemAdmin: false,
    }));

    const { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } = await import(
      '@/platform/policy/governance-dead-man'
    );
    vi.mocked(checkGovernanceDeadManSwitch).mockImplementation(async (orgId?: string) => {
      if (orgId === 'org_paused') {
        throw new AgentGovernanceEmergencyPausedError();
      }
    });
  });

  describe('decomposeSupervisorGoalAction', () => {
    it('successfully decomposes an operational goal into an Execution DAG', async () => {
      const res = await decomposeSupervisorGoalAction({
        goal: 'Recover outstanding tuition fee arrears for chronically absent Grade 11 students',
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.nodes.length).toBe(4);
      expect(res.data?.topologicalOrder).toEqual(['step_1', 'step_2', 'step_3', 'step_4']);
    });

    it('fails closed with IDOR_VIOLATION when attempting to access foreign tenant', async () => {
      const res = await decomposeSupervisorGoalAction({
        goal: 'Recover outstanding tuition fee arrears',
        organizationId: 'org_foreign_victim',
        workspaceId: 'ws_main',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('IDOR_VIOLATION');
      expect(res.error).toContain('Anti-IDOR Violation');
    });

    it('fails closed with DEAD_MAN_PAUSED when emergency killswitch is engaged', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => ({
        uid: 'user_paused_tenant',
        profile: {
          id: 'user_paused_tenant',
          name: 'Paused User',
          email: 'paused@smartsapp.com',
          role: 'admin',
          organizationId: 'org_paused',
          workspaceIds: ['ws_main'],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        roles: ['workspace:read'],
        isSystemAdmin: false,
      }));

      const res = await decomposeSupervisorGoalAction({
        goal: 'Recover outstanding tuition fee arrears',
        organizationId: 'org_paused',
        workspaceId: 'ws_main',
      });

      expect(res.success).toBe(false);
      expect(res.code).toBe('DEAD_MAN_PAUSED');
      expect(res.error).toContain('paused by emergency dead-man');
    });
  });

  describe('executeSupervisorMissionAction', () => {
    it('executes a multi-agent mission and returns synthesis result', async () => {
      const res = await executeSupervisorMissionAction({
        goal: 'Recover tuition fee arrears for chronically absent Grade 11 students',
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.missionId).toBeDefined();
      expect(res.data?.groundedCitations.length).toBe(4);
      expect(res.data?.explainabilityGrid.what).toContain('RECOVERY_CAMPAIGN');
    });
  });

  describe('getSupervisorMissionStatusAction and cancelSupervisorMissionAction', () => {
    it('retrieves live status and cancels an active mission', async () => {
      // Execute a mission first
      const execRes = await executeSupervisorMissionAction({
        goal: 'Recover tuition fee arrears',
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
      });
      expect(execRes.success).toBe(true);
      const missionId = execRes.data!.missionId;

      // Query status
      const statusRes = await getSupervisorMissionStatusAction(missionId, 'org_enterprise_1');
      expect(statusRes.success).toBe(true);
      expect(statusRes.data?.missionId).toBe(missionId);

      // Cancel mission (already completed, cancel returns false)
      const cancelRes = await cancelSupervisorMissionAction(missionId, 'org_enterprise_1', 'Operator cancellation');
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.data?.missionId).toBe(missionId);
    });

    it('rejects cross-tenant get status with IDOR_VIOLATION', async () => {
      const statusRes = await getSupervisorMissionStatusAction('mis_12345', 'org_foreign_victim');
      expect(statusRes.success).toBe(false);
      expect(statusRes.code).toBe('IDOR_VIOLATION');
    });
  });

  describe('simulateSupervisorShadowGoalAction (Rule 42)', () => {
    it('simulates an autonomous mission producing MultiAgentBlastRadiusReport', async () => {
      const res = await simulateSupervisorShadowGoalAction({
        goal: 'Recover tuition fee arrears for chronically absent Grade 11 students',
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.blastRadiusReport).toBeDefined();
      expect(res.data?.blastRadiusReport.totalStepsSimulated).toBe(4);
      expect(res.data?.blastRadiusReport.affectedWorkspaces).toContain('ws_main');
    });
  });
});
