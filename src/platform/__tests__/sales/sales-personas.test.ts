/**
 * @fileOverview Unit & Contract Tests for Specialized Sales Agent Personas & Registry (Phase 10 Milestone 2)
 *
 * Implements Rules 4, 10, 12, 16, 23, 44, 67, and 69.
 * Validates:
 * - 5 canonical sales personas: lead_sdr, prospecting_agent, enrichment_agent, qualification_agent, sales_coach
 * - Strict least-privilege risk ceilings and zero wildcard permissions
 * - Identity registry integration and backward-compatible alias resolution
 */

import { describe, it, expect } from 'vitest';
import {
  SALES_PERSONA_IDS,
  SALES_PERSONA_DEFINITIONS,
  isSalesPersonaId,
} from '../../agents/sales/personas/sales-persona-definitions';
import { getAgentPersonaRegistry } from '../../identity/agent-registry';
import { AGENT_PERSONA_IDS } from '../../identity/agent-persona-types';

describe('Sales Persona Definitions & Identity Registry', () => {
  it('exposes all 5 canonical sales persona definitions with valid structures', () => {
    expect(SALES_PERSONA_IDS).toContain('lead_sdr');
    expect(SALES_PERSONA_IDS).toContain('prospecting_agent');
    expect(SALES_PERSONA_IDS).toContain('enrichment_agent');
    expect(SALES_PERSONA_IDS).toContain('qualification_agent');
    expect(SALES_PERSONA_IDS).toContain('sales_coach');

    for (const id of SALES_PERSONA_IDS) {
      expect(isSalesPersonaId(id)).toBe(true);
      const persona = SALES_PERSONA_DEFINITIONS[id];
      expect(persona).toBeDefined();
      expect(persona.id).toBe(id);
      expect(persona.name).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(persona.allowedDomains.length).toBeGreaterThan(0);
      expect(persona.allowedPermissions.length).toBeGreaterThan(0);
      expect(persona.budgets.maxTokens).toBeGreaterThan(0);
      expect(persona.budgets.maxDurationMs).toBeGreaterThan(0);
      expect(persona.budgets.maxToolCalls).toBeGreaterThan(0);
    }
  });

  it('enforces least-privilege risk ceilings on sales personas (Rule 12 & 16)', () => {
    expect(SALES_PERSONA_DEFINITIONS.prospecting_agent.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(SALES_PERSONA_DEFINITIONS.qualification_agent.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(SALES_PERSONA_DEFINITIONS.enrichment_agent.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(SALES_PERSONA_DEFINITIONS.sales_coach.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(SALES_PERSONA_DEFINITIONS.lead_sdr.maxAutonomousRiskLevel).toBe('L2_STATE_MUTATION');
  });

  it('contains zero wildcard permissions across all personas (Rule 16)', () => {
    for (const id of SALES_PERSONA_IDS) {
      const persona = SALES_PERSONA_DEFINITIONS[id];
      for (const perm of persona.allowedPermissions) {
        expect(perm).not.toContain('*');
        expect(perm).not.toBe('all');
      }
    }
  });

  it('registers all 5 sales personas in the platform-wide identity registry', () => {
    const registry = getAgentPersonaRegistry();
    for (const id of SALES_PERSONA_IDS) {
      expect(AGENT_PERSONA_IDS).toContain(id);
      expect(registry.hasPersona(id)).toBe(true);
      const resolved = registry.getPersona(id);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe(id);
    }
  });

  it('resolves backward-compatible aliases for sales personas', () => {
    const registry = getAgentPersonaRegistry();
    expect(registry.resolvePersonaId('sdr_specialist')).toBe('lead_sdr');
    expect(registry.resolvePersonaId('prospector')).toBe('prospecting_agent');
    expect(registry.resolvePersonaId('enricher')).toBe('enrichment_agent');
    expect(registry.resolvePersonaId('lead_qualifier')).toBe('qualification_agent');
    expect(registry.resolvePersonaId('pitch_coach')).toBe('sales_coach');
  });
});
