/**
 * @fileOverview Domain-Partitioned MCP Server Factory (Phase 5 Milestone 2 Task 2)
 *
 * Implements Rule 8 (Multi-Tenancy), Rule 11 (MCP Spec 2026-07-28), Rule 12 (Annotations Are Hints),
 * Rule 16 (Least Privilege), Rule 17 (Non-Delegable Guard), Rule 28 & 54 (Context Budgeting),
 * Rule 31 (Description Engineering), and Rule 61 (Surface Isolation).
 *
 * Builds an MCP SDK v2 `McpServer` instance specifically tailored for one of the 6 canonical domains:
 *   - crm
 *   - knowledge
 *   - messaging
 *   - sales
 *   - portals
 *   - system
 *
 * Strict Typing Policy: Zero `any` or `any[]` (Rule 4).
 */

import { McpServer } from '@modelcontextprotocol/server';
import { isBackofficeSurface } from '@/lib/platform/app-surface';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';
import { isNonDelegableAction } from '../../capabilities/contracts/risk-levels';
import { canonicalCapabilityRegistryStore } from '../../capabilities/registry/capability-registry';
import {
  toolNameFor,
  createCapabilityToolHandler,
  type McpToolAuditEntry,
} from '../create-stateless-handler';
import { toMcpToolSchema } from '../to-mcp-tool-schema';
import type { McpDomain } from '../transport/transport-types';
import {
  isCapabilityInMcpDomain,
  estimateToolDiscoveryTokens,
  MAX_DISCOVERY_PAYLOAD_TOKENS,
  MAX_TOOL_DESCRIPTION_LENGTH,
} from './domain-server-types';
import {
  ToolFingerprintService,
  globalToolFingerprintService,
  detectToolDrift,
  type TenantContext,
  EgressDataPolicyEngine,
  globalEgressDataPolicyEngine,
  type EgressDestination,
} from '../security';

export interface CreateDomainMcpServerOptions {
  domain: McpDomain;
  principal: AgentPrincipal;
  capabilities?: AnyCapabilityDefinition[];
  auditSink?: (entry: McpToolAuditEntry) => Promise<void> | void;
  checkSurface?: () => boolean;
  fingerprintService?: ToolFingerprintService;
  enforceFingerprints?: boolean;
  egressPolicyEngine?: EgressDataPolicyEngine;
  enforceEgressPolicy?: boolean;
  egressDestination?: EgressDestination;
  redactEgressSensitiveData?: boolean;
}

export interface DomainServerToolSummary {
  domain: McpDomain;
  totalTools: number;
  toolNames: string[];
  estimatedTokens: number;
}

/**
 * Evaluates whether an authenticated principal has authority to discover/execute a capability (Rule 16).
 */
function hasPermissionForCapability(
  principal: AgentPrincipal,
  capability: AnyCapabilityDefinition
): boolean {
  if (capability.public) return true;
  const granted = new Set(principal.grantedScopes || []);
  return capability.permissions.some((perm) => granted.has(perm));
}

/**
 * Determines whether a capability demands non-delegable actions that must not be exposed to agents (Rule 17).
 */
function containsNonDelegableAction(capability: AnyCapabilityDefinition): boolean {
  if (capability.risk.nonDelegable) return true;
  return capability.permissions.some((perm) => isNonDelegableAction(perm));
}

/**
 * Filters the global capability registry down to domain-scoped, least-privilege-approved capabilities.
 */
export function getEligibleCapabilitiesForDomain(
  domain: McpDomain,
  principal: AgentPrincipal,
  allCapabilities: AnyCapabilityDefinition[]
): AnyCapabilityDefinition[] {
  // 1. Filter by target domain
  const domainCaps = allCapabilities.filter((cap) => isCapabilityInMcpDomain(cap, domain));

  // 2. Filter by Least Privilege (Rule 16) and Non-Delegable Actions (Rule 17)
  const authorizedCaps = domainCaps.filter((cap) => {
    // If agent principal, unconditionally strip non-delegable actions
    if (principal.actorType === 'agent' && containsNonDelegableAction(cap)) {
      return false;
    }

    return hasPermissionForCapability(principal, cap);
  });

  // 3. Enforce Context Budgeting (< 1,500 tokens, Rule 28 & Rule 54)
  let accumulatedTokens = 0;
  const budgetedCaps: AnyCapabilityDefinition[] = [];

  for (const cap of authorizedCaps) {
    const truncatedDesc = cap.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH);
    const estimated = estimateToolDiscoveryTokens({
      name: toolNameFor(cap.id),
      description: truncatedDesc,
    });

    if (accumulatedTokens + estimated <= MAX_DISCOVERY_PAYLOAD_TOKENS) {
      accumulatedTokens += estimated;
      budgetedCaps.push(cap);
    } else {
      console.warn(
        `[MCP Factory] Capability '${cap.id}' omitted from domain '${domain}' to respect context budget ceiling (${accumulatedTokens}/${MAX_DISCOVERY_PAYLOAD_TOKENS} tokens)`
      );
    }
  }

  return budgetedCaps;
}

