'use server';

/**
 * @fileOverview Server Actions for Activity Streams & Dead-Letter Queue Operations (Phase 2 Milestone 3)
 *
 * Implements Rule 1 (Preserve Existing Workflows), Rule 4 (Strict Typing), Rule 8 (Anti-IDOR Security),
 * Rule 9 (Query Limit Clamping), Rule 10 (Inline Architectural Documentation), Rule 20 (Idempotency),
 * Rule 25 (DLQ Ops), and Rule 47 (Multi-Tenant Isolation).
 *
 * Endpoints:
 *   - listActivitiesAction: Queries activity records with cursor pagination and tenant validation.
 *   - listDeadLetterEventsAction: Retrieves quarantined DLQ events for operators.
 *   - replayDeadLetterEventAction: Re-publishes a quarantined event to the EventBus and marks replayed.
 *   - discardDeadLetterEventAction: Permanently discards a quarantined event with operator notes.
 *
 * Strict Typing Policy: Zero `any` or `any[]`.
 *
 * @testability Covered in `src/platform/__tests__/events/activity-actions.test.ts`.
 */

import { requireAuth } from '@/lib/auth/require-auth';
import { defaultActivityAggregationService } from '@/platform/events/activity/activity-aggregation-service';
import { defaultEventBus } from '@/platform/events/event-bus';
import {
  defaultDeadLetterStorage,
  type DeadLetterStorage,
  type DeadLetterRecord,
} from '@/platform/events/storage/dead-letter-storage';
import {
  type ActivityRecordV2,
  type ActivityFeedQuery,
  ActivityFeedQuerySchema,
} from '@/platform/events/contracts/activity-record.contract';

export interface ActionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Lists activities for the authenticated user's organization and optional workspace.
 * Clamps limit between 1 and 100 (Rule 9). Enforces Anti-IDOR tenant perimeter (Rule 8, 47).
 */
export async function listActivitiesAction(
  params: ActivityFeedQuery,
  activityService = defaultActivityAggregationService
): Promise<ActionResponse<ActivityRecordV2[]>> {
  try {
    const auth = await requireAuth();
    const callerOrgId = auth.profile.organizationId;

    if (!callerOrgId) {
      return { success: false, error: 'Caller does not belong to an active organization.' };
    }

    // Validate query parameters with Zod
    const validated = ActivityFeedQuerySchema.parse(params);

    // Enforce caller's organizationId (Anti-IDOR Rule 8, 47) unless platform admin
    const effectiveOrgId = auth.isSystemAdmin && validated.organizationId ? validated.organizationId : callerOrgId;

    // Enforce workspace scope if caller is restricted to a workspace
    const effectiveWorkspaceId =
      auth.profile.lastActiveWorkspaceId && !auth.isSystemAdmin
        ? auth.profile.lastActiveWorkspaceId
        : validated.workspaceId;

    // Query storage with bounded limit
    const storage = activityService.getStorage();
    const activities = await storage.listActivities({
      organizationId: effectiveOrgId,
      workspaceId: effectiveWorkspaceId ?? undefined,
      actorType: validated.actorType,
      entityId: validated.entityId,
      limit: validated.limit,
      afterTimestamp: validated.afterTimestamp,
    });

    return { success: true, data: activities };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list activities';
    console.error('[ACTIVITY_ACTION_LIST_ERROR]', err);
    return { success: false, error: message };
  }
}

/**
 * Lists quarantined dead-letter events for the authenticated admin's organization.
 */
export async function listDeadLetterEventsAction(
  params?: { organizationId?: string; workspaceId?: string; limit?: number },
  dlqStorage: DeadLetterStorage = defaultDeadLetterStorage
): Promise<ActionResponse<DeadLetterRecord[]>> {
  try {
    const auth = await requireAuth();
    const callerOrgId = auth.profile.organizationId;

    if (!callerOrgId) {
      return { success: false, error: 'Caller does not belong to an active organization.' };
    }

    // Verify operator/admin role
    if (auth.profile.role !== 'admin' && !auth.isSystemAdmin) {
      return { success: false, error: 'Forbidden: Insufficient privileges for DLQ operator operations.' };
    }

    const effectiveOrgId = auth.isSystemAdmin && params?.organizationId ? params.organizationId : callerOrgId;

    const records = await dlqStorage.listDeadLetterEvents({
      organizationId: effectiveOrgId,
      workspaceId: params?.workspaceId,
      limit: Math.min(Math.max(params?.limit ?? 50, 1), 100),
    });

    return { success: true, data: records };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to list dead letter events';
    console.error('[DLQ_ACTION_LIST_ERROR]', err);
    return { success: false, error: message };
  }
}

/**
 * Replays a quarantined event from the Dead-Letter Queue back into the reactive EventBus.
 */
export async function replayDeadLetterEventAction(
  params: { eventId: string },
  dlqStorage: DeadLetterStorage = defaultDeadLetterStorage
): Promise<ActionResponse<{ eventId: string }>> {
  try {
    const auth = await requireAuth();
    const callerOrgId = auth.profile.organizationId;

    if (!params.eventId?.trim()) {
      return { success: false, error: 'Invalid eventId provided.' };
    }

    // Verify operator/admin role
    if (auth.profile.role !== 'admin' && !auth.isSystemAdmin) {
      return { success: false, error: 'Forbidden: Insufficient privileges for DLQ operator replay.' };
    }

    const record = await dlqStorage.get(params.eventId);
    if (!record) {
      return { success: false, error: 'Quarantined dead letter event not found.' };
    }

    // Verify tenant ownership (Rule 8, 47)
    if (!auth.isSystemAdmin && record.organizationId !== callerOrgId) {
      return { success: false, error: 'Forbidden: Cannot access events belonging to another organization.' };
    }

    // 1. Re-publish through universal EventBus (Rule 20, 24)
    await defaultEventBus.publish(record.event);

    // 2. Mark as replayed in storage
    await dlqStorage.markReplayed(params.eventId);

    return { success: true, data: { eventId: params.eventId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to replay dead letter event';
    console.error('[DLQ_ACTION_REPLAY_ERROR]', err);
    return { success: false, error: message };
  }
}

/**
 * Permanently marks a quarantined dead-letter event as discarded.
 */
export async function discardDeadLetterEventAction(
  params: { eventId: string; reason?: string },
  dlqStorage: DeadLetterStorage = defaultDeadLetterStorage
): Promise<ActionResponse<{ eventId: string }>> {
  try {
    const auth = await requireAuth();
    const callerOrgId = auth.profile.organizationId;

    if (!params.eventId?.trim()) {
      return { success: false, error: 'Invalid eventId provided.' };
    }

    // Verify operator/admin role
    if (auth.profile.role !== 'admin' && !auth.isSystemAdmin) {
      return { success: false, error: 'Forbidden: Insufficient privileges for DLQ operator discard.' };
    }

    const record = await dlqStorage.get(params.eventId);
    if (!record) {
      return { success: false, error: 'Quarantined dead letter event not found.' };
    }

    // Verify tenant ownership (Rule 8, 47)
    if (!auth.isSystemAdmin && record.organizationId !== callerOrgId) {
      return { success: false, error: 'Forbidden: Cannot access events belonging to another organization.' };
    }

    await dlqStorage.markDiscarded(params.eventId, params.reason);
    return { success: true, data: { eventId: params.eventId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to discard dead letter event';
    console.error('[DLQ_ACTION_DISCARD_ERROR]', err);
    return { success: false, error: message };
  }
}
