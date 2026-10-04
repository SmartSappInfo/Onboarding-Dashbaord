/**
 * @fileOverview Universal Account Timeline Normalization & Real-Time Caching Service (Phase 9 Milestone 1)
 *
 * Implements Rule 4 (Strict Typing: zero any/any[]), Rule 8 & 50 (Multi-Tenant Cache Partitioning),
 * Rule 40 (Domain Event Emission on Timeline Assembly), Rule 54 (Performance Budgets < 500ms),
 * and Rule 69 (Universal Timeline Normalization).
 *
 * ARCHITECTURAL INVARIANTS:
 * 1. Chronological Event Stream: Heterogeneous domain events across notes, meetings, deals,
 *    tasks, and invoices are normalized into a unified, chronologically sorted (descending) timeline.
 * 2. Multi-Tenant In-Memory Caching: Timelines are cached with a 3-minute TTL partitioned
 *    strictly by `${organizationId}_${workspaceId}_${entityId}`.
 * 3. Reactive EventBus Eviction: Caches are automatically invalidated when CRM activity,
 *    deal, note, or task updates are published to the EventBus.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 */

import {
  Account360Context,
  AccountTimelineItem,
  AccountTimelineItemSchema,
} from './account-context-types';
import { defaultEventBus, EventBus, EventBusSubscription } from '@/platform/events/event-bus';
import { createDomainEvent, DomainEvent } from '@/platform/capabilities/events/domain-event';

interface TimelineCacheEntry {
  readonly timeline: readonly AccountTimelineItem[];
  readonly expiresAt: number;
}

export interface AccountTimelineServiceOptions {
  readonly eventBus?: EventBus;
  readonly defaultTtlMs?: number;
}

export class AccountTimelineService {
  private readonly eventBus: EventBus;
  private readonly defaultTtlMs: number;
  private readonly cache = new Map<string, TimelineCacheEntry>();
  private readonly subscriptions: EventBusSubscription[] = [];

  constructor(options: AccountTimelineServiceOptions = {}) {
    this.eventBus = options.eventBus ?? defaultEventBus;
    this.defaultTtlMs = options.defaultTtlMs ?? 180000; // 3 minutes default

    this.registerReactiveSubscribers();
  }

  /**
   * Builds an isolated, multi-tenant cache key (Rule 50).
   */
  private buildCacheKey(organizationId: string, workspaceId: string, entityId: string): string {
    return `${organizationId}:${workspaceId}:${entityId}`;
  }

  /**
   * Registers EventBus listeners for reactive cache invalidation.
   */
  private registerReactiveSubscribers(): void {
    const handleCrmMutation = (event: DomainEvent): void => {
      const organizationId = event.organizationId;
      const workspaceId = event.workspaceId;
      const entityId = (
        (event.entity.type === 'entity' ? event.entity.id : null) ??
        (typeof event.payload.entityId === 'string' ? event.payload.entityId : null)
      );

      if (organizationId && workspaceId && entityId) {
        this.invalidateCache(organizationId, workspaceId, entityId);
      }
    };

    // Subscriptions to relevant domain mutations
    const patterns = [
      'crm.activity.*',
      'crm.account.*',
      'deal.*',
      'note.*',
      'task.*',
      'invoice.*',
    ];

    for (const pattern of patterns) {
      const sub = this.eventBus.subscribe(pattern, handleCrmMutation, {
        name: `account-timeline-cache-invalidator-${pattern}`,
      });
      this.subscriptions.push(sub);
    }
  }

