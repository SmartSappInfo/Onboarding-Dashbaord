// @vitest-environment node
/**
 * @fileOverview Tests for define-contract-suite.ts (Task 1)
 */

import { describe } from 'vitest';
import { z } from 'zod/v4';
import { defineContractSuite } from './define-contract-suite';
import type { CapabilityDefinition, AgentPrincipal } from '../../capabilities/contracts/capability-definition';

const testInputSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().optional(),
});

const testOutputSchema = z.object({
  success: z.boolean(),
  echoId: z.string(),
});

type TestInput = z.infer<typeof testInputSchema>;
type TestOutput = z.infer<typeof testOutputSchema>;

const dummyCapability: CapabilityDefinition<TestInput, TestOutput> = {
  id: 'test.dummy.echo',
  version: '1.0.0',
  name: 'Dummy Echo',
  description: 'Echo capability for testing contract suite generator',
  domain: 'platform_integrations',
  operation: 'read',
  inputSchema: testInputSchema,
  outputSchema: testOutputSchema,
  permissions: ['system.test'],
  workspaceScoped: true,
  tenantScoped: true,
  risk: {
    level: 'L0_READ',
    destructive: false,
    idempotent: true,
    openWorld: false,
    requiresHumanApproval: false,
    nonDelegable: false,
  },
  execution: {
    synchronous: true,
    maxDurationMs: 5000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 1024 * 1024,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  async handler(input, ctx) {
    return {
      success: true,
      data: {
        success: true,
        echoId: input.id,
      },
      executionId: ctx.correlationId,
      emittedEvents: [],
      durationMs: 5,
    };
  },
};

const authorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user-auth',
  organizationId: 'org-test',
  workspaceId: 'ws-test',
  grantedScopes: ['system.test'],
  effectiveRole: 'admin',
};

const unauthorizedPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user-unauth',
  organizationId: 'org-test',
  workspaceId: 'ws-test',
  grantedScopes: ['other.scope'],
  effectiveRole: 'viewer',
};

describe('define-contract-suite test generator self-verification', () => {
  defineContractSuite<TestInput, TestOutput>({
    capability: dummyCapability,
    validInput: { id: 'test-123', workspaceId: 'ws-test' },
    invalidInput: { id: 12345 }, // invalid type
    authorizedPrincipal,
    unauthorizedPrincipal,
    foreignWorkspacePrincipal: {
      ...authorizedPrincipal,
      workspaceId: 'foreign-ws-unauthorized',
    },
  });
});
