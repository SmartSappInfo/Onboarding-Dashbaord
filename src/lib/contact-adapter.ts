'use server';

import { adminDb } from './firebase-admin';
import type { School, Entity, WorkspaceEntity, EntityType, MigrationStatus, ResolvedContact } from './types';

/**
 * @fileOverview Backward Compatibility Adapter Layer
 * 
 * This adapter provides a unified interface for resolving contact data
 * from either the legacy `schools` collection or the new `entities` + `workspace_entities` model.
 * 
 * Key Functions:
 * - resolveContact: Returns unified contact object by checking migration status
 * - Supports gradual migration without breaking existing features
 * 
 * Requirements: 18
 */

/**
 * Resolves a contact by checking migration status and reading from appropriate collections.
 * 
 * Logic:
 * 1. Read from schools collection to check migrationStatus
 * 2. If migrationStatus is 'migrated', read from entities + workspace_entities
 * 3. If migrationStatus is 'legacy' or undefined, read from schools collection
 * 4. Return unified contact object
 * 
 * @param schoolId - The legacy school ID or entity ID
 * @param workspaceId - The workspace context for resolving workspace-specific state
 * @returns Unified contact object or null if not found
 * 
 * Requirements: 18
 */
export async function resolveContact(
  schoolId: string,
  workspaceId: string
): Promise<ResolvedContact | null> {
  try {
    // 1. Check if migration record exists for schoolId
    const schoolRef = adminDb.collection('schools').doc(schoolId);
    const schoolSnap = await schoolRef.get();

    if (!schoolSnap.exists) {
      // School doesn't exist, might be a direct entity ID
      // Try to resolve as entity
      return await resolveFromEntity(schoolId, workspaceId);
    }

    const schoolData = { id: schoolSnap.id, ...schoolSnap.data() } as School;
    const migrationStatus = schoolData.migrationStatus || 'legacy';

    // 2. If migrated, read from entities + workspace_entities
    if (migrationStatus === 'migrated') {
      // Find the entity that was created from this school
      // We'll use a migration mapping or search by name
      const entitySnap = await adminDb
        .collection('entities')
        .where('organizationId', '==', schoolData.workspaceIds?.[0] || '')
        .where('name', '==', schoolData.name)
        .where('entityType', '==', 'institution')
        .limit(1)
        .get();

      if (!entitySnap.empty) {
        const entity = { id: entitySnap.docs[0].id, ...entitySnap.docs[0].data() } as Entity;
        return await resolveFromEntity(entity.id, workspaceId, schoolData);
      }

      // Fallback to legacy if entity not found
      console.warn(`[ADAPTER] Entity not found for migrated school ${schoolId}, falling back to legacy`);
      // Return legacy data but preserve the original migration status from the school record
      return resolveFromSchool(schoolData, workspaceId, true);
    }

    // 3. If not migrated, read from schools collection
    return resolveFromSchool(schoolData, workspaceId, false);
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to resolve contact ${schoolId}:`, error.message);
    return null;
  }
}

/**
 * Resolves contact data from the new entities + workspace_entities model
 */
async function resolveFromEntity(
  entityId: string,
  workspaceId: string,
  legacySchoolData?: School
): Promise<ResolvedContact | null> {
  try {
    // 1. Read entity document
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();

    if (!entitySnap.exists) {
      return null;
    }

    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

    // 2. Read workspace_entities document for this workspace
    const workspaceEntitySnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    let workspaceEntity: WorkspaceEntity | null = null;
    let workspaceEntityId: string | undefined;

    if (!workspaceEntitySnap.empty) {
      workspaceEntity = {
        id: workspaceEntitySnap.docs[0].id,
        ...workspaceEntitySnap.docs[0].data(),
      } as WorkspaceEntity;
      workspaceEntityId = workspaceEntitySnap.docs[0].id;
    }

    // 3. Build unified contact object
    const resolved: ResolvedContact = {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      contacts: entity.contacts || [],
      // Workspace-specific state from workspace_entities
      pipelineId: workspaceEntity?.pipelineId,
      stageId: workspaceEntity?.stageId,
      stageName: workspaceEntity?.currentStageName,
      assignedTo: workspaceEntity?.assignedTo,
      status: workspaceEntity?.status,
      tags: workspaceEntity?.workspaceTags || [],
      globalTags: entity.globalTags || [],
      // Entity metadata
      entityType: entity.entityType,
      entityId: entity.id,
      workspaceEntityId,
      // Migration tracking
      migrationStatus: 'migrated',
      // Include legacy school data if provided
      schoolData: legacySchoolData,
    };

    return resolved;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to resolve from entity ${entityId}:`, error.message);
    return null;
  }
}

/**
 * Resolves contact data from the legacy schools collection
 */
function resolveFromSchool(schoolData: School, workspaceId: string, forceLegacy: boolean = false): ResolvedContact {
  // Map school data to unified contact object
  const resolved: ResolvedContact = {
    id: schoolData.id,
    name: schoolData.name,
    slug: schoolData.slug,
    contacts: schoolData.focalPersons || [],
    // Workspace-specific state from school document
    pipelineId: schoolData.pipelineId,
    stageId: schoolData.stage?.id,
    stageName: schoolData.stage?.name,
    assignedTo: schoolData.assignedTo,
    status: schoolData.status,
    tags: schoolData.tags || [],
    // Migration tracking - force to legacy if entity not found
    migrationStatus: forceLegacy ? 'legacy' : (schoolData.migrationStatus || 'legacy'),
    // Include full school data for backward compatibility
    schoolData,
  };

  return resolved;
}
