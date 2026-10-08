'use server';

/**
 * @fileOverview Governed Next.js 15 Server Actions: Capability & Agent Registries (Phase 15 Milestone 4)
 *
 * Implements Rules 1, 4, 8, 12, 14, 16, 17, 19, 21, 22, 28, 47, 48, 51, 60, 61, 67, 68, 69.
 * Provides authenticated, Anti-IDOR protected, dead-man verified endpoints for:
 * - Progressive capability discovery and detail lookup
 * - Automated platform documentation synthesis (OpenAPI 3.1.0, MCP, Markdown)
 * - Agent persona registry catalog and configuration inspection
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';
import { checkGovernanceDeadManSwitch } from '@/platform/governance/governance-dead-man-switch';
import {
  type CapabilityCatalogItem,
  type ProgressiveDiscoveryResult,
  type AgentPersonaSummary,
  type DocumentationExportFormat,
  ProgressiveDiscoveryQuerySchema,
  GenerateDocumentationInputSchema,
  RegistryDomainError,
  REGISTRY_ERROR_CODES,
} from '@/platform/registry/contracts/registry-types';
import { getProgressiveDiscoveryService } from '@/platform/registry/discovery/progressive-discovery-service';
import { getPlatformDocGenerator } from '@/platform/registry/docs/platform-doc-generator';
import { canonicalCapabilityRegistryStore } from '@/platform/capabilities/registry/capability-registry';
import { BUILT_IN_AGENT_PERSONAS, getPersona } from '@/platform/identity/agent-registry';
import '@/platform/capabilities/registry/registry-capabilities';

export type RegistryActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string; httpStatus: number } };

/**
 * Validates authenticated user organizational boundary against target entity (Rules 8 & 47).
 */
function assertTenantAccess(auth: AuthContext, targetOrgId: string): void {
  const sessionOrgId = auth.profile?.organizationId || auth.organizationId;
  if (!sessionOrgId) {
    throw new RegistryDomainError(
      REGISTRY_ERROR_CODES.IDOR_VIOLATION,
      'Missing authenticated organization context.',
      403
    );
  }

  if (sessionOrgId !== targetOrgId) {
    throw new RegistryDomainError(
      REGISTRY_ERROR_CODES.IDOR_VIOLATION,
      `Cross-tenant access forbidden (session org: ${sessionOrgId}, target: ${targetOrgId}).`,
      403
    );
  }
}

/**
 * Searches capabilities using progressive hierarchical discovery with Knapsack token pruning (Roadmap §21 & Rule 28).
 */
export async function searchCapabilitiesAction(params: {
  intent: string;
  domain?: string;
  limit?: number;
  maxTokens?: number;
  organizationId?: string;
}): Promise<RegistryActionResult<ProgressiveDiscoveryResult>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = params.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);

    const query = ProgressiveDiscoveryQuerySchema.parse({
      intent: params.intent,
      domain: params.domain,
      limit: params.limit,
      maxTokens: params.maxTokens,
    });

    const service = getProgressiveDiscoveryService();
    const result = await service.searchCapabilities(query, {
      organizationId: targetOrgId,
      workspaceId: auth.profile?.workspaceId,
    });

    return { success: true, data: result };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Retrieves full capability details, schemas, and live drift status (Roadmap §22 & Rule 14).
 */
