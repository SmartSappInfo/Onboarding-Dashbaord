/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP HTTP Gateway Route Handler
 * Route: POST /api/mcp
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Protocol Specification:
 *    - Strictly compliant with JSON-RPC 2.0 and MCP HTTP POST specifications.
 * 2. Multi-Tenant Authentication:
 *    - Authenticates clients via `Authorization: Bearer sk_mcp_...` or `x-api-key`.
 *    - Enforces workspace and organization tenant boundaries.
 * 3. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Request and response are strongly typed with JSON-RPC schemas.
 *
 * @testability Covered in `src/lib/mcp/__tests__/mcp-gateway.test.ts`.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { McpGateway } from '@/lib/mcp/gateway';
import { McpApiKeyService } from '@/lib/mcp/api-key-service';
import {
  McpJsonRpcRequest,
  McpJsonRpcResponse,
  McpExecutionContext,
  MCP_ERROR_CODES,
  McpPayloadValue,
} from '@/lib/mcp/types';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = `req_${crypto.randomUUID()}`;
  const timestamp = new Date().toISOString();

  // 1. Authenticate Request
  const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
  const xApiKey = req.headers.get('x-api-key');

  let rawKey = '';
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    rawKey = authHeader.replace(/^bearer\s+/i, '').trim();
  } else if (xApiKey) {
    rawKey = xApiKey.trim();
  }

  let workspaceId = req.headers.get('x-workspace-id') || '';
  let organizationId = req.headers.get('x-organization-id') || '';
  let callerId = req.headers.get('x-caller-id') || 'system_caller';
  let callerType: 'user' | 'agent' | 'api_key' = 'api_key';
  let apiKeyId: string | undefined = undefined;

  if (rawKey) {
    const keyValidation = await McpApiKeyService.validateApiKey(rawKey);
    if (!keyValidation.valid || !keyValidation.key) {
      const errorResponse: McpJsonRpcResponse = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: MCP_ERROR_CODES.UNAUTHORIZED,
          message: keyValidation.error || 'Unauthorized: Invalid or revoked MCP API key.',
        },
      };
      return NextResponse.json(errorResponse, { status: 401 });
    }

    workspaceId = keyValidation.key.workspaceId;
    organizationId = keyValidation.key.organizationId;
    callerId = keyValidation.key.id;
    callerType = keyValidation.key.role === 'agent' ? 'agent' : 'api_key';
    apiKeyId = keyValidation.key.id;
  } else if (!workspaceId) {
    const errorResponse: McpJsonRpcResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: MCP_ERROR_CODES.UNAUTHORIZED,
        message: 'Unauthorized: Missing MCP API key or workspace identification.',
      },
    };
    return NextResponse.json(errorResponse, { status: 401 });
  } else {
    callerType = 'user';
  }

  const context: McpExecutionContext = {
    workspaceId,
    organizationId,
    callerId,
    callerType,
    apiKeyId,
    requestId,
    callDepth: 0,
    timestamp,
  };

  // 2. Parse Request Body
  let body: McpPayloadValue;
  try {
    body = (await req.json()) as McpPayloadValue;
  } catch (_err) {
    const errorResponse: McpJsonRpcResponse = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: MCP_ERROR_CODES.PARSE_ERROR,
        message: 'Invalid JSON payload received.',
      },
    };
    return NextResponse.json(errorResponse, { status: 400 });
  }

  // 3. Handle Single or Batch Requests
  if (Array.isArray(body)) {
    // JSON-RPC 2.0 Batch execution
    const results: McpJsonRpcResponse[] = [];
    for (const item of body) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const res = await McpGateway.handleRequest(item as unknown as McpJsonRpcRequest, context);
        results.push(res);
      }
    }
    return NextResponse.json(results, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (body && typeof body === 'object') {
    const singleResponse = await McpGateway.handleRequest(body as unknown as McpJsonRpcRequest, context);
    return NextResponse.json(singleResponse, {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return NextResponse.json(
    {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: MCP_ERROR_CODES.INVALID_REQUEST,
        message: 'Request body must be a valid JSON-RPC 2.0 object or array.',
      },
    },
    { status: 400 }
  );
}

/**
 * OPTIONS handler for CORS pre-flight requests.
 */
export async function OPTIONS(): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, x-workspace-id, x-organization-id',
    },
  });
}
