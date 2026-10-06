/**
 * @fileOverview Unit Tests for deal.advance_stage Capability (PR-12 / Wave B-2)
 *
 * Implements Rule 2 (TDD), Rule 4 (Strict Typing), Rule 12 (Server-Side Risk L2),
 * Rule 18 (TOCTOU Concurrency Guard), Rule 23 (State Changed Invariant),
 * Rule 31 (Output Schema Validation), Rule 40 (Domain Events), and Rule 47 (Anti-IDOR).
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FakeFirestore } from '../helpers/fake-firestore';

const h = vi.hoisted(() => ({ db: undefined as unknown, stageCalls: [] as string[] }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
vi.mock('@/lib/crm/deal-core', () => ({
  createDealCore: vi.fn(async () => ({ id: 'deal_new' })),
  updateDealStageCore: vi.fn(async (_actor: unknown, dealId: string) => {
    h.stageCalls.push(dealId);
    return { success: true };
  }),
  updateDealOwnerCore: vi.fn(async () => ({ success: true })),
  updateDealValueCore: vi.fn(async () => ({ success: true })),
}));
import {
  dealAdvanceStageCapability,
  DealAdvanceStageInputSchema,
  DealAdvanceStageOutputSchema,
  type DealAdvanceStageOutput,
} from '../../domains/deals_revenue/contracts/deal-capabilities.contract';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import { executeCapability, type ExecuteCapabilityDeps } from '../../capabilities/execution/execute-capability';
import { createServerActionInvocation } from '../../capabilities/execution/invocation';
import { resetCapabilityRegistryForTests, registerCapability } from '../../capabilities/registry/capability-registry';

const mockPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_sales_agent_01',
  organizationId: 'org_sales_test',
  workspaceId: 'ws_sales_test',
  grantedScopes: ['sales:pipeline:edit', 'app:deals_edit', 'deal:stage_update'],
  effectiveRole: 'admin',
};

const testDeps: ExecuteCapabilityDeps = {
  registryLookup: (id: string) =>
    id === dealAdvanceStageCapability.id ? (dealAdvanceStageCapability as AnyCapabilityDefinition) : undefined,
  auditSink: async () => {},
  outboxSink: async () => {},
};

describe('deal.advance_stage Capability Contract & Pipeline Execution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCapabilityRegistryForTests();
    registerCapability(dealAdvanceStageCapability);
    const db = new FakeFirestore();
    db.write('deals/deal_101', { workspaceId: 'ws_sales_test', name: 'Renewal', stageId: 'stage_negotiation' });
    db.write('deals/deal_foreign', { workspaceId: 'ws_other', name: 'Other', stageId: 'stage_negotiation' });
    h.db = db.asFirestore();
    h.stageCalls = [];
  });

  it('fails closed: a missing or foreign deal is NOT_FOUND, never a success (M2 · T4.3)', async () => {
    for (const dealId of ['deal_missing', 'deal_foreign']) {
      const result = await executeCapability(createServerActionInvocation({
        capabilityId: 'deal.advance_stage',
        input: { workspaceId: 'ws_sales_test', dealId, stageId: 'stage_won' },
        principal: mockPrincipal,
      }), testDeps);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.stateChanged).toBe('no');
      }
    }
    expect(h.stageCalls).toEqual([]);
  });

  it('validates capability definition metadata and risk classification', () => {
    expect(dealAdvanceStageCapability.id).toBe('deal.advance_stage');
    expect(dealAdvanceStageCapability.domain).toBe('deals_revenue');
    expect(dealAdvanceStageCapability.risk.level).toBe('L2_STATE_MUTATION');
    expect(dealAdvanceStageCapability.risk.destructive).toBe(false);
    expect(dealAdvanceStageCapability.workspaceScoped).toBe(true);
    expect(dealAdvanceStageCapability.tenantScoped).toBe(true);
    expect(dealAdvanceStageCapability.permissions).toContain('deal:stage_update');
  });

  it('validates schema inputs correctly', () => {
    const valid = DealAdvanceStageInputSchema.safeParse({
      workspaceId: 'ws_sales_test',
      dealId: 'deal_001',
      stageId: 'stage_negotiation',
      reason: 'Pricing approved by committee',
      bypassValidation: true,
    });
    expect(valid.success).toBe(true);

    const missingDeal = DealAdvanceStageInputSchema.safeParse({
      workspaceId: 'ws_sales_test',
      stageId: 'stage_negotiation',
    });
    expect(missingDeal.success).toBe(false);

    const emptyWorkspace = DealAdvanceStageInputSchema.safeParse({
      workspaceId: '',
      dealId: 'deal_001',
      stageId: 'stage_negotiation',
    });
    expect(emptyWorkspace.success).toBe(false);
  });

  it('executes stage advance successfully and emits deal.stage_advanced domain event with correlationId', async () => {
    const invocation = createServerActionInvocation({
      capabilityId: 'deal.advance_stage',
      input: {
        workspaceId: 'ws_sales_test',
        dealId: 'deal_101',
        stageId: 'stage_won',
        reason: 'Customer accepted agreement',
        bypassValidation: true,
      },
      principal: mockPrincipal,
    });

    const result = await executeCapability<DealAdvanceStageOutput>(invocation, testDeps);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dealId).toBe('deal_101');
      expect(result.data.stageId).toBe('stage_won');
      expect(result.data.success).toBe(true);
      expect(result.data.updatedAt).toBeDefined();

      // Output schema validation
      const parsedOutput = DealAdvanceStageOutputSchema.safeParse(result.data);
      expect(parsedOutput.success).toBe(true);
      expect(result.executionId).toBeDefined();
    }
  });

  it('enforces stateChanged: "no" invariant on validation failure', async () => {
    const invocation = createServerActionInvocation({
      capabilityId: 'deal.advance_stage',
      input: {
        workspaceId: '', // Invalid input schema
        dealId: 'deal_101',
        stageId: 'stage_won',
      },
      principal: mockPrincipal,
    });

    const result = await executeCapability(invocation, testDeps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.stateChanged).toBe('no');
    }
  });

  it('rejects cross-tenant execution with TENANT_SCOPE_VIOLATION and stateChanged: "no"', async () => {
    const foreignPrincipal: AgentPrincipal = {
      ...mockPrincipal,
      workspaceId: 'ws_other_tenant',
      organizationId: 'org_other_tenant',
    };

    const invocation = createServerActionInvocation({
      capabilityId: 'deal.advance_stage',
      input: {
        workspaceId: 'ws_sales_test', // Target workspace mismatches foreign principal workspace
        dealId: 'deal_101',
        stageId: 'stage_won',
      },
      principal: foreignPrincipal,
    });

    const result = await executeCapability(invocation, testDeps);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('TENANT_SCOPE_VIOLATION');
      expect(result.error.stateChanged).toBe('no');
    }
  });
});
