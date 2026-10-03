/**
 * @fileOverview Domain Server Types, Capability Mappings & Context Budgeting (Phase 5 Milestone 2 Task 1)
 *
 * Defines the canonical mapping between the 6 exposed MCP domains and the 17 underlying
 * platform capability domains, context budgeting token ceilings, SemVer validation,
 * and discovery options schemas.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Rule 11 & Rule 28: MCP servers are domain-partitioned to avoid context window overflow in LLMs.
 * - Context Budgeting (Rule 54 & Rule 56): A discovery payload for any domain must not exceed
 *   `MAX_DISCOVERY_PAYLOAD_TOKENS` (1,500 tokens).
 * - Tool Descriptions (Rule 31): Must be concise imperative statements under 300 characters.
 * - Strict Typing: Zero `any` or `any[]` (Rule 4).
 */

import { z } from 'zod/v4';
import type {
  CapabilityDomain,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import type { McpDomain } from '../transport/transport-types';

/**
 * Mapping from each of the 6 external MCP domains to their canonical internal capability domains.
 */
export const DOMAIN_CAPABILITY_MAP: Record<McpDomain, readonly CapabilityDomain[]> = {
  crm: ['crm_contacts', 'deals_revenue', 'tasks_productivity'] as const,
  knowledge: ['knowledge_memory'] as const,
  messaging: ['communication_messaging'] as const,
  sales: ['lead_intelligence', 'campaigns_marketing'] as const,
  portals: ['experience_portal', 'school_operations'] as const,
  system: ['identity_access', 'ai_governance'] as const,
};

/**
 * Fallback prefixes for capabilities that might have cross-domain categorizations or legacy IDs.
 */
export const DOMAIN_ID_PREFIXES: Record<McpDomain, readonly string[]> = {
  crm: ['crm.', 'deal.', 'task.', 'contact.', 'pipeline.', 'activity.'] as const,
  knowledge: ['knowledge.', 'memory.', 'note.', 'context.', 'dossier.'] as const,
  messaging: ['messaging.', 'message.', 'template.', 'sms.', 'email.', 'whatsapp.'] as const,
  sales: ['sales.', 'lead.', 'campaign.', 'enrichment.'] as const,
  portals: ['portal.', 'membership.', 'course.', 'community.', 'credential.'] as const,
  system: ['system.', 'access.', 'governance.', 'policy.', 'audit.', 'security.'] as const,
};

/**
 * Maximum token budget allocated for a single domain's tools/list response (Rule 28 & Rule 54).
 * Prevents small context window LLMs (e.g. Claude 3 Haiku, Gemini Flash) from being overwhelmed.
 */
export const MAX_DISCOVERY_PAYLOAD_TOKENS = 1500;

/**
 * Maximum character length allowed for a tool description (Rule 31 & Rule 56).
 */
export const MAX_TOOL_DESCRIPTION_LENGTH = 300;

/**
 * Options schema for progressive tool discovery (Rule 5).
 */
export const DiscoveryOptionsSchema = z.object({
  includeDetails: z.boolean().default(true),
  tag: z.string().optional(),
});

export type DiscoveryOptions = z.infer<typeof DiscoveryOptionsSchema>;

/**
 * Checks whether a capability belongs to a given MCP domain.
 * Evaluates both the primary `capability.domain` mapping and ID prefix fallbacks.
 */
export function isCapabilityInMcpDomain(
  capability: Pick<AnyCapabilityDefinition, 'id' | 'domain'>,
  mcpDomain: McpDomain
): boolean {
  // 1. Direct domain mapping
  const mappedDomains = DOMAIN_CAPABILITY_MAP[mcpDomain];
  if (mappedDomains && mappedDomains.includes(capability.domain)) {
    return true;
  }

  // 2. Prefix fallback
  const prefixes = DOMAIN_ID_PREFIXES[mcpDomain];
  if (prefixes) {
    for (const prefix of prefixes) {
      if (capability.id.startsWith(prefix)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Heuristic token estimator for tool discovery payloads (Rule 54 & Rule 56).
 * Assumes approximately 4 characters per token across name, description, and JSON schema properties.
 */
export function estimateToolDiscoveryTokens(tool: {
  name: string;
  description: string;
  inputSchema?: unknown;
}): number {
  let charCount = tool.name.length + tool.description.length;

  if (tool.inputSchema) {
    try {
      const jsonStr = JSON.stringify(tool.inputSchema);
      charCount += jsonStr.length;
    } catch {
      charCount += 100;
    }
  }

  // Add baseline overhead per tool JSON-RPC structure (~15 tokens = 60 chars)
  charCount += 60;

  return Math.ceil(charCount / 4);
}

/**
 * Regular expression validating SemVer 2.0 (Rule 36).
 */
const SEMVER_REGEX =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * Validates whether a version string complies with SemVer 2.0 (Rule 36).
 */
export function isValidSemVer(version: string): boolean {
  if (!version || typeof version !== 'string') return false;
  return SEMVER_REGEX.test(version.trim());
}
