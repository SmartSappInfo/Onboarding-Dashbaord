/**
 * @fileOverview Unit & Architectural Tests for CRM Agent Personas (Phase 9 Milestone 2)
 *
 * Implements verification for Rules 1, 4, 8, 10, 12, 16, 17, 23, 67, 68, and 69.
 */

import { describe, it, expect } from 'vitest';
import {
  AGENT_PERSONA_IDS,
  AgentPersonaDefinitionSchema,
  isAgentPersonaId,
} from '@/platform/identity/agent-persona-types';
import { getAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import {
  CRM_PERSONA_DEFINITIONS,
  CRM_PERSONA_IDS,
  isCrmPersonaId,
} from '@/platform/agents/crm/personas/crm-persona-definitions';

describe('Phase 9 Milestone 2: CRM Agent Personas', () => {
  it('should include all 6 CRM persona IDs in canonical AGENT_PERSONA_IDS', () => {
    const expectedCrmIds = [
      'crm_assistant',
      'crm_researcher',
      'lead_analyst',
      'deal_strategist',
      'task_coordinator',
      'knowledge_analyst',
    ];

    for (const id of expectedCrmIds) {
      expect(AGENT_PERSONA_IDS).toContain(id);
      expect(isAgentPersonaId(id)).toBe(true);
      expect(isCrmPersonaId(id)).toBe(true);
    }
  });

  it('should conform strictly to AgentPersonaDefinitionSchema for all 6 CRM personas', () => {
    for (const [id, persona] of Object.entries(CRM_PERSONA_DEFINITIONS)) {
      expect(id).toBe(persona.id);
      const parsed = AgentPersonaDefinitionSchema.safeParse(persona);
      expect(parsed.success, `Persona ${id} failed validation: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('should enforce strict risk level ceilings (Rule 12)', () => {
    expect(CRM_PERSONA_DEFINITIONS.crm_researcher.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(CRM_PERSONA_DEFINITIONS.crm_assistant.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(CRM_PERSONA_DEFINITIONS.lead_analyst.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(CRM_PERSONA_DEFINITIONS.deal_strategist.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(CRM_PERSONA_DEFINITIONS.task_coordinator.maxAutonomousRiskLevel).toBe('L2_STATE_MUTATION');
    expect(CRM_PERSONA_DEFINITIONS.knowledge_analyst.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
  });

  it('should strictly ban wildcard permissions on all 6 CRM personas (Rule 16)', () => {
    for (const [id, persona] of Object.entries(CRM_PERSONA_DEFINITIONS)) {
      for (const permission of persona.allowedPermissions) {
        expect(permission, `Persona ${id} contains wildcard permission`).not.toContain('*');
        expect(permission.startsWith('rbac:') || permission.startsWith('workspace:') || permission.startsWith('crm:')).toBe(true);
      }
    }
  });

  it('should unconditionally exclude non-delegable destructive permissions (Rule 17)', () => {
    const forbiddenPermissions = [
      'workspace:delete',
      'tenant:delete',
      'billing:modify',
      'security:keys:rotate',
      'users:delete',
    ];

    for (const [id, persona] of Object.entries(CRM_PERSONA_DEFINITIONS)) {
      for (const forbidden of forbiddenPermissions) {
        expect(persona.allowedPermissions, `Persona ${id} contains forbidden non-delegable permission: ${forbidden}`).not.toContain(forbidden);
      }
    }
  });

  it('should declare deterministic resource budgets bounded by Rule 23', () => {
    for (const [_id, persona] of Object.entries(CRM_PERSONA_DEFINITIONS)) {
      expect(persona.budgets.maxDurationMs).toBeGreaterThanOrEqual(10000);
      expect(persona.budgets.maxDurationMs).toBeLessThanOrEqual(300000);
      expect(persona.budgets.maxTokens).toBeGreaterThanOrEqual(5000);
      expect(persona.budgets.maxTokens).toBeLessThanOrEqual(100000);
      expect(persona.budgets.maxToolCalls).toBeGreaterThanOrEqual(1);
      expect(persona.budgets.maxToolCalls).toBeLessThanOrEqual(50);
      // Read/draft personas must have 0 records mutated
      if (persona.maxAutonomousRiskLevel === 'L0_READ' || persona.maxAutonomousRiskLevel === 'L1_INTERNAL_DRAFT') {
        expect(persona.budgets.maxRecordsMutated).toBe(0);
      } else {
        expect(persona.budgets.maxRecordsMutated).toBeGreaterThan(0);
      }
    }
  });

  it('should register all CRM personas in central registry without regressions (Rule 69)', () => {
    const registry = getAgentPersonaRegistry();

    // Verify all 6 CRM personas are registered
    for (const id of CRM_PERSONA_IDS) {
      const persona = registry.getPersona(id);
      expect(persona, `Persona ${id} missing from central registry`).not.toBeNull();
      expect(persona?.id).toBe(id);
    }

    // Verify legacy built-in personas are completely preserved (Rule 69 Strangler Invariant)
    const legacyPersonas = ['lead_sdr', 'deal_coach', 'portal_guide', 'meeting_prep', 'supervisor'];
    for (const legacyId of legacyPersonas) {
      const persona = registry.getPersona(legacyId);
      expect(persona, `Legacy persona ${legacyId} missing from registry`).not.toBeNull();
    }
  });
});
