'use server';

import { adminDb } from './firebase-admin';
import type { School, Entity, WorkspaceEntity, EntityType, MigrationStatus, ResolvedContact } from './types';

// Re-export ResolvedContact for test compatibility
export type { ResolvedContact } from './types';

/**
 * @fileOverview Backward Compatibility Adapter Layer
 * 
 * This adapter provides a unified interface for resolving contact data
 * from either the legacy `schools` collection or the new `entities` + `workspace_entities` model.
 * 
 * Key Functions:
 * - resolveContact: Returns unified contact object by checking migration status
 * - getWorkspaceContacts: Query contacts for a workspace
 * - contactExists: Check if a contact exists
 * - searchContacts: Search contacts by term
 * - Supports gradual migration without breaking existing features
 * 
 * Requirements: 11.1, 23.1, 25.4
 */

/**
 * Resolves a contact by checking migration status and reading from appropriate collections.
 * 
 * Logic:
 * 1. Query entities + workspace_entities for migrated contacts
 * 2. Query schools collection for legacy contacts
 * 3. Return unified contact object with caching
 * 
 * @param entityId - Unified Entity Identifier (string)
 * @param workspaceId - The workspace context for resolving workspace-specific state
 * @returns Unified contact object or null if not found
 * 
 * Requirements: 11.1, 23.1, 25.4
 */
export async function resolveContact(
  entityId: string,
  workspaceId: string
): Promise<ResolvedContact | null> {
  if (!entityId) return null;

  // Check cache first
  const cacheKey = `${entityId}_${workspaceId}`;
  const cached = contactCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    let result: ResolvedContact | null = null;

    // 1. Try resolving from new entity model first
    result = await resolveFromEntity(entityId, workspaceId);
    if (result) {
      contactCache.set(cacheKey, result);
      return result;
    }

    // 2. Fallback to legacy schools collection
    const schoolRef = adminDb.collection('schools').doc(entityId);
    const schoolSnap = await schoolRef.get();

    if (schoolSnap.exists) {
      const schoolData = { id: schoolSnap.id, ...schoolSnap.data() } as School;
      const migrationStatus = schoolData.migrationStatus || 'legacy';

      // If already migrated but resolved as legacy, try to find the entity link
      if (migrationStatus === 'migrated') {
        const entitySnap = await adminDb
          .collection('entities')
          .where('organizationId', '==', schoolData.workspaceIds?.[0] || '')
          .where('name', '==', schoolData.name)
          .where('entityType', '==', 'institution')
          .limit(1)
          .get();

        if (!entitySnap.empty) {
          const entity = { id: entitySnap.docs[0].id, ...entitySnap.docs[0].data() } as Entity;
          result = await resolveFromEntity(entity.id, workspaceId, schoolData);
          if (result) {
            contactCache.set(cacheKey, result);
            return result;
          }
        }
        
        // Final fallback if entity link fails
        result = resolveFromSchool(schoolData, workspaceId, true);
        contactCache.set(cacheKey, result);
        return result;
      }

      // If legacy, map school data
      result = resolveFromSchool(schoolData, workspaceId, false);
      contactCache.set(cacheKey, result);
      return result;
    }

    return null;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to resolve contact:`, error.message);
    return null;
  }
}

/**
 * Get all contacts for a workspace with optional filters
 * 
 * @param workspaceId - The workspace ID
 * @param filters - Optional filters for querying contacts
 * @returns Array of resolved contacts
 * 
 * Requirements: 11.1, 23.1
 */
export async function getWorkspaceContacts(
  workspaceId: string,
  filters?: ContactFilters
): Promise<ResolvedContact[]> {
  try {
    const contacts: ResolvedContact[] = [];

    // Query workspace_entities for migrated contacts
    let weQuery = adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId);

    if (filters?.pipelineId) {
      weQuery = weQuery.where('pipelineId', '==', filters.pipelineId);
    }
    if (filters?.stageId) {
      weQuery = weQuery.where('stageId', '==', filters.stageId);
    }
    if (filters?.status) {
      weQuery = weQuery.where('status', '==', filters.status);
    }
    if (filters?.entityType) {
      weQuery = weQuery.where('entityType', '==', filters.entityType);
    }

    const weSnap = await weQuery.get();

    // Resolve each workspace_entity to full contact
    for (const doc of weSnap.docs) {
      const we = { id: doc.id, ...doc.data() } as WorkspaceEntity;
      
      // Apply tag filter if specified
      if (filters?.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(tag => we.workspaceTags?.includes(tag));
        if (!hasTag) continue;
      }

      const contact = await resolveFromEntity(we.entityId, workspaceId);
      if (contact) {
        contacts.push(contact);
      }
    }

    // Query legacy schools for non-migrated contacts
    let schoolQuery = adminDb
      .collection('schools')
      .where('workspaceIds', 'array-contains', workspaceId);

    if (filters?.pipelineId) {
      schoolQuery = schoolQuery.where('pipelineId', '==', filters.pipelineId);
    }
    if (filters?.status) {
      schoolQuery = schoolQuery.where('status', '==', filters.status);
    }

    const schoolSnap = await schoolQuery.get();

    for (const doc of schoolSnap.docs) {
      const school = { id: doc.id, ...doc.data() } as School;
      
      // Skip if already migrated
      if (school.migrationStatus === 'migrated') continue;
      
      // Apply tag filter if specified
      if (filters?.tags && filters.tags.length > 0) {
        const hasTag = filters.tags.some(tag => school.tags?.includes(tag));
        if (!hasTag) continue;
      }

      // Apply stage filter if specified
      if (filters?.stageId && school.stage?.id !== filters.stageId) {
        continue;
      }

      const contact = resolveFromSchool(school, workspaceId, false);
      contacts.push(contact);
    }

    return contacts;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to get workspace contacts:`, error.message);
    return [];
  }
}

