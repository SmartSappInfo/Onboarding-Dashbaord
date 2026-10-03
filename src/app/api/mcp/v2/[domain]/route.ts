/**
 * @fileOverview Next.js App Router Dynamic MCP Endpoint: POST /api/mcp/v2/[domain] (Phase 5 Milestone 1)
 *
 * Exposes stateless Streamable HTTP endpoints for each domain:
 *   - POST /api/mcp/v2/crm
 *   - POST /api/mcp/v2/knowledge
 *   - POST /api/mcp/v2/messaging
 *   - POST /api/mcp/v2/sales
 *   - POST /api/mcp/v2/portals
 *   - POST /api/mcp/v2/system
 *
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS:
 * - Next.js 15: `params` is a Promise and must be awaited.
 * - Enforces Surface Isolation (Rule 61): domains requiring backoffice control plane (e.g. system)
 *   are rejected on the client surface with HTTP 403.
 * - Authenticates callers via `authenticateMcpRequest` (Rule 8, 16, 47 Anti-IDOR).
 * - Delegates transport execution to `StreamableHttpHandler` (Spec 2026-07-28).
 * - Strictly typed: Zero `any` or `any[]` (Rule 4).
 */

import { randomUUID } from 'node:crypto';
import { isBackofficeSurface } from '@/lib/platform/app-surface';
import {
  McpDomainSchema,
  MCP_TRANSPORT_ERROR_CODES,
  formatJsonRpcError,
  mapMcpErrorToHttpStatus,
} from '@/platform/mcp/transport/transport-types';
import { createStreamableHttpHandler } from '@/platform/mcp/transport/streamable-http-handler';
import { authenticateMcpRequest } from '@/platform/mcp/auth/mcp-auth-gateway';
import { ensureCapabilitiesRegistered } from '@/platform/capabilities/registry/register-capabilities';
import { listCapabilitiesByDomain } from '@/platform/capabilities/registry/capability-registry';

// Shared Streamable HTTP Transport Handler
const streamableHandler = createStreamableHttpHandler({
  version: '2.0.0',
  getCapabilitiesForDomain: (domain: string) => {
    ensureCapabilitiesRegistered();
    return listCapabilitiesByDomain(domain);
  },
});

export interface RouteContext {
  params: Promise<{ domain: string }> | { domain: string };
}

/**
 * Handles CORS Preflight for web-based MCP clients (e.g. Cursor, Claude Desktop, dev tools).
 */
export async function OPTIONS(_req: Request): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers':
        'authorization, content-type, accept, mcp-transaction-id, x-smartsapp-correlation-id, if-none-match, traceparent, tracestate',
      'access-control-expose-headers':
        'etag, mcp-transaction-id, x-smartsapp-correlation-id',
      'access-control-max-age': '86400',
    },
  });
}

/**
 * Handles MCP 2026-07-28 Streamable HTTP POST requests.
 */
export async function POST(req: Request, context: RouteContext): Promise<Response> {
  const correlationId =
    req.headers.get('x-smartsapp-correlation-id') ||
    req.headers.get('X-SmartSapp-Correlation-Id') ||
    randomUUID();

  const transactionId =
    req.headers.get('mcp-transaction-id') ||
    req.headers.get('Mcp-Transaction-Id') ||
    randomUUID();

  // 1. Resolve and validate domain parameter
  const resolvedParams = await context.params;
  const domainParse = McpDomainSchema.safeParse(resolvedParams.domain);

  if (!domainParse.success) {
    const errorPayload = formatJsonRpcError(
      -32601,
      `Unsupported MCP domain '${resolvedParams.domain}'. Supported domains: crm, knowledge, messaging, sales, portals, system.`,
      { code: MCP_TRANSPORT_ERROR_CODES.INVALID_DOMAIN, correlationId }
    );
    return new Response(JSON.stringify(errorPayload), {
      status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.INVALID_DOMAIN),
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  const domain = domainParse.data;

  // 2. Surface Isolation Check (Rule 61)
  if (domain === 'system' && !isBackofficeSurface()) {
    const errorPayload = formatJsonRpcError(
      -32000,
      `Access denied: domain 'system' is restricted to the Backoffice control plane surface.`,
      { code: MCP_TRANSPORT_ERROR_CODES.SURFACE_RESTRICTED, correlationId }
    );
    return new Response(JSON.stringify(errorPayload), {
      status: mapMcpErrorToHttpStatus(MCP_TRANSPORT_ERROR_CODES.SURFACE_RESTRICTED),
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  // 3. Multi-Tenant Ingress Authentication Gate (Rule 8, 16, 47 Anti-IDOR, Rule 60 Dead-Man)
  const authResult = await authenticateMcpRequest(req);

  if (!authResult.success) {
    const errorPayload = formatJsonRpcError(
      -32000,
      authResult.errorMessage,
      { code: authResult.errorCode, correlationId }
    );
    return new Response(JSON.stringify(errorPayload), {
      status: authResult.status,
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  // 4. Dispatch to Stateless Streamable HTTP Transport Engine
  return streamableHandler.handleRequest(req, {
    domain,
    principal: authResult.principal,
  });
}
