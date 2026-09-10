'use server';

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { withEntitySearchFields } from './entities/entity-cache-domain';
import { deleteContactProjectionForEntity, syncContactProjectionForWE } from './contacts/contact-projection-writer';
import { logActivity } from './activity-logger';
import { validateScopeMatch } from './scope-guard';
import { revalidatePath } from 'next/cache';
import { 
  logWorkspaceEntityCreated, 
  logWorkspaceEntityUpdated, 
  logWorkspaceEntityDeleted 
} from './entity-audit';
import type { Entity, Workspace, WorkspaceEntity } from './types';
import { extractPrimaryContactFields } from './entity-contact-helpers';
import { filterAndSortEntities, type FilterStateInput } from './utils/entity-filter-util';
import { requireAuth, requireWorkspace } from '@/lib/auth/require-auth';
import { getErrorMessage } from '@/lib/errors/report-error';

/**
 * @fileOverview Server actions for workspace-entity relationship management.
 * Handles linking, unlinking, and updating workspace-entity associations.
 * 
 * Key architectural principles:
 * 1. WorkspaceEntity documents store workspace-specific operational state (pipeline, stage, assignee, workspace tags)
 * 2. Entity documents store only stable identity data (no pipeline state)
 * 3. ScopeGuard must be enforced: entity.entityType === workspace.contactScope
 * 4. Workspace scope locks after first entity is linked
 * 5. Pipeline and stage state is isolated per workspace
 */

/**
 * Extracts primary contact information from an entity's contacts.
 * FER-01: Now resolves from entityContacts (isPrimary flag) via helpers.
 */
function extractPrimaryContact(entity: Entity): { primaryContactName?: string; primaryEmail?: string; primaryPhone?: string } {
  const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContactFields(entity);
  
  return {
    primaryContactName: primaryContactName || undefined,
    primaryEmail: primaryEmail || undefined,
    primaryPhone: primaryPhone || undefined,
  };
}

interface LinkEntityToWorkspaceInput {
  entityId: string;
  workspaceId: string;
  pipelineId?: string;
  stageId?: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  };
  userId: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Links an entity to a workspace, creating a workspace_entities document.
 * 
 * Validates:
 * - Entity exists
 * - Workspace exists
 * - ScopeGuard: entity.entityType === workspace.contactScope
 * 
 * Creates workspace_entities document with denormalized fields.
 * Locks workspace contactScope if this is the first entity.
 * Logs workspace_scope_locked activity if applicable.
 * 
 * Requirements: 3, 4, 6
 */
