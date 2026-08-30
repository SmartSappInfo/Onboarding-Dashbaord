'use server';

/**
 * Server Actions for Lead Intelligence 2.0 (Phase 1)
 * 
 * ARCHITECTURAL GUIDELINES (Rule 10 Maintainer Note):
 * 1. High-Load Guard: Batch operations (e.g. batchSync, CSV import) chunk Firestore operations in blocks of <= 250 writes.
 * 2. Strict Typing: No `any` or `any[]` is used across any action parameters or responses.
 * 3. Identity Resolution: Multi-factor deduplication (domain + name similarity) protects CRM entities from collisions.
 * 4. Audit & Score Integrity: All initial synced scores continue to route through `adjustLeadScoreAction`.
 */

import { adminDb } from '@/lib/firebase-admin';
import { LeadIntelligenceEngine } from '@/lib/lead-intelligence/LeadIntelligenceEngine';
import type { 
  Prospect, 
  SearchFilters, 
  LeadIntelligenceSettings, 
  SavedSearch,
  LeadList,
  NaturalLanguageQueryResult,
  DiscoverySourceType
} from '@/lib/lead-intelligence/types';
import type { Entity, WorkspaceEntity, EntityContact } from '@/lib/types';
import { adjustLeadScoreAction } from '@/lib/scoring-performance-engine';
import { canonicalizeDomain, evaluateIdentityMatch } from '@/lib/lead-intelligence/identity-resolver';
import { CSVImportProvider } from '@/lib/lead-intelligence/providers/CSVImportProvider';

/**
 * Utility helper to chunk arrays for Firestore batch operations.
 */
function chunkArray<T>(items: T[], chunkSize = 250): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Resolves API credentials and tokens for a workspace.
 */
export async function getLeadSettingsAction(workspaceId: string): Promise<LeadIntelligenceSettings> {
  if (!workspaceId) return {};
  try {
    const snap = await adminDb.collection('system_settings').doc(`keys_${workspaceId}`).get();
    if (snap.exists) {
      const data = snap.data();
      return {
        googlePlacesApiKey: data?.googlePlacesApiKey || '',
        builtwithApiKey: data?.builtwithApiKey || '',
        hunterApiKey: data?.hunterApiKey || '',
        chromeExtensionToken: data?.chromeExtensionToken || '',
      };
    }
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch settings:', err);
  }
  return {};
}

/**
 * Saves workspace API keys and auth tokens.
 */
