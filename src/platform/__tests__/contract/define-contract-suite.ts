/**
 * @fileOverview Reusable Capability Contract Suite Generator (Phase 1 / PR-10)
 *
 * Implements Rule 2 (Testability), Rule 16 (Least Privilege), Rule 18 (TOCTOU),
 * Rule 23 (State-Changed Tri-State Invariant), Rule 31 (Output Validation),
 * Rule 47 (Tenant Isolation / Anti-IDOR), and Roadmap Section 4.
 *
 * Provides a standardized Vitest test generator for any canonical `CapabilityDefinition`.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import type {
  CapabilityDefinition,
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import {
  executeCapability,
  type ExecuteCapabilityDeps,
} from '../../capabilities/execution/execute-capability';
import { createServerActionInvocation } from '../../capabilities/execution/invocation';
import type { ExecutionAuditEntry } from '../../capabilities/execution/pipeline';
import type { DomainEvent } from '../../capabilities/events/domain-event';

export interface DefineContractSuiteOptions<TInput, TOutput> {
  capability: CapabilityDefinition<TInput, TOutput>;
  validInput: TInput;
  invalidInput: unknown;
  authorizedPrincipal: AgentPrincipal;
  unauthorizedPrincipal: AgentPrincipal;
  foreignWorkspacePrincipal?: AgentPrincipal;
  expectedVersion?: string | number;
  expectedConflictVersion?: string | number;
  customDeps?: ExecuteCapabilityDeps;
}

/**
 * Generates an exhaustive Layer 2 contract verification suite for a capability definition.
 */
export function defineContractSuite<TInput, TOutput>(
  options: DefineContractSuiteOptions<TInput, TOutput>
): void {
  const {
    capability,
    validInput,
    invalidInput,
    authorizedPrincipal,
    unauthorizedPrincipal,
    foreignWorkspacePrincipal,
    expectedVersion,
    expectedConflictVersion,
    customDeps,
  } = options;

  describe(`Contract Suite: ${capability.id}`, () => {
    const deps: ExecuteCapabilityDeps = {
      registryLookup: (id: string) =>
        id === capability.id ? (capability as AnyCapabilityDefinition) : undefined,
      ...customDeps,
    };

    it('executes successfully with valid input, validates output schema, and records audit (Rule 31, 40)', async () => {
      const audits: ExecutionAuditEntry[] = [];
      const events: DomainEvent[] = [];

      const invocation = createServerActionInvocation({
        capabilityId: capability.id,
        input: validInput,
        principal: authorizedPrincipal,
        expectedVersion,
      });

      const result = await executeCapability<TOutput>(
        invocation,
        {
          ...deps,
          auditSink: (entry) => {
            audits.push(entry);
          },
          outboxSink: (evts) => {
            events.push(...evts);
          },
        }
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        // Strict runtime output schema validation (Rule 31)
        const parsed = capability.outputSchema.safeParse(result.data);
        expect(parsed.success).toBe(true);
        expect(result.executionId).toBeDefined();
      }
      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(audits[0].decision).toBe('allowed');
    });

    it('rejects invalid input with INVALID_INPUT error and stateChanged: no (Rule 23)', async () => {
      const invocation = createServerActionInvocation({
        capabilityId: capability.id,
        input: invalidInput as TInput,
        principal: authorizedPrincipal,
      });

      const result = await executeCapability<TOutput>(invocation, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(['INVALID_INPUT', 'VALIDATION']).toContain(result.error.code);
        expect(result.error.stateChanged).toBe('no');
      }
    });

    it('rejects unauthorized principal with AUTHORIZATION_DENIED and stateChanged: no (Rule 16)', async () => {
      const invocation = createServerActionInvocation({
        capabilityId: capability.id,
        input: validInput,
        principal: unauthorizedPrincipal,
      });

      const result = await executeCapability<TOutput>(invocation, deps);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(['AUTHORIZATION_DENIED', 'FORBIDDEN', 'NOT_FOUND']).toContain(result.error.code);
        expect(result.error.stateChanged).toBe('no');
      }
    });

    const hasTenantBinding =
      capability.workspaceScoped ||
      (typeof validInput === 'object' &&
        validInput !== null &&
        ('workspaceId' in (validInput as Record<string, unknown>) ||
          'organizationId' in (validInput as Record<string, unknown>)));

    if (hasTenantBinding) {
      it('enforces tenant boundary isolation and masks cross-tenant access as TENANT_SCOPE_VIOLATION or NOT_FOUND (Rule 47)', async () => {
        const foreign = foreignWorkspacePrincipal ?? {
          ...authorizedPrincipal,
          workspaceId: 'foreign-workspace-unauthorized-999',
        };

        const invocation = createServerActionInvocation({
          capabilityId: capability.id,
          input: validInput,
          principal: foreign,
        });

        const result = await executeCapability<TOutput>(invocation, deps);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect([
            'TENANT_SCOPE_VIOLATION',
            'FORBIDDEN',
            'NOT_FOUND',
            'AUTHORIZATION_DENIED',
            'VALIDATION',
          ]).toContain(result.error.code);
          expect(result.error.stateChanged).toBe('no');
        }
      });
    }

    if (expectedConflictVersion !== undefined) {
      it('enforces TOCTOU concurrency conflict when expectedVersion mismatches (Rule 18)', async () => {
        const invocation = createServerActionInvocation({
          capabilityId: capability.id,
          input: validInput,
          principal: authorizedPrincipal,
          expectedVersion: expectedConflictVersion,
        });

        const result = await executeCapability<TOutput>(invocation, deps);

        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.code).toBe('VERSION_CONFLICT');
          expect(result.error.stateChanged).toBe('no');
        }
      });
    }
  });
}
