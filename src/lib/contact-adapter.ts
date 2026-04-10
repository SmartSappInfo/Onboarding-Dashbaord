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
 * Contact identifier that can be either entityId or entityId
 */
export interface ContactIdentifier {
  entityId?: string | null;
  entityId?: string | null;
}

/**
 * Filters for querying workspace contacts
 */
export interface ContactFilters {
  pipelineId?: string;
  stageId?: string;
  status?: 'active' | 'archived';
  tags?: string[];
  entityType?: EntityType;
}

/**
 * Simple LRU cache with TTL support
 */
class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expiry: number }>();
  private maxSize: number;
  private ttl: number;

  constructor(maxSize: number = 1000, ttlMs: number = 5 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttl = ttlMs;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // Check if expired
    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V): void {
    // Remove oldest entry if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      expiry: Date.now() + this.ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

// Cache instance with 5-minute TTL
const contactCache = new LRUCache<string, ResolvedContact>(1000, 5 * 60 * 1000);

/**
 * Resolves a contact by checking migration status and reading from appropriate collections.
 * 
 * Logic:
 * 1. Prefer entityId when both identifiers provided
 * 2. Query entities + workspace_entities for migrated contacts
 * 3. Query schools collection for legacy contacts
 * 4. Return unified contact object with caching
 * 
 * @param identifier - Contact identifier (entityId or entityId)
 * @param workspaceId - The workspace context for resolving workspace-specific state
 * @returns Unified contact object or null if not found
 * 
 * Requirements: 11.1, 23.1, 25.4
 */
export async function resolveContact(
  identifier: ContactIdentifier | string,
  workspaceId: string
): Promise<ResolvedContact | null> {
  // Support legacy signature (entityId as string)
  const contactId: ContactIdentifier = typeof identifier === 'string' 
    ? { entityId: identifier } 
    : identifier;

  // Check cache first
  const cacheKey = `${contactId.entityId || contactId.entityId}_${workspaceId}`;
  const cached = contactCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    let result: ResolvedContact | null = null;

    // 1. Prefer entityId when both identifiers provided
    if (contactId.entityId) {
      result = await resolveFromEntity(contactId.entityId, workspaceId);
      if (result) {
        contactCache.set(cacheKey, result);
        return result;
      }
    }

    // 2. Try entityId if entityId not found or not provided
    if (contactId.entityId) {
      // Check if migration record exists for entityId
      const schoolRef = adminDb.collection('schools').doc(contactId.entityId);
      const schoolSnap = await schoolRef.get();

      if (!schoolSnap.exists) {
        // School doesn't exist, might be a direct entity ID passed as entityId
        result = await resolveFromEntity(contactId.entityId, workspaceId);
        if (result) {
          contactCache.set(cacheKey, result);
          return result;
        }
        return null;
      }

      const schoolData = { id: schoolSnap.id, ...schoolSnap.data() } as School;
      const migrationStatus = schoolData.migrationStatus || 'legacy';

      // If migrated, read from entities + workspace_entities
      if (migrationStatus === 'migrated') {
        // Find the entity that was created from this school
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

        // Fallback to legacy if entity not found
        console.warn(`[ADAPTER] Entity not found for migrated school ${contactId.entityId}, falling back to legacy`);
        result = resolveFromSchool(schoolData, workspaceId, true);
        contactCache.set(cacheKey, result);
        return result;
      }

      // If not migrated, read from schools collection
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
      
      // Skip if already migrated (they are handled in the workspace_entities query above)
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
 * @param identifier - Contact identifier (entityId or entityId)
 * @returns True if contact exists, false otherwise
 * 
 * Requirements: 11.1
 */
export async function contactExists(identifier: ContactIdentifier): Promise<boolean> {
  try {
    // Check entityId first
    if (identifier.entityId) {
      const entityRef = adminDb.collection('entities').doc(identifier.entityId);
      const entitySnap = await entityRef.get();
      if (entitySnap.exists) return true;
    }

    // Check entityId
    if (identifier.entityId) {
      const schoolRef = adminDb.collection('schools').doc(identifier.entityId);
      const schoolSnap = await schoolRef.get();
      if (schoolSnap.exists) return true;
    }

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
      
      // Check if displayName matches search term
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
      
      // Skip if already migrated (already included from workspace_entities)
      if (school.migrationStatus === 'migrated') continue;

      // Check if name matches search term
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
 * Clear the contact cache (useful for testing or after bulk updates)
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
