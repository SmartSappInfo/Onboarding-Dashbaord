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
} from '../capabilities/contracts/capability-definition';
import { sha256Hex } from '../capabilities/contracts/canonical-json';
import { executeCapability } from '../capabilities/execution/execute-capability';
import type { CapabilityInvocation } from '../capabilities/execution/invocation';
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

function textResult(text: string, isError = false): McpToolResult {
  return isError ? { content: [{ type: 'text', text }], isError: true } : { content: [{ type: 'text', text }] };
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

    // 2. Derive deterministic idempotency key for tools requiring one (Rule 19)
    // Pre-calculate parsed input for deterministic key hash if possible
    let idempotencyKey: string | undefined;
    if (cap.policies.requiresIdempotencyKey) {
      const parsedCandidate = cap.inputSchema.safeParse(args);
      const inputForHash = parsedCandidate.success ? parsedCandidate.data : args;
      idempotencyKey = `mcp:${sha256Hex([
        principal.organizationId,
        principal.workspaceId,
        principal.userId,
        principal.agentId ?? '',
        cap.id,
        cap.version,
        inputForHash,
      ])}`;
    }

    // 3. Delegate to Canonical Execution Gateway (PR-4 / Rule 69)
    const invocation: CapabilityInvocation = {
      capabilityId: cap.id,
      version: cap.version,
      surface: 'mcp',
      input: args,
      principal,
      idempotencyKey,
      correlationId,
    };

    const outcome = await executeCapability(invocation, {
      registryLookup: (id) => (id === cap.id ? cap : undefined),
    });

    if (outcome.success) {
      await record(principal, 'allowed', 'succeeded');
      return textResult(typeof outcome.data === 'string' ? outcome.data : JSON.stringify(outcome.data, null, 2));
    }

    // 4. Handle refusal or failure
    const isDenied =
      outcome.error.code === 'UNAUTHENTICATED' ||
      outcome.error.code === 'AUTHORIZATION_DENIED' ||
      outcome.error.code === 'APPROVAL_REQUIRED' ||
      outcome.error.code === 'TENANT_SCOPE_VIOLATION' ||
      outcome.error.code === 'INVALID_INPUT';

    await record(
      outcome.error.code === 'UNAUTHENTICATED' ? null : principal,
      isDenied ? 'denied' : 'allowed',
      isDenied ? 'denied' : 'failed',
      outcome.error.code
    );

    let text: string;
    if (outcome.error.code === 'UNAUTHENTICATED') {
      text = 'Access denied: authentication required.';
    } else if (outcome.error.code === 'TENANT_SCOPE_VIOLATION') {
      text = 'Access denied: the request targets a different organization or workspace.';
    } else if (outcome.error.code === 'AUTHORIZATION_DENIED' || outcome.error.code === 'APPROVAL_REQUIRED') {
      text = `Access denied: ${outcome.error.message}`;
    } else if (outcome.error.code === 'INVALID_INPUT') {
      text = outcome.error.message;
    } else if (outcome.error.code === 'INVALID_OUTPUT') {
      console.error(`[MCP] Capability '${cap.id}' returned output that failed its schema (correlationId=${correlationId}).`);
      text = `Capability returned an invalid result. Reference: ${correlationId}`;
    } else if (outcome.error.code === 'HANDLER_EXCEPTION' || outcome.error.code === 'TIMEOUT') {
      text = `Capability failed unexpectedly. Reference: ${correlationId}`;
    } else {
      text = `Error [${outcome.error.code}]: ${outcome.error.message}`;
    }

    return textResult(text, true);
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