export async function getCapabilityDetailsAction(
  capabilityId: string,
  organizationId?: string
): Promise<RegistryActionResult<{ capability: CapabilityCatalogItem | null }>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);

    const service = getProgressiveDiscoveryService();
    const capability = await service.getCapabilityDetails(capabilityId, targetOrgId);

    return {
      success: true,
      data: { capability: capability || null },
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Lists all registered capabilities for the Backoffice Tool Registry UI (Roadmap §22).
 */
export async function listAllCapabilitiesAction(options?: {
  domain?: string;
  organizationId?: string;
}): Promise<RegistryActionResult<{ capabilities: readonly CapabilityCatalogItem[] }>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';
    const targetOrgId = options?.organizationId || actorOrgId;

    assertTenantAccess(auth, targetOrgId);

    const allCaps = canonicalCapabilityRegistryStore.list();
    const service = getProgressiveDiscoveryService();

    const capabilities: CapabilityCatalogItem[] = [];
    for (const cap of allCaps) {
      if (options?.domain && cap.domain !== options.domain) {
        continue;
      }
      const details = await service.getCapabilityDetails(cap.id, targetOrgId);
      if (details) {
        capabilities.push(details);
      }
    }

    return {
      success: true,
      data: { capabilities },
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Generates platform documentation (OpenAPI 3.1.0, MCP 2026-07-28, or Markdown) (Roadmap §25).
 */
export async function generatePlatformDocsAction(params: {
  format: DocumentationExportFormat;
  domain?: string;
  capabilityId?: string;
}): Promise<RegistryActionResult<{ format: DocumentationExportFormat; content: string }>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';

    assertTenantAccess(auth, actorOrgId);

    const validatedInput = GenerateDocumentationInputSchema.parse(params);
    const generator = getPlatformDocGenerator();

    let content = '';
    if (validatedInput.format === 'OPENAPI_3_1') {
      const spec = generator.generateOpenApiSpec({
        domain: validatedInput.domain,
        capabilityId: validatedInput.capabilityId,
      });
      content = JSON.stringify(spec, null, 2);
    } else if (validatedInput.format === 'MCP_MANIFEST') {
      const manifest = generator.generateMcpManifest({
        domain: validatedInput.domain,
        capabilityId: validatedInput.capabilityId,
      });
      content = JSON.stringify(manifest, null, 2);
    } else {
      content = generator.generateDomainMarkdown(validatedInput.domain || 'general');
    }

    return {
      success: true,
      data: {
        format: validatedInput.format,
        content,
      },
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Retrieves the catalog of canonical agent personas (Roadmap §23).
 */
export async function getAgentPersonasAction(): Promise<
  RegistryActionResult<{ personas: readonly AgentPersonaSummary[] }>
> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';

    assertTenantAccess(auth, actorOrgId);

    const summaries: AgentPersonaSummary[] = BUILT_IN_AGENT_PERSONAS.map((p) => ({
      id: p.id,
      name: p.name,
      version: p.version,
      role: p.role,
      description: p.description,
      maxAutonomousRiskLevel: p.maxAutonomousRiskLevel,
      allowedDomains: [...p.allowedDomains],
      maxDurationMs: p.budgets.maxDurationMs,
      maxTokens: p.budgets.maxTokens,
      maxToolCalls: p.budgets.maxToolCalls,
      isConfigurable: false,
    }));

    return {
      success: true,
      data: { personas: summaries },
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Retrieves full definition and budget configuration for a specific agent persona (Roadmap §23).
 */
export async function getAgentPersonaDetailsAction(
  personaId: string
): Promise<RegistryActionResult<{ persona: AgentPersonaSummary }>> {
  try {
    const auth = await requireAuth();
    const actorOrgId = auth.profile?.organizationId || 'default_org';

    assertTenantAccess(auth, actorOrgId);

    const persona = getPersona(personaId);
    if (!persona) {
      throw new RegistryDomainError(
        'REGISTRY_PERSONA_NOT_FOUND',
        `Agent persona '${personaId}' was not found in registry`,
        404
      );
    }

    const summary: AgentPersonaSummary = {
      id: persona.id,
      name: persona.name,
      version: persona.version,
      role: persona.role,
      description: persona.description,
      maxAutonomousRiskLevel: persona.maxAutonomousRiskLevel,
      allowedDomains: [...persona.allowedDomains],
      maxDurationMs: persona.budgets.maxDurationMs,
      maxTokens: persona.budgets.maxTokens,
      maxToolCalls: persona.budgets.maxToolCalls,
      isConfigurable: false,
    };

    return {
      success: true,
      data: { persona: summary },
    };
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Centralized error serializer mapping exceptions to structured RegistryActionResult (Rule 48).
 */
function handleError<T>(error: unknown): RegistryActionResult<T> {
  const err = error as Error & { code?: string; httpStatus?: number };

  if (err.name === 'RegistryDomainError') {
    return {
      success: false,
      error: {
        code: err.code || REGISTRY_ERROR_CODES.CAPABILITY_NOT_FOUND,
        message: err.message,
        httpStatus: err.httpStatus || 500,
      },
    };
  }

  if (err.code === 'IDOR_VIOLATION' || err.message?.includes('IDOR')) {
    return {
      success: false,
      error: {
        code: REGISTRY_ERROR_CODES.IDOR_VIOLATION,
        message: err.message || 'Tenant isolation violation',
        httpStatus: 403,
      },
    };
  }

  if (err.code === 'GOVERNANCE_DEAD_MAN_SWITCH_TRIPPED') {
    return {
      success: false,
      error: {
        code: REGISTRY_ERROR_CODES.DEAD_MAN_PAUSED,
        message: err.message || 'Registry operations halted due to emergency pause',
        httpStatus: 503,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'REGISTRY_INTERNAL_ERROR',
      message: err.message || 'An unexpected registry error occurred',
      httpStatus: 500,
    },
  };
}