export async function linkEntityToWorkspaceAction(input: LinkEntityToWorkspaceInput) {
  try {
    const timestamp = new Date().toISOString();

    // 1. Validate entity exists
    const entityRef = adminDb.collection('entities').doc(input.entityId);
    const entitySnap = await entityRef.get();

    if (!entitySnap.exists) {
      return {
        success: false,
        error: 'Entity not found',
      };
    }

    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

    // 2. Validate workspace exists
    const workspaceRef = adminDb.collection('workspaces').doc(input.workspaceId);
    const workspaceSnap = await workspaceRef.get();

    if (!workspaceSnap.exists) {
      return {
        success: false,
        error: 'Workspace not found',
      };
    }

    const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;

    // HARD MULTI-TENANT BOUNDARY CHECK (Security Principle)
    if (entity.organizationId !== workspace.organizationId) {
      console.error(
        `[SECURITY ALERT] Cross-organization link rejected! Entity org: ${entity.organizationId}, Workspace org: ${workspace.organizationId}`
      );
      return {
        success: false,
        error: 'Tenant boundary violation: Entity belongs to a different organization.',
      };
    }

    // 3. Enforce ScopeGuard: entity.entityType === workspace.contactScope
    if (!workspace.contactScope) {
      return {
        success: false,
        error: 'Workspace does not have a contact scope defined',
      };
    }

    const scopeValidation = validateScopeMatch(entity.entityType, workspace.contactScope);
    if (!scopeValidation.valid) {
      const validationError = scopeValidation.error;
      
      // Log scope violation
      await logActivity({
        organizationId: entity.organizationId,
        workspaceId: input.workspaceId,
        entityId: input.entityId,
        entityType: entity.entityType,
        displayName: entity.name,
        entitySlug: entity.slug,
        userId: input.userId,
        type: 'scope_violation',
        source: 'user_action',
        description: `Attempted to link ${entity.entityType} entity to workspace with scope ${workspace.contactScope}`,
        metadata: {
          error: validationError,
        },
      });

      return {
        success: false,
        error: validationError.message,
        code: validationError.code,
      };
    }

    // 4. Check if link already exists
    const existingLinkSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', input.workspaceId)
      .where('entityId', '==', input.entityId)
      .limit(1)
      .get();

    if (!existingLinkSnap.empty) {
      return {
        success: false,
        error: 'Entity is already linked to this workspace',
      };
    }

    // 5. Check if this is the first entity in the workspace (for scope locking)
    const workspaceEntitiesSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', input.workspaceId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    const isFirstEntity = workspaceEntitiesSnap.empty;

    // 6. Extract denormalized fields from entity
    const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContact(entity);

    // 7. Get stage name for denormalization
    let currentStageName: string | undefined;
    if (input.stageId) {
      const stageSnap = await adminDb.collection('stages').doc(input.stageId).get();
      if (stageSnap.exists) {
        currentStageName = stageSnap.data()?.name;
      }
    }

    // 8. Create workspace_entities document with deterministic document key
    const workspaceEntityId = `${input.workspaceId}_${input.entityId}`;
    const workspaceEntityData: WorkspaceEntity = withEntitySearchFields({
      id: workspaceEntityId,
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      assignedTo: input.assignedTo,
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      // Denormalized read-model fields (displayNameLower stamped by helper)
      displayName: entity.name,
      primaryContactName: primaryContactName || primaryEmail || entity.name,
      primaryEmail,
      primaryPhone,
      entityContacts: entity.entityContacts || [],
    });

    await adminDb.collection('workspace_entities').doc(workspaceEntityId).set(workspaceEntityData, { merge: true });

    // Atomically append target workspace to master entity's workspaceIds
    await adminDb.collection('entities').doc(input.entityId).update({
      workspaceIds: FieldValue.arrayUnion(input.workspaceId),
      updatedAt: timestamp,
    });

    // Project contacts into workspace_contacts (Phase 6.1) — read-model, non-blocking
    await syncContactProjectionForWE(workspaceEntityData).catch((projErr: Error) => {
      console.warn('[linkEntityToWorkspaceAction] Contact projection sync error:', projErr.message);
    });

    // 9. Log audit trail (Requirement 29.4)
    await logWorkspaceEntityCreated({
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      userId: input.userId,
      userName: input.userName || 'Unknown User',
      userEmail: input.userEmail || '',
      newValue: workspaceEntityData,
      operationContext: 'manual_edit',
    });

    // 10. Lock workspace contactScope if this is the first entity
    if (isFirstEntity) {
      await workspaceRef.update({
        scopeLocked: true,
        updatedAt: timestamp,
      });

      // Log workspace_scope_locked activity
      await logActivity({
        organizationId: entity.organizationId,
        workspaceId: input.workspaceId,
        userId: input.userId,
        type: 'workspace_scope_locked',
        source: 'system',
        description: `Workspace scope locked to "${workspace.contactScope}" after first entity was linked`,
        metadata: {
          contactScope: workspace.contactScope,
          firstEntityId: input.entityId,
          firstEntityName: entity.name,
        },
      });
    }

    // 11. Log entity linked activity
    await logActivity({
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      displayName: entity.name,
      entitySlug: entity.slug,
      userId: input.userId,
      type: 'entity_linked_to_workspace',
      source: 'user_action',
      description: `linked ${entity.entityType} entity "${entity.name}" to workspace`,
      metadata: {
        workspaceEntityId,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        isFirstEntity,
      },
    });

    revalidatePath('/admin/contacts');
    revalidatePath(`/admin/contacts/${input.entityId}`);
    revalidatePath(`/admin/workspaces/${input.workspaceId}`);

    return {
      success: true,
      workspaceEntityId,
      scopeLocked: isFirstEntity,
    };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error during entity linking';
    console.error('>>> [WORKSPACE_ENTITY:LINK] Failed:', errorMsg);
    return {
      success: false,
      error: errorMsg,
    };
  }
}

interface UnlinkEntityFromWorkspaceInput {
  workspaceEntityId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Unlinks an entity from a workspace by deleting the workspace_entities document.
 * 
 * Does NOT delete the entity document (preserves identity data).
 * Logs activity.
 * 
 * Requirements: 3
 */
export async function unlinkEntityFromWorkspaceAction(input: UnlinkEntityFromWorkspaceInput) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const timestamp = new Date().toISOString();

    // 1. Validate workspace_entities record exists
    const workspaceEntityRef = adminDb.collection('workspace_entities').doc(input.workspaceEntityId);
    const workspaceEntitySnap = await workspaceEntityRef.get();

    if (!workspaceEntitySnap.exists) {
      return {
        success: false,
        error: 'Workspace-entity relationship not found',
      };
    }

    const workspaceEntity = { id: workspaceEntitySnap.id, ...workspaceEntitySnap.data() } as WorkspaceEntity;

    // 2. Get entity details for logging
    const entityRef = adminDb.collection('entities').doc(workspaceEntity.entityId);
    const entitySnap = await entityRef.get();
    const entity = entitySnap.exists ? ({ id: entitySnap.id, ...entitySnap.data() } as Entity) : null;

    // 3. Delete workspace_entities document
    await workspaceEntityRef.delete();

    // Cascade-delete projected contacts for this entity (Phase 6.1)
    await deleteContactProjectionForEntity(workspaceEntity.workspaceId, workspaceEntity.entityId);

    // 4. Log audit trail (Requirement 29.4)
    await logWorkspaceEntityDeleted({
      organizationId: workspaceEntity.organizationId,
      workspaceId: workspaceEntity.workspaceId,
      entityId: workspaceEntity.entityId,
      entityType: workspaceEntity.entityType,
      userId: input.userId,
      userName: input.userName || 'Unknown User',
      userEmail: input.userEmail || '',
      oldValue: workspaceEntity,
      operationContext: 'manual_edit',
    });

    // 5. Log activity
    await logActivity({
      organizationId: workspaceEntity.organizationId,
      workspaceId: workspaceEntity.workspaceId,
      entityId: workspaceEntity.entityId,
      entityType: workspaceEntity.entityType,
      displayName: workspaceEntity.displayName,
      entitySlug: entity?.slug,
      userId: input.userId,
      type: 'entity_unlinked_from_workspace',
      source: 'user_action',
      description: `unlinked ${workspaceEntity.entityType} entity "${workspaceEntity.displayName}" from workspace`,
      metadata: {
        workspaceEntityId: input.workspaceEntityId,
        deletedAt: timestamp,
      },
    });