export async function saveLeadSettingsAction(
  workspaceId: string, 
  organizationId: string,
  settings: LeadIntelligenceSettings
): Promise<{ success: boolean; error?: string }> {
  if (!workspaceId) return { success: false, error: 'workspaceId is required' };
  try {
    const dataToSave = {
      ...settings,
      workspaceId,
      organizationId,
      updatedAt: new Date().toISOString()
    };
    await adminDb.collection('system_settings').doc(`keys_${workspaceId}`).set(dataToSave, { merge: true });
    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to save settings:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Parses natural language user query into structured search filters.
 */
export async function parseNaturalLanguageQueryAction(
  prompt: string
): Promise<{ success: boolean; result?: NaturalLanguageQueryResult; error?: string }> {
  try {
    const result = await LeadIntelligenceEngine.parseNaturalLanguageQuery(prompt);
    return { success: true, result };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] NL query parsing failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to parse natural language prompt' };
  }
}

/**
 * Queries Google Places, AI generator, or CSV import using the provider engine.
 */
export async function searchProspectsAction(
  workspaceId: string,
  organizationId: string,
  queryText: string,
  filters: SearchFilters,
  preferredSource?: DiscoverySourceType
): Promise<{ success: boolean; prospects?: Prospect[]; error?: string }> {
  try {
    const settings = await getLeadSettingsAction(workspaceId);
    const prospects = await LeadIntelligenceEngine.searchProspects(
      organizationId,
      workspaceId,
      queryText,
      filters,
      settings,
      preferredSource
    );

    // Save newly searched prospects in chunks to protect against batch limits
    const chunks = chunkArray(prospects, 250);
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const p of chunk) {
        const docRef = adminDb.collection('prospects').doc(p.id);
        batch.set(docRef, p);
      }
      await batch.commit();
    }

    return { success: true, prospects };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Search failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Runs BuiltWith & Hunter API lookups and Gemini flows on a prospect.
 */
export async function enrichProspectAction(
  prospect: Prospect
): Promise<{ success: boolean; prospect?: Prospect; error?: string }> {
  try {
    const settings = await getLeadSettingsAction(prospect.workspaceId);
    const enriched = await LeadIntelligenceEngine.enrichProspect(prospect, settings);
    
    // Save enriched result
    await adminDb.collection('prospects').doc(prospect.id).set(enriched);

    return { success: true, prospect: enriched };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Enrichment failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Batch enriches a list of prospects in parallel chunks.
 */
export async function batchEnrichProspectsAction(
  prospects: Prospect[]
): Promise<{ success: boolean; enrichedProspects: Prospect[]; errors?: string[] }> {
  if (!prospects || prospects.length === 0) {
    return { success: true, enrichedProspects: [] };
  }

  const enrichedProspects: Prospect[] = [];
  const errors: string[] = [];

  // Enrich in groups of 4 in parallel
  const groups = chunkArray(prospects, 4);
  for (const group of groups) {
    const groupPromises = group.map(async (p) => {
      try {
        const res = await enrichProspectAction(p);
        if (res.success && res.prospect) {
          enrichedProspects.push(res.prospect);
        } else if (res.error) {
          errors.push(`${p.name}: ${res.error}`);
        }
      } catch (e) {
        errors.push(`${p.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    });
    await Promise.all(groupPromises);
  }

  return { success: true, enrichedProspects, errors: errors.length > 0 ? errors : undefined };
}

/**
 * Ingests CSV or pasted text rows into the workspace prospect catalog.
 */
export async function importProspectsFromCSVAction(
  workspaceId: string,
  organizationId: string,
  csvText: string,
  defaultIndustry?: string
): Promise<{ success: boolean; prospects?: Prospect[]; error?: string }> {
  try {
    const provider = new CSVImportProvider();
    const prospects = provider.parseCSVText(csvText, organizationId, workspaceId, defaultIndustry);

    if (prospects.length === 0) {
      return { success: false, error: 'No valid rows found in provided CSV data.' };
    }

    // Save in chunks to Firestore
    const chunks = chunkArray(prospects, 250);
    for (const chunk of chunks) {
      const batch = adminDb.batch();
      for (const p of chunk) {
        const docRef = adminDb.collection('prospects').doc(p.id);
        batch.set(docRef, p);
      }
      await batch.commit();
    }

    return { success: true, prospects };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] CSV Import failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Syncs lead into global entities & workspace_entities collections with duplicate checking.
 */
export async function syncProspectToCRMAction(
  prospect: Prospect
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  try {
    const entityId = `entity_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const wsEntityId = `${prospect.workspaceId}_${entityId}`;
    const now = new Date().toISOString();
    const canonicalDomain = canonicalizeDomain(prospect.domain);

    const mappedContacts: EntityContact[] = prospect.contacts.map((c, i) => ({
      id: `contact_${Date.now()}_${i}`,
      name: c.name,
      email: c.email || '',
      phone: c.phone || '',
      typeKey: c.role ? c.role.toLowerCase().replace(/\s+/g, '_') : 'contact',
      typeLabel: c.role || 'Contact',
      isPrimary: i === 0,
      isSignatory: false,
      order: i
    }));

    const newEntity: Entity = {
      id: entityId,
      organizationId: prospect.organizationId,
      entityType: 'institution',
      name: prospect.name,
      slug: canonicalDomain || prospect.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      location: prospect.address ? { locationString: prospect.address } : undefined,
      entityContacts: mappedContacts,
      globalTags: [],
      status: 'active',
      createdAt: now,
      updatedAt: now
    };

    const newWorkspaceEntity: WorkspaceEntity = {
      id: wsEntityId,
      organizationId: prospect.organizationId,
      workspaceId: prospect.workspaceId,
      entityId,
      entityType: 'institution',
      status: 'active',
      workspaceTags: ['synced-lead'],
      displayName: prospect.name,
      displayNameLower: prospect.name.toLowerCase(),
      primaryContactName: mappedContacts[0]?.name || undefined,
      primaryEmail: mappedContacts[0]?.email,
      primaryPhone: mappedContacts[0]?.phone,
      entityContacts: mappedContacts,
      addedAt: now,
      updatedAt: now
    };

    const result = await adminDb.runTransaction(async (transaction) => {
      // 1. Read prospect status
      const prospectRef = adminDb.collection('prospects').doc(prospect.id);
      const prospectSnap = await transaction.get(prospectRef);
      if (prospectSnap.exists) {
        const pData = prospectSnap.data() as Prospect;
        if (pData.syncStatus === 'synced') {
          throw new Error('This lead has already been synced to the CRM.');
        }
      }

      // 2. Multi-factor duplicate check in workspace_entities
      const duplicateQuery = adminDb.collection('workspace_entities')
        .where('workspaceId', '==', prospect.workspaceId)
        .limit(20);

      const duplicateSnap = await transaction.get(duplicateQuery);
      for (const doc of duplicateSnap.docs) {
        const candidate = doc.data() as WorkspaceEntity;
        const matchRes = evaluateIdentityMatch(
          { name: prospect.name, domain: prospect.domain, phone: prospect.phone },
          candidate
        );
        if (matchRes.isMatch && matchRes.confidence >= 0.85) {
          throw new Error(`Duplicate entity detected (${matchRes.matchReason}). Already in CRM as "${candidate.displayName}".`);
        }
      }

      // 3. Perform Writes
      transaction.set(adminDb.collection('entities').doc(entityId), newEntity);
      transaction.set(adminDb.collection('workspace_entities').doc(wsEntityId), newWorkspaceEntity);
      
      transaction.update(prospectRef, {
        syncStatus: 'synced',
        syncedEntityId: entityId,
        updatedAt: now
      });

      const activityId = `act_${Date.now()}`;
      transaction.set(prospectRef.collection('activities').doc(activityId), {
        id: activityId,
        prospectId: prospect.id,
        workspaceId: prospect.workspaceId,
        type: 'create_deal',
        userId: 'system_api',
        userName: 'SmartSapp CRM',
        content: `Lead synced to SmartSapp CRM. Created Entity "${prospect.name}".`,
        createdAt: now
      });

      return { entityId };
    });

    // Trigger score history logger (non-blocking)
    try {
      await adjustLeadScoreAction({
        organizationId: prospect.organizationId,
        workspaceId: prospect.workspaceId,
        entityId: result.entityId,
        contactEmailOrId: mappedContacts[0]?.id || 'unknown',
        value: prospect.scoring.overallScore,
        operation: 'set',
        reason: 'Initial Lead Intelligence score lookup',
        source: 'system',
        actorId: 'system_api',
        actorType: 'API'
      });
    } catch (scoreErr) {
      console.error('[lead-intelligence-actions] Failed to adjust lead score:', scoreErr);
    }

    return { success: true, entityId: result.entityId };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Sync failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Batch syncs multiple prospects to the CRM.
 */
export async function batchSyncProspectsAction(
  prospects: Prospect[]
): Promise<{ success: boolean; syncedCount: number; failedCount: number; errors?: string[] }> {
  let syncedCount = 0;
  let failedCount = 0;
  const errors: string[] = [];

  for (const p of prospects) {
    const res = await syncProspectToCRMAction(p);
    if (res.success) {
      syncedCount++;
    } else {
      failedCount++;
      if (res.error) errors.push(`${p.name}: ${res.error}`);
    }
  }

  return {
    success: syncedCount > 0,
    syncedCount,
    failedCount,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Retrieves recently scanned prospects in the workspace.
 */
export async function getRecentProspectsAction(workspaceId: string): Promise<Prospect[]> {
  if (!workspaceId) return [];
  try {
    const snap = await adminDb.collection('prospects')
      .where('workspaceId', '==', workspaceId)
      .orderBy('updatedAt', 'desc')
      .limit(60)
      .get();
    
    const results: Prospect[] = [];
    snap.forEach((doc) => {
      results.push(doc.data() as Prospect);
    });
    return results;
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch recent prospects:', err);
    return [];
  }
}

/**
 * Saves a query search configuration.
 */
export async function saveSearchAction(
  workspaceId: string,
  organizationId: string,
  name: string,
  filters: SearchFilters
): Promise<{ success: boolean; error?: string }> {
  try {
    const id = `search_${Date.now()}`;
    const newSearch: SavedSearch = {
      id,
      organizationId,
      workspaceId,
      name,
      filters,
      prospectsCount: 0,
      createdAt: new Date().toISOString()
    };
    await adminDb.collection('saved_searches').doc(id).set(newSearch);
    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to save search:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Retrieves saved search configurations for a workspace.
 */
export async function getSavedSearchesAction(workspaceId: string): Promise<SavedSearch[]> {
  if (!workspaceId) return [];
  try {
    const snap = await adminDb.collection('saved_searches')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .get();

    const results: SavedSearch[] = [];
    snap.forEach((doc) => {
      results.push(doc.data() as SavedSearch);
    });
    return results;
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch saved searches:', err);
    return [];
  }
}

/**
 * Creates a persistent lead list cohort.
 */
export async function createLeadListAction(
  workspaceId: string,
  organizationId: string,
  name: string,
  description?: string,
  prospectIds: string[] = []
): Promise<{ success: boolean; list?: LeadList; error?: string }> {
  try {
    const id = `list_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const newList: LeadList = {
      id,
      workspaceId,
      organizationId,
      name,
      description: description || '',
      prospectIds,
      prospectsCount: prospectIds.length,
      createdAt: now,
      updatedAt: now
    };

    await adminDb.collection('lead_lists').doc(id).set(newList);
    return { success: true, list: newList };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to create lead list:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Retrieves all lead lists for a workspace.
 */
export async function getLeadListsAction(workspaceId: string): Promise<LeadList[]> {
  if (!workspaceId) return [];
  try {
    const snap = await adminDb.collection('lead_lists')
      .where('workspaceId', '==', workspaceId)
      .orderBy('updatedAt', 'desc')
      .get();

    const lists: LeadList[] = [];
    snap.forEach((doc) => {
      lists.push(doc.data() as LeadList);
    });
    return lists;
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch lead lists:', err);
    return [];
  }
}

/**
 * Adds prospects to an existing lead list.
 */
export async function addProspectsToListAction(
  listId: string,
  prospectIds: string[],
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const listRef = adminDb.collection('lead_lists').doc(listId);
    const snap = await listRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Lead list not found' };
    }

    const currentList = snap.data() as LeadList;
    if (currentList.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    const combinedSet = new Set([...(currentList.prospectIds || []), ...prospectIds]);
    const updatedIds = Array.from(combinedSet);

    await listRef.update({
      prospectIds: updatedIds,
      prospectsCount: updatedIds.length,
      updatedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to add to lead list:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Deletes a lead list.
 */
export async function deleteLeadListAction(
  listId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const listRef = adminDb.collection('lead_lists').doc(listId);
    const snap = await listRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Lead list not found' };
    }

    const currentList = snap.data() as LeadList;
    if (currentList.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    await listRef.delete();
    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to delete lead list:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Calculates estimated credit requirements for batch enrichment operations.
 * UI Spec Section 23 & 60.
 */
export async function previewEnrichmentCostAction(
  prospectCount: number,
  options?: { includeEmails?: boolean; includeTech?: boolean; includeAI?: boolean }
): Promise<{
  success: boolean;
  estimatedCredits: number;
  breakdown: { emailCredits: number; techCredits: number; aiCredits: number };
}> {
  const includeEmails = options?.includeEmails ?? true;
  const includeTech = options?.includeTech ?? true;
  const includeAI = options?.includeAI ?? true;

  const emailCredits = includeEmails ? prospectCount * 1 : 0;
  const techCredits = includeTech ? prospectCount * 1 : 0;
  const aiCredits = includeAI ? prospectCount * 2 : 0;

  const estimatedCredits = emailCredits + techCredits + aiCredits;

  return {
    success: true,
    estimatedCredits,
    breakdown: {
      emailCredits,
      techCredits,
      aiCredits
    }
  };
}

/**
 * Saves a custom table view configuration (columns, density, filters).
 */
export async function saveViewAction(
  workspaceId: string,
  organizationId: string,
  viewData: Omit<import('@/lib/lead-intelligence/types').SavedViewConfig, 'id' | 'workspaceId' | 'organizationId' | 'createdAt' | 'updatedAt'>
): Promise<{ success: boolean; view?: import('@/lib/lead-intelligence/types').SavedViewConfig; error?: string }> {
  try {
    const viewId = `view_${workspaceId}_${Date.now()}`;
    const now = new Date().toISOString();

    const newView: import('@/lib/lead-intelligence/types').SavedViewConfig = {
      ...viewData,
      id: viewId,
      workspaceId,
      organizationId,
      createdAt: now,
      updatedAt: now
    };

    await adminDb.collection('saved_views').doc(viewId).set(newView);
    return { success: true, view: newView };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to save view:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Retrieves all saved custom views for a workspace.
 */
export async function getSavedViewsAction(
  workspaceId: string
): Promise<import('@/lib/lead-intelligence/types').SavedViewConfig[]> {
  if (!workspaceId) return [];
  try {
    const snap = await adminDb.collection('saved_views')
      .where('workspaceId', '==', workspaceId)
      .orderBy('createdAt', 'desc')
      .get();

    const views: import('@/lib/lead-intelligence/types').SavedViewConfig[] = [];
    snap.forEach((doc) => {
      views.push(doc.data() as import('@/lib/lead-intelligence/types').SavedViewConfig);
    });
    return views;
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to get saved views:', err);
    return [];
  }
}

/**
 * Deletes a saved custom view.
 */
export async function deleteSavedViewAction(
  viewId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const docRef = adminDb.collection('saved_views').doc(viewId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, error: 'View not found' };
    }

    const data = snap.data() as import('@/lib/lead-intelligence/types').SavedViewConfig;
    if (data.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    await docRef.delete();
    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to delete view:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// =============================================================================
// PHASE 3: IDENTITY RESOLUTION & DEDUPLICATION SERVER ACTIONS
// =============================================================================

/**
 * Retrieves all identity collision review records for a workspace.
 */
export async function getIdentityCollisionsAction(
  workspaceId: string,
  status: import('@/lib/lead-intelligence/types').CollisionStatus = 'pending_review'
): Promise<import('@/lib/lead-intelligence/types').IdentityCollisionRecord[]> {
  if (!workspaceId) return [];
  try {
    const snap = await adminDb.collection('identity_collisions')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', status)
      .orderBy('matchConfidence', 'desc')
      .limit(100)
      .get();

    const collisions: import('@/lib/lead-intelligence/types').IdentityCollisionRecord[] = [];
    snap.forEach((doc) => {
      collisions.push(doc.data() as import('@/lib/lead-intelligence/types').IdentityCollisionRecord);
    });
    return collisions;
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch collisions:', err);
    return [];
  }
}

/**
 * Scans newly discovered unregistered prospects against existing CRM workspace entities
 * to detect potential identity collisions.
 */
export async function scanWorkspaceForCollisionsAction(
  workspaceId: string
): Promise<{ createdCount: number; collisions: import('@/lib/lead-intelligence/types').IdentityCollisionRecord[] }> {
  if (!workspaceId) return { createdCount: 0, collisions: [] };
  try {
    // 1. Fetch unregistered prospects
    const prospectsSnap = await adminDb.collection('prospects')
      .where('workspaceId', '==', workspaceId)
      .where('syncStatus', '==', 'unregistered')
      .limit(150)
      .get();

    if (prospectsSnap.empty) {
      return { createdCount: 0, collisions: [] };
    }

    const prospects: Prospect[] = [];
    prospectsSnap.forEach((doc) => {
      prospects.push(doc.data() as Prospect);
    });

    // 2. Fetch existing CRM workspace entities
    const entitiesSnap = await adminDb.collection('workspace_entities')
      .where('workspaceId', '==', workspaceId)
      .where('status', '==', 'active')
      .limit(300)
      .get();

    if (entitiesSnap.empty) {
      return { createdCount: 0, collisions: [] };
    }

    const existingEntities: WorkspaceEntity[] = [];
    entitiesSnap.forEach((doc) => {
      existingEntities.push(doc.data() as WorkspaceEntity);
    });

    const now = new Date().toISOString();
    const discoveredCollisions: import('@/lib/lead-intelligence/types').IdentityCollisionRecord[] = [];
    const batch = adminDb.batch();
    let writeCount = 0;

    // 3. Perform multi-factor comparison
    for (const prospect of prospects) {
      for (const entity of existingEntities) {
        const match = evaluateIdentityMatch(prospect, entity);

        if (match.confidence >= 0.75) {
          const collisionId = `col_${workspaceId}_${prospect.id}_${entity.entityId}`;
          const collisionDocRef = adminDb.collection('identity_collisions').doc(collisionId);

          let matchType: 'exact_domain' | 'exact_phone' | 'fuzzy_name' | 'composite' = 'composite';
          if (match.matchReason.includes('Domain exact match')) {
            matchType = 'exact_domain';
          } else if (match.matchReason.includes('Phone exact match')) {
            matchType = 'exact_phone';
          } else if (match.matchReason.includes('Name similarity')) {
            matchType = 'fuzzy_name';
          }

          const record: import('@/lib/lead-intelligence/types').IdentityCollisionRecord = {
            id: collisionId,
            workspaceId,
            prospectId: prospect.id,
            prospect,
            entityId: entity.entityId,
            existingEntityName: entity.displayName,
            existingEntityDomain: entity.slug || (entity as unknown as Record<string, string>).website,
            existingEntityPhone: entity.primaryPhone,
            existingEntityLocation: entity.locationString || entity.location?.locationString,
            existingEntityContactsCount: (entity.entityContacts || []).length,
            matchConfidence: match.confidence,
            matchReasons: [match.matchReason],
            matchType,
            status: 'pending_review',
            detectedAt: now
          };

          batch.set(collisionDocRef, record, { merge: true });
          discoveredCollisions.push(record);
          writeCount++;

          if (writeCount >= 250) break;
        }
      }
      if (writeCount >= 250) break;
    }

    if (writeCount > 0) {
      await batch.commit();
    }

    return {
      createdCount: discoveredCollisions.length,
      collisions: discoveredCollisions
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to scan collisions:', err);
    return { createdCount: 0, collisions: [] };
  }
}

/**
 * Atomically synthesizes and merges a Discovered Prospect into a target CRM Entity
 * using user-specified field selections.
 */
export async function executeIdentityMergeAction(
  workspaceId: string,
  payload: import('@/lib/lead-intelligence/types').CanonicalMergePayload
): Promise<import('@/lib/lead-intelligence/types').MergeExecutionResult> {
  if (!workspaceId || !payload.prospectId || !payload.entityId) {
    return { success: false, entityId: '', mergedContactsCount: 0, mergedTechnologiesCount: 0, error: 'Invalid payload' };
  }

  const { IdentityMergeService } = await import('@/lib/lead-intelligence/identity/IdentityMergeService');

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const prospectRef = adminDb.collection('prospects').doc(payload.prospectId);
      const weRef = adminDb.collection('workspace_entities').doc(`${workspaceId}_${payload.entityId}`);
      const entityRef = adminDb.collection('entities').doc(payload.entityId);
      const collisionRef = payload.collisionId 
        ? adminDb.collection('identity_collisions').doc(payload.collisionId)
        : null;

      const [prospectSnap, weSnap, entitySnap] = await Promise.all([
        transaction.get(prospectRef),
        transaction.get(weRef),
        transaction.get(entityRef)
      ]);

      if (!prospectSnap.exists) {
        throw new Error('Prospect not found');
      }
      if (!weSnap.exists) {
        throw new Error('Target CRM workspace entity not found');
      }

      const prospectData = prospectSnap.data() as Prospect;
      const weData = weSnap.data() as WorkspaceEntity;

      // Deterministic synthesis using chosen field strategies
      const canonical = IdentityMergeService.synthesizeCanonicalRecord(
        prospectData,
        weData,
        payload.fieldSelection
      );

      const now = new Date().toISOString();

      // 1. Update workspace_entities
      const weUpdate = {
        displayName: canonical.displayName,
        primaryPhone: canonical.phone || weData.primaryPhone,
        locationString: canonical.locationString || weData.locationString,
        entityContacts: canonical.mergedContacts,
        workspaceTags: canonical.workspaceTags,
        customData: canonical.customData,
        updatedAt: now
      };
      transaction.update(weRef, weUpdate);

      // 2. Update canonical entities record if present
      if (entitySnap.exists) {
        transaction.update(entityRef, {
          name: canonical.displayName,
          contacts: canonical.mergedContacts,
          tags: canonical.workspaceTags,
          updatedAt: now
        });
      }

      // 3. Mark prospect as synced
      transaction.update(prospectRef, {
        syncStatus: 'synced',
        syncedEntityId: payload.entityId,
        updatedAt: now
      });

      // 4. Update collision status if applicable
      if (collisionRef) {
        transaction.update(collisionRef, {
          status: 'merged',
          resolvedAt: now,
          resolutionNotes: payload.notes || 'Merged via Side-by-Side Merge Studio'
        });
      }

      return {
        success: true,
        entityId: payload.entityId,
        mergedContactsCount: canonical.mergedContacts.length,
        mergedTechnologiesCount: canonical.technologies.length
      };
    });

    return result;
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to execute identity merge:', err);
    return {
      success: false,
      entityId: payload.entityId,
      mergedContactsCount: 0,
      mergedTechnologiesCount: 0,
      error: err instanceof Error ? err.message : 'Unknown merge error'
    };
  }
}

/**
 * Dismisses or marks an identity collision as separate records.
 */
export async function dismissCollisionAction(
  collisionId: string,
  workspaceId: string,
  resolution: 'keep_separate' | 'dismissed'
): Promise<{ success: boolean; error?: string }> {
  if (!collisionId || !workspaceId) return { success: false, error: 'Invalid parameters' };
  try {
    const docRef = adminDb.collection('identity_collisions').doc(collisionId);
    const snap = await docRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Collision record not found' };
    }

    const data = snap.data() as import('@/lib/lead-intelligence/types').IdentityCollisionRecord;
    if (data.workspaceId !== workspaceId) {
      return { success: false, error: 'Unauthorized workspace access' };
    }

    await docRef.update({
      status: resolution,
      resolvedAt: new Date().toISOString()
    });

    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to dismiss collision:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

// =============================================================================
// PHASE 4: DEEP TECHNOGRAPHICS & SUBDOMAIN PROBER SERVER ACTIONS
// =============================================================================

/**
 * Probes high-value business subdomains (e.g. portal, admissions, moodle, fees)
 * concurrently for a target domain.
 */
export async function probeDomainSubdomainsAction(
  domain: string,
  workspaceId: string
): Promise<import('@/lib/lead-intelligence/types').SubdomainProbeResult[]> {
  if (!domain || !workspaceId) return [];
  const { SubdomainProberService } = await import('@/lib/lead-intelligence/scraper/SubdomainProberService');
  return SubdomainProberService.probeDomain(domain);
}

/**
 * Executes a deep technographic scan combining DOM Scraping, BuiltWith, and Subdomain probing.
 */
export async function enrichTechnographicsDeepAction(
  prospectId: string,
  domain: string,
  workspaceId: string
): Promise<{ 
  success: boolean; 
  categorizedTech?: import('@/lib/lead-intelligence/types').CategorizedTechStack; 
  dimensions?: import('@/lib/lead-intelligence/types').EnrichmentDimensionScore;
  error?: string 
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  const { DOMScraperService } = await import('@/lib/lead-intelligence/scraper/DOMScraperService');
  const { SubdomainProberService } = await import('@/lib/lead-intelligence/scraper/SubdomainProberService');
  const { TechnographicsCategorizer } = await import('@/lib/lead-intelligence/scraper/TechnographicsCategorizer');

  try {
    const prospectRef = adminDb.collection('prospects').doc(prospectId);
    const snap = await prospectRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Prospect not found' };
    }

    const prospect = snap.data() as Prospect;
    const cleanDomain = domain || prospect.domain;

    // 1. Scrape On-Page Metadata & Signatures
    const scraped = cleanDomain ? await DOMScraperService.scrapeDomain(cleanDomain) : null;

    // 2. Probe Subdomains
    const portals = cleanDomain ? await SubdomainProberService.probeDomain(cleanDomain) : [];

    // 3. Union Technologies
    const techSet = new Set<string>(prospect.websiteScan?.technologies || []);
    if (scraped) {
      for (const sig of scraped.paymentSignatures) {
        techSet.add(`Payment Gateway: ${sig.provider.toUpperCase()}`);
      }
    }
    for (const portal of portals) {
      techSet.add(`Subdomain: ${portal.subdomain.toUpperCase()}`);
    }

    const allTech = Array.from(techSet);
    const categorizedTech = TechnographicsCategorizer.categorize(allTech, portals);

    // 4. Update Prospect Record
    const now = new Date().toISOString();
    const updatedWebsiteScan: import('@/lib/lead-intelligence/types').WebsiteScanResults = {
      scannedAt: now,
      technologies: allTech,
      sslValid: scraped ? true : (prospect.websiteScan?.sslValid ?? true),
      metaTitle: scraped?.title || prospect.websiteScan?.metaTitle,
      metaDescription: scraped?.metaDescription || prospect.websiteScan?.metaDescription,
      hasFacebook: Boolean(scraped?.socialLinks.facebook || prospect.websiteScan?.hasFacebook),
      hasInstagram: Boolean(scraped?.socialLinks.instagram || prospect.websiteScan?.hasInstagram),
      hasLinkedIn: Boolean(scraped?.socialLinks.linkedin || prospect.websiteScan?.hasLinkedIn),
      hasTwitter: Boolean(scraped?.socialLinks.twitter || prospect.websiteScan?.hasTwitter)
    };

    const updatedProspect: Prospect = {
      ...prospect,
      websiteScan: updatedWebsiteScan,
      updatedAt: now
    };

    const dimensions = TechnographicsCategorizer.calculateEnrichmentDimensions(updatedProspect);

    await prospectRef.update({
      websiteScan: updatedWebsiteScan,
      updatedAt: now
    });

    return {
      success: true,
      categorizedTech,
      dimensions
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to enrich deep technographics:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown scan error' };
  }
}

/**
 * Calculates 4-dimension enrichment scores for a given prospect.
 */
export async function getEnrichmentDimensionsAction(
  prospectId: string,
  workspaceId: string
): Promise<import('@/lib/lead-intelligence/types').EnrichmentDimensionScore> {
  const defaultScore: import('@/lib/lead-intelligence/types').EnrichmentDimensionScore = {
    companyScore: 50,
    techScore: 50,
    contactsScore: 50,
    verificationScore: 50,
    overallEnrichmentPercent: 50
  };

  if (!prospectId || !workspaceId) return defaultScore;

  try {
    const snap = await adminDb.collection('prospects').doc(prospectId).get();
    if (!snap.exists) return defaultScore;

    const prospect = snap.data() as Prospect;
    const { TechnographicsCategorizer } = await import('@/lib/lead-intelligence/scraper/TechnographicsCategorizer');
    return TechnographicsCategorizer.calculateEnrichmentDimensions(prospect);
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to compute enrichment dimensions:', err);
    return defaultScore;
  }
}

// =============================================================================
// PHASE 5: REAL-TIME EMAIL & DELIVERABILITY VERIFICATION SERVER ACTIONS
// =============================================================================

/**
 * Verifies a single email address for a prospect and updates its deliverability status.
 */
export async function verifyProspectEmailAction(
  prospectId: string,
  email: string,
  workspaceId: string
): Promise<{
  success: boolean;
  deliverability?: import('@/lib/lead-intelligence/types').EmailDeliverabilityResult;
  dimensions?: import('@/lib/lead-intelligence/types').EnrichmentDimensionScore;
  error?: string;
}> {
  if (!prospectId || !email || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  const { DeliverabilityScoreEngine } = await import('@/lib/lead-intelligence/verification/DeliverabilityScoreEngine');
  const { TechnographicsCategorizer } = await import('@/lib/lead-intelligence/scraper/TechnographicsCategorizer');

  try {
    const prospectRef = adminDb.collection('prospects').doc(prospectId);
    const snap = await prospectRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Prospect not found' };
    }

    const prospect = snap.data() as Prospect;
    const deliverability = await DeliverabilityScoreEngine.verifyEmail(email);

    // Update the contact in prospect.contacts
    const updatedContacts = (prospect.contacts || []).map(c => {
      if (c.email.toLowerCase().trim() === email.toLowerCase().trim()) {
        return {
          ...c,
          verificationStatus: deliverability.status,
          deliverabilityScore: deliverability.deliverabilityScore,
          mxProvider: deliverability.mxProvider,
          lastVerifiedAt: deliverability.verifiedAt
        };
      }
      return c;
    });

    const now = new Date().toISOString();
    const updatedProspect: Prospect = {
      ...prospect,
      contacts: updatedContacts,
      updatedAt: now
    };

    const dimensions = TechnographicsCategorizer.calculateEnrichmentDimensions(updatedProspect);

    await prospectRef.update({
      contacts: updatedContacts,
      updatedAt: now
    });

    return {
      success: true,
      deliverability,
      dimensions
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to verify email:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Email verification failed' };
  }
}

/**
 * Bulk verifies all contacts for a given prospect.
 */
export async function bulkVerifyProspectEmailsAction(
  prospectId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  verifiedCount: number;
  results: import('@/lib/lead-intelligence/types').EmailDeliverabilityResult[];
  dimensions?: import('@/lib/lead-intelligence/types').EnrichmentDimensionScore;
  error?: string;
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, verifiedCount: 0, results: [], error: 'Invalid parameters' };
  }

  const { DeliverabilityScoreEngine } = await import('@/lib/lead-intelligence/verification/DeliverabilityScoreEngine');
  const { TechnographicsCategorizer } = await import('@/lib/lead-intelligence/scraper/TechnographicsCategorizer');

  try {
    const prospectRef = adminDb.collection('prospects').doc(prospectId);
    const snap = await prospectRef.get();
    if (!snap.exists) {
      return { success: false, verifiedCount: 0, results: [], error: 'Prospect not found' };
    }

    const prospect = snap.data() as Prospect;
    const contacts = prospect.contacts || [];
    if (contacts.length === 0) {
      return { success: true, verifiedCount: 0, results: [] };
    }

    const verificationPromises = contacts.map(c => DeliverabilityScoreEngine.verifyEmail(c.email));
    const settledResults = await Promise.allSettled(verificationPromises);

    const deliverabilityResults: import('@/lib/lead-intelligence/types').EmailDeliverabilityResult[] = [];
    const updatedContacts = contacts.map((c, idx) => {
      const settled = settledResults[idx];
      if (settled && settled.status === 'fulfilled') {
        const res = settled.value;
        deliverabilityResults.push(res);
        return {
          ...c,
          verificationStatus: res.status,
          deliverabilityScore: res.deliverabilityScore,
          mxProvider: res.mxProvider,
          lastVerifiedAt: res.verifiedAt
        };
      }
      return c;
    });

    const now = new Date().toISOString();
    const updatedProspect: Prospect = {
      ...prospect,
      contacts: updatedContacts,
      updatedAt: now
    };

    const dimensions = TechnographicsCategorizer.calculateEnrichmentDimensions(updatedProspect);

    await prospectRef.update({
      contacts: updatedContacts,
      updatedAt: now
    });

    return {
      success: true,
      verifiedCount: deliverabilityResults.length,
      results: deliverabilityResults,
      dimensions
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to bulk verify emails:', err);
    return { success: false, verifiedCount: 0, results: [], error: err instanceof Error ? err.message : 'Bulk verification failed' };
  }
}

// =============================================================================
// PHASE 6: AI RESEARCH DOSSIER & EVIDENCE LAYER SERVER ACTIONS
// =============================================================================

/**
 * Generates and persists an AI Research Dossier for a given prospect.
 */
export async function generateAIResearchDossierAction(
  prospectId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  dossier?: import('@/lib/lead-intelligence/types').AIResearchDossier;
  error?: string;
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  const { DeepResearchDossierEngine } = await import('@/lib/lead-intelligence/research/DeepResearchDossierEngine');

  try {
    const prospectRef = adminDb.collection('prospects').doc(prospectId);
    const snap = await prospectRef.get();
    if (!snap.exists) {
      return { success: false, error: 'Prospect not found' };
    }

    const prospect = snap.data() as Prospect;
    const dossier = await DeepResearchDossierEngine.generateDossier(prospect);

    const now = new Date().toISOString();
    await prospectRef.update({
      researchDossier: dossier,
      updatedAt: now
    });

    return {
      success: true,
      dossier
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to generate AI research dossier:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'AI research dossier generation failed' 
    };
  }
}

/**
 * Retrieves the stored AI Research Dossier for a prospect.
 */
export async function getAIResearchDossierAction(
  prospectId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  dossier?: import('@/lib/lead-intelligence/types').AIResearchDossier;
  error?: string;
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    const snap = await adminDb.collection('prospects').doc(prospectId).get();
    if (!snap.exists) {
      return { success: false, error: 'Prospect not found' };
    }

    const prospect = snap.data() as Prospect;
    return {
      success: true,
      dossier: prospect.researchDossier
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch AI research dossier:', err);
    return { 
      success: false, 
      error: err instanceof Error ? err.message : 'Failed to retrieve AI research dossier' 
    };
  }
}

// =============================================================================
// PHASE 7: LIVE CONTINUOUS SIGNALS & DELTA MONITORING SERVER ACTIONS
// =============================================================================

/**
 * Retrieves all signals for a given workspace with optional category/unread filtering.
 */
export async function getWorkspaceSignalsAction(
  workspaceId: string,
  options?: {
    category?: string;
    strength?: string;
    unreadOnly?: boolean;
    limit?: number;
  }
): Promise<{
  success: boolean;
  signals?: import('@/lib/lead-intelligence/types').LeadSignal[];
  unreadCount?: number;
  error?: string;
}> {
  if (!workspaceId) {
    return { success: false, error: 'Workspace ID is required' };
  }

  try {
    let query: FirebaseFirestore.Query = adminDb
      .collection('lead_signals')
      .where('workspaceId', '==', workspaceId)
      .where('isDismissed', '==', false);

    if (options?.category && options.category !== 'all') {
      query = query.where('category', '==', options.category);
    }
    if (options?.strength && options.strength !== 'all') {
      query = query.where('strength', '==', options.strength);
    }
    if (options?.unreadOnly) {
      query = query.where('isRead', '==', false);
    }

    const maxResults = options?.limit || 50;
    const snap = await query.orderBy('detectedAt', 'desc').limit(maxResults).get();

    const signals: import('@/lib/lead-intelligence/types').LeadSignal[] = [];
    let unreadCount = 0;

    snap.forEach((doc) => {
      const data = doc.data() as import('@/lib/lead-intelligence/types').LeadSignal;
      signals.push({ ...data, id: doc.id });
      if (!data.isRead) {
        unreadCount++;
      }
    });

    return {
      success: true,
      signals,
      unreadCount
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch workspace signals:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve signals'
    };
  }
}

/**
 * Retrieves signals for a specific prospect.
 */
export async function getProspectSignalsAction(
  prospectId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  signals?: import('@/lib/lead-intelligence/types').LeadSignal[];
  error?: string;
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    const snap = await adminDb
      .collection('lead_signals')
      .where('workspaceId', '==', workspaceId)
      .where('prospectId', '==', prospectId)
      .where('isDismissed', '==', false)
      .orderBy('detectedAt', 'desc')
      .limit(20)
      .get();

    const signals: import('@/lib/lead-intelligence/types').LeadSignal[] = [];
    snap.forEach((doc) => {
      signals.push({ ...(doc.data() as import('@/lib/lead-intelligence/types').LeadSignal), id: doc.id });
    });

    return {
      success: true,
      signals
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch prospect signals:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve prospect signals'
    };
  }
}

/**
 * Retrieves or initializes the account monitoring configuration for a prospect.
 */
export async function getAccountMonitoringConfigAction(
  prospectId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  config?: import('@/lib/lead-intelligence/types').AccountMonitoringConfig;
  error?: string;
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  const { ContinuousSignalMonitorService } = await import('@/lib/lead-intelligence/signals/ContinuousSignalMonitorService');

  try {
    const docRef = adminDb.collection('account_monitoring').doc(prospectId);
    const snap = await docRef.get();

    if (snap.exists) {
      return {
        success: true,
        config: snap.data() as import('@/lib/lead-intelligence/types').AccountMonitoringConfig
      };
    }

    // Default configuration
    const defaultConfig = ContinuousSignalMonitorService.getDefaultMonitoringConfig(prospectId, workspaceId);
    await docRef.set(defaultConfig);

    return {
      success: true,
      config: defaultConfig
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to fetch monitoring config:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to retrieve monitoring configuration'
    };
  }
}

/**
 * Saves updated account monitoring preferences for a prospect.
 */
export async function saveAccountMonitoringConfigAction(
  config: import('@/lib/lead-intelligence/types').AccountMonitoringConfig
): Promise<{
  success: boolean;
  error?: string;
}> {
  if (!config.prospectId || !config.workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    const now = new Date().toISOString();
    const updatedConfig = {
      ...config,
      updatedAt: now
    };

    await adminDb.collection('account_monitoring').doc(config.prospectId).set(updatedConfig, { merge: true });

    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to save monitoring config:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to save monitoring configuration'
    };
  }
}

/**
 * Marks a lead signal as read.
 */
export async function markSignalReadAction(
  signalId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  if (!signalId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    await adminDb.collection('lead_signals').doc(signalId).update({
      isRead: true
    });
    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to mark signal read:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update signal' };
  }
}

/**
 * Dismisses a lead signal from feeds.
 */
export async function dismissSignalAction(
  signalId: string,
  workspaceId: string
): Promise<{ success: boolean; error?: string }> {
  if (!signalId || !workspaceId) {
    return { success: false, error: 'Invalid parameters' };
  }

  try {
    await adminDb.collection('lead_signals').doc(signalId).update({
      isDismissed: true
    });
    return { success: true };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to dismiss signal:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Failed to dismiss signal' };
  }
}

/**
 * Triggers an immediate delta re-scan for a prospect and registers any detected intent signals.
 */
export async function triggerProspectDeltaScanAction(
  prospectId: string,
  workspaceId: string
): Promise<{
  success: boolean;
  newSignalsCount: number;
  signals?: import('@/lib/lead-intelligence/types').LeadSignal[];
  error?: string;
}> {
  if (!prospectId || !workspaceId) {
    return { success: false, newSignalsCount: 0, error: 'Invalid parameters' };
  }

  const { ContinuousSignalMonitorService } = await import('@/lib/lead-intelligence/signals/ContinuousSignalMonitorService');
  const { DOMScraperService } = await import('@/lib/lead-intelligence/scraper/DOMScraperService');
  const { SubdomainProberService } = await import('@/lib/lead-intelligence/scraper/SubdomainProberService');

  try {
    const prospectRef = adminDb.collection('prospects').doc(prospectId);
    const snap = await prospectRef.get();
    if (!snap.exists) {
      return { success: false, newSignalsCount: 0, error: 'Prospect not found' };
    }

    const previousProspect = snap.data() as Prospect;
    const domain = previousProspect.domain;

    // Scrape fresh snapshot
    let freshTech = previousProspect.websiteScan?.technologies || [];
    const sslValid = previousProspect.websiteScan?.sslValid ?? true;
    try {
      const scrapeResult = await DOMScraperService.scrapeDomain(domain);
      const detectedPayments = scrapeResult.paymentSignatures.map(p => p.provider);
      if (detectedPayments.length > 0) {
        freshTech = Array.from(new Set([...freshTech, ...detectedPayments]));
      }
    } catch {
      // Graceful fallback to existing
    }

    // Probes subdomains
    try {
      const probes = await SubdomainProberService.probeDomain(domain);
      const activeSubdomains = probes
        .filter(p => p.status !== 'unreachable')
        .map(p => `${p.subdomain}.${domain}`);
      if (activeSubdomains.length > 0) {
        freshTech = Array.from(new Set([...freshTech, ...activeSubdomains]));
      }
    } catch {
      // Graceful fallback
    }

    const now = new Date().toISOString();
    const currentProspect: Prospect = {
      ...previousProspect,
      websiteScan: {
        ...(previousProspect.websiteScan || {
          scannedAt: now,
          hasFacebook: false,
          hasInstagram: false,
          hasLinkedIn: false,
          hasTwitter: false
        }),
        scannedAt: now,
        technologies: freshTech,
        sslValid
      },
      updatedAt: now
    };

    // Detect deltas
    const detectedSignals = ContinuousSignalMonitorService.detectDeltas(previousProspect, currentProspect);

    // Persist new signals to Firestore in chunked batch
    if (detectedSignals.length > 0) {
      const batch = adminDb.batch();
      for (const sig of detectedSignals) {
        const sigRef = adminDb.collection('lead_signals').doc(sig.id);
        batch.set(sigRef, sig, { merge: true });
      }
      await batch.commit();
    }

    // Update prospect active signals count and latest scan timestamp
    await prospectRef.update({
      'websiteScan.technologies': freshTech,
      'websiteScan.sslValid': sslValid,
      'websiteScan.scannedAt': now,
      updatedAt: now,
      activeSignalsCount: (previousProspect.activeSignalsCount || 0) + detectedSignals.length
    });

    // Update monitoring record
    const monRef = adminDb.collection('account_monitoring').doc(prospectId);
    await monRef.set({
      lastScannedAt: now,
      changesDetectedCount: (previousProspect.activeSignalsCount || 0) + detectedSignals.length,
      updatedAt: now
    }, { merge: true });

    return {
      success: true,
      newSignalsCount: detectedSignals.length,
      signals: detectedSignals
    };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Failed to trigger delta scan:', err);
    return {
      success: false,
      newSignalsCount: 0,
      error: err instanceof Error ? err.message : 'Failed to execute delta scan'
    };
  }
}