/**
 * Returns a lightweight summary of available tools for a domain without instantiating the full McpServer.
 */
export function getDomainServerToolSummary(
  domain: McpDomain,
  principal: AgentPrincipal,
  capabilities?: AnyCapabilityDefinition[]
): DomainServerToolSummary {
  const candidatePool = capabilities || canonicalCapabilityRegistryStore.list();
  const eligible = getEligibleCapabilitiesForDomain(domain, principal, candidatePool);

  let estimatedTokens = 0;
  const toolNames: string[] = [];

  for (const cap of eligible) {
    const name = toolNameFor(cap.id);
    toolNames.push(name);
    estimatedTokens += estimateToolDiscoveryTokens({
      name,
      description: cap.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH),
    });
  }

  return {
    domain,
    totalTools: eligible.length,
    toolNames,
    estimatedTokens,
  };
}

/**
 * Factory creating an MCP SDK v2 McpServer configured specifically for one domain.
 */
export function createDomainMcpServer(options: CreateDomainMcpServerOptions): McpServer {
  const { domain, principal, capabilities, auditSink, checkSurface } = options;

  // 1. Surface Isolation Guard (Rule 61)
  const isBackoffice = checkSurface ? checkSurface() : isBackofficeSurface();
  if (domain === 'system' && !isBackoffice) {
    throw new Error(
      `Access denied: domain 'system' is restricted to the Backoffice control plane surface.`
    );
  }

  // 2. Resolve eligible capabilities for domain
  const candidatePool = capabilities || canonicalCapabilityRegistryStore.list();
  const eligibleCapabilities = getEligibleCapabilitiesForDomain(domain, principal, candidatePool);

  // 3. Instantiate domain McpServer
  const server = new McpServer({
    name: `smartsapp-${domain}-mcp`,
    version: '2.0.0',
  });

  // 4. Mount tools onto server
  for (const cap of eligibleCapabilities) {
    const mcpSchema = toMcpToolSchema(cap.inputSchema);
    const truncatedDescription = cap.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH);

    const handler = createCapabilityToolHandler(cap, {
      getPrincipal: () => principal,
      audit: auditSink,
    });

    server.registerTool(
      toolNameFor(cap.id),
      {
        description: truncatedDescription,
        inputSchema: mcpSchema,
      },
      async (args) => {
        // 1. Tool Fingerprint Integrity & Rug-Pull Verification (Rule 14)
        if (principal.organizationId && principal.workspaceId) {
          const tenant: TenantContext = {
            organizationId: principal.organizationId,
            workspaceId: principal.workspaceId,
          };
          const fpService = options.fingerprintService ?? globalToolFingerprintService;

          if (options.enforceFingerprints) {
            try {
              const check = await fpService.verifyCapabilityFingerprint(cap, tenant);
              if (!check.isValid) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `[MCP Security] TOOL_FINGERPRINT_DRIFT: Tool '${cap.id}' failed integrity check. ${check.driftReport.reason}`,
                    },
                  ],
                  isError: true,
                };
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              return {
                content: [
                  {
                    type: 'text',
                    text: `[MCP Security] ${msg}`,
                  },
                ],
                isError: true,
              };
            }
          } else {
            // Verify against existing approved fingerprint if one is stored
            const approved = await fpService.getApprovedFingerprint(cap.id, cap.version, tenant);
            if (approved) {
              const drift = detectToolDrift(cap, approved);
              if (drift.hasDrift) {
                return {
                  content: [
                    {
                      type: 'text',
                      text: `[MCP Security] TOOL_FINGERPRINT_DRIFT: Tool '${cap.id}' failed integrity check. ${drift.reason}`,
                    },
                  ],
                  isError: true,
                };
              }
            }
          }
        }

        // 2. Execute capability handler
        const result = await handler(args);

        // 3. Data Egress Policy Evaluation & Exfiltration Defense (Rule 32 & 33)
        if (options.enforceEgressPolicy || options.egressPolicyEngine) {
          const egressEngine = options.egressPolicyEngine ?? globalEgressDataPolicyEngine;
          const tenant: TenantContext | undefined =
            principal.organizationId && principal.workspaceId
              ? {
                  organizationId: principal.organizationId,
                  workspaceId: principal.workspaceId,
                }
              : undefined;
          const destination: EgressDestination = options.egressDestination ?? 'external_mcp_tool';

          const egressResult = await egressEngine.evaluateEgress(
            result,
            destination,
            tenant,
            {
              redactionMode: options.redactEgressSensitiveData,
            }
          );

          if (options.redactEgressSensitiveData && egressResult.sanitizedPayload) {
            return egressResult.sanitizedPayload as typeof result;
          }

          if (!egressResult.allowed) {
            return {
              content: [
                {
                  type: 'text',
                  text: `[MCP Security] DATA_EXFILTRATION_DETECTED: Egress blocked by policy. ${egressResult.reason}`,
                },
              ],
              isError: true,
            };
          }
        }

        return result;
      }
    );
  }

  return server;
}
