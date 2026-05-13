'use server';

import { adminDb } from './firebase-admin';
import type { VariableDefinition, Survey, PDFForm, SurveyQuestion, MessageLog } from './types';
import { revalidatePath } from 'next/cache';
import { fetchSmsStatusAction } from './mnotify-actions';
import { fetchEmailStatusAction } from './resend-actions';
import { resolveContact } from './contact-adapter';
import { getContactEmail, getContactPhone } from './migration-status-utils';

/**
 * @fileOverview Server-side actions for the Variable Registry.
 * Handles harvesting dynamic schema from Surveys and PDFs, managing constants,
 * and resolving data for the messaging engine.
 */

/**
 * Synchronizes the Variable Registry by scanning Schools, Meetings, Surveys, and PDFs.
 * Harvests dynamic fields into the main workspace-scoped 'app_fields' registry.
 * This ensures that Survey questions and PDF fields are available for messaging and forms.
 */
export async function syncVariableRegistry() {
  try {
    const fieldsCol = adminDb.collection('app_fields');
    const timestamp = new Date().toISOString();

    // Helper to get or create a system group for harvested fields
    const getOrCreateGroup = async (workspaceId: string, organizationId: string, name: string, slug: string, icon: string) => {
      const groupsCol = adminDb.collection('field_groups');
      const snap = await groupsCol.where('workspaceId', '==', workspaceId).where('slug', '==', slug).limit(1).get();
      if (!snap.empty) {
        return snap.docs[0].id;
      }
      const ref = groupsCol.doc();
      await ref.set({
        id: ref.id,
        workspaceId,
        organizationId,
        name,
        slug,
        icon,
        color: '#64748b',
        entityTypes: ['institution', 'person', 'family'],
        isSystem: true,
        order: 900,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      return ref.id;
    };

    // 1. DYNAMIC SURVEY HARVESTING
    const surveysSnap = await adminDb.collection('surveys').where('status', '!=', 'archived').get();
    for (const doc of surveysSnap.docs) {
      const survey = doc.data() as Survey;
      const workspaceId = survey.workspaceIds?.[0] || 'onboarding'; // Surveys can be multi-workspace, but we map to primary for field registry
      const organizationId = survey.organizationId || 'default';
      
      const groupId = await getOrCreateGroup(workspaceId, organizationId, 'Survey Responses', 'surveys', 'FileText');
      const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);

      for (const q of questions) {
        const fieldId = `survey_${doc.id}_${q.id}`;
        await fieldsCol.doc(fieldId).set({
          workspaceId,
          organizationId,
          groupId,
          name: q.title.replace(/<[^>]*>?/gm, ''),
          label: q.title.replace(/<[^>]*>?/gm, ''),
          variableName: q.id,
          type: 'short_text', // Defaulting to text for survey answers
          section: 'surveys',
          isNative: false,
          compatibilityScope: ['submission-only'],
          status: 'active',
          updatedAt: timestamp
        }, { merge: true });
      }
    }

    // 2. DYNAMIC PDF FORM HARVESTING
    const pdfsSnap = await adminDb.collection('pdfs').where('status', '!=', 'archived').get();
    for (const doc of pdfsSnap.docs) {
      const pdf = doc.data() as PDFForm;
      const workspaceId = pdf.workspaceIds?.[0] || 'onboarding';
      const organizationId = pdf.organizationId || 'default';
      const fields = pdf.fields || [];

      const groupId = await getOrCreateGroup(workspaceId, organizationId, 'Form Fields', 'forms', 'FileText');

      for (const f of fields) {
        if (f.type === 'signature' || f.type === 'photo') continue;

        const fieldId = `pdf_${doc.id}_${f.id}`;
        await fieldsCol.doc(fieldId).set({
          workspaceId,
          organizationId,
          groupId,
          name: f.label || f.placeholder || f.id,
          label: f.label || f.placeholder || f.id,
          variableName: f.id,
          type: 'short_text',
          section: 'forms',
          isNative: false,
          compatibilityScope: ['submission-only'],
          status: 'active',
          updatedAt: timestamp
        }, { merge: true });
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error(">>> [VARIABLES] Sync Failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Synchronizes statuses for all relevant messaging logs by querying providers.
 * High-cost operation - limited to top 50 logs.
 * Upgraded to include 'scheduled' messages that should have fired by now.
 */
export async function syncAllLogStatuses() {
  try {
    const logsCol = adminDb.collection('message_logs');
    const now = new Date().toISOString();

    // 1. Fetch 'sent' messages for final delivery confirmation
    const sentLogsSnap = await logsCol
      .where('status', '==', 'sent')
      .orderBy('sentAt', 'desc')
      .limit(30)
      .get();

    // 2. Fetch 'scheduled' messages that should have been sent already
    const overdueScheduledSnap = await logsCol
      .where('status', '==', 'scheduled')
      .where('sentAt', '<=', now)
      .limit(20)
      .get();

    const allDocs = [...sentLogsSnap.docs, ...overdueScheduledSnap.docs];

    if (allDocs.length === 0) return { success: true, count: 0 };

    let updatedCount = 0;
    for (const logDoc of allDocs) {
      const log = { id: logDoc.id, ...logDoc.data() } as MessageLog;
      if (!log.providerId) continue;

      let providerStatus = '';
      let isDelivered = false;
      let isSentByProvider = false;

      try {
        if (log.channel === 'sms') {
          const res = await fetchSmsStatusAction(log.providerId);
          if (res.success) {
            providerStatus = String(res.data.status);
            // mNotify '0' means successfully delivered to handset
            isDelivered = providerStatus === '0' || providerStatus.toLowerCase().includes('delivered');
            isSentByProvider = true; // If we get a status, it's out of the queue
          }
        } else {
          const res = await fetchEmailStatusAction(log.providerId);
          if (res.success) {
            providerStatus = res.data.last_event || 'sent';
            isDelivered = providerStatus === 'delivered';
            isSentByProvider = providerStatus !== 'scheduled';
          }
        }

        const needsUpdate = providerStatus && providerStatus !== log.providerStatus;
        const wasScheduled = log.status === 'scheduled' && isSentByProvider;

        if (needsUpdate || wasScheduled) {
          const updates: any = {
            providerStatus,
            updatedAt: new Date().toISOString()
          };

          if (isDelivered) {
            updates.status = 'sent';
          } else if (providerStatus === 'bounced' || providerStatus === 'failed') {
            updates.status = 'failed';
          } else if (wasScheduled) {
            updates.status = 'sent'; // Move from scheduled to sent (confirmed dispatch)
          }

          await logDoc.ref.update(updates);
          updatedCount++;
        }
      } catch (e) {
        console.error(`Status sync failed for log ${log.id}`);
      }
    }

    revalidatePath('/admin/messaging/logs');
    return { success: true, count: updatedCount };
  } catch (e: any) {
    console.error(">>> [MESSAGING:SYNC] Global Failure:", e.message);
    return { success: false, error: e.message };
  }
}

/**
 * Creates or updates a Global Constant variable in the App Fields registry.
 */
export async function upsertConstantVariable(data: {
  workspaceId: string;
  organizationId: string;
  key: string;
  label: string;
  value: string;
}) {
  try {
    const id = `const_${data.key}`;
    const timestamp = new Date().toISOString();
    
    await adminDb.collection('app_fields').doc(id).set({
      workspaceId: data.workspaceId,
      organizationId: data.organizationId,
      name: data.label,
      label: data.label,
      variableName: data.key,
      defaultValue: data.value,
      type: 'hidden',
      section: 'common',
      isNative: false,
      compatibilityScope: ['common'],
      status: 'active',
      updatedAt: timestamp
    }, { merge: true });

    revalidatePath('/admin/settings/fields');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Updates the global visibility of a field.
 */
export async function updateVariableVisibility(id: string, hidden: boolean) {
  try {
    await adminDb.collection('app_fields').doc(id).update({
      status: hidden ? 'inactive' : 'active',
      updatedAt: new Date().toISOString()
    });
    revalidatePath('/admin/settings/fields');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Deletes a manual constant field.
 */
export async function deleteVariable(id: string) {
  try {
    await adminDb.collection('app_fields').doc(id).delete();
    revalidatePath('/admin/settings/fields');
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Fetches data for a specific entity to resolve variables in the composer.
 */
/**
 * Fetches contextual data for variable resolution.
 * Updated to use Contact Adapter for School entity (Requirement 25.4)
 */
export async function fetchContextualData(entity: string, id: string, parentId?: string, workspaceId?: string) {
  try {
    let data: any = null;
    if (entity === 'Meeting') {
      const snap = await adminDb.collection('meetings').doc(id).get();
      if (snap.exists) data = snap.data();
    } else if (entity === 'SurveyResponse' && parentId) {
      const snap = await adminDb.collection('surveys').doc(parentId).collection('responses').doc(id).get();
      if (snap.exists) data = snap.data();
    } else if (entity === 'Submission' && parentId) {
      const snap = await adminDb.collection('pdfs').doc(parentId).collection('submissions').doc(id).get();
      if (snap.exists) data = snap.data();
    } else if (entity === 'School' || entity === 'Entity') {
      // Use Contact Adapter (Requirement 25.4)
      if (workspaceId) {
        const contact = await resolveContact(id, workspaceId);
        if (contact) {
          // Return schoolData or combined data for backward compatibility
          data = contact.schoolData || {
            name: contact.name,
            displayName: contact.name,
            email: getContactEmail(contact),
            phone: getContactPhone(contact),
            primaryContact: contact.contacts?.find(c => c.isSignatory) || contact.contacts?.[0]
          };
        }
      } else {
        throw new Error("Workspace context required for entity resolution");
      }
    }

    return { success: true, data };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Deletes all harvested variables for a specific source.
 */
export async function clearVariablesForSource(sourceId: string) {
  const variablesCol = adminDb.collection('messaging_variables');
  const querySnap = await variablesCol.where('sourceId', '==', sourceId).get();

  const batch = adminDb.batch();
  querySnap.forEach(doc => batch.delete(doc.ref));
  await batch.commit();

  revalidatePath('/admin/messaging/variables');
  return { success: true };
}

/**
 * Resolves tag-related template variables for a contact.
 * Fetches the contact's tag IDs, resolves them to tag names, and returns
 * formatted variables for use in message templates.
 *
 * **Updated for Requirement 7**: Resolves tags from workspace_entities.workspaceTags
 * for the active workspace context, ensuring workspace-scoped tag variables.
 *
 * Returns:
 *   contact_tags  — comma-separated tag names (e.g. "Hot Lead, VIP, Engaged")
 *   tag_count     — number of tags applied
 *   tag_list      — JSON array of tag name strings (for iteration)
 *   has_tag       — JSON object mapping tag name (lowercase) → true (for conditionals)
 *
 * Requirements: FR5.2.1, FR5.2.2, Requirement 7, Requirement 11
 */
export async function resolveTagVariables(
  contactId: string,
  contactType: 'school' | 'prospect',
  workspaceId?: string
): Promise<{
  contact_tags: string;
  tag_count: number;
  tag_list: string;
  has_tag: string;
}> {
  const empty = { contact_tags: '', tag_count: 0, tag_list: '[]', has_tag: '{}' };

  try {
    let tagIds: string[] = []; // If workspaceId is provided, resolve from workspace_entities.workspaceTags (Requirement 7)
    if (workspaceId) {
      // Query workspace_entities for workspace-scoped tags
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', contactId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        tagIds = weSnap.docs[0].data()?.workspaceTags || [];
      } else {
        // Fallback to direct tags if no workspace_entities record exists
        const collectionName = contactType === 'school' ? 'schools' : 'prospects';
        const contactSnap = await adminDb.collection(collectionName).doc(contactId).get();
        tagIds = contactSnap.data()?.tags || [];
      }
    } else {

      // Legacy path: resolve from contact document (backward compatibility)
      const collectionName = contactType === 'school' ? 'schools' : 'prospects';
      const contactSnap = await adminDb.collection(collectionName).doc(contactId).get();

      if (!contactSnap.exists) return empty;

      tagIds = contactSnap.data()?.tags || [];
    }

    if (tagIds.length === 0) return empty;

    // Resolve tag IDs to tag names in parallel (batch by 10 for Firestore 'in' limit)
    const tagNames: string[] = [];
    const chunkSize = 10;

    for (let i = 0; i < tagIds.length; i += chunkSize) {
      const chunk = tagIds.slice(i, i + chunkSize);
      const tagsSnap = await adminDb
        .collection('tags')
        .where('__name__', 'in', chunk)
        .get();

      // Preserve original order
      const nameMap = new Map<string, string>();
      tagsSnap.docs.forEach(doc => nameMap.set(doc.id, doc.data().name as string));
      chunk.forEach(id => {
        const name = nameMap.get(id);
        if (name) tagNames.push(name);
      });
    }

    // Build has_tag map: { "hot lead": true, "vip": true }
    const hasTagMap: Record<string, boolean> = {};
    tagNames.forEach(name => {
      hasTagMap[name.toLowerCase()] = true;
    });

    return {
      contact_tags: tagNames.join(', '),
      tag_count: tagNames.length,
      tag_list: JSON.stringify(tagNames),
      has_tag: JSON.stringify(hasTagMap),
    };
  } catch (error: any) {
    console.error('resolveTagVariables error:', error.message);
    return empty;
  }
}

/**
 * Previews the audience for a campaign.
 * 
 * Tiered query strategy (R1/R2 fix):
 *   Tier 1: Firestore-native (array-contains-any + equality) — fast, server-side
 *   Tier 2: Hybrid (Tier 1 fetch + JS filter) — for AND across arrays
 *   Preview always capped at 500 docs. Count uses subset estimation.
 *
 * Backward-compatible: accepts both legacy tag params and Phase 4 AudienceFilter[].
 * Requirements: FR5.1.2, FR5.1.3
 */
export async function previewCampaignAudience(params: {
  workspaceId: string;
  filters?: Array<{ id: string; field: string; operator: string; value: any }>;
  filterLogic?: 'AND' | 'OR';
  limit?: number;
  contactScope?: 'primary' | 'signatories' | 'all' | (string & {});
  channel?: 'email' | 'sms';
  includeTagIds?: string[];
  excludeTagIds?: string[];
  includeLogic?: 'AND' | 'OR';
}): Promise<{
  success: boolean;
  count?: number;
  contactCount?: number;
  preview?: { id: string; name: string; tags: string[] }[];
  tagDistribution?: { tagId: string; tagName: string; count: number }[];
  error?: string;
}> {
  try {
    const { workspaceId, limit: previewLimit = 10, contactScope = 'all', channel } = params;

    // ── Normalize legacy params into filters ──────────────────────────────
    let filters = params.filters || [];
    let filterLogic = params.filterLogic || 'AND';

    if (filters.length === 0 && params.includeTagIds && params.includeTagIds.length > 0) {
      filters = [{
        id: '_legacy_include',
        field: 'tags',
        operator: params.includeLogic === 'AND' ? 'all_of' : 'any_of',
        value: params.includeTagIds,
      }];
      if (params.excludeTagIds && params.excludeTagIds.length > 0) {
        filters.push({
          id: '_legacy_exclude',
          field: 'tags',
          operator: 'is_not',
          value: params.excludeTagIds,
        });
      }
      filterLogic = 'AND';
    }

    // ── Build Firestore query (Tier 1: server-side) ───────────────────────
    let baseQuery: FirebaseFirestore.Query = adminDb
      .collection('workspace_entities')
      .where('workspaceId', '==', workspaceId);

    const tagFilters = filters.filter(f => f.field === 'tags');
    const equalityFilters = filters.filter(f => f.field !== 'tags' && f.field !== 'contactRoles' && f.operator !== 'is_empty' && f.operator !== 'is_not_empty');
    const emptyFilters = filters.filter(f => f.operator === 'is_empty' || f.operator === 'is_not_empty');

    // Apply equality filters server-side (Firestore supports multiple == on different fields)
    const fieldMap: Record<string, string> = {
      status: 'status',
      entityType: 'entityType',
      assignedTo: 'assignedTo.userId',
      locationCountry: 'locationCountryId',
      locationRegion: 'locationRegionId',
      locationDistrict: 'locationDistrictId',
      lifecycleStatus: 'lifecycleStatus',
    };

    for (const f of equalityFilters) {
      const fsField = fieldMap[f.field];
      if (!fsField) continue;
      if (f.operator === 'is') {
        baseQuery = baseQuery.where(fsField, '==', f.value);
      } else if (f.operator === 'is_not') {
        baseQuery = baseQuery.where(fsField, '!=', f.value);
      }
    }

    // Apply ONE tag filter server-side (Firestore constraint: one array-contains-any per query)
    const includeTagFilter = tagFilters.find(f => f.operator === 'any_of' || f.operator === 'all_of');
    if (includeTagFilter && Array.isArray(includeTagFilter.value) && includeTagFilter.value.length > 0) {
      if (includeTagFilter.operator === 'any_of') {
        // OR: use array-contains-any (chunked at 10)
        const firstChunk = includeTagFilter.value.slice(0, 10);
        baseQuery = baseQuery.where('workspaceTags', 'array-contains-any', firstChunk);
      } else if (includeTagFilter.operator === 'all_of') {
        // AND: use array-contains for first tag, JS-filter remaining (Tier 2)
        baseQuery = baseQuery.where('workspaceTags', 'array-contains', includeTagFilter.value[0]);
      }
    }

    // ── Execute query (Uncapped to get accurate count) ────────────────────────
    const snap = await baseQuery.get();

    interface ContactEntry { id: string; name: string; tags: string[]; data: any; }
    let results: ContactEntry[] = snap.docs.map(d => ({
      id: d.data().entityId || d.id,
      name: d.data().displayName || d.data().name || '',
      tags: d.data().workspaceTags || [],
      data: d.data(),
    }));

    // ── Tier 2: JS-filter for conditions Firestore can't handle ───────────

    // AND-logic remaining tags
    if (includeTagFilter?.operator === 'all_of' && includeTagFilter.value.length > 1) {
      const remaining = includeTagFilter.value.slice(1);
      results = results.filter(c => remaining.every((t: string) => c.tags.includes(t)));
    }

    // OR with >10 tags: additional chunks
    if (includeTagFilter?.operator === 'any_of' && includeTagFilter.value.length > 10) {
      const additionalTags = includeTagFilter.value.slice(10);
      // Already have results for first 10; add results for remaining chunks
      for (let i = 0; i < additionalTags.length; i += 10) {
        const chunk = additionalTags.slice(i, i + 10);
        let chunkQuery: FirebaseFirestore.Query = adminDb
          .collection('workspace_entities')
          .where('workspaceId', '==', workspaceId)
          .where('workspaceTags', 'array-contains-any', chunk);
        const chunkSnap = await chunkQuery.get();
        const existingIds = new Set(results.map(r => r.id));
        chunkSnap.docs.forEach(d => {
          const eid = d.data().entityId || d.id;
          if (!existingIds.has(eid)) {
            results.push({ id: eid, name: d.data().displayName || '', tags: d.data().workspaceTags || [], data: d.data() });
          }
        });
      }
    }

    // Exclude tags (JS filter)
    const excludeTagFilter = tagFilters.find(f => f.operator === 'is_not');
    if (excludeTagFilter && Array.isArray(excludeTagFilter.value) && excludeTagFilter.value.length > 0) {
      results = results.filter(c => !excludeTagFilter.value.some((t: string) => c.tags.includes(t)));
    }

    // Empty/not-empty filters (JS filter)
    for (const f of emptyFilters) {
      const fsField = fieldMap[f.field] || f.field;
      if (f.operator === 'is_empty') {
        results = results.filter(c => !c.data[fsField]);
      } else {
        results = results.filter(c => !!c.data[fsField]);
      }
    }

    // (Contact Roles filter logic removed; now handled dynamically in contactScope)

    // ── CRM & Automation Filters (Tier 2 JS Filter via Pre-flight Queries) ─

    const dealPipelineFilters = filters.filter(f => f.field === 'dealPipeline');
    const dealStageFilters = filters.filter(f => f.field === 'dealStage');
    const automationIdFilters = filters.filter(f => f.field === 'automationId');
    const automationStatusFilters = filters.filter(f => f.field === 'automationStatus');

    // 1. Deals Filtering
    if (dealPipelineFilters.length > 0 || dealStageFilters.length > 0) {
      let dealQuery = adminDb.collection('deals').where('workspaceId', '==', workspaceId);
      const dealsSnap = await dealQuery.get(); // Get all workspace deals to evaluate locally (O(1) lookups)
      
      const pipelines = dealPipelineFilters.flatMap(f => Array.isArray(f.value) ? f.value : []);
      const pipelineSet = new Set(pipelines);
      
      const stages = dealStageFilters.flatMap(f => Array.isArray(f.value) ? f.value : []);
      const stageSet = new Set(stages);
      
      const validDealEntityIds = new Set<string>();
      
      dealsSnap.docs.forEach(doc => {
        const d = doc.data();
        let match = true;
        if (pipelineSet.size > 0 && !pipelineSet.has(d.pipelineId)) match = false;
        if (stageSet.size > 0 && !stageSet.has(d.stageId)) match = false;
        if (match && d.entityId) {
          validDealEntityIds.add(d.entityId);
        }
      });

      // Apply Pipeline Filters
      for (const f of dealPipelineFilters) {
        if (f.operator === 'any_of') {
          results = results.filter(r => validDealEntityIds.has(r.id));
        } else if (f.operator === 'is_not') {
          results = results.filter(r => !validDealEntityIds.has(r.id));
        }
      }

      // Apply Stage Filters
      for (const f of dealStageFilters) {
        if (f.operator === 'any_of') {
          results = results.filter(r => validDealEntityIds.has(r.id));
        } else if (f.operator === 'is_not') {
          results = results.filter(r => !validDealEntityIds.has(r.id));
        }
      }
    }

    // 2. Automations Filtering
    if (automationIdFilters.length > 0 || automationStatusFilters.length > 0) {
      // Fetch automations matching the requested IDs or Statuses
      const automationIds = automationIdFilters.flatMap(f => Array.isArray(f.value) ? f.value : []);
      const automationIdSet = new Set(automationIds);
      
      const statuses = automationStatusFilters.flatMap(f => Array.isArray(f.value) ? f.value : (f.value ? [f.value] : []));
      const statusSet = new Set(statuses);
      
      // Since automation_runs might not have workspaceId, we fetch by automationId if present
      let runsSnap;
      if (automationIds.length > 0 && automationIds.length <= 30) {
         runsSnap = await adminDb.collection('automation_runs').where('automationId', 'in', automationIds).get();
      } else {
         // Fallback if >30 IDs or just status filters (might be heavy, consider limiting scope in production)
         runsSnap = await adminDb.collection('automation_runs').get();
      }

      const validRunEntityIds = new Set<string>();
      
      runsSnap.docs.forEach(doc => {
         const d = doc.data();
         let match = true;
         if (automationIdSet.size > 0 && !automationIdSet.has(d.automationId)) match = false;
         if (statusSet.size > 0 && !statusSet.has(d.status)) match = false;
         if (match && d.entityId) {
            validRunEntityIds.add(d.entityId);
         }
      });

      // Apply Automation ID Filters
      for (const f of automationIdFilters) {
        if (f.operator === 'any_of') {
          results = results.filter(r => validRunEntityIds.has(r.id));
        } else if (f.operator === 'is_not') {
          results = results.filter(r => !validRunEntityIds.has(r.id));
        }
      }

      // Apply Automation Status Filters
      for (const f of automationStatusFilters) {
        if (f.operator === 'is' || f.operator === 'any_of' as any) {
          results = results.filter(r => validRunEntityIds.has(r.id));
        } else if (f.operator === 'is_not') {
          results = results.filter(r => !validRunEntityIds.has(r.id));
        }
      }
    }

    // ── Build response ────────────────────────────────────────────────────
    const allTagIds = new Set<string>();
    results.forEach(c => c.tags.forEach(t => allTagIds.add(t)));

    const tagNameMap = new Map<string, string>();
    const tagIdArray = Array.from(allTagIds);
    for (let i = 0; i < tagIdArray.length; i += 10) {
      const chunk = tagIdArray.slice(i, i + 10);
      if (chunk.length === 0) continue;
      const tagSnap = await adminDb.collection('tags').where('__name__', 'in', chunk).get();
      tagSnap.docs.forEach(d => tagNameMap.set(d.id, d.data().name as string));
    }

    const tagCounts = new Map<string, number>();
    results.forEach(c => c.tags.forEach(tagId => {
      tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
    }));

    const tagDistribution = Array.from(tagCounts.entries())
      .map(([tagId, count]) => ({ tagId, tagName: tagNameMap.get(tagId) || tagId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const preview = results.slice(0, previewLimit).map(c => ({
      id: c.id,
      name: c.name,
      tags: c.tags.map(id => tagNameMap.get(id) || id),
    }));

    // Calculate contact count accurately based on channel & scope
    let contactCount = 0;
    const isRoleBased = contactScope !== 'primary' && contactScope !== 'signatories' && contactScope !== 'all';
    const targetRole = isRoleBased && contactScope.startsWith('role:') ? contactScope.split(':')[1] : contactScope;

    results.forEach(c => {
      const sourceContacts = c.data.entityContacts || c.data.contacts || [];
      
      // Helper to check if a contact matches the requested channel
      const isValidForChannel = (sc: any, fallbackData: any) => {
        if (!channel) return true; // No channel specified, assume valid
        if (channel === 'email') return !!sc.email || (!sc && !!fallbackData.email);
        if (channel === 'sms') return !!sc.phone || (!sc && !!fallbackData.phone);
        return false;
      };

      if (isRoleBased) {
        // Only count contacts that have the specific role and valid channel data
        contactCount += sourceContacts.filter((sc: any) => sc.typeKey === targetRole && isValidForChannel(sc, c.data)).length;
      } else if (contactScope === 'primary') {
        const primary = sourceContacts.find((sc: any) => sc.isPrimary) || sourceContacts[0];
        if (primary) {
          if (isValidForChannel(primary, c.data)) contactCount++;
        } else {
          // Fallback to entity direct fields if no nested contacts exist
          if (isValidForChannel(null, c.data)) contactCount++;
        }
      } else if (contactScope === 'signatories') {
        contactCount += sourceContacts.filter((sc: any) => sc.isSignatory && isValidForChannel(sc, c.data)).length;
      } else { // 'all'
        if (sourceContacts.length > 0) {
          contactCount += sourceContacts.filter((sc: any) => isValidForChannel(sc, c.data)).length;
        } else {
          // Fallback to entity direct fields
          if (isValidForChannel(null, c.data)) contactCount++;
        }
      }
    });

    return { success: true, count: results.length, contactCount, preview, tagDistribution };
  } catch (error: any) {
    console.error('previewCampaignAudience error:', error.message);
    return { success: false, error: error.message };
  }
}

export interface ResolvedRecipient {
  contact: string;
  contactName: string;
  entityName: string;
}

/**
 * Resolves specific recipient contacts (emails/phones) for an entity based on scope and channel.
 * Used by the client-side dispatch loop to build a concrete list of recipients.
 * 
 * Requirement 35.3
 */
export async function resolveRecipientContacts(params: {
  entityId: string;
  workspaceId?: string;
  contactScope: 'primary' | 'signatories' | 'all' | 'custom' | (string & {});
  channel: 'email' | 'sms';
  contactTypeFilter?: string[] | null; // e.g. ['father', 'mother', 'guardian']
}): Promise<ResolvedRecipient[]> {
  const { entityId, workspaceId = 'onboarding', contactScope, channel, contactTypeFilter } = params;

  try {
    const contact = await resolveContact(entityId, workspaceId);
    if (!contact) return [];

    const entityName = contact.name || 'Unknown Entity';
    const sourceContacts = contact.entityContacts || contact.contacts || [];

    // Map source contacts to resolved recipients
    const mapContacts = (list: any[]): ResolvedRecipient[] => {
      return list.map((c: any) => ({
        contact: channel === 'email' ? c.email : (c.phone || ''),
        contactName: c.name || c.displayName || entityName,
        entityName
      })).filter(r => !!r.contact);
    };

    if (contactTypeFilter && contactTypeFilter.length > 0) {
      const typed = sourceContacts.filter((c: any) => contactTypeFilter.includes(c.typeKey));
      return mapContacts(typed);
    }

    if (contactScope.startsWith('role:')) {
      const targetRole = contactScope.split(':')[1];
      const typed = sourceContacts.filter((c: any) => c.typeKey === targetRole);
      return mapContacts(typed);
    }

    if (contactScope === 'primary') {
      const primary = sourceContacts.find((c: any) => c.isPrimary) || sourceContacts[0];
      if (!primary) {
        // Fallback to direct entity fields if no contact objects exist
        const email = getContactEmail(contact);
        const phone = getContactPhone(contact);
        const val = channel === 'email' ? email : phone;
        return val ? [{ contact: val, contactName: entityName, entityName }] : [];
      }
      return mapContacts([primary]);
    } else if (contactScope === 'signatories') {
      const signatories = sourceContacts.filter((c: any) => c.isSignatory);
      return mapContacts(signatories);
    } else if (contactScope === 'all') {
      return mapContacts(sourceContacts);
    }

    return [];
  } catch (error) {
    console.error(`[RESOLVE_CONTACTS] Error for ${entityId}:`, error);
    return [];
  }
}

/**
 * Updates the lastContactedAt timestamp on a workspace entity.
 * Called automatically after a message is successfully sent to track CRM activity.
 */
export async function updateEntityLastContactedAt(entityId: string, workspaceId: string) {
  try {
    const weSnap = await adminDb
      .collection('workspace_entities')
      .where('entityId', '==', entityId)
      .where('workspaceId', '==', workspaceId)
      .limit(1)
      .get();

    if (weSnap.empty) {
      console.warn(`[LAST_CONTACTED] No workspace_entity found for ${entityId} in ${workspaceId}`);
      return { success: false, error: 'Entity not found in workspace' };
    }

    await weSnap.docs[0].ref.update({
      lastContactedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (error: any) {
    console.error('[LAST_CONTACTED] Update failed:', error.message);
    return { success: false, error: error.message };
  }
}
