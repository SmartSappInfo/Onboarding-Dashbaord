/**
 * @fileOverview Domain Event Memory Indexer Subscriber (Phase 4 Milestone 3)
 *
 * Implements Rule 4 (Zero-any), Rules 8 & 47 (Tenant ACL), Rule 25 (Cloud Tasks Dispatch),
 * Rule 26 (Distributed Trace Propagation), and Rule 40 (Domain Event Integration).
 *
 * Listens to domain events across the platform (crm.note.created, meeting.completed,
 * deal.stage_changed, document.uploaded, portal.lesson.published) and schedules
 * asynchronous ingestion jobs in Google Cloud Tasks.
 *
 * @testability Covered in `src/platform/__tests__/memory/domain-event-indexer.test.ts`.
 */

import { randomUUID } from 'node:crypto';
import type { DomainEvent } from '../../capabilities/events/domain-event';
import { scheduleTaskWithKey } from '@/lib/gcp-tasks-client';
import {
  MemoryIngestionJobPayload,
  MemoryIngestionJobPayloadSchema,
  MemoryIngestionTarget,
} from '../ingestion/ingestion-types';
import { MemorySourceType } from '../contracts/memory-types';

export const MEMORY_INDEXER_QUEUE = 'memory-indexer-queue';
export const MEMORY_INDEXER_ENDPOINT = '/api/tasks/memory-indexer';

export interface DomainEventIndexerDependencies {
  scheduleTask?: typeof scheduleTaskWithKey;
  onDispatchInline?: (payload: MemoryIngestionJobPayload) => Promise<void>;
  nowIso?: () => string;
}

export class DomainEventIndexer {
  private readonly scheduleTask: typeof scheduleTaskWithKey;
  private readonly onDispatchInline?: (payload: MemoryIngestionJobPayload) => Promise<void>;
  private readonly nowIso: () => string;

  constructor(deps: DomainEventIndexerDependencies = {}) {
    this.scheduleTask = deps.scheduleTask ?? scheduleTaskWithKey;
    this.onDispatchInline = deps.onDispatchInline;
    this.nowIso = deps.nowIso ?? (() => new Date().toISOString());
  }

  /**
   * Handles incoming domain events and queues ingestion jobs.
   */
  public async handleEvent(event: DomainEvent): Promise<boolean> {
    if (!this.isIndexableEvent(event.type)) {
      return false;
    }

    const organizationId = event.organizationId;
    const workspaceId = event.workspaceId || '';

    if (!organizationId || !workspaceId) {
      console.warn(`[DomainEventIndexer] Event ${event.id} missing organizationId or workspaceId, skipping.`);
      return false;
    }

    const target = this.mapEventToTarget(event);
    if (!target) {
      return false;
    }

    const jobId = `job_${randomUUID()}`;
    const idempotencyKey = event.idempotencyKey || `event_${event.id}`;

    const jobPayload: MemoryIngestionJobPayload = MemoryIngestionJobPayloadSchema.parse({
      jobId,
      organizationId,
      workspaceId,
      idempotencyKey,
      correlationId: event.correlationId,
      targets: [target],
      createdAt: this.nowIso(),
    });

    // If an inline handler is provided (e.g. unit tests or local execution), dispatch directly
    if (this.onDispatchInline) {
      await this.onDispatchInline(jobPayload);
      return true;
    }

    // Schedule task via Google Cloud Tasks
    const taskKey = `mem-${jobId}-${idempotencyKey}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 500);

    const serializedPayload: Record<string, unknown> = {
      jobId: jobPayload.jobId,
      organizationId: jobPayload.organizationId,
      workspaceId: jobPayload.workspaceId,
      idempotencyKey: jobPayload.idempotencyKey,
      correlationId: jobPayload.correlationId,
      targets: jobPayload.targets,
      chunkingOptions: jobPayload.chunkingOptions,
      createdAt: jobPayload.createdAt,
    };

    try {
      await this.scheduleTask(
        taskKey,
        MEMORY_INDEXER_QUEUE,
        MEMORY_INDEXER_ENDPOINT,
        serializedPayload,
        0
      );
      return true;
    } catch (err) {
      console.warn(`[DomainEventIndexer] Failed to enqueue Cloud Task for event ${event.id}:`, err);
      return false;
    }
  }

  private isIndexableEvent(type: string): boolean {
    return (
      type === 'crm.note.created' ||
      type === 'meeting.completed' ||
      type === 'deal.stage_changed' ||
      type === 'portal.lesson.published' ||
      type === 'document.uploaded'
    );
  }

  private mapEventToTarget(event: DomainEvent): MemoryIngestionTarget | null {
    const payload = event.payload;
    let sourceType: MemorySourceType = 'document';
    let title = typeof payload.title === 'string' ? payload.title : undefined;
    let content = '';

    if (event.type === 'crm.note.created') {
      sourceType = 'user_note';
      content = typeof payload.note === 'string' ? payload.note : typeof payload.content === 'string' ? payload.content : '';
      title = title ?? `CRM Note: ${event.entity.id}`;
    } else if (event.type === 'meeting.completed') {
      sourceType = 'meeting';
      const transcript = typeof payload.transcript === 'string' ? payload.transcript : '';
      const summary = typeof payload.summary === 'string' ? payload.summary : '';
      content = transcript || summary || (typeof payload.content === 'string' ? payload.content : '');
      title = title ?? `Meeting: ${event.entity.id}`;
    } else if (event.type === 'deal.stage_changed') {
      sourceType = 'deal';
      content = typeof payload.stageChangeReason === 'string' ? payload.stageChangeReason : typeof payload.notes === 'string' ? payload.notes : typeof payload.content === 'string' ? payload.content : '';
      title = title ?? `Deal Stage: ${event.entity.id}`;
    } else if (event.type === 'portal.lesson.published') {
      sourceType = 'page';
      content = typeof payload.content === 'string' ? payload.content : '';
      title = title ?? `Lesson: ${event.entity.id}`;
    } else if (event.type === 'document.uploaded') {
      sourceType = 'document';
      content = typeof payload.content === 'string' ? payload.content : '';
      title = title ?? `Document: ${event.entity.id}`;
    }

    if (!content.trim()) {
      return null;
    }

    const topics: string[] = Array.isArray(payload.topics)
      ? payload.topics.filter((t): t is string => typeof t === 'string')
      : [];

    const subjectRefs: Record<string, string[]> = {};
    if (event.entity.type === 'contact') {
      subjectRefs.entityIds = [event.entity.id];
    } else if (event.entity.type === 'deal') {
      subjectRefs.dealIds = [event.entity.id];
    } else if (event.entity.type === 'meeting') {
      subjectRefs.meetingIds = [event.entity.id];
    }

    return {
      sourceType,
      sourceId: event.entity.id,
      title,
      content,
      authorId: event.actor.id,
      authorName: typeof payload.authorName === 'string' ? payload.authorName : undefined,
      importance: 0.7,
      confidence: 1.0,
      sensitivity: 'internal',
      topics,
      subjectRefs,
      customMetadata: {},
    };
  }
}
