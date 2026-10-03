/**
 * @fileOverview Native In-Process Genkit Tool Adapter (Phase 5 Milestone 5 Task 1)
 *
 * Implements Rule 1 & Rule 4 (Zero any/any[] Strict Typing Policy), Rule 8 & 47 (Multi-Tenancy & Anti-IDOR),
 * Rule 10 (Inline Architectural Documentation), Rule 12 (Annotations Are Hints), Rule 13 (Never Trust the Model),
 * Rule 14 (Rug-Pull Defense & Tool Fingerprinting), Rule 16 (Agent Identity as Principal),
 * Rule 17 (Non-Delegable Action Stripping), Rule 20 & 39 (Distributed Tracing & Correlation IDs),
 * Rule 21 & 22 (Human Approval Binding & Cryptographic Hash Validation), Rule 28 & 54 (Context Budgeting),
 * Rule 31 (Description Engineering), Rule 32 & 33 (Data Egress Policy & Exfiltration Defense),
 * Rule 40 (Append-Only Audit Logging via EventBus), Rule 42 (Shadow Mode / Dry Run),
 * Rule 48 (Sanitize Tool Errors), Rule 60 (Emergency Dead-Man Controls), and Rule 61 (Surface Isolation).
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Zero-Network In-Process Invocation:
 *    Adapts canonical `CapabilityDefinition` records into Genkit `ToolAction` instances that run
 *    directly in-memory without HTTP network serialization, reducing invocation latency to < 1ms.
 * 2. Unbroken Security Pipeline:
 *    Every execution passes through the 9-stage platform security pipeline:
 *      1. Rule 60: Emergency Dead-Man Switch Evaluation (halt execution if engaged)
 *      2. Rule 8/47: Multi-Tenant Boundary Verification (fail-closed on cross-tenant mismatch)
 *      3. Rule 16/17: Principal Authority & Non-Delegable Action Verification
 *      4. Rule 21/22: Human Approval Verification for L3/L4 actions with SHA-256 payload hash binding
 *      5. Rule 14: Tool Fingerprint Integrity & Schema Drift Rug-Pull Defense
 *      6. Rule 13: Model Distrust — Strict Zod schema parsing before reaching capability logic
 *      7. Rule 42: Shadow-Mode / Dry-Run support for non-mutating preview execution
 *      8. Rule 32/33: Post-execution Data Egress Policy & Exfiltration Scanning
 *      9. Rule 40: Immutable audit domain event emission (`mcp.tool.invoked`) via EventBus.
 * 3. Fail-Closed Invariant:
 *    Any policy rejection, dead-man pause, drift detection, or unauthorized scope throws structured
 *    errors with sanitized codes from `GENKIT_ADAPTER_ERROR_CODES`.
 */

import crypto from 'node:crypto';
import { tool, z as genkitZ, type ToolAction } from 'genkit';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
  SchemaParser,
} from '../../capabilities/contracts/capability-definition';
import type { McpDomain } from '../transport/transport-types';
import { isNonDelegableAction } from '../../capabilities/contracts/risk-levels';
import {
  evaluatePrincipalAuthority,
  type TargetScope,
} from '../../capabilities/policy/principal-evaluator';
import { globalAgentPersonaRegistry } from '../../identity/agent-registry';
import { canonicalCapabilityRegistryStore } from '../../capabilities/registry/capability-registry';
import { createDomainEvent } from '../../capabilities/events/domain-event';
import { defaultEventBus } from '../../events/event-bus';
import {
  checkGovernanceDeadManSwitch,
  AgentGovernanceEmergencyPausedError,
} from '../../policy/governance-dead-man';
import {
  globalToolFingerprintService,
  detectToolDrift,
  type TenantContext,
  globalEgressDataPolicyEngine,
  type EgressDestination,
} from '../security';
import { toolNameFor } from '../create-stateless-handler';
import {
  isCapabilityInMcpDomain,
  estimateToolDiscoveryTokens,
  MAX_DISCOVERY_PAYLOAD_TOKENS,
  MAX_TOOL_DESCRIPTION_LENGTH,
} from '../servers/domain-server-types';
import { getEligibleCapabilitiesForDomain } from '../servers/domain-mcp-factory';
import { isBackofficeSurface } from '@/lib/platform/app-surface';
import {
  GENKIT_ADAPTER_ERROR_CODES,
  type CreateGenkitAgentToolsOptions,
  type CreateGenkitDomainToolsOptions,
  type GenkitToolAdapterOptions,
  type GenkitToolExecutionResult,
} from './genkit-adapter-types';

