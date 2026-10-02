/**
 * @fileOverview Activity Aggregation & Materialization Service (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 7 (Plain English Summaries), Rule 9 (Bounded Queries),
 * Rule 11 (State Immutability), Rule 20 (Replay Protection & Deterministic Keys),
 * Rule 40 (Append-Only Audit), and Rule 47 (Multi-Tenant Boundaries).
 *
 * Materializes canonical DomainEvent objects into denormalized ActivityRecordV2 documents.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';
import {
  ActivityRecordV2Schema,
  buildActivityDocumentId,
  type ActivityRecordV2,
} from '@/platform/events/contracts/activity-record.contract';
import { normalizeActor, type ActorContext } from '@/platform/events/activity/actor-normalizer';
import { formatEventSummary } from '@/platform/events/activity/summary-formatter';

export interface ActivityListOptions {
  organizationId: string;
  workspaceId?: string;
  entityId?: string;
  actorType?: 'user' | 'agent' | 'automation' | 'system';
  limit?: number;
  afterTimestamp?: string;
}

export interface ActivityStorage {
  recordActivity(activity: ActivityRecordV2): Promise<void>;
  getActivity(id: string): Promise<ActivityRecordV2 | null>;
  listActivities(options: ActivityListOptions): Promise<ActivityRecordV2[]>;
}

/**
 * In-Memory ActivityStorage for hermetic unit testing.
 */
export function createInMemoryActivityStorage(): ActivityStorage {
  const store = new Map<string, ActivityRecordV2>();

  return {
    async recordActivity(activity: ActivityRecordV2): Promise<void> {
      // Append-only: validate schema and store by deterministic ID
      const validated = ActivityRecordV2Schema.parse(activity);
      store.set(validated.id, Object.freeze({ ...validated }));
    },

    async getActivity(id: string): Promise<ActivityRecordV2 | null> {
      return store.get(id) || null;
    },

    async listActivities(options: ActivityListOptions): Promise<ActivityRecordV2[]> {
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 100); // Rule 9: clamp between 1 and 100
      let results = Array.from(store.values()).filter(
        (rec) => rec.organizationId === options.organizationId
      );

      if (options.workspaceId) {
        results = results.filter((rec) => rec.workspaceId === options.workspaceId);
      }

      if (options.actorType) {
        results = results.filter((rec) => rec.actor.type === options.actorType);
      }

      if (options.entityId) {
        results = results.filter((rec) => rec.entity.id === options.entityId);
      }

      if (options.afterTimestamp) {
        results = results.filter((rec) => rec.timestamp > options.afterTimestamp!);
      }

      // Order by timestamp DESC
      results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      return results.slice(0, limit);
    },
  };
}

/**
 * Production Firestore ActivityStorage storing denormalized activities in:
 * - organizations/{orgId}/activities/{id}
 * - workspaces/{wsId}/activities/{id} (if workspaceId is present)
 */
export function createFirestoreActivityStorage(db = adminDb): ActivityStorage {
  return {
    async recordActivity(activity: ActivityRecordV2): Promise<void> {
      const validated = ActivityRecordV2Schema.parse(activity);
      const batch = db.batch();

      // 1. Organization activity timeline
      const orgDocRef = db
        .collection('organizations')
        .doc(validated.organizationId)
        .collection('activities')
        .doc(validated.id);
      batch.set(orgDocRef, validated, { merge: false });

      // 2. Workspace activity timeline (if workspaceId is present)
      if (validated.workspaceId) {
        const wsDocRef = db
          .collection('workspaces')
          .doc(validated.workspaceId)
          .collection('activities')
          .doc(validated.id);
        batch.set(wsDocRef, validated, { merge: false });
      }

      await batch.commit();
    },

    async getActivity(id: string): Promise<ActivityRecordV2 | null> {
      try {
        // Query across collections via collectionGroup or direct ID match
        const snapshot = await db.collectionGroup('activities').where('id', '==', id).limit(1).get();
        if (snapshot.empty) {
          return null;
        }
        return snapshot.docs[0]?.data() as ActivityRecordV2;
      } catch {
        return null;
      }
    },

    async listActivities(options: ActivityListOptions): Promise<ActivityRecordV2[]> {
      const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);

      try {
        let queryRef;
        if (options.workspaceId) {
          queryRef = db
            .collection('workspaces')
            .doc(options.workspaceId)
            .collection('activities')
            .orderBy('timestamp', 'desc');
        } else {
          queryRef = db
            .collection('organizations')
            .doc(options.organizationId)
            .collection('activities')
            .orderBy('timestamp', 'desc');
        }

        if (options.actorType) {
          queryRef = queryRef.where('actor.type', '==', options.actorType);
        }

        if (options.entityId) {
          queryRef = queryRef.where('entity.id', '==', options.entityId);
        }

        if (options.afterTimestamp) {
          queryRef = queryRef.startAfter(options.afterTimestamp);
        }

        const snapshot = await queryRef.limit(limit).get();
        return snapshot.docs.map((d) => d.data() as ActivityRecordV2);
      } catch (err) {
        console.warn('[ACTIVITY-STORAGE] Failed to query Firestore activities:', err);
        return [];
      }
    },
  };
}

export interface ActivityAggregationService {
  materializeAndStore(
    event: DomainEvent,
    actorContext?: ActorContext
  ): Promise<ActivityRecordV2>;
  getStorage(): ActivityStorage;
}

export function createActivityAggregationService(
  storage: ActivityStorage = createInMemoryActivityStorage()
): ActivityAggregationService {
  return {
    async materializeAndStore(
      event: DomainEvent,
      actorContext?: ActorContext
    ): Promise<ActivityRecordV2> {
      const normalizedActor = normalizeActor(event.actor, actorContext);
      const summary = formatEventSummary(event, {
        actorDisplayName: normalizedActor.displayName,
      });

      const recordId = buildActivityDocumentId(event.organizationId, event.id);

      const record: ActivityRecordV2 = {
        id: recordId,
        eventId: event.id,
        organizationId: event.organizationId,
        workspaceId: event.workspaceId ?? null,
        timestamp: event.timestamp || new Date().toISOString(),
        eventType: event.type,
        actor: normalizedActor,
        entity: {
          type: event.entity.type,
          id: event.entity.id,
          name: typeof event.payload?.name === 'string'
            ? event.payload.name
            : (typeof event.payload?.title === 'string' ? event.payload.title : undefined),
          version: event.entity.version,
        },
        summary,
        details: (event.payload || {}) as Record<string, unknown>,
        metadata: {
          source: event.source,
          idempotencyKey: event.idempotencyKey,
        },
        correlationId: event.correlationId,
        causationId: event.causationId,
      };

      await storage.recordActivity(record);
      return record;
    },

    getStorage(): ActivityStorage {
      return storage;
    },
  };
}

/**
 * Production singleton ActivityAggregationService.
 */
export const defaultActivityAggregationService = createActivityAggregationService(
  createFirestoreActivityStorage()
);
