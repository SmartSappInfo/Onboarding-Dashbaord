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
 * Includes a cleanup phase to remove orphaned dynamic variables while preserving constants.
 */
export async function syncVariableRegistry() {
  try {
    const variablesCol = adminDb.collection('messaging_variables');
    
    // 1. CLEANUP PHASE: Fetch all dynamic variables first (excluding constants)
    const existingDynamicSnap = await variablesCol
      .where('source', 'in', ['survey', 'pdf', 'static'])
      .get();
    
    const existingVarIds = new Set(existingDynamicSnap.docs.map(d => d.id));
    const varsToKeep = new Set<string>();

    const batch = adminDb.batch();

    // 2. STATIC CORE VARIABLES (Always Sync/Update)
    const staticVariables: Omit<VariableDefinition, 'id'>[] = [
      // School (General)
      { key: 'school_name', label: 'School Name', category: 'general', source: 'static', entity: 'School', path: 'name', type: 'string' },
      { key: 'school_initials', label: 'School Initials', category: 'general', source: 'static', entity: 'School', path: 'initials', type: 'string' },
      { key: 'school_location', label: 'School Location', category: 'general', source: 'static', entity: 'School', path: 'location', type: 'string' },
      { key: 'school_phone', label: 'School Phone', category: 'general', source: 'static', entity: 'School', path: 'phone', type: 'string' },
      { key: 'school_email', label: 'School Email', category: 'general', source: 'static', entity: 'School', path: 'email', type: 'string' },
      
      // Signatory Data (General Context)
      { key: 'contact_name', label: 'Primary Contact Name', category: 'general', source: 'static', entity: 'School', path: 'signatory.name', type: 'string' },
      { key: 'contact_position', label: 'Primary Contact Role', category: 'general', source: 'static', entity: 'School', path: 'signatory.type', type: 'string' },
      { key: 'contact_email', label: 'Primary Contact Email', category: 'general', source: 'static', entity: 'School', path: 'signatory.email', type: 'string' },
      { key: 'contact_phone', label: 'Primary Contact Phone', category: 'general', source: 'static', entity: 'School', path: 'signatory.phone', type: 'string' },
      
      // Finance Hub Variables
      { key: 'agreement_url', label: 'Institutional Signing Link', category: 'finance', source: 'static', entity: 'Contract', path: 'publicUrl', type: 'string' },
      { key: 'school_package', label: 'Subscription Tier', category: 'finance', source: 'static', entity: 'School', path: 'subscriptionPackageName', type: 'string' },
      { key: 'subscription_rate', label: 'Effective Unit Rate', category: 'finance', source: 'static', entity: 'School', path: 'subscriptionRate', type: 'number' },
      { key: 'subscription_total', label: 'Total Amount', category: 'finance', source: 'static', entity: 'School', path: 'nominalRoll * subscriptionRate', type: 'number' },
      { key: 'nominal_roll', label: 'Student Count', category: 'finance', source: 'static', entity: 'School', path: 'nominalRoll', type: 'number' },
      { key: 'arrears_balance', label: 'Outstanding Arrears', category: 'finance', source: 'static', entity: 'School', path: 'arrearsBalance', type: 'number' },
      { key: 'credit_balance', label: 'Available Credit', category: 'finance', source: 'static', entity: 'School', path: 'creditBalance', type: 'number' },
      { key: 'currency', label: 'Billing Currency', category: 'finance', source: 'static', entity: 'School', path: 'currency', type: 'string' },

      // Contact Tags (FR5.2.1, FR5.2.2)
      { key: 'contact_tags', label: 'Contact Tags (Comma-Separated)', category: 'general', source: 'static', entity: 'School', path: 'tags', type: 'string' },
      { key: 'tag_count', label: 'Tag Count', category: 'general', source: 'static', entity: 'School', path: 'tags.length', type: 'number' },
      { key: 'tag_list', label: 'Tag List (Array)', category: 'general', source: 'static', entity: 'School', path: 'tags[]', type: 'array' },
      { key: 'has_tag', label: 'Has Tag (Conditional)', category: 'general', source: 'static', entity: 'School', path: 'tags.includes', type: 'boolean' },

      // Meetings
      { key: 'meeting_time', label: 'Meeting Time', category: 'meetings', source: 'static', entity: 'Meeting', path: 'meetingTime', type: 'date' },
      { key: 'meeting_link', label: 'Meeting Link', category: 'meetings', source: 'static', entity: 'Meeting', path: 'meetingLink', type: 'string' },
      { key: 'meeting_type', label: 'Meeting Type', category: 'meetings', source: 'static', entity: 'Meeting', path: 'type.name', type: 'string' },
      
      // Survey Results
      { key: 'survey_score', label: 'Respondent Score', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'score', type: 'number' },
      { key: 'max_score', label: 'Survey Max Points', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'maxScore', type: 'number' },
      { key: 'outcome_label', label: 'Logic Result Name', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'outcome.label', type: 'string' },
      { key: 'result_url', label: 'Public Result Link', category: 'surveys', source: 'static', entity: 'SurveyResponse', path: 'resultUrl', type: 'string' },
    ];

    staticVariables.forEach(v => {
      const ref = variablesCol.doc(v.key);
      batch.set(ref, v, { merge: true }); 
      varsToKeep.add(v.key);
    });

    // 3. DYNAMIC SURVEY HARVESTING
    const surveysSnap = await adminDb.collection('surveys').where('status', '!=', 'archived').get();
    surveysSnap.forEach(doc => {
      const survey = doc.data() as Survey;
      const questions = survey.elements.filter((el): el is SurveyQuestion => 'isRequired' in el);
      
      questions.forEach(q => {
        const varId = `survey_${doc.id}_${q.id}`;
        varsToKeep.add(varId);
        const ref = variablesCol.doc(varId);
        batch.set(ref, {
          key: q.id,
          label: q.title.replace(/<[^>]*>?/gm, ''),
          category: 'surveys',
          source: 'survey',
          sourceId: doc.id,
          sourceName: survey.internalName || survey.title,
          entity: 'SurveyResponse',
          path: q.id,
          type: 'string'
        } as Omit<VariableDefinition, 'id'>, { merge: true });
      });
    });

    // 4. DYNAMIC PDF FORM HARVESTING
    const pdfsSnap = await adminDb.collection('pdfs').where('status', '!=', 'archived').get();
    pdfsSnap.forEach(doc => {
      const pdf = doc.data() as PDFForm;
      const fields = pdf.fields || [];
      
      fields.forEach(f => {
        if (f.type === 'signature' || f.type === 'photo') return;
        
        const varId = `pdf_${doc.id}_${f.id}`;
        varsToKeep.add(varId);
        const ref = variablesCol.doc(varId);
        batch.set(ref, {
          key: f.id,
          label: f.label || f.placeholder || f.id,
          category: 'forms',
          source: 'pdf',
          sourceId: doc.id,
          sourceName: pdf.name,
          entity: 'Submission',
          path: f.id,
          type: 'string'
        } as Omit<VariableDefinition, 'id'>, { merge: true });
      });
    });

    // 5. PURGE ORPHANS
    existingVarIds.forEach(id => {
      if (!varsToKeep.has(id)) {
        batch.delete(variablesCol.doc(id));
      }
    });

    await batch.commit();
    revalidatePath('/admin/messaging/variables');
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
 * Creates or updates a Global Constant variable.
 */
export async function upsertConstantVariable(data: Partial<VariableDefinition>) {
    try {
        const id = data.id || `const_${data.key}`;
        const finalData = {
            ...data,
            source: 'constant',
            entity: 'Global',
            category: 'general',
            type: 'string',
            updatedAt: new Date().toISOString()
        };
        await adminDb.collection('messaging_variables').doc(id).set(finalData, { merge: true });
        revalidatePath('/admin/messaging/variables');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Updates the global visibility of a variable.
 */
export async function updateVariableVisibility(id: string, hidden: boolean) {
    try {
        await adminDb.collection('messaging_variables').doc(id).update({ 
            hidden,
            updatedAt: new Date().toISOString()
        });
        revalidatePath('/admin/messaging/variables');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * Deletes a manual constant variable.
 */
export async function deleteVariable(id: string) {
    try {
        await adminDb.collection('messaging_variables').doc(id).delete();
        revalidatePath('/admin/messaging/variables');
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
        } else if (entity === 'School') {
            // Use Contact Adapter for backward compatibility (Requirement 25.4)
            if (workspaceId) {
                const contact = await resolveContact(id, workspaceId);
                if (contact) {
                    // Return schoolData for backward compatibility with existing templates
                    data = contact.schoolData || null;
                }
            } else {
                // Fallback to direct query if no workspace context
                const snap = await adminDb.collection('schools').doc(id).get();
                if (snap.exists) data = snap.data();
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
    let tagIds: string[] = [];

    // If workspaceId is provided, resolve from workspace_entities.workspaceTags (Requirement 7)
    if (workspaceId) {
      // First, try to find the entity ID from the contact
      const collectionName = contactType === 'school' ? 'schools' : 'prospects';
      const contactSnap = await adminDb.collection(collectionName).doc(contactId).get();

      if (!contactSnap.exists) return empty;

      const contactData = contactSnap.data();
      const entityId = contactData?.entityId || contactId; // Fall back to contactId if no entityId

      // Query workspace_entities for workspace-scoped tags
      const weSnap = await adminDb
        .collection('workspace_entities')
        .where('entityId', '==', entityId)
        .where('workspaceId', '==', workspaceId)
        .limit(1)
        .get();

      if (!weSnap.empty) {
        tagIds = weSnap.docs[0].data()?.workspaceTags || [];
      } else {
        // Fall back to legacy tags if no workspace_entities record exists
        tagIds = contactData?.tags || [];
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
    const [schoolsSnap, prospectsSnap] = await Promise.all([
      adminDb.collection('schools').where('workspaceIds', 'array-contains', workspaceId).get(),
      adminDb.collection('prospects').where('workspaceId', '==', workspaceId).get(),
    ]);

    interface ContactEntry {
      id: string;
      name: string;
      tags: string[];
    }

    const allContacts: ContactEntry[] = [
      ...schoolsSnap.docs.map(d => ({ id: d.id, name: d.data().name || '', tags: d.data().tags || [] })),
      ...prospectsSnap.docs.map(d => ({ id: d.id, name: d.data().name || '', tags: d.data().tags || [] })),
    ];

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
