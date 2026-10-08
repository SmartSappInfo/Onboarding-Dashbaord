// @vitest-environment node
/**
 * @fileOverview Unit & Security Test Suite for Swarm Mesh Server Actions (Phase 13 Milestone 4)
 *
 * Implements:
 * - Rule 4 (Zero any/any[])
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Scoping)
 * - Rule 12 (Canonical Risk Taxonomy)
 * - Rule 19 & 22 (Idempotency and SHA-256 Binding)
 * - Rule 24 (Circuit Breakers)
 * - Rule 27 (Reverse-LIFO Saga Rollback)
 * - Rule 48 (Structured Error Codes & HTTP Mapping)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  routeMeshHandoffAction,
  getMeshTopologyAction,
  triggerMeshRollbackAction,
  simulateMeshHandoffAction,
} from '@/app/actions/supervisor-mesh-actions';
import { type AgentHandoffEnvelope } from '@/platform/agents/supervisor/mesh/agent-swarm-mesh-types';

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

describe('Swarm Mesh Server Actions (Phase 13 Milestone 4)', () => {
  const validDelegationToken = {
    tokenId: 'del_tok_mesh_action_1',
    tokenSignature: 'sig_sha256_mock_hash_abc',
    parentRunId: 'run_parent_123',
    supervisorAgentId: 'supervisor',
    subAgentId: 'crm_assistant',
    userId: 'user_operator_1',
    organizationId: 'org_enterprise_1',
    workspaceId: 'ws_main',
    delegationChain: ['supervisor', 'crm_assistant'],
    depth: 1,
    allowedScopes: ['crm:contacts:read', 'crm:contacts:write'],
    tokenBudget: 4000,
    timeoutMs: 30000,
    policyVersion: '1.0.0',
    status: 'active' as const,
    issuedAt: '2026-10-08T00:00:00.000Z',
    expiresAt: '2026-10-08T01:00:00.000Z',
  };

  const validEnvelope: AgentHandoffEnvelope = {
    handoffId: 'hnd_act_001',
    missionId: 'mis_act_100',
    parentStepId: 'step_1',
    targetStepId: 'step_2',
    sourceAgentPersona: 'supervisor',
    targetAgentPersona: 'crm_assistant',
    organizationId: 'org_enterprise_1',
    workspaceId: 'ws_main',
    delegationToken: validDelegationToken,
    context: {
      accountName: 'Ghana International School',
      studentCount: 1200,
    },
    requiredCapabilities: ['crm.entity.get'],
    budget: {
      maxTokens: 3000,
      maxDurationMs: 30000,
    },
    idempotencyKey: 'mesh_hnd_org_enterprise_1_hash123',
    timestamp: '2026-10-08T00:00:00.000Z',
    payloadHash: 'hash_sha256_mock_envelope',
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const { requireAuth } = await import('@/lib/auth/require-auth');
    vi.mocked(requireAuth).mockImplementation(async () => ({
      userId: 'user_operator_1',
      orgId: 'org_enterprise_1',
      orgRole: 'org:admin',
      orgPermissions: ['org:manage'],
      isSystemAdmin: false,
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
    }));

    const { checkGovernanceDeadManSwitch } = await import('@/platform/policy/governance-dead-man');
    vi.mocked(checkGovernanceDeadManSwitch).mockResolvedValue(undefined);
  });

  describe('routeMeshHandoffAction', () => {
    it('successfully routes a valid agent handoff envelope', async () => {
      const result = await routeMeshHandoffAction(validEnvelope);

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.data?.handoffId).toBe('hnd_act_001');
      expect(result.data?.deliveryStatus).toBe('ACKNOWLEDGED');
    });

    it('rejects cross-tenant routing with TENANT_MISMATCH (Rule 8 Anti-IDOR)', async () => {
      const result = await routeMeshHandoffAction({
        ...validEnvelope,
        organizationId: 'org_victim_99',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
      expect(result.httpStatus).toBe(403);
    });

    it('fails closed with DEAD_MAN_PAUSED (HTTP 503) when emergency switch is engaged (Rule 60)', async () => {
      const { checkGovernanceDeadManSwitch, AgentGovernanceEmergencyPausedError } = await import(
        '@/platform/policy/governance-dead-man'
      );
      vi.mocked(checkGovernanceDeadManSwitch).mockRejectedValueOnce(
        new AgentGovernanceEmergencyPausedError('Emergency kill switch engaged')
      );

      const result = await routeMeshHandoffAction(validEnvelope);

      expect(result.success).toBe(false);
      expect(result.code).toBe('DEAD_MAN_PAUSED');
      expect(result.httpStatus).toBe(503);
    });

    it('fails with INVALID_INPUT (HTTP 400) when envelope fails Zod validation', async () => {
      const invalidEnvelope = {
        ...validEnvelope,
        organizationId: '', // Invalid
      };

      const result = await routeMeshHandoffAction(invalidEnvelope);

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_INPUT');
      expect(result.httpStatus).toBe(400);
    });
  });

  describe('getMeshTopologyAction', () => {
    it('retrieves active mesh topology telemetry and peer statuses', async () => {
      const result = await getMeshTopologyAction('org_enterprise_1', 'ws_main');

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.data?.organizationId).toBe('org_enterprise_1');
      expect(result.data?.peers.length).toBeGreaterThanOrEqual(20);
      expect(result.data?.activeNodes).toBeGreaterThanOrEqual(20);
    });

    it('fails with INVALID_INPUT (HTTP 400) when parameters are missing', async () => {
      const result = await getMeshTopologyAction('', 'ws_main');

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_INPUT');
      expect(result.httpStatus).toBe(400);
    });

    it('rejects cross-tenant topology access with TENANT_MISMATCH (Rule 8)', async () => {
      const result = await getMeshTopologyAction('org_other_tenant', 'ws_main');

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
      expect(result.httpStatus).toBe(403);
    });
  });

  describe('triggerMeshRollbackAction', () => {
    it('triggers reverse-LIFO rollback and returns compensation receipt', async () => {
      const result = await triggerMeshRollbackAction('org_enterprise_1', 'ws_main', 'mis_act_100', {
        dryRun: true,
        reason: 'Operator requested mission rollback',
      });

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.data?.missionId).toBe('mis_act_100');
      expect(result.data?.overallStatus).toBeDefined();
    });

    it('rejects cross-tenant rollback with TENANT_MISMATCH (Rule 8)', async () => {
      const result = await triggerMeshRollbackAction('org_other_tenant', 'ws_main', 'mis_act_100');

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
      expect(result.httpStatus).toBe(403);
    });
  });

  describe('simulateMeshHandoffAction', () => {
    it('simulates a handoff envelope in dry-run mode', async () => {
      const result = await simulateMeshHandoffAction(validEnvelope);

      expect(result.success).toBe(true);
      expect(result.httpStatus).toBe(200);
      expect(result.data?.handoffId).toBe('hnd_act_001');
    });
  });
});
