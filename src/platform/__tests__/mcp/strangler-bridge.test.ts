/**
 * @fileOverview Unit & Integration Tests for Strangler Fig Bi-Directional Bridge (Phase 5 Milestone 5 Task 4)
 *
 * Implements Rule 69 (Strangler Fig Pattern SSOT), Rule 4 (Zero any/any[]), and Rule 8.
 * Validates bi-directional synchronization between legacy McpRegistry and canonical capability registry.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod/v4';
import { createCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { McpRegistry } from '@/lib/mcp/registry';
import {
  StranglerBridge,
  isLegacyCompatibilityCapability,
} from '@/platform/mcp/bridge/strangler-bridge';
import type { AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';

describe('Strangler Fig Bi-Directional Bridge & Registry Harmonization', () => {
  let platformStore: ReturnType<typeof createCapabilityRegistryStore>;
  let legacyRegistry: McpRegistry;
  let bridge: StranglerBridge;

  const testPrincipal: AgentPrincipal = {
    actorType: 'user',
    userId: 'user_dev_01',
    organizationId: 'org_acme',
    workspaceId: 'ws_prod',
    grantedScopes: ['*'],
    effectiveRole: 'admin',
  };

  beforeEach(() => {
    platformStore = createCapabilityRegistryStore();
    legacyRegistry = new McpRegistry({ customStore: platformStore });
    bridge = new StranglerBridge({
      platformStore,
      legacyRegistry,
    });
  });

  it('harmonizes legacy tools into the canonical capability store', async () => {
    // 1. Register a tool in legacy registry
    legacyRegistry.registerTool({
      name: 'memory.recall_note',
      version: '1.0.0',
      category: 'memory',
      description: 'Recalls an archived memory note.',
      riskLevel: 'read_only',
      parameters: z.object({ noteId: z.string() }) as unknown as Parameters<typeof legacyRegistry.registerTool>[0]['parameters'],
      responseSchema: z.object({ content: z.string() }) as unknown as Parameters<typeof legacyRegistry.registerTool>[0]['responseSchema'],
      requiresApproval: false,
      handler: async (params) => ({
        content: `Retrieved note: ${params.noteId}`,
      }),
    });

    // 2. Harmonize registries
    const report = await bridge.harmonize();
    expect(report.legacyToolCount).toBe(1);
    expect(report.platformCapabilityCount).toBe(1);
    expect(report.synchronizedCount).toBe(1);

    // 3. Verify it is discoverable in platform store
    const modernCap = platformStore.get('memory.recall_note');
    expect(modernCap).toBeDefined();
    expect(modernCap?.name).toBe('memory.recall_note');
    expect(isLegacyCompatibilityCapability(modernCap!)).toBe(true);

    // 4. Verify execution through canonical capability handler
    const execResult = await modernCap!.handler(
      { noteId: 'note_123' },
      {
        principal: testPrincipal,
        correlationId: 'corr_test_01',
        timestamp: new Date().toISOString(),
      }
    );

    expect(execResult.success).toBe(true);
    if (execResult.success) {
      expect(execResult.data).toEqual({ content: 'Retrieved note: note_123' });
    }
  });

  it('allows modern capabilities to be retrieved and executed through legacy registry facade', async () => {
    // 1. Register modern capability in platform store
    platformStore.register({
      id: 'crm.contact.lookup',
      version: '2.0.0',
      name: 'Lookup Contact',
      description: 'Modern contact lookup capability.',
      domain: 'crm_contacts',
      operation: 'search',
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ found: z.boolean(), name: z.string() }),
      permissions: ['app:contacts_view'],
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
        auditRequired: false,
      },
      handler: async (input) => ({
        success: true,
        data: { found: true, name: `Matched ${(input as { query: string }).query}` },
        executionId: 'exec_lookup_01',
        emittedEvents: [],
        durationMs: 5,
      }),
    });

    // 2. Access through legacy registry facade
    const legacyTool = legacyRegistry.getTool('crm.contact.lookup');
    expect(legacyTool).toBeDefined();
    expect(legacyTool?.name).toBe('crm.contact.lookup');
    expect(legacyTool?.category).toBe('crm');
    expect(legacyTool?.riskLevel).toBe('read_only');

    // 3. Execute through legacy tool handler
    const legacyOutput = await legacyTool!.handler(
      { query: 'Enterprise Corp' },
      {
        userId: testPrincipal.userId,
        organizationId: testPrincipal.organizationId,
        workspaceId: testPrincipal.workspaceId,
        callerId: testPrincipal.userId,
        callerType: 'user',
        requestId: 'corr_legacy_01',
        callDepth: 1,
        timestamp: new Date().toISOString(),
      }
    );

    expect(legacyOutput).toEqual({
      found: true,
      name: 'Matched Enterprise Corp',
    });
  });

  it('allows modern capabilities to supersede legacy compatibility tools in-place (Rule 69)', async () => {
    // 1. Register initial legacy tool
    legacyRegistry.registerTool({
      name: 'crm.lead.score',
      version: '1.0.0',
      category: 'crm',
      description: 'Legacy lead scoring tool.',
      riskLevel: 'read_only',
      parameters: z.object({ leadId: z.string() }) as unknown as Parameters<typeof legacyRegistry.registerTool>[0]['parameters'],
      responseSchema: z.object({ score: z.number() }) as unknown as Parameters<typeof legacyRegistry.registerTool>[0]['responseSchema'],
      requiresApproval: false,
      handler: async () => ({ score: 50 }),
    });

    await bridge.harmonize();
    expect(isLegacyCompatibilityCapability(platformStore.get('crm.lead.score')!)).toBe(true);

    // 2. Overwrite with modern native capability
    platformStore.register(
      {
        id: 'crm.lead.score',
        version: '2.0.0',
        name: 'Advanced ML Lead Scorer',
        description: 'Native Phase 5 capability with predictive scoring.',
        domain: 'crm_contacts',
        operation: 'analyze',
        inputSchema: z.object({ leadId: z.string() }),
        outputSchema: z.object({ score: z.number(), confidence: z.number() }),
        permissions: ['app:contacts_view'],
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
          auditRequired: false,
        },
        handler: async () => ({
          success: true,
          data: { score: 95, confidence: 0.98 },
          executionId: 'exec_ml_01',
          emittedEvents: [],
          durationMs: 8,
        }),
      },
      { allowOverride: true }
    );

    // 3. Verify modern capability has taken precedence
    const modern = platformStore.get('crm.lead.score')!;
    expect(modern.version).toBe('2.0.0');
    expect(isLegacyCompatibilityCapability(modern)).toBe(false);

    // 4. Harmonize report reflects overridden count
    const secondReport = await bridge.harmonize();
    expect(secondReport.overriddenLegacyCount).toBe(1);
  });
});
