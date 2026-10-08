/**
 * @fileOverview Unit & Contract Tests for Multi-Agent Swarm Mesh (Phase 13 Milestone 4)
 *
 * Implements Rules 4, 8, 9, 10, 12, 13, 16, 17, 18, 19, 21, 22, 24, 25, 26, 27, 28, 30, 32, 40, 48, 60, and 69.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  AgentHandoffEnvelopeSchema,
  MeshDeliveryReceiptSchema,
  MeshPeerRegistryEntrySchema,
  MeshCompensationRecordSchema,
  MeshTopologySchema,
  MeshDeadLetterRecordSchema,
  AGENT_MESH_ERROR_CODES,
  AgentMeshError,
  computeHandoffPayloadHash,
  computeHandoffIdempotencyKey,
  type AgentHandoffEnvelope,
} from '@/platform/agents/supervisor/mesh/agent-swarm-mesh-types';

describe('Multi-Agent Swarm Mesh Contracts & Error Taxonomy', () => {
  const validDelegationToken = {
    tokenId: 'del_tok_123',
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

  const validEnvelope: AgentHandoffEnvelope = {
    handoffId: 'hnd_test_001',
    missionId: 'mis_test_100',
    parentStepId: 'step_1',
    targetStepId: 'step_2',
    sourceAgentPersona: 'supervisor',
    targetAgentPersona: 'crm_assistant',
    organizationId: 'org_test_1',
    workspaceId: 'ws_test_1',
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
    idempotencyKey: 'mesh_hnd_org_test_1_hash123',
    timestamp: '2026-10-08T00:00:00.000Z',
    payloadHash: 'hash_sha256_mock_envelope',
  };

  describe('AgentHandoffEnvelopeSchema', () => {
    it('successfully parses a valid agent handoff envelope', () => {
      const parsed = AgentHandoffEnvelopeSchema.parse(validEnvelope);
      expect(parsed.handoffId).toBe('hnd_test_001');
      expect(parsed.targetAgentPersona).toBe('crm_assistant');
      expect(parsed.budget.maxTokens).toBe(3000);
    });

    it('rejects an envelope missing tenant boundaries (Rule 8 Anti-IDOR)', () => {
      const invalid = { ...validEnvelope, organizationId: '' };
      expect(() => AgentHandoffEnvelopeSchema.parse(invalid)).toThrow();
    });

    it('rejects an envelope with token budget exceeding 4,000 ceiling (Rules 28 & 56)', () => {
      const invalid = {
        ...validEnvelope,
        budget: { maxTokens: 5000, maxDurationMs: 30000 },
      };
      expect(() => AgentHandoffEnvelopeSchema.parse(invalid)).toThrow(/Token budget cannot exceed 4,000/);
    });

    it('rejects an envelope with delegation depth exceeding 3 (Rule 9 Bounded Authority)', () => {
      const invalid = {
        ...validEnvelope,
        delegationToken: { ...validDelegationToken, depth: 4 },
      };
      expect(() => AgentHandoffEnvelopeSchema.parse(invalid)).toThrow();
    });
  });

  describe('MeshDeliveryReceiptSchema', () => {
    it('validates a successful delivery receipt', () => {
      const receipt = {
        receiptId: 'rcp_001',
        handoffId: 'hnd_test_001',
        deliveryStatus: 'DELIVERED' as const,
        latencyMs: 45,
        acknowledgedAt: '2026-10-08T00:00:01.000Z',
        peerSignature: 'sig_peer_ack_987',
      };
      const parsed = MeshDeliveryReceiptSchema.parse(receipt);
      expect(parsed.deliveryStatus).toBe('DELIVERED');
      expect(parsed.latencyMs).toBe(45);
    });

    it('validates an expired or failed delivery receipt with error message', () => {
      const receipt = {
        receiptId: 'rcp_002',
        handoffId: 'hnd_test_001',
        deliveryStatus: 'EXPIRED' as const,
        latencyMs: 30001,
        acknowledgedAt: '2026-10-08T00:00:31.000Z',
        peerSignature: 'sig_peer_timeout',
        error: 'Peer did not acknowledge within 30000ms timeout budget',
      };
      const parsed = MeshDeliveryReceiptSchema.parse(receipt);
      expect(parsed.deliveryStatus).toBe('EXPIRED');
      expect(parsed.error).toContain('timeout budget');
    });
  });

  describe('MeshPeerRegistryEntrySchema & Circuit Breaker Types (Rule 24)', () => {
    it('validates a peer entry with circuit breaker status', () => {
      const peer = {
        personaId: 'lead_sdr' as const,
        status: 'ACTIVE' as const,
        circuitBreakerState: 'CLOSED' as const,
        concurrencyLimit: 4,
        activeHandoffsCount: 1,
        consecutiveFailures: 0,
        lastFailureTimestamp: null,
        lastHeartbeat: '2026-10-08T00:00:00.000Z',
      };
      const parsed = MeshPeerRegistryEntrySchema.parse(peer);
      expect(parsed.personaId).toBe('lead_sdr');
      expect(parsed.circuitBreakerState).toBe('CLOSED');
      expect(parsed.concurrencyLimit).toBeLessThanOrEqual(4);
    });

    it('rejects concurrency limit exceeding 4 (Rule 9 Concurrency Ceiling)', () => {
      const peer = {
        personaId: 'lead_sdr' as const,
        status: 'ACTIVE' as const,
        circuitBreakerState: 'CLOSED' as const,
        concurrencyLimit: 8,
        activeHandoffsCount: 0,
        consecutiveFailures: 0,
        lastFailureTimestamp: null,
        lastHeartbeat: '2026-10-08T00:00:00.000Z',
      };
      expect(() => MeshPeerRegistryEntrySchema.parse(peer)).toThrow(/Concurrency limit cannot exceed 4/);
    });
  });

  describe('MeshCompensationRecordSchema & Saga Journal (Rule 27)', () => {
    it('validates a completed compensation record', () => {
      const record = {
        compensationId: 'cmp_rec_001',
        missionId: 'mis_test_100',
        stepId: 'step_2',
        capabilityId: 'crm.entity.tag_add',
        compensatingCapabilityId: 'crm.entity.tag_remove',
        status: 'COMPLETED' as const,
        attemptCount: 1,
        executedAt: '2026-10-08T00:01:00.000Z',
        durationMs: 120,
      };
      const parsed = MeshCompensationRecordSchema.parse(record);
      expect(parsed.status).toBe('COMPLETED');
      expect(parsed.compensatingCapabilityId).toBe('crm.entity.tag_remove');
    });

    it('validates a skipped non-compensable record', () => {
      const record = {
        compensationId: 'cmp_rec_002',
        missionId: 'mis_test_100',
        stepId: 'step_1',
        capabilityId: 'crm.entity.get',
        compensatingCapabilityId: 'noop',
        status: 'SKIPPED' as const,
        attemptCount: 0,
        executedAt: '2026-10-08T00:01:01.000Z',
        durationMs: 0,
        error: 'Read-only capability requires no rollback',
      };
      const parsed = MeshCompensationRecordSchema.parse(record);
      expect(parsed.status).toBe('SKIPPED');
    });
  });

  describe('MeshDeadLetterRecordSchema (Rule 25)', () => {
    it('validates a dead-letter queue record', () => {
      const dlq = {
        deadLetterId: 'dlq_001',
        envelope: validEnvelope,
        reason: 'Circuit breaker is OPEN for target peer',
        droppedAt: '2026-10-08T00:02:00.000Z',
        attemptCount: 3,
      };
      const parsed = MeshDeadLetterRecordSchema.parse(dlq);
      expect(parsed.deadLetterId).toBe('dlq_001');
      expect(parsed.attemptCount).toBe(3);
    });
  });

  describe('AgentMeshError & Error Taxonomy (Rule 48)', () => {
    it('instantiates AgentMeshError with correct HTTP status codes', () => {
      const idorErr = new AgentMeshError('IDOR_VIOLATION', 'Cross-tenant access forbidden');
      expect(idorErr.code).toBe('IDOR_VIOLATION');
      expect(idorErr.httpStatus).toBe(403);

      const timeoutErr = new AgentMeshError('HANDOFF_TIMEOUT', 'Handoff timed out');
      expect(timeoutErr.httpStatus).toBe(504);

      const breakerErr = new AgentMeshError('CIRCUIT_BREAKER_OPEN', 'Peer is down');
      expect(breakerErr.httpStatus).toBe(503);

      const pausedErr = new AgentMeshError('DEAD_MAN_PAUSED', 'Emergency switch paused');
      expect(pausedErr.httpStatus).toBe(503);

      const depthErr = new AgentMeshError('DELEGATION_DEPTH_EXCEEDED', 'Depth > 3');
      expect(depthErr.httpStatus).toBe(403);

      const tamperErr = new AgentMeshError('PAYLOAD_TAMPERED', 'Hash mismatch');
      expect(tamperErr.httpStatus).toBe(400);

      const sagaErr = new AgentMeshError('SAGA_COMPENSATION_FAILED', 'Rollback failed');
      expect(sagaErr.httpStatus).toBe(500);
    });
  });

  describe('Cryptographic Helpers (Rules 19 & 22)', () => {
    it('computes deterministic SHA-256 payload hash regardless of object key ordering', async () => {
      const objA = { b: 2, a: 1, c: { y: 20, x: 10 } };
      const objB = { a: 1, c: { x: 10, y: 20 }, b: 2 };

      const hashA = await computeHandoffPayloadHash(objA);
      const hashB = await computeHandoffPayloadHash(objB);

      expect(hashA).toBe(hashB);
      expect(hashA).toMatch(/^[a-f0-9]{64}$/);
    });

    it('computes deterministic idempotency key', () => {
      const key = computeHandoffIdempotencyKey('org_123', 'step_A', 'step_B', 'hash_xyz');
      expect(key).toBe('mesh_hnd_org_123_step_A_step_B_hash_xyz');
    });
  });
});
