/**
 * @fileOverview Unit & Contract Tests for Specialized Finance & School Agent Personas & Registry (Phase 12 Milestone 2)
 *
 * Implements Rules 4, 10, 12, 16, 23, 44, 67, and 69.
 * Validates:
 * - 9 canonical personas: billing_analyst, collections_agent, reconciliation_agent, revenue_analyst,
 *   invoice_assistant, finance_reporter, school_ops_agent, attendance_analyst, fee_collection_agent
 * - Strict least-privilege risk ceilings and zero wildcard permissions
 * - Identity registry integration and backward-compatible alias resolution
 * - Deterministic resource and monetary budgets (Rule 23)
 */

import { describe, it, expect } from 'vitest';
import {
  FINANCE_PERSONA_IDS,
  FINANCE_PERSONA_DEFINITIONS,
  isFinancePersonaId,
} from '@/platform/agents/finance/personas/finance-persona-definitions';
import { getAgentPersonaRegistry } from '@/platform/identity/agent-registry';
import { AGENT_PERSONA_IDS } from '@/platform/identity/agent-persona-types';

describe('Finance & School Operations Persona Definitions & Identity Registry', () => {
  it('exposes all 9 canonical persona definitions with valid structures', () => {
    expect(FINANCE_PERSONA_IDS).toContain('billing_analyst');
    expect(FINANCE_PERSONA_IDS).toContain('collections_agent');
    expect(FINANCE_PERSONA_IDS).toContain('reconciliation_agent');
    expect(FINANCE_PERSONA_IDS).toContain('revenue_analyst');
    expect(FINANCE_PERSONA_IDS).toContain('invoice_assistant');
    expect(FINANCE_PERSONA_IDS).toContain('finance_reporter');
    expect(FINANCE_PERSONA_IDS).toContain('school_ops_agent');
    expect(FINANCE_PERSONA_IDS).toContain('attendance_analyst');
    expect(FINANCE_PERSONA_IDS).toContain('fee_collection_agent');

    for (const id of FINANCE_PERSONA_IDS) {
      expect(isFinancePersonaId(id)).toBe(true);
      const persona = FINANCE_PERSONA_DEFINITIONS[id];
      expect(persona).toBeDefined();
      expect(persona.id).toBe(id);
      expect(persona.name).toBeTruthy();
      expect(persona.description).toBeTruthy();
      expect(persona.icon).toBeTruthy();
      expect(persona.allowedDomains.length).toBeGreaterThan(0);
      expect(persona.allowedPermissions.length).toBeGreaterThan(0);
      expect(persona.budgets.maxTokens).toBeGreaterThan(0);
      expect(persona.budgets.maxDurationMs).toBeGreaterThan(0);
      expect(persona.budgets.maxToolCalls).toBeGreaterThan(0);
      expect(persona.systemPromptSnippet).toBeTruthy();
    }
  });

  it('enforces least-privilege risk ceilings on finance personas (Rule 12 & 16)', () => {
    // Read-only analysts
    expect(FINANCE_PERSONA_DEFINITIONS.revenue_analyst.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(FINANCE_PERSONA_DEFINITIONS.finance_reporter.maxAutonomousRiskLevel).toBe('L0_READ');
    expect(FINANCE_PERSONA_DEFINITIONS.attendance_analyst.maxAutonomousRiskLevel).toBe('L0_READ');

    // Internal draft preparers
    expect(FINANCE_PERSONA_DEFINITIONS.billing_analyst.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(FINANCE_PERSONA_DEFINITIONS.invoice_assistant.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');
    expect(FINANCE_PERSONA_DEFINITIONS.school_ops_agent.maxAutonomousRiskLevel).toBe('L1_INTERNAL_DRAFT');

    // Governed state-mutating agents
    expect(FINANCE_PERSONA_DEFINITIONS.collections_agent.maxAutonomousRiskLevel).toBe('L2_STATE_MUTATION');
    expect(FINANCE_PERSONA_DEFINITIONS.reconciliation_agent.maxAutonomousRiskLevel).toBe('L2_STATE_MUTATION');
    expect(FINANCE_PERSONA_DEFINITIONS.fee_collection_agent.maxAutonomousRiskLevel).toBe('L2_STATE_MUTATION');
  });

  it('contains zero wildcard permissions across all personas (Rule 16)', () => {
    for (const id of FINANCE_PERSONA_IDS) {
      const persona = FINANCE_PERSONA_DEFINITIONS[id];
      for (const perm of persona.allowedPermissions) {
        expect(perm).not.toContain('*');
        expect(perm).not.toBe('all');
        expect(perm.startsWith('rbac:') || perm.startsWith('app:') || perm.startsWith('workspace:')).toBe(true);
      }
    }
  });

  it('registers all 9 finance and school personas in the platform-wide identity registry', () => {
    const registry = getAgentPersonaRegistry();
    for (const id of FINANCE_PERSONA_IDS) {
      expect(AGENT_PERSONA_IDS).toContain(id);
      expect(registry.hasPersona(id)).toBe(true);
      const resolved = registry.getPersona(id);
      expect(resolved).toBeDefined();
      expect(resolved?.id).toBe(id);
    }
  });

  it('resolves backward-compatible aliases for finance and school operations personas', () => {
    const registry = getAgentPersonaRegistry();
    expect(registry.resolvePersonaId('billing_specialist')).toBe('billing_analyst');
    expect(registry.resolvePersonaId('collections_specialist')).toBe('collections_agent');
    expect(registry.resolvePersonaId('reconciliation_specialist')).toBe('reconciliation_agent');
    expect(registry.resolvePersonaId('cashflow_analyst')).toBe('revenue_analyst');
    expect(registry.resolvePersonaId('invoice_copilot')).toBe('invoice_assistant');
    expect(registry.resolvePersonaId('compliance_reporter')).toBe('finance_reporter');
    expect(registry.resolvePersonaId('school_operations_specialist')).toBe('school_ops_agent');
    expect(registry.resolvePersonaId('attendance_specialist')).toBe('attendance_analyst');
    expect(registry.resolvePersonaId('tuition_collector')).toBe('fee_collection_agent');
  });

  it('enforces deterministic resource budgets within bounded limits (Rule 23)', () => {
    for (const id of FINANCE_PERSONA_IDS) {
      const { budgets } = FINANCE_PERSONA_DEFINITIONS[id];
      expect(budgets.maxDurationMs).toBeLessThanOrEqual(300000);
      expect(budgets.maxTokens).toBeLessThanOrEqual(100000);
      expect(budgets.maxToolCalls).toBeLessThanOrEqual(30);
      expect(budgets.maxOutboundMessages).toBe(0); // All autonomous outbound messaging forbidden (Rule 17)
    }
  });
});
