/**
 * @fileOverview CompanyBrain 2.0 Phase 6: MCP Server-Sent Events (SSE) Stream
 * Route: GET /api/mcp/sse
 *
 * ARCHITECTURAL GUIDELINES & CAUTION FOR MAINTAINERS (Rule 10):
 * 1. Model Context Protocol SSE Specification:
 *    - Opens a persistent text/event-stream for MCP clients.
 *    - Emits the initial `endpoint` event directing callers to `/api/mcp`.
 * 2. Strict Zero-`any` & Zero-`unknown` Standard:
 *    - Clean typed ReadableStream implementation.
 */

import { NextRequest } from 'next/server';

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  const endpointUrl = `${protocol}://${host}/api/mcp`;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Send endpoint event required by MCP SSE standard
      const endpointMessage = `event: endpoint\ndata: ${endpointUrl}\n\n`;
      controller.enqueue(encoder.encode(endpointMessage));

      // 2. Initial connection ping
      const pingMessage = `event: message\ndata: {"jsonrpc":"2.0","method":"ping","params":{"status":"connected"}}\n\n`;
      controller.enqueue(encoder.encode(pingMessage));

      // 3. Heartbeat interval
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch (_err) {
          clearInterval(interval);
        }
      }, 15000);

      req.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch (_err) {
          // Stream already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
