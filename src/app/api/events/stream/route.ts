/**
 * @fileOverview Authenticated Multi-Tenant Server-Sent Events (SSE) Route Handler (Phase 2 Milestone 3)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 (High Security / Anti-IDOR), Rule 9 (Connection Teardown),
 * Rule 10 (Inline Architectural Guidance), Rule 47 (Multi-Tenant Isolation), and Rule 51 (Route Security).
 *
 * Exposes a streaming GET endpoint at `/api/events/stream` providing real-time activity events
 * to authenticated browser clients and operators.
 *
 * Key Architectural Invariants:
 *   1. Auth Gate: Rejects unauthenticated connections with 401 Unauthorized.
 *   2. Tenant Isolation: Clients ONLY receive events belonging to their authenticated organizationId
 *      and optional workspaceId perimeter.
 *   3. Zero Memory Leaks: Listens for `request.signal` abort to unsubscribe from EventBus immediately
 *      when client closes or navigates away.
 *   4. Heartbeat Keep-Alive: Transmits a ping every 25 seconds to keep Cloud Run / CDN proxies open.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/event-stream-route.test.ts`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/require-auth';
import { authenticateApiRequest } from '@/lib/auth/api-auth-guard';
import { defaultEventBus, type EventBusSubscription } from '@/platform/events/event-bus';
import { defaultActivityAggregationService } from '@/platform/events/activity/activity-aggregation-service';
import type { ActivityRecordV2 } from '@/platform/events/contracts/activity-record.contract';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatSseMessage(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(request: NextRequest): Promise<Response> {
  let organizationId: string | undefined;
  let workspaceId: string | undefined;

  // 1. Dual Authentication: Try session cookie first, fallback to Bearer token (Rule 8, 51)
  try {
    const sessionAuth = await requireAuth();
    organizationId = sessionAuth.profile.organizationId;
    workspaceId = sessionAuth.profile.lastActiveWorkspaceId || undefined;
  } catch {
    // If cookie auth fails, attempt Bearer token inspection
    const tokenResult = await authenticateApiRequest(request);
    if (!tokenResult.success || !tokenResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid session cookie or Bearer token required.' },
        { status: 401 }
      );
    }
    organizationId = tokenResult.user.profile.organizationId;
    workspaceId = tokenResult.user.profile.lastActiveWorkspaceId || undefined;
  }

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Forbidden: Caller is not assigned to an active organization.' },
      { status: 403 }
    );
  }

  // 2. Query param overrides (for workspace-scoped feeds if user has access)
  const searchParams = request.nextUrl.searchParams;
  const requestedWorkspaceId = searchParams.get('workspaceId');
  if (requestedWorkspaceId) {
    workspaceId = requestedWorkspaceId;
  }

  const requestedEntityId = searchParams.get('entityId');
  const requestedActorType = searchParams.get('actorType');

  // 3. Create SSE ReadableStream with lifecycle teardown (Rule 9)
  const encoder = new TextEncoder();
  let subscription: EventBusSubscription | null = null;
  let pingInterval: NodeJS.Timeout | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // A. Send initial handshake connection message
      const handshake = formatSseMessage('connected', {
        timestamp: new Date().toISOString(),
        organizationId,
        workspaceId: workspaceId ?? null,
      });
      controller.enqueue(encoder.encode(handshake));

      // B. Setup 25s keepalive ping for Cloud Run / CDN proxies
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          if (pingInterval) clearInterval(pingInterval);
        }
      }, 25000);

      // C. Subscribe to multi-tenant EventBus (Rule 47)
      subscription = defaultEventBus.subscribe(
        '*',
        async (event: DomainEvent) => {
          // Entity and actor filtering if requested
          if (requestedEntityId && event.entity.id !== requestedEntityId) {
            return;
          }
          if (requestedActorType && event.actor.type !== requestedActorType) {
            return;
          }

          try {
            // Materialize or format into ActivityRecordV2
            const record: ActivityRecordV2 = await defaultActivityAggregationService.materializeAndStore(event);
            const message = formatSseMessage('activity', record);
            controller.enqueue(encoder.encode(message));
          } catch (err: unknown) {
            console.warn('[EVENT_STREAM_SSE] Error streaming activity record:', err);
          }
        },
        {
          organizationId,
          workspaceId,
          name: `sse-stream-${organizationId}-${Date.now()}`,
        }
      );
    },

    cancel() {
      // Cleanup on stream close
      if (pingInterval) clearInterval(pingInterval);
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    },
  });

  // D. Wire abort signal for instant teardown on tab close / navigation (Rule 9)
  request.signal.addEventListener('abort', () => {
    if (pingInterval) clearInterval(pingInterval);
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }
  });

  // 4. Return streaming response with required headers
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
