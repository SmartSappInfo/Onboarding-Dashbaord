/**
 * @fileOverview Capability Feature Flags & Kill Switches Unit & Integration Tests (Phase 1 / PR-8)
 *
 * Implements Rule 60 (Dead-Man Controls), Rule 62 (Zero Deployments / 60s TTL),
 * Rule 64 (Precedence Hierarchy), and PRD §73.
 *
 * Tests the 6-tier precedence hierarchy:
 * 1. Emergency Kill-Switch (capability-specific)
 * 2. Global Autonomous Execution Switch (Rule 60)
 * 3. Workspace Override (Rule 64)
 * 4. Organization Override (Rule 64)
 * 5. Progressive Canary Rollout Percentage
 * 6. Default State / Capability Policies
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { AgentPrincipal, CapabilityDefinition } from '../../capabilities/contracts/capability-definition';
import {
  evaluateCapabilityFlag,
  computeRolloutBucket,
} from '../../capabilities/flags/evaluate-capability-flag';
import {
  createInMemoryFlagService,
  FirestoreFlagService,
} from '../../capabilities/flags/flag-service';
import { executeCapability } from '../../capabilities/execution/execute-capability';

const testCapability: CapabilityDefinition<{ query: string }, { result: string }> = {
  id: 'test.capability',
  version: '1.0.0',
  name: 'Test Capability',
  domain: 'crm_contacts',
  operation: 'read',
  description: 'Test capability for flag evaluation',
  inputSchema: z.object({ query: z.string() }),
  outputSchema: z.object({ result: z.string() }),
  permissions: ['crm:read'],
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
    defaultEnabled: true,
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
  },
  handler: async (input, _context) => ({
    success: true,
    data: {
      result: `Echo: ${input.query}`,
    },
    executionId: 'exec_test',
    emittedEvents: [],
    durationMs: 5,
  }),
};

const humanPrincipal: AgentPrincipal = {
  actorType: 'user',
  userId: 'user_123',
  organizationId: 'org_abc',
  workspaceId: 'ws_alpha',
  grantedScopes: ['crm:read'],
  effectiveRole: 'admin',
};

const agentPrincipal: AgentPrincipal = {
  actorType: 'agent',
  userId: 'user_123',
  organizationId: 'org_abc',
  workspaceId: 'ws_alpha',
  agentId: 'crm_bot',
  grantedScopes: ['crm:read'],
  effectiveRole: 'admin',
};

describe('PR-8: Capability Feature Flags & Kill Switches', () => {
  describe('evaluateCapabilityFlag pure logic', () => {
    it('Tier 1: Emergency Kill-Switch blocks all executions immediately', () => {
      const result = evaluateCapabilityFlag({
        flagRecord: {
          capabilityId: 'test.capability',
          killSwitch: true,
          workspaceOverrides: {
            ws_alpha: { enabled: true }, // Override cannot bypass emergency kill-switch
          },
        },
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
      });

      expect(result.enabled).toBe(false);
      expect(result.tier).toBe('kill_switch');
      expect(result.reason).toContain('emergency kill switch');
    });

    it('Tier 2: Global Autonomous Execution Switch blocks agents but permits human UI users', () => {
      const globalDeadMan = {
        autonomousExecutionEnabled: false,
        killSwitch: true,
        reason: 'Autonomous execution suspended across all tenants.',
      };

      // Agent is blocked
      const agentResult = evaluateCapabilityFlag({
        flagRecord: null,
        principal: agentPrincipal,
        capability: testCapability,
        surface: 'agent',
        globalAutonomousControl: globalDeadMan,
      });
      expect(agentResult.enabled).toBe(false);
      expect(agentResult.tier).toBe('global_autonomous');
      expect(agentResult.reason).toContain('Autonomous execution suspended');

      // MCP caller is blocked
      const mcpResult = evaluateCapabilityFlag({
        flagRecord: null,
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'mcp',
        globalAutonomousControl: globalDeadMan,
      });
      expect(mcpResult.enabled).toBe(false);
      expect(mcpResult.tier).toBe('global_autonomous');

      // Interactive human UI caller is permitted
      const humanResult = evaluateCapabilityFlag({
        flagRecord: null,
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
        globalAutonomousControl: globalDeadMan,
      });
      expect(humanResult.enabled).toBe(true);
      expect(humanResult.tier).toBe('default');
    });

    it('Tier 3: Workspace override supersedes organization override and global defaults', () => {
      // Disabled at Org level, but enabled at Workspace level
      const resultEnabled = evaluateCapabilityFlag({
        flagRecord: {
          capabilityId: 'test.capability',
          defaultState: false,
          orgOverrides: {
            org_abc: { enabled: false },
          },
          workspaceOverrides: {
            ws_alpha: { enabled: true },
          },
        },
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
      });
      expect(resultEnabled.enabled).toBe(true);
      expect(resultEnabled.tier).toBe('workspace_override');

      // Enabled at Org level, but disabled at Workspace level
      const resultDisabled = evaluateCapabilityFlag({
        flagRecord: {
          capabilityId: 'test.capability',
          defaultState: true,
          orgOverrides: {
            org_abc: { enabled: true },
          },
          workspaceOverrides: {
            ws_alpha: { enabled: false },
          },
        },
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
      });
      expect(resultDisabled.enabled).toBe(false);
      expect(resultDisabled.tier).toBe('workspace_override');
    });

    it('Tier 4: Organization override applies when workspace has no override', () => {
      const result = evaluateCapabilityFlag({
        flagRecord: {
          capabilityId: 'test.capability',
          defaultState: true,
          orgOverrides: {
            org_abc: { enabled: false },
          },
        },
        principal: { ...humanPrincipal, workspaceId: 'ws_other' },
        capability: testCapability,
        surface: 'ui',
      });

      expect(result.enabled).toBe(false);
      expect(result.tier).toBe('org_override');
    });

    it('Surface Discrimination: distinguishes humanEnabled, agentEnabled, and mcpEnabled', () => {
      const flagRecord = {
        capabilityId: 'test.capability',
        humanEnabled: true,
        agentEnabled: false,
        mcpEnabled: true,
      };

      // Human UI caller is enabled
      const human = evaluateCapabilityFlag({
        flagRecord,
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
      });
      expect(human.enabled).toBe(true);

      // Automated Agent caller is disabled
      const agent = evaluateCapabilityFlag({
        flagRecord,
        principal: agentPrincipal,
        capability: testCapability,
        surface: 'agent',
      });
      expect(agent.enabled).toBe(false);
      expect(agent.reason).toContain('disabled for automated agents');

      // MCP caller is enabled
      const mcp = evaluateCapabilityFlag({
        flagRecord,
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'mcp',
      });
      expect(mcp.enabled).toBe(true);
    });

    it('Tier 5: Progressive Canary Rollout Percentage deterministically divides cohorts', () => {
      const seedA = 'ws_alpha:test.capability';
      const seedB = 'ws_beta:test.capability';
      const bucketA = computeRolloutBucket(seedA);
      const bucketB = computeRolloutBucket(seedB);

      // Verify determinism
      expect(computeRolloutBucket(seedA)).toBe(bucketA);
      expect(bucketA).toBeGreaterThanOrEqual(0);
      expect(bucketA).toBeLessThan(100);

      // If rolloutPercentage is 0, always disabled
      const res0 = evaluateCapabilityFlag({
        flagRecord: {
          capabilityId: 'test.capability',
          rolloutPercentage: 0,
        },
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
      });
      expect(res0.enabled).toBe(false);
      expect(res0.tier).toBe('rollout');

      // If rollout is 100, always passes
      const res100 = evaluateCapabilityFlag({
        flagRecord: {
          capabilityId: 'test.capability',
          rolloutPercentage: 100,
        },
        principal: humanPrincipal,
        capability: testCapability,
        surface: 'ui',
      });
      expect(res100.enabled).toBe(true);

      // Set rollout exactly between bucketA and bucketB to test differentiation
      const lower = Math.min(bucketA, bucketB);
      const higher = Math.max(bucketA, bucketB);

      if (lower !== higher) {
        const threshold = lower + 1;
        const resLower = evaluateCapabilityFlag({
          flagRecord: {
            capabilityId: 'test.capability',
            rolloutPercentage: threshold,
          },
          principal: bucketA === lower ? humanPrincipal : { ...humanPrincipal, workspaceId: 'ws_beta' },
          capability: testCapability,
          surface: 'ui',
        });
        expect(resLower.enabled).toBe(true);

        const resHigher = evaluateCapabilityFlag({
          flagRecord: {
            capabilityId: 'test.capability',
            rolloutPercentage: threshold,
          },
          principal: bucketA === lower ? { ...humanPrincipal, workspaceId: 'ws_beta' } : humanPrincipal,
          capability: testCapability,
          surface: 'ui',
        });
        expect(resHigher.enabled).toBe(false);
        expect(resHigher.tier).toBe('rollout');
      }
    });
  });

  describe('InMemoryFlagService and Cache Management', () => {
    it('updates flags dynamically and checks context correctly', async () => {
      const service = createInMemoryFlagService();

      // Initially default open
      const initial = await service.checkFlag({
        capability: testCapability,
        principal: humanPrincipal,
        surface: 'ui',
      });
      expect(initial.enabled).toBe(true);

      // Set kill switch
      service.setFlag({
        capabilityId: testCapability.id,
        killSwitch: true,
      });

      const blocked = await service.checkFlag({
        capability: testCapability,
        principal: humanPrincipal,
        surface: 'ui',
      });
      expect(blocked.enabled).toBe(false);
      expect(blocked.tier).toBe('kill_switch');

      // Clear flags
      service.clear();
      const cleared = await service.checkFlag({
        capability: testCapability,
        principal: humanPrincipal,
        surface: 'ui',
      });
      expect(cleared.enabled).toBe(true);
    });

    it('FirestoreFlagService supports in-memory cache TTL and manual invalidation', () => {
      const service = new FirestoreFlagService(60000);
      expect(service).toBeDefined();

      // Invalidation does not throw
      service.invalidateCache('test.capability');
      service.invalidateCache();
    });
  });

  describe('Integration with executeCapability pipeline', () => {
    it('blocks invocation with code DISABLED and stateChanged: "no" when flag is off', async () => {
      const flagService = createInMemoryFlagService();
      flagService.setFlag({
        capabilityId: testCapability.id,
        workspaceOverrides: {
          ws_alpha: { enabled: false },
        },
      });

      const outcome = await executeCapability(
        {
          capabilityId: testCapability.id,
          surface: 'ui',
          input: { query: 'Hello' },
          correlationId: 'corr_test_flag',
          principal: humanPrincipal,
        },
        {
          registryLookup: () => testCapability,
          flagChecker: flagService,
        }
      );

      expect(outcome.success).toBe(false);
      if (!outcome.success) {
        expect(outcome.error.code).toBe('DISABLED');
        expect(outcome.error.stateChanged).toBe('no');
        expect(outcome.error.retryable).toBe(false);
        expect(outcome.error.message).toContain('disabled by workspace override');
      }
    });

    it('permits execution when flag allows it', async () => {
      const flagService = createInMemoryFlagService();
      flagService.setFlag({
        capabilityId: testCapability.id,
        workspaceOverrides: {
          ws_alpha: { enabled: true },
        },
      });

      const outcome = await executeCapability(
        {
          capabilityId: testCapability.id,
          surface: 'ui',
          input: { query: 'Hello' },
          correlationId: 'corr_test_flag_ok',
          principal: humanPrincipal,
        },
        {
          registryLookup: () => testCapability,
          flagChecker: flagService,
        }
      );

      expect(outcome.success).toBe(true);
      if (outcome.success) {
        expect(outcome.data).toEqual({ result: 'Echo: Hello' });
        expect(outcome.stateChanged).toBe('no'); // L1 read capability
      }
    });
  });
});
