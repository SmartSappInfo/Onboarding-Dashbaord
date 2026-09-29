/**
 * @fileOverview Cloud Run Stateless MCP Server Builder (Phase 0 / Phase 5)
 *
 * Binds canonical capabilities to an MCP SDK v2 `McpServer` for one domain. Every tool call runs:
 *   authenticate → validate input → tenant binding → authorize → execute (parsed data only)
 *   → validate output → audit.
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - There is NO anonymous fallback. `getPrincipal` must resolve the authenticated caller from the
 *   request (MCP OAuth / Firebase token); returning null denies the call.
 * - Tenant scope comes from the authenticated principal, never from tool arguments. Arguments that
 *   name another organization/workspace are refused (tools §1: agents must not pick their tenant).
 * - Errors returned to the model are generic; details go to server logs (Rule 48 / audit F9).
 * - Capabilities flagged `auditRequired` cannot be exposed without an audit sink (fail at build time).
 * - Transport wiring (`createMcpHandler`, Streamable HTTP route) is Phase 5; this module only builds
 *   the server and the per-tool handlers.
 */

import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/server';
import { isBackofficeSurface } from '@/lib/platform/app-surface';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
  CapabilityExecutionContext,
} from '../capabilities/contracts/capability-definition';
import { sha256Hex } from '../capabilities/contracts/canonical-json';
import { evaluatePrincipalAuthority } from '../capabilities/policy/principal-evaluator';
import { findTenantMismatch } from '../tasks/agent-step-contract';
import { toMcpToolSchema } from './to-mcp-tool-schema';

export interface McpToolAuditEntry {
  toolName: string;
  capabilityId: string;
  capabilityVersion: string;
  userId: string | null;
  agentId?: string;
  organizationId: string | null;
  workspaceId: string | null;
  decision: 'allowed' | 'denied';
  outcome: 'succeeded' | 'failed' | 'denied';
  code?: string;
  correlationId: string;
  timestamp: string;
}

export interface CreateStatelessMcpOptions {
  domain: string;
  version: string;
  capabilities: AnyCapabilityDefinition[];
  /** Defaults to 'both'. 'client' refuses to build on the backoffice surface and vice versa (Rule 61). */
  allowedSurface?: 'client' | 'backoffice' | 'both';
  /** Resolves the authenticated caller for each tool call. null = unauthenticated = denied. */
  getPrincipal: () => Promise<AgentPrincipal | null> | AgentPrincipal | null;
  /** Required when any capability has `policies.auditRequired`. Must not throw on success paths. */
  audit?: (entry: McpToolAuditEntry) => Promise<void> | void;
}

export interface McpToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

const MAX_REPORTED_ISSUES = 5;

