/**
 * @fileOverview Vitest Suite for Agent Builder Server Actions & Service (Phase 8 Milestone 5 Task 7)
 *
 * Implements:
 * - Rule 4: Zero `any` / Zero `any[]` typing.
 * - Rule 8 & 47: Anti-IDOR tenant boundary validation.
 * - Rule 34: Outbound SSRF guard validation on webhook URLs.
 * - Rule 42: Shadow Mode simulation verifying 0 live database mutations.
 * - Rule 60: Emergency Dead-Man Switch blocking mutations.
 * - Rule 65: Canary Releases & SemVer version progression.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  listAgentPersonasAction,
  getAgentPersonaAction,
  saveAgentPersonaDraftAction,
  publishAgentPersonaAction,
  testAgentPersonaAction,
  getAgentVersionDiffAction,
} from '@/app/actions/agent-builder-actions';
import {
  getAgentBuilderService,
  createMemoryPersonaStore,
} from '@/platform/ui/builder/agent-builder-service';
import { AGENT_BUILDER_ERROR_CODES } from '@/platform/ui/builder/agent-builder-types';

// Mock requireAuth
let mockAuthContext = {
  uid: 'user_123',
  userId: 'user_123',
  isSystemAdmin: true,
  profile: {
    id: 'user_123',
    organizationId: 'org_test_1',
    displayName: 'Test Operator',
  },
};

vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => mockAuthContext),
}));

// Mock dead-man switch
let mockDeadManActive = false;
vi.mock('@/platform/policy/governance-dead-man', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async () => {
    if (mockDeadManActive) {
      const err = new Error('DEAD_MAN_PAUSED');
      (err as { code?: string }).code = 'AGENT_GOVERNANCE_EMERGENCY_PAUSED';
      throw err;
    }
  }),
  AgentGovernanceEmergencyPausedError: class extends Error {
    public readonly code = 'AGENT_GOVERNANCE_EMERGENCY_PAUSED';
    constructor() {
      super('DEAD_MAN_PAUSED');
      this.name = 'AgentGovernanceEmergencyPausedError';
    }
  },
}));

describe('Agent Builder Server Actions & Service', () => {
  beforeEach(async () => {
    mockDeadManActive = false;
    mockAuthContext = {
      uid: 'user_123',
      userId: 'user_123',
      isSystemAdmin: true,
      profile: {
        id: 'user_123',
        organizationId: 'org_test_1',
        displayName: 'Test Operator',
      },
    };

    // Reset store
    const store = createMemoryPersonaStore();
    const service = getAgentBuilderService({ store });
    // Overwrite global singleton for test isolation
    globalThis.__smartsappAgentBuilderService = service;
    globalThis.__smartsappPersonaStore = store;
  });

  describe('1. listAgentPersonasAction', () => {
    it('lists system built-in personas merged with tenant custom personas', async () => {
      const res = await listAgentPersonasAction({
        organizationId: 'org_test_1',
        workspaceId: 'default',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data!.length).toBeGreaterThanOrEqual(3);

      const builtInIds = res.data!.map((p) => p.id);
      expect(builtInIds).toContain('crm_researcher');
      expect(builtInIds).toContain('lead_sdr');
      expect(builtInIds).toContain('deal_coach');
    });

    it('rejects cross-tenant IDOR access when not system admin (Rule 8 & 47)', async () => {
      mockAuthContext.isSystemAdmin = false;
      mockAuthContext.profile.organizationId = 'org_other';

      const res = await listAgentPersonasAction({
        organizationId: 'org_victim',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(AGENT_BUILDER_ERROR_CODES.IDOR_VIOLATION);
    });
  });

  describe('2. getAgentPersonaAction', () => {
    it('retrieves built-in persona by ID', async () => {
      const res = await getAgentPersonaAction({
        organizationId: 'org_test_1',
        personaId: 'crm_researcher',
      });

      expect(res.success).toBe(true);
      expect(res.data?.id).toBe('crm_researcher');
      expect(res.data?.isBuiltIn).toBe(true);
      expect(res.data?.identity.role).toBe('Account Intelligence Specialist');
    });

    it('returns error when persona does not exist', async () => {
      const res = await getAgentPersonaAction({
        organizationId: 'org_test_1',
        personaId: 'non_existent_persona',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(AGENT_BUILDER_ERROR_CODES.PERSONA_NOT_FOUND);
    });
  });

  describe('3. saveAgentPersonaDraftAction', () => {
    it('creates a new custom agent persona draft with default version 0.1.0', async () => {
      const res = await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        workspaceId: 'default',
        identity: {
          name: 'Custom Outreach Bot',
          slug: 'custom_outreach_bot',
          avatarIcon: 'Bot',
          role: 'Outbound Specialist',
          description: 'Custom automated outreach specialist.',
          systemPromptSnippet: 'You are an outbound outreach bot.',
        },
        capabilities: {
          allowedDomains: ['communication_messaging'],
          allowedCapabilities: [],
          maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
        },
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.id).toBe('custom_outreach_bot');
      expect(res.data?.version).toBe('0.1.0');
      expect(res.data?.status).toBe('draft');
      expect(res.data?.isBuiltIn).toBe(false);
    });

    it('updates an existing persona draft', async () => {
      // 1. Create draft
      await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        workspaceId: 'default',
        identity: {
          name: 'Initial Name',
          slug: 'updatable_agent',
          avatarIcon: 'Bot',
          role: 'Initial Role',
          description: 'Initial description',
          systemPromptSnippet: 'Initial prompt',
        },
      });

      // 2. Update draft
      const updateRes = await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        workspaceId: 'default',
        personaId: 'updatable_agent',
        identity: {
          name: 'Updated Name',
          description: 'Updated description',
        },
      });

      expect(updateRes.success).toBe(true);
      expect(updateRes.data?.identity.name).toBe('Updated Name');
      expect(updateRes.data?.identity.description).toBe('Updated description');
      expect(updateRes.data?.identity.role).toBe('Initial Role'); // preserved
    });

    it('rejects editing built-in personas directly', async () => {
      const res = await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        personaId: 'crm_researcher',
        identity: {
          name: 'Tampered CRM Bot',
        },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(AGENT_BUILDER_ERROR_CODES.INVALID_PERMISSIONS);
    });

    it('blocks saving draft when emergency Dead-Man switch is active (Rule 60)', async () => {
      mockDeadManActive = true;

      const res = await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        identity: {
          name: 'Blocked Persona',
          slug: 'blocked_persona',
          avatarIcon: 'Bot',
          role: 'Tester',
          description: 'Desc',
          systemPromptSnippet: 'Prompt',
        },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(AGENT_BUILDER_ERROR_CODES.BUILDER_DEAD_MAN_PAUSED);
    });

    it('validates webhook URL against SSRF attacks (Rule 34)', async () => {
      const res = await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        identity: {
          name: 'Malicious Webhook Bot',
          slug: 'malicious_webhook_bot',
          avatarIcon: 'Bot',
          role: 'Attacker',
          description: 'Desc',
          systemPromptSnippet: 'Prompt',
        },
        triggers: {
          triggerType: 'webhook',
          webhookUrl: 'http://169.254.169.254/latest/meta-data', // AWS/GCP metadata
          eventSubscriptions: [],
          enabledNotificationChannels: ['in_app'],
        },
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(AGENT_BUILDER_ERROR_CODES.SSRF_DETECTED);
    });
  });

  describe('4. publishAgentPersonaAction', () => {
    it('publishes a draft persona and advances SemVer release (Rule 65)', async () => {
      // 1. Create draft
      await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        workspaceId: 'default',
        identity: {
          name: 'Release Agent',
          slug: 'release_agent',
          avatarIcon: 'Sparkles',
          role: 'Releaser',
          description: 'Desc',
          systemPromptSnippet: 'Prompt',
        },
      });

      // 2. Publish patch bump
      const pubRes = await publishAgentPersonaAction({
        organizationId: 'org_test_1',
        workspaceId: 'default',
        personaId: 'release_agent',
        versionBump: 'patch',
      });

      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.version).toBe('0.1.1');
      expect(pubRes.data?.status).toBe('published');
      expect(pubRes.data?.publishedVersion).toBe('0.1.1');
    });

    it('advances minor version bump', async () => {
      await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        identity: {
          name: 'Minor Agent',
          slug: 'minor_agent',
          avatarIcon: 'Sparkles',
          role: 'Minor',
          description: 'Desc',
          systemPromptSnippet: 'Prompt',
        },
      });

      const pubRes = await publishAgentPersonaAction({
        organizationId: 'org_test_1',
        personaId: 'minor_agent',
        versionBump: 'minor',
      });

      expect(pubRes.success).toBe(true);
      expect(pubRes.data?.version).toBe('0.2.0');
    });
  });

  describe('5. testAgentPersonaAction (Rule 42 Shadow Mode)', () => {
    it('executes Shadow Simulation verifying 0 live database mutations', async () => {
      const res = await testAgentPersonaAction({
        organizationId: 'org_test_1',
        personaId: 'lead_sdr',
        goalPrompt: 'Enrich new inbound leads and draft outbound outreach',
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.personaId).toBe('lead_sdr');
      expect(res.data?.blastRadius.zeroMutationsVerified).toBe(true); // Rule 42
      expect(res.data?.blastRadius.totalSimulatedSteps).toBeGreaterThanOrEqual(3);
      expect(res.data?.trace.length).toBeGreaterThanOrEqual(3);

      // Verify mutating steps were intercepted
      const intercepted = res.data?.trace.filter(
        (t) => t.simulatedAction === 'intercepted_mutation'
      );
      expect(intercepted?.length).toBeGreaterThanOrEqual(1);
    });

    it('blocks simulation when Dead-Man switch is active (Rule 60)', async () => {
      mockDeadManActive = true;

      const res = await testAgentPersonaAction({
        organizationId: 'org_test_1',
        personaId: 'crm_researcher',
        goalPrompt: 'Query CRM accounts',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe(AGENT_BUILDER_ERROR_CODES.BUILDER_DEAD_MAN_PAUSED);
    });
  });

  describe('6. getAgentVersionDiffAction', () => {
    it('computes side-by-side diff between draft and published versions', async () => {
      // 1. Create and publish v0.1.1
      await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        identity: {
          name: 'Diff Test Agent',
          slug: 'diff_test_agent',
          avatarIcon: 'Bot',
          role: 'Analyst',
          description: 'Desc',
          systemPromptSnippet: 'Prompt',
        },
        governance: {
          maxAutonomousRiskLevel: 'L1_INTERNAL_DRAFT',
          mandatoryApprovalRiskLevels: ['L3_EXTERNAL_COMMUNICATION_FINANCE'],
          delegationDepthCeiling: 2,
          requireHumanIntervention: false,
          allowedEnvironments: ['production'],
        },
      });

      await publishAgentPersonaAction({
        organizationId: 'org_test_1',
        personaId: 'diff_test_agent',
        versionBump: 'patch',
      });

      // 2. Update draft with risk escalation
      await saveAgentPersonaDraftAction({
        organizationId: 'org_test_1',
        personaId: 'diff_test_agent',
        governance: {
          maxAutonomousRiskLevel: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        },
      });

      // 3. Compute diff
      const diffRes = await getAgentVersionDiffAction({
        organizationId: 'org_test_1',
        personaId: 'diff_test_agent',
      });

      expect(diffRes.success).toBe(true);
      expect(diffRes.data?.personaId).toBe('diff_test_agent');
      expect(diffRes.data?.riskEscalated).toBe(true); // Detected L3 risk escalation
      expect(diffRes.data?.hasChanges).toBe(true);
    });
  });
});
