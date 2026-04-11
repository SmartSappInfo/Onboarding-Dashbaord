'use server';

import { adminDb } from './firebase-admin';
import type { School, Entity, WorkspaceEntity, EntityType, ResolvedContact } from './types';

// Re-export ResolvedContact for test compatibility
export type { ResolvedContact } from './types';

/**
 * @fileOverview Backward Compatibility Adapter Layer
 * 
 * This adapter provides a unified interface for resolving contact data
 * from either the legacy `schools` collection or the new `entities` + `workspace_entities` model.
 */

// In-memory contact cache for performance
const contactCache = new Map<string, ResolvedContact>();

export interface ContactFilters {
  pipelineId?: string;
  stageId?: string;
  status?: string;
  entityType?: EntityType;
  tags?: string[];
}

/**
 * Resolves a contact by checking migration status and reading from appropriate collections.
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
    // RESOLVE STRICTLY FROM NEW ENTITY MODEL
    const result = await resolveFromEntity(entityId, workspaceId);
    if (result) {
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
 */
export async function getWorkspaceContacts(
  workspaceId: string,
  filters?: ContactFilters
): Promise<ResolvedContact[]> {
  try {
    const contacts: ResolvedContact[] = [];

    // Query workspace_entities only
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

    return contacts;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to get workspace contacts:`, error.message);
    return [];
  }
}

/**
 * Check if a contact exists
 */
export async function contactExists(entityId: string): Promise<boolean> {
  if (!entityId) return false;
  
  try {
    // Check entity record only
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    return entitySnap.exists;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to check contact existence:`, error.message);
    return false;
  }
}

/**
 * Search contacts by name or other fields
 */
export async function searchContacts(
  workspaceId: string,
  searchTerm: string
): Promise<ResolvedContact[]> {
  try {
    const contacts: ResolvedContact[] = [];
    const searchLower = searchTerm.toLowerCase();

    // Search in workspace_entities only (migrated contacts)
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
  workspaceId: string
): Promise<ResolvedContact | null> {
  try {
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    if (!entitySnap.exists) return null;
    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;

    // Find workspace entity
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    const workspaceEntity = weSnap.empty ? undefined : { id: weSnap.docs[0].id, ...weSnap.docs[0].data() } as WorkspaceEntity;
    const workspaceEntityId = workspaceEntity?.id;
    const legacySchoolData = undefined;

    // Construct virtual school data if this is an institution
    let virtualSchoolData: School | undefined;
    if (entity.entityType === 'institution') {
      const inst = entity.institutionData;
      virtualSchoolData = {
        id: entity.id,
        organizationId: entity.organizationId,
        name: entity.name,
        displayName: entity.name, // Compatibility alias
        slug: entity.slug || '',
        logoUrl: entity.institutionData?.logoUrl || '', 
        workspaceIds: [workspaceId],
        status: (workspaceEntity?.status || 'active') as any,
        schoolStatus: workspaceEntity?.lifecycleStatus || 'Lead',
        pipelineId: workspaceEntity?.pipelineId || '',
        stageId: workspaceEntity?.stageId || '',
        stage: {
          id: workspaceEntity?.stageId || '',
          name: workspaceEntity?.currentStageName || '',
          order: 0
        },
        focalPersons: inst?.focalPersons || entity.contacts || [],
        nominalRoll: inst?.nominalRoll || 0,
        subscriptionPackageId: inst?.subscriptionPackageId,
        subscriptionRate: inst?.subscriptionRate,
        billingAddress: inst?.billingAddress,
        currency: inst?.currency || 'GHS',
        modules: inst?.modules || [],
        implementationDate: inst?.implementationDate,
        referee: inst?.referee,
        assignedTo: workspaceEntity?.assignedTo,
        migrationStatus: 'migrated',
        entityId: entity.id,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt
      } as any as School;
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
      schoolData: virtualSchoolData || legacySchoolData,
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
async function resolveFromSchool(
  schoolData: School, 
  workspaceId: string, 
  forceLegacy: boolean = false
): Promise<ResolvedContact> {
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
