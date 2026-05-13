'use server';

import { adminDb } from './firebase-admin';
import type { School, Entity, WorkspaceEntity, EntityType, ResolvedContact, EntityContact } from './types';
import { resolveEntityContacts } from './entity-contact-helpers';

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
  status?: string;
  entityType?: EntityType;
  tags?: string[];
  lifecycleStatus?: string;
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

    if (filters?.lifecycleStatus) {
      weQuery = weQuery.where('lifecycleStatus', '==', filters.lifecycleStatus);
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

    // FER-01: Resolve canonical entityContacts
    const entityContacts = resolveEntityContacts(entity);

    // Construct virtual school data if this is an institution
    let virtualSchoolData: School | undefined;
    if (entity.entityType === 'institution') {
      const fin: any = entity.financeData || {};
      const ind: any = entity.industryData || {};
      
      virtualSchoolData = {
        id: entity.id,
        organizationId: entity.organizationId,
        name: entity.name,
        displayName: entity.name, // Compatibility alias
        slug: entity.slug || '',
        logoUrl: entity.logoUrl || (entity as any).institutionData?.logoUrl || '', 
        workspaceIds: [workspaceId],
        status: (workspaceEntity?.status || 'active') as any,
        schoolStatus: workspaceEntity?.lifecycleStatus || 'Lead',
        entityContacts, // Canonical contacts
        nominalRoll: ind.capacity || (entity as any).institutionData?.nominalRoll || 0,
        subscriptionPackageId: fin.planType || (entity as any).institutionData?.subscriptionPackageId,
        subscriptionRate: fin.subscriptionRate || (entity as any).institutionData?.subscriptionRate,
        billingAddress: fin.billingAddress || (entity as any).institutionData?.billingAddress,
        currency: fin.currency || (entity as any).institutionData?.currency || 'GHS',
        modules: entity.interests?.map((i: string) => ({ id: i, name: i, abbreviation: i, color: '#ccc' })) || (entity as any).institutionData?.modules || [],
        implementationDate: fin.signupDate || (entity as any).institutionData?.implementationDate,
        referee: entity.referee || (entity as any).institutionData?.referee,
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
      logoUrl: entity.logoUrl || (entity as any).institutionData?.logoUrl,
      contacts: entityContacts, // Canonical contacts
      entityContacts, // Canonical (FER-01)
      assignedTo: workspaceEntity?.assignedTo,
      status: workspaceEntity?.status,
      tags: workspaceEntity?.workspaceTags || [],
      globalTags: entity.globalTags || [],
      entityType: entity.entityType,
      entityId: entity.id,
      workspaceEntityId,
      migrationStatus: 'migrated',
      
      // Resolve Primary & Signatory (FER-01)
      primaryContactName: entityContacts.find(c => c.isPrimary)?.name,
      primaryContactEmail: entityContacts.find(c => c.isPrimary)?.email,
      primaryContactPhone: entityContacts.find(c => c.isPrimary)?.phone,
      
      signatoryName: entityContacts.find(c => c.isSignatory)?.name,
      signatoryEmail: entityContacts.find(c => c.isSignatory)?.email,
      signatoryPhone: entityContacts.find(c => c.isSignatory)?.phone,

      // Identity & Location
      initials: entity.initials,
      referee: entity.referee,
      locationString: entity.location?.locationString || (entity as any).locationString,
      zoneName: entity.location?.zone?.name || (entity as any).zone?.name,

      schoolData: virtualSchoolData || legacySchoolData,
      industryData: entity.industryData,
      financeData: entity.financeData,
      personData: entity.personData,
      familyData: entity.familyData,
      customData: entity.customData || (entity as any).institutionData?.customData,
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
    logoUrl: schoolData.logoUrl,
    contacts: (schoolData as any).entityContacts || [],
    pipelineId: schoolData.pipelineId,
    stageId: schoolData.stage?.id,
    stageName: schoolData.stage?.name,
    assignedTo: schoolData.assignedTo,
    status: schoolData.status,
    tags: schoolData.tags || [],
    migrationStatus: forceLegacy ? 'legacy' : (schoolData.migrationStatus || 'legacy'),
    entityContacts: (schoolData as any).entityContacts || [],
    schoolData,
  };

  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Dual-Read Migration Pattern Helpers (Requirement 11.8–11.10, 22.3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps a legacy School document to a SaaS Entity.
 * 
 * This transformation is used during migration to convert legacy schools
 * (which are SaaS B2B accounts) into the new unified entity model.
 * 
 * Field Mappings (Requirement 11.4):
 * - nominalRoll → companySize
 * - subscriptionPackage → planType
 * - modules → features
 * - implementationDate → signupDate
 * 
 * @param school - Legacy school document from the schools collection
 * @returns Entity with SaaSInstitutionData
 */
export async function mapSchoolToSaaSEntity(school: School): Promise<Entity> {
  const entityContacts = school.entityContacts || [];

  const saasIndustryData: import('./types').SaaSInstitutionData = {
    industry: 'SaaS',
    capacity: school.nominalRoll || 0,
    accountStatus: inferAccountStatus(school),
    trialIds: [],
    onboardingIds: [],
    supportTicketIds: [],
    healthScoreIds: [],
  };

  const financeData: import('./types').FinanceData = {
    planType: school.subscriptionPackageName || school.subscriptionPackageId || 'unknown',
    currency: school.currency || 'GHS',
    billingAddress: school.billingAddress,
    subscriptionRate: school.subscriptionRate,
    signupDate: school.implementationDate || school.createdAt,
    customerTier: inferCustomerTier(school),
  };

  const entity: Entity = {
    id: school.id,
    organizationId: school.organizationId || '',
    entityType: 'institution',
    name: school.name,
    slug: school.slug,
    initials: school.initials,
    logoUrl: school.logoUrl,
    referee: school.referee,
    location: school.zone ? {
      zone: school.zone,
      locationString: school.location,
    } : undefined,
    interests: (school.modules || []).map((m: any) => m.name || m.abbreviation || m.id),
    entityContacts,
    globalTags: [], // Legacy schools don't have global tags
    status: school.status === 'archived' ? 'archived' : 'active',
    createdAt: school.createdAt,
    updatedAt: school.updatedAt || school.createdAt,
    // Industry-specific data
    industry: 'SaaS',
    industryData: saasIndustryData,
    financeData,
    // Migration tracking
    migrationStatus: school.migrationStatus || 'legacy',
    legacySchoolId: school.id,
  };

  return entity;
}

/**
 * Infers SaaS account status from legacy school data.
 */
function inferAccountStatus(school: School): 'lead' | 'trial' | 'active' | 'suspended' | 'churned' {
  if (school.status === 'Inactive' || school.status === 'archived') {
    return 'churned';
  }
  if (school.lifecycleStatus === 'Lead') {
    return 'lead';
  }
  if (school.lifecycleStatus === 'Onboarding') {
    return 'trial';
  }
  if (school.lifecycleStatus === 'Active') {
    return 'active';
  }
  if (school.lifecycleStatus === 'Churned') {
    return 'churned';
  }
  // Default to active for legacy data
  return 'active';
}

/**
 * Infers customer tier from legacy school data.
 */
function inferCustomerTier(school: School): 'basic' | 'pro' | 'enterprise' | undefined {
  const packageName = school.subscriptionPackageName?.toLowerCase() || '';
  if (packageName.includes('enterprise')) return 'enterprise';
  if (packageName.includes('pro') || packageName.includes('premium')) return 'pro';
  if (packageName.includes('basic') || packageName.includes('starter')) return 'basic';
  return undefined;
}

/**
 * Reads an entity from the legacy schools collection.
 * 
 * This helper is used during the dual-read migration pattern to support
 * entities that haven't been migrated yet (migrationStatus: 'legacy').
 * 
 * @param legacySchoolId - ID of the school document in the schools collection
 * @returns Entity mapped from the legacy school, or null if not found
 */
export async function readFromLegacySchools(legacySchoolId: string): Promise<Entity | null> {
  try {
    const schoolRef = adminDb.collection('schools').doc(legacySchoolId);
    const schoolSnap = await schoolRef.get();
    
    if (!schoolSnap.exists) {
      return null;
    }

    const school = { id: schoolSnap.id, ...schoolSnap.data() } as School;
    return await mapSchoolToSaaSEntity(school);
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to read from legacy schools collection:`, error.message);
    return null;
  }
}

/**
 * Reads an entity from the new entities collection.
 * 
 * This helper is used during the dual-read migration pattern to support
 * entities that have been migrated (migrationStatus: 'migrated' or 'dual-write').
 * 
 * @param entityId - ID of the entity document in the entities collection
 * @returns Entity from the entities collection, or null if not found
 */
export async function readFromEntities(entityId: string): Promise<Entity | null> {
  try {
    const entityRef = adminDb.collection('entities').doc(entityId);
    const entitySnap = await entityRef.get();
    
    if (!entitySnap.exists) {
      return null;
    }

    const entity = { id: entitySnap.id, ...entitySnap.data() } as Entity;
    return entity;
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to read from entities collection:`, error.message);
    return null;
  }
}

/**
 * Gets an entity by ID, branching on migrationStatus to read from the appropriate collection.
 * 
 * Migration Status Branching (Requirement 11.8–11.10):
 * - 'legacy': Read from schools collection only
 * - 'dual-write': Read from entities collection with fallback to schools
 * - 'migrated': Read from entities collection only
 * 
 * @param entityId - Entity ID (or legacy school ID)
 * @param migrationStatus - Migration status of the entity
 * @returns Entity from the appropriate collection, or null if not found
 */
export async function getEntity(
  entityId: string,
  migrationStatus?: 'legacy' | 'migrated' | 'dual-write'
): Promise<Entity | null> {
  if (!entityId) return null;

  try {
    // Determine migration status if not provided
    let status = migrationStatus;
    if (!status) {
      // Try to read from entities first to check migration status
      const entity = await readFromEntities(entityId);
      if (entity) {
        status = entity.migrationStatus || 'migrated';
      } else {
        // If not in entities, assume legacy
        status = 'legacy';
      }
    }

    // Branch on migration status (Requirement 11.8–11.10)
    switch (status) {
      case 'legacy':
        // Read from schools collection only
        return await readFromLegacySchools(entityId);

      case 'dual-write':
        // Read from entities with fallback to schools
        const entityFromNew = await readFromEntities(entityId);
        if (entityFromNew) {
          return entityFromNew;
        }
        // Fallback to legacy schools collection
        // If entity has legacySchoolId, use it; otherwise use entityId
        return await readFromLegacySchools(entityId);

      case 'migrated':
        // Read from entities only
        return await readFromEntities(entityId);

      default:
        console.warn(`[ADAPTER] Unknown migration status: ${status}`);
        return await readFromEntities(entityId);
    }
  } catch (error: any) {
    console.error(`[ADAPTER] Failed to get entity ${entityId}:`, error.message);
    return null;
  }
}
