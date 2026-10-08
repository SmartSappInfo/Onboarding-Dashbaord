/**
 * @fileOverview Unit & Integration Tests for Swarm Mesh Routing & Reverse-LIFO Saga Rollback (Phase 13 Milestone 4)
 *
 * Implements Rules 4, 8, 9, 10, 12, 13, 16, 17, 18, 19, 21, 22, 24, 25, 26, 27, 28, 40, 48, 60, and 69.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AgentSwarmMesh,
  getAgentSwarmMesh,
} from '@/platform/agents/supervisor/mesh/agent-swarm-mesh';
import {
  type AgentHandoffEnvelope,
  AgentMeshError,
} from '@/platform/agents/supervisor/mesh/agent-swarm-mesh-types';
import type { DomainEvent } from '@/platform/events/event-bus';
import { checkGovernanceDeadManSwitch } from '@/platform/policy/governance-dead-man';

// Mock governance dead man switch
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn().mockResolvedValue(undefined),
}));

describe('AgentSwarmMesh & Reverse-LIFO Saga Coordinator', () => {
  let publishedEvents: DomainEvent[] = [];
  let mockEventBus: {
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
    getSubscriberCount: ReturnType<typeof vi.fn>;
  };

  const validToken = {
    tokenId: 'del_tok_mesh_1',
    tokenSignature: 'sig_sha256_mock_hash_abc',
    parentRunId: 'run_parent_123',
    supervisorAgentId: 'supervisor',
    subAgentId: 'crm_assistant',
    userId: 'user_operator_1',
    organizationId: 'org_test_1',
    workspaceId: 'ws_test_1',
    delegationChain: ['supervisor', 'crm_assistant'],
    depth: 1,
    allowedScopes: ['crm:contacts:read', 'crm:contacts:write'],
    issuedAt: '2026-10-08T00:00:00.000Z',
    expiresAt: '2026-10-08T01:00:00.000Z',
  };

  const createEnvelope = (overrides: Partial<AgentHandoffEnvelope> = {}): AgentHandoffEnvelope => ({
    handoffId: `hnd_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    missionId: 'mis_mesh_001',
    parentStepId: 'step_1',
    targetStepId: 'step_2',
    sourceAgentPersona: 'supervisor',
    targetAgentPersona: 'crm_assistant',
    organizationId: 'org_test_1',
    workspaceId: 'ws_test_1',
    delegationToken: validToken,
    context: { query: 'GIS fee balance' },
    requiredCapabilities: ['crm.entity.get'],
    budget: { maxTokens: 2000, maxDurationMs: 15000 },
    idempotencyKey: 'mesh_hnd_key_001',
    timestamp: new Date().toISOString(),
    payloadHash: 'hash_test_envelope_001',
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    (checkGovernanceDeadManSwitch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    publishedEvents = [];
    mockEventBus = {
      publish: vi.fn().mockImplementation(async (event: DomainEvent) => {
        publishedEvents.push(event);
      }),
      subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
      clear: vi.fn(),
      getSubscriberCount: vi.fn().mockReturnValue(0),
    };
  });

  describe('Mesh Topology & Peer Registry', () => {
    it('initializes with all canonical agent personas in peer registry', () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const topology = mesh.getMeshTopology('org_test_1', 'ws_test_1');

      expect(topology.organizationId).toBe('org_test_1');
      expect(topology.workspaceId).toBe('ws_test_1');
      expect(topology.peers.length).toBe(26);
      expect(topology.activeNodes).toBe(26);
    });

    it('returns singleton instance via getAgentSwarmMesh()', () => {
      const singleton1 = getAgentSwarmMesh();
      const singleton2 = getAgentSwarmMesh();
      expect(singleton1).toBe(singleton2);
    });
  });

  describe('Peer-to-Peer Handoff Routing & Governance', () => {
    it('routes a handoff envelope between supervisor and peer agent and publishes domain events', async () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const envelope = createEnvelope();

      const receipt = await mesh.routeHandoff(envelope, {
        peerHandler: async () => ({ status: 'PROCESSED', accountFound: true }),
      });

      expect(receipt.deliveryStatus).toBe('ACKNOWLEDGED');
      expect(receipt.handoffId).toBe(envelope.handoffId);

      const routedEvent = publishedEvents.find((e) => e.type === 'supervisor.mesh.handoff_routed');
      expect(routedEvent).toBeDefined();
      expect(routedEvent?.payload.sourcePersona).toBe('supervisor');
      expect(routedEvent?.payload.targetPersona).toBe('crm_assistant');
    });

    it('fails closed when emergency dead-man switch is engaged (Rule 60)', async () => {
      (checkGovernanceDeadManSwitch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Emergency governance paused')
      );

      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const envelope = createEnvelope();

      await expect(mesh.routeHandoff(envelope)).rejects.toThrowError(AgentMeshError);
      await expect(mesh.routeHandoff(envelope)).rejects.toThrowError(/Emergency dead-man switch is engaged/);
    });

    it('rejects cross-tenant routing (Anti-IDOR Rule 8)', async () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const envelope = createEnvelope({
        organizationId: 'org_attacker',
        delegationToken: { ...validToken, organizationId: 'org_victim' },
      });

      await expect(mesh.routeHandoff(envelope)).rejects.toThrowError(/Tenant mismatch between envelope/);
    });

    it('rejects handoff with delegation depth exceeding 3 (Rule 9)', async () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const envelope = createEnvelope({
        delegationToken: { ...validToken, depth: 4 },
      });

      await expect(mesh.routeHandoff(envelope)).rejects.toThrow();
    });
  });

  describe('Reverse-LIFO Distributed Saga Compensation (Rule 27)', () => {
    it('executes compensation in exact reverse order (LIFO) for mutating steps', async () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const missionId = 'mis_saga_test_1';

      // Step 1: Read-only entity lookup (noop rollback)
      mesh.registerCompletedStep({
        missionId,
        stepId: 'step_1',
        capabilityId: 'crm.entity.get',
        compensatingCapabilityId: 'noop',
      });

      // Step 2: Tag applied (compensable via tag_remove)
      mesh.registerCompletedStep({
        missionId,
        stepId: 'step_2',
        capabilityId: 'crm.entity.tag_add',
        compensatingCapabilityId: 'crm.entity.tag_remove',
        payloadSnapshot: { entityId: 'ent_123', tag: 'arrears' },
      });

      // Step 3: Invoice draft created (compensable via delete_draft)
      mesh.registerCompletedStep({
        missionId,
        stepId: 'step_3',
        capabilityId: 'finance.invoice.create_draft',
        compensatingCapabilityId: 'finance.invoice.delete_draft',
        payloadSnapshot: { invoiceId: 'inv_999' },
      });

      // Now mission fails at Step 4; trigger reverse-LIFO rollback
      const compensationPlan = await mesh.compensateMission(missionId, {
        reason: 'Step 4 failed due to network timeout',
      });

      expect(compensationPlan.overallStatus).toBe('SUCCESS');
      expect(compensationPlan.totalStepsToCompensate).toBe(3);

      // Verify reverse order: step_3, then step_2, then step_1
      const compensatedOrder = compensationPlan.records.map((r) => r.stepId);
      expect(compensatedOrder).toEqual(['step_3', 'step_2', 'step_1']);

      // step_3: COMPLETED
      expect(compensationPlan.records[0].status).toBe('COMPLETED');
      expect(compensationPlan.records[0].compensatingCapabilityId).toBe('finance.invoice.delete_draft');

      // step_2: COMPLETED
      expect(compensationPlan.records[1].status).toBe('COMPLETED');
      expect(compensationPlan.records[1].compensatingCapabilityId).toBe('crm.entity.tag_remove');

      // step_1: SKIPPED (noop)
      expect(compensationPlan.records[2].status).toBe('SKIPPED');

      // Verify compensation domain events
      const compEvents = publishedEvents.filter((e) => e.type === 'supervisor.mesh.compensated');
      expect(compEvents.length).toBe(1);
      expect(compEvents[0].payload.missionId).toBe(missionId);
      expect(compEvents[0].payload.overallStatus).toBe('SUCCESS');
    });

    it('supports dry-run compensation in Shadow Mode without live side effects (Rule 42)', async () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const missionId = 'mis_shadow_saga_2';

      mesh.registerCompletedStep({
        missionId,
        stepId: 'step_a',
        capabilityId: 'lead.enrich',
        compensatingCapabilityId: 'lead.revert_enrichment',
      });

      const shadowPlan = await mesh.compensateMission(missionId, {
        dryRun: true,
        reason: 'Shadow mode simulation completed',
      });

      expect(shadowPlan.overallStatus).toBe('SUCCESS');
      expect(shadowPlan.records[0].status).toBe('COMPLETED');
      expect(shadowPlan.records[0].attemptCount).toBe(0); // 0 live attempts in shadow mode
    });
  });

  describe('Dead-Letter Queue & Cancellation (Rules 25 & 26)', () => {
    it('cancels in-flight handoffs for a mission and records dead-letter entries', async () => {
      const mesh = new AgentSwarmMesh({ eventBus: mockEventBus });
      const envelope = createEnvelope({ missionId: 'mis_cancel_001' });

      // Record a dead-letter entry
      mesh.recordDeadLetter(envelope, 'Peer timed out after multiple retries');

      const dlq = mesh.getDeadLetterRecords('org_test_1');
      expect(dlq.length).toBe(1);
      expect(dlq[0].reason).toContain('Peer timed out');

      // Test mission cancellation
      await mesh.cancelMissionHandoffs('mis_cancel_001', 'Operator cancelled mission');

      const cancelEvent = publishedEvents.find((e) => e.type === 'supervisor.mesh.cancelled');
      expect(cancelEvent).toBeDefined();
      expect(cancelEvent?.payload.missionId).toBe('mis_cancel_001');
      expect(cancelEvent?.payload.reason).toBe('Operator cancelled mission');
    });
  });
});
