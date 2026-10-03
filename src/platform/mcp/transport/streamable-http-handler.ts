/**
 * @fileOverview Stateless Streamable HTTP Transport Engine (Phase 5 Milestone 2)
 *
 * Implements the MCP Spec 2026-07-28 stateless Streamable HTTP transport on Google Cloud Run.
 * Integrates:
 *   - Domain-Partitioned MCP Server Factory (`createDomainMcpServer`, Rule 16, 17, 28, 61)
 *   - Progressive Tool Discovery Caching with TTL & SHA-256 ETag Validation (`DiscoveryCacheManager`, Rule 35, 50)
 *   - Automated Audit Logging Sink (`defaultEventBus`, Rule 20, 21, 40)
 *   - Cloud Run 32MB payload ceiling & deprecated state rejection (Rule 9, 38)
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Operates statelessly: multi-round-trip requests carry `Mcp-Transaction-Id` and
 *   `X-SmartSapp-Correlation-Id` in standard headers (Cloud Run auto-scale safe).
 * - Enforces Cloud Run 32MB payload limit: checks content-length before body parsing,
 *   rejecting oversized payloads with HTTP 413 (Rule 9).
 * - Rejects legacy session stickiness and `Mcp-Session-Id` with HTTP 400 (Rule 38).
 * - Supports HTTP Conditional Validation (Rule 35): If `tools/list` matches `If-None-Match`,
 *   returns HTTP 304 Not Modified without payload re-serialization.
 * - Multi-Tenant Isolation (Rule 8, 50): Cache keys immutably bind tenant ID and role/scopes.
 * - Strict typing policy: Zero `any` or `any[]` (Rule 4).
 */

import { randomUUID } from 'node:crypto';
import { createMcpHandler, type McpHttpHandler } from '@modelcontextprotocol/server';
import { isBackofficeSurface } from '@/lib/platform/app-surface';
import {
  CLOUD_RUN_MAX_REQUEST_BODY_SIZE,
  MCP_TRANSPORT_ERROR_CODES,
  formatJsonRpcError,
  mapMcpErrorToHttpStatus,
  isDeprecatedMcpHeaderPresent,
  type McpDomain,
} from './transport-types';
import {
  createDomainMcpServer,
  getEligibleCapabilitiesForDomain,
} from '../servers/domain-mcp-factory';
import { canonicalCapabilityRegistryStore } from '../../capabilities/registry/capability-registry';
import { toolNameFor, type McpToolAuditEntry } from '../create-stateless-handler';
import { toMcpToolSchema } from '../to-mcp-tool-schema';
import { MAX_TOOL_DESCRIPTION_LENGTH } from '../servers/domain-server-types';
import {
  DiscoveryCacheManager,
  defaultDiscoveryCacheManager,
  buildDiscoveryCacheKey,
  computeDiscoveryETag,
  type DiscoveredToolItem,
} from '../discovery/discovery-cache-manager';
import { defaultEventBus } from '@/platform/events/event-bus';
import { createDomainEvent } from '@/platform/capabilities/events/domain-event';
import { z } from 'zod/v4';
import type {
  AgentPrincipal,
  AnyCapabilityDefinition,
} from '../../capabilities/contracts/capability-definition';

const JsonRpcPeekSchema = z.object({
  jsonrpc: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
});

export interface StreamableHttpHandlerOptions {
  version?: string;
  capabilities?: AnyCapabilityDefinition[];
  getCapabilitiesForDomain?: (domain: string) => AnyCapabilityDefinition[];
  allowedSurface?: 'client' | 'backoffice' | 'both';
  getPrincipal?: (req: Request) => Promise<AgentPrincipal | null> | AgentPrincipal | null;
  audit?: (entry: McpToolAuditEntry) => Promise<void> | void;
  discoveryCache?: DiscoveryCacheManager;
}

export interface StreamableRequestContext {
  domain: string;
  principal?: AgentPrincipal;
}

export class StreamableHttpHandler {
  private readonly options: StreamableHttpHandlerOptions;
  private readonly version: string;
  private readonly discoveryCache: DiscoveryCacheManager;

  constructor(options: StreamableHttpHandlerOptions = {}) {
    this.options = options;
    this.version = options.version || '2.0.0';
    this.discoveryCache = options.discoveryCache || defaultDiscoveryCacheManager;
  }

