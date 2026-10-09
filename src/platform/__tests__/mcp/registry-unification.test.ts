// @vitest-environment node
/**
 * @fileOverview Unit & Integration Tests for Canonical Registry Unification (PR-5 / Decision D1)
 *
 * Validates Rule 69 (Master Layering Axiom: Exactly ONE capability registry underneath the application),
 * Rule 11 (Current MCP compliance), Rule 12 (Canonical risk classification mapping),
 * and in-place upgrade capabilities ({ allowOverride: true }).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { z as z4 } from 'zod/v4';
import {
  globalMcpRegistry,
  McpRegistry,
  mapCategoryToDomain,
  mapDomainToCategory,
  mapRiskLevelToCanonical,
  mapCanonicalToRiskLevel,
  inferOperationFromName,
} from '@/lib/mcp/registry';
import {
  registerCapability,
  getCapability,
  hasCapability,
  listCapabilities,
  resetCapabilityRegistryForTests,
  DuplicateCapabilityError,
} from '@/platform/capabilities/registry/capability-registry';
import { ALL_CORE_MCP_TOOLS, registerAllCoreTools } from '@/lib/mcp/tools';
import type { CapabilityDefinition } from '@/platform/capabilities/contracts/capability-definition';
import type { McpToolDefinition, McpExecutionContext } from '@/lib/mcp/types';
import { FakeFirestore } from '@/platform/__tests__/helpers/fake-firestore';

// M2 review R1: platform capabilities reached through the legacy registry run through the gateway
// as a VERIFIED user, so the acting user must exist (approved, workspace member, with the permission).
const h = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock('@/lib/firebase-admin', () => ({
  get adminDb() {
    return h.db;
  },
}));
function seedUser(uid: string, organizationId: string, workspaceId: string, permissions: string[]): void {
  const db = new FakeFirestore();
  db.write(`users/${uid}`, { organizationId, workspaceIds: [workspaceId], isAuthorized: true, permissions });
  h.db = db;
}


describe('Canonical Registry Unification (PR-5 / Decision D1 / Rule 69 SSOT)', () => {
  beforeEach(() => {
    resetCapabilityRegistryForTests();
  });

  describe('Category & Risk Level Mappings (Rules 12 & 66)', () => {
    it('correctly maps MCP categories to Canonical Capability Domains and back', () => {
      expect(mapCategoryToDomain('memory')).toBe('knowledge_memory');
      expect(mapCategoryToDomain('context')).toBe('knowledge_memory');
      expect(mapCategoryToDomain('crm')).toBe('crm_contacts');
      expect(mapCategoryToDomain('deal')).toBe('deals_revenue');
      expect(mapCategoryToDomain('task')).toBe('tasks_productivity');
      expect(mapCategoryToDomain('meeting')).toBe('meetings_conversations');
      expect(mapCategoryToDomain('campaign')).toBe('campaigns_marketing');
      expect(mapCategoryToDomain('governance')).toBe('ai_governance');

      expect(mapDomainToCategory('knowledge_memory')).toBe('memory');
      expect(mapDomainToCategory('crm_contacts')).toBe('crm');
      expect(mapDomainToCategory('deals_revenue')).toBe('deal');
      expect(mapDomainToCategory('tasks_productivity')).toBe('task');
      expect(mapDomainToCategory('meetings_conversations')).toBe('meeting');
      expect(mapDomainToCategory('campaigns_marketing')).toBe('campaign');
      expect(mapDomainToCategory('ai_governance')).toBe('governance');
    });

    it('correctly maps MCP risk levels to Canonical L0–L4 Risk Levels and back', () => {
      expect(mapRiskLevelToCanonical('read_only')).toBe('L0_READ');
      expect(mapRiskLevelToCanonical('low_risk')).toBe('L2_STATE_MUTATION');
      expect(mapRiskLevelToCanonical('high_risk')).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
      expect(mapRiskLevelToCanonical('critical')).toBe('L4_PRIVILEGED_DESTRUCTIVE');

      expect(mapCanonicalToRiskLevel('L0_READ')).toBe('read_only');
      expect(mapCanonicalToRiskLevel('L1_INTERNAL_DRAFT')).toBe('read_only');
      expect(mapCanonicalToRiskLevel('L2_STATE_MUTATION')).toBe('low_risk');
      expect(mapCanonicalToRiskLevel('L3_EXTERNAL_COMMUNICATION_FINANCE')).toBe('high_risk');
      expect(mapCanonicalToRiskLevel('L4_PRIVILEGED_DESTRUCTIVE')).toBe('critical');
    });

    it('infers canonical operations correctly from tool names', () => {
      expect(inferOperationFromName('memory.recall')).toBe('search');
      expect(inferOperationFromName('crm.search_entities')).toBe('search');
      expect(inferOperationFromName('task.create')).toBe('create');
      expect(inferOperationFromName('deal.update_stage')).toBe('update');
      expect(inferOperationFromName('contact.delete')).toBe('delete');
      expect(inferOperationFromName('deal.get')).toBe('read');
      expect(inferOperationFromName('task.list')).toBe('read');
      expect(inferOperationFromName('system.run_job')).toBe('execute');
    });
  });

  describe('Single Source of Truth: globalMcpRegistry <-> Canonical Registry Synchrony', () => {
    it('synchronizes registrations from globalMcpRegistry directly into canonical registry', () => {
      const tool: McpToolDefinition<{ foo: string }, { bar: string }> = {
        name: 'test.bridge_tool',
        version: '1.0.0',
        category: 'crm',
        description: 'Testing bridge',
        riskLevel: 'read_only',
        parameters: z.object({ foo: z.string() }),
        responseSchema: z.object({ bar: z.string() }),
        requiresApproval: false,
        handler: async (p) => ({ bar: `Echo: ${p.foo}` }),
      };

      globalMcpRegistry.registerTool(tool);

      // Check canonical capability registry directly
      expect(hasCapability('test.bridge_tool')).toBe(true);
      const cap = getCapability('test.bridge_tool');
      expect(cap).toBeDefined();
      expect(cap?.domain).toBe('crm_contacts');
      expect(cap?.risk.level).toBe('L0_READ');
      expect(cap?.governance?.isLegacyCompatibility).toBe(true);
      expect(cap?.governance?.implementationRef).toBe('test.bridge_tool');

      // Check McpRegistry facade
      expect(globalMcpRegistry.hasTool('test.bridge_tool')).toBe(true);
      const mcpTool = globalMcpRegistry.getTool('test.bridge_tool');
      expect(mcpTool).toBeDefined();
      expect(mcpTool?.name).toBe('test.bridge_tool');
      expect(mcpTool?.category).toBe('crm');
    });

    it('makes native capabilities registered via registerCapability immediately accessible in globalMcpRegistry', async () => {
      const nativeCap: CapabilityDefinition<Record<string, unknown>, { greeting: string }> = {
        id: 'portal.member.welcome',
        version: '1.2.0',
        name: 'Member Welcome',
        description: 'Welcomes a portal member',
        domain: 'experience_portal',
        operation: 'execute',
        inputSchema: z4.object({ memberId: z4.string() }),
        outputSchema: z4.object({ greeting: z4.string() }),
        permissions: ['app:portals_view'],
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
          supportsDryRun: false,
          supportsCancellation: false,
          supportsCompensation: false,
          maxPayloadSizeBytes: 1024 * 1024,
        },
        policies: {
          requiresIdempotencyKey: false,
          requiresExpectedVersion: false,
          auditRequired: true,
        },
        handler: async (input) => ({
          success: true,
          data: { greeting: `Welcome ${(input as { memberId: string }).memberId}!` },
          executionId: 'exec_welcome_001',
          emittedEvents: [],
          durationMs: 2,
        }),
      };

      registerCapability(nativeCap);

      expect(globalMcpRegistry.hasTool('portal.member.welcome')).toBe(true);
      const mcpTool = globalMcpRegistry.getTool('portal.member.welcome');
      expect(mcpTool).toBeDefined();
      expect(mcpTool?.version).toBe('1.2.0');
      expect(mcpTool?.riskLevel).toBe('read_only');

      const mockCtx: McpExecutionContext = {
        workspaceId: 'ws_test',
        organizationId: 'org_test',
        callerId: 'user_1',
        callerType: 'user',
        requestId: 'req_123',
        callDepth: 0,
        timestamp: new Date().toISOString(),
      };

      seedUser('user_1', 'org_test', 'ws_test', ['portals_view']);
      const result = await mcpTool?.handler({ memberId: 'member_42' }, mockCtx);
      expect(result).toEqual({ greeting: 'Welcome member_42!' });

      // An unverified caller is refused by the gateway (no invented authority).
      await expect(mcpTool?.handler({ memberId: 'member_42' }, { ...mockCtx, callerId: 'ghost' })).rejects.toThrow();
    });
  });

  describe('Core CompanyBrain Tools Bridging', () => {
    it('bridges all core CompanyBrain tools into canonical registry with canonical risk classifications', () => {
      registerAllCoreTools(globalMcpRegistry);

      expect(ALL_CORE_MCP_TOOLS.length).toBe(19);
      const allCaps = listCapabilities();
      expect(allCaps.length).toBe(19);

      // Verify L0_READ tools
      const recallCap = getCapability('memory.recall');
      expect(recallCap?.risk.level).toBe('L0_READ');
      expect(recallCap?.risk.requiresHumanApproval).toBe(false);
      expect(recallCap?.risk.idempotent).toBe(true);

      const healthCap = getCapability('memory.get_health');
      expect(healthCap?.risk.level).toBe('L0_READ');

      const contextCap = getCapability('context.build');
      expect(contextCap?.risk.level).toBe('L0_READ');

      const crmGetCap = getCapability('crm.get_entity');
      expect(crmGetCap?.risk.level).toBe('L0_READ');

      const dealGetCap = getCapability('deal.get');
      expect(dealGetCap?.risk.level).toBe('L0_READ');

      const dealPreviewCap = getCapability('deal.preview_transfer');
      expect(dealPreviewCap?.risk.level).toBe('L0_READ');
      expect(dealPreviewCap?.risk.requiresHumanApproval).toBe(false);

      const taskListCap = getCapability('task.list');
      expect(taskListCap?.risk.level).toBe('L0_READ');

      // Verify L2_STATE_MUTATION tools
      const rememberCap = getCapability('memory.remember');
      expect(rememberCap?.risk.level).toBe('L2_STATE_MUTATION');
      expect(rememberCap?.risk.requiresHumanApproval).toBe(false);

      const taskCreateCap = getCapability('task.create');
      expect(taskCreateCap?.risk.level).toBe('L2_STATE_MUTATION');
      expect(taskCreateCap?.risk.requiresHumanApproval).toBe(false);

      const dealTransferCap = getCapability('deal.transfer');
      expect(dealTransferCap?.risk.level).toBe('L2_STATE_MUTATION');
      expect(dealTransferCap?.risk.requiresHumanApproval).toBe(false);

      // Verify L3_EXTERNAL_COMMUNICATION_FINANCE tools (requires approval)
      const conflictCap = getCapability('memory.resolve_conflict');
      expect(conflictCap?.risk.level).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
      expect(conflictCap?.risk.requiresHumanApproval).toBe(true);

      const dealUpdateCap = getCapability('deal.update_stage');
      expect(dealUpdateCap?.risk.level).toBe('L3_EXTERNAL_COMMUNICATION_FINANCE');
      expect(dealUpdateCap?.risk.requiresHumanApproval).toBe(true);
    });
  });

  describe('In-Place Upgradability ({ allowOverride: true }) (Decision D1)', () => {
    it('allows a canonical domain capability to upgrade a legacy tool in-place', () => {
      // 1. Initial legacy tool registration
      registerAllCoreTools(globalMcpRegistry);
      const legacyTaskCreate = getCapability('task.create');
      expect(legacyTaskCreate?.governance?.isLegacyCompatibility).toBe(true);
      expect(legacyTaskCreate?.version).toBe('1.0.0');

      // 2. Upgraded Wave B canonical domain capability
      const upgradedTaskCreate: CapabilityDefinition<Record<string, unknown>, { id: string; status: string }> = {
        id: 'task.create',
        version: '2.0.0',
        name: 'Canonical Task Creation',
        description: 'Domain 5 Wave B Canonical Task Creation Capability',
        domain: 'tasks_productivity',
        operation: 'create',
        inputSchema: z4.object({ title: z4.string() }),
        outputSchema: z4.object({ id: z4.string(), status: z4.string() }),
        permissions: ['app:tasks_manage'],
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
          maxDurationMs: 10000,
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
        governance: {
          isLegacyCompatibility: false,
          implementationRef: 'tasks_productivity.create_task_v2',
        },
        handler: async () => ({
          success: true,
          data: { id: 'task_canonical_99', status: 'created' },
          executionId: 'exec_upgraded_001',
          emittedEvents: [],
          durationMs: 5,
        }),
      };

      // 3. Register with allowOverride: true
      expect(() => registerCapability(upgradedTaskCreate, { allowOverride: true })).not.toThrow();

      // 4. Verify canonical registry now reflects upgraded capability
      const currentTaskCreate = getCapability('task.create');
      expect(currentTaskCreate?.version).toBe('2.0.0');
      expect(currentTaskCreate?.governance?.isLegacyCompatibility).toBe(false);
      expect(currentTaskCreate?.governance?.implementationRef).toBe('tasks_productivity.create_task_v2');

      // 5. Verify McpRegistry facade sees the upgraded capability
      const mcpTool = globalMcpRegistry.getTool('task.create');
      expect(mcpTool?.version).toBe('2.0.0');
    });

    it('rejects duplicate registration without allowOverride: true', () => {
      const tool: McpToolDefinition<{ text: string }, { result: string }> = {
        name: 'test.dup',
        version: '1.0.0',
        category: 'governance',
        description: 'Duplicate test',
        riskLevel: 'read_only',
        parameters: z.object({ text: z.string() }),
        responseSchema: z.object({ result: z.string() }),
        requiresApproval: false,
        handler: async () => ({ result: 'ok' }),
      };

      globalMcpRegistry.registerTool(tool);

      expect(() => globalMcpRegistry.registerTool(tool)).toThrow(/already registered/);
      expect(() =>
        registerCapability({
          ...getCapability('test.dup')!,
          description: 'Different description',
        })
      ).toThrow(DuplicateCapabilityError);
    });
  });

  describe('Isolated McpRegistry Instances (Test Isolation)', () => {
    it('creates an isolated McpRegistry that does not pollute the canonical global registry', () => {
      const isolatedRegistry = new McpRegistry();
      const tool: McpToolDefinition<{ text: string }, { ok: boolean }> = {
        name: 'isolated.tool',
        version: '1.0.0',
        category: 'governance',
        description: 'Isolated test',
        riskLevel: 'read_only',
        parameters: z.object({ text: z.string() }),
        responseSchema: z.object({ ok: z.boolean() }),
        requiresApproval: false,
        handler: async () => ({ ok: true }),
      };

      isolatedRegistry.registerTool(tool);

      expect(isolatedRegistry.hasTool('isolated.tool')).toBe(true);
      expect(hasCapability('isolated.tool')).toBe(false);
      expect(globalMcpRegistry.hasTool('isolated.tool')).toBe(false);
    });
  });
});