    revalidatePath('/admin/contacts');
    if (entity) {
      revalidatePath(`/admin/contacts/${workspaceEntity.entityId}`);
    }
    revalidatePath(`/admin/workspaces/${workspaceEntity.workspaceId}`);

    return {
      success: true,
    };
  } catch (e: unknown) {
    console.error('>>> [WORKSPACE_ENTITY:UNLINK] Failed:', getErrorMessage(e));
    return {
      success: false,
      error: getErrorMessage(e),
    };
  }
}

interface UpdateWorkspaceEntityInput {
  workspaceEntityId: string;
  pipelineId?: string;
  stageId?: string;
  assignedTo?: {
    userId: string | null;
    name: string | null;
    email: string | null;
  };
  status?: 'active' | 'archived';
  workspaceTags?: string[];
  userId: string;
  userName?: string;
  userEmail?: string;
}

/**
 * Updates workspace-specific fields on a workspace_entities document.
 * 
 * Updates: pipelineId, stageId, assignedTo, status, workspaceTags
 * Does NOT update entity root fields (those belong on the entity document)
 * Logs activity.
 * 
 * Requirements: 3, 5
 */
export async function updateWorkspaceEntityAction(input: UpdateWorkspaceEntityInput) {
  try {
    const timestamp = new Date().toISOString();

    // 1. Validate workspace_entities record exists
    const workspaceEntityRef = adminDb.collection('workspace_entities').doc(input.workspaceEntityId);
    const workspaceEntitySnap = await workspaceEntityRef.get();

    if (!workspaceEntitySnap.exists) {
      return {
        success: false,
        error: 'Workspace-entity relationship not found',
      };
    }

    const workspaceEntity = { id: workspaceEntitySnap.id, ...workspaceEntitySnap.data() } as WorkspaceEntity;

    // 2. Build update object (only workspace-specific fields)
    const updates: any = {
      updatedAt: timestamp,
    };

    if (input.pipelineId !== undefined) {
      updates.pipelineId = input.pipelineId;
    }

    if (input.stageId !== undefined) {
      updates.stageId = input.stageId;

      // Update denormalized stage name
      const stageSnap = await adminDb.collection('stages').doc(input.stageId).get();
      if (stageSnap.exists) {
        updates.currentStageName = stageSnap.data()?.name;
      }
    }

    if (input.assignedTo !== undefined) {
      updates.assignedTo = input.assignedTo;
    }

    if (input.status !== undefined) {
      updates.status = input.status;
    }

    if (input.workspaceTags !== undefined) {
      updates.workspaceTags = input.workspaceTags;
    }

    // 3. Update workspace_entities document
    await workspaceEntityRef.update(updates);

    // 4. Log audit trail (Requirement 29.4)
    const updatedWorkspaceEntity = { ...workspaceEntity, ...updates };
    await logWorkspaceEntityUpdated({
      organizationId: workspaceEntity.organizationId,
      workspaceId: workspaceEntity.workspaceId,
      entityId: workspaceEntity.entityId,
      entityType: workspaceEntity.entityType,
      userId: input.userId,
      userName: input.userName || 'Unknown User',
      userEmail: input.userEmail || '',
      oldValue: workspaceEntity,
      newValue: updatedWorkspaceEntity,
      changedFields: Object.keys(updates).filter(k => k !== 'updatedAt'),
      operationContext: 'manual_edit',
    });

    // 5. Get entity details for logging
    const entityRef = adminDb.collection('entities').doc(workspaceEntity.entityId);
    const entitySnap = await entityRef.get();
    const entity = entitySnap.exists ? ({ id: entitySnap.id, ...entitySnap.data() } as Entity) : null;

    // 6. Log activity
    await logActivity({
      organizationId: workspaceEntity.organizationId,
      workspaceId: workspaceEntity.workspaceId,
      entityId: workspaceEntity.entityId,
      entityType: workspaceEntity.entityType,
      displayName: workspaceEntity.displayName,
      entitySlug: entity?.slug,
      userId: input.userId,
      type: 'workspace_entity_updated',
      source: 'user_action',
      description: `updated workspace relationship for ${workspaceEntity.entityType} entity "${workspaceEntity.displayName}"`,
      metadata: {
        workspaceEntityId: input.workspaceEntityId,
        updatedFields: Object.keys(updates).filter(k => k !== 'updatedAt'),
        updates,
      },
    });

    revalidatePath('/admin/contacts');
    if (entity) {
      revalidatePath(`/admin/contacts/${workspaceEntity.entityId}`);
    }
    revalidatePath(`/admin/workspaces/${workspaceEntity.workspaceId}`);

    return {
      success: true,
    };
  } catch (e: unknown) {
    console.error('>>> [WORKSPACE_ENTITY:UPDATE] Failed:', getErrorMessage(e));
    return {
      success: false,
      error: getErrorMessage(e),
    };
  }
}

export interface ArchiveEntityInput {
  workspaceEntityId: string;
  entityId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  archiveAllWorkspaces?: boolean;
}

/**
 * Archives a workspace_entities record.
 * If archiveAllWorkspaces is true, archives all workspace_entities for this entity ID within the organization.
 */
