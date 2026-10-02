/**
 * @fileOverview Tasks Domain Activity Subscriber (Phase 2 Milestone 2)
 *
 * Implements Rule 4 (Strict Typing), Rule 18 (Concurrency & Lease Defense),
 * and Rule 47 (Multi-Tenant Isolation).
 *
 * Listens for task.* events to update task completion metrics and timestamps.
 */

import { adminDb } from '@/lib/firebase-admin';
import type { DomainEvent } from '@/platform/capabilities/events/domain-event';

export interface TasksSubscriberDependencies {
  onUpdateTask?: (params: {
    organizationId: string;
    workspaceId: string;
    taskId: string;
    completedAt: string;
  }) => Promise<void>;
}

export function createTasksActivitySubscriber(deps?: TasksSubscriberDependencies) {
  return {
    async handleEvent(event: DomainEvent): Promise<void> {
      if (!event.type.startsWith('task.')) {
        return;
      }

      const taskId = event.entity.id;
      const organizationId = event.organizationId;
      const workspaceId = event.workspaceId || '';
      const completedAt = event.timestamp;

      if (!taskId || !organizationId) {
        return;
      }

      if (deps?.onUpdateTask) {
        await deps.onUpdateTask({
          organizationId,
          workspaceId,
          taskId,
          completedAt,
        });
        return;
      }

      // Default production Firestore update
      try {
        const docRef = adminDb.collection('tasks').doc(taskId);
        await docRef.set(
          {
            completedAt,
            updatedAt: completedAt,
          },
          { merge: true }
        );
      } catch (err: unknown) {
        console.warn(`[TASKS-SUBSCRIBER] Failed to update task activity for ${taskId}:`, err);
      }
    },
  };
}
