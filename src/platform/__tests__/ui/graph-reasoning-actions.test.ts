/**
 * @fileOverview Test Suite: Next.js 15 Server Actions for Graph Reasoning (Phase 13 Milestone 2)
 *
 * Implements:
 * - Rule 4 (Strict Zero-any typing)
 * - Rule 8 & 47 (Anti-IDOR Multi-Tenant Boundary Assertion)
 * - Rule 10 (Zod v4 Schema Validation)
 * - Rule 51 (Next.js 15 Server Actions with Clerk session auth)
 * - Rule 60 (Emergency Dead-Man Switch Evaluation)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDecisionMakerInfluenceMapAction,
  detectAccountRiskContagionAction,
  findCausalRelationshipPathAction,
  invalidateGraphReasoningCacheAction,
} from '@/app/actions/graph-reasoning-actions';
import { getGraphReasoningService } from '@/platform/domains/graph_reasoning/graph-reasoning-service';
import { AgentGovernanceEmergencyPausedError } from '@/platform/policy/governance-dead-man';

// Mock Clerk requireAuth
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
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
    isSystemAdmin: false,
  })),
}));

// Mock Governance Dead-Man Switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  AgentGovernanceEmergencyPausedError: class AgentGovernanceEmergencyPausedError extends Error {
    public readonly code = 'AGENT_GOVERNANCE_EMERGENCY_PAUSED';
    constructor(msg = 'Emergency pause active') {
      super(msg);
      this.name = 'AgentGovernanceEmergencyPausedError';
    }
  },
  checkGovernanceDeadManSwitch: vi.fn(async (orgId?: string) => {
    if (orgId === 'org_paused') {
      throw new AgentGovernanceEmergencyPausedError('Emergency pause engaged for testing');
    }
    return;
  }),
}));

describe('Graph Reasoning Server Actions (Phase 13 Milestone 2)', () => {
  beforeEach(async () => {
    const service = getGraphReasoningService();
    const storage = service.getStorage();

    await storage.upsertNode({
      id: 'entity_gis',
      label: 'Ghana International School',
      type: 'ENTITY',
      workspaceId: 'ws_main',
    });
    await storage.upsertNode({
      id: 'contact_principal',
      label: 'Dr. Kwame Mensah',
      type: 'CONTACT',
      workspaceId: 'ws_main',
      metadata: { role: 'EXECUTIVE', dealInvolvement: 5, meetingCount: 10 },
    });
    await storage.upsertNode({
      id: 'entity_ridge',
      label: 'Ridge Church School',
      type: 'ENTITY',
      workspaceId: 'ws_main',
      metadata: { dealAmount: 50000 },
    });
    await storage.upsertEdge({
      id: 'edge_1',
      source: 'entity_gis',
      target: 'contact_principal',
      relationship: 'EMPLOYED_AT',
      weight: 0.9,
      workspaceId: 'ws_main',
    });
    await storage.upsertEdge({
      id: 'edge_2',
      source: 'entity_gis',
      target: 'entity_ridge',
      relationship: 'SISTER_CAMPUS',
      weight: 0.85,
      workspaceId: 'ws_main',
    });
  });

  describe('getDecisionMakerInfluenceMapAction', () => {
    it('returns stakeholder influence mapping for authenticated tenant caller', async () => {
      const result = await getDecisionMakerInfluenceMapAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        entityId: 'entity_gis',
      });

      expect(result.success).toBe(true);
      expect(result.data?.entityId).toBe('entity_gis');
      expect(result.data?.stakeholders.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects cross-tenant query with IDOR TENANT_MISMATCH (Rule 8 & 47)', async () => {
      const result = await getDecisionMakerInfluenceMapAction({
        organizationId: 'org_other_tenant', // IDOR probe
        workspaceId: 'ws_main',
        entityId: 'entity_gis',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
    });

    it('fails closed when emergency dead-man switch is active (Rule 60)', async () => {
      const { requireAuth } = await import('@/lib/auth/require-auth');
      vi.mocked(requireAuth).mockImplementationOnce(async () => ({
        uid: 'user_operator_1',
        profile: {
          id: 'user_operator_1',
          name: 'Enterprise Operator',
          email: 'operator@smartsapp.com',
          role: 'admin',
          organizationId: 'org_paused',
          workspaceIds: ['ws_main'],
          createdAt: '2026-01-01',
          updatedAt: '2026-01-01',
        },
        isSystemAdmin: false,
      }));

      const result = await getDecisionMakerInfluenceMapAction({
        organizationId: 'org_paused',
        workspaceId: 'ws_main',
        entityId: 'entity_gis',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('GRAPH_DEAD_MAN_PAUSED');
    });
  });

  describe('detectAccountRiskContagionAction', () => {
    it('detects risk contagion cluster for authenticated caller', async () => {
      const result = await detectAccountRiskContagionAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        sourceEntityId: 'entity_gis',
      });

      expect(result.success).toBe(true);
      expect(result.data?.rootEntityId).toBe('entity_gis');
      expect(result.data?.totalRevenueExposure).toBeGreaterThanOrEqual(0);
    });

    it('rejects cross-tenant contagion probe with TENANT_MISMATCH', async () => {
      const result = await detectAccountRiskContagionAction({
        organizationId: 'org_other_tenant',
        workspaceId: 'ws_main',
        sourceEntityId: 'entity_gis',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
    });
  });

  describe('findCausalRelationshipPathAction', () => {
    it('discovers causal relationship path between entities', async () => {
      const result = await findCausalRelationshipPathAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        sourceNodeId: 'entity_gis',
        targetNodeId: 'entity_ridge',
      });

      expect(result.success).toBe(true);
      expect(result.data?.pathFound).toBe(true);
      expect(result.data?.hops.length).toBe(1);
    });

    it('rejects cross-tenant pathfinding attempt with TENANT_MISMATCH', async () => {
      const result = await findCausalRelationshipPathAction({
        organizationId: 'org_other_tenant',
        workspaceId: 'ws_main',
        sourceNodeId: 'entity_gis',
        targetNodeId: 'entity_ridge',
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('TENANT_MISMATCH');
    });
  });

  describe('invalidateGraphReasoningCacheAction', () => {
    it('invalidates cache for authenticated tenant caller', async () => {
      const result = await invalidateGraphReasoningCacheAction({
        organizationId: 'org_enterprise_1',
        workspaceId: 'ws_main',
        entityId: 'entity_gis',
      });

      expect(result.success).toBe(true);
      expect(result.data?.invalidated).toBe(true);
    });

    it('rejects invalid input schema with INVALID_INPUT', async () => {
      const result = await invalidateGraphReasoningCacheAction({
        organizationId: '', // Invalid empty string
      });

      expect(result.success).toBe(false);
      expect(result.code).toBe('INVALID_INPUT');
    });
  });
});
