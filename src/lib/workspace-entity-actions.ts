'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { validateScopeMatch } from './scope-guard';
import { revalidatePath } from 'next/cache';
import { 
  logWorkspaceEntityCreated, 
  logWorkspaceEntityUpdated, 
  logWorkspaceEntityDeleted 
} from './entity-audit';
import type { Entity, Workspace, WorkspaceEntity, EntityType } from './types';

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
 * Extracts primary contact information from an entity's contacts array
 */
function extractPrimaryContact(entity: Entity): { primaryEmail?: string; primaryPhone?: string } {
  if (!entity.contacts || entity.contacts.length === 0) {
    return {};
  }

  const primaryContact = entity.contacts[0];
  return {
    primaryEmail: primaryContact.email,
    primaryPhone: primaryContact.phone,
  };
}

interface LinkEntityToWorkspaceInput {
  entityId: string;
  workspaceId: string;
  pipelineId: string;
  stageId: string;
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
    const { primaryEmail, primaryPhone } = extractPrimaryContact(entity);

    // 7. Get stage name for denormalization
    let currentStageName: string | undefined;
    if (input.stageId) {
      const stageSnap = await adminDb.collection('stages').doc(input.stageId).get();
      if (stageSnap.exists) {
        currentStageName = stageSnap.data()?.name;
      }
    }

    // 8. Create workspace_entities document
    const workspaceEntityData: Omit<WorkspaceEntity, 'id'> = {
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      pipelineId: input.pipelineId,
      stageId: input.stageId,
      assignedTo: input.assignedTo,
      status: 'active',
      workspaceTags: [],
      addedAt: timestamp,
      updatedAt: timestamp,
      // Denormalized read-model fields
      displayName: entity.name,
      primaryEmail,
      primaryPhone,
      currentStageName,
    };

    const workspaceEntityRef = await adminDb.collection('workspace_entities').add(workspaceEntityData);

    // 9. Log audit trail (Requirement 29.4)
    await logWorkspaceEntityCreated({
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      userId: input.userId,
      userName: input.userName || 'Unknown User',
      userEmail: input.userEmail || '',
      newValue: { ...workspaceEntityData, id: workspaceEntityRef.id },
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
        workspaceEntityId: workspaceEntityRef.id,
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
      workspaceEntityId: workspaceEntityRef.id,
      scopeLocked: isFirstEntity,
    };
  } catch (e: any) {
    console.error('>>> [WORKSPACE_ENTITY:LINK] Failed:', e.message);
    return {
      success: false,
      error: e.message,
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
  } catch (e: any) {
    console.error('>>> [WORKSPACE_ENTITY:UNLINK] Failed:', e.message);
    return {
      success: false,
      error: e.message,
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
  } catch (e: any) {
    console.error('>>> [WORKSPACE_ENTITY:UPDATE] Failed:', e.message);
    return {
      success: false,
      error: e.message,
    };
  }
}
