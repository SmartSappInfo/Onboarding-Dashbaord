/**
 * @fileOverview Test Suite: Canonical Registry Contracts & Governance Matrices (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 2, 4, 8, 12, 14, 16, 17, 19, 27, 48, 67, 68, 1940-1953.
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect } from 'vitest';
import {
  CapabilityCatalogItemSchema,
  AgentPersonaSummarySchema,
  ProgressiveDiscoveryQuerySchema,
  DiscoveryStubSchema,
  DocumentationExportFormatSchema,
  REGISTRY_ERROR_CODES,
  RegistryDomainError,
  REGISTRY_PERMISSION_MATRIX,
  REGISTRY_TOOL_MATRIX,
  REGISTRY_FAILURE_MATRIX,
  REGISTRY_ROLLBACK_MATRIX,
} from '@/platform/registry/contracts/registry-types';

describe('Phase 15 Milestone 4 - Registry Contracts & Governance Matrices', () => {
  it('validates a capability catalog item schema', () => {
    const validItem = {
      id: 'crm.contact.get',
      domain: 'crm_contacts',
      version: '1.0.0',
      description: 'Fetches contact details by ID',
      riskLevel: 'L0_READ',
      requiresApproval: false,
      permissions: ['workspace:read'],
      isDelegable: true,
      driftStatus: 'APPROVED',
      lastVerifiedAt: '2026-10-08T00:00:00.000Z',
    };
    const parsed = CapabilityCatalogItemSchema.parse(validItem);
    expect(parsed.id).toBe('crm.contact.get');
    expect(parsed.riskLevel).toBe('L0_READ');
    expect(parsed.driftStatus).toBe('APPROVED');
  });

  it('validates an agent persona summary schema', () => {
    const validPersona = {
      id: 'crm_researcher',
      name: 'CRM Researcher Agent',
      version: '1.0.0',
      role: 'Account Intelligence Specialist',
      maxAutonomousRiskLevel: 'L0_READ',
      allowedDomains: ['crm_contacts', 'knowledge_memory'],
      maxDurationMs: 120000,
      maxTokens: 50000,
      maxToolCalls: 15,
      isConfigurable: false,
    };
    const parsed = AgentPersonaSummarySchema.parse(validPersona);
    expect(parsed.id).toBe('crm_researcher');
    expect(parsed.allowedDomains).toHaveLength(2);
  });

  it('validates progressive discovery query schema', () => {
    const validQuery = {
      intent: 'Schedule meeting with customer',
      domain: 'meetings_conversations',
      limit: 5,
      maxTokens: 250,
    };
    const parsed = ProgressiveDiscoveryQuerySchema.parse(validQuery);
    expect(parsed.limit).toBe(5);
    expect(parsed.maxTokens).toBe(250);
  });

  it('validates minimal discovery stub schema', () => {
    const validStub = {
      id: 'meetings.search',
      domain: 'meetings_conversations',
      name: 'Search Meetings',
      summary: 'Search scheduled meetings by participant or date',
      riskLevel: 'L0_READ',
      estimatedTokens: 38,
    };
    const parsed = DiscoveryStubSchema.parse(validStub);
    expect(parsed.estimatedTokens).toBeLessThanOrEqual(45);
    expect(parsed.id).toBe('meetings.search');
  });

  it('validates documentation export format schema', () => {
    expect(DocumentationExportFormatSchema.parse('OPENAPI_3_1')).toBe('OPENAPI_3_1');
    expect(DocumentationExportFormatSchema.parse('MCP_MANIFEST')).toBe('MCP_MANIFEST');
    expect(DocumentationExportFormatSchema.parse('MARKDOWN_DOSSIER')).toBe('MARKDOWN_DOSSIER');
  });

  it('verifies typed RegistryDomainError mapping to HTTP status', () => {
    const error = new RegistryDomainError(
      'REGISTRY_CAPABILITY_NOT_FOUND',
      'Capability unknown.tool not found',
      404
    );
    expect(error.code).toBe('REGISTRY_CAPABILITY_NOT_FOUND');
    expect(error.httpStatus).toBe(404);
    expect(error.name).toBe('RegistryDomainError');
  });

  it('verifies the 4 Governance Matrices integrity', () => {
    // 1. Permission Matrix
    expect(REGISTRY_PERMISSION_MATRIX.all_agent_personas).toContain('discovery:search');
    expect(REGISTRY_PERMISSION_MATRIX.all_agent_personas).not.toContain('persona:configure');
    expect(REGISTRY_PERMISSION_MATRIX.admin_user).toContain('persona:configure');

    // 2. Tool Matrix
    expect(REGISTRY_TOOL_MATRIX['discovery.search_capabilities'].level).toBe('L0_READ');
    expect(REGISTRY_TOOL_MATRIX['discovery.search_capabilities'].isDelegable).toBe(true);
    expect(REGISTRY_TOOL_MATRIX['registry.update_agent_persona_config'].level).toBe('L2_STATE_MUTATION');
    expect(REGISTRY_TOOL_MATRIX['registry.update_agent_persona_config'].isDelegable).toBe(false);

    // 3. Failure Matrix
    expect(REGISTRY_FAILURE_MATRIX['REGISTRY_UNAUTHORIZED_MUTATION'].recoveryStrategy).toBe('FAIL_CLOSED');
    expect(REGISTRY_FAILURE_MATRIX['REGISTRY_UNAUTHORIZED_MUTATION'].httpStatus).toBe(403);
    expect(REGISTRY_FAILURE_MATRIX['REGISTRY_CAPABILITY_NOT_FOUND'].recoveryStrategy).toBe('FAIL_GRACEFULLY');

    // 4. Rollback Matrix
    expect(REGISTRY_ROLLBACK_MATRIX['registry.update_agent_persona_config']).toBe('registry.restore_agent_persona_config');
    expect(REGISTRY_ROLLBACK_MATRIX['discovery.search_capabilities']).toBeNull();
  });
});
