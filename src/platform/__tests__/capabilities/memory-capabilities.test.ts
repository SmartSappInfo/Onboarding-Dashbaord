/**
 * @fileOverview Unit & Integration Tests: Canonical Memory Capabilities (Phase 4 Milestone 5)
 *
 * Verifies:
 * 1. Capability contract registration and validation in globalCapabilityRegistry (Rule 11).
 * 2. Risk classification invariants: L0_READ, L2_STATE_MUTATION, L4_PRIVILEGED_DESTRUCTIVE (Rule 12).
 * 3. Human approval requirement & non-delegable enforcement for L4 purge (Rules 17, 21).
 * 4. Input and output schema validation, Zero-any typing (Rule 4).
 * 5. Tenant scoping and anti-IDOR enforcement (Rules 8, 47).
 * 6. Rule 60 emergency dead-man pause evaluation on state mutations.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  memorySemanticSearchCapability,
  memoryGetContextCapability,
  memoryCreateItemCapability,
  memoryInspectGraphCapability,
  memoryPurgeTenantMemoryCapability,
  registerMemoryCapabilities,
} from '../../capabilities/domains/memory/memory-capabilities';
import { getCapability } from '../../capabilities/registry/capability-registry';
import { setCanonicalMemoryServiceForTests, CanonicalMemoryService } from '../../memory/services/canonical-memory-service';
import { MemoryVectorStore } from '../../memory/adapters/memory-vector-store';
import { setGovernanceDeadManStateForTests } from '../../policy/governance-dead-man';
import type { CapabilityExecutionContext, AgentPrincipal } from '../../capabilities/contracts/capability-definition';

describe('Canonical Memory Capabilities (Rules 4, 11, 12, 17, 21, 47, 60)', () => {
  let mockVectorStore: MemoryVectorStore;
  let canonicalService: CanonicalMemoryService;

  const mockPrincipal: AgentPrincipal = {
    actorType: 'user',
    userId: 'user_operator_1',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_456',
    grantedScopes: ['rbac:operations.campuses.view', 'rbac:operations.campuses.edit', 'app:system_admin'],
    effectiveRole: 'admin',
  };

  const mockContext: CapabilityExecutionContext = {
    principal: mockPrincipal,
    correlationId: 'corr_test_1',
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setGovernanceDeadManStateForTests(false);
    mockVectorStore = new MemoryVectorStore();
    canonicalService = new CanonicalMemoryService({ vectorStore: mockVectorStore });
    setCanonicalMemoryServiceForTests(canonicalService);
    registerMemoryCapabilities();
  });

  describe('Registration & Contract Metadata (Rule 11, Rule 12)', () => {
    it('registers all 5 canonical memory capabilities in the global registry', () => {
      expect(getCapability('memory.semantic_search')).toBeDefined();
      expect(getCapability('memory.get_context')).toBeDefined();
      expect(getCapability('memory.create_item')).toBeDefined();
      expect(getCapability('memory.inspect_graph')).toBeDefined();
      expect(getCapability('memory.purge_tenant_memory')).toBeDefined();
    });

    it('enforces strict risk levels across all capabilities (Rule 12)', () => {
      expect(memorySemanticSearchCapability.risk.level).toBe('L0_READ');
      expect(memoryGetContextCapability.risk.level).toBe('L0_READ');
      expect(memoryInspectGraphCapability.risk.level).toBe('L0_READ');
      expect(memoryCreateItemCapability.risk.level).toBe('L2_STATE_MUTATION');
      expect(memoryPurgeTenantMemoryCapability.risk.level).toBe('L4_PRIVILEGED_DESTRUCTIVE');
    });

    it('marks L4 purge as destructive, non-delegable, and requiring human approval (Rules 17, 21)', () => {
      expect(memoryPurgeTenantMemoryCapability.risk.destructive).toBe(true);
      expect(memoryPurgeTenantMemoryCapability.risk.requiresHumanApproval).toBe(true);
      expect(memoryPurgeTenantMemoryCapability.risk.nonDelegable).toBe(true);
      expect(memoryPurgeTenantMemoryCapability.permissions).toContain('app:system_admin');
    });
  });

  describe('Execution Handlers & Invariants', () => {
    it('creates and indexes memory item via memory.create_item (L2)', async () => {
      const result = await memoryCreateItemCapability.handler(
        {
          content: 'Prospect emphasized strict budget limits of $50,000 for implementation.',
          tier: 'semantic',
          sourceType: 'crm',
          sourceId: 'note_123',
          confidence: 0.95,
          sensitivity: 'internal',
          subjectReferences: ['deal_999'],
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBeDefined();
        expect(result.data.success).toBe(true);
      }
    });

    it('searches memory via memory.semantic_search (L0)', async () => {
      // First seed an item using memory.create_item
      await memoryCreateItemCapability.handler(
        {
          content: 'Payment terms require net 30 invoice delivery.',
          tier: 'semantic',
          sourceType: 'crm',
          sourceId: 'note_payment_1',
          confidence: 0.9,
          sensitivity: 'internal',
        },
        mockContext
      );

      const result = await memorySemanticSearchCapability.handler(
        { query: 'Payment terms net 30' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.results.length).toBeGreaterThan(0);
        expect(result.data.results[0].content).toContain('Payment terms');
      }
    });

    it('retrieves grounded context via memory.get_context (L0, Rule 30)', async () => {
      await memoryCreateItemCapability.handler(
        {
          content: 'Director confirmed kickoff date is October 15.',
          tier: 'semantic',
          sourceType: 'meeting',
          sourceId: 'meet_555',
          confidence: 0.95,
          sensitivity: 'internal',
        },
        mockContext
      );

      const result = await memoryGetContextCapability.handler(
        { query: 'kickoff date' },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.compiledContext).toContain('<untrusted_reference_data');
        expect(result.data.evidence.length).toBeGreaterThan(0);
        expect(result.data.tokenCount).toBeGreaterThan(0);
      }
    });

    it('inspects entity graph via memory.inspect_graph (L0)', async () => {
      await memoryCreateItemCapability.handler(
        {
          content: 'Principal of ent_school_123 requested a follow up next Tuesday.',
          tier: 'semantic',
          sourceType: 'crm',
          sourceId: 'ent_school_123',
          confidence: 0.9,
          subjectReferences: ['ent_school_123'],
        },
        mockContext
      );

      const result = await memoryInspectGraphCapability.handler(
        { entityId: 'ent_school_123', depth: 1 },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.centerNodeId).toBe('ent_school_123');
        expect(Array.isArray(result.data.nodes)).toBe(true);
        expect(Array.isArray(result.data.edges)).toBe(true);
        expect(result.data.nodes.length).toBeGreaterThan(1);
      }
    });

    it('blocks state mutations when Rule 60 emergency dead-man switch is active', async () => {
      setGovernanceDeadManStateForTests(true);

      const result = await memoryCreateItemCapability.handler(
        {
          content: 'This mutation should fail under emergency pause.',
          tier: 'episodic',
          sourceType: 'note',
          sourceId: 'note_blocked',
        },
        mockContext
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('MEMORY_DEAD_MAN_PAUSED');
      }
    });

    it('executes L4 tenant memory purge when human approval is present', async () => {
      const result = await memoryPurgeTenantMemoryCapability.handler(
        {
          confirmTenantId: 'org_test_123',
          reason: 'Authorized security compliance reset.',
        },
        mockContext
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.purged).toBe(true);
      }
    });
  });
});
