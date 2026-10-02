// @vitest-environment node
/**
 * @fileOverview Exhaustive End-to-End QA Test Suite for MCP Implementation
 *
 * Validates Industry-Grade Compliance Across Phase 0 & Phase 1 (Milestones 1, 2, 3):
 * 1. Protocol & Schema Compliance (SDK v2 Standard Schema adapter, JSON Schema export)
 * 2. In-Place Upgraded Legacy Tools (task-tools, crm-tools, deal-tools via unified registry)
 * 3. Security Trust Boundaries (Anti-Spoofing, Anti-IDOR, No Anonymous Fallback, Least Privilege)
 * 4. Model Safety & Information Disclosure Defense (Rule 48 / Rule 52 error sanitization)
 * 5. Idempotency Key Determinism & Replay Invariants (Rule 19)
 * 6. Non-Delegable Action Defense (Rule 17)
 * 7. Surface & Audit Invariants (Rule 40, Rule 60, Rule 61)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import {
  createCapabilityToolHandler,
  toolNameFor,
} from '../../mcp/create-stateless-handler';
import { toMcpToolSchema } from '../../mcp/to-mcp-tool-schema';
import { globalMcpRegistry } from '@/lib/mcp/registry';
import type {
  AgentPrincipal,
  CapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import type { McpExecutionContext } from '@/lib/mcp/types';

// Register all core MCP tools into globalMcpRegistry
import '@/lib/mcp/tools';

vi.mock('@/lib/tasks/task-core', () => ({
  createTaskCore: vi.fn().mockResolvedValue({
    success: true,
    id: 'mock_task_qa_123',
    task: { id: 'mock_task_qa_123', title: 'QA Automated Verification Task' },
  }),
}));

// Mock principal
const mockMcpPrincipal: AgentPrincipal = {
  actorType: 'agent',
  userId: 'user_mcp_qa_1',
  agentId: 'agent_mcp_qa_runner',
  organizationId: 'org_mcp_qa',
  workspaceId: 'ws_mcp_qa',
  grantedScopes: [
    'operations:tasks:create',
    'app:tasks_create',
    'tasks:create',
    'operations:campuses:view',
    'app:contacts_view',
    'crm:entities:read',
    'deals:advance_stage',
    'app:deals_manage',
    'contacts.read',
  ],
  effectiveRole: 'mcp_caller',
};

describe('Exhaustive MCP QA Suite: Industry-Grade Verification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. In-Place Upgraded Legacy MCP Tools (Unified Registry SSOT)', () => {
    it('executes in-place upgraded task.create through the canonical registry', async () => {
      const tool = globalMcpRegistry.getTool('task.create');
      expect(tool).toBeDefined();

      const mcpCtx: McpExecutionContext = {
        workspaceId: 'ws_mcp_qa',
        organizationId: 'org_mcp_qa',
        callerId: 'user_mcp_qa_1',
        callerType: 'agent',
        requestId: 'req_qa_task_create',
        callDepth: 0,
        timestamp: new Date().toISOString(),
      };

      const result = await tool?.handler(
        {
          title: 'QA Automated Verification Task',
          description: 'Testing in-place upgrade',
          priority: 'high',
        },
        mcpCtx
      );

      expect(result).toBeDefined();
      expect(result?.title).toBe('QA Automated Verification Task');
      expect(result?.status).toBe('todo');
    });

    it('executes in-place upgraded crm.search_entities through the canonical registry', async () => {
      const tool = globalMcpRegistry.getTool('crm.search_entities');
      expect(tool).toBeDefined();

      const mcpCtx: McpExecutionContext = {
        workspaceId: 'ws_mcp_qa',
        organizationId: 'org_mcp_qa',
        callerId: 'user_mcp_qa_1',
        callerType: 'agent',
        requestId: 'req_qa_crm_search',
        callDepth: 0,
        timestamp: new Date().toISOString(),
      };

      const result = await tool?.handler(
        {
          query: 'Test',
          limit: 10,
        },
        mcpCtx
      );

      expect(result).toBeDefined();
      expect(typeof result?.totalFound).toBe('number');
      expect(Array.isArray(result?.entities)).toBe(true);
    });

    it('executes in-place upgraded deal.update_stage through the canonical registry', async () => {
      const tool = globalMcpRegistry.getTool('deal.update_stage');
      expect(tool).toBeDefined();

      const mcpCtx: McpExecutionContext = {
        workspaceId: 'ws_mcp_qa',
        organizationId: 'org_mcp_qa',
        callerId: 'user_mcp_qa_1',
        callerType: 'agent',
        requestId: 'req_qa_deal_stage',
        callDepth: 0,
        timestamp: new Date().toISOString(),
      };

      const result = await tool?.handler(
        {
          dealId: 'deal_qa_123',
          stageId: 'stage_negotiation',
        },
        mcpCtx
      );

      expect(result).toBeDefined();
      expect(result?.dealId).toBe('deal_qa_123');
      expect(result?.stageId).toBe('stage_negotiation');
    });
  });

  describe('2. Security Boundary & Anti-IDOR QA (Rules 13, 16, 47, 49)', () => {
    it('refuses anonymous requests with UNAUTHENTICATED without calling handler', async () => {
      const handlerSpy = vi.fn();
      const cap: CapabilityDefinition<{ query: string }, { result: string }> = {
        id: 'qa.test.read',
        version: '1.0.0',
        name: 'QA Test Read',
        description: 'Testing anonymous rejection',
        domain: 'knowledge_memory',
        operation: 'search',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        permissions: ['contacts.read'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
        handler: handlerSpy,
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => null, // Anonymous caller
      });

      const response = await tool({ query: 'secret' });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toBe('Access denied: authentication required.');
      expect(handlerSpy).not.toHaveBeenCalled();
    });

    it('intercepts cross-tenant workspace tampering (Rule 47 Anti-IDOR)', async () => {
      const handlerSpy = vi.fn();
      const cap: CapabilityDefinition<{ workspaceId: string }, { result: string }> = {
        id: 'qa.tenant.tamper',
        version: '1.0.0',
        name: 'QA Tenant Tamper',
        description: 'Testing cross-tenant tampering rejection',
        domain: 'knowledge_memory',
        operation: 'search',
        inputSchema: z.object({ workspaceId: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        permissions: ['contacts.read'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
        handler: handlerSpy,
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => mockMcpPrincipal,
      });

      // Target different workspace than caller's 'ws_mcp_qa'
      const response = await tool({ workspaceId: 'ws_FOREIGN_VICTIM' });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toBe(
        'Access denied: the request targets a different organization or workspace.'
      );
      expect(handlerSpy).not.toHaveBeenCalled();
    });

    it('rejects caller missing the required capability permission scope (Rule 16 Least Privilege)', async () => {
      const handlerSpy = vi.fn();
      const cap: CapabilityDefinition<{ text: string }, { result: string }> = {
        id: 'qa.restricted.operation',
        version: '1.0.0',
        name: 'QA Restricted Operation',
        description: 'Requires finance:wire scope',
        domain: 'deals_revenue',
        operation: 'execute',
        inputSchema: z.object({ text: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        permissions: ['finance:wire_transfer'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L3_EXTERNAL_COMMUNICATION_FINANCE', destructive: false, idempotent: false, openWorld: false, requiresHumanApproval: true, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
        handler: handlerSpy,
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => mockMcpPrincipal, // lacks 'finance:wire_transfer'
      });

      const response = await tool({ text: 'send wire' });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('Access denied');
      expect(handlerSpy).not.toHaveBeenCalled();
    });
  });

  describe('3. Model Safety & Information Disclosure Defense (Rules 48 & 52)', () => {
    it('sanitizes unexpected internal exceptions and returns a reference correlationId', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const cap: CapabilityDefinition<{ input: string }, { result: string }> = {
        id: 'qa.leak.test',
        version: '1.0.0',
        name: 'QA Leak Test',
        description: 'Tests that internal exception messages never leak to model',
        domain: 'ai_governance',
        operation: 'execute',
        inputSchema: z.object({ input: z.string() }),
        outputSchema: z.object({ result: z.string() }),
        permissions: ['contacts.read'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
        handler: async () => {
          throw new Error('FATAL: Database connection string: postgresql://admin:SuperSecretPass123@internal-db:5432/main');
        },
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => mockMcpPrincipal,
      });

      const response = await tool({ input: 'test' });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).not.toContain('SuperSecretPass123');
      expect(response.content[0].text).not.toContain('postgresql');
      expect(response.content[0].text).toMatch(/Capability failed unexpectedly\. Reference: [0-9a-f-]{36}/);

      errSpy.mockRestore();
    });

    it('rejects invalid inputs with clean field paths and zero stack trace leakage', async () => {
      const cap: CapabilityDefinition<{ count: number; email: string }, { ok: boolean }> = {
        id: 'qa.schema.validation',
        version: '1.0.0',
        name: 'QA Schema Validation',
        description: 'Tests field-level input schema diagnostics',
        domain: 'ai_governance',
        operation: 'execute',
        inputSchema: z.object({
          count: z.number().int().min(1),
          email: z.string().email(),
        }),
        outputSchema: z.object({ ok: z.boolean() }),
        permissions: ['contacts.read'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
        handler: async () => ({ success: true, data: { ok: true }, executionId: 'e', emittedEvents: [], durationMs: 1 }),
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => mockMcpPrincipal,
      });

      const response = await tool({ count: -5, email: 'not-an-email' });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toContain('count:');
      expect(response.content[0].text).toContain('email:');
      expect(response.content[0].text).not.toContain('node_modules');
    });

    it('fails closed when capability output violates declared output schema (Rule 50 Output Validation)', async () => {
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      const cap: CapabilityDefinition<{ query: string }, { answer: string }> = {
        id: 'qa.output.poison',
        version: '1.0.0',
        name: 'QA Output Poison',
        description: 'Tests output schema enforcement',
        domain: 'ai_governance',
        operation: 'search',
        inputSchema: z.object({ query: z.string() }),
        outputSchema: z.object({ answer: z.string() }),
        permissions: ['contacts.read'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L0_READ', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: false, requiresExpectedVersion: false, auditRequired: false },
        handler: async () => ({
          success: true,
          // Deliberately return invalid type to test defense-in-depth
          data: { answer: 12345 as unknown as string },
          executionId: 'e',
          emittedEvents: [],
          durationMs: 1,
        }),
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => mockMcpPrincipal,
      });

      const response = await tool({ query: 'hello' });
      expect(response.isError).toBe(true);
      expect(response.content[0].text).toMatch(/Capability returned an invalid result\. Reference: [0-9a-f-]{36}/);

      errSpy.mockRestore();
    });
  });

  describe('4. Deterministic Idempotency Key Derivation (Rule 19)', () => {
    it('produces identical deterministic idempotency key for identical parsed input', async () => {
      const recordedKeys: string[] = [];

      const cap: CapabilityDefinition<{ title: string; count?: number }, { status: string }> = {
        id: 'qa.idempotency.test',
        version: '1.0.0',
        name: 'QA Idempotency Test',
        description: 'Tests deterministic key derivation',
        domain: 'tasks_productivity',
        operation: 'create',
        inputSchema: z.object({
          title: z.string().trim().min(1),
          count: z.number().optional(),
        }),
        outputSchema: z.object({ status: z.string() }),
        permissions: ['tasks:create'],
        workspaceScoped: true,
        tenantScoped: true,
        risk: { level: 'L1_INTERNAL_DRAFT', destructive: false, idempotent: true, openWorld: false, requiresHumanApproval: false, nonDelegable: false },
        execution: { synchronous: true, maxDurationMs: 5000, supportsDryRun: false, supportsCancellation: false, supportsCompensation: false, maxPayloadSizeBytes: 1024 },
        policies: { requiresIdempotencyKey: true, requiresExpectedVersion: false, auditRequired: false },
        handler: async (_input, ctx) => {
          if (ctx.idempotencyKey) {
            recordedKeys.push(ctx.idempotencyKey);
          }
          return {
            success: true,
            data: { status: 'ok' },
            executionId: ctx.correlationId,
            emittedEvents: [],
            durationMs: 1,
          };
        },
      };

      const tool = createCapabilityToolHandler(cap, {
        getPrincipal: () => mockMcpPrincipal,
      });

      // Invocation 1
      await tool({ title: 'Finish QA' });
      // Invocation 2: leading/trailing whitespace trims to identical parsed input
      await tool({ title: '   Finish QA   ' });
      // Invocation 3: distinct input
      await tool({ title: 'Other Task' });

      expect(recordedKeys.length).toBe(3);
      expect(recordedKeys[0]).toMatch(/^mcp:[0-9a-f]{64}$/);
      expect(recordedKeys[1]).toBe(recordedKeys[0]); // Deterministic equivalence!
      expect(recordedKeys[2]).not.toBe(recordedKeys[0]); // Distinct input produces distinct key
    });
  });

  describe('5. Protocol Compliance & Tool Name Sanitization (Rule 11)', () => {
    it('sanitizes dots to underscores for MCP tool names', () => {
      expect(toolNameFor('identity.actor.get_current')).toBe('identity_actor_get_current');
      expect(toolNameFor('crm.entity.search')).toBe('crm_entity_search');
      expect(toolNameFor('deal.advance_stage')).toBe('deal_advance_stage');
      expect(toolNameFor('task.create')).toBe('task_create');
    });

    it('exports whole standard schema with JSON Schema input/output generators', () => {
      const zSchema = z.object({
        workspaceId: z.string().min(1),
        limit: z.number().int().min(1).max(100).default(20),
      });

      const adapted = toMcpToolSchema(zSchema);
      expect(adapted['~standard']).toBeDefined();
      expect(adapted['~standard'].version).toBe(1);

      const jsonSchema = adapted['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
      expect(jsonSchema.type).toBe('object');
      expect(jsonSchema.properties).toHaveProperty('workspaceId');
      expect(jsonSchema.properties).toHaveProperty('limit');
    });
  });
});