  async handleRequest(req: Request, context: StreamableRequestContext): Promise<Response> {
    // 1. Correlation & Transaction Identifiers (Rules 11, 20, 39)
    const correlationId =
      req.headers.get('x-smartsapp-correlation-id') ||
      req.headers.get('X-SmartSapp-Correlation-Id') ||
      randomUUID();

    const transactionId =
      req.headers.get('mcp-transaction-id') ||
      req.headers.get('Mcp-Transaction-Id') ||
      randomUUID();

    const traceparent = req.headers.get('traceparent') || undefined;

    // Helper to format JSON-RPC error responses with required headers
    const makeErrorResponse = (
      code: number,
      message: string,
      errorCode: (typeof MCP_TRANSPORT_ERROR_CODES)[keyof typeof MCP_TRANSPORT_ERROR_CODES]
    ): Response => {
      const httpStatus = mapMcpErrorToHttpStatus(errorCode);
      const errorPayload = formatJsonRpcError(code, message, { code: errorCode, correlationId });
      return new Response(JSON.stringify(errorPayload), {
        status: httpStatus,
        headers: {
          'content-type': 'application/json',
          'mcp-transaction-id': transactionId,
          'x-smartsapp-correlation-id': correlationId,
          ...(traceparent ? { traceparent } : {}),
        },
      });
    };

    // 2. Reject Banned Legacy Features (Rule 38)
    const headerEntries = Object.fromEntries(req.headers.entries());
    if (isDeprecatedMcpHeaderPresent(headerEntries)) {
      return makeErrorResponse(
        -32000,
        'Deprecated MCP feature rejected: Mcp-Session-Id and sticky SSE sessions are not permitted in stateless MCP (Rule 38).',
        MCP_TRANSPORT_ERROR_CODES.DEPRECATED_FEATURE_REJECTED
      );
    }

    // 3. Enforce Cloud Run 32MB Payload Ceiling (Rule 9)
    const contentLengthStr = req.headers.get('content-length');
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (!Number.isNaN(contentLength) && contentLength > CLOUD_RUN_MAX_REQUEST_BODY_SIZE) {
        return makeErrorResponse(
          -32000,
          `Payload too large: request size (${contentLength} bytes) exceeds Cloud Run 32MB ceiling (${CLOUD_RUN_MAX_REQUEST_BODY_SIZE} bytes).`,
          MCP_TRANSPORT_ERROR_CODES.PAYLOAD_TOO_LARGE
        );
      }
    }

    // 4. Safely inspect JSON-RPC method for discovery optimization (Rule 4: Zero any)
    let jsonRpcMethod: string | null = null;

    try {
      const cloned = req.clone();
      const text = await cloned.text();
      if (text) {
        const parsed: unknown = JSON.parse(text);
        const peekResult = JsonRpcPeekSchema.safeParse(parsed);
        if (peekResult.success) {
          jsonRpcMethod = peekResult.data.method ?? null;
        }
      }
    } catch {
      // Non-JSON or empty payload: let the downstream SDK handler process or reject
    }

    // 5. Resolve Effective Principal (Rule 16)
    const effectivePrincipal: AgentPrincipal =
      context.principal ??
      (await this.options.getPrincipal?.(req)) ?? {
        actorType: 'user',
        userId: 'anonymous',
        organizationId: 'default',
        workspaceId: 'default',
        effectiveRole: 'guest',
        grantedScopes: [],
      };

    const domain = context.domain as McpDomain;
    const isToolsList = jsonRpcMethod === 'tools/list';
    const clientIfNoneMatch = req.headers.get('if-none-match');

    // 6. Resolve Domain Capabilities
    let capabilities = this.options.capabilities;
    if (!capabilities && this.options.getCapabilitiesForDomain) {
      capabilities = this.options.getCapabilitiesForDomain(context.domain);
    }

    // 7. Progressive Tool Discovery Caching & Conditional ETag Validation (Rule 35 & 50)
    let discoveryEtag: string | null = null;

