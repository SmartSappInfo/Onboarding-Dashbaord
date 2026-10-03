/**
 * @fileOverview Unit tests for Domain Server Types, Mappings & Context Budgeting (Phase 5 Milestone 2 Task 1)
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod/v4';
import {
  DOMAIN_CAPABILITY_MAP,
  isCapabilityInMcpDomain,
  MAX_DISCOVERY_PAYLOAD_TOKENS,
  MAX_TOOL_DESCRIPTION_LENGTH,
  estimateToolDiscoveryTokens,
  isValidSemVer,
  DiscoveryOptionsSchema,
} from '../../mcp/servers/domain-server-types';
import type { AnyCapabilityDefinition } from '../../capabilities/contracts/capability-definition';

describe('Domain Server Types & Mapping Contracts (Phase 5 Milestone 2)', () => {
  describe('Domain Capability Mapping (DOMAIN_CAPABILITY_MAP)', () => {
    it('maps all 6 canonical MCP domains to their corresponding platform capability domains', () => {
      expect(DOMAIN_CAPABILITY_MAP.crm).toEqual([
        'crm_contacts',
        'deals_revenue',
        'tasks_productivity',
      ]);
      expect(DOMAIN_CAPABILITY_MAP.knowledge).toEqual(['knowledge_memory']);
      expect(DOMAIN_CAPABILITY_MAP.messaging).toEqual(['communication_messaging']);
      expect(DOMAIN_CAPABILITY_MAP.sales).toEqual([
        'lead_intelligence',
        'campaigns_marketing',
      ]);
      expect(DOMAIN_CAPABILITY_MAP.portals).toEqual([
        'experience_portal',
        'school_operations',
      ]);
      expect(DOMAIN_CAPABILITY_MAP.system).toEqual([
        'identity_access',
        'ai_governance',
      ]);
    });
  });

  describe('isCapabilityInMcpDomain', () => {
    const mockCrmCapability: AnyCapabilityDefinition = {
      id: 'crm.contact.create',
      version: '1.0.0',
      name: 'Create Contact',
      description: 'Creates a contact',
      domain: 'crm_contacts',
      operation: 'create',
      workspaceScoped: true,
      tenantScoped: true,
      permissions: ['app:contacts_manage'],
      risk: {
        level: 'L2_STATE_MUTATION',
        requiresHumanApproval: false,
        destructive: false,
        idempotent: false,
        openWorld: false,
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
        requiresIdempotencyKey: true,
        requiresExpectedVersion: false,
        auditRequired: true,
      },
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ id: z.string() }),
      handler: async () => ({
        success: true,
        data: { id: 'con_1' },
        executionId: 'exec_1',
        emittedEvents: [],
        durationMs: 5,
      }),
    };

    const mockMemoryCapability: AnyCapabilityDefinition = {
      id: 'memory.get_context',
      version: '1.0.0',
      name: 'Get Context',
      description: 'Retrieves grounded context',
      domain: 'knowledge_memory',
      operation: 'read',
      workspaceScoped: true,
      tenantScoped: true,
      permissions: ['app:knowledge_view'],
      risk: {
        level: 'L0_READ',
        requiresHumanApproval: false,
        destructive: false,
        idempotent: true,
        openWorld: false,
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
        auditRequired: false,
      },
      inputSchema: z.object({ query: z.string() }),
      outputSchema: z.object({ context: z.string() }),
      handler: async () => ({
        success: true,
        data: { context: 'test' },
        executionId: 'exec_2',
        emittedEvents: [],
        durationMs: 5,
      }),
    };

    it('correctly associates capabilities with their target MCP domain via domain field or prefix', () => {
      expect(isCapabilityInMcpDomain(mockCrmCapability, 'crm')).toBe(true);
      expect(isCapabilityInMcpDomain(mockCrmCapability, 'knowledge')).toBe(false);
      expect(isCapabilityInMcpDomain(mockMemoryCapability, 'knowledge')).toBe(true);
      expect(isCapabilityInMcpDomain(mockMemoryCapability, 'crm')).toBe(false);
    });

    it('matches capabilities by ID prefix fallback', () => {
      const prefixOnlyCapability = {
        ...mockCrmCapability,
        domain: 'identity_access' as const, // intentional mismatch of domain field
        id: 'deal.advance_stage',
      };
      expect(isCapabilityInMcpDomain(prefixOnlyCapability, 'crm')).toBe(true);
    });
  });

  describe('Context Budgeting & Token Estimator (Rule 28, Rule 54, Rule 56)', () => {
    it('defines strict context budget ceilings', () => {
      expect(MAX_DISCOVERY_PAYLOAD_TOKENS).toBe(1500);
      expect(MAX_TOOL_DESCRIPTION_LENGTH).toBe(300);
    });

    it('estimates tool discovery tokens accurately', () => {
      const tool = {
        name: 'crm.contact.create',
        description: 'Creates a contact record within the active workspace.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Full name of contact' },
            email: { type: 'string', description: 'Email address' },
          },
          required: ['name'],
        },
      };

      const tokens = estimateToolDiscoveryTokens(tool);
      expect(tokens).toBeGreaterThan(10);
      expect(tokens).toBeLessThan(100);
    });
  });

  describe('SemVer Validation (Rule 36)', () => {
    it('validates SemVer strings', () => {
      expect(isValidSemVer('1.0.0')).toBe(true);
      expect(isValidSemVer('2.1.0-alpha.1')).toBe(true);
      expect(isValidSemVer('invalid')).toBe(false);
      expect(isValidSemVer('')).toBe(false);
    });
  });

  describe('DiscoveryOptionsSchema (Rule 5)', () => {
    it('validates discovery options', () => {
      const parsed = DiscoveryOptionsSchema.safeParse({
        includeDetails: true,
        tag: 'sdr',
      });
      expect(parsed.success).toBe(true);
    });

    it('applies default values when options omitted', () => {
      const parsed = DiscoveryOptionsSchema.parse({});
      expect(parsed.includeDetails).toBe(true);
    });
  });
});
