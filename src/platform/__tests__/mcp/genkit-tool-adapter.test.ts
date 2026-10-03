/**
 * @fileOverview Unit & Integration Tests for Native In-Process Genkit Tool Adapter (Phase 5 Milestone 5 Task 1)
 *
 * Validates Rule 4 (Zero any/any[]), Rule 8 & 47 (Multi-Tenancy & Anti-IDOR), Rule 13 (Model Distrust),
 * Rule 14 (Rug-Pull Defense), Rule 16 (Agent Identity as Principal), Rule 17 (Non-Delegable Guard),
 * Rule 32 & 33 (Data Egress Scanner), Rule 40 (Audit Logging), Rule 42 (Dry Run),
 * Rule 60 (Emergency Dead-Man Controls), and Rule 61 (Surface Isolation).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  CapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import { createEventBus } from '../../events/event-bus';
import { setGovernanceDeadManStateForTests } from '../../policy/governance-dead-man';
import {
  createMemoryFingerprintStore,
  ToolFingerprintService,
  EgressDataPolicyEngine,
} from '../../mcp/security';
import {
  createGenkitToolFromCapability,
  createGenkitToolsForDomain,
  createGenkitToolsForAgent,
  executeCapabilityDirectly,
} from '../../mcp/adapters/genkit-tool-adapter';
import { GENKIT_ADAPTER_ERROR_CODES } from '../../mcp/adapters/genkit-adapter-types';

describe('Native In-Process Genkit Tool Adapter', () => {
  const testTenant = {
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_456',
  };

  const humanPrincipal: AgentPrincipal = {
    actorType: 'user',
    userId: 'user_admin_001',
    organizationId: testTenant.organizationId,
    workspaceId: testTenant.workspaceId,
    grantedScopes: ['*'],
    effectiveRole: 'super_admin',
  };

  const agentPrincipal: AgentPrincipal = {
    actorType: 'agent',
    userId: 'user_operator_001',
    agentId: 'crm_researcher',
    organizationId: testTenant.organizationId,
    workspaceId: testTenant.workspaceId,
    grantedScopes: ['crm:contact.read', 'crm:contact.write'],
    effectiveRole: 'member',
  };

  const sampleCapability: CapabilityDefinition<{ name: string; email: string }, { contactId: string; status: string }> = {
    id: 'crm.contact.create',
    version: '1.0.0',
    name: 'Create CRM Contact',
    description: 'Creates a new contact record in the CRM system.',
    domain: 'crm_contacts',
    operation: 'create',
    inputSchema: z.object({
      name: z.string().min(1),
      email: z.string().email(),
    }),
    outputSchema: z.object({
      contactId: z.string(),
      status: z.string(),
    }),
    permissions: ['crm:contact.write'],
    workspaceScoped: true,
    tenantScoped: true,
    risk: {
      level: 'L2_STATE_MUTATION',
      destructive: false,
      idempotent: false,
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
    },
    handler: async (input, ctx) => {
      if (ctx.dryRun) {
        return {
          success: true,
          data: { contactId: 'dry_run_id', status: 'simulated' },
          executionId: 'exec_dry_run',
          emittedEvents: [],
          durationMs: 5,
        };
      }
      return {
        success: true,
        data: { contactId: `cnt_${input.name.toLowerCase()}`, status: 'created' },
        executionId: 'exec_live',
        emittedEvents: [],
        durationMs: 10,
      };
    },
  };

  beforeEach(() => {
    setGovernanceDeadManStateForTests(false);
    vi.restoreAllMocks();
  });

  it('successfully converts capability to Genkit tool and executes in-process', async () => {
    const eventBus = createEventBus();
    const publishedEvents: unknown[] = [];
    eventBus.subscribe('mcp.tool.invoked', (event) => {
      publishedEvents.push(event);
    });

    const genkitTool = createGenkitToolFromCapability(sampleCapability, {
      principal: humanPrincipal,
      eventBus,
    });

    expect(typeof genkitTool).toBe('function');

    const result = await genkitTool({
      name: 'Alice',
      email: 'alice@example.com',
    });

    expect(result).toEqual({
      contactId: 'cnt_alice',
      status: 'created',
    });

    expect(publishedEvents.length).toBe(1);
  });

  it('halts execution immediately when emergency dead-man switch is active (Rule 60)', async () => {
    setGovernanceDeadManStateForTests(true);

    const genkitTool = createGenkitToolFromCapability(sampleCapability, {
      principal: humanPrincipal,
    });

    await expect(
      genkitTool({ name: 'Bob', email: 'bob@example.com' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.DEAD_MAN_PAUSED);
  });

  it('rejects cross-tenant / IDOR execution attempts (Rule 8 & 47)', async () => {
    const genkitTool = createGenkitToolFromCapability(sampleCapability, {
      principal: humanPrincipal,
      tenant: {
        organizationId: 'malicious_org',
        workspaceId: testTenant.workspaceId,
      },
    });

    await expect(
      genkitTool({ name: 'Charlie', email: 'charlie@example.com' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.TENANT_ISOLATION_VIOLATION);
  });

  it('blocks execution when agent lacks required permission scope (Rule 16)', async () => {
    const unprivilegedAgent: AgentPrincipal = {
      ...agentPrincipal,
      grantedScopes: ['knowledge:read'], // missing crm:contact.write
    };

    const genkitTool = createGenkitToolFromCapability(sampleCapability, {
      principal: unprivilegedAgent,
    });

    await expect(
      genkitTool({ name: 'Dave', email: 'dave@example.com' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.PRINCIPAL_UNAUTHORIZED);
  });

  it('enforces non-delegable action stripping for agents (Rule 17)', async () => {
    const nonDelegableCapability: CapabilityDefinition<{ id: string }, { deleted: boolean }> = {
      ...(sampleCapability as unknown as CapabilityDefinition<{ id: string }, { deleted: boolean }>),
      id: 'crm.contact.purge_all',
      risk: {
        level: 'L4_PRIVILEGED_DESTRUCTIVE',
        destructive: true,
        idempotent: false,
        openWorld: false,
        requiresHumanApproval: true,
        nonDelegable: true,
      },
      permissions: ['crm:admin.purge'],
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ deleted: z.boolean() }),
      handler: async () => ({
        success: true,
        data: { deleted: true },
        executionId: 'exec_purge',
        emittedEvents: [],
        durationMs: 15,
      }),
    };

    const genkitTool = createGenkitToolFromCapability(nonDelegableCapability, {
      principal: agentPrincipal,
    });

    await expect(
      genkitTool({ id: 'cnt_123' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.NON_DELEGABLE_ACTION);
  });

  it('detects schema drift and halts execution with TOOL_FINGERPRINT_DRIFT (Rule 14)', async () => {
    const memoryStore = createMemoryFingerprintStore();
    const fpService = new ToolFingerprintService({ store: memoryStore });

    // Save approved fingerprint for version 1.0.0
    await fpService.approveFingerprint(sampleCapability, testTenant, 'security_officer');

    // Mutate capability schema to simulate rug-pull drift
    const tamperedCapability: typeof sampleCapability = {
      ...sampleCapability,
      description: 'Tampered description attempting silent prompt injection.',
    };

    const genkitTool = createGenkitToolFromCapability(tamperedCapability, {
      principal: humanPrincipal,
      fingerprintService: fpService,
      enforceFingerprints: true,
    });

    await expect(
      genkitTool({ name: 'Eve', email: 'eve@example.com' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.FINGERPRINT_DRIFT);
  });

  it('rejects invalid arguments violating Zod schema before handler execution (Rule 13)', async () => {
    const genkitTool = createGenkitToolFromCapability(sampleCapability, {
      principal: humanPrincipal,
    });

    await expect(
      genkitTool({ name: '', email: 'not-an-email' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.SCHEMA_VALIDATION_FAILED);
  });

  it('supports shadow-mode dry-run without persistent side effects (Rule 42)', async () => {
    const genkitTool = createGenkitToolFromCapability(sampleCapability, {
      principal: humanPrincipal,
      dryRun: true,
    });

    const result = await genkitTool({
      name: 'Frank',
      email: 'frank@example.com',
    });

    expect(result).toEqual({
      contactId: 'dry_run_id',
      status: 'simulated',
    });
  });

  it('blocks sensitive data exfiltration to external channel (Rule 32 & 33)', async () => {
    const leakyCapability: CapabilityDefinition<{ query: string }, { secretKey: string }> = {
      ...(sampleCapability as unknown as CapabilityDefinition<{ query: string }, { secretKey: string }>),
      id: 'system.keys.get',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ secretKey: z.string() }),
      handler: async () => ({
        success: true,
        data: {
          secretKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----',
        },
        executionId: 'exec_leak',
        emittedEvents: [],
        durationMs: 5,
      }),
    };

    const egressEngine = new EgressDataPolicyEngine();

    const genkitTool = createGenkitToolFromCapability(leakyCapability, {
      principal: humanPrincipal,
      egressPolicyEngine: egressEngine,
      egressDestination: 'external_mcp_tool', // blocks credential egress
      enforceEgressPolicy: true,
    });

    await expect(
      genkitTool({ query: 'test' })
    ).rejects.toThrow(GENKIT_ADAPTER_ERROR_CODES.DATA_EXFILTRATION_BLOCKED);
  });

  it('redacts sensitive data when redactEgressSensitiveData is enabled', async () => {
    const leakyCapability: CapabilityDefinition<{ query: string }, { token: string; user: string }> = {
      ...(sampleCapability as unknown as CapabilityDefinition<{ query: string }, { token: string; user: string }>),
      id: 'system.token.inspect',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ token: z.string(), user: z.string() }),
      handler: async () => ({
        success: true,
        data: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
          user: 'John Doe',
        },
        executionId: 'exec_redact',
        emittedEvents: [],
        durationMs: 5,
      }),
    };

    const egressEngine = new EgressDataPolicyEngine();

    const genkitTool = createGenkitToolFromCapability(leakyCapability, {
      principal: humanPrincipal,
      egressPolicyEngine: egressEngine,
      egressDestination: 'external_mcp_tool',
      enforceEgressPolicy: true,
      redactEgressSensitiveData: true,
    });

    const result = (await genkitTool({ query: 'test' })) as { token: string; user: string };
    expect(result.token).toBe('[REDACTED_SECRET]');
    expect(result.user).toBe('John Doe');
  });

  it('createGenkitToolsForDomain enforces surface isolation on system domain (Rule 61)', () => {
    expect(() =>
      createGenkitToolsForDomain({
        domain: 'system',
        principal: humanPrincipal,
        checkSurface: () => false, // not backoffice
      })
    ).toThrow('Access denied');
  });

  it('createGenkitToolsForAgent strips non-delegable actions and ungranted scopes', () => {
    const sdrPrincipal: AgentPrincipal = {
      ...agentPrincipal,
      agentId: 'lead_sdr',
      grantedScopes: ['rbac:operations.campuses.create'],
    };

    const eligibleCap: typeof sampleCapability = {
      ...sampleCapability,
      permissions: ['rbac:operations.campuses.create'],
    };

    const nonDelegableCap: CapabilityDefinition<{ id: string }, { deleted: boolean }> = {
      ...(sampleCapability as unknown as CapabilityDefinition<{ id: string }, { deleted: boolean }>),
      id: 'crm.admin.purge',
      inputSchema: z.object({ id: z.string() }),
      outputSchema: z.object({ deleted: z.boolean() }),
      risk: {
        level: 'L4_PRIVILEGED_DESTRUCTIVE',
        destructive: true,
        idempotent: false,
        openWorld: false,
        requiresHumanApproval: true,
        nonDelegable: true,
      },
      permissions: ['crm:admin.purge'],
    };

    const tools = createGenkitToolsForAgent(
      sdrPrincipal,
      ['crm'],
      {
        capabilities: [eligibleCap, nonDelegableCap],
      }
    );

    // Only eligibleCap should be included; nonDelegableCap must be stripped
    expect(tools.length).toBe(1);
    expect(tools[0].__action.name).toBe('crm_contact_create');
  });

  it('executeCapabilityDirectly returns structured result on success and failure', async () => {
    const successResult = await executeCapabilityDirectly(
      sampleCapability,
      { name: 'Grace', email: 'grace@example.com' },
      { principal: humanPrincipal }
    );

    expect(successResult.success).toBe(true);
    expect(successResult.data).toEqual({ contactId: 'cnt_grace', status: 'created' });

    // Invalid arguments
    const failResult = await executeCapabilityDirectly(
      sampleCapability,
      { name: '', email: 'invalid' },
      { principal: humanPrincipal }
    );

    expect(failResult.success).toBe(false);
    expect(failResult.error?.code).toBe(GENKIT_ADAPTER_ERROR_CODES.SCHEMA_VALIDATION_FAILED);
  });
});
