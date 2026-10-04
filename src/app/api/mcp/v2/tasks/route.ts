/**
 * @fileOverview Next.js App Router Dynamic MCP Endpoint: /api/mcp/v2/tasks (Phase 7 Milestone 5)
 *
 * Implements the MCP Tasks Protocol Extension (Spec 2026-07-28) over Streamable HTTP:
 *   - POST /api/mcp/v2/tasks (methods: tasks/create, tasks/get, tasks/list, tasks/cancel, tasks/result)
 *   - OPTIONS /api/mcp/v2/tasks (CORS preflight)
 *
 * ARCHITECTURAL INVARIANTS:
 * - Rule 4: Zero `any` or `any[]` typing policy.
 * - Rule 8 & 47: Anti-IDOR perimeter scoping. Validates caller credentials via authenticateMcpRequest.
 * - Rule 9: Cloud Run 32MB payload ceiling & resource bounding.
 * - Rule 11 & 38: MCP Spec 2026-07-28 Streamable HTTP statelessness (no legacy session dependencies).
 * - Rule 20 & 39: End-to-end correlation ID and distributed tracing.
 * - Rule 60: Emergency Dead-Man Switch evaluation halting task creation with HTTP 503.
 */

import { randomUUID } from 'node:crypto';
import { authenticateMcpRequest } from '@/platform/mcp/auth/mcp-auth-gateway';
import { MCP_TRANSPORT_ERROR_CODES } from '@/platform/mcp/transport/transport-types';
import { getWorkflowStore } from '@/platform/workflows/workflow-store';
import { defaultEventBus } from '@/platform/events/event-bus';
import { McpTasksHandler } from '@/platform/mcp/tasks/mcp-tasks-handler';
import {
  McpTasksError,
  MCP_TASKS_ERROR_CODES,
  type TaskCreateInput,
  type TaskGetInput,
  type TaskListInput,
  type TaskCancelInput,
  type TaskResultInput,
} from '@/platform/mcp/tasks/mcp-tasks-types';

const CLOUD_RUN_MAX_REQUEST_BODY_SIZE = 32 * 1024 * 1024; // 32MB

function getTasksHandler(): McpTasksHandler {
  return new McpTasksHandler({
    store: getWorkflowStore(),
    eventBus: defaultEventBus,
  });
}

/**
 * Handles CORS Preflight for web-based MCP clients.
 */
export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers':
        'authorization, content-type, accept, mcp-transaction-id, x-smartsapp-correlation-id, if-none-match, traceparent, tracestate',
      'Access-Control-Expose-Headers':
        'etag, mcp-transaction-id, x-smartsapp-correlation-id',
      'Access-Control-Max-Age': '86400',
    },
  });
}

interface JsonRpcRequestBody {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
}

/**
 * Handles MCP 2026-07-28 Streamable HTTP POST requests for tasks.
 */
