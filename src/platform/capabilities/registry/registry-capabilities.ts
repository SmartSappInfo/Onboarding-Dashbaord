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

import { z } from 'zod';
import { registerCapability } from './capability-registry';
import {
  ProgressiveDiscoveryQuerySchema,
  ProgressiveDiscoveryResultSchema,
  CapabilityCatalogItemSchema,
  GenerateDocumentationInputSchema,
  DocumentationExportFormatSchema,
} from '../../registry/contracts/registry-types';
import { getProgressiveDiscoveryService } from '../../registry/discovery/progressive-discovery-service';
import { getPlatformDocGenerator } from '../../registry/docs/platform-doc-generator';

// ============================================================================
// 1. discovery.search_capabilities (L0_READ)
// ============================================================================
export const searchCapabilitiesCapability = {
  id: 'discovery.search_capabilities',
  domain: 'registry_discovery',
  version: '1.0.0',
  description: 'Searches capability catalog using hierarchical intent matching and returns token-pruned discovery stubs.',
  risk: {
    level: 'L0_READ' as const,
    requiresHumanApproval: false,
  },
  permissions: ['discovery:search', 'workspace:read'],
  inputSchema: ProgressiveDiscoveryQuerySchema,
  outputSchema: ProgressiveDiscoveryResultSchema,
  execute: async (input: z.infer<typeof ProgressiveDiscoveryQuerySchema>, context?: { signal?: AbortSignal; organizationId?: string; workspaceId?: string }) => {
    const service = getProgressiveDiscoveryService();
    return service.searchCapabilities(input, {
      signal: context?.signal,
      organizationId: context?.organizationId,
      workspaceId: context?.workspaceId,
    });
  },
};

// ============================================================================
// 2. discovery.get_capability_details (L0_READ)
// ============================================================================
const GetCapabilityDetailsInputSchema = z.object({
  capabilityId: z.string().min(1),
});

const GetCapabilityDetailsOutputSchema = z.object({
  capability: CapabilityCatalogItemSchema.optional(),
});

export const getCapabilityDetailsCapability = {
  id: 'discovery.get_capability_details',
  domain: 'registry_discovery',
  version: '1.0.0',
  description: 'Expands full schema, policy, and drift metadata for a specific capability ID.',
  risk: {
    level: 'L0_READ' as const,
    requiresHumanApproval: false,
  },
  permissions: ['registry:read', 'workspace:read'],
  inputSchema: GetCapabilityDetailsInputSchema,
  outputSchema: GetCapabilityDetailsOutputSchema,
  execute: async (input: z.infer<typeof GetCapabilityDetailsInputSchema>, context?: { organizationId?: string }) => {
    const service = getProgressiveDiscoveryService();
    const capability = await service.getCapabilityDetails(input.capabilityId, context?.organizationId);
    return { capability };
  },
};

// ============================================================================
// 3. registry.generate_documentation (L0_READ)
// ============================================================================
const GenerateDocumentationOutputSchema = z.object({
  format: DocumentationExportFormatSchema,
  content: z.string(),
});

export const generateDocumentationCapability = {
  id: 'registry.generate_documentation',
  domain: 'registry_discovery',
  version: '1.0.0',
  description: 'Compiles runtime capability definitions into OpenAPI 3.1.0 or Markdown reference dossiers.',
  risk: {
    level: 'L0_READ' as const,
    requiresHumanApproval: false,
  },
  permissions: ['registry:read', 'workspace:read'],
  policies: {
    auditRequired: true,
    requiresIdempotencyKey: false,
  },
  inputSchema: GenerateDocumentationInputSchema,
  outputSchema: GenerateDocumentationOutputSchema,
  execute: async (input: z.infer<typeof GenerateDocumentationInputSchema>) => {
    const generator = getPlatformDocGenerator();
    let content = '';

    if (input.format === 'OPENAPI_3_1') {
      const spec = generator.generateOpenApiSpec({ domain: input.domain, capabilityId: input.capabilityId });
      content = JSON.stringify(spec, null, 2);
    } else if (input.format === 'MCP_MANIFEST') {
      const manifest = generator.generateMcpManifest({ domain: input.domain, capabilityId: input.capabilityId });
      content = JSON.stringify(manifest, null, 2);
    } else {
      content = generator.generateDomainMarkdown(input.domain || 'general');
    }

    return {
      format: input.format,
      content,
    };
  },
};

// ============================================================================
// 4. registry.export_mcp_manifest (L0_READ)
// ============================================================================
const ExportMcpManifestInputSchema = z.object({
  domain: z.string().optional(),
});

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

export const exportMcpManifestCapability = {
  id: 'registry.export_mcp_manifest',
  domain: 'registry_discovery',
  version: '1.0.0',
  description: 'Exports runtime capabilities as an MCP 2026-07-28 compliant tools manifest.',
  risk: {
    level: 'L0_READ' as const,
    requiresHumanApproval: false,
  },
  permissions: ['registry:read', 'workspace:read'],
  policies: {
    auditRequired: true,
  },
  inputSchema: ExportMcpManifestInputSchema,
  outputSchema: ExportMcpManifestOutputSchema,
  execute: async (input: z.infer<typeof ExportMcpManifestInputSchema>) => {
    const generator = getPlatformDocGenerator();
    const manifest = generator.generateMcpManifest({ domain: input.domain });
    return { manifest };
  },
};

// Auto-register all 4 capabilities in the Canonical Capability Registry on module load (Decision D1 / PR-2)
registerCapability(searchCapabilitiesCapability, { allowOverride: true });
registerCapability(getCapabilityDetailsCapability, { allowOverride: true });
registerCapability(generateDocumentationCapability, { allowOverride: true });
registerCapability(exportMcpManifestCapability, { allowOverride: true });
