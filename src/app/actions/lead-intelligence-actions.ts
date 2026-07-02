'use server';

import { adminDb } from '@/lib/firebase-admin';
import { LeadIntelligenceEngine } from '@/lib/lead-intelligence/LeadIntelligenceEngine';
import type { 
  Prospect, 
  SearchFilters, 
  LeadIntelligenceSettings, 
  SavedSearch 
} from '@/lib/lead-intelligence/types';
import type { Entity, WorkspaceEntity, EntityContact } from '@/lib/types';
import { adjustLeadScoreAction } from '@/lib/scoring-performance-engine';

/**
 * Resolves credentials for a workspace.
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
 * Queries Google Places or fallbacks using search engine.
 */
export async function searchProspectsAction(
  workspaceId: string,
  organizationId: string,
  queryText: string,
  filters: SearchFilters
): Promise<{ success: boolean; prospects?: Prospect[]; error?: string }> {
  try {
    const settings = await getLeadSettingsAction(workspaceId);
    const prospects = await LeadIntelligenceEngine.searchProspects(
      organizationId,
      workspaceId,
      queryText,
      filters,
      settings
    );

    // Save newly searched prospects to the DB as unregistered so they persist
    const batch = adminDb.batch();
    for (const p of prospects) {
      const docRef = adminDb.collection('prospects').doc(p.id);
      batch.set(docRef, p);
    }
    await batch.commit();

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
 * Syncs lead into global entities & workspace_entities collections.
 */
export async function syncProspectToCRMAction(
  prospect: Prospect
): Promise<{ success: boolean; entityId?: string; error?: string }> {
  try {
    const entityId = `entity_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const wsEntityId = `${prospect.workspaceId}_${entityId}`;
    const now = new Date().toISOString();

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
      slug: prospect.domain.split('.')[0] || '',
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

    const batch = adminDb.batch();
    
    // Set CRM global entity
    batch.set(adminDb.collection('entities').doc(entityId), newEntity);

    // Set CRM workspace-specific entity
    batch.set(adminDb.collection('workspace_entities').doc(wsEntityId), newWorkspaceEntity);

    // Update prospect record
    batch.update(adminDb.collection('prospects').doc(prospect.id), {
      syncStatus: 'synced',
      syncedEntityId: entityId,
      updatedAt: now
    });

    // Write activity log
    const activityId = `act_${Date.now()}`;
    batch.set(adminDb.collection('prospects').doc(prospect.id).collection('activities').doc(activityId), {
      id: activityId,
      prospectId: prospect.id,
      workspaceId: prospect.workspaceId,
      type: 'create_deal',
      userId: 'system_api',
      userName: 'SmartSapp CRM',
      content: `Lead synced to SmartSapp CRM. Created Entity ${prospect.name}.`,
      createdAt: now
    });

    await batch.commit();

    // Trigger score history logger (non-blocking)
    try {
      await adjustLeadScoreAction({
        organizationId: prospect.organizationId,
        workspaceId: prospect.workspaceId,
        entityId,
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

    return { success: true, entityId };
  } catch (err: unknown) {
    console.error('[lead-intelligence-actions] Sync failed:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
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
      .limit(30)
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
