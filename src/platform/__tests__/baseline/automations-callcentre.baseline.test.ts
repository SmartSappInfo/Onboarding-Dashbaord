/**
 * @fileOverview Automations & Call Centre Baseline Regression Test (Phase 0)
 *
 * Validates the baseline behavior of Call Centre script decision tree traversal,
 * dynamic variable interpolation in call scripts, tag application compliance,
 * and capability risk evaluation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FieldsVariablesService } from '@/lib/services/fields-variables-service-impl';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { evaluatePrincipalAuthority } from '@/platform/capabilities/policy/principal-evaluator';
import type { CapabilityDefinition, AgentPrincipal } from '@/platform/capabilities/contracts/capability-definition';
import { z } from 'zod/v4';
import { RISK_LEVELS } from '@/platform/capabilities/contracts/risk-levels';
import callcentreFixture from './fixtures/automations-callcentre.fixture.json';

// Mock firebase-admin
vi.mock('@/lib/firebase-admin', () => ({
  adminDb: {
    collection: vi.fn(() => ({
      where: vi.fn().mockReturnThis(),
      doc: vi.fn(() => ({
        get: vi.fn().mockResolvedValue({ exists: false, data: () => ({}) }),
      })),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
    })),
  },
}));

interface CallScriptNode {
  id: string;
  title: string;
  promptText: string;
  responseOptions: Array<{
    id: string;
    label: string;
    targetNodeId: string | null;
    tagsToApply?: string[];
    outcome?: 'qualified' | 'disqualified' | 'callback_requested' | 'closed_won';
  }>;
}

describe('Automations & Call Centre Behavioral Baseline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and validates frozen callcentre fixture', () => {
    expect(callcentreFixture.version).toBe('1.0.0');
    expect(callcentreFixture.scriptStructure.rootNodeId).toBe('node-greeting');
    expect(callcentreFixture.tagApplicationContract.uiComponent).toBe('<TagSelector>');
    // The fixture's risk names must be exactly the canonical scale (no drifting aliases).
    expect(Object.keys(callcentreFixture.riskTaxonomy)).toEqual([...RISK_LEVELS]);
  });

  describe('Script Node Variable Interpolation (SSOT)', () => {
    it('interpolates lead context into agent telemarketing prompt using FieldsVariablesService', async () => {
      const scriptPrompt =
        'Hi {{contact_name}}, this is {{agent_name}} calling from {{entity_name}}. I noticed your interest in {{course_name}}. Do you have 2 minutes?';

      const resolved = await FieldsVariablesService.resolveTemplateVariables(scriptPrompt, {
        workspaceId: 'ws-call-centre-1',
        extraVars: {
          contact_name: 'Kofi Annan',
          agent_name: 'Sarah Connor',
          entity_name: 'Accra Tech Hub',
          course_name: 'Full Stack Engineering',
        },
      });

      expect(resolved).toBe(
        'Hi Kofi Annan, this is Sarah Connor calling from Accra Tech Hub. I noticed your interest in Full Stack Engineering. Do you have 2 minutes?'
      );
    });
  });

  describe('Script Decision Tree Traversal & Tag Outcomes', () => {
    const sampleScript: Record<string, CallScriptNode> = {
      'node-greeting': {
        id: 'node-greeting',
        title: 'Initial Greeting',
        promptText: 'Hello {{contact_name}}, how are you doing today?',
        responseOptions: [
          {
            id: 'opt-interested',
            label: 'Interested in demo',
            targetNodeId: 'node-qualification',
            tagsToApply: ['lead:warm', 'intent:high'],
          },
          {
            id: 'opt-busy',
            label: 'Busy, call back later',
            targetNodeId: null,
            outcome: 'callback_requested',
            tagsToApply: ['lead:callback_needed'],
          },
          {
            id: 'opt-not-interested',
            label: 'Not interested / remove from list',
            targetNodeId: null,
            outcome: 'disqualified',
            tagsToApply: ['lead:disqualified', 'dnc:requested'],
          },
        ],
      },
      'node-qualification': {
        id: 'node-qualification',
        title: 'Budget & Timeline Qualification',
        promptText: 'Great! What is your planned timeline for onboarding?',
        responseOptions: [
          {
            id: 'opt-immediate',
            label: 'Within 30 days',
            targetNodeId: null,
            outcome: 'qualified',
            tagsToApply: ['pipeline:hot', 'priority:p1'],
          },
        ],
      },
    };

    it('navigates the script graph and generates the correct tag outcome set', () => {
      const startNode = sampleScript['node-greeting'];
      const chosenOption = startNode.responseOptions.find((o) => o.id === 'opt-interested');

      expect(chosenOption).toBeDefined();
      expect(chosenOption?.tagsToApply).toEqual(['lead:warm', 'intent:high']);
      expect(chosenOption?.targetNodeId).toBe('node-qualification');

      const nextNode = sampleScript[chosenOption!.targetNodeId!];
      expect(nextNode).toBeDefined();
      expect(nextNode.title).toBe('Budget & Timeline Qualification');
    });

    it('emits domain event on call completion with script outcome', () => {
      const callEvent = createDomainEvent({
        type: 'callcentre.call.completed',
        organizationId: 'org-test',
        workspaceId: 'ws-call-centre-1',
        actor: {
          type: 'agent',
          id: 'agent-voice-bot-1',
        },
        entity: {
          type: 'call_session',
          id: 'call-sess-991',
        },
        payload: {
          contactId: 'contact-kofi-1',
          durationSeconds: 145,
          outcome: 'qualified',
          tagsApplied: ['lead:warm', 'pipeline:hot'],
          sentimentScore: 0.88,
          scriptId: 'script-inbound-v1',
        },
        correlationId: 'call-corr-482',
        source: 'callcentre_engine',
      });

      expect(callEvent.type).toBe('callcentre.call.completed');
      expect(callEvent.payload.outcome).toBe('qualified');
      expect(callEvent.payload.tagsApplied).toHaveLength(2);
      expect(callEvent.payload.sentimentScore).toBe(0.88);
    });
  });

  describe('Capability Authorization on Autonomous Call Actions', () => {
    const triggerOutboundCallCapability: CapabilityDefinition<
      { contactId: string; phoneNumber: string; scriptId: string },
      { callSid: string; status: string }
    > = {
      id: 'callcentre.outbound.initiate',
      version: '1.0.0',
      name: 'Initiate Outbound Call',
      description: 'Places an automated or agent outbound call to a contact',
      domain: 'automation_workflows',
      operation: 'execute',
      inputSchema: z.object({
        contactId: z.string(),
        phoneNumber: z.string(),
        scriptId: z.string(),
      }),
      outputSchema: z.object({
        callSid: z.string(),
        status: z.string(),
      }),
      permissions: ['callcentre.calls.create'],
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
        supportsCancellation: true,
        supportsCompensation: false,
        maxPayloadSizeBytes: 8192,
      },
      policies: {
        requiresIdempotencyKey: true,
        requiresExpectedVersion: false,
        auditRequired: true,
      },
      handler: async () => ({
        success: true,
        data: {
          callSid: 'call-123',
          status: 'queued',
        },
        executionId: 'exec-1',
        emittedEvents: [],
        durationMs: 40,
      }),
    };

    it('permits authorized automated agent to trigger outbound call within its workspace', () => {
      const voiceAgentPrincipal: AgentPrincipal = {
        actorType: 'agent',
        userId: 'system-bot-caller',
        organizationId: 'org-test',
        workspaceId: 'ws-call-centre-1',
        agentId: 'voice-agent-alpha',
        grantedScopes: ['callcentre.calls.create', 'contacts.read'],
        effectiveRole: 'agent',
      };

      const evalResult = evaluatePrincipalAuthority(
        voiceAgentPrincipal,
        triggerOutboundCallCapability,
        { organizationId: 'org-test', workspaceId: 'ws-call-centre-1' }
      );

      expect(evalResult.allowed).toBe(true);
      expect(evalResult.violations).toEqual([]);
    });

    it('rejects agent attempt if capability requires permissions not granted to the agent', () => {
      const restrictedAgentPrincipal: AgentPrincipal = {
        actorType: 'agent',
        userId: 'untrusted-bot',
        organizationId: 'org-test',
        workspaceId: 'ws-call-centre-1',
        agentId: 'untrusted-agent-1',
        grantedScopes: ['contacts.read'], // Missing callcentre.calls.create
        effectiveRole: 'agent',
      };

      const evalResult = evaluatePrincipalAuthority(
        restrictedAgentPrincipal,
        triggerOutboundCallCapability,
        { organizationId: 'org-test', workspaceId: 'ws-call-centre-1' }
      );

      expect(evalResult.allowed).toBe(false);
      expect(evalResult.reason).toContain('callcentre.calls.create');
      expect(evalResult.violations?.[0]).toContain('callcentre.calls.create');
    });
  });
});