export async function archiveEntityAction(input: ArchiveEntityInput) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const timestamp = new Date().toISOString();
    const weRef = adminDb.collection('workspace_entities').doc(input.workspaceEntityId);
    const weSnap = await weRef.get();
    if (!weSnap.exists) return { success: false, error: 'Workspace-entity record not found' };

    const weData = { id: weSnap.id, ...weSnap.data() } as WorkspaceEntity;

    if (input.archiveAllWorkspaces) {
      const allWeSnap = await adminDb.collection('workspace_entities')
        .where('entityId', '==', input.entityId)
        .where('organizationId', '==', weData.organizationId)
        .get();

      const batch = adminDb.batch();
      const updatedEntities: WorkspaceEntity[] = [];
      allWeSnap.forEach(docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() } as WorkspaceEntity;
        if (data.status !== 'archived') {
          batch.update(docSnap.ref, {
            status: 'archived',
            updatedAt: timestamp
          });
          updatedEntities.push(data);
        }
      });

      if (updatedEntities.length > 0) {
        await batch.commit();

        for (const entity of updatedEntities) {
          const updatedValue = { ...entity, status: 'archived', updatedAt: timestamp };
          await logWorkspaceEntityUpdated({
            organizationId: entity.organizationId,
            workspaceId: entity.workspaceId,
            entityId: entity.entityId,
            entityType: entity.entityType,
            userId: input.userId,
            userName: input.userName || 'Unknown User',
            userEmail: input.userEmail || '',
            oldValue: entity,
            newValue: updatedValue,
            changedFields: ['status'],
            operationContext: 'manual_edit',
          });

          await logActivity({
            organizationId: entity.organizationId,
            workspaceId: entity.workspaceId,
            entityId: entity.entityId,
            entityType: entity.entityType,
            displayName: entity.displayName,
            userId: input.userId,
            type: 'workspace_entity_updated',
            source: 'user_action',
            description: `archived ${entity.entityType} entity "${entity.displayName}" (organization-wide)`,
            metadata: {
              workspaceEntityId: entity.id,
              updatedFields: ['status'],
              status: 'archived',
            },
          });
        }
      }
    } else {
      await weRef.update({
        status: 'archived',
        updatedAt: timestamp
      });

      const updatedValue = { ...weData, status: 'archived', updatedAt: timestamp };
      await logWorkspaceEntityUpdated({
        organizationId: weData.organizationId,
        workspaceId: weData.workspaceId,
        entityId: weData.entityId,
        entityType: weData.entityType,
        userId: input.userId,
        userName: input.userName || 'Unknown User',
        userEmail: input.userEmail || '',
        oldValue: weData,
        newValue: updatedValue,
        changedFields: ['status'],
        operationContext: 'manual_edit',
      });

      await logActivity({
        organizationId: weData.organizationId,
        workspaceId: weData.workspaceId,
        entityId: weData.entityId,
        entityType: weData.entityType,
        displayName: weData.displayName,
        userId: input.userId,
        type: 'workspace_entity_updated',
        source: 'user_action',
        description: `archived ${weData.entityType} entity "${weData.displayName}"`,
        metadata: {
          workspaceEntityId: weData.id,
          updatedFields: ['status'],
          status: 'archived',
        },
      });
    }

    revalidatePath('/admin/entities');
    revalidatePath('/admin/contacts');
    return { success: true };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error during archive';
    console.error('>>> [WORKSPACE_ENTITY:ARCHIVE] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

export interface DeleteEntityPermanentlyInput {
  workspaceEntityId: string;
  entityId: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  /** If true (default), also purges root entities doc when no memberships remain */
  purgeRootEntity?: boolean;
  /** If true, deletes all workspace entities in the organization for this entity and the root entities doc */
  deleteAllWorkspaces?: boolean;
}

/**
 * Permanently deletes archived workspace_entities records.
 * If deleteAllWorkspaces is true, deletes all workspace_entities in the organization for this entity and the root entities doc.
 * Otherwise, deletes only the specified workspace entity record.
 */
export async function deleteEntityPermanentlyAction(input: DeleteEntityPermanentlyInput) {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireAuth();

  try {
    const timestamp = new Date().toISOString();

    const weRef = adminDb.collection('workspace_entities').doc(input.workspaceEntityId);
    const weSnap = await weRef.get();
    if (!weSnap.exists) return { success: false, error: 'Workspace-entity record not found' };

    const weData = { id: weSnap.id, ...weSnap.data() } as WorkspaceEntity;
    if (weData.status !== 'archived') {
      return { success: false, error: 'Only archived entities can be permanently deleted.' };
    }

    let rootEntityDeleted = false;

    if (input.deleteAllWorkspaces) {
      const allWeSnap = await adminDb.collection('workspace_entities')
        .where('entityId', '==', input.entityId)
        .where('organizationId', '==', weData.organizationId)
        .get();

      const batch = adminDb.batch();
      const deletedEntities: WorkspaceEntity[] = [];
      allWeSnap.forEach(docSnap => {
        batch.delete(docSnap.ref);
        deletedEntities.push({ id: docSnap.id, ...docSnap.data() } as WorkspaceEntity);
      });

      await batch.commit();

      for (const entity of deletedEntities) {
        await deleteContactProjectionForEntity(entity.workspaceId, input.entityId);
      }

      await adminDb.collection('entities').doc(input.entityId).delete();
      rootEntityDeleted = true;

      for (const entity of deletedEntities) {
        await logWorkspaceEntityDeleted({
          organizationId: entity.organizationId,
          workspaceId: entity.workspaceId,
          entityId: entity.entityId,
          entityType: entity.entityType,
          userId: input.userId,
          userName: input.userName || 'Unknown User',
          userEmail: input.userEmail || '',
          oldValue: entity,
          operationContext: 'permanent_delete',
        });

        await logActivity({
          organizationId: entity.organizationId,
          workspaceId: entity.workspaceId,
          entityId: entity.entityId,
          entityType: entity.entityType,
          displayName: entity.displayName,
          userId: input.userId,
          type: 'entity_unlinked_from_workspace',
          source: 'user_action',
          description: `permanently deleted "${entity.displayName}" from workspace and organization`,
          metadata: { workspaceEntityId: entity.id, rootEntityDeleted: true, deletedAt: timestamp },
        });
      }
    } else {
      await weRef.delete();
      await deleteContactProjectionForEntity(weData.workspaceId, input.entityId);

      if (input.purgeRootEntity !== false) {
        const remainingSnap = await adminDb
          .collection('workspace_entities')
          .where('entityId', '==', input.entityId)
          .limit(1)
          .get();
        if (remainingSnap.empty) {
          await adminDb.collection('entities').doc(input.entityId).delete();
          rootEntityDeleted = true;
        }
      }

      await logWorkspaceEntityDeleted({
        organizationId: weData.organizationId,
        workspaceId: weData.workspaceId,
        entityId: weData.entityId,
        entityType: weData.entityType,
        userId: input.userId,
        userName: input.userName || 'Unknown User',
        userEmail: input.userEmail || '',
        oldValue: weData,
        operationContext: 'permanent_delete',
      });

      await logActivity({
        organizationId: weData.organizationId,
        workspaceId: weData.workspaceId,
        entityId: weData.entityId,
        entityType: weData.entityType,
        displayName: weData.displayName,
        userId: input.userId,
        type: 'entity_unlinked_from_workspace',
        source: 'user_action',
        description: `permanently deleted "${weData.displayName}" from workspace${rootEntityDeleted ? ' and purged root record' : ''}`,
        metadata: { workspaceEntityId: input.workspaceEntityId, rootEntityDeleted, deletedAt: timestamp },
      });
    }

    revalidatePath('/admin/entities');
    revalidatePath('/admin/contacts');
    return { success: true, rootEntityDeleted };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error during permanent delete';
    console.error('>>> [WORKSPACE_ENTITY:PERMANENT_DELETE] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

export interface BulkArchiveEntitiesInput {
  workspaceEntityIds: string[];
  userId: string;
  userName?: string;
  userEmail?: string;
  archiveAllWorkspaces?: boolean;
}

/**
 * Helper to query workspace entities in chunks of 30 to avoid Firestore IN-clause limitations.
 */
async function queryWorkspaceEntitiesInChunks(entityIds: string[], organizationId: string): Promise<WorkspaceEntity[]> {
  const chunkSize = 30;
  const results: WorkspaceEntity[] = [];
  const chunks: string[][] = [];

  for (let i = 0; i < entityIds.length; i += chunkSize) {
    chunks.push(entityIds.slice(i, i + chunkSize));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      const snap = await adminDb.collection('workspace_entities')
        .where('entityId', 'in', chunk)
        .where('organizationId', '==', organizationId)
        .get();
      snap.forEach(docSnap => {
        results.push({ id: docSnap.id, ...docSnap.data() } as WorkspaceEntity);
      });
    })
  );

  return results;
}

/**
 * Bulk archives selected workspace_entities documents.
 * Employs batch chunking (max 250 operations per batch) to ensure firestore constraints aren't exceeded.
 */
export async function bulkArchiveEntitiesAction(input: BulkArchiveEntitiesInput) {
  try {
    const timestamp = new Date().toISOString();
    const { workspaceEntityIds, userId, userName, userEmail, archiveAllWorkspaces = false } = input;

    if (!workspaceEntityIds || workspaceEntityIds.length === 0) {
      return { success: false, error: 'No entities selected' };
    }

    const refs = workspaceEntityIds.map(id => adminDb.collection('workspace_entities').doc(id));
    const snaps = await adminDb.getAll(...refs);

    const validEntities: WorkspaceEntity[] = [];
    const entityIdsToArchive = new Set<string>();
    let organizationId = 'default';

    for (const snap of snaps) {
      if (snap.exists) {
        const data = { id: snap.id, ...snap.data() } as WorkspaceEntity;
        if (data.status !== 'archived') {
          validEntities.push(data);
          entityIdsToArchive.add(data.entityId);
          organizationId = data.organizationId;
        }
      }
    }

    if (validEntities.length === 0) {
      return { success: true, count: 0 };
    }

    let entitiesToUpdate: WorkspaceEntity[] = [];

    if (archiveAllWorkspaces) {
      const entityIdsArray = Array.from(entityIdsToArchive);
      const allWe = await queryWorkspaceEntitiesInChunks(entityIdsArray, organizationId);
      entitiesToUpdate = allWe.filter(e => e.status !== 'archived');
    } else {
      entitiesToUpdate = validEntities;
    }

    if (entitiesToUpdate.length === 0) {
      return { success: true, count: 0 };
    }

    const chunks: WorkspaceEntity[][] = [];
    const chunkSize = 250;
    for (let i = 0; i < entitiesToUpdate.length; i += chunkSize) {
      chunks.push(entitiesToUpdate.slice(i, i + chunkSize));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        const batch = adminDb.batch();
        for (const entity of chunk) {
          batch.update(adminDb.collection('workspace_entities').doc(entity.id), {
            status: 'archived',
            updatedAt: timestamp,
          });
        }
        await batch.commit();
      })
    );

    const logPromises = entitiesToUpdate.map(async (weData) => {
      const updatedValue = { ...weData, status: 'archived', updatedAt: timestamp };
      try {
        await logWorkspaceEntityUpdated({
          organizationId: weData.organizationId,
          workspaceId: weData.workspaceId,
          entityId: weData.entityId,
          entityType: weData.entityType,
          userId,
          userName: userName || 'Unknown User',
          userEmail: userEmail || '',
          oldValue: weData,
          newValue: updatedValue,
          changedFields: ['status'],
          operationContext: 'manual_edit',
        });

        await logActivity({
          organizationId: weData.organizationId,
          workspaceId: weData.workspaceId,
          entityId: weData.entityId,
          entityType: weData.entityType,
          displayName: weData.displayName,
          userId,
          type: 'workspace_entity_updated',
          source: 'user_action',
          description: `archived ${weData.entityType} entity "${weData.displayName}"${archiveAllWorkspaces ? ' (organization-wide)' : ''}`,
          metadata: {
            workspaceEntityId: weData.id,
            updatedFields: ['status'],
            status: 'archived',
          },
        });
      } catch (err) {
        console.error(`>>> [BULK_ARCHIVE:LOG] Failed for ${weData.id}:`, err);
      }
    });

    Promise.all(logPromises).catch(err => {
      console.error('>>> [BULK_ARCHIVE:LOGGER_PROMISES_FAIL]', err);
    });

    revalidatePath('/admin/entities');
    revalidatePath('/admin/contacts');

    return { success: true, count: entitiesToUpdate.length };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error during bulk archive';
    console.error('>>> [WORKSPACE_ENTITY:BULK_ARCHIVE] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

export interface BulkDeleteEntitiesInput {
  workspaceEntityIds: string[];
  userId: string;
  userName?: string;
  userEmail?: string;
  purgeRootEntity?: boolean;
  deleteAllWorkspaces?: boolean;
}

/**
 * Bulk permanently deletes selected archived workspace_entities documents.
 * Validates that all targets are currently archived.
 */
export async function bulkDeleteEntitiesAction(input: BulkDeleteEntitiesInput) {
  try {
    const timestamp = new Date().toISOString();
    const { workspaceEntityIds, userId, userName, userEmail, purgeRootEntity = true, deleteAllWorkspaces = false } = input;

    if (!workspaceEntityIds || workspaceEntityIds.length === 0) {
      return { success: false, error: 'No entities selected' };
    }

    const refs = workspaceEntityIds.map(id => adminDb.collection('workspace_entities').doc(id));
    const snaps = await adminDb.getAll(...refs);

    const validEntities: WorkspaceEntity[] = [];
    const entityIdsToDelete = new Set<string>();
    let organizationId = 'default';

    for (const snap of snaps) {
      if (snap.exists) {
        const data = { id: snap.id, ...snap.data() } as WorkspaceEntity;
        if (data.status === 'archived') {
          validEntities.push(data);
          entityIdsToDelete.add(data.entityId);
          organizationId = data.organizationId;
        }
      }
    }

    if (validEntities.length === 0) {
      return { success: false, error: 'Only archived entities can be permanently deleted. Please archive them first.' };
    }

    let entitiesToDelete: WorkspaceEntity[] = [];

    if (deleteAllWorkspaces) {
      const entityIdsArray = Array.from(entityIdsToDelete);
      entitiesToDelete = await queryWorkspaceEntitiesInChunks(entityIdsArray, organizationId);
    } else {
      entitiesToDelete = validEntities;
    }

    if (entitiesToDelete.length === 0) {
      return { success: true, count: 0 };
    }

    const chunks: WorkspaceEntity[][] = [];
    const chunkSize = 250;
    for (let i = 0; i < entitiesToDelete.length; i += chunkSize) {
      chunks.push(entitiesToDelete.slice(i, i + chunkSize));
    }

    await Promise.all(
      chunks.map(async (chunk) => {
        const batch = adminDb.batch();
        for (const we of chunk) {
          batch.delete(adminDb.collection('workspace_entities').doc(we.id));
        }
        await batch.commit();
      })
    );

    for (const entity of entitiesToDelete) {
      await deleteContactProjectionForEntity(entity.workspaceId, entity.entityId);
    }

    let purgedRootCount = 0;
    if (deleteAllWorkspaces) {
      const rootPurgeBatch = adminDb.batch();
      for (const entityId of Array.from(entityIdsToDelete)) {
        rootPurgeBatch.delete(adminDb.collection('entities').doc(entityId));
        purgedRootCount++;
      }
      await rootPurgeBatch.commit();
    } else if (purgeRootEntity) {
      const rootPurgeBatch = adminDb.batch();
      let hasRootDeletes = false;
      for (const entityId of Array.from(entityIdsToDelete)) {
        const remainingSnap = await adminDb
          .collection('workspace_entities')
          .where('entityId', '==', entityId)
          .limit(1)
          .get();
        if (remainingSnap.empty) {
          rootPurgeBatch.delete(adminDb.collection('entities').doc(entityId));
          hasRootDeletes = true;
          purgedRootCount++;
        }
      }
      if (hasRootDeletes) {
        await rootPurgeBatch.commit();
      }
    }

    const logPromises = entitiesToDelete.map(async (weData) => {
      try {
        await logWorkspaceEntityDeleted({
          organizationId: weData.organizationId,
          workspaceId: weData.workspaceId,
          entityId: weData.entityId,
          entityType: weData.entityType,
          userId,
          userName: userName || 'Unknown User',
          userEmail: userEmail || '',
          oldValue: weData,
          operationContext: 'permanent_delete',
        });

        await logActivity({
          organizationId: weData.organizationId,
          workspaceId: weData.workspaceId,
          entityId: weData.entityId,
          entityType: weData.entityType,
          displayName: weData.displayName,
          userId,
          type: 'entity_unlinked_from_workspace',
          source: 'user_action',
          description: `permanently deleted "${weData.displayName}" from workspace${deleteAllWorkspaces ? ' and organization' : ''}`,
          metadata: {
            workspaceEntityId: weData.id,
            deletedAt: timestamp,
          },
        });
      } catch (err) {
        console.error(`>>> [BULK_DELETE:LOG] Failed for ${weData.id}:`, err);
      }
    });

    Promise.all(logPromises).catch(err => {
      console.error('>>> [BULK_DELETE:LOGGER_PROMISES_FAIL]', err);
    });

    revalidatePath('/admin/entities');
    revalidatePath('/admin/contacts');

    return { 
      success: true, 
      count: entitiesToDelete.length, 
      purgedRootCount 
    };
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : 'Unknown error during bulk delete';
    console.error('>>> [WORKSPACE_ENTITY:BULK_DELETE] Failed:', errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Server-side helper to filter and sort all workspace entities and return matching document IDs.
 */
export async function getFilteredEntityIdsAction(
  workspaceId: string,
  filterState: FilterStateInput,
  assignedUserId: string | null | undefined,
  tagFilteredIdsArray: string[] | null | undefined,
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  // SECURITY (audit F2): Server Actions are public endpoints — this ran unauthenticated.
  await requireWorkspace(workspaceId);

  try {
    let q = adminDb.collection('workspace_entities')
      .where('workspaceId', '==', workspaceId);

    // Apply basic status filter in query to reduce Firestore document reads
    if (filterState.status && filterState.status !== 'all') {
      q = q.where('status', '==', filterState.status);
    }
    
    // Apply basic assignee filter in query if set and is not "unassigned"
    if (assignedUserId && assignedUserId !== 'unassigned') {
      q = q.where('assignedTo.userId', '==', assignedUserId);
    }

    // Select only fields needed for matching, filtering, and sorting to optimize bandwidth
    const snap = await q.select(
      'entityId',
      'displayName',
      'primaryContactName',
      'primaryEmail',
      'primaryPhone',
      'status',
      'locationCountryId',
      'locationRegionId',
      'locationDistrictId',
      'workspaceTags',
      'addedAt',
      'interests',
      'assignedTo',
      'entityContacts'
    ).get();

    const entities = snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    const tagFilteredIds = tagFilteredIdsArray ? new Set(tagFilteredIdsArray) : null;

    // Perform full-text search, multi-tag matching, cascading locations, and other complex logic in-memory
    const filtered = filterAndSortEntities(
      entities,
      filterState,
      assignedUserId,
      tagFilteredIds,
      undefined, // Cache matches are checked via emailVerificationCache
      null, // Saved audience matched IDs are evaluated client-side
      sortConfig
    );

    return {
      success: true,
      data: filtered.map(e => e.id)
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to get filtered entity IDs';
    console.error('>>> [WORKSPACE_ENTITY:GET_FILTERED_IDS] Failed:', msg);
    return { success: false, error: msg };
  }
}

/**
 * ARCHITECTURAL GUIDANCE FOR MAINTAINERS (Rule 10):
 * Server helper to idempotently share an entity to a target workspace within the same organization.
 * 
 * 1. Zero-Duplication: Links master entity from `entities/{entityId}` into `workspace_entities/{targetWorkspaceId}_{entityId}`.
 * 2. Multi-Tenant Isolation: Strictly asserts `entity.organizationId === organizationId`. Cross-org links fail immediately.
 * 3. ScopeGuard Validation: Enforces that entity type matches target workspace contact scope.
 * 4. Idempotency & High Load: Uses deterministic key `${targetWorkspaceId}_${entityId}` with merge set.
 * 5. Testability: Covered in `src/lib/__tests__/survey-cross-workspace-sharing.test.ts`.
 */
export interface EnsureEntitySharedInput {
  entityId: string;
  targetWorkspaceId: string;
  organizationId?: string;
  sourceContext?: string;
  contactId?: string | null;
  reason?: string;
  actor?: {
    userId: string;
    displayName: string;
  };
}

export interface EnsureEntitySharedResult {
  success: boolean;
  isNewShare: boolean;
  alreadyShared?: boolean;
  workspaceEntityId: string;
  error?: string;
}

export async function ensureEntitySharedToWorkspace(
  input: EnsureEntitySharedInput
): Promise<EnsureEntitySharedResult> {
  try {
    const { entityId, targetWorkspaceId, sourceContext, reason, actor } = input;
    if (!entityId || !targetWorkspaceId) {
      return {
        success: false,
        isNewShare: false,
        alreadyShared: false,
        workspaceEntityId: '',
        error: 'Missing required parameters: entityId and targetWorkspaceId are required',
      };
    }

    const deterministicWeId = `${targetWorkspaceId}_${entityId}`;

    // 1. Fast path: check if workspace entity link already exists
    const existingWeSnap = await adminDb.collection('workspace_entities').doc(deterministicWeId).get();
    if (existingWeSnap.exists) {
      const existingData = existingWeSnap.data() as WorkspaceEntity;
      if (existingData.status === 'active') {
        // Ensure master entity's workspaceIds includes targetWorkspaceId
        await adminDb.collection('entities').doc(entityId).update({
          workspaceIds: FieldValue.arrayUnion(targetWorkspaceId),
        }).catch((err: Error) => console.warn('[ensureEntitySharedToWorkspace] arrayUnion catch:', err.message));

        return {
          success: true,
          isNewShare: false,
          alreadyShared: true,
          workspaceEntityId: deterministicWeId,
        };
      }
    }

    // 2. Fetch master entity document
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    if (!entitySnap.exists) {
      return {
        success: false,
        isNewShare: false,
        alreadyShared: false,
        workspaceEntityId: '',
        error: `Master entity "${entityId}" not found`,
      };
    }

    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

    // Fetch target workspace to validate existence and determine organization
    const workspaceRef = adminDb.collection('workspaces').doc(targetWorkspaceId);
    const workspaceSnap = await workspaceRef.get();
    if (!workspaceSnap.exists) {
      return {
        success: false,
        isNewShare: false,
        alreadyShared: false,
        workspaceEntityId: '',
        error: `Target workspace "${targetWorkspaceId}" not found`,
      };
    }

    const workspace = { id: workspaceSnap.id, ...workspaceSnap.data() } as Workspace;
    const targetOrgId = input.organizationId || workspace.organizationId;

    // 3. HARD MULTI-TENANT BOUNDARY CHECK (Security Principle)
    if (entity.organizationId !== targetOrgId || workspace.organizationId !== targetOrgId) {
      console.error(
        `[SECURITY ALERT] Cross-organization entity share blocked! Entity org: ${entity.organizationId}, Target org: ${targetOrgId}, Workspace org: ${workspace.organizationId}`
      );
      return {
        success: false,
        isNewShare: false,
        alreadyShared: false,
        workspaceEntityId: '',
        error: 'Tenant boundary violation: Entity belongs to a different organization.',
      };
    }

    // 4. Validate ScopeGuard
    const targetScope = workspace.contactScope || 'institution';
    const scopeValidation = validateScopeMatch(entity.entityType, targetScope);
    if (!scopeValidation.valid) {
      console.warn(
        `[ScopeGuard] Scope mismatch when sharing entity ${entityId} (${entity.entityType}) to workspace ${targetWorkspaceId} (${targetScope})`
      );
      return {
        success: false,
        isNewShare: false,
        alreadyShared: false,
        workspaceEntityId: '',
        error: `Scope mismatch: cannot link ${entity.entityType} to ${targetScope} workspace.`,
      };
    }

    // 5. Extract contact fields
    const { primaryContactName, primaryEmail, primaryPhone } = extractPrimaryContact(entity);
    const timestamp = new Date().toISOString();

    // 6. Construct deterministic WorkspaceEntity data
    const workspaceEntityData: WorkspaceEntity = withEntitySearchFields({
      id: deterministicWeId,
      organizationId: entity.organizationId,
      workspaceId: targetWorkspaceId,
      entityId: entity.id,
      entityType: entity.entityType,
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      displayName: entity.name,
      primaryContactName: primaryContactName || primaryEmail || entity.name,
      primaryEmail,
      primaryPhone,
      entityContacts: entity.entityContacts || [],
    });

    // 7. Write workspace_entities idempotently
    await adminDb.collection('workspace_entities').doc(deterministicWeId).set(workspaceEntityData, { merge: true });

    // 8. Update master entity workspaceIds array
    await entityRef.update({
      workspaceIds: FieldValue.arrayUnion(targetWorkspaceId),
      updatedAt: timestamp,
    });

    // 9. Sync contact projection
    await syncContactProjectionForWE(workspaceEntityData).catch((projErr: Error) => {
      console.warn('[ensureEntitySharedToWorkspace] Contact projection sync error:', projErr.message);
    });

    // 10. Audit Activity Log
    await logActivity({
      organizationId: entity.organizationId,
      workspaceId: targetWorkspaceId,
      entityId: entity.id,
      entityType: entity.entityType,
      displayName: entity.name,
      entitySlug: entity.slug || '',
      userId: actor?.userId,
      type: 'entity_shared_to_workspace',
      source: actor ? 'user_action' : 'system',
      description: `Auto-shared ${entity.entityType} "${entity.name}" to workspace via ${reason || sourceContext || 'survey tracking'}`,
      metadata: {
        reason: reason || 'survey_tracking',
        sourceContext: sourceContext || 'survey_tracking',
        actor: actor || null,
        workspaceEntityId: deterministicWeId,
      },
    }).catch((logErr: Error) => console.warn('[ensureEntitySharedToWorkspace] Activity log error:', logErr.message));

    return {
      success: true,
      isNewShare: true,
      alreadyShared: false,
      workspaceEntityId: deterministicWeId,
    };
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to share entity to workspace';
    console.error('[ensureEntitySharedToWorkspace] Unexpected failure:', msg);
    return {
      success: false,
      isNewShare: false,
      alreadyShared: false,
      workspaceEntityId: '',
      error: msg,
    };
  }
}

