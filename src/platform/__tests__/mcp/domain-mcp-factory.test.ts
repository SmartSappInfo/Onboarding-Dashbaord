/**
 * @fileOverview Unit tests for Domain-Partitioned MCP Server Factory (Phase 5 Milestone 2 Task 2)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  createDomainMcpServer,
  getDomainServerToolSummary,
} from '../../mcp/servers/domain-mcp-factory';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';

describe('Domain-Partitioned MCP Server Factory (Phase 5 Milestone 2 Task 2)', () => {
  const mockPrincipal: AgentPrincipal = {
    actorType: 'agent',
    userId: 'user_sdr_123',
    organizationId: 'org_acme',
    workspaceId: 'ws_sales',
    agentId: 'agent_sdr',
    agentVersion: '2.0.0',
    grantedScopes: ['app:crm_view', 'crm:read', 'app:knowledge_view'],
    effectiveRole: 'mcp_agent',
  };

  const crmReadCap: AnyCapabilityDefinition = {
    id: 'crm.entity.get',
    version: '1.0.0',
    name: 'Get CRM Entity',
    description: 'Retrieves CRM entity profile.',
    domain: 'crm_contacts',
    operation: 'read',
    workspaceScoped: true,
    tenantScoped: true,
    permissions: ['app:crm_view'],
    risk: {
      level: 'L0_READ',
      requiresHumanApproval: false,
      destructive: false,
      idempotent: true,
      openWorld: false,
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
      auditRequired: false,
    },
    inputSchema: z.object({ id: z.string() }),
    outputSchema: z.object({ name: z.string() }),
    handler: async () => ({
      success: true,
      data: { name: 'Acme Corp' },
      executionId: 'ex_1',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const crmWriteCap: AnyCapabilityDefinition = {
    id: 'crm.entity.create',
    version: '1.0.0',
    name: 'Create CRM Entity',
    description: 'Creates a new CRM entity record.',
    domain: 'crm_contacts',
    operation: 'create',
    workspaceScoped: true,
    tenantScoped: true,
    permissions: ['app:crm_write'],
    risk: {
      level: 'L2_STATE_MUTATION',
      requiresHumanApproval: false,
      destructive: false,
      idempotent: false,
      openWorld: false,
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
      requiresIdempotencyKey: true,
      requiresExpectedVersion: false,
      auditRequired: true,
    },
    inputSchema: z.object({ name: z.string() }),
    outputSchema: z.object({ id: z.string() }),
    handler: async () => ({
      success: true,
      data: { id: 'con_2' },
      executionId: 'ex_2',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const knowledgeCap: AnyCapabilityDefinition = {
    id: 'memory.get_context',
    version: '1.0.0',
    name: 'Get Memory Context',
    description: 'Retrieves semantic memory context.',
    domain: 'knowledge_memory',
    operation: 'read',
    workspaceScoped: true,
    tenantScoped: true,
    permissions: ['app:knowledge_view'],
    risk: {
      level: 'L0_READ',
      requiresHumanApproval: false,
      destructive: false,
      idempotent: true,
      openWorld: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: false,
    },
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ text: z.string() }),
    handler: async () => ({
      success: true,
      data: { text: 'memory text' },
      executionId: 'ex_3',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const systemCap: AnyCapabilityDefinition = {
    id: 'access.list_workspaces',
    version: '1.0.0',
    name: 'List Workspaces',
    description: 'Lists all accessible workspaces for tenant.',
    domain: 'identity_access',
    operation: 'read',
    workspaceScoped: false,
    tenantScoped: true,
    permissions: ['app:crm_view'],
    risk: {
      level: 'L0_READ',
      requiresHumanApproval: false,
      destructive: false,
      idempotent: true,
      openWorld: false,
      nonDelegable: false,
    },
    execution: {
      synchronous: true,
      maxDurationMs: 5000,
      supportsDryRun: false,
      supportsCancellation: false,
      supportsCompensation: false,
      maxPayloadSizeBytes: 1024 * 1024,
    },
    policies: {
      requiresIdempotencyKey: false,
      requiresExpectedVersion: false,
      auditRequired: false,
    },
    inputSchema: z.object({}),
    outputSchema: z.object({ count: z.number() }),
    handler: async () => ({
      success: true,
      data: { count: 1 },
      executionId: 'ex_4',
      emittedEvents: [],
      durationMs: 5,
    }),
  };

  const allMockCapabilities = [crmReadCap, crmWriteCap, knowledgeCap, systemCap];

  it('partitions tools into domain-specific McpServer instance (crm vs knowledge)', () => {
    const crmServer = createDomainMcpServer({
      domain: 'crm',
      principal: mockPrincipal,
      capabilities: allMockCapabilities,
    });
    expect(crmServer).toBeDefined();

    const summary = getDomainServerToolSummary('crm', mockPrincipal, allMockCapabilities);
    expect(summary.domain).toBe('crm');
    expect(summary.toolNames).toContain('crm_entity_get');
    expect(summary.toolNames).not.toContain('memory_get_context');
  });

  it('enforces Least Privilege (Rule 16): hides unprivileged tools from discovery', () => {
    // Principal has 'app:crm_view' but NOT 'app:crm_write'
    const summary = getDomainServerToolSummary('crm', mockPrincipal, allMockCapabilities);
    expect(summary.toolNames).toContain('crm_entity_get');
    expect(summary.toolNames).not.toContain('crm_entity_create');
  });

  it('enforces Surface Isolation (Rule 61): system domain fails closed on non-backoffice surface', () => {
    expect(() =>
      createDomainMcpServer({
        domain: 'system',
        principal: mockPrincipal,
        capabilities: allMockCapabilities,
        checkSurface: () => false, // Public client surface
      })
    ).toThrow(/Access denied: domain 'system' is restricted to the Backoffice control plane surface/i);
  });

  it('allows system domain creation when surface is backoffice (Rule 61)', () => {
    const systemServer = createDomainMcpServer({
      domain: 'system',
      principal: mockPrincipal,
      capabilities: allMockCapabilities,
      checkSurface: () => true, // Backoffice surface
    });
    expect(systemServer).toBeDefined();

    const summary = getDomainServerToolSummary('system', mockPrincipal, allMockCapabilities);
    expect(summary.toolNames).toContain('access_list_workspaces');
  });

  it('enforces context budgeting (< 1500 tokens) on domain discovery summary (Rule 28, 54)', () => {
    const summary = getDomainServerToolSummary('crm', mockPrincipal, allMockCapabilities);
    expect(summary.estimatedTokens).toBeLessThan(1500);
    expect(summary.estimatedTokens).toBeGreaterThan(0);
  });
});