    if (isToolsList) {
      const cacheKey = buildDiscoveryCacheKey({
        organizationId: effectivePrincipal.organizationId,
        workspaceId: effectivePrincipal.workspaceId || 'default',
        domain,
        effectiveRole: effectivePrincipal.effectiveRole || 'agent',
        grantedScopes: effectivePrincipal.grantedScopes || [],
      });

      const lookup = this.discoveryCache.get(cacheKey, clientIfNoneMatch);

      // Conditional Match -> Return HTTP 304 Not Modified immediately (Rule 35)
      if (lookup.hit && lookup.notModified) {
        return new Response(null, {
          status: 304,
          headers: {
            etag: clientIfNoneMatch!,
            'mcp-transaction-id': transactionId,
            'x-smartsapp-correlation-id': correlationId,
            ...(traceparent ? { traceparent } : {}),
          },
        });
      }

      if (lookup.hit && lookup.entry) {
        discoveryEtag = lookup.entry.etag;
      } else {
        // Cache miss: compute tools and deterministic ETag from eligible capabilities
        const candidatePool = capabilities || canonicalCapabilityRegistryStore.list();
        const eligible = getEligibleCapabilitiesForDomain(domain, effectivePrincipal, candidatePool);
        const tools: DiscoveredToolItem[] = eligible.map((cap) => ({
          name: toolNameFor(cap.id),
          description: cap.description.slice(0, MAX_TOOL_DESCRIPTION_LENGTH),
          inputSchema: toMcpToolSchema(cap.inputSchema),
        }));
        discoveryEtag = computeDiscoveryETag(tools);

        // Populate discovery cache (Rule 35 & 50)
        this.discoveryCache.set({
          cacheKey,
          domain,
          organizationId: effectivePrincipal.organizationId,
          workspaceId: effectivePrincipal.workspaceId || 'default',
          effectiveRole: effectivePrincipal.effectiveRole || 'agent',
          scopesHash: discoveryEtag.slice(0, 16),
          etag: discoveryEtag,
          payload: { tools },
        });
      }
    }

    // 8. Safe Production Audit Sink (Rule 20, 21, 40)
    const effectiveAuditSink = async (entry: McpToolAuditEntry) => {
      // Invoke custom audit sink if configured
      if (this.options.audit) {
        try {
          await this.options.audit(entry);
        } catch (auditErr) {
          console.warn('[MCP Transport] Custom audit sink threw error:', auditErr);
        }
      }

      // Publish typed platform domain event (Rule 40)
      try {
        await defaultEventBus.publish(
          createDomainEvent({
            type: `mcp.tool.${entry.outcome}`,
            source: 'mcp-transport',
            organizationId: entry.organizationId || 'system',
            workspaceId: entry.workspaceId ?? null,
            actor: {
              type: entry.userId ? 'user' : 'agent',
              id: entry.userId || entry.agentId || 'system',
            },
            entity: { type: 'mcp_tool', id: entry.toolName },
            payload: {
              toolName: entry.toolName,
              capabilityId: entry.capabilityId,
              capabilityVersion: entry.capabilityVersion,
              decision: entry.decision,
              outcome: entry.outcome,
              code: entry.code,
            },
            correlationId: entry.correlationId || randomUUID(),
          })
        );
      } catch (eventErr) {
        console.warn('[MCP Transport] Non-blocking audit publication error:', eventErr);
      }
    };

    // 9. Build Domain McpServer via Factory (Phase 5 Milestone 2 Task 2)
    const server = createDomainMcpServer({
      domain,
      principal: effectivePrincipal,
      capabilities,
      auditSink: effectiveAuditSink,
      checkSurface: () => {
        if (this.options.allowedSurface === 'backoffice') return true;
        if (this.options.allowedSurface === 'client') return false;
        return isBackofficeSurface();
      },
    });

    // 10. Normalize Client Accept Header for Streamable HTTP
    // The MCP SDK requires both application/json and text/event-stream in Accept.
    let effectiveRequest = req;
    const acceptHeader = req.headers.get('accept') || '';
    if (!acceptHeader.includes('text/event-stream')) {
      const normalizedHeaders = new Headers(req.headers);
      normalizedHeaders.set('accept', 'application/json, text/event-stream');
      effectiveRequest = new Request(req.url, {
        method: req.method,
        headers: normalizedHeaders,
        body: req.body,
        // @ts-expect-error duplex is a valid Web Standard option in Node / modern Next.js
        duplex: 'half',
      });
    }

    // 11. Dispatch through MCP SDK v2 Handler
    const mcpHandler: McpHttpHandler = createMcpHandler(() => server, {
      legacy: 'stateless',
    });

    try {
      const response = await mcpHandler.fetch(effectiveRequest);

      // 12. Attach Transaction, Correlation, Tracing & ETag Headers to Response
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('mcp-transaction-id', transactionId);
      responseHeaders.set('x-smartsapp-correlation-id', correlationId);
      if (traceparent) {
        responseHeaders.set('traceparent', traceparent);
      }
      if (discoveryEtag) {
        responseHeaders.set('etag', discoveryEtag);
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal MCP handler exception.';
      console.error(`[MCP Transport] Handler error (correlationId=${correlationId}):`, err);
      return makeErrorResponse(
        -32603,
        `Internal MCP error: ${message}`,
        MCP_TRANSPORT_ERROR_CODES.INTERNAL_ERROR
      );
    }
  }
}

export function createStreamableHttpHandler(
  options: StreamableHttpHandlerOptions = {}
): StreamableHttpHandler {
  return new StreamableHttpHandler(options);
}
