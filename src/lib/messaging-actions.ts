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

    // 1. DYNAMIC SURVEY HARVESTING
    const surveysSnap = await adminDb.collection('surveys').where('status', '!=', 'archived').get();
    for (const doc of surveysSnap.docs) {
      const survey = doc.data() as Survey;
      const workspaceId = survey.workspaceIds?.[0] || 'onboarding'; // Surveys can be multi-workspace, but we map to primary for field registry
      const organizationId = survey.organizationId || 'default';
      
      const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);

      for (const q of questions) {
        const fieldId = `survey_${doc.id}_${q.id}`;
        await fieldsCol.doc(fieldId).set({
          workspaceId,
          organizationId,
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

      for (const f of fields) {
        if (f.type === 'signature' || f.type === 'photo') continue;

        const fieldId = `pdf_${doc.id}_${f.id}`;
        await fieldsCol.doc(fieldId).set({
          workspaceId,
          organizationId,
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
            focalPerson: contact.contacts?.find(c => c.isSignatory) || contact.contacts?.[0]
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
 * Previews the audience for a campaign with tag-based filtering.
 * Returns contact count, a preview list, and tag distribution.
 *
 * Requirements: FR5.1.2, FR5.1.3
 */
export async function previewCampaignAudience(params: {
  workspaceId: string;
  includeTagIds?: string[];
  excludeTagIds?: string[];
  includeLogic?: 'AND' | 'OR';
  limit?: number;
}): Promise<{
  success: boolean;
  count?: number;
  preview?: { id: string; name: string; tags: string[] }[];
  tagDistribution?: { tagId: string; tagName: string; count: number }[];
  error?: string;
}> {
  try {
    const { workspaceId, includeTagIds = [], excludeTagIds = [], includeLogic = 'OR', limit: previewLimit = 10 } = params;

    // Step 1: Get all contacts in workspace
    const entitiesSnap = await adminDb.collection('workspace_entities').where('workspaceId', '==', workspaceId).get();

    interface ContactEntry {
      id: string;
      name: string;
      tags: string[];
    }

    const allContacts: ContactEntry[] = entitiesSnap.docs.map(d => ({ 
      id: d.data().entityId || d.id, 
      name: d.data().displayName || d.data().name || '', 
      tags: d.data().workspaceTags || [] 
    }));

    // Step 2: Apply include filter
    let filtered = allContacts;

    if (includeTagIds.length > 0) {
      filtered = filtered.filter(contact => {
        if (includeLogic === 'AND') {
          return includeTagIds.every(tagId => contact.tags.includes(tagId));
        }
        return includeTagIds.some(tagId => contact.tags.includes(tagId));
      });
    }

    // Step 3: Apply exclude filter
    if (excludeTagIds.length > 0) {
      filtered = filtered.filter(contact =>
        !excludeTagIds.some(tagId => contact.tags.includes(tagId))
      );
    }

    // Step 4: Resolve tag names for distribution
    const allTagIds = new Set<string>();
    filtered.forEach(c => c.tags.forEach(t => allTagIds.add(t)));

    const tagNameMap = new Map<string, string>();
    const tagIdArray = Array.from(allTagIds);
    for (let i = 0; i < tagIdArray.length; i += 10) {
      const chunk = tagIdArray.slice(i, i + 10);
      if (chunk.length === 0) continue;
      const snap = await adminDb.collection('tags').where('__name__', 'in', chunk).get();
      snap.docs.forEach(d => tagNameMap.set(d.id, d.data().name as string));
    }

    // Step 5: Build tag distribution
    const tagCounts = new Map<string, number>();
    filtered.forEach(contact => {
      contact.tags.forEach(tagId => {
        tagCounts.set(tagId, (tagCounts.get(tagId) || 0) + 1);
      });
    });

    const tagDistribution = Array.from(tagCounts.entries())
      .map(([tagId, count]) => ({ tagId, tagName: tagNameMap.get(tagId) || tagId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    // Step 6: Build preview list with resolved tag names
    const preview = filtered.slice(0, previewLimit).map(contact => ({
      id: contact.id,
      name: contact.name,
      tags: contact.tags.map(id => tagNameMap.get(id) || id),
    }));

    return {
      success: true,
      count: filtered.length,
      preview,
      tagDistribution,
    };
  } catch (error: any) {
    console.error('previewCampaignAudience error:', error.message);
    return { success: false, error: error.message };
  }
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
  contactScope: 'primary' | 'signatories' | 'all' | 'custom';
  channel: 'email' | 'sms';
}): Promise<string[]> {
  const { entityId, workspaceId = 'onboarding', contactScope, channel } = params;

  try {
    const contact = await resolveContact(entityId, workspaceId);
    if (!contact) return [];

    let recipients: string[] = [];

    if (contactScope === 'primary') {
      const email = getContactEmail(contact);
      const phone = getContactPhone(contact);
      const val = channel === 'email' ? email : phone;
      recipients = val ? [val] : [];
    } else if (contactScope === 'signatories') {
      recipients = contact.contacts
        .filter(c => c.isSignatory)
        .map(c => channel === 'email' ? c.email : (c.phone || ''))
        .filter(v => !!v);
    } else if (contactScope === 'all') {
      recipients = contact.contacts
        .map(c => channel === 'email' ? c.email : (c.phone || ''))
        .filter(v => !!v);
    }

    // Return recipients or empty array for sendMessage to handle auto-resolution
    return recipients.length > 0 ? recipients : [''];
  } catch (error) {
    console.error(`[RESOLVE_CONTACTS] Error for ${entityId}:`, error);
    return ['']; // Fallback to auto-resolution
  }
}
