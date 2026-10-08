/**
 * @fileOverview Test Suite: Registry Canonical Capabilities & Governed Server Actions (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 4, 8, 12, 14, 16, 17, 19, 47, 48, 51, 60, 67, 68, 69.
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, vi } from 'vitest';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import '@/platform/capabilities/registry/registry-capabilities';
import {
  searchCapabilitiesAction,
  getCapabilityDetailsAction,
  generatePlatformDocsAction,
  getAgentPersonasAction,
  getAgentPersonaDetailsAction,
} from '@/app/actions/registry-actions';

// Mock dependencies for Server Actions
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    userId: 'user_admin_123',
    organizationId: 'org_test_123',
    workspaceId: 'ws_test_123',
    profile: {
      id: 'profile_123',
      organizationId: 'org_test_123',
      workspaceId: 'ws_test_123',
      role: 'admin',
    },
  })),
}));

vi.mock('@/platform/policy/anti-idor-policy', () => ({
  assertTenantAccess: vi.fn((_actorOrgId: string, requestedOrgId: string) => {
    if (requestedOrgId === 'org_victim_456') {
      const error = new Error('Cross-tenant IDOR access probe detected');
      (error as Error & { code?: string; httpStatus?: number }).code = 'IDOR_VIOLATION';
      (error as Error & { code?: string; httpStatus?: number }).httpStatus = 403;
      throw error;
    }
  }),
}));

vi.mock('@/platform/governance/governance-dead-man-switch', () => ({
  checkGovernanceDeadManSwitch: vi.fn(async () => {
    // Normal operation by default
  }),
}));

describe('Phase 15 Milestone 4 - Canonical Registry Capabilities', () => {
  it('registers discovery.search_capabilities in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('discovery.search_capabilities');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
    expect(cap?.permissions).toContain('discovery:search');
  });

  it('registers discovery.get_capability_details in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('discovery.get_capability_details');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
    expect(cap?.permissions).toContain('registry:read');
  });

  it('registers registry.generate_documentation in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('registry.generate_documentation');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
    expect(cap?.policies?.auditRequired).toBe(true);
  });

  it('registers registry.export_mcp_manifest in CapabilityRegistry', () => {
    const cap = canonicalCapabilityRegistryStore.get('registry.export_mcp_manifest');
    expect(cap).toBeDefined();
    expect(cap?.risk.level).toBe('L0_READ');
    expect(cap?.policies?.auditRequired).toBe(true);
  });
});

describe('Phase 15 Milestone 4 - Governed Server Actions', () => {
  it('searches capabilities via searchCapabilitiesAction successfully', async () => {
    const result = await searchCapabilitiesAction({
      intent: 'Search all available capabilities',
      limit: 5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.stubs).toBeDefined();
      expect(Array.isArray(result.data.stubs)).toBe(true);
    }
  });

  it('retrieves capability details via getCapabilityDetailsAction', async () => {
    const result = await getCapabilityDetailsAction('discovery.search_capabilities');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.capability).toBeDefined();
      expect(result.data.capability?.id).toBe('discovery.search_capabilities');
      expect(result.data.capability?.riskLevel).toBe('L0_READ');
    }
  });

  it('generates platform documentation via generatePlatformDocsAction', async () => {
    const result = await generatePlatformDocsAction({
      format: 'OPENAPI_3_1',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.format).toBe('OPENAPI_3_1');
      expect(result.data.content).toContain('3.1.0');
    }
  });

  it('lists canonical agent personas via getAgentPersonasAction', async () => {
    const result = await getAgentPersonasAction();
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.personas.length).toBeGreaterThanOrEqual(20);
      const crmResearcher = result.data.personas.find((p) => p.id === 'crm_researcher');
      expect(crmResearcher).toBeDefined();
      expect(crmResearcher?.maxAutonomousRiskLevel).toBe('L0_READ');
    }
  });

  it('retrieves detailed agent persona configuration via getAgentPersonaDetailsAction', async () => {
    const result = await getAgentPersonaDetailsAction('crm_researcher');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.persona.id).toBe('crm_researcher');
      expect(result.data.persona.name).toBe('CRM Researcher Agent');
      expect(result.data.persona.allowedDomains).toContain('crm_contacts');
    }
  });

  it('blocks cross-tenant IDOR attack via assertTenantAccess (Rules 8 & 47)', async () => {
    const result = await searchCapabilitiesAction({
      intent: 'Probe other tenant tools',
      organizationId: 'org_victim_456',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.httpStatus).toBe(403);
      expect(result.error.code).toBe('REGISTRY_IDOR_VIOLATION');
    }
  });
});