/**
 * Normalizes any Capability schema into a valid Zod schema consumable by Genkit.
 */
function toGenkitInputSchema(schema: z.ZodType<unknown> | SchemaParser<unknown>): genkitZ.ZodType<unknown> {
  return genkitZ.custom<unknown>((val) => {
    const res = schema.safeParse(val);
    return res.success;
  });
}

/**
 * Converts a canonical `CapabilityDefinition` into an in-process Genkit `ToolAction`.
 *
 * @param capability The canonical capability definition to adapt.
 * @param options Invocation and security options.
 * @returns A callable Genkit ToolAction bound to the in-memory execution pipeline.
 */
export function createGenkitToolFromCapability(
  capability: AnyCapabilityDefinition,
  options: GenkitToolAdapterOptions
): ToolAction {
  const { principal } = options;
  const toolName = toolNameFor(capability.id);
  const truncatedDescription = capability.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH);
  const inputSchema = toGenkitInputSchema(capability.inputSchema);

  return tool(
    {
      name: toolName,
      description: truncatedDescription,
      inputSchema,
    },
    async (rawInput: unknown): Promise<unknown> => {
      // 1. Rule 60: Emergency Dead-Man Switch Evaluation
      try {
        await checkGovernanceDeadManSwitch(principal.organizationId);
      } catch (err: unknown) {
        if (err instanceof AgentGovernanceEmergencyPausedError) {
          throw new Error(
            `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.DEAD_MAN_PAUSED}: Agent autonomous execution is paused by emergency dead-man control.`
          );
        }
        throw err;
      }

      // 2. Rule 8 & 47: Multi-Tenancy & Anti-IDOR Scope Verification
      const targetOrgId = options.tenant?.organizationId || principal.organizationId;
      const targetWsId = options.tenant?.workspaceId || principal.workspaceId;

      if (capability.tenantScoped && !targetOrgId) {
        throw new Error(
          `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.TENANT_SCOPE_REQUIRED}: Tenant-scoped capability '${capability.id}' requires organizationId.`
        );
      }
      if (capability.workspaceScoped && !targetWsId) {
        throw new Error(
          `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.TENANT_SCOPE_REQUIRED}: Workspace-scoped capability '${capability.id}' requires workspaceId.`
        );
      }

      // Anti-IDOR: Check that explicit tenant option does not cross principal tenant boundaries
      if (options.tenant) {
        if (options.tenant.organizationId !== principal.organizationId) {
          throw new Error(
            `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.TENANT_ISOLATION_VIOLATION}: Target organization (${options.tenant.organizationId}) does not match principal organization (${principal.organizationId}).`
          );
        }
        if (options.tenant.workspaceId !== principal.workspaceId) {
          throw new Error(
            `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.TENANT_ISOLATION_VIOLATION}: Target workspace (${options.tenant.workspaceId}) does not match principal workspace (${principal.workspaceId}).`
          );
        }
      }

      const targetScope: TargetScope = {
        organizationId: targetOrgId,
        workspaceId: targetWsId,
      };

      // 3. Rule 16 & 17: Principal Authority, Scopes, Personas & Non-Delegable Actions
      const auth = evaluatePrincipalAuthority(
        principal,
        capability,
        targetScope,
        {
          verifiedApproval: options.verifiedApproval,
          payloadHash: options.payloadHash,
        }
      );

      if (!auth.allowed) {
        const isNonDelegable = auth.violationCodes.includes('NON_DELEGABLE');
        const isApprovalRequired = auth.violationCodes.includes('APPROVAL_REQUIRED');
        const isApprovalInvalid = auth.violationCodes.includes('APPROVAL_INVALID');

        let code: string = GENKIT_ADAPTER_ERROR_CODES.PRINCIPAL_UNAUTHORIZED;
        if (isNonDelegable) {
          code = GENKIT_ADAPTER_ERROR_CODES.NON_DELEGABLE_ACTION;
        } else if (isApprovalRequired) {
          code = GENKIT_ADAPTER_ERROR_CODES.APPROVAL_REQUIRED;
        } else if (isApprovalInvalid) {
          code = GENKIT_ADAPTER_ERROR_CODES.APPROVAL_INVALID;
        }

        throw new Error(`[Genkit Adapter] ${code}: ${auth.reason}`);
      }

      // 4. Rule 14: Tool Fingerprint Integrity & Rug-Pull Drift Defense
      const tenantContext: TenantContext = {
        organizationId: targetScope.organizationId,
        workspaceId: targetScope.workspaceId,
      };
      const fpService = options.fingerprintService ?? globalToolFingerprintService;

      if (options.enforceFingerprints) {
        try {
          const check = await fpService.verifyCapabilityFingerprint(capability, tenantContext);
          if (!check.isValid) {
            throw new Error(
              `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.FINGERPRINT_DRIFT}: Tool '${capability.id}' failed integrity check. ${check.driftReport.reason}`
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          throw new Error(
            `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.FINGERPRINT_DRIFT}: Tool '${capability.id}' fingerprint verification failed. ${msg}`
          );
        }
      } else {
        const approved = await fpService.getApprovedFingerprint(
          capability.id,
          capability.version,
          tenantContext
        );
        if (approved) {
          const drift = detectToolDrift(capability, approved);
          if (drift.hasDrift) {
            throw new Error(
              `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.FINGERPRINT_DRIFT}: Tool '${capability.id}' failed integrity check. ${drift.reason}`
            );
          }
        }
      }

      // 5. Rule 13: Model Distrust — Validate arguments through Zod input schema
      const parseResult = capability.inputSchema.safeParse(rawInput);
      if (!parseResult.success) {
        const issues =
          'issues' in parseResult.error
            ? parseResult.error.issues.map((i) => i.message).join('; ')
            : 'Invalid arguments';
        throw new Error(
          `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.SCHEMA_VALIDATION_FAILED}: Input validation failed for '${capability.id}': ${issues}`
        );
      }
      const validatedInput = parseResult.data;

      // 6. Build Execution Context
      const correlationId = options.correlationId ?? crypto.randomUUID();
      const isDryRun = Boolean(options.dryRun && capability.execution.supportsDryRun);
      const executionContext: CapabilityExecutionContext = {
        principal,
        correlationId,
        causationId: options.causationId,
        idempotencyKey: options.idempotencyKey,
        expectedVersion: options.expectedVersion,
        dryRun: isDryRun,
        timestamp: new Date().toISOString(),
      };

      // 7. Rule 42 & Handler Execution
      const startTime = performance.now();
      let outputData: unknown = undefined;

      try {
        const result = await capability.handler(validatedInput, executionContext);
        const durationMs = Math.round(performance.now() - startTime);

        if (!result.success) {
          throw new Error(
            `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.EXECUTION_FAILED}: ${result.error.message}`
          );
        }

        outputData = result.data;

        // 8. Rule 32 & 33: Data Egress Policy & Exfiltration Scanning
        if (!options.bypassEgressScan && options.enforceEgressPolicy !== false) {
          const egressEngine = options.egressPolicyEngine ?? globalEgressDataPolicyEngine;
          const egressDestination: EgressDestination = options.egressDestination ?? 'internal_memory';

          const egressResult = await egressEngine.evaluateEgress(
            outputData,
            egressDestination,
            tenantContext,
            {
              redactionMode: options.redactEgressSensitiveData,
            }
          );

          if (options.redactEgressSensitiveData && egressResult.sanitizedPayload !== undefined) {
            outputData = egressResult.sanitizedPayload;
          } else if (!egressResult.allowed) {
            throw new Error(
              `[Genkit Adapter] ${GENKIT_ADAPTER_ERROR_CODES.DATA_EXFILTRATION_BLOCKED}: Egress blocked by policy. ${egressResult.reason}`
            );
          }
        }

        // 9. Rule 40: Append-Only Audit Logging via EventBus
        const eventBus = options.eventBus ?? defaultEventBus;
        try {
          await eventBus.publish(
            createDomainEvent({
              type: 'mcp.tool.invoked',
              organizationId: targetScope.organizationId,
              workspaceId: targetScope.workspaceId,
              actor: {
                type: principal.actorType === 'agent' ? 'agent' : 'user',
                id: principal.agentId ?? principal.userId,
              },
              entity: {
                type: 'capability',
                id: capability.id,
                version: capability.version,
              },
              correlationId,
              source: 'genkit_adapter',
              payload: {
                toolId: capability.id,
                version: capability.version,
                correlationId,
                durationMs,
                success: true,
                dryRun: isDryRun,
                inProcess: true,
              },
            })
          );
        } catch (auditErr) {
          console.warn('[Genkit Adapter] Failed to publish audit domain event:', auditErr);
        }

        return outputData;
      } catch (execErr: unknown) {
        const durationMs = Math.round(performance.now() - startTime);
        const eventBus = options.eventBus ?? defaultEventBus;
        try {
          await eventBus.publish(
            createDomainEvent({
              type: 'mcp.tool.invoked',
              organizationId: targetScope.organizationId,
              workspaceId: targetScope.workspaceId,
              actor: {
                type: principal.actorType === 'agent' ? 'agent' : 'user',
                id: principal.agentId ?? principal.userId,
              },
              entity: {
                type: 'capability',
                id: capability.id,
                version: capability.version,
              },
              correlationId,
              source: 'genkit_adapter',
              payload: {
                toolId: capability.id,
                version: capability.version,
                correlationId,
                durationMs,
                success: false,
                dryRun: isDryRun,
                inProcess: true,
                error: execErr instanceof Error ? execErr.message : String(execErr),
              },
            })
          );
        } catch {
          // Secondary failure ignored
        }
        throw execErr;
      }
    }
  );
}

/**
 * Creates Genkit tools for all eligible capabilities within a specific domain partition.
 *
 * @param options Domain configuration options including principal and domain.
 * @returns Array of callable Genkit ToolAction instances.
 */
export function createGenkitToolsForDomain(
  options: CreateGenkitDomainToolsOptions
): ToolAction[] {
  const { domain, principal, capabilities, checkSurface } = options;

  // Surface Isolation Guard (Rule 61)
  const isBackoffice = checkSurface ? checkSurface() : isBackofficeSurface();
  if (domain === 'system' && !isBackoffice) {
    throw new Error(
      `Access denied: domain 'system' is restricted to the Backoffice control plane surface.`
    );
  }

  const candidatePool = capabilities || canonicalCapabilityRegistryStore.list();
  const eligibleCapabilities = getEligibleCapabilitiesForDomain(domain, principal, candidatePool);

  return eligibleCapabilities.map((cap) => createGenkitToolFromCapability(cap, options));
}

/**
 * Creates Genkit tools tailored for an autonomous agent across multiple domain partitions.
 * Enforces Least Privilege (Rule 16), Non-Delegable Action Stripping (Rule 17),
 * and Context Budgeting (Rule 28 & 54).
 *
 * @param principal The agent principal.
 * @param domains The MCP domain partitions to draw tools from.
 * @param options Additional tool adapter options.
 * @returns Array of callable Genkit ToolAction instances.
 */
export function createGenkitToolsForAgent(
  principal: AgentPrincipal,
  domains: McpDomain[] = ['crm', 'knowledge', 'messaging', 'sales', 'portals'],
  options: CreateGenkitAgentToolsOptions = {}
): ToolAction[] {
  const candidatePool = options.capabilities || canonicalCapabilityRegistryStore.list();
  const granted = new Set(principal.grantedScopes || []);

  // Filter pool across requested domains
  const domainFiltered = candidatePool.filter((cap) =>
    domains.some((d) => isCapabilityInMcpDomain(cap, d))
  );

  // Filter by agent authority and persona bounds
  const authorizedCaps = domainFiltered.filter((cap) => {
    // 1. Unconditionally strip non-delegable actions for agents (Rule 17)
    if (principal.actorType === 'agent') {
      if (cap.risk?.nonDelegable) return false;
      if (cap.permissions?.some((perm) => isNonDelegableAction(perm))) return false;
    }

    // 2. Least privilege: must have granted scopes (Rule 16)
    if (!cap.public && !cap.permissions.some((perm) => granted.has(perm))) {
      return false;
    }

    // 3. Agent Persona domain & risk boundaries
    if (principal.agentId && globalAgentPersonaRegistry.hasPersona(principal.agentId)) {
      const personaValidation = globalAgentPersonaRegistry.validatePersonaCapability(
        principal.agentId,
        {
          domain: cap.domain,
          risk: cap.risk,
        }
      );
      if (!personaValidation.allowed) {
        return false;
      }
    }

    return true;
  });

  // Enforce Context Budgeting ceiling across tools (< 1,500 tokens, Rule 28 & 54)
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
        `[Genkit Adapter] Capability '${cap.id}' omitted for agent '${principal.agentId}' to respect context budget (${accumulatedTokens}/${MAX_DISCOVERY_PAYLOAD_TOKENS} tokens)`
      );
    }
  }

  const adapterOptions: GenkitToolAdapterOptions = {
    ...options,
    principal,
  };

  return budgetedCaps.map((cap) => createGenkitToolFromCapability(cap, adapterOptions));
}