function textResult(text: string, isError = false): McpToolResult {
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toolNameFor(capabilityId: string): string {
  return capabilityId.replace(/\./g, '_');
}

/**
 * Builds the per-call handler for one capability. Exported for direct unit testing so tests do
 * not depend on SDK internals.
 */
export function createCapabilityToolHandler(
  cap: AnyCapabilityDefinition,
  options: Pick<CreateStatelessMcpOptions, 'getPrincipal' | 'audit'>
): (args: unknown) => Promise<McpToolResult> {
  const toolName = toolNameFor(cap.id);

  return async (args: unknown): Promise<McpToolResult> => {
    const correlationId = randomUUID();
    const timestamp = new Date().toISOString();

    const record = async (
      principal: AgentPrincipal | null,
      decision: McpToolAuditEntry['decision'],
      outcome: McpToolAuditEntry['outcome'],
      code?: string
    ): Promise<void> => {
      if (!options.audit) return;
      await options.audit({
        toolName,
        capabilityId: cap.id,
        capabilityVersion: cap.version,
        userId: principal?.userId ?? null,
        agentId: principal?.agentId,
        organizationId: principal?.organizationId ?? null,
        workspaceId: principal?.workspaceId ?? null,
        decision,
        outcome,
        code,
        correlationId,
        timestamp,
      });
    };

    // 1. Authenticate — no anonymous fallback
    const resolved = await options.getPrincipal();
    if (!resolved) {
      await record(null, 'denied', 'denied', 'UNAUTHENTICATED');
      return textResult('Access denied: authentication required.', true);
    }
    // MCP callers are never interactive humans, even when they authenticate with a user's token:
    // force agent rules (approvals, non-delegable, no wildcard) regardless of what was resolved.
    const principal: AgentPrincipal = { ...resolved, actorType: 'agent' };

    // 2. Validate input; the handler only ever receives parsed data (Rule 31)
    const parsed = cap.inputSchema.safeParse(args);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .slice(0, MAX_REPORTED_ISSUES)
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      await record(principal, 'denied', 'denied', 'INVALID_INPUT');
      return textResult(`Invalid input: ${issues}`, true);
    }
    const input: unknown = parsed.data;

    // 3. Tenant binding: arguments may not point at another tenant than the caller's
    const tenantMismatch = isPlainRecord(input) ? findTenantMismatch(input, principal) : null;
    if (tenantMismatch) {
      await record(principal, 'denied', 'denied', 'TENANT_SCOPE_VIOLATION');
      return textResult('Access denied: the request targets a different organization or workspace.', true);
    }

    // 4. Authorize against the caller's authenticated tenant
    const authority = evaluatePrincipalAuthority(principal, cap, {
      organizationId: principal.organizationId,
      workspaceId: principal.workspaceId,
    });
    if (!authority.allowed) {
      await record(principal, 'denied', 'denied', 'AUTHORIZATION_DENIED');
      return textResult(`Access denied: ${authority.reason ?? 'not authorized to invoke this capability.'}`, true);
    }

    // 5. Idempotency (Rule 19): identical calls by the same caller share a deterministic key,
    //    so a client retry after a lost response cannot duplicate side effects.
    const idempotencyKey = cap.policies.requiresIdempotencyKey
      ? `mcp:${sha256Hex([principal.organizationId, principal.workspaceId, principal.userId, principal.agentId ?? '', cap.id, cap.version, input])}`
      : undefined;

    const context: CapabilityExecutionContext = {
      principal,
      correlationId,
      idempotencyKey,
      timestamp,
    };

    // 6. Execute
    let result;
    try {
      result = await cap.handler(input, context);
    } catch (err: unknown) {
      console.error(`[MCP] Capability '${cap.id}' threw (correlationId=${correlationId}):`, err);
      await record(principal, 'allowed', 'failed', 'HANDLER_EXCEPTION');
      return textResult(`Capability failed unexpectedly. Reference: ${correlationId}`, true);
    }

    if (!result.success) {
      await record(principal, 'allowed', 'failed', result.error.code);
      return textResult(`Error [${result.error.code}]: ${result.error.message}`, true);
    }

    // 7. Output validation (Rule 48: never trust the tool either)
    if (!cap.outputSchema.safeParse(result.data).success) {
      console.error(`[MCP] Capability '${cap.id}' returned output that failed its schema (correlationId=${correlationId}).`);
      await record(principal, 'allowed', 'failed', 'INVALID_OUTPUT');
      return textResult(`Capability returned an invalid result. Reference: ${correlationId}`, true);
    }

    await record(principal, 'allowed', 'succeeded');
    return textResult(typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2));
  };
}

/**
 * Creates an McpServer bound to the given canonical capabilities.
 */
export function buildDomainMcpServer(options: CreateStatelessMcpOptions): McpServer {
  const surface = options.allowedSurface ?? 'both';
  const onBackoffice = isBackofficeSurface();

  // Surface isolation (Rule 61)
  if (surface === 'backoffice' && !onBackoffice) {
    throw new Error(`MCP domain '${options.domain}' is restricted to the Backoffice control plane.`);
  }
  if (surface === 'client' && onBackoffice) {
    throw new Error(`MCP domain '${options.domain}' is restricted to the client surface.`);
  }

  // Fail closed: never expose an audit-required capability without somewhere to write the audit.
  const unaudited = options.capabilities.filter((cap) => cap.policies.auditRequired);
  if (unaudited.length > 0 && !options.audit) {
    throw new Error(
      `MCP domain '${options.domain}' exposes audit-required capabilities (${unaudited.map((c) => c.id).join(', ')}) but no audit sink was provided.`
    );
  }

  const server = new McpServer({
    name: `smartsapp-${options.domain}-mcp`,
    version: options.version,
  });

  for (const cap of options.capabilities) {
    const handler = createCapabilityToolHandler(cap, options);
    server.registerTool(
      toolNameFor(cap.id),
      {
        description: cap.description,
        inputSchema: toMcpToolSchema(cap.inputSchema),
      },
      (args) => handler(args)
    );
  }

  return server;
}
