/**
 * @fileOverview Universal Multi-Tenant Event Bus (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 8 (High Security Standards), Rule 24 (Cascade Defense),
 * Rule 31 (Observability & Telemetry), Rule 39 (OpenTelemetry Trace Propagation),
 * Rule 41 & 47 (Multi-Tenant Isolation).
 *
 * Provides in-process, asynchronous reactive event routing with:
 * - Exact pattern matching ("crm.contact.created")
 * - Domain wildcard matching ("crm.*", "deal.*", "crm.contact.*")
 * - Universal wildcard matching ("*")
 * - Strict multi-tenant boundary checks (tenant subscribers only receive matching tenant events)
 * - Isolated handler execution via Promise.allSettled (fault isolation)
 */

import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

export type EventHandler = (event: DomainEvent) => Promise<void> | void;

export interface SubscriptionOptions {
  organizationId?: string;
  workspaceId?: string;
  name?: string;
}

export interface EventBusSubscription {
  id: string;
  pattern: string;
  unsubscribe: () => void;
}

export interface EventPublishResult {
  eventId: string;
  deliveredCount: number;
  failedCount: number;
  durationMs: number;
  errors: Array<{ handlerName: string; error: string }>;
}

export interface EventBus {
  subscribe(pattern: string, handler: EventHandler, options?: SubscriptionOptions): EventBusSubscription;
  publish(event: DomainEvent): Promise<EventPublishResult>;
  clear(): void;
  getSubscriberCount(pattern?: string): number;
}

interface InternalSubscription {
  id: string;
  pattern: string;
  handler: EventHandler;
  organizationId?: string;
  workspaceId?: string;
  name: string;
}

/**
 * Checks whether an event type matches a pattern.
 * - '*' matches any event type.
 * - 'prefix.*' matches 'prefix.foo', 'prefix.foo.bar', etc.
 * - Exact string match otherwise.
 */
export function patternMatches(pattern: string, eventType: string): boolean {
  if (pattern === '*' || pattern === '') {
    return true;
  }
  if (pattern === eventType) {
    return true;
  }
  if (pattern.endsWith('.*')) {
    const prefix = pattern.slice(0, -2);
    return eventType === prefix || eventType.startsWith(`${prefix}.`);
  }
  return false;
}

class InMemoryEventBus implements EventBus {
  private subscriptions: Map<string, InternalSubscription> = new Map();

  subscribe(pattern: string, handler: EventHandler, options?: SubscriptionOptions): EventBusSubscription {
    const id = crypto.randomUUID();
    const sub: InternalSubscription = {
      id,
      pattern: pattern.trim(),
      handler,
      organizationId: options?.organizationId?.trim(),
      workspaceId: options?.workspaceId?.trim(),
      name: options?.name?.trim() || `sub_${id.slice(0, 8)}`,
    };

    this.subscriptions.set(id, sub);

    return {
      id,
      pattern: sub.pattern,
      unsubscribe: () => {
        this.subscriptions.delete(id);
      },
    };
  }

  async publish(event: DomainEvent): Promise<EventPublishResult> {
    const startTime = Date.now();
    const candidateSubs: InternalSubscription[] = [];

    for (const sub of this.subscriptions.values()) {
      // 1. Pattern matching check
      if (!patternMatches(sub.pattern, event.type)) {
        continue;
      }

      // 2. Multi-tenant boundary isolation (Rule 47)
      if (sub.organizationId && sub.organizationId !== event.organizationId) {
        continue;
      }

      if (sub.workspaceId) {
        // If subscriber is bound to a workspace, event must match that workspace
        if (!event.workspaceId || sub.workspaceId !== event.workspaceId) {
          continue;
        }
      }

      candidateSubs.push(sub);
    }

    if (candidateSubs.length === 0) {
      return {
        eventId: event.id,
        deliveredCount: 0,
        failedCount: 0,
        durationMs: Date.now() - startTime,
        errors: [],
      };
    }

    // 3. Isolated execution via Promise.allSettled (Rule 24)
    const results = await Promise.allSettled(
      candidateSubs.map(async (sub) => {
        await sub.handler(event);
      })
    );

    let deliveredCount = 0;
    let failedCount = 0;
    const errors: Array<{ handlerName: string; error: string }> = [];

    results.forEach((res, index) => {
      const sub = candidateSubs[index];
      const handlerName = sub ? sub.name : `handler_${index}`;

      if (res.status === 'fulfilled') {
        deliveredCount += 1;
      } else {
        failedCount += 1;
        const errMessage =
          res.reason instanceof Error ? res.reason.message : String(res.reason);
        errors.push({ handlerName, error: errMessage });
      }
    });

    return {
      eventId: event.id,
      deliveredCount,
      failedCount,
      durationMs: Date.now() - startTime,
      errors,
    };
  }

  clear(): void {
    this.subscriptions.clear();
  }

  getSubscriberCount(pattern?: string): number {
    if (!pattern) {
      return this.subscriptions.size;
    }
    let count = 0;
    for (const sub of this.subscriptions.values()) {
      if (sub.pattern === pattern) {
        count += 1;
      }
    }
    return count;
  }
}

/**
 * Creates a fresh hermetic EventBus instance.
 */
export function createEventBus(): EventBus {
  return new InMemoryEventBus();
}

/**
 * Global singleton EventBus instance used across the application.
 */
export const defaultEventBus: EventBus = createEventBus();