  /**
   * Normalizes heterogeneous context collections into a unified, chronologically sorted timeline.
   */
  public normalizeTimeline(context: Account360Context | Partial<Account360Context>): AccountTimelineItem[] {
    const items: AccountTimelineItem[] = [];
    const seenIds = new Set<string>();

    const pushUnique = (item: AccountTimelineItem): void => {
      if (!seenIds.has(item.id)) {
        seenIds.add(item.id);
        const parsed = AccountTimelineItemSchema.safeParse(item);
        if (parsed.success) {
          items.push(parsed.data);
        }
      }
    };

    // 1. Process Notes
    if (Array.isArray(context.notes)) {
      for (const note of context.notes) {
        pushUnique({
          id: `tl_note_${note.id}`,
          timestamp: note.createdAt,
          category: 'COMMERCIAL',
          title: 'Note Added',
          summary: note.content,
          actor: note.authorName ?? null,
          sourceRef: { type: 'note', id: note.id },
        });
      }
    }

    // 2. Process Meetings
    if (Array.isArray(context.meetings)) {
      for (const meet of context.meetings) {
        pushUnique({
          id: `tl_meet_${meet.id}`,
          timestamp: meet.startTime,
          category: 'ENGAGEMENT',
          title: meet.title,
          summary: meet.summary ?? meet.title,
          actor: meet.attendees[0] ?? null,
          sourceRef: { type: 'meeting', id: meet.id },
        });
      }
    }

    // 3. Process Deals
    if (Array.isArray(context.deals)) {
      for (const deal of context.deals) {
        pushUnique({
          id: `tl_deal_${deal.id}`,
          timestamp: deal.expectedCloseDate ?? new Date().toISOString(),
          category: 'COMMERCIAL',
          title: deal.title,
          summary: `Stage: ${deal.stageName} | Value: ${deal.currency} ${deal.value.toLocaleString()}`,
          actor: null,
          sourceRef: { type: 'deal', id: deal.id },
        });
      }
    }

    // 4. Process Tasks
    if (Array.isArray(context.tasks)) {
      for (const task of context.tasks) {
        pushUnique({
          id: `tl_task_${task.id}`,
          timestamp: task.dueDate ?? new Date().toISOString(),
          category: 'OPERATIONAL',
          title: task.title,
          summary: `Task: ${task.title} (Status: ${task.status}, Priority: ${task.priority})`,
          actor: task.assignedToName ?? null,
          sourceRef: { type: 'task', id: task.id },
        });
      }
    }

    // 5. Process Existing Timeline Entries (if any already present)
    if (Array.isArray(context.timeline)) {
      for (const entry of context.timeline) {
        pushUnique(entry);
      }
    }

    // Sort strictly descending by timestamp
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return items;
  }

  /**
   * Retrieves cached timeline if present and unexpired.
   */
  public getCachedTimeline(
    organizationId: string,
    workspaceId: string,
    entityId: string
  ): AccountTimelineItem[] | null {
    const key = this.buildCacheKey(organizationId, workspaceId, entityId);
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return [...entry.timeline];
  }

  /**
   * Stores an assembled timeline in the cache with the given or default TTL.
   */
  public setCachedTimeline(
    organizationId: string,
    workspaceId: string,
    entityId: string,
    timeline: AccountTimelineItem[],
    ttlMs?: number
  ): void {
    const key = this.buildCacheKey(organizationId, workspaceId, entityId);
    const duration = ttlMs ?? this.defaultTtlMs;
    this.cache.set(key, {
      timeline: [...timeline],
      expiresAt: Date.now() + duration,
    });
  }

  /**
   * Evicts a cached timeline entry.
   */
  public invalidateCache(organizationId: string, workspaceId: string, entityId: string): void {
    const key = this.buildCacheKey(organizationId, workspaceId, entityId);
    this.cache.delete(key);
  }

  /**
   * Clears the entire in-memory cache.
   */
  public clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Emits a `crm.timeline.assembled` domain event (Rule 40).
   */
  public async publishTimelineAssembled(
    organizationId: string,
    workspaceId: string,
    entityId: string,
    itemCount: number,
    correlationId?: string
  ): Promise<void> {
    await this.eventBus.publish(
      createDomainEvent({
        type: 'crm.timeline.assembled',
        organizationId,
        workspaceId,
        actor: { type: 'system', id: 'account-timeline-service' },
        entity: { type: 'entity', id: entityId },
        correlationId: correlationId ?? `corr_tl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        source: 'account-timeline-service',
        payload: {
          entityId,
          itemCount,
          assembledAt: new Date().toISOString(),
        },
      })
    );
  }

  /**
   * Cleans up EventBus subscriptions and cache.
   */
  public destroy(): void {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
    this.subscriptions.length = 0;
    this.cache.clear();
  }
}

// Global singleton preservation across Next.js HMR (Rule 69)
declare global {
  var __smartsappAccountTimelineService: AccountTimelineService | undefined;
}

export function getAccountTimelineService(): AccountTimelineService {
  if (!globalThis.__smartsappAccountTimelineService) {
    globalThis.__smartsappAccountTimelineService = new AccountTimelineService();
  }
  return globalThis.__smartsappAccountTimelineService;
}
