/**
 * @fileOverview Canonical Bulk Task Creation Domain Core.
 *
 * WHY THIS FILE IS NOT `'use server'`:
 * In Next.js, every top-level export of a `'use server'` file becomes a publicly accessible HTTP endpoint.
 * This file contains internal, trusted domain logic that executes batch mutations. It must ONLY be invoked
 * from server modules that have ALREADY authenticated and authorized the caller (e.g. `bulkCreateTasksAction`
 * session guard or internal system automation services like `message-status-automations.ts`).
 *
 * Rule Compliance:
 * - agents_mcp_rules.md §4: Zero `any`, strict runtime Zod validation at trust boundaries.
 * - agents_mcp_rules.md §8: Hard tenant isolation (`workspaceId` and `organizationId`).
 * - agents_mcp_rules.md §9: Batch size limited to 450 operations (below Firestore's 500 ceiling).
 * - agents_mcp_rules.md §16: Explicit TaskActor boundary (`user` vs `system`).
 */

import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import type { Task, WorkspaceEntity, TaskPriority, TaskCategory } from '@/lib/types';
import type { TaskActor } from './task-core';
import { canUser } from '@/lib/workspace-permissions';
import { getErrorMessage } from '@/lib/errors/report-error';

export const BulkTaskCreationDataSchema = z.object({
  entityIds: z.array(z.string().min(1)).min(1, 'At least one entity ID must be provided.'),
  workspaceId: z.string().min(1, 'Workspace ID is required.'),
  organizationId: z.string().min(1, 'Organization ID is required.'),
  title: z.string().trim().min(1, 'Title is required.'),
  description: z.string().default(''),
  priority: z.enum(['low', 'medium', 'high', 'urgent'] as const),
  category: z.string().min(1, 'Category is required.'),
  dueDaysOffset: z.number().int().min(0).default(0),
});

export type BulkTaskCreationData = z.infer<typeof BulkTaskCreationDataSchema>;

export interface BulkTaskCreationResult {
  success: boolean;
  count?: number;
  message?: string;
  error?: string;
}

/**
 * Executes atomic bulk task creation with chunking and strict authorization.
 *
 * @param rawData Untrusted external payload (validated via BulkTaskCreationDataSchema)
 * @param actor Caller identity (verified User or System actor)
 */
export async function bulkCreateTasksCore(
  rawData: BulkTaskCreationData,
  actor: TaskActor
): Promise<BulkTaskCreationResult> {
  try {
    // Trust Boundary Matrix: validate input schema at runtime
    const data = BulkTaskCreationDataSchema.parse(rawData);

    // Authorization Boundary: verify permission if invoked by a user actor
    if (actor.kind === 'user') {
      const permission = await canUser(actor.uid, 'operations', 'tasks', 'create', data.workspaceId);
      if (!permission.granted) {
        return {
          success: false,
          error: permission.reason ?? 'User lacks operations:tasks:create permission.',
        };
      }
    }

    const {
      entityIds,
      workspaceId,
      organizationId,
      title,
      description,
      priority,
      category,
      dueDaysOffset,
    } = data;

    const now = new Date();
    const timestamp = now.toISOString();

    const dueDate = new Date(now.getTime() + dueDaysOffset * 24 * 60 * 60 * 1000);
    const dueDateString = dueDate.toISOString();

    const processedResults: string[] = [];
    // Firestore batch hard limit is 500 operations. We chunk at 450 for safety margin.
    const CHUNK_LIMIT = 450;

    for (let i = 0; i < entityIds.length; i += CHUNK_LIMIT) {
      const chunk = entityIds.slice(i, i + CHUNK_LIMIT);
      const batch = adminDb.batch();

      // Retrieve entity snapshots for accurate display names and entity types
      const entityRefs = chunk.map(id =>
        adminDb.collection('workspace_entities').doc(`${workspaceId}_${id}`)
      );

      const entitySnapshots = await adminDb.getAll(...entityRefs);

      entitySnapshots.forEach(snap => {
        if (!snap.exists) return;
        const entity = snap.data() as WorkspaceEntity;

        const taskRef = adminDb.collection('tasks').doc();
        const taskData: Omit<Task, 'id'> = {
          workspaceId,
          organizationId,
          entityId: entity.entityId,
          entityName: entity.displayName || null,
          entityType: entity.entityType || undefined,
          title,
          description: description || '',
          priority: priority as TaskPriority,
          status: 'todo',
          category: category as TaskCategory,
          dueDate: dueDateString,
          createdAt: timestamp,
          updatedAt: timestamp,
          assignedTo: entity.assignedTo?.userId || '',
          reminders: [],
          reminderSent: false,
          source: actor.kind === 'system' ? 'automation' : 'manual',
        };

        batch.set(taskRef, taskData);
        processedResults.push(taskRef.id);
      });

      await batch.commit();
    }

    return {
      success: true,
      count: processedResults.length,
      message: `Successfully initiated ${processedResults.length} administrative tasks.`,
    };
  } catch (error: unknown) {
    console.error('[bulkCreateTasksCore] Error:', error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
