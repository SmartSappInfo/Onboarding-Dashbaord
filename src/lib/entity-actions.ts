'use server';

import { adminDb } from './firebase-admin';
import { logActivity } from './activity-logger';
import { revalidatePath } from 'next/cache';
import { syncDenormalizedFieldsToWorkspaceEntities, extractDenormalizedFields } from './denormalization-sync';
import type { Entity, EntityType, InstitutionData, FamilyData, PersonData } from './types';

/**
 * @fileOverview Server actions for unified entity management.
 * Handles create, update, and delete operations for entities (institutions, families, persons).
 */

/**
 * Generates a URL-safe slug from a name
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Validates entity type is one of the allowed values
 */
function validateEntityType(entityType: string): entityType is EntityType {
  return ['institution', 'family', 'person'].includes(entityType);
}

/**
 * Validates that entity data matches the entity type
 */
function validateEntityData(
  entityType: EntityType,
  institutionData?: InstitutionData,
  familyData?: FamilyData,
  personData?: PersonData
): { valid: boolean; error?: string } {
  if (entityType === 'institution') {
    if (!institutionData) {
      return { valid: false, error: 'Institution entities require institutionData' };
    }
    if (institutionData.nominalRoll !== undefined && institutionData.nominalRoll < 0) {
      return { valid: false, error: 'nominalRoll must be a positive integer' };
    }
  }

  if (entityType === 'family') {
    if (!familyData) {
      return { valid: false, error: 'Family entities require familyData' };
    }
    if (!familyData.guardians || familyData.guardians.length === 0) {
      return { valid: false, error: 'Family entities require at least one guardian' };
    }
  }

  if (entityType === 'person') {
    if (!personData) {
      return { valid: false, error: 'Person entities require personData' };
    }
    if (!personData.firstName || !personData.lastName) {
      return { valid: false, error: 'Person entities require firstName and lastName' };
    }
  }

  return { valid: true };
}

interface CreateEntityInput {
  organizationId: string;
  entityType: EntityType;
  name: string;
  contacts?: Array<{
    name: string;
    phone: string;
    email: string;
    type: string;
    isSignatory: boolean;
  }>;
  institutionData?: InstitutionData;
  familyData?: FamilyData;
  personData?: PersonData;
  userId: string;
  workspaceId: string;
}

/**
 * Creates a new entity in the entities collection.
 * Validates entity type and data, generates slug for institutions,
 * and logs activity.
 * 
 * Requirements: 2, 15, 16, 17, 26
 */
