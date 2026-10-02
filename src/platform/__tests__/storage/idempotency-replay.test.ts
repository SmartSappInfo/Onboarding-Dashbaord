// @vitest-environment node
/**
 * @fileOverview Idempotency Lease & Replay Protection Tests (PR-7 / Workstream 1.4)
 *
 * Implements Rule 19 (Mandatory Idempotency Definition) and Rule 20 (Replay Protection).
 * Verifies atomic lease claims, 24h replay caching, and end-to-end gateway replay behavior.
 */

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import {
  createInMemoryIdempotencyStore,
  buildExecutionKey,
} from '../../capabilities/storage/execution-store';
import { executeCapability } from '../../capabilities/execution/execute-capability';
import type { AnyCapabilityDefinition, AgentPrincipal } from '../../capabilities/contracts/capability-definition';
import type { CapabilityInvocation } from '../../capabilities/execution/invocation';

const mockPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user-1',
  organizationId: 'org-1',
  workspaceId: 'ws-1',
  grantedScopes: ['contacts.read', 'contacts.write'],
  effectiveRole: 'admin',
};

function createMockMutatingCapability(
  overrides?: Partial<AnyCapabilityDefinition>
): AnyCapabilityDefinition {
  return {
    id: 'crm.contact.create',
    version: '1.0.0',
    name: 'Create Contact',
    description: 'Creates a contact record',
    domain: 'crm_contacts',
    operation: 'create',
    inputSchema: z.object({
      name: z.string().min(1),
      email: z.string().email(),
      organizationId: z.string().optional(),
      workspaceId: z.string().optional(),
    }),
    outputSchema: z.object({
      contactId: z.string(),
      created: z.boolean(),
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
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    handler: async (_input: { name: string; email: string }) => ({
      success: true,
      data: { contactId: 'contact-abc', created: true },
      executionId: 'exec-123',
      emittedEvents: [],
      durationMs: 15,
    }),
    ...overrides,
  } as unknown as AnyCapabilityDefinition;
}

describe('Idempotency Store: Lease & Replay Protection (Rules 19 & 20)', () => {
  describe('Unit Store Mechanics', () => {
    it('claims new key with lease duration', async () => {
      const store = createInMemoryIdempotencyStore();
      const now = 1000000;
      const leaseMs = 30000;

      const claim = await store.claim('key-1', { leaseMs, nowMs: now });
      expect(claim.claimed).toBe(true);
      expect(claim.leaseExpiresAt).toBe(new Date(now + leaseMs).toISOString());

      const record = await store.get('key-1');
      expect(record?.status).toBe('running');
    });

    it('rejects concurrent claim while active lease is unexpired', async () => {
      const store = createInMemoryIdempotencyStore();
      const now = 1000000;
      const leaseMs = 30000;

      await store.claim('key-1', { leaseMs, nowMs: now });

      // Second claim attempt 5s later
      const secondClaim = await store.claim('key-1', { leaseMs, nowMs: now + 5000 });
      expect(secondClaim.claimed).toBe(false);
      expect(secondClaim.leaseExpiresAt).toBe(new Date(now + leaseMs).toISOString());
    });

    it('allows re-claiming after an active lease expires', async () => {
      const store = createInMemoryIdempotencyStore();
      const now = 1000000;
      const leaseMs = 30000;

      await store.claim('key-1', { leaseMs, nowMs: now });

      // Third claim attempt after lease expires at now + 35000
      const expiredClaim = await store.claim('key-1', { leaseMs, nowMs: now + 35000 });
      expect(expiredClaim.claimed).toBe(true);
      expect(expiredClaim.leaseExpiresAt).toBe(new Date(now + 35000 + leaseMs).toISOString());
    });

    it('marks completion and preserves cached result', async () => {
      const store = createInMemoryIdempotencyStore();
      await store.claim('key-1', { leaseMs: 30000, nowMs: 1000 });

      await store.complete('key-1', { orderId: 'ord-999', total: 100 });

      const record = await store.get('key-1');
      expect(record?.status).toBe('completed');
      expect(record?.result).toEqual({ orderId: 'ord-999', total: 100 });

      // Subsequent claim fails because it is already completed
      const nextClaim = await store.claim('key-1', { leaseMs: 30000, nowMs: 2000 });
      expect(nextClaim.claimed).toBe(false);
    });

    it('builds tenant-isolated execution keys', () => {
      const key1 = buildExecutionKey('org-1', 'ws-1', 'crm.contact.create', 'req-100');
      const key2 = buildExecutionKey('org-2', 'ws-1', 'crm.contact.create', 'req-100');
      const key3 = buildExecutionKey('org-1', 'ws-2', 'crm.contact.create', 'req-100');

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toBe('org-1:ws-1:crm.contact.create:req-100');
    });
  });

  describe('End-to-End Gateway Integration', () => {
    it('executes handler on first call and caches result in store', async () => {
      const store = createInMemoryIdempotencyStore();
      const handlerSpy = vi.fn().mockResolvedValue({
        success: true,
        data: { contactId: 'c-new', created: true },
        executionId: 'exec-1',
        emittedEvents: [],
        durationMs: 10,
      });

      const cap = createMockMutatingCapability({ handler: handlerSpy });
      const invocation: CapabilityInvocation = {
        capabilityId: 'crm.contact.create',
        version: '1.0.0',
        surface: 'ui',
        input: { name: 'Alice', email: 'alice@example.com' },
        principal: mockPrincipal,
        correlationId: 'corr-10',
        idempotencyKey: 'idem-test-1',
      };

      const outcome1 = await executeCapability(invocation, {
        registryLookup: () => cap,
        idempotencyStore: store,
      });

      expect(outcome1.success).toBe(true);
      if (outcome1.success) {
        expect(outcome1.stateChanged).toBe('yes');
        expect(outcome1.data).toEqual({ contactId: 'c-new', created: true });
      }
      expect(handlerSpy).toHaveBeenCalledTimes(1);

      // Verify store state is now completed
      const stored = await store.get('idem-test-1');
      expect(stored?.status).toBe('completed');
      expect(stored?.result).toEqual({ contactId: 'c-new', created: true });

      // Second invocation with identical idempotencyKey
      const outcome2 = await executeCapability(invocation, {
        registryLookup: () => cap,
        idempotencyStore: store,
      });

      expect(outcome2.success).toBe(true);
      if (outcome2.success) {
        // Rule 23: Replay results MUST have stateChanged = "no"
        expect(outcome2.stateChanged).toBe('no');
        expect(outcome2.data).toEqual({ contactId: 'c-new', created: true });
      }
      // Handler was NOT called a second time
      expect(handlerSpy).toHaveBeenCalledTimes(1);
    });

    it('rejects concurrent duplicate request in progress with 409 DUPLICATE_IN_PROGRESS', async () => {
      const store = createInMemoryIdempotencyStore();

      // Pre-claim the key in 'running' state
      await store.claim('idem-concurrent', { leaseMs: 60000, nowMs: Date.now() });

      const cap = createMockMutatingCapability();
      const invocation: CapabilityInvocation = {
        capabilityId: 'crm.contact.create',
        version: '1.0.0',
        surface: 'ui',
        input: { name: 'Bob', email: 'bob@example.com' },
        principal: mockPrincipal,
        correlationId: 'corr-11',
        idempotencyKey: 'idem-concurrent',
      };

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
        idempotencyStore: store,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('DUPLICATE_IN_PROGRESS');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.httpStatus).toBe(409);
        expect(outcome.error.message).toContain('already in progress');
      }
    });

    it('enforces requiresIdempotencyKey policy when key is omitted', async () => {
      const cap = createMockMutatingCapability({
        policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: true },
      });
      const invocation: CapabilityInvocation = {
        capabilityId: 'crm.contact.create',
        version: '1.0.0',
        surface: 'ui',
        input: { name: 'Charlie', email: 'charlie@example.com' },
        principal: mockPrincipal,
        correlationId: 'corr-12',
        idempotencyKey: undefined, // missing
      };

      const outcome = await executeCapability(invocation, {
        registryLookup: () => cap,
      });

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('VALIDATION');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.message).toContain("requires an idempotency key");
      }
    });
  });
});