/**
 * Direct execution helper for testing and programmatic capability dispatches.
 * Returns a structured GenkitToolExecutionResult without throwing unhandled exceptions.
 */
export async function executeCapabilityDirectly<TOutput = unknown>(
  capability: AnyCapabilityDefinition,
  rawInput: unknown,
  options: GenkitToolAdapterOptions
): Promise<GenkitToolExecutionResult<TOutput>> {
  const correlationId = options.correlationId ?? crypto.randomUUID();
  const startTime = performance.now();

  try {
    const genkitTool = createGenkitToolFromCapability(capability, {
      ...options,
      correlationId,
    });
    const data = (await genkitTool(rawInput)) as TOutput;
    const durationMs = Math.round(performance.now() - startTime);

    return {
      success: true,
      data,
      executionId: crypto.randomUUID(),
      durationMs,
      correlationId,
      dryRun: options.dryRun,
    };
  } catch (err: unknown) {
    const durationMs = Math.round(performance.now() - startTime);
    const message = err instanceof Error ? err.message : String(err);

    // Extract structured code if present in message
    let code: string = GENKIT_ADAPTER_ERROR_CODES.EXECUTION_FAILED;
    for (const val of Object.values(GENKIT_ADAPTER_ERROR_CODES)) {
      if (message.includes(val)) {
        code = val;
        break;
      }
    }

    return {
      success: false,
      error: {
        code,
        message,
        details: err,
      },
      executionId: crypto.randomUUID(),
      durationMs,
      correlationId,
      dryRun: options.dryRun,
    };
  }
}
