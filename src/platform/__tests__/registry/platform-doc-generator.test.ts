/**
 * @fileOverview Test Suite: Platform Auto-Documentation Generator (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 4, 11, 25, 32, 33, 48, 67, 68, 69, and Roadmap §25.
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlatformDocGenerator,
  getPlatformDocGenerator,
} from '@/platform/registry/docs/platform-doc-generator';
import { createCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { z } from 'zod/v4';

const defaultExecution = {
  synchronous: true,
  maxDurationMs: 10000,
  supportsDryRun: true,
  supportsCancellation: true,
  supportsCompensation: false,
  maxPayloadSizeBytes: 524288,
};

const defaultPolicies = {
  requiresIdempotencyKey: false,
  requiresExpectedVersion: false,
  auditRequired: false,
  defaultEnabled: true,
};

describe('Phase 15 Milestone 4 - Platform Auto-Documentation Generator', () => {
  let mockStore: ReturnType<typeof createCapabilityRegistryStore>;
  let generator: PlatformDocGenerator;

  beforeEach(() => {
    mockStore = createCapabilityRegistryStore();

    mockStore.register({
      id: 'crm.contact.get',
      name: 'Get CRM Contact',
      domain: 'crm_contacts',
      operation: 'read',
      version: '1.0.0',
      description: 'Fetches full customer contact profile, notes, and activity timeline.',
      risk: {
        level: 'L0_READ',
        destructive: false,
        idempotent: true,
        openWorld: false,
        requiresHumanApproval: false,
        nonDelegable: false,
      },
      execution: defaultExecution,
      policies: defaultPolicies,
      workspaceScoped: false,
      tenantScoped: true,
      permissions: ['workspace:read'],
      inputSchema: z.object({ contactId: z.string().describe('Unique ID of contact') }),
      outputSchema: z.object({ id: z.string(), name: z.string() }),
      handler: async () => ({
        success: true,
        data: { id: '123', name: 'John Doe' },
        executionId: 'mock-1',
        emittedEvents: [],
        durationMs: 1,
      }),
    });

    mockStore.register({
      id: 'finance.invoice.charge',
      name: 'Charge Invoice',
      domain: 'finance_subscriptions',
      operation: 'execute',
      version: '1.1.0',
      description: 'Charges an open invoice using registered payment gateway credentials.',
      risk: {
        level: 'L3_EXTERNAL_COMMUNICATION_FINANCE',
        destructive: false,
        idempotent: true,
        openWorld: false,
        requiresHumanApproval: true,
        nonDelegable: false,
      },
      execution: defaultExecution,
      policies: {
        requiresIdempotencyKey: true,
        requiresExpectedVersion: false,
        auditRequired: true,
        defaultEnabled: true,
      },
      workspaceScoped: false,
      tenantScoped: true,
      permissions: ['rbac:finance.invoices.edit', 'workspace:write'],
      inputSchema: z.object({ invoiceId: z.string(), amount: z.number().positive() }),
      outputSchema: z.object({ transactionId: z.string(), status: z.string() }),
      handler: async () => ({
        success: true,
        data: { transactionId: 'tx_123', status: 'PAID' },
        executionId: 'mock-2',
        emittedEvents: [],
        durationMs: 1,
      }),
    });

    generator = new PlatformDocGenerator(mockStore);
  });

  it('generates a valid OpenAPI 3.1.0 specification document', () => {
    const openApi = generator.generateOpenApiSpec();
    expect(openApi.openapi).toBe('3.1.0');
    expect(openApi.info.title).toContain('SmartSapp');
    expect(openApi.paths['/api/v1/capabilities/crm.contact.get']).toBeDefined();
    expect(openApi.paths['/api/v1/capabilities/finance.invoice.charge']).toBeDefined();

    const postOp = openApi.paths['/api/v1/capabilities/finance.invoice.charge'].post;
    expect(postOp.summary).toContain('finance.invoice.charge');
    expect(postOp.tags).toContain('finance_subscriptions');
    expect(postOp.security).toBeDefined();
  });

  it('filters OpenAPI specification by domain', () => {
    const openApi = generator.generateOpenApiSpec({ domain: 'finance_subscriptions' });
    expect(openApi.paths['/api/v1/capabilities/crm.contact.get']).toBeUndefined();
    expect(openApi.paths['/api/v1/capabilities/finance.invoice.charge']).toBeDefined();
  });

  it('generates an MCP 2026-07-28 compliant tool manifest', () => {
    const manifest = generator.generateMcpManifest();
    expect(manifest.tools).toBeDefined();
    expect(manifest.tools.length).toBe(2);

    const tool = manifest.tools.find((t) => t.name === 'finance.invoice.charge');
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('Charges an open invoice');
    expect(tool?.inputSchema).toBeDefined();
    expect(typeof tool?.inputSchema).toBe('object');
  });

  it('generates structured Markdown reference documentation with FMEA failure strategies', () => {
    const markdown = generator.generateDomainMarkdown('finance_subscriptions');
    expect(markdown).toContain('# Finance Subscriptions Domain Capabilities');
    expect(markdown).toContain('finance.invoice.charge');
    expect(markdown).toContain('L3_EXTERNAL_COMMUNICATION_FINANCE');
    expect(markdown).toContain('Requires Human Approval');
    expect(markdown).toContain('workspace:write');
  });

  it('sanitizes potential credentials and secrets from documentation exports (Rules 32 & 33)', () => {
    const mockStoreWithSecret = createCapabilityRegistryStore();
    mockStoreWithSecret.register({
      id: 'system.secret.test',
      name: 'Test Secret Scrubbing',
      domain: 'ai_governance',
      operation: 'read',
      version: '1.0.0',
      description: 'API key secret token bearer: sk-test-1234567890abcdef',
      risk: {
        level: 'L4_PRIVILEGED_DESTRUCTIVE',
        destructive: false,
        idempotent: true,
        openWorld: false,
        requiresHumanApproval: true,
        nonDelegable: false,
      },
      execution: defaultExecution,
      policies: defaultPolicies,
      workspaceScoped: false,
      tenantScoped: true,
      permissions: ['workspace:read'],
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      handler: async () => ({
        success: true,
        data: {},
        executionId: 'mock-sec',
        emittedEvents: [],
        durationMs: 1,
      }),
    });

    const secGenerator = new PlatformDocGenerator(mockStoreWithSecret);
    const doc = secGenerator.generateDomainMarkdown('ai_governance');
    expect(doc).not.toContain('sk-test-1234567890abcdef');
    expect(doc).toContain('[REDACTED_SECRET]');
  });

  it('provides singleton instance with HMR safety', () => {
    const singleton = getPlatformDocGenerator();
    expect(singleton).toBeInstanceOf(PlatformDocGenerator);
  });
});