/**
 * Check if a contact exists
 * 
 * @param entityId - Unified Entity Identifier
 * @returns True if contact exists, false otherwise
 * 
 * Requirements: 11.1
 */
export async function contactExists(entityId: string): Promise<boolean> {
  if (!entityId) return false;
  
  try {
    // Check entity record first
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    if (entitySnap.exists) return true;

    // Check legacy school record
    const schoolRef = adminDb.collection('schools').doc(entityId);
    const schoolSnap = await schoolRef.get();
    if (schoolSnap.exists) return true;

    return false;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to check contact existence:`, error.message);
    return false;
  }
}

/**
 * Search contacts by name or other fields
 * 
 * @param workspaceId - The workspace ID
 * @param searchTerm - Search term to match against contact name
 * @returns Array of matching resolved contacts
 * 
 * Requirements: 11.1, 23.1
 */
export async function searchContacts(
  workspaceId: string,
  searchTerm: string
): Promise<ResolvedContact[]> {
  try {
    const contacts: ResolvedContact[] = [];
    const searchLower = searchTerm.toLowerCase();

    // Search in workspace_entities (migrated contacts)
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .get();

    for (const doc of weSnap.docs) {
      const we = { id: doc.id, ...doc.data() } as WorkspaceEntity;
      
      if (we.displayName?.toLowerCase().includes(searchLower)) {
        const contact = await resolveFromEntity(we.entityId, workspaceId);
        if (contact) {
          contacts.push(contact);
        }
      }
    }

    // Search in legacy schools
    const schoolSnap = await adminDb
      .collection('schools')
      .where('workspaceIds', 'array-contains', workspaceId)
      .get();

    for (const doc of schoolSnap.docs) {
      const school = { id: doc.id, ...doc.data() } as School;
      if (school.migrationStatus === 'migrated') continue;

      if (school.name?.toLowerCase().includes(searchLower)) {
        const contact = resolveFromSchool(school, workspaceId, false);
        contacts.push(contact);
      }
    }

    return contacts;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to search contacts:`, error.message);
    return [];
  }
}

/**
 * Clear the contact cache
 */
export async function clearContactCache(): Promise<void> {
  contactCache.clear();
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
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();

    if (!entitySnap.exists) return null;

    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    let workspaceEntity: WorkspaceEntity | null = null;
    let workspaceEntityId: string | undefined;

    if (!weSnap.empty) {
      workspaceEntity = { id: weSnap.docs[0].id, ...weSnap.docs[0].data() } as WorkspaceEntity;
      workspaceEntityId = weSnap.docs[0].id;
    }

    const resolved: ResolvedContact = {
      id: entity.id,
      name: entity.name,
      slug: entity.slug,
      contacts: entity.contacts || [],
      pipelineId: workspaceEntity?.pipelineId,
      stageId: workspaceEntity?.stageId,
      stageName: workspaceEntity?.currentStageName,
      assignedTo: workspaceEntity?.assignedTo,
      status: workspaceEntity?.status,
      tags: workspaceEntity?.workspaceTags || [],
      globalTags: entity.globalTags || [],
      entityType: entity.entityType,
      entityId: entity.id,
      workspaceEntityId,
      migrationStatus: 'migrated',
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
  const resolved: ResolvedContact = {
    id: schoolData.id,
    name: schoolData.name,
    slug: schoolData.slug,
    contacts: schoolData.focalPersons || [],
    pipelineId: schoolData.pipelineId,
    stageId: schoolData.stage?.id,
    stageName: schoolData.stage?.name,
    assignedTo: schoolData.assignedTo,
    status: schoolData.status,
    tags: schoolData.tags || [],
    migrationStatus: forceLegacy ? 'legacy' : (schoolData.migrationStatus || 'legacy'),
    schoolData,
  };

  return resolved;
}
