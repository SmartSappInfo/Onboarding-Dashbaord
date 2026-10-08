/**
 * @fileOverview Canonical Registry & Progressive Discovery Capabilities (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 4, 8, 11, 12, 14, 16, 17, 19, 28, 48, 67, 68, 69, and Roadmap §21, §22, §23, §25.
 * Registers canonical capabilities in CapabilityRegistry:
 * - discovery.search_capabilities (L0_READ)
 * - discovery.get_capability_details (L0_READ)
 * - registry.generate_documentation (L0_READ)
 * - registry.export_mcp_manifest (L0_READ)
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { z } from 'zod/v4';
import {
  type CapabilityDefinition,
  type CapabilityExecutionContext,
  type CapabilityExecutionResult,
} from '../contracts/capability-definition';
import { registerCapability } from './capability-registry';
import {
  ProgressiveDiscoveryQuerySchema,
  ProgressiveDiscoveryResultSchema,
  CapabilityCatalogItemSchema,
  GenerateDocumentationInputSchema,
  DocumentationExportFormatSchema,
  type ProgressiveDiscoveryResult,
} from '../../registry/contracts/registry-types';
import { getProgressiveDiscoveryService } from '../../registry/discovery/progressive-discovery-service';
import { getPlatformDocGenerator } from '../../registry/docs/platform-doc-generator';

// ============================================================================
// 1. discovery.search_capabilities (L0_READ)
// ============================================================================
export type SearchCapabilitiesInput = z.infer<typeof ProgressiveDiscoveryQuerySchema>;

export const searchCapabilitiesCapability: CapabilityDefinition<
  SearchCapabilitiesInput,
  ProgressiveDiscoveryResult
> = {
  id: 'discovery.search_capabilities',
  version: '1.0.0',
  name: 'Search Capabilities',
  description:
    'Searches capability catalog using hierarchical intent matching and returns token-pruned discovery stubs.',
  domain: 'ai_governance',
  operation: 'search',
  inputSchema: ProgressiveDiscoveryQuerySchema,
  outputSchema: ProgressiveDiscoveryResultSchema,
  permissions: ['discovery:search', 'workspace:read'],
  workspaceScoped: false,
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
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: true,
    supportsCompensation: false,
    maxPayloadSizeBytes: 524288,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: SearchCapabilitiesInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ProgressiveDiscoveryResult>> => {
    const startTime = Date.now();
    const service = getProgressiveDiscoveryService();
    const result = await service.searchCapabilities(input, {
      organizationId: context.principal.organizationId,
      workspaceId: context.principal.workspaceId,
    });

    return {
      success: true,
      data: result,
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 2. discovery.get_capability_details (L0_READ)
// ============================================================================
const GetCapabilityDetailsInputSchema = z.object({
  capabilityId: z.string().min(1),
});
export type GetCapabilityDetailsInput = z.infer<typeof GetCapabilityDetailsInputSchema>;

const GetCapabilityDetailsOutputSchema = z.object({
  capability: CapabilityCatalogItemSchema.optional(),
});
export type GetCapabilityDetailsOutput = z.infer<typeof GetCapabilityDetailsOutputSchema>;

export const getCapabilityDetailsCapability: CapabilityDefinition<
  GetCapabilityDetailsInput,
  GetCapabilityDetailsOutput
> = {
  id: 'discovery.get_capability_details',
  version: '1.0.0',
  name: 'Get Capability Details',
  description: 'Expands full schema, policy, and drift metadata for a specific capability ID.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GetCapabilityDetailsInputSchema,
  outputSchema: GetCapabilityDetailsOutputSchema,
  permissions: ['registry:read', 'workspace:read'],
  workspaceScoped: false,
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
    maxDurationMs: 10000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 524288,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: false,
    defaultEnabled: true,
  },
  handler: async (
    input: GetCapabilityDetailsInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<GetCapabilityDetailsOutput>> => {
    const startTime = Date.now();
    const service = getProgressiveDiscoveryService();
    const capability = await service.getCapabilityDetails(
      input.capabilityId,
      context.principal.organizationId
    );

    return {
      success: true,
      data: { capability: capability || undefined },
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 3. registry.generate_documentation (L0_READ)
// ============================================================================
export type GenerateDocumentationInput = z.infer<typeof GenerateDocumentationInputSchema>;

const GenerateDocumentationOutputSchema = z.object({
  format: DocumentationExportFormatSchema,
  content: z.string(),
});
export type GenerateDocumentationOutput = z.infer<typeof GenerateDocumentationOutputSchema>;

export const generateDocumentationCapability: CapabilityDefinition<
  GenerateDocumentationInput,
  GenerateDocumentationOutput
> = {
  id: 'registry.generate_documentation',
  version: '1.0.0',
  name: 'Generate Platform Documentation',
  description:
    'Compiles runtime capability definitions into OpenAPI 3.1.0 or Markdown reference dossiers.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: GenerateDocumentationInputSchema,
  outputSchema: GenerateDocumentationOutputSchema,
  permissions: ['registry:read', 'workspace:read'],
  workspaceScoped: false,
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
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 2097152,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: GenerateDocumentationInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<GenerateDocumentationOutput>> => {
    const startTime = Date.now();
    const generator = getPlatformDocGenerator();
    let content = '';

    if (input.format === 'OPENAPI_3_1') {
      const spec = generator.generateOpenApiSpec({
        domain: input.domain,
        capabilityId: input.capabilityId,
      });
      content = JSON.stringify(spec, null, 2);
    } else if (input.format === 'MCP_MANIFEST') {
      const manifest = generator.generateMcpManifest({
        domain: input.domain,
        capabilityId: input.capabilityId,
      });
      content = JSON.stringify(manifest, null, 2);
    } else {
      content = generator.generateDomainMarkdown(input.domain || 'general');
    }

    return {
      success: true,
      data: {
        format: input.format,
        content,
      },
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// ============================================================================
// 4. registry.export_mcp_manifest (L0_READ)
// ============================================================================
const ExportMcpManifestInputSchema = z.object({
  domain: z.string().optional(),
});
export type ExportMcpManifestInput = z.infer<typeof ExportMcpManifestInputSchema>;

const ExportMcpManifestOutputSchema = z.object({
  manifest: z.object({
    tools: z.array(
      z.object({
        name: z.string(),
        description: z.string(),
        inputSchema: z.record(z.string(), z.unknown()),
      })
    ),
  }),
});
export type ExportMcpManifestOutput = z.infer<typeof ExportMcpManifestOutputSchema>;

export const exportMcpManifestCapability: CapabilityDefinition<
  ExportMcpManifestInput,
  ExportMcpManifestOutput
> = {
  id: 'registry.export_mcp_manifest',
  version: '1.0.0',
  name: 'Export MCP Manifest',
  description: 'Exports runtime capabilities as an MCP 2026-07-28 compliant tools manifest.',
  domain: 'ai_governance',
  operation: 'read',
  inputSchema: ExportMcpManifestInputSchema,
  outputSchema: ExportMcpManifestOutputSchema,
  permissions: ['registry:read', 'workspace:read'],
  workspaceScoped: false,
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
    maxDurationMs: 15000,
    supportsDryRun: true,
    supportsCancellation: false,
    supportsCompensation: false,
    maxPayloadSizeBytes: 2097152,
  },
  policies: {
    requiresIdempotencyKey: false,
    requiresExpectedVersion: false,
    auditRequired: true,
    defaultEnabled: true,
  },
  handler: async (
    input: ExportMcpManifestInput,
    context: CapabilityExecutionContext
  ): Promise<CapabilityExecutionResult<ExportMcpManifestOutput>> => {
    const startTime = Date.now();
    const generator = getPlatformDocGenerator();
    const manifest = generator.generateMcpManifest({ domain: input.domain });

    return {
      success: true,
      data: { manifest },
      executionId: context.correlationId,
      emittedEvents: [],
      durationMs: Date.now() - startTime,
    };
  },
};

// Auto-register all 4 capabilities in the Canonical Capability Registry on module load (Decision D1 / PR-2)
registerCapability(searchCapabilitiesCapability, { allowOverride: true });
registerCapability(getCapabilityDetailsCapability, { allowOverride: true });
registerCapability(generateDocumentationCapability, { allowOverride: true });
registerCapability(exportMcpManifestCapability, { allowOverride: true });