export async function POST(req: Request): Promise<Response> {
  const correlationId =
    req.headers.get('x-smartsapp-correlation-id') ||
    req.headers.get('X-SmartSapp-Correlation-Id') ||
    randomUUID();

  const transactionId =
    req.headers.get('mcp-transaction-id') ||
    req.headers.get('Mcp-Transaction-Id') ||
    randomUUID();

  // 1. Enforce Cloud Run 32MB payload ceiling (Rule 9)
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > CLOUD_RUN_MAX_REQUEST_BODY_SIZE) {
    const errorPayload = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32000,
        message: 'Request payload exceeds maximum allowed size of 32MB',
        data: {
          code: MCP_TRANSPORT_ERROR_CODES.PAYLOAD_TOO_LARGE,
          correlationId,
        },
      },
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 413,
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  // 2. Multi-Tenant Ingress Authentication Gate (Rule 8, 16, 47 Anti-IDOR, Rule 60 Dead-Man)
  const authResult = await authenticateMcpRequest(req);
  if (!authResult.success) {
    const isUnauthenticated =
      authResult.errorCode === MCP_TRANSPORT_ERROR_CODES.UNAUTHENTICATED;
    const errorPayload = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: isUnauthenticated ? -32001 : -32000,
        message: authResult.errorMessage,
        data: {
          code: authResult.errorCode,
          correlationId,
        },
      },
    };
    return new Response(JSON.stringify(errorPayload), {
      status: authResult.status,
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  // 3. Parse JSON Body
  let body: JsonRpcRequestBody;
  try {
    body = (await req.json()) as JsonRpcRequestBody;
  } catch {
    const errorPayload = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32700,
        message: 'Parse error: invalid JSON body',
      },
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 400,
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  const reqId = body.id ?? null;

  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string') {
    const errorPayload = {
      jsonrpc: '2.0',
      id: reqId,
      error: {
        code: -32600,
        message: 'Invalid Request: jsonrpc must be "2.0" and method must be a string',
      },
    };
    return new Response(JSON.stringify(errorPayload), {
      status: 400,
      headers: {
        'content-type': 'application/json',
        'x-smartsapp-correlation-id': correlationId,
        'mcp-transaction-id': transactionId,
      },
    });
  }

  // 4. Dispatch JSON-RPC Method
  const handler = getTasksHandler();

  try {
    let result: unknown;

    switch (body.method) {
      case 'tasks/create': {
        result = await handler.handleCreateTask(
          body.params as TaskCreateInput,
          authResult.principal,
          { correlationId }
        );
        break;
      }
      case 'tasks/get': {
        result = await handler.handleGetTask(
          body.params as TaskGetInput,
          authResult.principal
        );
        break;
      }
      case 'tasks/list': {
        result = await handler.handleListTasks(
          (body.params || {}) as TaskListInput,
          authResult.principal
        );
        break;
      }
      case 'tasks/cancel': {
        result = await handler.handleCancelTask(
          body.params as TaskCancelInput,
          authResult.principal
        );
        break;
      }
      case 'tasks/result': {
        result = await handler.handleGetTaskResult(
          body.params as TaskResultInput,
          authResult.principal
        );
        break;
      }
      default: {
        const errorPayload = {
          jsonrpc: '2.0',
          id: reqId,
          error: {
            code: -32601,
            message: `Method '${body.method}' not found. Supported methods: tasks/create, tasks/get, tasks/list, tasks/cancel, tasks/result`,
          },
        };
        return new Response(JSON.stringify(errorPayload), {
          status: 404,
          headers: {
            'content-type': 'application/json',
            'x-smartsapp-correlation-id': correlationId,
            'mcp-transaction-id': transactionId,
          },
        });
      }
    }

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        result,
      }),
      {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'x-smartsapp-correlation-id': correlationId,
          'mcp-transaction-id': transactionId,
        },
      }
    );
  } catch (err) {
    if (err instanceof McpTasksError) {
      let httpStatus = 400;
      let jsonRpcCode = -32000;

      switch (err.code) {
        case MCP_TASKS_ERROR_CODES.TASK_NOT_FOUND:
          httpStatus = 404;
          jsonRpcCode = -32000;
          break;
        case MCP_TASKS_ERROR_CODES.IDOR_VIOLATION:
        case MCP_TASKS_ERROR_CODES.UNAUTHORIZED:
          httpStatus = 403;
          jsonRpcCode = -32000;
          break;
        case MCP_TASKS_ERROR_CODES.DEAD_MAN_PAUSED:
          httpStatus = 503;
          jsonRpcCode = -32000;
          break;
        case MCP_TASKS_ERROR_CODES.INVALID_TASK_STATE:
          httpStatus = 400;
          jsonRpcCode = -32602;
          break;
        default:
          httpStatus = 500;
          jsonRpcCode = -32603;
      }

      return new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: reqId,
          error: {
            code: jsonRpcCode,
            message: err.message,
            data: {
              code: err.code,
              correlationId,
              details: err.details,
            },
          },
        }),
        {
          status: httpStatus,
          headers: {
            'content-type': 'application/json',
            'x-smartsapp-correlation-id': correlationId,
            'mcp-transaction-id': transactionId,
          },
        }
      );
    }

    return new Response(
      JSON.stringify({
        jsonrpc: '2.0',
        id: reqId,
        error: {
          code: -32603,
          message: err instanceof Error ? err.message : 'Internal error',
          data: { correlationId },
        },
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
          'x-smartsapp-correlation-id': correlationId,
          'mcp-transaction-id': transactionId,
        },
      }
    );
  }
}
