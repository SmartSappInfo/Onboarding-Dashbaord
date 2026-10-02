// @vitest-environment node
/**
 * @fileOverview Gateway Pipeline & Refusal Code Exhaustive Tests (Phase 1 / PR-4)
 *
 * Verifies all 16 pipeline steps, refusal codes, and the stateChanged invariant.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../capabilities/contracts/capability-definition';
import { executeCapability } from '../capabilities/execution/execute-capability';
import type { CapabilityInvocation } from '../capabilities/execution/invocation';
import type { ApprovalVerifier } from '../capabilities/policy/approval-verifier';
import type { DomainEvent } from '../capabilities/events/domain-event';

const mockPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  grantedScopes: ['contacts.read', 'contacts.write'],
  effectiveRole: 'admin',
};

function createMockCapability(
  overrides?: Partial<AnyCapabilityDefinition>
): AnyCapabilityDefinition {
  return {
    id: 'crm.contact.update',
    version: '1.0.0',
    name: 'Update contact',
    description: 'Updates a contact record',
    domain: 'crm_contacts',
    operation: 'update',
    inputSchema: z.object({
      contactId: z.string().min(1),
      name: z.string().min(1),
      organizationId: z.string().optional(),
      workspaceId: z.string().optional(),
    }),
    outputSchema: z.object({
      contactId: z.string(),
      updated: z.boolean(),
    }),
    permissions: ['contacts.write'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: true,
      openWorld: false,
      requiresHumanApproval: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 2000,
      supportsDryRun: true,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: false,
    },
    handler: async (input: { contactId: string; name: string }) => ({
      success: true,
      data: { contactId: input.contactId, updated: true },
      executionId: 'exec-1',
      emittedEvents: [],
      durationMs: 5,
    }),
    ...overrides,
  } as unknown as AnyCapabilityDefinition;
}

function createBaseInvocation(overrides?: Partial<CapabilityInvocation>): CapabilityInvocation {
  return {
    capabilityId: 'crm.contact.update',
    version: '1.0.0',
    surface: 'ui',
    input: { contactId: 'c-1', name: 'Alice' },
    principal: mockPrincipal,
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('Canonical Execution Gateway Pipeline (Steps 1–16)', () => {
  // ── Step 1: Resolve Principal ──
  describe('Step 1: Resolve Principal', () => {
    it('refuses unauthenticated callers with UNAUTHENTICATED and stateChanged = "no"', async () => {
      const cap = createMockCapability();
      const invocation = createBaseInvocation({ principal: undefined });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('UNAUTHENTICATED');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(401);
      }
    });

    it('forces actorType: "agent" for surface: "mcp"', async () => {
      let seenPrincipal: AgentPrincipal | undefined;
      const cap = createMockCapability({
        handler: async (_input, ctx) => {
          seenPrincipal = ctx.principal;
          return { success: true, data: { contactId: 'c-1', updated: true }, executionId: 'e', emittedEvents: [], durationMs: 1 };
        },
      });
      const invocation = createBaseInvocation({ surface: 'mcp' });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(true);
      expect(seenPrincipal?.actorType).toBe('agent');
    });
  });

  // ── Step 2: Lookup Capability ──
  describe('Step 2: Lookup Capability', () => {
    it('refuses unregistered capability with CAPABILITY_NOT_REGISTERED and stateChanged = "no"', async () => {
      const invocation = createBaseInvocation({ capabilityId: 'unknown.cap' });
      const outcome = await executeCapability(invocation, {
        registryLookup: () => undefined,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('CAPABILITY_NOT_REGISTERED');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(404);
      }
    });

    it('refuses version mismatch with CAPABILITY_VERSION_MISMATCH and stateChanged = "no"', async () => {
      const cap = createMockCapability({ version: '1.0.0' });
      const invocation = createBaseInvocation({ version: '2.0.0' });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('CAPABILITY_VERSION_MISMATCH');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(404);
      }
    });
  });

  // ── Step 3: Check Flags ──
  describe('Step 3: Check Flags & Kill Switches', () => {
    it('refuses disabled capability with DISABLED and stateChanged = "no"', async () => {
      const cap = createMockCapability();
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        flagChecker: {
          checkFlag: () => ({ enabled: false, reason: 'Kill-switch triggered for maintenance.' }),
        },
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('DISABLED');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(403);
      }
    });
  });

  // ── Step 4: Validate Payload Size ──
  describe('Step 4: Validate Payload Size', () => {
    it('refuses oversized payload before schema parsing with VALIDATION and stateChanged = "no"', async () => {
      const cap = createMockCapability({
        execution: {
          synchronous: true,
          maxDurationMs: 1000,
          supportsDryRun: false,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 50, // 50 bytes limit
        },
      });
      const largeInput = { contactId: 'c-1', name: 'A'.repeat(200) };
      const invocation = createBaseInvocation({ input: largeInput });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('VALIDATION');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.message).toContain('exceeds the allowed limit');
      }
    });
  });

  // ── Step 5: Validate Input ──
  describe('Step 5: Validate Input', () => {
    it('refuses invalid schema input with INVALID_INPUT and stateChanged = "no"', async () => {
      const cap = createMockCapability();
      const invocation = createBaseInvocation({ input: { contactId: 12345 } }); // invalid contactId type and missing name

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('INVALID_INPUT');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(400);
      }
    });
  });

  // ── Step 6: Bind Tenant ──
  describe('Step 6: Bind Tenant', () => {
    it('refuses cross-tenant targeting with TENANT_SCOPE_VIOLATION and stateChanged = "no"', async () => {
      const cap = createMockCapability();
      const invocation = createBaseInvocation({
        input: { contactId: 'c-1', name: 'Alice', workspaceId: 'ws-OTHER' },
      });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('TENANT_SCOPE_VIOLATION');
        expect(outcome.error.stateChanged).toBe('no');
      }
    });
  });

  // ── Step 7: Resolve Resource Scope ──
  describe('Step 7: Resolve Resource Scope', () => {
    it('returns NOT_FOUND (never reveal existence) when resource belongs to another tenant', async () => {
      const cap = createMockCapability({
        resolveResourceScope: async () => ({
          resourceId: 'c-1',
          workspaceId: 'ws-DIFFERENT',
        }),
      });
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('NOT_FOUND');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(404);
      }
    });
  });

  // ── Step 8: Authorize Principal ──
  describe('Step 8: Authorize Principal', () => {
    it('refuses caller lacking permission with AUTHORIZATION_DENIED and stateChanged = "no"', async () => {
      const cap = createMockCapability();
      const invocation = createBaseInvocation({
        principal: { ...mockPrincipal, grantedScopes: ['contacts.read'] }, // missing contacts.write
      });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('AUTHORIZATION_DENIED');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(403);
      }
    });

    it('refuses revoked actor standing with ACTOR_REVOKED and stateChanged = "no"', async () => {
      const cap = createMockCapability();
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        verifyActorStanding: async () => ({ active: false, reason: 'User session suspended' }),
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('ACTOR_REVOKED');
        expect(outcome.error.stateChanged).toBe('no');
      }
    });
  });

  // ── Step 9: Verify Approval ──
  describe('Step 9: Verify Approval', () => {
    it('refuses high-risk agent call lacking approval with APPROVAL_REQUIRED and stateChanged = "no"', async () => {
      const cap = createMockCapability({
        risk: {
          level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
          destructive: true,
          idempotent: false,
          openWorld: false,
          requiresHumanApproval: true,
          nonDelegable: false,
        },
      });
      const invocation = createBaseInvocation({
        principal: { ...mockPrincipal, actorType: 'agent', agentId: 'agent-1' },
        approvalId: undefined,
      });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('APPROVAL_REQUIRED');
        expect(outcome.error.stateChanged).toBe('no');
      }
    });

    it('burn prevention: unauthorized call fails at Step 8 without calling verifyAndBind', async () => {
      const cap = createMockCapability({
        permissions: ['super.admin'],
        risk: {
          level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
          destructive: true,
          idempotent: false,
          openWorld: false,
          requiresHumanApproval: true,
          nonDelegable: false,
        },
      });
      const verifySpy = vi.fn();
      const verifyAndBindSpy = vi.fn();
      const mockApprovals: ApprovalVerifier = {
        verify: verifySpy,
        verifyAndBind: verifyAndBindSpy,
      };

      const invocation = createBaseInvocation({
        principal: { ...mockPrincipal, actorType: 'agent', agentId: 'agent-1', grantedScopes: ['contacts.read'] },
        approvalId: 'appr-123',
      });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        approvals: mockApprovals,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('AUTHORIZATION_DENIED');
        expect(outcome.error.stateChanged).toBe('no');
      }
      expect(verifyAndBindSpy).not.toHaveBeenCalled();
    });
  });

  // ── Step 10: Check Idempotency ──
  describe('Step 10: Check Idempotency', () => {
    it('returns cached result on replay with stateChanged = "no"', async () => {
      const handlerSpy = vi.fn();
      const cap = createMockCapability({
        policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false },
        handler: handlerSpy,
      });
      const invocation = createBaseInvocation({ idempotencyKey: 'key-123' });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        idempotencyStore: {
          get: async () => ({ status: 'completed', result: { contactId: 'c-1', updated: true } }),
          claim: async () => ({ claimed: true, leaseExpiresAt: '' }),
        },
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.stateChanged).toBe('no');
        expect(outcome.data).toEqual({ contactId: 'c-1', updated: true });
      }
      expect(handlerSpy).not.toHaveBeenCalled();
    });

    it('refuses concurrent duplicate in progress with DUPLICATE_IN_PROGRESS and stateChanged = "no"', async () => {
      const cap = createMockCapability({
        policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false },
      });
      const invocation = createBaseInvocation({ idempotencyKey: 'key-running' });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        idempotencyStore: {
          get: async () => ({ status: 'running', leaseExpiresAt: new Date(Date.now() + 60000).toISOString() }),
          claim: async () => ({ claimed: false, leaseExpiresAt: '' }),
        },
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('DUPLICATE_IN_PROGRESS');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(409);
      }
    });
  });

  // ── Step 11: Check Concurrency ──
  describe('Step 11: Check Concurrency', () => {
    it('refuses stale version with VERSION_CONFLICT and stateChanged = "no"', async () => {
      const cap = createMockCapability({
        resolveResourceScope: async () => ({
          resourceId: 'c-1',
          resourceVersion: 5,
        }),
      });
      const invocation = createBaseInvocation({ expectedVersion: 4 }); // mismatch: expected 4, actual 5

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('VERSION_CONFLICT');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(409);
      }
    });
  });

  // ── Step 12: Dry Run ──
  describe('Step 12: Dry Run', () => {
    it('returns simulation plan with zero mutations and stateChanged = "no"', async () => {
      const handlerSpy = vi.fn();
      const cap = createMockCapability({
        execution: {
          synchronous: true,
          maxDurationMs: 1000,
          supportsDryRun: true,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 1024,
        },
        handler: handlerSpy,
      });
      const invocation = createBaseInvocation({ dryRun: true });

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.stateChanged).toBe('no');
        expect(outcome.data).toMatchObject({ dryRun: true, capabilityId: 'crm.contact.update' });
      }
      expect(handlerSpy).not.toHaveBeenCalled();
    });
  });

  // ── Step 13: Execute Handler ──
  describe('Step 13: Execute Handler', () => {
    it('fails with TIMEOUT and stateChanged = "unknown" when duration exceeds budget', async () => {
      const cap = createMockCapability({
        execution: {
          synchronous: true,
          maxDurationMs: 20, // 20 ms timeout
          supportsDryRun: false,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 1024,
        },
        handler: () => new Promise<never>(() => undefined), // never resolves
      });
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('TIMEOUT');
        expect(outcome.error.stateChanged).toBe('unknown');
        expect(outcome.error.retryable).toBe(true);
      }
    });

    it('fails with HANDLER_EXCEPTION and stateChanged = "unknown" when handler throws', async () => {
      const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const cap = createMockCapability({
        handler: async () => {
          throw new Error('Database pool exhausted');
        },
      });
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('HANDLER_EXCEPTION');
        expect(outcome.error.stateChanged).toBe('unknown');
      }
      spy.mockRestore();
    });
  });

  // ── Step 14: Validate Output ──
  describe('Step 14: Validate Output', () => {
    it('refuses malformed output with INVALID_OUTPUT, stateChanged = "unknown", and withholds data', async () => {
      const cap = createMockCapability({
        handler: async () => ({
          success: true,
          data: { contactId: 'c-1', updated: 'NOT_A_BOOLEAN' as unknown as boolean },
          executionId: 'e',
          emittedEvents: [],
          durationMs: 1,
        }),
      });
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('INVALID_OUTPUT');
        expect(outcome.error.stateChanged).toBe('unknown');
      }
    });
  });

  // ── Steps 15 & 16: Audit, Events, and Result ──
  describe('Steps 15 & 16: Audit, Events, and Typed Result', () => {
    it('successfully executes, audits, queues outbox events, and returns stateChanged = "yes" for mutations', async () => {
      const auditSpy = vi.fn();
      const outboxSpy = vi.fn();
      const mockEvent: DomainEvent = {
        id: '11111111-1111-4111-a111-111111111111',
        type: 'crm.contact.updated',
        version: '1.0.0',
        source: 'crm',
        timestamp: new Date().toISOString(),
        correlationId: 'corr-1',
        actor: { type: 'user', id: 'user-1' },
        entity: { type: 'contact', id: 'c-1' },
        organizationId: 'org-1',
        workspaceId: 'ws-1',
        payload: { contactId: 'c-1' },
      };

      const cap = createMockCapability({
        handler: async () => ({
          success: true,
          data: { contactId: 'c-1', updated: true },
          executionId: 'exec-123',
          emittedEvents: [mockEvent],
          durationMs: 10,
        }),
      });
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        auditSink: auditSpy,
        outboxSink: outboxSpy,
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.stateChanged).toBe('yes');
        expect(outcome.data).toEqual({ contactId: 'c-1', updated: true });
        expect(outcome.emittedEvents).toHaveLength(1);
      }
      expect(auditSpy).toHaveBeenCalledWith(
        expect.objectContaining({ decision: 'allowed', outcome: 'succeeded', capabilityId: 'crm.contact.update' })
      );
      expect(outboxSpy).toHaveBeenCalledWith([mockEvent]);
    });

    it('returns stateChanged = "no" for read-only capabilities', async () => {
      const cap = createMockCapability({
        operation: 'read',
        handler: async () => ({
          success: true,
          data: { contactId: 'c-1', updated: false },
          executionId: 'exec-read',
          emittedEvents: [],
          durationMs: 2,
        }),
      });
      const invocation = createBaseInvocation();

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.stateChanged).toBe('no');
      }
    });
  });
});