export async function createEntityAction(input: CreateEntityInput) {
  try {
    const timestamp = new Date().toISOString();

    // 1. Validate entity type
    if (!validateEntityType(input.entityType)) {
      return {
        success: false,
        error: `Invalid entity type. Must be one of: institution, family, person`,
      };
    }

    // 2. Validate entity data matches entity type
    const validation = validateEntityData(
      input.entityType,
      input.institutionData,
      input.familyData,
      input.personData
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // 3. Compute name for person entities
    let entityName = input.name;
    if (input.entityType === 'person' && input.personData) {
      entityName = `${input.personData.firstName} ${input.personData.lastName}`;
    }

    // 4. Generate slug for institution entities
    let slug: string | undefined;
    if (input.entityType === 'institution') {
      slug = generateSlug(entityName);
      
      // Check for slug uniqueness within organization
      const existingSlugSnap = await adminDb
        .collection('entities')
        .where('organizationId', '==', input.organizationId)
        .where('slug', '==', slug)
        .limit(1)
        .get();

      if (!existingSlugSnap.empty) {
        // Append timestamp to make unique
        slug = `${slug}-${Date.now()}`;
      }
    }

    // 5. Create entity document
    const entityData: Omit<Entity, 'id'> = {
      organizationId: input.organizationId,
      entityType: input.entityType,
      name: entityName,
      slug,
      contacts: input.contacts || [],
      globalTags: [],
      createdAt: timestamp,
      updatedAt: timestamp,
      institutionData: input.institutionData,
      familyData: input.familyData,
      personData: input.personData,
      relatedEntityIds: [],
    };

    const entityRef = await adminDb.collection('entities').add(entityData);

    // 6. Log activity
    await logActivity({
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      entityId: entityRef.id,
      entityType: input.entityType,
      displayName: entityName,
      entitySlug: slug,
      userId: input.userId,
      type: 'entity_created',
      source: 'user_action',
      description: `created ${input.entityType} entity "${entityName}"`,
      metadata: {
        entityType: input.entityType,
        createdAt: timestamp,
      },
    });

    revalidatePath('/admin/contacts');
    revalidatePath(`/admin/contacts/${entityRef.id}`);

    return {
      success: true,
      entityId: entityRef.id,
    };
  } catch (e: any) {
    console.error('>>> [ENTITY:CREATE] Failed:', e.message);
    return {
      success: false,
      error: e.message,
    };
  }
}


interface UpdateEntityInput {
  entityId: string;
  name?: string;
  contacts?: Array<{
    name: string;
    phone: string;
    email: string;
    type: string;
    isSignatory: boolean;
  }>;
  institutionData?: Partial<InstitutionData>;
  familyData?: Partial<FamilyData>;
  personData?: Partial<PersonData>;
  userId: string;
  workspaceId: string;
}

/**
 * Updates an existing entity.
 * Validates entity exists, updates fields, triggers denormalization sync,
 * and logs activity.
 * 
 * Requirements: 2, 22
 */
export async function updateEntityAction(input: UpdateEntityInput) {
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

    // 2. Build update object
    const updates: any = {
      updatedAt: timestamp,
    };

    if (input.name !== undefined) {
      updates.name = input.name;
    }

    if (input.contacts !== undefined) {
      updates.contacts = input.contacts;
    }

    // Update scope-specific data
    if (entity.entityType === 'institution' && input.institutionData) {
      updates.institutionData = {
        ...entity.institutionData,
        ...input.institutionData,
      };
    }

    if (entity.entityType === 'family' && input.familyData) {
      updates.familyData = {
        ...entity.familyData,
        ...input.familyData,
      };
    }

    if (entity.entityType === 'person' && input.personData) {
      updates.personData = {
        ...entity.personData,
        ...input.personData,
      };
      
      // Recompute name for person entities
      const updatedPersonData = { ...entity.personData, ...input.personData };
      if (updatedPersonData.firstName && updatedPersonData.lastName) {
        updates.name = `${updatedPersonData.firstName} ${updatedPersonData.lastName}`;
      }
    }

    // 3. Update entity document
    await entityRef.update(updates);

    // 4. Trigger denormalization sync to workspace_entities
    // Check if fields that need denormalization have changed
    const needsDenormSync = updates.name !== undefined || updates.contacts !== undefined;
    
    if (needsDenormSync) {
      const updatedEntity = { ...entity, ...updates } as Entity;
      const denormalizedFields = extractDenormalizedFields(updatedEntity);
      
      await syncDenormalizedFieldsToWorkspaceEntities(
        input.entityId,
        denormalizedFields
      );
    }

    // 5. Log activity
    await logActivity({
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      displayName: updates.name || entity.name,
      entitySlug: entity.slug,
      userId: input.userId,
      type: 'entity_updated',
      source: 'user_action',
      description: `updated ${entity.entityType} entity "${updates.name || entity.name}"`,
      metadata: {
        updatedFields: Object.keys(updates),
        updatedAt: timestamp,
      },
    });

    revalidatePath('/admin/contacts');
    revalidatePath(`/admin/contacts/${input.entityId}`);

    return {
      success: true,
    };
  } catch (e: any) {
    console.error('>>> [ENTITY:UPDATE] Failed:', e.message);
    return {
      success: false,
      error: e.message,
    };
  }
}

interface DeleteEntityInput {
  entityId: string;
  userId: string;
  workspaceId: string;
}

/**
 * Soft deletes an entity by marking it as archived.
 * Does not delete workspace_entities records to preserve history.
 * 
 * Requirements: 2
 */
export async function deleteEntityAction(input: DeleteEntityInput) {
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

    // 2. Mark entity as archived (soft delete)
    await entityRef.update({
      status: 'archived',
      updatedAt: timestamp,
    });

    // Note: We do NOT delete workspace_entities records to preserve history

    // 3. Log activity
    await logActivity({
      organizationId: entity.organizationId,
      workspaceId: input.workspaceId,
      entityId: input.entityId,
      entityType: entity.entityType,
      displayName: entity.name,
      entitySlug: entity.slug,
      userId: input.userId,
      type: 'entity_archived',
      source: 'user_action',
      description: `archived ${entity.entityType} entity "${entity.name}"`,
      metadata: {
        archivedAt: timestamp,
      },
    });

    revalidatePath('/admin/contacts');
    revalidatePath(`/admin/contacts/${input.entityId}`);

    return {
      success: true,
    };
  } catch (e: any) {
    console.error('>>> [ENTITY:DELETE] Failed:', e.message);
    return {
      success: false,
      error: e.message,
    };
  }
}
